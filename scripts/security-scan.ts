#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { config } from '../server/v2/config.js';
import { pool, db } from '../server/v2/db/client.js';
import { createClient } from 'redis';
import { logger } from '../server/v2/utils/logger.js';
import { sql } from 'drizzle-orm';

// Load environment variables from multiple possible locations
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: 'server/v2/.env' });

// Direct Redis client for security scanning
let securityRedisClient: ReturnType<typeof createClient> | null = null;

async function getSecurityRedisClient() {
  if (securityRedisClient) return securityRedisClient;
  
  const redisUrl = config.REDIS_URL || process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  securityRedisClient = createClient({ url: redisUrl });
  
  securityRedisClient.on('error', (err) => {
    console.error('[Security Scanner] Redis error:', err);
  });
  
  await securityRedisClient.connect();
  return securityRedisClient;
}

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  message: string;
  details?: any;
  recommendation?: string;
}

class SecurityScanner {
  private issues: SecurityIssue[] = [];

  addIssue(issue: SecurityIssue) {
    this.issues.push(issue);
  }

  async scanPostgreSQLConnections(): Promise<void> {
    console.log('[SCAN] Checking PostgreSQL connection patterns...');
    
    try {
      const result = await pool.query(`
        SELECT 
          state,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (now() - query_start))) as avg_duration
        FROM pg_stat_activity 
        WHERE datname = current_database()
        GROUP BY state
      `);

      for (const row of result.rows) {
        if (row.state === 'active' && row.avg_duration > 300) {
          this.addIssue({
            severity: 'medium',
            category: 'postgresql',
            message: 'Long-running active queries detected',
            details: { state: row.state, count: row.count, avg_duration: row.avg_duration },
            recommendation: 'Review slow queries and add appropriate indexes'
          });
        }
      }

      const totalConnections = await pool.query(`
        SELECT COUNT(*) as count FROM pg_stat_activity WHERE datname = current_database()
      `);

      if (parseInt(totalConnections.rows[0].count) > 50) {
        this.addIssue({
          severity: 'medium',
          category: 'postgresql',
          message: 'High number of database connections',
          details: { connections: totalConnections.rows[0].count },
          recommendation: 'Review connection pool settings and consider connection pooling'
        });
      }

      console.log('[SCAN] PostgreSQL connection patterns checked');
    } catch (error) {
      this.addIssue({
        severity: 'low',
        category: 'postgresql',
        message: 'Failed to analyze connection patterns',
        details: { error: (error as Error).message }
      });
    }
  }

  async scanFailedAuthAttempts(): Promise<void> {
    console.log('[SCAN] Checking for failed authentication patterns...');
    
    try {
      // Check for suspicious patterns in user login attempts
      const recentFailedAttempts = await pool.query(`
        SELECT 
          COUNT(*) as failed_count,
          MIN(created_at) as first_attempt,
          MAX(created_at) as last_attempt
        FROM sessions 
        WHERE created_at > NOW() - INTERVAL '1 hour'
        AND user_id IS NULL
      `);

      const failedCount = parseInt(recentFailedAttempts.rows[0]?.failed_count || '0');
      
      if (failedCount > 100) {
        this.addIssue({
          severity: 'high',
          category: 'authentication',
          message: 'High volume of failed authentication attempts',
          details: { 
            failed_count: failedCount,
            time_window: '1 hour'
          },
          recommendation: 'Implement rate limiting on authentication endpoints and consider IP blocking'
        });
      } else if (failedCount > 20) {
        this.addIssue({
          severity: 'medium',
          category: 'authentication',
          message: 'Elevated failed authentication attempts',
          details: { failed_count: failedCount, time_window: '1 hour' },
          recommendation: 'Monitor authentication patterns and consider enhanced rate limiting'
        });
      }

      console.log('[SCAN] Failed authentication patterns checked');
    } catch (error) {
      this.addIssue({
        severity: 'low',
        category: 'authentication',
        message: 'Failed to analyze authentication patterns',
        details: { error: (error as Error).message }
      });
    }
  }

  async scanQueryPatterns(): Promise<void> {
    console.log('[SCAN] Analyzing query patterns...');
    
    try {
      // Check for common SQL injection patterns in recent queries
      const suspiciousQueries = await pool.query(`
        SELECT query, calls, total_time
        FROM pg_stat_statements 
        WHERE query LIKE '%=%=%' 
        OR query LIKE '%1=1%'
        OR query LIKE '%OR 1=1%'
        OR query LIKE '%UNION SELECT%'
        ORDER BY calls DESC
        LIMIT 10
      `);

      if (suspiciousQueries.rows.length > 0) {
        this.addIssue({
          severity: 'critical',
          category: 'sql_injection',
          message: 'Potential SQL injection patterns detected in query statistics',
          details: { suspicious_queries: suspiciousQueries.rows },
          recommendation: 'Review application code for proper parameterization and input validation'
        });
      }

      // Check for excessive query rates
      const highFrequencyQueries = await pool.query(`
        SELECT query, calls, total_time, mean_time
        FROM pg_stat_statements 
        WHERE calls > 1000
        ORDER BY calls DESC
        LIMIT 5
      `);

      if (highFrequencyQueries.rows.length > 0) {
        this.addIssue({
          severity: 'medium',
          category: 'performance',
          message: 'High-frequency queries detected',
          details: { queries: highFrequencyQueries.rows },
          recommendation: 'Review and optimize frequently executed queries'
        });
      }

      console.log('[SCAN] Query patterns analyzed');
    } catch (error) {
      // pg_stat_statements might not be enabled
      this.addIssue({
        severity: 'info',
        category: 'postgresql',
        message: 'Query statistics not available (pg_stat_statements not enabled)',
        details: { error: (error as Error).message },
        recommendation: 'Enable pg_stat_statements in PostgreSQL for query pattern analysis'
      });
    }
  }

  async scanRedisKeys(): Promise<void> {
    console.log('[SCAN] Analyzing Redis key patterns...');
    
    try {
      const redis = await getSecurityRedisClient();
      
      // Test Redis connection
      await redis.ping();

      // Check for unusually large keys
      const keys = await redis.keys('*');
      const largeKeys: any[] = [];

      for (const key of keys.slice(0, 100)) { // Sample first 100 keys
        const rawSize = await redis.memory('usage', key);
        const size = typeof rawSize === 'number' ? rawSize : 0;
        if (size > 1024 * 1024) { // > 1MB
          largeKeys.push({ key, size: `${(size / 1024 / 1024).toFixed(2)}MB` });
        }
      }

      if (largeKeys.length > 0) {
        this.addIssue({
          severity: 'medium',
          category: 'redis',
          message: 'Large Redis keys detected',
          details: { large_keys: largeKeys },
          recommendation: 'Review large keys for potential memory issues or data accumulation'
        });
      }

      // Check for suspicious key patterns
      const suspiciousPatterns = [
        'hack',
        'exploit',
        'injection',
        'xss',
        'malicious',
        'attack'
      ];

      for (const pattern of suspiciousPatterns) {
        const matchingKeys = await redis.keys(`*${pattern}*`);
        if (matchingKeys.length > 0) {
          this.addIssue({
            severity: 'high',
            category: 'redis',
            message: `Suspicious key pattern detected: ${pattern}`,
            details: { matching_keys: matchingKeys.slice(0, 10) },
            recommendation: 'Investigate suspicious Redis keys immediately'
          });
        }
      }

      // Check Redis memory usage
      const info = String(await redis.info('memory'));
      const usedMemoryMatch = info.match(/used_memory:(\d+)/);
      if (usedMemoryMatch) {
        const usedMemory = parseInt(usedMemoryMatch[1]);
        const usedMemoryMB = usedMemory / 1024 / 1024;
        
        if (usedMemoryMB > 500) {
          this.addIssue({
            severity: 'medium',
            category: 'redis',
            message: 'High Redis memory usage',
            details: { used_memory_mb: usedMemoryMB.toFixed(2) },
            recommendation: 'Review Redis memory usage and implement key expiration policies'
          });
        }
      }

      console.log('[SCAN] Redis key patterns analyzed');
    } catch (error) {
      this.addIssue({
        severity: 'low',
        category: 'redis',
        message: 'Failed to analyze Redis keys',
        details: { error: (error as Error).message }
      });
    }
  }

  async scanSchemaDrift(): Promise<void> {
    console.log('[SCAN] Checking for schema drift...');
    
    try {
      // Get actual table information
      const actualTables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      const actualTableNames = actualTables.rows.map(row => row.table_name);

      // Expected tables based on actual database schema
      const expectedTables = [
        'users', 'sessions', 'wallets', 'lounges', 'tickets', 'audit_logs',
        'cards', 'reserves', 'devices', 'exchange_rates', 'relationships',
        'escrows', 'ip_addresses', 'listings', 'lounge_members', 'lounge_mute_settings',
        'message_reactions', 'messages', 'outbox_events', 'push_subscriptions',
        'reports', 'support_admin_nominations', 'system_config', 'transactions',
        'user_devices', 'user_prekeys', 'user_read_cursors', 'user_unread_counts',
        'webauthn_credentials'
      ];

      // Check for missing tables
      const missingTables = expectedTables.filter(
        table => !actualTableNames.includes(table)
      );

      if (missingTables.length > 0) {
        this.addIssue({
          severity: 'high',
          category: 'schema',
          message: 'Schema drift detected: missing tables',
          details: { missing_tables: missingTables },
          recommendation: 'Run Drizzle migrations to sync schema'
        });
      }

      // Check for unexpected tables
      const unexpectedTables = actualTableNames.filter(
        table => !expectedTables.includes(table)
      );

      if (unexpectedTables.length > 0) {
        this.addIssue({
          severity: 'medium',
          category: 'schema',
          message: 'Unexpected tables detected in database',
          details: { unexpected_tables: unexpectedTables },
          recommendation: 'Review unexpected tables and remove if unauthorized'
        });
      }

      console.log('[SCAN] Schema drift check completed');
    } catch (error) {
      this.addIssue({
        severity: 'low',
        category: 'schema',
        message: 'Failed to check schema drift',
        details: { error: (error as Error).message }
      });
    }
  }

  async scanVulnerabilityIndicators(): Promise<void> {
    console.log('[SCAN] Checking for vulnerability indicators...');
    
    try {
      // Check for default credentials indicators
      const defaultUserCheck = await pool.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE username = 'admin' OR username = 'root' OR username = 'postgres'
      `);

      if (parseInt(defaultUserCheck.rows[0].count) > 0) {
        this.addIssue({
          severity: 'high',
          category: 'credentials',
          message: 'Default username patterns detected',
          details: { count: defaultUserCheck.rows[0].count },
          recommendation: 'Review and rename default username accounts'
        });
      }

      // Check for excessive user creation (potential bot attack)
      const recentUsers = await pool.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `);

      const recentUserCount = parseInt(recentUsers.rows[0].count);
      if (recentUserCount > 50) {
        this.addIssue({
          severity: 'high',
          category: 'bot_attack',
          message: 'Unusual user creation rate detected',
          details: { recent_users: recentUserCount, time_window: '1 hour' },
          recommendation: 'Implement user creation rate limiting and CAPTCHA'
        });
      }

      console.log('[SCAN] Vulnerability indicators checked');
    } catch (error) {
      this.addIssue({
        severity: 'low',
        category: 'vulnerability',
        message: 'Failed to check vulnerability indicators',
        details: { error: (error as Error).message }
      });
    }
  }

  async scanRateLimitingStatus(): Promise<void> {
    console.log('[SCAN] Checking rate limiting configuration...');
    
    try {
      const isDevelopment = config.NODE_ENV === 'development' || config.NODE_ENV === 'test';
      
      if (isDevelopment) {
        this.addIssue({
          severity: 'medium',
          category: 'rate_limiting',
          message: 'Rate limiting is disabled in development mode',
          details: { environment: config.NODE_ENV },
          recommendation: 'Ensure rate limiting is enabled in production environment'
        });
      }

      // Check Redis availability for distributed rate limiting
      try {
        const redis = await getSecurityRedisClient();
        await redis.ping(); // Test actual connection
      } catch (redisError) {
        this.addIssue({
          severity: 'high',
          category: 'rate_limiting',
          message: 'Redis connection failed for distributed rate limiting',
          details: { error: (redisError as Error).message },
          recommendation: 'Configure Redis for production rate limiting'
        });
      }

      console.log('[SCAN] Rate limiting status checked');
    } catch (error) {
      this.addIssue({
        severity: 'low',
        category: 'rate_limiting',
        message: 'Failed to check rate limiting status',
        details: { error: (error as Error).message }
      });
    }
  }

  generateReport(): void {
    console.log('\n=== SECURITY SCAN REPORT ===\n');
    
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    const groupedIssues = this.issues.reduce((acc, issue) => {
      if (!acc[issue.severity]) {
        acc[issue.severity] = [];
      }
      acc[issue.severity].push(issue);
      return acc;
    }, {} as Record<string, SecurityIssue[]>);

    for (const severity of severityOrder) {
      const issues = groupedIssues[severity];
      if (issues && issues.length > 0) {
        console.log(`[${severity.toUpperCase()}] ${issues.length} issue(s) found:\n`);
        
        for (const issue of issues) {
          console.log(`  • ${issue.message}`);
          console.log(`    Category: ${issue.category}`);
          
          if (issue.details) {
            console.log(`    Details: ${JSON.stringify(issue.details, null, 2).split('\n').join('\n    ')}`);
          }
          
          if (issue.recommendation) {
            console.log(`    Recommendation: ${issue.recommendation}`);
          }
          
          console.log('');
        }
      }
    }

    const totalIssues = this.issues.length;
    const criticalIssues = groupedIssues.critical?.length || 0;
    const highIssues = groupedIssues.high?.length || 0;
    
    console.log(`=== SUMMARY ===`);
    console.log(`Total issues: ${totalIssues}`);
    console.log(`Critical: ${criticalIssues}`);
    console.log(`High: ${highIssues}`);
    console.log(`Medium: ${groupedIssues.medium?.length || 0}`);
    console.log(`Low: ${groupedIssues.low?.length || 0}`);
    console.log(`Info: ${groupedIssues.info?.length || 0}`);
    
    if (criticalIssues > 0 || highIssues > 0) {
      console.log('\n⚠️  CRITICAL/HIGH issues require immediate attention!');
    } else if (totalIssues === 0) {
      console.log('\n✅ No security issues detected.');
    }
  }

  async run(): Promise<void> {
    console.log('Starting Velum Security Scan...\n');
    
    await this.scanPostgreSQLConnections();
    await this.scanFailedAuthAttempts();
    await this.scanQueryPatterns();
    await this.scanRedisKeys();
    await this.scanSchemaDrift();
    await this.scanVulnerabilityIndicators();
    await this.scanRateLimitingStatus();
    
    this.generateReport();
  }
}

async function main() {
  const scanner = new SecurityScanner();
  
  try {
    await scanner.run();
  } catch (error) {
    console.error('Security scan failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    if (securityRedisClient) {
      await securityRedisClient.quit();
    }
  }
}

main();
