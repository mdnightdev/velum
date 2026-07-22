# Pending Tasks & Technical Debt

## 🐞 Bugs
- [x] **Tickets:** Support ticket replies vanish when sent by admin (one-way communication issue).

## 🚀 Refactoring & Performance
- [ ] **Database Persistence:** Refactor `server/db/persistence.ts` from local SQLite file-based approach to Postgres/Neon for production scalability and performance.
- [ ] **Performance:** Convert in-memory array manipulation (`db.sessions.filter`) to SQL queries to resolve potential bottlenecks before production.

## 🧪 Testing
- [ ] **Stress Testing:** Implement and execute 50-user concurrent stress test against local environment.
