# Velum Lounge System — Design Doc

## 1. Core Entities

```
lounges
  id
  parent_lounge_id     FK -> lounges.id, NULL (NULL = top-level lounge)
  type                 ENUM('official','user_created','private_sublounge')
  owner_user_id        FK -> users.id, NULL for 'official'
  name
  visibility           ENUM('public','private')       -- creator's choice, toggleable
  hide_member_list     BOOL DEFAULT false               -- owner-controlled
  is_locked            BOOL DEFAULT false
  status               ENUM('active','muted','archived','deleted')
  last_active_at       TIMESTAMP                        -- drives auto-expiry (§9)
  created_at

lounge_members
  lounge_id
  user_id
  role                 ENUM('owner','admin','moderator','member')
  status               ENUM('active','muted','banned','kicked')
  joined_via           ENUM('invite_code','added_by_admin','application','default')
  joined_at
  PRIMARY KEY (lounge_id, user_id)

lounge_invites
  id
  lounge_id
  code                 -- see §3 for format
  created_by
  max_uses             DEFAULT 1
  uses_count           DEFAULT 0
  expires_at           NULL
  revoked_at           NULL

lounge_sanctions
  id
  lounge_id
  user_id
  type                 ENUM('mute','ban','kick','delete_lounge')
  applied_by
  applied_by_type      ENUM('lounge_admin','login_admin','cli_admin')
  applied_at
  lifted_at            NULL
  reason
```

`lounge_members.status` is the current live state (fast permission checks). `lounge_sanctions` is the historical record (who, when, at what authority). Keep them separate — one table trying to do both jobs is how you end up with inconsistent state later.

---

## 2. Structural Rules

- **Max 10 sublounges per parent** — enforced at insert time:
  ```sql
  SELECT COUNT(*) FROM lounges
  WHERE parent_lounge_id = :parent_id AND status != 'deleted';
  -- reject if >= 10
  ```
- **One private sublounge per user per parent** — enforced with a partial unique index, not an application-layer check (race conditions will otherwise slip through):
  ```sql
  CREATE UNIQUE INDEX one_private_sublounge_per_user
  ON lounges (parent_lounge_id, owner_user_id)
  WHERE type = 'private_sublounge' AND status != 'deleted';
  ```
- **Public vs. private** is a creator choice at creation time, stored on `visibility`, editable later by the owner.
- **Hidden member list** is an owner-toggleable flag, checked at the members-list endpoint — hiding it doesn't affect moderation visibility (admins/system admins can always see membership; it only hides the list from ordinary members).

---

## 3. Invite Code Format

```
VE / p / <unique-code>     — parent / community lounge invite
VE / s / <unique-code>     — sublounge (private/VIP) invite
```

The prefix (`p` vs `s`) lets the backend route validation without a lookup first — you know which table/rules apply before you even query. Codes are single-use by default (`max_uses = 1` on `lounge_invites`), regenerable/revocable independently of the lounge itself since they live in their own table.

---

## 4. Authority Model — Two Separate Axes

Don't model system admins as "a role" inside lounge RBAC. They're a separate axis that short-circuits normal checks entirely.

```
system_admins
  user_id
  admin_type       ENUM('cli_admin','login_admin')
  granted_at
  granted_by       NULL = bootstrap
```

**Axis 1 — Lounge role** (`lounge_members.role`): owner / admin / moderator / member. Scoped to one lounge, governs everyday permissions inside it.

**Axis 2 — Platform authority** (`system_admins`): exists independently of any lounge membership. A `cli_admin` or `login_admin` doesn't need a `lounge_members` row to moderate any lounge, including Velum's official one.

**Authority order**, used to gate who can override whom:
```
cli_admin  >  login_admin  >  lounge_admin (owner/admin/moderator)
```
A lounge admin's sanction can be lifted by login/cli admin. The reverse is blocked at the write layer — not a UI restriction, a permission check that fails the write outright.

### Centralized permission checks

At your current scale, don't reach for a full policy engine (Casbin/OPA) — but do centralize every check into one shared function so cascade logic isn't reimplemented per route:

```
can(actor, action, resource):
    if actor in system_admins: return True   # short-circuits everything
    membership = lounge_members[resource.lounge_id][actor]
    if resource is private_sublounge and actor is parent_admin_but_not_member:
        return False   # explicit block — parent admins never get message access
    return permission_bitmask(membership.role) includes action
```

Represent granular permissions as bitmasks against role (send message, delete message, mute, ban, manage sublounges, view sealed rooms...), not just a fixed 4-role ladder. This costs little now and means custom/finer-grained roles later don't require a schema rewrite — you're only recomposing which bits a role carries.

---

## 5. Sanctions & Cascade Logic

**Mute** — checked *live* against the parent lounge, never duplicated into the child:
```
effective_status(user, sublounge):
    parent_status = lounge_members[sublounge.parent_lounge_id][user].status
    if parent_status in ('banned','kicked'):
        → sublounge is deleted, cascade below runs
    if parent_status == 'muted':
        → sublounge is muted for everyone in it, for as long as the parent mute is active
    else:
        → use sublounge's own status
```
When the parent mute lifts, the sublounge unmutes automatically — no extra bookkeeping, no sync bugs.

**Ban / kick** — triggers an actual cascade-delete event (real cleanup required, so this is application logic, not a lazy check):
```
on_sanction_applied(lounge, user, type):
    if type in ('banned','kicked'):
        child = find private_sublounge where parent_lounge_id = lounge.id and owner_user_id = user.id
        if child exists:
            child.status = 'deleted'
            remove_all_members(child) + notify each
            notify(user, "your private room was closed")
```

**Scope of cascade by authority tier:**
- `lounge_admin` sanctions cascade only within that lounge's own hierarchy (parent → its private sublounges).
- `login_admin` / `cli_admin` sanctions cascade **globally** — across every lounge the user belongs to, applying the same ban/kick + sublounge-deletion logic everywhere.

**Kicked/banned users' messages are never deleted.** Standard behavior across Discord, Slack, Discourse — soft-delete the *membership*, not the *content*. The message stays, the sender displays as "Removed member" instead of their name.

---

## 6. Join Methods

- **Direct invite code** (`VE/p/...` or `VE/s/...`) → insert into `lounge_members`, increment `uses_count`.
- **Owner/admin adds directly** → insert with `joined_via = 'added_by_admin'`.
- **Apply to join** → its own table, not shoehorned into membership:
  ```
  lounge_join_requests
    lounge_id, user_id, message (optional),
    status ENUM('pending','approved','rejected'),
    reviewed_by, reviewed_at
  ```
  Only on approval does a `lounge_members` row get created.

---

## 7. Ownership Lifecycle

**Succession / transfer** — a request the receiving user must accept, not an instant reassignment:
```
lounge_ownership_transfers
  lounge_id, from_user_id, to_user_id,
  status ENUM('pending','accepted','declined','expired'),
  initiated_at, resolved_at
```
On acceptance: `lounges.owner_user_id` updates, old owner demotes to `admin` (stays in their own community, doesn't get removed).

**No successor named / no response:** auto-promote the longest-standing `admin` in that lounge as fallback.

---

## 8. Account Deletion — 7-Day Grace Period

Two clocks, because "delete the account" and "delete the data" are different events for a financial app:

```
account_deletion_requests
  user_id, requested_at, scheduled_purge_at (requested_at + 7d),
  status ENUM('pending','cancelled','purged')
```

- During the 7 days: account locked/hidden, not purged. Reversible. Gives compliance/fraud teams a window if there's an open dispute.
- If the user owns a lounge: prompted to transfer ownership (§7) before the window closes; auto-promotion fallback triggers if they don't.
- At day 7: hard-delete private/social data (profile, messages, memberships). Anything tied to KYC or transaction history that carries regulatory retention obligations should be anonymized (`user_id → deleted_user_[hash]`), not hard-deleted — confirm actual retention requirements for your jurisdiction rather than assuming full wipe is compliant.
- Lounge messages from a purged user follow the same rule as kicks: content stays, sender shows as "Deleted user."

---

## 9. Marketplace-Specific Differentiators

These are the features that make Velum's lounges more than a Discord clone — they tie directly into the marketplace core rather than existing as a bolted-on chat layer:

- **Trust-linked lounges** — a "Verified seller" badge shown in the member list, sourced from existing KYC/reputation data; optionally, rooms that require a minimum trust score to join at all.
- **Auto-expiring private sublounges** — `lounges.last_active_at` drives an archive job (e.g. archive after N days of no messages). Leans into "conversation-scoped," not "permanent turf" — a deliberate contrast to Discord's channels-live-forever default.
- **Deal/escrow-linked rooms** — a temporary lounge auto-created around a specific transaction between two marketplace users, scoped to that deal, auto-closing when the transaction completes. No analogue in Discord — this is the feature that makes the lounge system feel native to a financial marketplace rather than borrowed from a gaming chat app.

---

## 10. Reports & Complaints

Extend the existing ticket system rather than building a parallel one:

```
tickets
  ... existing fields ...
  category      ENUM('support','report_user','report_lounge','report_message','appeal')
  target_type, target_id     -- nullable, set only for reports
  visibility    ENUM('reporter_only','exec_only')
```

**Critical rule:** reports where `category = 'report_lounge'` (i.e. reporting a lounge's own admin) are only ever surfaced in the system-admin (`login_admin`/`cli_admin`) queue — never visible to that lounge's own admin view. This is a query-layer filter, not a UI hide.

---

## 11. Audit Logging — Two Tables, Not One

```
lounge_audit_log
  id, lounge_id, actor_id, actor_type ENUM('lounge_admin','login_admin','cli_admin'),
  action ENUM('mute','ban','kick','delete_message','delete_lounge','transfer_ownership','settings_change'),
  target_type, target_id, metadata (jsonb), created_at

system_audit_log
  id, actor_id, actor_type ENUM('login_admin','cli_admin'),
  action ENUM('account_purge','ticket_resolved','lounge_force_deleted','global_ban','policy_override'),
  target_type, target_id, metadata (jsonb), created_at
```

Keep these as separate tables, not one table filtered by scope. A lounge admin should only ever be able to query `lounge_audit_log` for lounges they moderate; `system_audit_log` should be structurally unreachable to non-system-admins at the permission layer — not just hidden in the UI. A single shared table risks a query bug leaking platform-level actions to a lounge admin who shouldn't see them.

---

## 12. Directory & Discoverability

```
lounges
  ... existing fields ...
  discoverable   BOOL   -- derived from visibility, but kept explicit for query clarity
```

- **Public lounges**: browsable and keyword-searchable in the directory. This is the growth/discovery surface — new users should be able to find active communities without needing an invite.
- **Private lounges**: never appear in keyword/topic search or browse listings, no exceptions. The one narrow carve-out: searching an *exact username* can surface "this user owns a private lounge — request access," without exposing the lounge itself to general search. This is **opt-in**, not default-on:
  ```
  lounges
    ... existing fields ...
    findable_by_username   BOOL DEFAULT false
  ```
  Owner toggles this from their lounge settings. Off by default so a private lounge is genuinely unfindable unless the owner explicitly chooses to be reachable this way.
- **Private sublounges** (VIP rooms): never discoverable by anyone, including via username search — access is invite-code only, always.

---

## 13. Welcome / Join Messages

Two layers, both optional to the owner but the first is free:

- **System-generated**: fires automatically on join — "You joined General Discussion." No configuration needed.
- **Custom welcome message**: owner-authored text (e.g. house rules, a pinned link) that appends after the system message. Stored on the lounge itself:
  ```
  lounges
    ... existing fields ...
    welcome_message   TEXT, NULL
  ```
  Rendered as a distinct system-style message in the thread, not attributed to any user, so it doesn't get muted/hidden if the owner themselves is later sanctioned.

---

## 14. Personal Preferences — Mute & Pin

These are **user-side preferences, not moderation** — must live entirely separate from `lounge_sanctions` and `lounge_members.status`, or you'll eventually have a bug where a personal notification-mute reads as a moderation mute (or vice versa).

```
user_lounge_preferences
  user_id
  lounge_id
  notifications_muted   BOOL DEFAULT false
  pinned                BOOL DEFAULT false
  pin_order              INT, NULL         -- lets pinned lounges be manually reordered
  PRIMARY KEY (user_id, lounge_id)
```

- Muting here only silences notifications for that user — it has zero effect on their ability to post, and zero visibility to anyone else. Completely orthogonal to a moderation mute.
- Pinned lounges surface at the top of the lounge rail, ordered by `pin_order`.

---

## 15. Lounge Profile Card

The "about" view for any lounge — public, user-created, or sublounge. Reads as an identity card, not a settings screen:

```
- name
- banner / avatar image
- visibility badge: Official (system) / Public / Private
- about / description text
- rules (freeform or structured list)
- member count
- owner (name + avatar) — replaced with "Managed by Velum Staff" for the official lounge
- admin / moderator list, role-tagged
- join method indicator: Open · Invite-only · Apply-to-join
- parent-lounge breadcrumb (sublounges only) — e.g. "General Discussion → Late Night Desk"
- created_at
- status banner if currently muted ("This lounge is temporarily muted")
```

For private sublounges specifically, the version a **parent-lounge admin** sees is deliberately minimal — name, owner, member count, created date, status. No description, no message access, nothing that implies visibility into content. Enforce this at the query layer (a parent-admin-scoped endpoint should structurally be unable to join against that sublounge's messages table), not just by hiding it in the UI.

---

## 16. UI Component Catalog

Carried over from the mockup, made explicit as a spec rather than just a visual reference:

- **No `#` prefixes, no exposed internal IDs**, anywhere in the interface. Room/lounge identifiers shown to users are always the human-assigned `name` — if a name lookup ever fails, that's a bug to fix, never a fallback to expose the raw ID.
- **Seal system** replaces both channel-hash and avatar-square conventions:
  - *Outlined seal* — open/public room, anyone in the lounge can enter.
  - *Filled seal* — your own private sublounge.
  - *Hairline-locked seal* — another member's private sublounge, shown to parent admins as a sealed card: existence and owner only, never a preview, never content.
- **Two-panel layout, not a single scrolling view**:
  1. **Sidebar (sublounge directory)** — persistent, shows the currently-open lounge's full room structure at a glance: top-level lounge switcher (rail), then a directory list grouped as *Rooms* / *Private*, with pinned lounges surfaced first per §14. This panel stays visible while browsing between rooms — it's the map, not a drawer you have to reopen each time.
  2. **Main panel** — the active room's content (thread + composer) or the About/Members view when toggled. Switching rooms updates only this panel; the sidebar never reloads.
  - The private section within the sidebar directory shows only the current user's own sublounge as an actionable card (tap → invite code) — other members' private rooms appear as locked cards, visually inert, existence-only.
  - On narrow/mobile viewports, the sidebar collapses to a slide-over rather than disappearing — the sublounge directory should never be more than one tap away.
- **Invite code display**: never dumped into a chat stream. Always a dedicated card with a copy action, matching the `VE/p/...` and `VE/s/...` formats from §3.
- **Welcome message**: rendered as an unattributed system-style line, distinct from regular messages.
- **Composer-level policy hints**: where relevant (e.g. private sublounges), a small persistent note explaining cascade behavior — "Sanctions in the parent lounge apply here automatically" — so cascade effects are never a silent surprise to the user experiencing them.
