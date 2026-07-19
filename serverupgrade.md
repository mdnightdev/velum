## VELUM PROJECT: PRODUCTION-GRADE INFRASTRUCTURE ARCHITECTURE & HARDENING GUIDE
This document serves as the master engineering guide to transition the Velum server architecture from an in-memory, disk-overwriting layout into an enterprise-grade, highly concurrent system. These optimizations prevent event-loop starvation, eliminate silent data loss during file flushing, and prepare the project for high-traffic node deployment.
------------------------------
## 1. Core Architectural Issues Addressed

   1. Event-Loop Starvation: Heavy synchronous loops (like bulk text stringification) block Node's single thread, freezing real-time WebSocket heartbeats and Express routes.
   2. Destructive Persistence Cycles: Wiping database tables cleanly via DELETE FROM right before iterative insertion scripts exposes the system to total data loss if a process stalls mid-loop.
   3. Application-Level Bottlenecks: Global JavaScript mutexes stall incoming network pipelines when scaling horizontally across multi-instance configurations.

------------------------------
## 2. Hardening Database Primitives (server/db/index.ts)
SQLite must be optimized to decouple disk writing mechanics from reading engines. Execute these performance parameters directly inside your custom adapter connection factory function:

const conn = this.driverInstance; // Native node:sqlite or better-sqlite3
// 1. Activate Write-Ahead Logging for concurrent non-blocking pipelines
conn.exec('PRAGMA journal_mode = WAL;');
// 2. Prevent instant crash loop faults by establishing a lock wait timer
conn.exec('PRAGMA busy_timeout = 5000;');
// 3. Delegate synchronization boundaries safely to background OS cache threads
conn.exec('PRAGMA synchronous = NORMAL;');
// 4. Force lookups to cache schema page operations in RAM (allocates ~4MB)
conn.exec('PRAGMA cache_size = -4000;');
// 5. Enforce strict relational child integrity tracking
conn.exec('PRAGMA foreign_keys = ON;');

------------------------------
## 3. Atomic State Serialization (server/db/persistence.ts)
To protect your 2-second lazy debounce flusher from corrupting tables during a sudden process kill or crash, wrap bulk overwrites inside an atomic SQL transaction block. Yield control back to the event loop every 50 loops using setImmediate() to keep network links responsive.
## Refactored Flusher Layout Matrix

import { setImmediate } from 'node:timers/promises';
export const saveStateToDiskDebounced = async () => {
    // 1. Lock the database engine block atomically
    conn.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
        // --- Table Serialization Phase: Escrow Example ---
        conn.exec('DELETE FROM escrow_transactions;');
        const escrowStmt = conn.prepare(`
            INSERT INTO escrow_transactions (
                transaction_id, listing_id, buyer_id, seller_id, amount, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let operationCounter = 0;
        for (const tx of db.escrow_transactions || []) {
            escrowStmt.run(
                tx.transaction_id,
                tx.listing_id,
                String(tx.buyer_id),
                String(tx.seller_id),
                Number(tx.amount || 0),
                tx.status,
                Number(tx.created_at || Date.now()),
                Number(tx.updated_at || Date.now())
            );
            operationCounter++;
            
            // 🌟 Crucial: Yield control back to the event loop every 50 rows
            if (operationCounter % 50 === 0) {
                await setImmediate();
            }
        }

        // Commit all successfully serialized memory blocks to disk at once
        conn.exec('COMMIT;');
    } catch (err) {
        // ❌ Roll back completely if a single entry fails—preserving your previous disk save!
        conn.exec('ROLLBACK;');
        console.error('[CRITICAL-FLUSH] Lazy serialization failed. State rolled back:', err);
    }
};

------------------------------
## 4. Scaling Server Concurrency & Process Tracking## Multi-Instance Scaling Configuration (ecosystem.config.json)
When shifting your runtime environment to an Ubuntu production server, utilize PM2 in cluster mode to automatically split network loads across available CPU hardware blocks. Create this file in your project root:

{
  "apps": [
    {
      "name": "velum-production-server",
      "script": "./dist/server/index.js",
      "instances": 2,
      "exec_mode": "cluster",
      "watch": false,
      "max_memory_restart": "800M",
      "env": {
        "NODE_ENV": "production",
        "PORT": 3000
      }
    }
  ]
}

## Preventing Background Worker Duplication (server/index.ts)
To prevent clashing tasks from duplicate intervals running across multiple cluster clones, suppress background services on all instances except primary sequence 0:

export const startServer = () => {
    // ... core connection listeners, routing, and websockets initialization ...

    // Filter runtime instance flags assigned automatically by PM2
    const instanceId = process.env.PM2_INSTANCE_ID || "0";
    
    if (instanceId === "0") {
        console.log("[SYS-INIT] Master instance verified. Launching background Clearing Workers...");
        startClearingWorker(); 
    } else {
        console.log(`[SYS-INIT] Replica Node [${instanceId}] online. Background workers bypassed.`);
    }
};

------------------------------
## 5. Non-Blocking Object Storage Integration (Cloudflare R2 / S3)
To ensure high-resolution media like user photo uploads and voice note buffers never block your Node process loop, implement presigned object upload tokens. This directs file byte streams straight from client devices up to storage containers, bypassing your core engine entirely.
## Storage Service Handler (server/services/storageService.ts)

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});
/**
 * Generates an encrypted upload lease link valid for 5 minutes.
 */export const getSecureUploadAssetConfig = async (userId: string, targetFolder: 'avatars' | 'media', ext: string) => {
    const fileKey = `${targetFolder}/${userId}_${Date.now()}.${ext}`;
    
    const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileKey,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return {
        uploadUrl, // Target streaming path used by client application PUT requests
        relativeDbPath: `/${targetFolder}/${userId}_${Date.now()}.${ext}` // Lightweight index string for SQLite
    };
};

## Express Transport Router (server/controllers/storage.ts)

import { Request, Response } from 'express';import { getSecureUploadAssetConfig } from '../services/storageService.js';
export const requestMediaUploadToken = async (req: Request, res: Response) => {
    try {
        const { extension, type } = req.body; // Expectations: { extension: "m4a", type: "media" }
        const userId = req.user.id;

        if (type !== 'avatars' && type !== 'media') {
            return res.status(400).json({ error: "Invalid storage destination scope" });
        }

        const config = await getSecureUploadAssetConfig(userId, type, extension);
        return res.status(200).json(config);
    } catch (err) {
        return res.status(500).json({ error: "Failed to compile storage transaction lease ticket" });
    }
};

------------------------------
## 6. High-Performance Indexing Implementations
Execute these performance definitions directly inside your production terminal environment to completely remove scanning latency across core database lookups:

-- Accelerate wallet ledger evaluations and account auditsCREATE INDEX IF NOT EXISTS idx_bank_ledger_perf ON wallet_ledger_entries (wallet_id);CREATE INDEX IF NOT EXISTS idx_bank_tx_perf ON bank_transactions (sender_id, receiver_id);
-- Optimize internal message thread scrolling speedsCREATE INDEX IF NOT EXISTS idx_messages_chronological ON messages (created_at DESC);
-- Fast session lookups during token processing loopsCREATE INDEX IF NOT EXISTS idx_session_cleanup_perf ON sessions (user_id);CREATE INDEX IF NOT EXISTS idx_lounge_members_perf ON lounge_members (lounge_id, user_id);
