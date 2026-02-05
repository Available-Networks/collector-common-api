import { zCollectorConfig, type CollectorConfig } from "./collectorConfig";
import { zCloudConfig, type CloudConfig } from "./cloudConfig";
import { zBaseConfig, type BaseConfig } from "./baseConfig";
import z from "zod";

export {
    zCollectorConfig, type CollectorConfig,
    zCloudConfig, type CloudConfig,
    zBaseConfig, type BaseConfig,
}

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

// Enums
const LogLevels = [
  "error",
  "warn",
  "info",
  "http",
  "verbose",
  "debug",
  "silly",
] as const;

const NodeEnvs = [
  "development",
  "production",
  "test",
  "staging",
] as const;

const ServiceLocations = [
  "site", 
  "global"
] as const;

const CloudClients = [
    "aws_s3"
] as const;

export const zCloudClientsList = z
  .string()
  .transform((str) => str.split(",").map(s => s.trim())) // split string into array
  .refine((arr) => arr.every((c) => CloudClients.includes(c as any)), {
    message: "Invalid cloud client specified",
  })
  .transform((arr) => arr.map((c) => zCloudClients.parse(c))); // parse each item

export const zCloudClients = z.enum(CloudClients).default("aws_s3");
export type CloudClient = z.infer<typeof zCloudClients>;

export const zLogLevels = z.enum(LogLevels).default("info");
export type LogLevel = z.infer<typeof zLogLevels>;

export const zNodeEnvs = z.enum(NodeEnvs).default("development");
export type NodeEnv = z.infer<typeof zNodeEnvs>;

export const zServiceLocations = z.enum(ServiceLocations).default("global");
export type ServiceLocation = z.infer<typeof zServiceLocations>;


// Primitives
export const zPort = z
    .string()
    .default("")
    .transform((val: string) => parseInt(val!, 10))
    .refine((val: number) => !isNaN(val) && val > 0 && val <= 65535, {
        message: "Invalid port number"
    })

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

