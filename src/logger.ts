import fs from "fs";
import winston from 'winston';

const levelEmoji: Record<string, string> = {
  error: "❌",
  warn: "⚠️ ",
  info: "ℹ️ ",
  http: "🌐",
  verbose: "🔍",
  debug: "🐛",
  silly: "🤪",
}

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ level, message, timestamp }) => {
    const emoji = levelEmoji[level] ?? "📄";
    return `${timestamp} | ${emoji} ${message}`;
  }),
  winston.format.colorize({ all: true })
);

// CSV format for file logging
const csvFileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ level, message, timestamp }) => {
    const safeMessage = toAscii(`"${(message as string).replace(/"/g, '""')}"`).trim();
    return `${timestamp},${level},${safeMessage}`;
  })
);

const writeCsvHeaders = (filePath: string): void => {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
  } catch {
    const headers = "timestamp,level,message\n";
    fs.writeFileSync(filePath, headers, "utf-8");
  }
}

// thanks chatgpt
export function toAscii(input: string): string {
  return input
    .normalize("NFKD")              // split accented chars
    .replace(/[^\x20-\x7E]/g, "");  // keep printable ASCII only
}

export default class Logger {
  public static _logger: winston.Logger;
  private static _logFilePath: string;

  public static CreateLogger = (level: string = "info", logFileName?: string) => {
    if(this._logger) {
      return null;
    }

    // create base console transport
    const transports: winston.transport[] = [
      new winston.transports.Console({ format: consoleFormat }),
    ];

    // if we have received a file name then we write to a log file - using a csv
    if (logFileName) {
      writeCsvHeaders(logFileName);
      transports.push(
        new winston.transports.File({
          filename: logFileName!,
          format: csvFileFormat,
        })
      );
      this._logFilePath = logFileName;
    }

    // create the winston logger
    this._logger = winston.createLogger({ level, transports });
  }

  public static get muted(): boolean { 
    return this._logger.silent 
  }

  public static mute()  : void { this._logger.silent = true   }
  public static unmute(): void { this._logger.silent = false  }

  public static verbose(message: string)  : void { this._logger.verbose(message) }
  public static silly(message: string)    : void { this._logger.silly(message)   }
  public static debug(message: string)    : void { this._logger.debug(message)   }
  public static error(message: string)    : void { this._logger.error(message)   }
  public static http(message: string)     : void { this._logger.http(message)    }
  public static warn(message: string)     : void { this._logger.warn(message)    }
  public static info(message: string)     : void { this._logger.info(message)    }
}