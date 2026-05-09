/**
 * Centralized Logger Utility
 * 
 * Provides structured logging with environment-aware output.
 * Replaces console.log/error/warn with controlled, level-based logging.
 * 
 * Usage:
 *   import { logger } from './logger';
 *   logger.info('Message');
 *   logger.warn('Warning message');
 *   logger.error('Error message', error);
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  showTimestamp: boolean;
  showLevel: boolean;
}

const config: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  showTimestamp: true,
  showLevel: true,
};

const logLevels: Record<LogLevel, number> = {
  info: 0,
  warn: 1,
  error: 2,
};

function formatMessage(level: LogLevel, message: string, data?: unknown): string {
  const parts: string[] = [];
  
  if (config.showTimestamp) {
    const time = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    parts.push(time);
  }
  
  if (config.showLevel) {
    const levelLabels: Record<LogLevel, string> = {
      info: 'INFO',
      warn: 'WARN',
      error: 'ERROR',
    };
    parts.push(`[${levelLabels[level]}]`);
  }
  
  parts.push(message);
  
  if (data !== undefined) {
    try {
      parts.push(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    } catch {
      parts.push('[Non-serializable data]');
    }
  }
  
  return parts.join(' ');
}

export const logger = {
  /**
   * Informational messages (development only by default)
   */
  info(message: string, data?: unknown): void {
    if (logLevels.info >= logLevels[config.level]) {
      console.log(formatMessage('info', message, data));
    }
  },

  /**
   * Warning messages - potential issues or important state changes
   */
  warn(message: string, data?: unknown): void {
    if (logLevels.warn >= logLevels[config.level]) {
      console.warn(formatMessage('warn', message, data));
    }
  },

  /**
   * Error messages - actual failures or exceptions
   */
  error(message: string, error?: unknown): void {
    if (logLevels.error >= logLevels[config.level]) {
      console.error(formatMessage('error', message, error));
    }
  },

  /**
   * Development-only logging (always suppressed in production)
   */
  debug(message: string, data?: unknown): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(formatMessage('info', `[DEBUG] ${message}`, data));
    }
  },

  /**
   * Update logger configuration
   */
  configure(newConfig: Partial<LoggerConfig>): void {
    Object.assign(config, newConfig);
  },
};
