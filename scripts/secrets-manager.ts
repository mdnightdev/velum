#!/usr/bin/env ts
/**
 * Simple Encrypted Secrets Manager for Velum
 * Encrypts secrets at rest using AES-256-GCM
 * For solo/small team development
 */

import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const SECRETS_FILE = '.env.encrypted';
const MASTER_KEY_FILE = '.secrets.key';

interface SecretEntry {
  key: string;
  value?: string;
  encrypted: boolean;
  data?: string;
  iv?: string;
  authTag?: string;
}

function getMasterKey(): Buffer {
  if (fs.existsSync(MASTER_KEY_FILE)) {
    return fs.readFileSync(MASTER_KEY_FILE);
  }
  
  // Generate new master key
  const key = crypto.randomBytes(32);
  fs.writeFileSync(MASTER_KEY_FILE, key);
  fs.chmodSync(MASTER_KEY_FILE, 0o600); // Only owner can read/write
  console.log(`Generated new master key: ${MASTER_KEY_FILE}`);
  console.log('⚠️  Store this key securely and share it with your collaborator securely!');
  return key;
}

function encrypt(text: string, key: Buffer): { iv: string, authTag: string, data: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted
  };
}

function decrypt(encrypted: string, iv: string, authTag: string, key: Buffer): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

function loadSecrets(): Map<string, SecretEntry> {
  if (!fs.existsSync(SECRETS_FILE)) {
    return new Map();
  }
  
  const content = fs.readFileSync(SECRETS_FILE, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const secrets = new Map<string, SecretEntry>();
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as SecretEntry;
      secrets.set(entry.key, entry);
    } catch (e) {
      console.warn(`Failed to parse secret line: ${line}`);
    }
  }
  
  return secrets;
}

function saveSecrets(secrets: Map<string, SecretEntry>, key: Buffer): void {
  const lines: string[] = [];
  
  for (const [secretKey, entry] of secrets.entries()) {
    if (entry.encrypted) {
      lines.push(JSON.stringify(entry));
    } else {
      // Encrypt plain text before saving
      const encrypted = encrypt(entry.value, key);
      const encryptedEntry: SecretEntry = {
        key: entry.key,
        value: '',
        encrypted: true,
        ...encrypted
      };
      lines.push(JSON.stringify(encryptedEntry));
    }
  }
  
  fs.writeFileSync(SECRETS_FILE, lines.join('\n'));
  fs.chmodSync(SECRETS_FILE, 0o600);
}

function getSecret(key: string, keyBuffer: Buffer): string {
  const secrets = loadSecrets();
  const entry = secrets.get(key);
  
  if (!entry) {
    throw new Error(`Secret not found: ${key}`);
  }
  
  if (entry.encrypted) {
    return decrypt(entry.data, entry.iv, entry.authTag, keyBuffer);
  }
  
  return entry.value;
}

function setSecret(key: string, value: string, keyBuffer: Buffer): void {
  const secrets = loadSecrets();
  const encrypted = encrypt(value, keyBuffer);
  
  secrets.set(key, {
    key,
    value: '',
    encrypted: true,
    ...encrypted
  });
  
  saveSecrets(secrets, keyBuffer);
}

function generateEnvFile(keyBuffer: Buffer): void {
  const secrets = loadSecrets();
  const envLines: string[] = [];
  
  for (const [secretKey, entry] of secrets.entries()) {
    let value: string;
    if (entry.encrypted) {
      value = decrypt(entry.data, entry.iv, entry.authTag, keyBuffer);
    } else {
      value = entry.value;
    }
    envLines.push(`${secretKey}=${value}`);
  }
  
  fs.writeFileSync('.env', envLines.join('\n'));
  console.log('Generated .env file from encrypted secrets');
}

// CLI Commands
const command = process.argv[2];

if (!command) {
  console.log(`
Velum Secrets Manager
Usage:
  node scripts/secrets-manager.ts <command>

Commands:
  set <key> <value>     Encrypt and store a secret
  get <key>             Decrypt and retrieve a secret
  list                  List all secret keys
  generate-env          Generate .env file from encrypted secrets
  status                Show secrets manager status
  `);
  process.exit(0);
}

try {
  const keyBuffer = getMasterKey();
  
  switch (command) {
    case 'set':
      if (process.argv.length < 5) {
        console.error('Usage: node scripts/secrets-manager.ts set <key> <value>');
        process.exit(1);
      }
      const setKey = process.argv[3];
      const setValue = process.argv[4];
      setSecret(setKey, setValue, keyBuffer);
      console.log(`✓ Secret '${setKey}' encrypted and stored`);
      break;
      
    case 'get':
      if (process.argv.length < 4) {
        console.error('Usage: node scripts/secrets-manager.ts get <key>');
        process.exit(1);
      }
      const getKey = process.argv[3];
      const value = getSecret(getKey, keyBuffer);
      console.log(value);
      break;
      
    case 'list':
      const secrets = loadSecrets();
      console.log('Stored secrets:');
      for (const [key] of secrets.entries()) {
        console.log(`  - ${key}`);
      }
      break;
      
    case 'generate-env':
      generateEnvFile(keyBuffer);
      break;
      
    case 'status':
      console.log('Secrets Manager Status:');
      console.log(`  Master Key: ${MASTER_KEY_FILE} ${fs.existsSync(MASTER_KEY_FILE) ? '✓' : '✗'}`);
      console.log(`  Secrets File: ${SECRETS_FILE} ${fs.existsSync(SECRETS_FILE) ? '✓' : '✗'}`);
      console.log(`  Total Secrets: ${loadSecrets().size}`);
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
} catch (error) {
  console.error('Error:', (error as Error).message);
  process.exit(1);
}
