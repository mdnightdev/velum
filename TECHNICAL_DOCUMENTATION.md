# Velum Technical Documentation

## Architecture Overview

Velum is a production-grade secure messaging platform with end-to-end encryption (E2EE), real-time WebSocket communication, and Redis-based state management.

### Core Technologies
- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Cache**: Redis for unread counters and message caching
- **Real-time**: WebSocket server for live messaging
- **Storage**: Cloudflare R2 for media uploads

### Directory Structure
```
velum/
├── src/                    # Frontend React application
│   ├── components/        # React components
│   ├── hooks/            # Custom React hooks
│   ├── services/         # Business logic services
│   ├── views/            # Page views
│   └── types/            # TypeScript type definitions
├── server/               # Backend server
│   ├── v2/              # v2 API structure
│   │   ├── controllers/ # Request handlers
│   │   ├── routes/      # API endpoints
│   │   ├── db/          # Database schema and client
│   │   ├── middleware/  # Auth and validation
│   │   └── scripts/     # Utility scripts
│   └── websocket.ts     # WebSocket server
└── .env                 # Environment configuration
```

## Encryption System

### Centralized Encryption Service

All encryption/decryption is handled by `src/services/encryptionService.ts`:

```typescript
// Encryption context for determining encryption method
interface EncryptionContext {
  type: 'direct' | 'lounge';
  roomId?: string;
  peerUserId?: number;
  isEncrypted?: boolean;
}

// Encrypt message based on context
async function encryptMessage(content: string, context: EncryptionContext): Promise<string>

// Decrypt message based on content format
async function decryptMessage(content: string, context: EncryptionContext): Promise<string>
```

### Encryption Methods

**Direct Messages (DMs):**
- **Algorithm**: Double Ratchet (Signal Protocol compatible)
- **Implementation**: X3DH initial handshake + Double Ratchet
- **Format**: `ratchet:v2:{envelope}`
- **Key Exchange**: ECDH P-256 with HKDF-SHA256
- **Forward Secrecy**: Per-message key derivation

**Lounge Messages:**
- **Algorithm**: XOR encryption with room-specific key
- **Format**: `VEL_E2EE[{base64}]`
- **Key**: `VELUM_E2EE_{roomId}`
- **Purpose**: Lightweight encryption for semi-public spaces

### Double Ratchet Implementation

The Double Ratchet service (`src/services/doubleRatchetService.ts`) implements:

1. **X3DH Initial Handshake**
   - Identity keys (long-term)
   - Signed prekeys (medium-term)
   - One-time prekeys (single-use)
   - Triple-diffie-hellman key exchange

2. **Double Ratchet Algorithm**
   - DH ratchet (new ephemeral keys per chain)
   - Symmetric-key ratchet (per-message keys)
   - Skipped message key handling
   - Forward secrecy

3. **Message Envelope Format**
   ```typescript
   {
     header: {
       dhPublicKey: string,  // JWK format
       pn: number,          // previous chain length
       n: number            // message index
     },
     ivHex: string,
     ciphertextHex: string,
     tagHex: string
   }
   ```

### Usage Example

```typescript
// Encrypt DM
const context: EncryptionContext = { 
  type: 'direct', 
  peerUserId: 123 
};
const encrypted = await encryptMessage("Hello", context);

// Decrypt DM
const decrypted = await decryptMessage(encrypted, context);

// Encrypt lounge message
const loungeContext: EncryptionContext = { 
  type: 'lounge', 
  roomId: 'general', 
  isEncrypted: true 
};
const loungeEncrypted = await encryptMessage("Hey everyone", loungeContext);
```

## Message System

### WebSocket Protocol

**Connection:**
```
ws://localhost/ws?userId={userId}&sessionId={sessionId}
```

**Message Types:**
- `join_room` - Join a lounge/DM
- `leave` - Leave a room
- `message` - Send a message
- `mark_read` - Mark message as read
- `mark_delivered` - Mark message as delivered
- `typing_start` / `typing_stop` - Typing indicators
- `ping` / `pong` - Keep-alive

### Message Flow

1. **Sending a Message:**
   ```
   Client → WebSocket → Server → Database → Redis cache → WebSocket → Recipient
   ```

2. **Message Status:**
   - `sent` - Message created in database
   - `delivered` - Recipient online and received
   - `read` - Recipient marked as read

3. **Encryption Handling:**
   - Client encrypts before sending
   - Server stores encrypted content
   - Server forwards encrypted content
   - Recipient decrypts upon receipt

### Database Schema

**Messages Table:**
```typescript
{
  id: number,
  loungeId: number,
  senderId: number,
  content: string,           // Encrypted content
  encrypted: boolean,
  deliveredTo: string,       // Comma-separated user IDs
  readBy: string,            // Comma-separated user IDs
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## Unread Counter System

### Redis-based Tracking

**Key Pattern:** `unread:{userId}:{roomId}`

**Operations:**
- `INCR` - Increment on new incoming message
- `DEL` - Reset to 0 when room opened or marked read
- `GET` - Fetch current count
- `KEYS` - Fetch all unread counts for user

### Server Implementation

**Increment on New Message:**
```typescript
// In handleSendMessage() for DMs
const recipientId = client.userId === uid1 ? uid2 : uid1;
await incrementUnread(recipientId, roomId);
```

**Reset on Mark Read:**
```typescript
// In handleMarkRead()
await resetUnread(client.userId, roomId);
```

### Client Implementation

**Fetch Unread Counts:**
```typescript
// Fetch from API endpoint
const res = await fetch('/v2/user/unread-counts', {
  headers: { 'Authorization': `Bearer ${sessionId}` }
});
const { unreadCounts } = await res.json();
```

**Reset on Room Open:**
```typescript
// In joinRoom()
setUnreadCounts(prev => ({ ...prev, [roomId]: 0 }));
```

**Increment on Incoming Message:**
```typescript
// Only if not in active room
if (newMessage.user_id !== uid && newMessage.room_id !== activeRoomIdRef.current) {
  setUnreadCounts(prev => ({
    ...prev,
    [newMessage.room_id]: (prev[newMessage.room_id] || 0) + 1
  }));
}
```

### API Endpoint

**GET /v2/user/unread-counts**
- **Authentication**: Required
- **Response**: `{ unreadCounts: { [roomId]: count } }`

## Backup and Restore

### Scripts Location
`server/v2/scripts/`

### Available Scripts

**Backup:**
```bash
npm run backup
# or
bash server/v2/scripts/backup.sh
```
- Backs up PostgreSQL and Redis
- Uploads to Cloudflare R2 if configured
- Creates timestamped local backups
- Auto-cleanup of backups older than 7 days

**Restore:**
```bash
npm run restore backups/postgres_20240804_120000.sql
# or
bash server/v2/scripts/restore.sh backups/postgres_20240804_120000.sql
```
- Restores database from backup file
- Requires confirmation before execution

**Sync to Cloud:**
```bash
npm run sync-to-cloud
# or
bash server/v2/scripts/sync-to-cloud.sh
```
- Syncs local database to cloud (CLOUD_DATABASE_URL)
- Creates local backup before sync

**Sync from Cloud:**
```bash
npm run sync-from-cloud
# or
bash server/v2/scripts/sync-from-cloud.sh
```
- Syncs cloud database to local
- Creates local backup before sync

**Clear Legacy Messages:**
```bash
bash server/v2/scripts/clear-legacy-messages.sh
```
- Removes legacy ratchet:v1 encrypted messages
- Cleans up chat history

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://localhost/velum
CLOUD_DATABASE_URL=postgresql://neon.tech/...

# Redis
REDIS_URL=redis://localhost:6379
CLOUD_REDIS_URL=redis://cloud-redis:6379

# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=velum-backups
R2_PUBLIC_URL=https://your-bucket.r2.dev
```

## Authentication System

### Session Management

**Session Creation:**
- Session tokens stored in database
- Tokens hashed for security
- Support for panic phrases and duress mode

**Authentication Middleware:**
```typescript
const authMiddleware = createAuthMiddleware(async (tokenHash) => {
  const result = await userRepository.findSessionByTokenHash(tokenHash);
  if (!result) return null;
  return {
    user: { userId, username, role, ... },
    expiresAt: result.session.expiresAt
  };
});
```

### User Roles

- **USER** - Standard user
- **SUPPORT_ADMIN** - Elevated support permissions
- **CLI_ADMIN** - Development/admin access
- **LOGIN_ADMIN** - Development/login access

## Development

### Build Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Production start
npm start

# Type checking
npm run lint
```

### Testing

**Encryption Tests:**
```bash
# Basic encryption test
node test-encryption.js
```

**Database Testing:**
- Direct PostgreSQL access for testing
- Redis for testing cache operations

### Code Style

- **TypeScript**: Strict type checking
- **ESLint**: Code quality enforcement
- **DRY**: Don't Repeat Yourself
- **Single Responsibility**: Each module has one clear purpose

## Security Considerations

### End-to-End Encryption
- Server never sees plaintext messages
- Double Ratchet for forward secrecy
- Prekey bundles for secure key exchange

### Data Protection
- Passwords hashed with Argon2id
- Session tokens hashed in database
- Support for panic phrases (duress mode)
- Automatic session expiration

### Network Security
- WebSocket connection requires authentication
- All API endpoints protected by auth middleware
- Rate limiting on sensitive operations

## Troubleshooting

### Common Issues

**Encryption Errors:**
- Check that Double Ratchet keys are initialized
- Verify prekey bundles are uploaded
- Ensure peer user ID is correct

**WebSocket Connection:**
- Verify user authentication
- Check WebSocket server is running
- Ensure session token is valid

**Redis Connection:**
- Verify REDIS_URL is set in .env
- Check Redis server is running
- Test with `redis-cli ping`

**Database Issues:**
- Verify DATABASE_URL is correct
- Check PostgreSQL server is running
- Run migrations if schema is outdated

## Performance Optimization

### Redis Caching
- Unread counters cached in Redis
- Last DM messages cached per lounge
- Session data cached for quick access

### Database Optimization
- Indexed on frequently queried fields
- Connection pooling for performance
- Prepared statements for repeated queries

### WebSocket Optimization
- Binary message support for large payloads
- Message batching for high-volume scenarios
- Automatic reconnection with exponential backoff

## Deployment

### Environment Setup

1. **Database Setup:**
   ```bash
   # Create PostgreSQL database
   createdb velum
   
   # Run migrations
   npm run migrate
   ```

2. **Redis Setup:**
   ```bash
   # Start Redis server
   redis-server
   ```

3. **Environment Configuration:**
   ```bash
   # Copy example env file
   cp .env.example .env
   
   # Edit with your values
   nano .env
   ```

4. **Build and Start:**
   ```bash
   npm run build
   npm start
   ```

### Monitoring

**Health Checks:**
- WebSocket connection status
- Database connection health
- Redis connection status
- Message throughput metrics

**Logging:**
- WebSocket connection logs
- Error logs with stack traces
- Performance metrics
- Security events

## Future Enhancements

### Planned Features
- Group Double Ratchet for group E2EE
- Voice/video calling integration
- File sharing with encryption
- Message search with indexing
- Cross-device synchronization
- Push notifications for mobile

### Performance Improvements
- Message queuing for high-throughput scenarios
- Database sharding for large deployments
- CDN integration for media delivery
- Edge computing for lower latency

## Support

For technical support or questions about the codebase, refer to:
- Internal documentation
- API documentation
- Database schema documentation
- Security guidelines
