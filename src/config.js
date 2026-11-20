// Configuración por defecto (modo demostración). En el pipeline, scripts/build.mjs genera dist/src/config.js
// con SUPABASE_URL y SUPABASE_ANON_KEY tomados de los secrets de GitHub (nunca se suben al repositorio).
export const CONFIG = { supabaseUrl: "", supabaseAnonKey: "", version: "dev" };
