import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { config } from './config.js';
import { globalErrorHandler } from './utils/errors.js';

// V2 Routes
import { authRouter as v2AuthRouter } from './routes/authRoutes.js';
import { duressRouter } from './routes/duressRoutes.js';
import { bankRouter as v2BankRouter } from './routes/bankRoutes.js';
import { marketRouter as v2MarketRouter } from './routes/marketRoutes.js';
import { userRouter as v2UserRouter } from './routes/userRoutes.js';
import { loungeRouter as v2LoungeRouter } from './routes/loungeRoutes.js';
import { cardRouter as v2CardRouter } from './routes/cardRoutes.js';
import { paymentRouter as v2PaymentRouter } from './routes/paymentRoutes.js';
import { ticketRouter } from './routes/ticketRoutes.js';
import { friendRouter } from './routes/friendRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { userPublicRouter } from './routes/userPublicRoutes.js';
import { utilityRouter } from './routes/mockRoutes.js';
import { messagingRouter } from './routes/messagingRoutes.js';
import { mediaRouter } from './routes/mediaRoutes.js';
import { cryptoRouter } from './routes/cryptoRoutes.js';
import { notificationRouter } from './routes/notificationRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { currencyConverter } from './services/currencyConverter.js';

export const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting middleware
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false
});

// Apply security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Configure CORS
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id']
};

app.use(cors(corsOptions));

// Public health endpoints (no auth required)
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'online',
    version: '2.0.0',
    env: config.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Health endpoints
app.use('/v2', healthRouter);
app.use('/api/v2', healthRouter);

// Public unauthenticated ticket tracking endpoints
app.use('/v2', userPublicRouter);
app.use('/api/v2', userPublicRouter);
app.use('/public', userPublicRouter);
app.use('/api/public', userPublicRouter);
app.use('/v2/public', userPublicRouter);
app.use('/api/v2/public', userPublicRouter);

// Authenticated routes with rate limiting
app.use('/v2/auth', authLimiter, duressRouter);
app.use('/api/v2/auth', authLimiter, duressRouter);
app.use('/v2/auth', authLimiter, v2AuthRouter);
app.use('/api/v2/auth', authLimiter, v2AuthRouter);

app.use('/v2/bank', apiLimiter, v2BankRouter);
app.use('/v2/marketplace', apiLimiter, v2MarketRouter);
app.use('/v2/user', apiLimiter, v2UserRouter);
app.use('/v2/lounges', apiLimiter, v2LoungeRouter);
app.use('/v2', apiLimiter, messagingRouter);
app.use('/v2', apiLimiter, mediaRouter);
app.use('/api/v2', apiLimiter, mediaRouter);
app.use('/v2', apiLimiter, cryptoRouter);
app.use('/api/v2', apiLimiter, cryptoRouter);
app.use('/v2/notifications', apiLimiter, notificationRouter);
app.use('/api/v2/notifications', apiLimiter, notificationRouter);
app.use('/v2/cards', apiLimiter, v2CardRouter);
app.use('/v2/payments', apiLimiter, v2PaymentRouter);
app.use('/v2', apiLimiter, ticketRouter);
app.use('/v2/friends', apiLimiter, friendRouter);
app.use('/v2/admin', apiLimiter, adminRouter);
app.use('/api/v2/admin', apiLimiter, adminRouter);
app.use('/v2', apiLimiter, utilityRouter);

// Fallback for unmounted endpoints to prevent HTML responses
app.use('/v2/*', (req, res) => {
  res.status(404).json({ error: 'V2 API endpoint not found or not yet implemented.' });
});

// Fallback for V1 unmounted endpoints
app.use('/api/*', (req, res) => {
  res.status(410).json({ error: 'V1 API is deprecated and has been unmounted. Please use V2 endpoints.' });
});

app.use(globalErrorHandler);

export function startV2Server(port = config.PORT) {
  return app.listen(port, () => {
    console.log(`[SERVER v2] Running on port ${port} in ${config.NODE_ENV} mode.`);
  });
}
