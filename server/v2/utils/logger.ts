import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

// Sensitive fields to redact from logs
const SENSITIVE_FIELDS = [
  'password', 'pass', 'pwd', 'secret', 'token', 'apikey', 'api_key', 
  'authorization', 'auth', 'credit_card', 'ssn', 'social_security',
  'session', 'cookie', 'csrf', 'nonce', 'private_key', 'access_token',
  'refresh_token', 'client_secret', 'client_id', 'recoverykey', 'recovery_key',
  'panicphrase', 'panic_phrase', 'passcode', 'pin', 'salt', 'hash'
];

// Redact sensitive data from objects
export function redactSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item));
  }
  
  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export const sanitizeForLogging = redactSensitiveData;

// Custom log levels following syslog severity
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Human-readable format for development
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message, timestamp, correlationId, service, ...meta }) => {
    const redactedMeta = redactSensitiveData(meta);
    const metaKeys = Object.keys(redactedMeta);
    const metaStr = metaKeys.length ? ` ${JSON.stringify(redactedMeta)}` : '';
    const corr = correlationId ? `[${correlationId}]` : '[NO-CORR-ID]';
    return `${timestamp} ${corr} [${level}]: ${message}${metaStr}`;
  })
);

// JSON format for production (machine-readable)
const prodFormat = winston.format.combine(
  winston.format.timestamp({ format: 'isoDateTime' }),
  winston.format.errors({ stack: true }),
  winston.format((info) => {
    info.correlationId = info.correlationId || 'NO-CORR-ID';
    info.service = info.service || 'velum-v2';
    info.environment = process.env.NODE_ENV || 'development';
    return redactSensitiveData(info);
  })(),
  winston.format.json()
);

// Create logger with environment-aware configuration
export const logger = winston.createLogger({
  levels,
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  defaultMeta: { service: 'velum-v2' },
  transports: [
    // Console transport with environment-specific format
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
    }),
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
    }),
  ],
});

/**
 * File transports: warn + error always (unless DISABLE_FILE_LOGGING=true).
 * Full app log only in production or ENABLE_FILE_LOGGING=true.
 */
async function addFileTransports() {
  if (process.env.DISABLE_FILE_LOGGING === 'true') return;

  try {
    const { resolve } = await import('path');
    const fs = await import('fs');
    const logsDir = resolve(process.cwd(), 'logs');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const warnRotateTransport = new DailyRotateFile({
      dirname: logsDir,
      filename: 'warn-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'warn',
      format: prodFormat,
    });
    // Isolate amber: only warn lines (DailyRotateFile level includes error+warn;
    // filter so warn file is warn-only).
    warnRotateTransport.format = winston.format.combine(
      winston.format((info) => (info.level === 'warn' ? info : false))(),
      prodFormat
    );

    const errorRotateTransport = new DailyRotateFile({
      dirname: logsDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: prodFormat,
    });

    logger.add(warnRotateTransport);
    logger.add(errorRotateTransport);

    const fullAppLog =
      process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true';
    if (fullAppLog) {
      const appRotateTransport = new DailyRotateFile({
        dirname: logsDir,
        filename: 'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: prodFormat,
      });
      logger.add(appRotateTransport);
    }
  } catch (err) {
    console.error('Failed to initialize file logging transports:', err);
  }
}

// Initialize file transports
addFileTransports().catch(() => {});

// Request logging middleware with correlation IDs
export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  (req as any).correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  const start = Date.now();
  
  // Log request start only in debug mode to reduce noise
  if (process.env.LOG_LEVEL === 'debug') {
    logger.debug('Incoming request', {
      correlationId,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';
    const path = req.originalUrl || req.url;

    logger[logLevel](`${req.method} ${path} ${res.statusCode} ${duration}ms`, {
      correlationId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    if (res.statusCode >= 400) {
      void import('../services/opsErrorService.js')
        .then(({ reportOpsErrorFromHttp }) =>
          reportOpsErrorFromHttp({
            req,
            statusCode: res.statusCode,
            durationMs: duration,
          })
        )
        .catch(() => {});
    }
  });

  next();
};

export const requestLogger = requestLoggerMiddleware;
