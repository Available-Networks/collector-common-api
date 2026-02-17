import z from "zod";

import { AWS3UploadClient } from "../../cloud";
import { CloudProvider } from "../../cloud/cloudUploadClient";


/**
 * Maps each supported cloud provider to its configuration validator.
 *
 * Each validator receives the raw config and a Zod refinement context,
 * allowing provider-specific config checks to report issues.
 */
const cloudConfigValidators: Record<CloudProvider, (cfg, ctx) => void> = {
  "aws_s3": AWS3UploadClient.validateConfig
}


/**
 * Validates AWS-specific configuration at runtime.
 *
 * Intended to be used during configuration parsing (e.g. environment
 * variable validation) when `CLOUD_CLIENT` is set to `"aws_s3"`.
 *
 * Adds Zod issues for any missing required AWS fields.
 *
 * @param data - Raw configuration object (typically process.env)
 * @param ctx - Zod refinement context
 * @returns `true` if all required fields are present, otherwise `false`
 */
const validateCloudProviderInput = (val) => {
  if (typeof val === "string" && val.trim() !== "") return val.split(",").map(s => s.trim());
  if (Array.isArray(val) && val.length > 0) return val;
  return undefined; // treat missing or empty as undefined
}

/**
 * Schema for multi-cloud configuration.
 *
 * Supports:
 * - Specifying one or more cloud providers
 * - Provider-specific configuration fields (e.g., AWS credentials)
 *
 * Validation:
 * - `CLOUD_PROVIDERS` must contain at least one provider
 * - Each provider's validator is invoked to ensure required credentials
 *   or settings are present
 */
export const zCloudConfig = z.object({
  /**
   * List of cloud providers to use.
   *
   * Can be either:
   * - Comma-separated string: `"aws_s3,ibm_cloud"`
   * - Array of strings: `["aws_s3","ibm_cloud"]`
   */
  CLOUD_PROVIDERS: z.preprocess(validateCloudProviderInput, z.array(z.enum(CloudProvider))
    .nonempty({ message: "At least one cloud provider must be specified" })),

  // AWS-specific optional credentials
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_S3_BUCKET_NAME: z.string().optional(),
  AWS_REGION: z.string().optional(),
})
  .superRefine((cfg, ctx) => {
    // Run provider-specific validators
    cfg.CLOUD_PROVIDERS.forEach((provider: CloudProvider) => {
      cloudConfigValidators[provider](cfg, ctx)
    }
    );
  });


/**
 * Type for multi-cloud configuration inferred by zod
 *
 * Supports:
 * - Specifying one or more cloud providers
 * - Provider-specific configuration fields (e.g., AWS credentials)
 *
 * Validation:
 * - `CLOUD_PROVIDERS` must contain at least one provider
 * - Each provider's validator is invoked to ensure required credentials
 *   or settings are present
 */
export type CloudConfig = z.infer<typeof zCloudConfig>;
