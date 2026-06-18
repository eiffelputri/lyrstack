// source checks
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");

function walk(dir, exts) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

const srcFiles = walk(path.join(ROOT, "src"), [".js", ".css"]);
const shipped = [...srcFiles, path.join(ROOT, "index.html")];
const read = (f) => fs.readFileSync(f, "utf8");
const rel = (f) => path.relative(ROOT, f);

function findings(files, re) {
  return files.flatMap((f) =>
    read(f)
      .split("\n")
      .map((line, i) => (re.test(line) ? `${rel(f)}:${i + 1}: ${line.trim()}` : null))
      .filter(Boolean)
  );
}

describe("no dangerous DOM / code-execution sinks", () => {
  it.each([
    ["eval()", /\beval\s*\(/],
    ["new Function", /\bnew\s+Function\b/],
    ["string setTimeout/setInterval", /\bset(Timeout|Interval)\s*\(\s*["'`]/],
    ["innerHTML / outerHTML", /\.(inner|outer)HTML\b/],
    ["insertAdjacentHTML", /insertAdjacentHTML/],
    ["document.write", /document\.write/],
    ["javascript: URL", /javascript:/i],
  ])("src has no %s", (_, re) => {
    expect(findings(srcFiles, re)).toEqual([]);
  });

  it("index.html has no inline event handlers or inline scripts", () => {
    const html = read(path.join(ROOT, "index.html"));
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    for (const [, attrs, body] of scripts) {
      expect(attrs).toMatch(/\bsrc=/);
      expect(body.trim()).toBe("");
    }
  });
});

describe("no hard-coded secrets", () => {
  it.each([
    ["TextAlive token literal", /token\s*[:=]\s*["'`][A-Za-z0-9_-]{8,}["'`]/i],
    ["AWS access key", /AKIA[0-9A-Z]{16}/],
    ["GitHub token", /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/],
    ["Slack token", /xox[baprs]-[A-Za-z0-9-]{10,}/],
    ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ])("shipped source has no %s", (_, re) => {
    expect(findings(shipped, re)).toEqual([]);
  });

  it("the app token is only read from the environment", () => {
    const player = read(path.join(ROOT, "src/app/player.js"));
    expect(player).toMatch(/from "\.\.\/config\/app\.js"/);
    const app = read(path.join(ROOT, "src/config/app.js"));
    expect(app).toMatch(/import\.meta\.env\.VITE_TEXTALIVE_APP_TOKEN/);
  });

  it(".env.example carries no real value", () => {
    const example = read(path.join(ROOT, ".env.example"));
    for (const line of example.split("\n")) {
      if (line.startsWith("#") || !line.includes("=")) continue;
      expect(line.split("=")[1].trim()).toBe("");
    }
  });
});

describe("transport security", () => {
  it("song + lyric URLs are https", async () => {
    const { SONGS } = await import("../../src/config/songs.js");
    expect(SONGS).toHaveLength(6);
    for (const s of SONGS) {
      expect(s.songUrl).toMatch(/^https:\/\/piapro\.jp\//);
      expect(s.lyricsUrl).toMatch(/^https:\/\/piapro\.jp\//);
    }
  });

  it("no plain http:// URLs in shipped source", () => {
    // w3.org and localhost are fine
    const hits = findings(shipped, /http:\/\/(?!www\.w3\.org|localhost)/);
    expect(hits).toEqual([]);
  });
});
