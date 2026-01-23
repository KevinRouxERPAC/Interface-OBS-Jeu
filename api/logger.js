/**
 * Logger centralisé
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

class Logger {
  constructor(logLevel = 'info') {
    this.logLevel = LOG_LEVELS[logLevel] || LOG_LEVELS.info;
  }

  formatMessage(level, context, message, data) {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    const contextStr = context ? `[${context}]` : '';
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `${timestamp} ${levelStr} ${contextStr} ${message}${dataStr}`;
  }

  error(context, message, data) {
    if (this.logLevel >= LOG_LEVELS.error) {
      console.error(this.formatMessage('error', context, message, data));
    }
  }

  warn(context, message, data) {
    if (this.logLevel >= LOG_LEVELS.warn) {
      console.warn(this.formatMessage('warn', context, message, data));
    }
  }

  info(context, message, data) {
    if (this.logLevel >= LOG_LEVELS.info) {
      console.log(this.formatMessage('info', context, message, data));
    }
  }

  debug(context, message, data) {
    if (this.logLevel >= LOG_LEVELS.debug) {
      console.log(this.formatMessage('debug', context, message, data));
    }
  }
}

module.exports = Logger;
