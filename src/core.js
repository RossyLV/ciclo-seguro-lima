// Lógica de negocio de CicloSeguro Lima: funciones puras (sin DOM ni red) para poder probarlas.

export const INCIDENT_TYPES = ["robo", "accidente", "invasion", "mal_estado"];
export const INCIDENT_LABELS = { robo: "Robo", accidente: "Accidente", invasion: "Invasión de ciclovía", mal_estado: "Tramo en mal estado" };
// Gravedad: cuántos puntos resta cada tipo de incidente al puntaje de seguridad de una ruta.
export const INCIDENT_WEIGHT = { robo: 15, accidente: 12, invasion: 6, mal_estado: 5 };
// Caja geográfica aproximada de Lima Metropolitana (valida que el reporte esté en Lima).
export const LIMA_BOUNDS = { minLat: -12.30, maxLat: -11.75, minLng: -77.20, maxLng: -76.80 };
export const LANE_BASE = { segregada: 95, senalizada: 78, compartida: 62 };
export const CONDITION_PENALTY = { bueno: 0, regular: 8, malo: 20, invadido: 15 };
export const NEAR_METERS = 150;       // radio en que un incidente afecta a una ruta
export const MAX_INCIDENT_AGE_DAYS = 30; // incidentes "recientes"
export const MAX_INCIDENT_PENALTY = 60;

const DAY_MS = 86_400_000;

/** Escapa texto para insertarlo como HTML (evita XSS con descripciones escritas por usuarios). */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Distancia en metros entre dos puntos {lat,lng} (fórmula de haversine). */
export function haversine(a, b) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distancia mínima (m) de un punto a una polilínea [[lat,lng],...], proyectando a plano local. */
export function distanceToPolyline(point, coords) {
  if (!coords || coords.length === 0) return Infinity;
  if (coords.length === 1) return haversine(point, { lat: coords[0][0], lng: coords[0][1] });
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((point.lat * Math.PI) / 180);
  const px = point.lng * mPerDegLng, py = point.lat * mPerDegLat;
  let best = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const ax = coords[i][1] * mPerDegLng, ay = coords[i][0] * mPerDegLat;
    const bx = coords[i + 1][1] * mPerDegLng, by = coords[i + 1][0] * mPerDegLat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

export function isValidEmail(email) {
  return typeof email === "string" && email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email.trim());
}

/** Valida un reporte antes de enviarlo. Devuelve { ok, errors, clean }. */
export function validateReport(report) {
  const errors = [];
  const r = report ?? {};
  if (!INCIDENT_TYPES.includes(r.type)) errors.push("Elige un tipo de incidente válido.");
  const lat = Number(r.lat), lng = Number(r.lng);
  const inLima = Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= LIMA_BOUNDS.minLat && lat <= LIMA_BOUNDS.maxLat && lng >= LIMA_BOUNDS.minLng && lng <= LIMA_BOUNDS.maxLng;
  if (!inLima) errors.push("La ubicación debe estar dentro de Lima.");
  const description = String(r.description ?? "").trim();
  if (description.length < 10 || description.length > 300) errors.push("La descripción debe tener entre 10 y 300 caracteres.");
  return { ok: errors.length === 0, errors, clean: { type: r.type, lat, lng, description } };
}

/** Incidentes publicados de los últimos `days` días. */
export function recentIncidents(incidents, now = new Date(), days = MAX_INCIDENT_AGE_DAYS) {
  return incidents.filter((i) => {
    if (i.status && i.status !== "publicado") return false;
    const age = (now - new Date(i.created_at)) / DAY_MS;
    return age >= 0 && age <= days;
  });
}

/** Peso por antigüedad: 1 si es de hoy y baja linealmente hasta 0.3 a los 30 días. */
export function recencyFactor(createdAt, now = new Date()) {
  const age = Math.max(0, (now - new Date(createdAt)) / DAY_MS);
  return Math.max(0.3, 1 - (age / MAX_INCIDENT_AGE_DAYS) * 0.7);
}

/** Puntaje de seguridad 0-100 de una ruta (US-02, US-08). */
export function routeScore(route, incidents, now = new Date()) {
  const base = LANE_BASE[route.lane_type] ?? 60;
  const conditionPenalty = CONDITION_PENALTY[route.condition] ?? 0;
  let incidentPenalty = 0;
  for (const inc of recentIncidents(incidents, now)) {
    if (distanceToPolyline({ lat: inc.lat, lng: inc.lng }, route.coords) <= NEAR_METERS) {
      incidentPenalty += (INCIDENT_WEIGHT[inc.type] ?? 0) * recencyFactor(inc.created_at, now) * (1 + Math.min(inc.confirmations ?? 0, 5) * 0.1);
    }
  }
  incidentPenalty = Math.min(incidentPenalty, MAX_INCIDENT_PENALTY);
  return Math.max(0, Math.min(100, Math.round(base - conditionPenalty - incidentPenalty)));
}

/** Color semáforo según el puntaje. */
export function classify(score) {
  if (score >= 75) return "verde";
  if (score >= 50) return "amarillo";
  return "rojo";
}

/** Rutas que conectan origen y destino, ordenadas de más a menos seguras (US-03). */
export function recommendRoutes(routes, incidents, origin, destination, now = new Date()) {
  if (!origin || !destination || origin === destination) return [];
  return routes
    .filter((r) => r.districts.includes(origin) && r.districts.includes(destination))
    .map((r) => ({ ...r, score: routeScore(r, incidents, now) }))
    .map((r) => ({ ...r, level: classify(r.score) }))
    .sort((a, b) => b.score - a.score);
}

/** Filtra rutas por distrito (US-05). "" o null devuelve todas. */
export function filterByDistrict(routes, district) {
  return district ? routes.filter((r) => r.districts.includes(district)) : routes;
}

/** Contraseña mínima de 8 caracteres con al menos una letra y un número (US-15). */
export function isValidPassword(pw) {
  return typeof pw === "string" && pw.length >= 8 && pw.length <= 72 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

/** Valida el formulario de registro. Devuelve lista de errores (vacía si está bien). */
export function validateSignup(email, password) {
  const errors = [];
  if (!isValidEmail(email)) errors.push("Correo no válido.");
  if (!isValidPassword(password)) errors.push("La contraseña debe tener al menos 8 caracteres, con letras y números.");
  return errors;
}
