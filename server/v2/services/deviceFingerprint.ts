import crypto from 'node:crypto';
import { db } from '../db/client.js';
import { devices, userDevices, ipAddresses } from '../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';

export class DeviceFingerprintService {
  generateDeviceId(fingerprintData: {
    userAgent: string;
    screenResolution: string;
    timezone: string;
    language: string;
    platform: string;
    hardwareConcurrency: number;
    deviceMemory: number;
    webglVendor?: string;
    webglRenderer?: string;
  }): string {
    const fingerprintString = JSON.stringify(fingerprintData);
    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }

  async recordDeviceAccess(userId: number, deviceId: string, ipAddress: string, metadata: any) {
    try {
      const deviceFingerprint = this.generateDeviceId(metadata);
      
      // Check if device already exists
      const existingDevice = await db.select().from(devices)
        .where(eq(devices.deviceId, deviceId))
        .limit(1);
      
      let deviceRecord;
      if (existingDevice.length === 0) {
        deviceRecord = await db.insert(devices).values({
          deviceId,
          deviceFingerprint,
          userAgent: metadata.userAgent,
          platform: metadata.platform,
          screenResolution: metadata.screenResolution,
          timezone: metadata.timezone,
          language: metadata.language,
          hardwareConcurrency: metadata.hardwareConcurrency,
          deviceMemory: metadata.deviceMemory,
          webglVendor: metadata.webglVendor,
          webglRenderer: metadata.webglRenderer,
          firstSeen: new Date(),
          lastSeen: new Date(),
          accessCount: 1
        }).returning();
        deviceRecord = deviceRecord[0];
      } else {
        deviceRecord = await db.update(devices)
          .set({
            lastSeen: new Date(),
            accessCount: (existingDevice[0].accessCount || 0) + 1
          })
          .where(eq(devices.deviceId, deviceId))
          .returning();
        deviceRecord = deviceRecord[0];
      }
      
      // Link device to user
      const existingUserDevice = await db.select().from(userDevices)
        .where(and(
          eq(userDevices.userId, userId),
          eq(userDevices.deviceId, deviceId)
        ))
        .limit(1);
      
      if (existingUserDevice.length === 0) {
        await db.insert(userDevices).values({
          userId,
          deviceId,
          firstSeen: new Date(),
          lastSeen: new Date(),
          isCurrent: true
        });
      } else {
        await db.update(userDevices)
          .set({
            lastSeen: new Date(),
            isCurrent: true
          })
          .where(and(
            eq(userDevices.userId, userId),
            eq(userDevices.deviceId, deviceId)
          ));
      }
      
      // Record IP address
      await this.recordIpAddress(userId, ipAddress, deviceId);
      
      return deviceRecord;
    } catch (error) {
      console.error('[DeviceFingerprint] Error recording device access:', error);
      throw error;
    }
  }

  async recordIpAddress(userId: number, ipAddress: string, deviceId: string) {
    try {
      const existingIp = await db.select().from(ipAddresses)
        .where(and(
          eq(ipAddresses.userId, userId),
          eq(ipAddresses.ipAddress, ipAddress)
        ))
        .limit(1);
      
      if (existingIp.length === 0) {
        await db.insert(ipAddresses).values({
          userId,
          ipAddress,
          deviceId,
          firstSeen: new Date(),
          lastSeen: new Date(),
          isCurrent: true
        });
      } else {
        await db.update(ipAddresses)
          .set({
            lastSeen: new Date(),
            isCurrent: true,
            accessCount: (existingIp[0].accessCount || 0) + 1
          })
          .where(and(
            eq(ipAddresses.userId, userId),
            eq(ipAddresses.ipAddress, ipAddress)
          ));
      }
    } catch (error) {
      console.error('[DeviceFingerprint] Error recording IP address:', error);
      throw error;
    }
  }

  async detectAnomalousAccess(userId: number, deviceId: string, ipAddress: string): Promise<{
    isAnomalous: boolean;
    reasons: string[];
    riskScore: number;
  }> {
    try {
      const reasons: string[] = [];
      let riskScore = 0;
      
      // Check if device is known
      const knownDevice = await db.select().from(userDevices)
        .where(and(
          eq(userDevices.userId, userId),
          eq(userDevices.deviceId, deviceId)
        ))
        .limit(1);
      
      if (knownDevice.length === 0) {
        reasons.push('New device detected');
        riskScore += 30;
      }
      
      // Check if IP is known
      const knownIp = await db.select().from(ipAddresses)
        .where(and(
          eq(ipAddresses.userId, userId),
          eq(ipAddresses.ipAddress, ipAddress)
        ))
        .limit(1);
      
      if (knownIp.length === 0) {
        reasons.push('New IP address detected');
        riskScore += 40;
      }
      
      // Check for rapid location changes (IP geolocation)
      if (knownIp.length > 0) {
        const lastKnownIp = knownIp[0];
        const timeDiff = Date.now() - new Date(lastKnownIp.lastSeen).getTime();
        if (timeDiff < 3600000 && lastKnownIp.ipAddress !== ipAddress) {
          reasons.push('Rapid IP change detected (possible VPN/Proxy)');
          riskScore += 20;
        }
      }
      
      return {
        isAnomalous: riskScore > 50,
        reasons,
        riskScore
      };
    } catch (error) {
      console.error('[DeviceFingerprint] Error detecting anomalous access:', error);
      return { isAnomalous: false, reasons: [], riskScore: 0 };
    }
  }

  async purgeUserData(userId: number): Promise<void> {
    try {
      // Delete user devices
      await db.delete(userDevices).where(eq(userDevices.userId, userId));
      
      // Delete IP addresses (but keep device records for security analysis)
      await db.delete(ipAddresses).where(eq(ipAddresses.userId, userId));
      
      console.log(`[DeviceFingerprint] Purged device data for user ${userId}`);
    } catch (error) {
      console.error('[DeviceFingerprint] Error purging user data:', error);
      throw error;
    }
  }

  async getUserDeviceHistory(userId: number, limit = 20) {
    try {
      const userDevicesData = await db.select({
        deviceId: userDevices.deviceId,
        firstSeen: userDevices.firstSeen,
        lastSeen: userDevices.lastSeen,
        isCurrent: userDevices.isCurrent,
        deviceFingerprint: devices.deviceFingerprint,
        userAgent: devices.userAgent,
        platform: devices.platform,
        screenResolution: devices.screenResolution
      })
      .from(userDevices)
      .innerJoin(devices, eq(userDevices.deviceId, devices.deviceId))
      .where(eq(userDevices.userId, userId))
      .orderBy(desc(userDevices.lastSeen))
      .limit(limit);
      
      return userDevicesData;
    } catch (error) {
      console.error('[DeviceFingerprint] Error getting user device history:', error);
      return [];
    }
  }

  async getUserIpHistory(userId: number, limit = 20) {
    try {
      const ipHistory = await db.select()
        .from(ipAddresses)
        .where(eq(ipAddresses.userId, userId))
        .orderBy(desc(ipAddresses.lastSeen))
        .limit(limit);
      
      return ipHistory;
    } catch (error) {
      console.error('[DeviceFingerprint] Error getting user IP history:', error);
      return [];
    }
  }
}

export const deviceFingerprintService = new DeviceFingerprintService();