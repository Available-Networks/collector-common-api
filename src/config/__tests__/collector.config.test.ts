import { describe, expect, test } from "bun:test";
import { zCollectorConfig } from '../collector';

describe("Collector config", () => {
  test("full config parses", () => {
    const cfg = zCollectorConfig.parse({
      SERVICE_NAME: "collector",
      CLOUD_PROVIDERS: "aws_s3",
      API_HOST: "localhost",
      API_PROTOCOL: "http"
    });

    expect(cfg.API_HTTP_PORT).toBe(80);
    expect(cfg.LOG_LEVEL).toBeDefined();
  });
});
