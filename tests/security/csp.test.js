// CSP and security header test
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from "../../security.config.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DOCS = path.join(ROOT, "docs");

function parseCsp(policy) {
  const out = {};
  for (const part of policy.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) out[name] = values;
  }
  return out;
}

const csp = parseCsp(CONTENT_SECURITY_POLICY);

describe("content security policy", () => {
  it("defaults to same-origin", () => {
    expect(csp["default-src"]).toEqual(["'self'"]);
  });

  it("blocks plugins, <base> hijacking and form posts", () => {
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["form-action"]).toEqual(["'none'"]);
  });

  it("never allows inline scripts or wildcard script hosts", () => {
    const scripts = csp["script-src"];
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("*");
    expect(scripts).not.toContain("https:");
    expect(scripts).not.toContain("http:");
    expect(scripts).not.toContain("data:");
    for (const src of scripts) {
      if (src.startsWith("'")) continue;
      expect(src).toMatch(/^https:\/\/(\*\.)?(textalive\.jp|songle\.jp)$/);
    }
  });

  it("restricts fetch/XHR to TextAlive, Songle and piapro", () => {
    for (const src of csp["connect-src"]) {
      if (src === "'self'") continue;
      expect(src).toMatch(/^https:\/\/(\*\.)?(textalive\.jp|songle\.jp|piapro\.jp)$/);
    }
  });

  it("has no insecure http sources anywhere", () => {
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/http:/);
  });

  it("sets hardening headers for dev / preview servers", () => {
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBeTruthy();
    expect(SECURITY_HEADERS["Permissions-Policy"]).toMatch(/camera=\(\)/);
    expect(SECURITY_HEADERS["Permissions-Policy"]).toMatch(/microphone=\(\)/);
  });
});

describe("production build (/docs)", () => {
  const indexPath = path.join(DOCS, "index.html");
  const built = fs.existsSync(indexPath);

  it.runIf(built)("embeds the current CSP as the first <head> element", () => {
    const html = fs.readFileSync(indexPath, "utf8");
    const escaped = CONTENT_SECURITY_POLICY.replaceAll("'", "&#39;");
    const head = html.slice(html.indexOf("<head>"));
    const firstTag = head.slice(6).trim();
    expect(firstTag.startsWith('<meta http-equiv="Content-Security-Policy"')).toBe(true);
    // build must be up to date
    expect(html).toContain(`content="${escaped}"`);
  });

  it.runIf(built)("ships no source maps, env files or dev artefacts", () => {
    const files = fs.readdirSync(DOCS, { recursive: true }).map(String);
    expect(files.filter((f) => f.endsWith(".map"))).toEqual([]);
    expect(files.filter((f) => /(^|\/)\.env/.test(f))).toEqual([]);
    for (const f of files.filter((f) => f.endsWith(".js"))) {
      const js = fs.readFileSync(path.join(DOCS, f), "utf8");
      expect(js, f).not.toMatch(/sourceMappingURL=/);
      expect(js, f).not.toMatch(/\/@vite\/client/);
    }
  });

  it.runIf(built)("only loads scripts from its own origin", () => {
    const html = fs.readFileSync(indexPath, "utf8");
    for (const [, src] of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
      expect(src.startsWith("./")).toBe(true);
    }
  });
});
