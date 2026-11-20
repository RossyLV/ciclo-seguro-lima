// Interfaz de CicloSeguro Lima. La lógica de cálculo vive en core.js (probada con tests); aquí solo se dibuja.
import * as api from "./api.js";
import { CONFIG } from "./config.js";
import {
  INCIDENT_TYPES, INCIDENT_LABELS, escapeHtml, routeScore, classify, recommendRoutes, recentIncidents,
  nearestParkings, averageRating, isValidRating, statsByDistrict, filterByDistrict, validateReport, validateSignup,
} from "./core.js";

const COLORS = { verde: "#1e9e4a", amarillo: "#e0a800", rojo: "#d63031" };
const ICONS = { robo: "🚨", accidente: "💥", invasion: "🚗", mal_estado: "🕳️" };
const LIMA_CENTER = [-12.1046, -77.0300];

const state = { routes: [], incidents: [], parkings: [], districts: [], user: null, point: null };
const $ = (id) => document.getElementById(id);

const map = L.map("map").setView(LIMA_CENTER, 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
const layers = { routes: L.layerGroup().addTo(map), incidents: L.layerGroup().addTo(map), parkings: L.layerGroup().addTo(map), pick: L.layerGroup().addTo(map) };

// ---------- Utilidades de UI ----------
function options(select, values, labels = {}, first) {
  select.innerHTML = (first ? `<option value="">${escapeHtml(first)}</option>` : "") +
    values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(labels[v] ?? v)}</option>`).join("");
}
function msg(el, text, ok = false) { el.textContent = text; el.className = "msg " + (ok ? "ok" : "error"); }

// ---------- Dibujo del mapa (US-01, US-02, US-04, US-07) ----------
function drawRoutes() {
  layers.routes.clearLayers();
  const district = $("district-filter").value;
  for (const r of filterByDistrict(state.routes, district)) {
    const score = routeScore(r, state.incidents);
    const level = classify(score);
    L.polyline(r.coords, { color: COLORS[level], weight: 6, opacity: 0.85 })
      .bindPopup(`<b>${escapeHtml(r.name)}</b><br>Distritos: ${escapeHtml(r.districts.join(", "))}` +
        `<br>Tipo de vía: ${escapeHtml(r.lane_type)} · Estado: ${escapeHtml(r.condition)}` +
        `<br>Puntaje de seguridad: <b>${score}/100</b> (${level})`)
      .addTo(layers.routes);
  }
}

function drawIncidents() {
  layers.incidents.clearLayers();
  for (const i of recentIncidents(state.incidents)) {
    const div = document.createElement("div");
    div.innerHTML = `<b>${ICONS[i.type]} ${escapeHtml(INCIDENT_LABELS[i.type])}</b><br>${escapeHtml(i.description)}` +
      `<br><small>${new Date(i.created_at).toLocaleDateString("es-PE")} · ${escapeHtml(i.district ?? "")} · ` +
      `${i.confirmations ?? 0} confirmaciones</small><br>`;
    const btn = document.createElement("button");
    btn.textContent = "Confirmar";
    btn.onclick = () => onConfirm(i, btn);
    div.appendChild(btn);
    L.marker([i.lat, i.lng], { icon: L.divIcon({ className: "inc-icon", html: ICONS[i.type], iconSize: [26, 26] }) })
      .bindPopup(div).addTo(layers.incidents);
  }
}

function parkingPopup(p) {
  const avg = averageRating(p.ratings ?? []);
  const div = document.createElement("div");
  div.innerHTML = `<b>🅿️ ${escapeHtml(p.name)}</b> (${escapeHtml(p.district)})<br>` +
    `Vigilancia: ${p.surveillance ? "Sí" : "No"} · Techado: ${p.covered ? "Sí" : "No"}<br>` +
    `Capacidad: ${Number(p.capacity)} · Tarifa: ${escapeHtml(p.fee)}<br>` +
    `Calificación: ${avg === null ? "sin calificaciones" : avg + " ★"} (${(p.ratings ?? []).length})<br>`;
  const sel = document.createElement("select");
  options(sel, ["5", "4", "3", "2", "1"], { 5: "★★★★★", 4: "★★★★", 3: "★★★", 2: "★★", 1: "★" });
  const btn = document.createElement("button");
  btn.textContent = "Calificar";
  btn.onclick = () => onRate(p, Number(sel.value), btn);
  div.append(sel, btn);
  return div;
}

function drawParkings() {
  layers.parkings.clearLayers();
  for (const p of state.parkings) {
    L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "park-icon", html: "🅿️", iconSize: [24, 24] }) })
      .bindPopup(() => parkingPopup(p)).addTo(layers.parkings);
  }
}

function drawStats() {
  const rows = statsByDistrict(recentIncidents(state.incidents));
  $("stats").innerHTML = rows.length === 0 ? "<p>No hay incidentes recientes.</p>" :
    `<table><thead><tr><th>Distrito</th><th>Total</th>${INCIDENT_TYPES.map((t) => `<th>${ICONS[t]}</th>`).join("")}</tr></thead><tbody>` +
    rows.map((r) => `<tr><td>${escapeHtml(r.district)}</td><td><b>${r.total}</b></td>` +
      INCIDENT_TYPES.map((t) => `<td>${r.byType[t] ?? 0}</td>`).join("") + "</tr>").join("") +
    `</tbody></table><p class="hint">Últimos 30 días. ${INCIDENT_TYPES.map((t) => ICONS[t] + " " + INCIDENT_LABELS[t]).join(" · ")}</p>`;
}

function redraw() { drawRoutes(); drawIncidents(); drawParkings(); drawStats(); }

// ---------- Acciones ----------
function onSearch() {
  const res = recommendRoutes(state.routes, state.incidents, $("origin").value, $("destination").value);
  const box = $("route-results");
  if (!$("origin").value || !$("destination").value) return (box.innerHTML = "<p class='msg error'>Elige origen y destino.</p>");
  if (res.length === 0) return (box.innerHTML = "<p class='msg error'>No hay ciclovías que conecten ambos distritos.</p>");
  box.innerHTML = res.map((r, i) => `<div class="card ${r.level}"><b>${i + 1}. ${escapeHtml(r.name)}</b>` +
    `<span class="score">${r.score}/100</span><br><small>${escapeHtml(r.lane_type)} · ${escapeHtml(r.condition)}</small></div>`).join("");
  map.fitBounds(L.polyline(res[0].coords).getBounds(), { padding: [40, 40] });
}

async function onReport(e) {
  e.preventDefault();
  const out = $("report-msg");
  if (!state.user && api.isOnline) return msg(out, "Debes iniciar sesión para reportar.");
  const { ok, errors, clean } = validateReport({
    type: $("report-type").value, lat: state.point?.lat, lng: state.point?.lng, description: $("report-desc").value,
  });
  if (!ok) return msg(out, errors.join(" "));
  try {
    const saved = await api.createIncident({ ...clean, district: $("report-district").value || null });
    state.incidents = [{ ...saved, confirmations: 0 }, ...state.incidents.filter((i) => i.id !== saved.id)];
    redraw();
    $("report-form").reset();
    layers.pick.clearLayers();
    state.point = null;
    $("report-point").textContent = "Ubicación: sin marcar";
    msg(out, "¡Gracias! Tu reporte fue publicado.", true);
  } catch (err) { msg(out, "No se pudo guardar: " + err.message); }
}

async function onConfirm(inc, btn) {
  if (!state.user && api.isOnline) return (btn.textContent = "Inicia sesión");
  try {
    await api.confirmIncident(inc.id);
    inc.confirmations = (inc.confirmations ?? 0) + 1;
    btn.textContent = "¡Confirmado!";
    btn.disabled = true;
    drawRoutes();
  } catch (err) { btn.textContent = err.message; btn.disabled = true; }
}

async function onRate(p, stars, btn) {
  if (!state.user && api.isOnline) return (btn.textContent = "Inicia sesión");
  if (!isValidRating(stars)) return (btn.textContent = "Valor inválido");
  try {
    await api.rateParking(p.id, stars);
    p.ratings = [...(p.ratings ?? []), stars];
    btn.textContent = "¡Gracias!";
    btn.disabled = true;
  } catch (err) { btn.textContent = err.message; }
}

function onParkings() {
  const point = state.point ?? { lat: map.getCenter().lat, lng: map.getCenter().lng };
  const list = nearestParkings(state.parkings, point, 5);
  $("parking-results").innerHTML = list.map((p, i) => `<div class="card"><b>${i + 1}. ${escapeHtml(p.name)}</b>` +
    `<span class="score">${p.distance} m</span><br><small>${p.surveillance ? "Vigilado" : "Sin vigilancia"} · ` +
    `${p.covered ? "Techado" : "Al aire libre"} · ${escapeHtml(p.fee)}</small></div>`).join("");
}

// ---------- Autenticación (US-15, US-16) ----------
function renderAuth() {
  const bar = $("auth-bar");
  bar.innerHTML = "";
  if (state.user) {
    const span = document.createElement("span");
    span.textContent = state.user.email;
    const out = document.createElement("button");
    out.textContent = "Salir";
    out.onclick = async () => { await api.signOut(); state.user = null; renderAuth(); };
    bar.append(span, out);
  } else {
    for (const [mode, label] of [["login", "Ingresar"], ["signup", "Crear cuenta"]]) {
      const b = document.createElement("button");
      b.textContent = label;
      b.onclick = () => openAuth(mode);
      bar.append(b);
    }
  }
}

let authMode = "login";
function openAuth(mode) {
  authMode = mode;
  $("auth-title").textContent = $("auth-submit").textContent = mode === "login" ? "Ingresar" : "Crear cuenta";
  $("auth-msg").textContent = "";
  $("auth-dialog").showModal();
}

async function onAuthSubmit(e) {
  if (e.submitter?.value === "cancel") return;
  e.preventDefault();
  const email = $("auth-email").value.trim(), password = $("auth-password").value;
  const errors = authMode === "signup" ? validateSignup(email, password) : (email && password ? [] : ["Completa correo y contraseña."]);
  if (errors.length) return msg($("auth-msg"), errors.join(" "));
  try {
    const user = authMode === "signup" ? await api.signUp(email, password) : await api.signIn(email, password);
    if (authMode === "signup" && !user?.confirmed_at && !user?.email_confirmed_at) {
      return msg($("auth-msg"), "Cuenta creada. Revisa tu correo para confirmarla y luego ingresa.", true);
    }
    state.user = user;
    $("auth-dialog").close();
    renderAuth();
  } catch (err) { msg($("auth-msg"), err.message); }
}

// ---------- Inicio ----------
async function main() {
  $("version").textContent = CONFIG.version;
  if (!api.isOnline) {
    const b = $("mode-banner");
    b.hidden = false;
    b.textContent = "Modo demostración: datos de ejemplo, sin base de datos conectada.";
  }
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.id !== "tab-" + t.dataset.tab));
  }));
  map.on("click", (e) => {
    state.point = { lat: e.latlng.lat, lng: e.latlng.lng };
    layers.pick.clearLayers();
    L.circleMarker(e.latlng, { radius: 8, color: "#0b5cff" }).addTo(layers.pick);
    $("report-point").textContent = `Ubicación: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
  });
  $("btn-search").onclick = onSearch;
  $("btn-parkings").onclick = onParkings;
  $("report-form").addEventListener("submit", onReport);
  $("auth-form").addEventListener("submit", onAuthSubmit);

  try {
    await api.init();
    Object.assign(state, await api.loadData());
  } catch (err) {
    const b = $("mode-banner");
    b.hidden = false;
    b.textContent = "No se pudo conectar con la base de datos: " + err.message;
  }
  options($("origin"), state.districts, {}, "Elige origen");
  options($("destination"), state.districts, {}, "Elige destino");
  options($("district-filter"), state.districts, {}, "Todos");
  options($("report-district"), state.districts, {}, "Distrito (opcional)");
  options($("report-type"), INCIDENT_TYPES, INCIDENT_LABELS);
  $("district-filter").onchange = drawRoutes;
  renderAuth();
  redraw();
}

main();
