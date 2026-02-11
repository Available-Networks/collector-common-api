import * as fs from "fs";
import * as winston from 'winston';
import { LogLevel } from "../config/types";

// -----------------------------------------------------------------------------
// Emoji mapping per log level
// -----------------------------------------------------------------------------
/**
 * Emoji prefixes for console logging per level
 */
const levelEmoji: Record<string, string> = {
  error: "❌",
  warn: "⚠️ ",
  info: "ℹ️ ",
  http: "🌐",
  verbose: "🔍",
  debug: "🐛",
  silly: "🤪",
}

// -----------------------------------------------------------------------------
// Console log formatting
// -----------------------------------------------------------------------------
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ level, message, timestamp }) => {
    const emoji = levelEmoji[level] ?? "📄";
    return `${timestamp} | ${emoji} ${message}`;
  }),
  winston.format.colorize({ all: true })
);

// -----------------------------------------------------------------------------
// CSV file log formatting
// -----------------------------------------------------------------------------
const csvFileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ level, message, timestamp }) => {
    const safeMessage = toAscii(`"${(message as string).replace(/"/g, '""')}"`).trim();
    return `${timestamp},${level},${safeMessage}`;
  })
);

/**
 * Ensure CSV log file has headers if it does not exist
 *
 * @param filePath - Path to the CSV log file
 */
const writeCsvHeaders = (filePath: string): void => {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
  } catch {
    const headers = "timestamp,level,message\n";
    fs.writeFileSync(filePath, headers, "utf-8");
  }
}

// -----------------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------------
/**
 * Converts a string to printable ASCII, removing accents and non-printable characters
 *
 * @param input - Input string to normalize
 * @returns Normalized ASCII-only string
 */
export function toAscii(input: string): string {
  return input
    .normalize("NFKD")              // split accented chars
    .replace(/[^\x20-\x7E]/g, "");  // keep printable ASCII only
}

// -----------------------------------------------------------------------------
// Logger
// -----------------------------------------------------------------------------
/**
 * Singleton logger class wrapping Winston.
 *
 * Supports:
 * - Console logging with emojis and timestamps
 * - Optional CSV file logging
 * - Global mute/unmute
 * @example
 * ```ts
 * Logger.CreateLogger("debug", "logs/app.csv");
 * Logger.info("Service started");
 * Logger.error("Something went wrong");
 * ```
 */
export default class Logger {
  /** Singleton Winston logger instance */
  public static _logger: winston.Logger;

  /** Path to the CSV log file, if any */
  private static _logFilePath: string;

  /**
     * Initializes the logger singleton.
     *
     * @param level - Minimum log level (default: "info")
     * @param logFileName - Optional CSV file path for file logging
     * @returns `null` if the logger already exists
     */
  public static CreateLogger = (level: string = "info", logFileName?: string) => {
    if (this._logger) {
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

  /** Returns whether logging is currently muted */
  public static get muted(): boolean {
    return this._logger.silent
  }

  /** Mute all logging */
  public static mute(): void { this._logger.silent = true }
  /** Unmute all logging */
  public static unmute(): void { this._logger.silent = false }

  // -------------------------------------------------------------------------
  // Level-specific logging methods
  // -------------------------------------------------------------------------
  public static logWithLevel(message: string, logLevel: LogLevel) {
    switch(logLevel) {
      case "verbose": this.verbose(message); break;
      case "silly": this.silly(message); break;
      case "debug": this.debug(message); break;
      case "error": this.error(message); break;
      case "http": this.http(message); break;
      case "warn": this.warn(message); break;
      case "info": this.info(message); break;
    }
  }

  public static verbose(message: string): void { this._logger.verbose(message) }
  public static silly(message: string): void { this._logger.silly(message) }
  public static debug(message: string): void { this._logger.debug(message) }
  public static error(message: string): void { this._logger.error(message) }
  public static http(message: string): void { this._logger.http(message) }
  public static warn(message: string): void { this._logger.warn(message) }
  public static info(message: string): void { this._logger.info(message) }
}