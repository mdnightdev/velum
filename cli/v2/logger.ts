export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class CliLogger {
  private level: LogLevel;

  constructor(private prefix: string, defaultLevel: LogLevel = 'info') {
    this.level = this.resolveLevel(defaultLevel);
  }

  private resolveLevel(defaultLevel: LogLevel): LogLevel {
    const envLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
    return LOG_LEVELS[envLevel] >= LOG_LEVELS[defaultLevel] ? envLevel : defaultLevel;
  }

  private format(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) return;

    const timestamp = new Date().toISOString();
    const contextStr = context && Object.keys(context).length > 0
      ? `\n  context: ${JSON.stringify(context)}`
      : '';

    const formatted = `${timestamp} [${this.prefix}] ${level.toUpperCase()}: ${message}${contextStr}`;

    switch (level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'debug':
        console.debug(formatted);
        break;
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.format('debug', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.format('info', message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.format('warn', message, context);
  }

  error(message: string, context?: Record<string, any>) {
    this.format('error', message, context);
  }
}

export const createCliLogger = (prefix: string, defaultLevel?: LogLevel) => new CliLogger(prefix, defaultLevel);