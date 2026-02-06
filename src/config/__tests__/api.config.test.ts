import { describe, expect, test } from "bun:test";
import { zApiConfig } from "../modules/api";

describe("API config", () => {
  test("applies defaults", () => {
    const cfg = zApiConfig.parse({
      API_HOST: "example.com",
    });

    expect(cfg.API_PROTOCOL).toBe("https");
    expect(cfg.API_HTTP_PORT).toBe(80);
    expect(cfg.API_HTTPS_PORT).toBe(443);
  });

  test("parses string ports", () => {
    const cfg = zApiConfig.parse({
      API_HOST: "example.com",
      API_HTTP_PORT: "8080",
      API_HTTPS_PORT: "8443",
    });

    expect(cfg.API_HTTP_PORT).toBe(8080);
    expect(cfg.API_HTTPS_PORT).toBe(8443);
  });

  test("rejects invalid ports", () => {
    expect(() =>
      zApiConfig.parse({
        API_HOST: "example.com",
        API_HTTP_PORT: "99999",
      })
    ).toThrow();
  });

  test("requires API_HOST", () => {
    expect(() => zApiConfig.parse({})).toThrow();
  });
});
