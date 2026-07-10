import express from 'express';
import { authRateLimiter, authenticateUser } from '../middleware.js';
import { 
  getPreSignupSalt, 
  getLoginNonce, 
  getSession, 
  registerUser, 
  loginUser, 
  registerPermanentOtp, 
  migrateUser, 
  getOtpStatus, 
  activateAdmin, 
  logoutUser, 
  panicUser, 
  emergencyPanicUser, 
  getRecoverySalt, 
  getUserSalt, 
  recoverAutomatic, 
  recoverAccount, 
  restoreAccount, 
  redeemRestoreCode, 
  recoverSafeword 
} from '../controllers/auth.js';

export const authRouter = express.Router();

authRouter.get('/auth/pre-signup-salt', getPreSignupSalt);
authRouter.get('/auth/login-nonce', getLoginNonce);
authRouter.get('/auth/session', authenticateUser, getSession);

authRouter.post('/auth/register', authRateLimiter, registerUser);
authRouter.post('/auth/login', authRateLimiter, loginUser);
authRouter.post('/auth/register-permanent-otp', registerPermanentOtp);
authRouter.post('/auth/migrate', migrateUser);

authRouter.get('/auth/otp-status', getOtpStatus);
authRouter.post('/auth/activate-admin', authRateLimiter, activateAdmin);
authRouter.post('/auth/logout', logoutUser);

authRouter.post('/auth/panic', panicUser);
authRouter.post('/auth/emergency-panic', emergencyPanicUser);

authRouter.get('/auth/recovery-salt', getRecoverySalt);
authRouter.get('/auth/user-salt', getUserSalt);

authRouter.post('/auth/recover-automatic', recoverAutomatic);
authRouter.post('/auth/recover-account', recoverAccount);
authRouter.post('/auth/restore-account', restoreAccount);
authRouter.post('/auth/redeem-restore-code', redeemRestoreCode);
authRouter.post('/auth/recover-safeword', recoverSafeword);
