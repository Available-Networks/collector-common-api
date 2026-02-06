import { describe, expect, test } from "bun:test";
import { zCloudConfig } from "../modules/cloud";

describe("Cloud config", () => {
  test("applies defaults", () => {
    const cfg = zCloudConfig.parse({
      API_HOST: "example.com",
    });
  });

  test("parses string ports", () => {
    const cfg = zCloudConfig.parse({
      API_HOST: "example.com",
      API_HTTP_PORT: "8080",
      API_HTTPS_PORT: "8443",
    });

  });

  test("rejects invalid ports", () => {
    expect(() =>
      zCloudConfig.parse({
        API_HOST: "example.com",
        API_HTTP_PORT: "99999",
      })
    ).toThrow();
  });

  test("requires API_HOST", () => {
    expect(() => zCloudConfig.parse({})).toThrow();
  });
});
