import { describe, expect, test } from "bun:test";
import { zBaseConfig } from "../modules/base";

describe("Base config", () => {
  test("applies defaults", () => {
    const cfg = zBaseConfig.parse({
      SERVICE_NAME: "collector",
    });

    expect(cfg.LOG_LEVEL).toBe("debug");
    expect(cfg.NODE_ENV).toBe("development");
    expect(cfg.SERVICE_LOCATION).toBe("site");
  });

  test("requires service name", () => {
    expect(() => zBaseConfig.parse({})).toThrow();
  });
});
