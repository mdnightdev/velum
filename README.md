# Velum (V3) — Premium Secure Communications Engine

Velum is a high-performance, secure real-time messaging, lounge hosting, and support ticketing platform built for speed and security. It combines a client-side pre-hashed cryptographic authentication system with a local-first SQLite architecture backed by Neon PostgreSQL distributed cloud syncing.

---

## Key Features

- **Cryptographic Challenge Authentication**: Uses a client-side salt and sliding-nonce handshake to secure registrations and logins against replay attacks.
- **Robust Storage Architecture**: Fast, lightweight local storage powered by SQLite, backed by automated, secure gzip-compressed cloud state replication to Neon PostgreSQL.
- **Premium Admin Control Desk**: Full-featured support desk and system monitoring interface for administrators to handle server health, audit logs, and tickets.
- **Interactive Operator CLI**: Command Line Interface (`cli/index.ts`) that automatically synchronizes live PostgreSQL data on boot to interact with the system database.
- **Stress-Testing Suite**: Complete load-testing scenarios using `k6` to validate performance, latency thresholds, and API concurrency.

---

## Technical Setup & Running

### Prerequisites
- **Node.js** (v20+ recommended)
- **k6** (for running stress tests)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Local Development Server
```bash
npm run dev
```

### 3. Build & Run in Production Mode
```bash
npm run build
npm run start
```

### 4. Run the Operator CLI
To launch the interactive administrative terminal tool:
```bash
npx tsx cli/index.ts
```

### 5. Run the Load Tests
Validate performance and endpoints under load:
```bash
k6 run stress-tests/load_test.ts
```
