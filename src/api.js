// Capa de datos: habla con Supabase (PostgreSQL + Auth) si está configurado; si no, usa datos de demostración.
// La clave "anon" de Supabase es pública por diseño: la seguridad real la dan las políticas RLS de la base de datos.
import { CONFIG } from "./config.js";
import { DEMO_ROUTES, DEMO_PARKINGS, DEMO_DISTRICTS, demoIncidents } from "./data/demo.js";

let supabase = null;
export const isOnline = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);

export async function init() {
  if (!isOnline) return;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
  supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
}

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ---------- Lectura ----------
export async function loadData() {
  if (!isOnline) {
    const user = demoUser;
    return { routes: DEMO_ROUTES, incidents: demoState.incidents, parkings: demoState.parkings, districts: DEMO_DISTRICTS, user };
  }
  const [routes, incidents, parkings, districts, session] = await Promise.all([
    supabase.from("routes").select("id,name,lane_type,condition,districts,coords").then(check),
    supabase.from("incidents_public").select("*").then(check),
    supabase.from("parkings_public").select("*").then(check),
    supabase.from("districts").select("name").order("name").then(check),
    supabase.auth.getSession(),
  ]);
  return {
    routes,
    incidents: incidents.map((i) => ({ ...i, confirmations: Number(i.confirmations ?? 0) })),
    parkings: parkings.map((p) => ({ ...p, ratings: p.ratings ?? [] })),
    districts: districts.map((d) => d.name),
    user: session.data.session?.user ?? null,
  };
}

// ---------- Autenticación (US-15, US-16) ----------
export async function signUp(email, password) {
  if (!isOnline) throw new Error("Modo demostración: el registro requiere la base de datos.");
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}
export async function signIn(email, password) {
  if (!isOnline) throw new Error("Modo demostración: el ingreso requiere la base de datos.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Correo o contraseña incorrectos.");
  return data.user;
}
export async function signOut() {
  if (isOnline) await supabase.auth.signOut();
}

// ---------- Escritura (protegida por RLS, US-17) ----------
export async function createIncident(report) {
  if (!isOnline) {
    const inc = { ...report, id: Date.now(), status: "publicado", confirmations: 0, created_at: new Date().toISOString() };
    demoState.incidents = [inc, ...demoState.incidents];
    return inc;
  }
  return check(await supabase.from("incidents").insert(report).select().single());
}

export async function confirmIncident(incidentId) {
  if (!isOnline) return;
  const { error } = await supabase.from("confirmations").insert({ incident_id: incidentId });
  if (error && error.code === "23505") throw new Error("Ya confirmaste este incidente.");
  if (error) throw new Error(error.message);
}

export async function rateParking(parkingId, stars) {
  if (!isOnline) return;
  const { error } = await supabase.from("ratings").upsert({ parking_id: parkingId, stars }, { onConflict: "parking_id,user_id" });
  if (error) throw new Error(error.message);
}

// Estado en memoria del modo demostración.
const demoUser = null;
const demoState = { incidents: demoIncidents(), parkings: DEMO_PARKINGS };
