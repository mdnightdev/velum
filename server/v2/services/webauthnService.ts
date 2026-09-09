import { 
  generateRegistrationOptions, 
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import { db } from '../db/client.js';
import { webauthnCredentials } from '../db/schema/webauthn.js';
import { eq, sql } from 'drizzle-orm';
import { UserRepository } from '../repositories/userRepository.js';

const userRepository = new UserRepository();

let tableInitialized = false;
async function ensureWebauthnTable() {
  if (tableInitialized) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        credential_id TEXT NOT NULL UNIQUE,
        public_key TEXT NOT NULL,
        counter INTEGER DEFAULT 0,
        transports JSONB,
        device_type TEXT,
        backed_up INTEGER DEFAULT 0,
        aaguid TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        last_used_at TIMESTAMP,
        nickname TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_webauthn_user_id ON webauthn_credentials(user_id);
    `);
    tableInitialized = true;
  } catch {
    // Table already present
  }
}

export class WebauthnService {
  // Generate registration options for new passkey
  async generateRegistrationOptions(userId: number, username: string, rpID: string) {
    await ensureWebauthnTable();
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get existing credentials to prevent duplicates
    const existingCredentials = await db
      .select({ credentialId: webauthnCredentials.credentialId })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, userId));

    const options = await generateRegistrationOptions({
      rpID,
      rpName: 'Velum',
      userID: new TextEncoder().encode(userId.toString()),
      userName: username,
      excludeCredentials: existingCredentials.map(cred => ({
        id: cred.credentialId,
        transports: (cred as any).transports || undefined
      })),
      authenticatorSelection: {
        userVerification: 'preferred',
        residentKey: 'preferred'
      },
      attestationType: 'none' as any
    });

    return options;
  }

  // Verify registration response and store credential
  async verifyRegistration(
    userId: number,
    response: any,
    expectedChallenge: string,
    expectedOrigin: string | string[],
    expectedRPID: string | string[]
  ) {
    await ensureWebauthnTable();
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      requireUserVerification: false
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('Registration verification failed');
    }

    const { credential, aaguid } = verification.registrationInfo;

    // Store the credential
    await db.insert(webauthnCredentials).values({
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter || 0,
      transports: (credential.transports as any) || [],
      deviceType: 'platform',
      backedUp: 1,
      aaguid: aaguid || '',
      nickname: `Passkey ${new Date().toLocaleDateString()}`
    });

    return { credentialId: credential.id };
  }

  // Generate authentication options for login
  async generateAuthenticationOptions(username?: string, rpID: string = 'localhost') {
    await ensureWebauthnTable();
    let userCredentials: any[] = [];

    if (username) {
      const user = await userRepository.findByUsername(username);
      if (user) {
        userCredentials = await db
          .select({ credentialId: webauthnCredentials.credentialId, transports: webauthnCredentials.transports })
          .from(webauthnCredentials)
          .where(eq(webauthnCredentials.userId, user.id));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials: userCredentials.map(cred => ({
        id: cred.credentialId,
        transports: (cred.transports as any) || undefined
      }))
    });

    return options;
  }

  // Verify authentication response
  async verifyAuthentication(
    response: any,
    expectedChallenge: string,
    expectedOrigin: string | string[],
    expectedRPID: string | string[]
  ) {
    await ensureWebauthnTable();
    const credentialId = response.id;
    
    // Find the credential in database
    const credential = await db
      .select()
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.credentialId, credentialId))
      .limit(1);

    if (!credential.length) {
      throw new Error('Credential not found');
    }

    const credentialRecord = credential[0];
    const publicKey = Buffer.from(credentialRecord.publicKey, 'base64');

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      credential: {
        id: credentialRecord.credentialId,
        publicKey: new Uint8Array(publicKey),
        counter: credentialRecord.counter || 0,
        transports: credentialRecord.transports as any
      },
      requireUserVerification: false
    });

    if (!verification.verified) {
      throw new Error('Authentication verification failed');
    }

    // Update the counter and last used timestamp
    await db
      .update(webauthnCredentials)
      .set({ 
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date()
      })
      .where(eq(webauthnCredentials.credentialId, credentialId));

    return {
      verified: true,
      userId: credentialRecord.userId,
      credentialId: credentialRecord.credentialId
    };
  }

  // Get all passkeys for a user
  async getUserPasskeys(userId: number) {
    await ensureWebauthnTable();
    const credentials = await db
      .select()
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, userId));

    return credentials.map(cred => ({
      id: cred.id,
      credentialId: cred.credentialId,
      nickname: cred.nickname,
      deviceType: cred.deviceType,
      backedUp: cred.backedUp === 1,
      createdAt: cred.createdAt,
      lastUsedAt: cred.lastUsedAt
    }));
  }

  // Delete a passkey
  async deletePasskey(userId: number, credentialId: string) {
    await ensureWebauthnTable();
    const result = await db
      .delete(webauthnCredentials)
      .where(eq(webauthnCredentials.credentialId, credentialId))
      .returning();

    return result.length > 0;
  }

  // Update passkey nickname
  async updatePasskeyNickname(userId: number, credentialId: string, nickname: string) {
    await ensureWebauthnTable();
    const result = await db
      .update(webauthnCredentials)
      .set({ nickname })
      .where(eq(webauthnCredentials.credentialId, credentialId))
      .returning();

    return result.length > 0;
  }
}

export const webauthnService = new WebauthnService();