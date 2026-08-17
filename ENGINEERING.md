# Engineering & System Architecture Checklist

This document tracks system design, distributed systems, infrastructure, data management, performance, reliability, and security practices extracted from the engineering matrix to evaluate and optimize Velum.

---

## 1. Networking, Protocols & API Architecture

| Topic | Status / Evaluation | Notes & Velum Context |
| :--- | :---: | :--- |
| **Reverse Proxies** | `[ ]` | Nginx/Caddy or Cloudflare upstream routing |
| **API Gateways** | `[ ]` | Request routing, rate limit enforcement, auth termination |
| **WebSockets** | `[ ]` | Real-time bi-directional messaging, heartbeat, state reconnects |
| **Long Polling** | `[ ]` | Fallback transport mechanisms |
| **Server-Sent Events (SSE)** | `[ ]` | One-way event stream alternative |
| **HTTP/2 & HTTP/3** | `[ ]` | Multiplexing, header compression, QUIC transport |
| **gRPC** | `[ ]` | Binary RPC for internal microservices |
| **Webhooks** | `[ ]` | Asynchronous event notifications |
| **DNS** | `[ ]` | Record configuration, failover, TTL settings |
| **TCP vs UDP** | `[ ]` | Transport layer protocol trade-offs |
| **API Versioning** | `[ ]` | URL pathing (`/v2/`), header versioning, backward compatibility |
| **Semantic Versioning** | `[ ]` | SemVer adherence (`MAJOR.MINOR.PATCH`) |

---

## 2. Distributed Systems & Message Processing

| Topic | Status / Evaluation | Notes & Velum Context |
| :--- | :---: | :--- |
| **Event-Driven Architecture** | `[ ]` | Asynchronous decoupled event processing |
| **Pub/Sub** | `[ ]` | Topic-based message fanout |
| **Message Queues** | `[ ]` | Background worker task processing |
| **Dead Letter Queues (DLQ)** | `[ ]` | Handling unprocessable messages & retry exhaustion |
| **Distributed Transactions** | `[ ]` | Multi-node transactional boundaries |
| **Saga Pattern** | `[ ]` | Choreographed/orchestrated compensating transactions |
| **Idempotency** | `[ ]` | Safe retry processing via idempotency keys |
| **Circuit Breakers** | `[ ]` | Failing fast when downstream dependencies degrade |
| **Timeouts** | `[ ]` | Bounded execution limits on external/internal network calls |
| **Retries & Exponential Backoff** | `[ ]` | Jittered exponential retries on transient errors |
| **Rate Limiting** | `[ ]` | Leaky bucket / token bucket protection on endpoints |
| **Service Discovery** | `[ ]` | Dynamic node resolution |
| **Leader Election** | `[ ]` | Single-coordinator coordination in cluster |
| **CAP Theorem** | `[ ]` | Consistency vs Availability vs Partition tolerance |
| **Eventual Consistency** | `[ ]` | Asynchronous data convergence models |
| **Network Partitions** | `[ ]` | Partition tolerance & split-brain prevention |
| **Clock Skew** | `[ ]` | Drift handling in distributed timestamps & token expiry |
| **Cron Jobs** | `[ ]` | Scheduled background maintenance tasks |

---

## 3. Database Architecture & Concurrency

| Topic | Status / Evaluation | Notes & Velum Context |
| :--- | :---: | :--- |
| **Database Indexing** | `[ ]` | B-tree, Hash, GIN indexes on query filters |
| **Query Optimization** | `[ ]` | Execution plan inspection (`EXPLAIN ANALYZE`) |
| **N+1 Queries** | `[ ]` | Batching relational lookups / DataLoader pattern |
| **Connection Pooling** | `[ ]` | Reusable client database connections |
| **Read Replicas** | `[ ]` | Offloading read traffic from primary |
| **Sharding** | `[ ]` | Horizontal database partitioning across servers |
| **Partitioning** | `[ ]` | Table-level range/hash partitioning |
| **Replication** | `[ ]` | Multi-node sync/async data replication |
| **Database Migrations** | `[ ]` | Schema migration tooling & zero-downtime DDL |
| **Schema Versioning** | `[ ]` | Migration version history & validation |
| **Optimistic Locking** | `[ ]` | Version column conflict detection |
| **Pessimistic Locking** | `[ ]` | Row-level locking (`SELECT FOR UPDATE`) |
| **Distributed Locks** | `[ ]` | Mutual exclusion across independent nodes (e.g. Redis Redlock) |
| **Race Conditions** | `[ ]` | Concurrency isolation & atomic operations |
| **Deadlocks** | `[ ]` | Lock acquisition ordering & transaction timeouts |

---

## 4. Performance, Caching & Scalability

| Topic | Status / Evaluation | Notes & Velum Context |
| :--- | :---: | :--- |
| **Caching** | `[ ]` | In-memory caching layers (Redis / Memcached) |
| **CDN & Edge Caching** | `[ ]` | Static asset and edge content distribution |
| **Cache Invalidation** | `[ ]` | TTLs, write-through, cache-aside, purge triggers |
| **Backpressure** | `[ ]` | Flow control when consumers lag producers |
| **Thread Safety** | `[ ]` | Concurrent data structure access protections |
| **Memory Leaks** | `[ ]` | Heap profiling, uncollected event listeners |
| **Garbage Collection** | `[ ]` | V8 GC pause tuning and memory management |
| **Autoscaling** | `[ ]` | Metric-triggered horizontal instance scaling |
| **Horizontal Scaling** | `[ ]` | Adding nodes behind load balancers |
| **Vertical Scaling** | `[ ]` | Increasing compute, RAM, and IOPS capacity |
| **Load Balancing** | `[ ]` | Layer 4 / Layer 7 load balancing algorithms |
| **Latency vs Throughput** | `[ ]` | Request duration vs requests per second |
| **P99 & Tail Latency** | `[ ]` | Optimization of outlier request response times |
| **Cold Starts** | `[ ]` | Initialization latency in serverless / isolated runtimes |
| **Serverless Limits** | `[ ]` | Memory, timeout, and execution constraints |
| **Build Caching** | `[ ]` | Vite / Docker / CI layer caching |
| **Cost Optimization** | `[ ]` | Compute, egress, and database resource efficiency |

---

## 5. Security & Cryptography

| Topic | Status / Evaluation | Notes & Velum Context |
| :--- | :---: | :--- |
| **Encryption in Transit** | `[ ]` | TLS 1.3, strict cipher suites, HSTS |
| **Encryption at Rest** | `[ ]` | Encrypted storage volumes, database column-level encryption |
| **Secrets Management** | `[ ]` | Vault / environment secret isolation |
| **IAM** | `[ ]` | Least-privilege access control policies |
| **OAuth** | `[ ]` | Delegated authentication / authorization protocols |
| **JWT Rotation** | `[ ]` | Short-lived tokens, refresh token rotation |
| **SQL Injection (SQLi)** | `[ ]` | Parameterized queries, ORM safety checks |
| **Cross-Site Scripting (XSS)** | `[ ]` | Content Security Policy (CSP), sanitization |
| **Server-Side Request Forgery (SSRF)** | `[ ]` | URL validation, blocking metadata/internal IP ranges |
| **Cross-Origin Resource Sharing (CORS)** | `[ ]` | Strict origin, credential, and header whitelisting |
| **CSRF** | `[ ]` | SameSite cookies, CSRF anti-forgery tokens |
| **WAF** | `[ ]` | Web Application Firewall filtering |
| **DDoS Protection** | `[ ]` | L3/L4/L7 volumetric attack mitigation |

---

## 6. Reliability, Disaster Recovery & Chaos Engineering

| Topic | Status / Evaluation | Notes & Velum Context |
| :--- | :---: | :--- |
| **Backups** | `[ ]` | Automated database snapshots & point-in-time recovery (PITR) |
| **Disaster Recovery** | `[ ]` | Recovery Time Objective (RTO) & Recovery Point Objective (RPO) |
| **Failover** | `[ ]` | Automated database & region failover |
| **Multi-Region Deployments** | `[ ]` | Geographic redundancy & latency routing |
| **Chaos Engineering** | `[ ]` | Intentional fault injection to verify resilience |

---

## 7. Observability, Monitoring & Operations

| Topic | Status / Evaluation | Notes & Velum Context |
| :--- | :---: | :--- |
| **Observability** | `[ ]` | Combined logs, metrics, and traces |
| **Logging** | `[ ]` | Structured JSON logging with correlation IDs |
| **Metrics** | `[ ]` | System & business telemetry |
| **Distributed Tracing** | `[ ]` | OpenTelemetry span propagation across services |
| **Alerting** | `[ ]` | Pager/webhook alerting on anomalous error rates/latencies |
| **SLIs (Service Level Indicators)** | `[ ]` | Quantifiable performance measurements |
| **SLOs (Service Level Objectives)** | `[ ]` | Target reliability thresholds (e.g., 99.9% uptime) |
| **Error Budgets** | `[ ]` | Allowable downtime/degradation allowance |
| **Health Checks** | `[ ]` | Basic `/health` / `/ping` availability endpoints |
| **Liveness & Readiness Probes** | `[ ]` | Lifecycle checks for container orchestrators |
| **On-call & Production Incidents** | `[ ]` | Incident response workflows & paging |
| **Postmortems** | `[ ]` | Blameless root cause analysis & action items |

---

## 8. Deployment, CI/CD & Infrastructure

| Topic | Status / Evaluation | Notes & Velum Context |
| :--- | :---: | :--- |
| **CI/CD** | `[ ]` | Automated build, test, and deployment pipelines |
| **Docker** | `[ ]` | Multi-stage container builds & minimization |
| **Kubernetes** | `[ ]` | Container orchestration, autoscaling, ingress |
| **Helm Charts** | `[ ]` | Package management for Kubernetes manifests |
| **Infrastructure as Code (IaC)** | `[ ]` | Declarative infrastructure provisioning |
| **Terraform** | `[ ]` | State-managed multi-cloud provisioning |
| **Feature Flags** | `[ ]` | Dynamic runtime feature enablement/disablement |
| **Rolling Deployments** | `[ ]` | Incremental instance replacement |
| **Blue-Green Deployments** | `[ ]` | Zero-downtime identical environment switching |
| **Canary Releases** | `[ ]` | Percentage-based traffic routing to new releases |
| **Rollbacks** | `[ ]` | Automated / instantaneous version rollback triggers |
| **Dependency Hell** | `[ ]` | Lockfile pinning, vulnerability audits (`npm audit`) |
