# Pending (not today)

Parked items. Do **not** start these while chaos-suite R0–R1 are in progress.

## Username / language policy (product)

**Goal (when we pick this up):**
- No ugly register names like `alex_jordan_social_butterfly`
- Short login handle (e.g. `alexj`; UI may show `@alexj`)
- Human display name (e.g. `Alex Jordan`, or non-English)
- No emojis on register
- Non-English speakers can register

**Today (do not change for chaos):**
- Server login username is ASCII only: `[a-zA-Z0-9_-]`, length 3–32
- Chaos uses short Latin handles from the naming library (`Sofia`, `Yuki`, `Amara`, …) + `VelumChat1!`
- That is enough for chaos suite work

**Later (estimate ~2–4 days if Unicode login letters):**
- Tighten: no emoji, no long underscore chains, no spaces in login username
- Optional: allow Unicode letters in username (NFC + uniqueness rules), or keep ASCII login and put language in **display name** only (safer, ~0.5–1 day)

**Decision deferred.** Chaos continues with the current naming library + existing register rules.

---

## Other parked tracks

| Item | Notes |
|------|--------|
| Market / escrow / wallet / bank in chaos | APIs unstable / 404 — see `chaos.md` R6 |
| Main merge / PR / Railway | Not part of chaos work |
| A6 UI naming sweep (app frontend) | Separate from chaos |

When ready: greenlight a specific row above; do not bundle with chaos R1.
