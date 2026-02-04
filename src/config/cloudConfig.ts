import z from "zod";

// Cloud clients available
const CloudProviders = ["aws_s3", "gcp"] as const;
export const zCloudProvider = z.enum(CloudProviders);
export type CloudProvider = z.infer<typeof zCloudProvider>;

export const zCloudConfig = z.object({
  CLOUD_PROVIDERS: z.preprocess((val) => {
    if (typeof val === "string" && val.trim() !== "") return val.split(",").map(s => s.trim());
    if (Array.isArray(val) && val.length > 0) return val;
    return undefined; // treat missing or empty as undefined
  }, z.array(zCloudProvider).nonempty({ message: "At least one cloud provider must be specified" })),

  // AWS-specific
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_S3_BUCKET_NAME: z.string().optional(),
  AWS_REGION: z.string().optional(),

  // GCP placeholders
  GCP_PROJECT_ID: z.string().optional(),
  GCP_KEY_FILE: z.string().optional(),
});

export type CloudConfig = z.infer<typeof zCloudConfig>;
