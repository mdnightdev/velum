import { userRepository } from '../../repositories/userRepository.js';
import { db } from '../../db/client.js';
import { deviceFingerprintService } from '../deviceFingerprint.js';
import { verifyArgon2id, hashArgon2id, safeCompare } from '../../utils/crypto.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { executeEmergencyWipe } from './panicService.js';
import crypto from 'node:crypto';

/**
 * Standardized credential verification testing multi-format Argon2id hashing:
 * - Raw input string
 * - Client-side SHA256 pre-hashed input
 * - Argon2id algorithm prefix handling ("argon2id:")
 * - Timing-safe comparisons via safeCompare
 */
export async function verifyInputHash(
  input: string,
  saltHex: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (!input || !saltHex || !storedHash) return false;
  
  const salt = Buffer.from(saltHex, 'hex');
  const computedHash = await hashArgon2id(input, salt);

  return (
    await verifyArgon2id(input, saltHex, storedHash) ||
    safeCompare(computedHash, storedHash) ||
    safeCompare('argon2id:' + computedHash, storedHash)
  );
}

/**
 * Checks emergency phrase status upon user login.
 * - If the password/emergency phrase input matches the user's emergencyPhraseHash (either raw or client-hashed),
 *   executes executeEmergencyWipe to quarantine the account, purge active sessions, create the recovery ticket
 *   with computed trust score, and throws an "Invalid credentials." error.
 * - If the account is already compromised:
 *   1. Verifies that the user entered their REAL password.
 *   2. If valid, computes the trust score and returns { isCompromised: true, shouldShowTicket: true, ticketId }.
 *   3. Otherwise throws "Invalid credentials." error.
 */
export async function checkEmergencyPhraseOnLogin(
  user: any,
  passwordInput: string,
  emergencyPhraseInput: string | undefined,
  fingerprint: string,
  ipAddress: string,
  reqDetails?: any
): Promise<{ isCompromised: boolean; shouldShowTicket: boolean; ticketId?: string }> {
  const activeEmergencyInput = emergencyPhraseInput || passwordInput;

  // 1. Emergency Phrase Check
  if (activeEmergencyInput && user.panicPhraseHash && user.salt) {
    const isEmergencyMatch = await verifyInputHash(activeEmergencyInput, user.salt, user.panicPhraseHash);

    if (isEmergencyMatch) {
      // Calculate trust score based on device fingerprinting / anomaly detection
      const anomalyCheck = await deviceFingerprintService.detectAnomalousAccess(user.id, fingerprint, ipAddress);
      const trustScore = Math.max(0, 100 - anomalyCheck.riskScore);

      // Record device access
      if (reqDetails) {
        try {
          await deviceFingerprintService.recordDeviceAccess(user.id, fingerprint, ipAddress, {
            userAgent: reqDetails.userAgent || 'unknown',
            platform: reqDetails.platform || 'unknown'
          });
        } catch (dfErr) {
          console.error('[duressAuth] Error recording device access during emergency:', dfErr);
        }
      }

      // Execute emergency data wipe, session purge, account quarantine, and ticket creation with calculated trust score
      await executeEmergencyWipe(user.id, 'EMERGENCY_PHRASE_LOGIN', trustScore);

      // Return invalid credentials error (no alarmist UI for attacker)
      throw new UnauthorizedError('Invalid credentials.');
    }
  }

  // 2. Compromised Account Check (Legitimate User Logging In With Real Password)
  if (user.isCompromised) {
    const isRealPasswordValid = await verifyInputHash(passwordInput, user.salt, user.passwordHash);

    if (isRealPasswordValid) {
      const anomalyCheck = await deviceFingerprintService.detectAnomalousAccess(user.id, fingerprint, ipAddress);
      const trustScore = Math.max(0, 100 - anomalyCheck.riskScore);

      // Record device access
      if (reqDetails) {
        try {
          await deviceFingerprintService.recordDeviceAccess(user.id, fingerprint, ipAddress, {
            userAgent: reqDetails.userAgent || 'unknown',
            platform: reqDetails.platform || 'unknown'
          });
        } catch (dfErr) {
          console.error('[duressAuth] Error recording device access during compromised login:', dfErr);
        }
      }

      return {
        isCompromised: true,
        shouldShowTicket: true,
        ticketId: user.compromiseTicketId || undefined
      };
    }

    // Error if password invalid
    throw new UnauthorizedError('Invalid credentials.');
  }

  return { isCompromised: false, shouldShowTicket: false };
}
