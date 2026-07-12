import fs from 'fs';
import path from 'path';

export function writeServerLog(message: string) {
  try {
    const logPath = path.join(process.cwd(), 'data', 'server.log');
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`, 'utf8');
  } catch (err) {
    // Fail silently to prevent logging operations from impacting runtime stability
  }
}
