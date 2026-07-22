import fs from 'fs';
import path from 'path';

let logBuffer: string[] = [];
let writeTimer: NodeJS.Timeout | null = null;

function flushLogBuffer() {
  if (logBuffer.length === 0) return;
  const logsToWrite = logBuffer.join('');
  logBuffer = [];
  try {
    const logPath = path.join(process.cwd(), 'data', 'server.log');
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFile(logPath, logsToWrite, 'utf8', () => {});
  } catch (_) {}
}

export function writeServerLog(message: string) {
  try {
    const timestamp = new Date().toISOString();
    logBuffer.push(`[${timestamp}] ${message}\n`);
    if (logBuffer.length > 500) {
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = null;
      flushLogBuffer();
    } else if (!writeTimer) {
      writeTimer = setTimeout(() => {
        writeTimer = null;
        flushLogBuffer();
      }, 250);
    }
  } catch (_) {
    // Fail silently to prevent logging operations from impacting runtime stability
  }
}

