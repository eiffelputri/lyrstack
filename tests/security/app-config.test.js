import { afterEach, describe, expect, it, vi } from "vitest";

async function loadWithToken(value) {
  vi.resetModules();
  vi.stubEnv("VITE_TEXTALIVE_APP_TOKEN", value);
  return import("../../src/config/app.js");
}

afterEach(() => vi.unstubAllEnvs());

describe("TextAlive app token config", () => {
  it("accepts a normal token", async () => {
    const { APP_TOKEN } = await loadWithToken("AbCdEf123456_-xy");
    expect(APP_TOKEN).toBe("AbCdEf123456_-xy");
  });

  it("trims surrounding whitespace", async () => {
    const { APP_TOKEN } = await loadWithToken("  AbCdEf123456  ");
    expect(APP_TOKEN).toBe("AbCdEf123456");
  });

  it.each([
    [""],
    ["short"],
    ["has space inside"],
    ['"><script>alert(1)</script>'],
    ["a".repeat(200)],
    ["token\nX-Injected: 1"],
  ])("rejects malformed token %j", async (value) => {
    const { APP_TOKEN } = await loadWithToken(value);
    expect(APP_TOKEN).toBe("");
  });
});
