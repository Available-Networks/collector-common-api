import { zCollectorConfig, type CollectorConfig } from "./collector";
import type { CloudConfig, BaseConfig, ApiConfig } from "./modules";

import z from "zod";

export { zCollectorConfig };

// singleton storage
let _config: CollectorConfig | null = null;

/**
 * Normalize environment variables:
 * - "" becomes undefined
 * - preserve undefined
 */
function normalizeEnv(env: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(env).map(([k, v]) => [k, v === "" ? undefined : v])
  );
}

/**
 * Load config and store globally
 * Crashes immediately if invalid
 */
function buildConfig<T extends z.ZodTypeAny = typeof zCollectorConfig>(
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
    console.error("Invalid configuration:\n" + message);
    process.exit(1); // fail-fast
  }

  _config = Object.freeze(result.data) as any;
  
  return
}

/**
 * Getter for global config
 * Throws if loadConfig() was not called
 */
function getConfig<T>(): T {
  if (!_config) {
    throw new Error("Config has not been built yet. Call buildConfig() first.");
  }

  return _config as T;
}

// Only expose types + loader/getter
export type { CollectorConfig, BaseConfig, CloudConfig, ApiConfig };
export { buildConfig, getConfig };


export const StrictlyParseConfig = <T>(schema: z.ZodType<T>, data: unknown): T | null => {
    const result = schema.safeParse(data);
    if(!result.success) {
        const err = result.error.issues
            .map((issue) => `- [${issue.path.join(".")}] ${issue.message}`)
            .join("\n");

        console.error(`Invalid or missing configuration variables:\n${err}`)
        return null;
    }

    return result.data;
}

// export const zCloudClientsList = z
//   .string()
//   .transform((str) => str.split(",").map(s => s.trim())) // split string into array
//   .refine((arr) => arr.every((c) => CloudClient.includes(c as any)), {
//     message: "Invalid cloud client specified",
//   })
//   .transform((arr) => arr.map((c) => z.enum(CloudClient).parse(c))); // parse each item

export const zOptionalString = z.string().optional();
export const zValidString = z.string().min(1);
export const zValidNumber = z.string()
    .transform(v => parseInt(v))
    .refine(num => !isNaN(num) && num > 0);
export const zYesNoBoolean = z.enum(["yes", "no"])
    .optional()
    .transform((v) => v === "yes");
export const zOptionalDate = z
    .preprocess(
        (val: any) => {
            return val === undefined || val === null ? undefined : new Date(val)
        },
        z.date().optional()
    )
export const zValidDate = z
    .preprocess(
        (val: any) => {
            return val === undefined || val === null ? undefined : new Date(val)
        },
        z.date()
    )
    
export const zAwsRegionString = zValidString.regex(/^\w{2}-[a-z]+-\d$/, {
    message: "Invalid AWS region format (e.g. us-east-1, eu-west-1)"
})

