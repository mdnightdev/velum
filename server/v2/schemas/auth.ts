import { z } from 'zod';
import zxcvbn from 'zxcvbn';

export const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .refine((val) => zxcvbn(val).score >= 2, {
    message: 'Password is too weak'
  });

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username cannot exceed 32 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username contains invalid characters'),
  password: strongPasswordSchema.optional(),
  hashedPassword: z.string().optional(),
  passcode: z.string().optional(),
  panicPhrase: z.string().optional(),
  referralCode: z.string().optional()
}).refine((data) => data.password || data.hashedPassword, {
  message: 'Either password or hashedPassword is required'
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  duressPasscode: z.string().optional(),
  panicPhrase: z.string().optional()
});

export const verifyPasscodeSchema = z.object({
  passcode: z
    .string()
    .min(8, 'Passcode must be at least 8 characters')
    .max(64, 'Passcode cannot exceed 64 characters')
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: strongPasswordSchema
});

export const updateProfileSchema = z.object({
  displayName: z.string().max(64).optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional().or(z.literal('')),
  bio: z.string().max(256).optional(),
  location: z.string().max(128).optional()
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyPasscodeInput = z.infer<typeof verifyPasscodeSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
