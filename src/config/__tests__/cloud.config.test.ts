import { describe, expect, test } from "bun:test";
import { zCloudConfig } from "../modules/cloud";

describe("Cloud config", () => {
  test("rejects invalid cloud providers", () => {
    expect(() => zCloudConfig.parse({
      API_HOST: "example.com",
      CLOUD_PROVIDERS: "aws_sd3",
      AWS_ACCESS_KEY_ID: "test",
      AWS_SECRET_ACCESS_KEY: "test",
      AWS_S3_BUCKET_NAME: "test",
      AWS_REGION: "us-east-2"
    })).toThrow();
  });

  test("requires API_HOST", () => {
    expect(() => zCloudConfig.parse({})).toThrow();
  });
});
