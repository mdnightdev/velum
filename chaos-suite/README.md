# Velum Chaos Suite

Simulates real users against a local Velum API (`http://localhost:3000/v2`).

**Kept stack:** `ChaosController` → `ChaosAgent` → `VelumApiClient`  
**Removed:** Simple, Improved (AI), old ApiClient, stealth admin-visibility docs.

## Logging

Terminal = k6-style summary (checks + ms). Disk = plain text detail.

```
chaos  8  auth  local
→ chaos-logs/auth-...
  8/8

NAME       ROLE        PING    AUTH    OUT     IN     AVG   RESULT
Alex       social     ✓  42   ✓ 180   ✓  30   ✓  95   87ms  pass
...
8/8 passed  avg 87ms  p95 180ms
→ chaos-logs/auth-...
```

```
chaos-logs/<label>-<timestamp>/
  summary.txt
  audit.log
  agents/<Username>.txt
```

Columns: PING (health ms), AUTH (login|register), OUT (logout), IN (relogin).
Personas: `social` `casual` `tech` `drama` `support` `attention`
`"verboseTerminal": true` prints live fail/ok lines.


## Run

```bash
cd chaos-suite
npm install
# Velum server must already be up on :3000
npm start
```

Config: `chaos.config.json` — `loungeOnly: true` (R2), or `authOnly: true` (R1).

```bash
npm run clean   # dist, chaos-logs, chaos-data
npm run build   # tsc → dist/
```

## Layout

```
src/index.ts
src/controller/ChaosController.ts
src/agents/ChaosAgent.ts
src/agents/VelumApiClient.ts
src/agents/WsClient.ts          # not wired yet
src/utils/persistence.ts
src/utils/chaosLogger.ts
src/telemetry/Telemetry.ts      # used by WsClient
chaos.config.json
```

## Known gaps (fix next)

1. Auth response: use `data.user.userId`, not flat `data.userId`
2. Message list: unwrap `{ messages }`
3. Wire `/ws` after login
4. Prefer test-band user IDs 9000–9999 + purge
5. Stagger agent start; respect ticket rate limits

Do not target reserved users `1`, `2`, `999`.
