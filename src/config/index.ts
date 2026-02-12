import {LoggerFactory} from "../logging/logger";
import { CollectorConfig, zCollectorConfig } from "./collector";
import z from "zod";

export * from './collector';
export * from './modules';
export * from './types';


// -----------------------------------------------------------------------------
// Singleton storage
// -----------------------------------------------------------------------------
/** Holds the globally loaded CollectorConfig instance */
let _config: CollectorConfig | null = null;


// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Normalizes environment variables:
 * - Empty string `""` is converted to `undefined`
 * - `undefined` is preserved
 *
 * This ensures consistent handling of optional environment variables.
 *
 * @param env - Raw environment object (e.g., process.env)
 * @returns Normalized copy of the environment
 */
function normalizeEnv(env: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(env).map(([k, v]) => [k, v === "" ? undefined : v])
  );
}


// -----------------------------------------------------------------------------
// Configuration loader / accessor
// -----------------------------------------------------------------------------

/**
 * Builds and validates configuration from environment or provided object.
 *
 * - Validates using a Zod schema (default: `zCollectorConfig`)
 * - Normalizes environment variables
 * - Freezes the resulting config object for immutability
 * - Crashes the process immediately on invalid configuration (fail-fast)
 *
 * @param env - Optional source object, defaults to `process.env`
 * @param schema - Optional Zod schema for validation
 * @returns Validated and frozen configuration
 */
export function buildConfig<T extends z.ZodTypeAny = typeof zCollectorConfig>(
  env: Record<string, unknown> = process.env,
  schema?: T
): z.infer<T> {
  if (_config) return _config as any;

  const normalized = normalizeEnv(env);
  const usedSchema = schema ?? zCollectorConfig;
  const result = usedSchema.safeParse(normalized);

  if (!result.success) {
    const message = result.error.issues
      .map(issue => `- [${issue.path.join(".")}] ${issue.message}`)
      .join("\n");
    
    LoggerFactory.GetLogger().error("Invalid configuration:\n" + message);
    process.exit(1); // fail-fast
  }

  _config = Object.freeze(result.data) as any;
  
  return
}

/**
 * Getter for the global configuration.
 *
 * Throws if the configuration has not been built yet.
 *
 * @typeParam T - Expected type of the configuration
 * @returns The frozen configuration object
 */
export function getConfig<T>(): T {
  if (!_config) {
    throw new Error("Config has not been built yet. Call buildConfig() first.");
  }

  return _config as T;
}

// -----------------------------------------------------------------------------
// Type-safe parsing utility
// -----------------------------------------------------------------------------

/**
 * Safely parses a configuration object using a Zod schema.
 *
 * Logs errors to the console and returns `null` on invalid data instead of throwing.
 *
 * @param schema - Zod schema to validate against
 * @param data - Input data to validate
 * @returns Parsed object on success, `null` on failure
 */
export const StrictlyParseConfig = <T>(schema: z.ZodType<T>, data: unknown): T | null => {
    const result = schema.safeParse(data);
    if(!result.success) {
        const err = result.error.issues
            .map((issue) => `- [${issue.path.join(".")}] ${issue.message}`)
            .join("\n");

        LoggerFactory.GetLogger().error(`Invalid or missing configuration variables:\n${err}`)
        return null;
    }

    return result.data;
}

// -----------------------------------------------------------------------------
// Common Zod helpers
// -----------------------------------------------------------------------------

/** Optional string schema */
export const zOptionalString = z.string().optional();

/** Non-empty string schema */
export const zValidString = z.string().min(1);

/**
 * String representing a positive number.
 * Transforms to a `number` and validates > 0
 */
export const zValidNumber = z.string()
    .transform(v => parseInt(v))
    .refine(num => !isNaN(num) && num > 0);
    
/** Yes/no boolean schema; transforms "yes" → true, "no" → false */
export const zYesNoBoolean = z.enum(["yes", "no"])
    .optional()
    .transform((v) => v === "yes");

/** Optional date parser; converts valid input to Date, preserves undefined */
export const zOptionalDate = z
    .preprocess(
        (val: any) => {
            return val === undefined || val === null ? undefined : new Date(val)
        },
        z.date().optional()
    )

/** Required date parser; converts valid input to Date */
export const zValidDate = z
    .preprocess(
        (val: any) => {
            return val === undefined || val === null ? undefined : new Date(val)
        },
        z.date()
    )
    
/** AWS region string; must match pattern like "us-east-1", "eu-west-1" */
export const zAwsRegionString = zValidString.regex(/^\w{2}-[a-z]+-\d$/, {
    message: "Invalid AWS region format (e.g. us-east-1, eu-west-1)"
})
