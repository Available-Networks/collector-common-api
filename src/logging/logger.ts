import * as fs from "fs";
import * as winston from 'winston';

/**
 * Valid log levels used by the service logger.
 */
export const LogLevel = ["error", "warn", "info", "http", "verbose", "debug", "silly"] as const;
export type LogLevel = typeof LogLevel[number];

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
// Logger Instance Class
// -----------------------------------------------------------------------------
/**
 * Logger instance with type-safe logging methods.
 * 
 * Cannot be constructed directly - use LoggerFactory.CreateLogger()
 */
export class Logger {
  private _logger: winston.Logger;
  private _logFilePath?: string;

  /**
   * @internal - Use LoggerFactory.CreateLogger() instead
   */
  constructor(level: string, logFileName?: string) {
    // create base console transport
    const transports: winston.transport[] = [
      new winston.transports.Console({ format: consoleFormat }),
    ];

    // if we have received a file name then we write to a log file - using a csv
    if (logFileName) {
      writeCsvHeaders(logFileName);
      transports.push(
        new winston.transports.File({
          filename: logFileName,
          format: csvFileFormat,
        })
      );
      this._logFilePath = logFileName;
    }

    // create the winston logger
    this._logger = winston.createLogger({ level, transports });
  }

  /** Returns whether logging is currently muted */
  public get muted(): boolean {
    return this._logger.silent;
  }

  /** Returns the log file path if one was configured */
  public get logFilePath(): string | undefined {
    return this._logFilePath;
  }

  /** Mute all logging */
  public mute(): void {
    this._logger.silent = true;
  }

  /** Unmute all logging */
  public unmute(): void {
    this._logger.silent = false;
  }

  /** Set the minimum log level */
  public setLevel(level: LogLevel): void {
    this._logger.level = level;
  }

  // -------------------------------------------------------------------------
  // Level-specific logging methods
  // -------------------------------------------------------------------------
  public logWithLevel(message: string, logLevel: LogLevel): void {
    this._logger.log(logLevel, message);
  }

  public log(logLevel: LogLevel, message: string) {
    this._logger.log(logLevel, message);
  }

  public verbose(message: string): void {
    this._logger.verbose(message);
  }

  public silly(message: string): void {
    this._logger.silly(message);
  }

  public debug(message: string): void {
    this._logger.debug(message);
  }

  public error(message: string): void {
    this._logger.error(message);
  }

  public http(message: string): void {
    this._logger.http(message);
  }

  public warn(message: string): void {
    this._logger.warn(message);
  }

  public info(message: string): void {
    this._logger.info(message);
  }

  public success(message: string): void {
    this._logger.info(`✅  ${message}`)
  }
}

// -----------------------------------------------------------------------------
// Logger Factory (Singleton Manager)
// -----------------------------------------------------------------------------
/**
 * Factory for creating and managing the application logger singleton.
 * 
 * @example
 * ```ts
 * // In your app entry point (index.ts, main.ts)
 * import { LoggerFactory } from './logging/logger';
 * 
 * LoggerFactory.CreateLogger("debug", "logs/app.csv");
 * 
 * // In other files
 * import { LoggerFactory } from './logging/logger';
 * 
 * const logger = LoggerFactory.GetLogger();
 * logger.info("Service started");
 * logger.error("Something went wrong");
 * ```
 */
export class LoggerFactory {
  private static instance: Logger | null = null;

  static #printedNoLogger = false;

  /**
   * Creates the singleton logger instance.
   * 
   * @param level - Minimum log level (default: "info")
   * @param logFileName - Optional CSV file path for file logging
   * @returns The logger instance
   * @throws Error if logger has already been created
   */
  public static CreateLogger(level: LogLevel = "info", logFileName?: string): Logger {
    if (this.instance) {
      throw new Error(
        "Logger already initialized. Use LoggerFactory.GetLogger() to access the existing instance."
      );
    }

    this.instance = new Logger(level, logFileName);
    return this.instance;
  }

  /**
   * Gets the singleton logger instance.
   * 
   * @returns The logger instance
   * @throws Error if logger hasn't been created yet
   */
  public static GetLogger(): Logger {
    if (!this.instance) {
      throw new Error(
        "Logger not initialized. Call LoggerFactory.CreateLogger() first."
      );
    }

    return this.instance;
  }

  /**
   * Checks if the logger has been initialized.
   * 
   * @returns true if logger exists
   */
  public static HasLogger(): boolean {
    return this.instance !== null;
  }

  /**
   * Resets the logger instance (useful for testing).
   * 
   * @internal
   */
  public static Reset(): void {
    this.instance = null;
  }
}
