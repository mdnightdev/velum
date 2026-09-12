# Chaos suite revamp

Living plan for `chaos-suite/`. Stack kept: Chaos OG only (`ChaosController` → `ChaosAgent` → `VelumApiClient`). Simple and Improved are gone.

## Status

| Phase | Work | Status |
|-------|------|--------|
| C1 | Drop Simple + Improved; one stack | DONE |
| **R0** | **Naming library** (human names, `VelumChat1!`, panic, pool ≤100) | **DONE** |
| **R1** | **Auth gate:** fix parse; register + login + logout + **relogin**; persist creds | **DONE** |
| R2 | Lounges: join Velum master rooms; message unwrap; no lounge create spam | **DONE** |
| **Live** | **Auth → 120s persona session (butterfly/idle/bounce/mixed); talk library; no lounge create** | **DONE** |
| **Create** | **Auth → creators make public lounges (≥10 subs) → others find+join only** | **DONE** |
| **Friends** | **Auth → discover → request → accept → DM contacts only; 1/2/999 never discoverable** | **DONE** |
| **Avatar** | **Point at phone `chaos/Avatars`; auth → upload → profile verify (no DM/lounge)** | **DONE** |
| **Media** | **Auth → upload from `chaos/Media` → send media+caption to DM contacts + lounges** | **DONE** |
| **WS** | **Auth → /ws connect → paired DM peer send/recv proof** | **DONE** |
| **Cues** | **Auth → join general → seed cue line → peer detect+reply (banks)** | **DONE** |
| R3 | WS peer chat, conversation cues, avatars + media | **DONE** |
| R4 | Friends; tickets; duress + deleted accounts; IP/device/location; traits; loop | PENDING |
| R5 | Scale cap 100; expand libraries | PENDING |
| R6 | Market / escrow / wallet / bank | DEFER |

## Gate rule

**Naming → Auth → everything else.**  
If register/login/relogin fails systematically, **stop**. Do not build lounges/chat on a broken session.

## Locked decisions

- Human names + easy password `VelumChat1!` (no snake_case).
- Panic / duress phrase: `chaospanic`.
- Local default **5–10** agents; prod-like cap **100**.
- Loop mode later (`loop: true`).
- Same production API/WS code paths; no market/wallet until stable.
- Never touch users `1`, `2`, `999`.

## Scale and run mode

| Mode | Agent count | Use |
|------|-------------|-----|
| Local dev (default) | **5–10** max | Fast while building |
| Prod-like | Cap **100** | Never unbounded |

Config: `chaos-suite/chaos.config.json` (`agentCount`, later `loop` / `maxLoops`).

## R0 — Naming library

- **DONE.** File: [`chaos-suite/src/data/naming.ts`](chaos-suite/src/data/naming.ts)
- 140 global Latin-script names (Sofia, Yuki, Amara, Wei, Nikolai, …) — not English-only
- Note: register API today is ASCII-only (`[a-zA-Z0-9_-]`); Unicode login letters deferred — see [`PENDING.md`](PENDING.md)
- Work with current library only; no product username-schema work during chaos R0–R1
- `VelumChat1!` / `chaospanic`; controller wired; local clamp max 10
- Config default `agentCount: 8`, `mode: local`

## R1 — Auth gate

**DONE.** `authOnly: true` in `chaos.config.json` (default until lounges phase).

1. `VelumApiClient` stores `data.token` + `data.user.userId`
2. Register body: username, password, panicPhrase only
3. Flow per agent: login (or register) → persist → logout → relogin
4. Username conflict → allocate another name and retry
5. Any failure → exit code 1, message `AUTH GATE FAILED`

Run: `cd chaos-suite && npm start` (server on :3000).

**Exit met:** 8/8 agents passed register/login/logout/relogin on local smoke.

## Later phases (summary)

| Phase | Focus |
|-------|--------|
| R2 | Join all accessible Velum-master sublounges; own lounge + real sublounge; `{ messages }` unwrap; drop `/leave` |
| R3 | WS; conversation cues; `assets/avatars`, `assets/media` |
| R4 | Friends accept/deny + DM; tickets; duress; delete; stable device/IP/location; loop |
| R5 | Cap 100; grow trait + conversation libraries |
| R6 | Market/escrow/wallet/bank when APIs work |

## Behavior model (from R3+)

Traits (weights) separate from actions; conversation library with **response cues**; expandable message banks.

## Device / IP / location (R4)

Stable per-agent fingerprint per run; rotate IP on re-login/compromise; profile location/bio when trait allows.

## Non-goals

- No Simple/Improved resurrection.
- No lounge/chat work while auth is red.
- No market/wallet before R6 greenlight.
- No unbounded agent counts.

## Logging

Terminal stays quiet. Full audit on disk:

```
chaos-logs/auth-<timestamp>/
  README.txt
  summary.txt / summary.json
  audit.jsonl
  agents/Alex.json    <- open by username
  agents/Jordan.json
```

`verboseTerminal: true` in config prints each OK. Default is progress + fails + final summary only.



```bash
cd chaos-suite
npm install
# Velum server on :3000
npm start
```

## Implementation triggers

`implement phase R0` → naming library only.  
`implement phase R1` → auth gate only; stop and report pass/fail.  
`proceed` only after auth is green for R2+.
