# VELUM DIAGNOSTICS & RESOLUTION PLAN

## I. Issue Diagnosis

### 1. Root Cause of "Unexpected token '<'" JSON Parse Error
* **The Error**: `Failed to fetch conversations summary: Unexpected token '<', "<!doctype "... is not valid JSON`
* **Nginx/Iframe Redirect**: The AI Studio preview environment runs the application inside an iframe. Under certain browser configurations (such as Safari, Brave, or Chrome with "Block third-party cookies" enabled), the browser blocks cross-origin cookies for the iframe domain.
* **Authentication Flow**: When cookie validation or the initial domain handshake fails, the Google AI Studio proxy intercepts the request to `/v2/lounges/conversations/summary` and returns a `302 Found` redirect to `/__cookie_check.html` to establish session parameters.
* **Fetch Handling**: Since standard browser `fetch()` follows redirects automatically, the frontend fetches `/__cookie_check.html` (which is an HTML document starting with `<!doctype html>`) with a `200 OK` response status. The client-side code then attempts to parse this HTML body as JSON via `res.json()`, triggering the JSON parse exception.
* **Verified API Health**: Direct server-side curls to `http://localhost:3000/v2/lounges/conversations/summary` successfully return pristine JSON: `{"summary":{},"unreadCounts":{}}`.

### 2. Locked Component States (ChatArea, DirectMainDashboard, useWebSocket)
* **WebSocket Failure**: When the iframe cookie check fails, the browser blocks cookie and session headers required for authenticating both API calls and the WebSocket handshake (`/ws?userId=...&sessionId=...`).
* **Connection Hang**: Because the session handshake fails or receives an HTML document instead of JSON, the client is unable to fetch the initial rooms, lounge layout, or user messages. Consequently, the UI layers (e.g., `ChatArea`, `DirectMainDashboard`) remain frozen in their initial loading or "locked" fallback states awaiting data synchronization.

---

## II. Proposed Implementation Phases

### Phase 1: Robust Client-Side Resilience & Navigation Warnings
* **Content-Type Validation**: Update `src/hooks/useWebSocket.ts` to inspect the response `Content-Type` header before parsing as JSON. If the content type is HTML or if the content starts with `<!doctype` or `<html>`, catch it cleanly as a cookie/iframe restriction block rather than throwing a parsing exception.
* **User Diagnostics Banner**: Introduce a non-intrusive notification or banner in the UI (e.g., in the workspace header or main dashboard) when an HTML response is detected on API endpoints or when WebSocket fails repeatedly. Advise the user to open the application in a new tab to bypass third-party cookie restrictions.

### Phase 2: Session Transport Hardening (SessionStorage Fallback)
* **Explicit Auth Headers**: Ensure that all fetch requests to `/v2/*` endpoints explicitly pass the `x-session-token` or `Authorization` header retrieved from `sessionStorage` (which bypasses cookie-reliance for REST endpoints).
* **WebSocket Handshake Validation**: Review `/server/websocket.ts` to ensure that if session cookies are absent, the server validates the incoming connection using the query string `sessionId` parameter (which is populated from `sessionStorage` in `useWebSocket.ts`).

---

## III. Verification Procedures
1. Run `npm run lint` (`tsc --noEmit`) to verify no compilation regressions are introduced.
2. Build the app using `npm run build` to confirm the production artifact compiles.
3. Test the updated API fallback by curling and verifying client tolerance.
