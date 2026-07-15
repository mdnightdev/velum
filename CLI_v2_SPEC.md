# Velum CLI v2 — Design & Specification (Corrected)

**Status:** Approved (Final)  
**Reference File:** `/INVESTIGATION_POWERS.md`  

---

## 1. Introduction

This document defines the second-generation Command Line Interface for the Velum platform. It replaces the existing flat command structure with a secure, discoverable, namespaced shell that is purpose-built for administrative and investigative operations in headless or air-gapped environments.

---

## 2. Shell Interaction Model

The CLI runs as an interactive, persistent session, eliminating re-authentication between commands.

### 2.1 Navigation & Global Commands
* `pwd` — print current namespace path
* `ls`, `list` — list sub-namespaces or available commands
* `cd <namespace>` — change directory
* `clear` — clear screen
* `exit`, `quit` — end session
* `help`, `?` — Show navigation catalog

---

## 3. Command Inventory (Reconciled with Implementation)

### 3.1 `/users`
| Command | Risk | Notes |
| :--- | :--- | :--- |
| `list` | `LOW` | filterable with `--status` |
| `cat <uid>` | `LOW` | |
| `ban <uid>` | `MEDIUM` | |
| `unban <uid>` | `MEDIUM` | |
| `mute <uid> <lounge_id>` | `MEDIUM` | |
| `unmute <uid> <lounge_id>` | `MEDIUM` | |
| `jail <uid>` | `MEDIUM` | |
| `unjail <uid>` | `MEDIUM` | |
| `reset-avatar <uid>` | `MEDIUM` | |
| `override <uid> <state>` | `HIGH` | |
| `set-role <uid> <role>` | `HIGH` | |
| `deactivate <uid>` | `HIGH` | 14-day grace period |
| `cancel-deactivation <uid>` | `MEDIUM` | |
| `release-assets <uid>` | `HIGH` | 2-day verification buffer |
| `confirm-purge <uid>` | `CRITICAL` | |
| `purge-fraudster <uid>` | `CRITICAL` | instant asset seizure |
| `blacklist <id>` | `HIGH` | |
| `unblacklist <id>` | `HIGH` | |
| `pending-deletions` | `LOW` | |
| `restore <uid>` | `MEDIUM` | Restore soft-purged user |

### 3.2 `/lounges`
| Command | Risk | Notes |
| :--- | :--- | :--- |
| `list` | `LOW` | |
| `cat <lounge_id>` | `LOW` | |
| `chown <lounge_id> <uid>` | `HIGH` | |
| `clean <lounge_id>` | `HIGH` | Creates restore point |
| `restore-messages <rp_id>` | `CRITICAL` | |
| `delete <lounge_id>` | `CRITICAL` | |
| `lock <lounge_id>` | `MEDIUM` | |
| `unlock <lounge_id>` | `MEDIUM` | |

### 3.3 `/support`
| Command | Risk |
| :--- | :--- |
| `pending` | `LOW` |
| `token <ticket_id>` | `LOW` |
| `approve <ticket_id>` | `MEDIUM` |
| `reject <ticket_id>` | `MEDIUM` |
| `demote <ticket_id>` | `MEDIUM` |
| `delete <ticket_id>` | `HIGH` |

### 3.4 `/db`
| Command | Risk |
| :--- | :--- |
| `integrity` | `LOW` |
| `orphans-scan` | `LOW` |
| `orphans-clean` | `HIGH` |
| `backup` | `HIGH` |
| `export <table>` | `LOW` |
| `vacuum` | `HIGH` |
| `restore <backup>` | `CRITICAL` |
| `seed` | `CRITICAL` |
| `prune` | `HIGH` |
| `wipe` | `CRITICAL` |

### 3.5 `/sys`
| Command | Risk |
| :--- | :--- |
| `status` | `LOW` |
| `top` | `LOW` |
| `risk` | `LOW` |
| `token` | `MEDIUM` |
| `kill <session_id>` | `MEDIUM` |
| `clear-sessions` | `HIGH` |
| `maintenance-enable` | `HIGH` |
| `maintenance-disable` | `MEDIUM` |

### 3.6 `/audit`
| Command | Risk |
| :--- | :--- |
| `user <uid>` | `LOW` |
| `grep <pattern>` | `LOW` |
| `history` | `LOW` |
| `ledger-verify` | `LOW` |
| `sessions-hijack-scan` | `LOW` |
| `ip-correlate` | `LOW` |
| `nodes-scan` | `LOW` |
| `friendships-reconstruct` | `HIGH` |

### 3.7 `/fraud`
| Command | Risk |
| :--- | :--- |
| `seize <uid>` | `CRITICAL` |
| `freeze <uid>` | `MEDIUM` |
| `unfreeze <uid>` | `MEDIUM` |
