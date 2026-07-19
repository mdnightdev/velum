import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';

const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));

// Content Security Policy & Standard Security Headers
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Custom CSP allowing websockets, self-assets, framing, fonts
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' ws: wss: https:; frame-ancestors *;");
  next();
};

// Traversal and Restricted File Protection Guard
export const fileProtection = (req: Request, res: Response, next: NextFunction) => {
  const urlPath = req.path.toLowerCase();
  
  // Guard against directory traversal and double-slash sequences
  if (urlPath.includes('..') || urlPath.includes('//')) {
    return res.status(403).json({ error: 'Access Denied: Invalid path sequence.' });
  }

  // Bypass restriction for Vite dependency cache in development
  if (urlPath.includes('/node_modules/.vite/')) {
    return next();
  }

  // Define patterns for restricted static/direct files
  const restrictedPatterns = [
    /^\/\./,                             // Dotfiles at root
    /\/\./,                              // Dotfiles in subfolders
    /\.sqlite$/i,                        // SQLite files
    /\.db$/i,                            // General database files
    /\.bin$/i,                           // Binary backup assets
    /\.env/i,                            // Environment files
    /package(-lock)?\.json$/i,           // Node package descriptors
    /tsconfig\.json$/i,                  // TypeScript compiler config
    /readme\.md$/i,                      // Documentation markdown files
    /design\.md$/i,                      // Design sheets
    /agents\.md$/i,                      // Agent instructions
    /userdata\.json$/i,                  // Sensitive user JSON dumps
    /login\.json$/i,
    /master\.json$/i,
    /masters\.json$/i,
    /connections?\.json$/i,
    /passwordsdata\.json$/i,
    /users\.json$/i,
    /conndb\.json$/i,
    /accounts?\.json$/i,
    /\.sh$/i,                            // Shell scripts
    /\.sh_history$/i,                    // Shell command histories
    /\.bash_history$/i,                  // Bash shell histories
    /jamon/i                             // Java application monitor endpoints
  ];

  for (const pattern of restrictedPatterns) {
    if (pattern.test(urlPath)) {
      console.warn(`[SECURITY] Restricted access attempt blocked: ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
      return res.status(403).json({ error: 'Access Denied: Restricted administrative configuration.' });
    }
  }

  // Prevent production access to internal project folders
  if (isProduction) {
    if (/^(\/server|\/data|\/bin|\/src)/i.test(urlPath)) {
      console.warn(`[SECURITY] Restricted production folder access attempt blocked: ${req.method} ${req.originalUrl}`);
      return res.status(403).json({ error: 'Access Denied: Production access to internal project directories is forbidden.' });
    }
  }

  next();
};
