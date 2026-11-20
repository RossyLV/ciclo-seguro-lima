// Prueba de integración del build (US-18, US-20): genera dist/ y verifica que el sitio queda listo para desplegar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

test("el build genera dist/ con index, módulos y config sin secretos", () => {
  execFileSync(process.execPath, ["scripts/build.mjs"], { env: { ...process.env, SUPABASE_URL: "", SUPABASE_ANON_KEY: "" } });
  for (const f of ["dist/index.html", "dist/styles.css", "dist/src/app.js", "dist/src/core.js", "dist/src/api.js", "dist/src/config.js"]) {
    assert.ok(existsSync(f), `falta ${f}`);
  }
  const cfg = readFileSync("dist/src/config.js", "utf8");
  assert.match(cfg, /"supabaseAnonKey":""/);
});

test("index.html define Content-Security-Policy", () => {
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /object-src 'none'/);
});

test("el build rechaza una SUPABASE_URL que no sea de supabase.co", () => {
  assert.throws(() => execFileSync(process.execPath, ["scripts/build.mjs"], {
    env: { ...process.env, SUPABASE_URL: "http://sitio-malicioso.com" }, stdio: "pipe",
  }));
});
