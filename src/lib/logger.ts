import { env } from "@/config/env";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const currentLevel = env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;

function formatLog(level: string, message: string, meta?: Record<string, unknown>): string {
  const log = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta || {}),
  };
  return JSON.stringify(log);
}

function log(level: LogLevel, levelName: string, message: string, meta?: Record<string, unknown>) {
  if (level < currentLevel) return;

  const formatted = formatLog(levelName, message, meta);
  
  switch (level) {
    case LogLevel.ERROR:
    case LogLevel.WARN:
      console.error(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    log(LogLevel.DEBUG, "DEBUG", message, meta);
  },

  info(message: string, meta?: Record<string, unknown>) {
    log(LogLevel.INFO, "INFO", message, meta);
  },

  warn(message: string, meta?: Record<string, unknown>) {
    log(LogLevel.WARN, "WARN", message, meta);
  },

  error(message: string, meta?: Record<string, unknown>) {
    log(LogLevel.ERROR, "ERROR", message, meta);
  },

  http(request: Request, meta?: Record<string, unknown>) {
    log(LogLevel.INFO, "HTTP", `${request.method} ${request.url}`, {
      method: request.method,
      url: request.url,
      ...meta,
    });
  },
};

export default logger;
