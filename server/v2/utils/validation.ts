import { BadRequestError } from './errors.js';

export const VALIDATION_LIMITS = {
  USERNAME_MIN: 3,
  USERNAME_MAX: 32,
  DISPLAY_NAME_MAX: 64,
  MESSAGE_CONTENT_MAX: 10000,
  BIO_MAX: 500,
  REASON_MAX: 500,
  URL_MAX: 2048
} as const;

/**
 * Validates string length bounds with exact error descriptions.
 */
export function validateStringLength(
  value: string | undefined | null,
  min: number,
  max: number,
  fieldName: string
): string {
  if (!value || typeof value !== 'string') {
    throw new BadRequestError(`${fieldName} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new BadRequestError(`${fieldName} must be between ${min} and ${max} characters.`);
  }
  return trimmed;
}

/**
 * Safely parse integer from string, returning fallback on NaN.
 */
export function safeParseInt(value: any, defaultValue = 0): number {
  if (typeof value === 'number' && !isNaN(value)) return Math.floor(value);
  if (typeof value !== 'string') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse a required positive integer ID from request params/query.
 */
export function parsePositiveInt(value: any, fieldName = 'ID'): number {
  const parsed = parseInt(String(value), 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new BadRequestError(`Invalid ${fieldName}: Expected a valid positive integer.`);
  }
  return parsed;
}

/**
 * Safely parse floating point number from string, returning fallback on NaN.
 */
export function safeParseFloat(value: any, defaultValue = 0.0): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value !== 'string') return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}
