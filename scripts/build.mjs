// Build: valida la sintaxis de los módulos, copia los archivos estáticos a dist/ y genera config.js desde variables de entorno.
import { cpSync, mkdirSync, rmSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const out = "dist";
rmSync(out, { recursive: true, force: true });
mkdirSync(out);

// 1) "Compilación": node --check en cada archivo JS (falla el build si hay errores de sintaxis).
function jsFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? jsFiles(p) : p.endsWith(".js") ? [p] : [];
  });
}
for (const f of jsFiles("src")) execFileSync(process.execPath, ["--check", f], { stdio: "inherit" });

// 2) Copia de archivos estáticos.
for (const f of ["index.html", "styles.css", "src"]) cpSync(f, join(out, f), { recursive: true });

// 3) Configuración del entorno. La URL y la clave anon de Supabase son públicas por diseño (protegidas por RLS).
const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_ANON_KEY ?? "";
if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) throw new Error("SUPABASE_URL inválida");
const version = (process.env.GITHUB_SHA ?? "local").slice(0, 7);
writeFileSync(join(out, "src/config.js"),
  `export const CONFIG = ${JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key, version })};\n`);
writeFileSync(join(out, ".nojekyll"), "");
console.log(`Build OK -> ${out}/ (versión ${version}, modo ${url ? "Supabase" : "demostración"})`);
