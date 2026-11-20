// Lógica de negocio de CicloSeguro Lima: funciones puras (sin DOM ni red) para poder probarlas.


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
