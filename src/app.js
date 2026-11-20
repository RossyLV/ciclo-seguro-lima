// Interfaz de CicloSeguro Lima (Sprint 2). La lógica de cálculo vive en core.js (probada con tests); aquí solo se dibuja.
import * as api from "./api.js";
import { CONFIG } from "./config.js";
import { escapeHtml, routeScore, classify, recommendRoutes, filterByDistrict, validateSignup } from "./core.js";

const COLORS = { verde: "#1e9e4a", amarillo: "#e0a800", rojo: "#d63031" };
const LIMA_CENTER = [-12.1046, -77.0300];

const state = { routes: [], incidents: [], parkings: [], districts: [], user: null, point: null };
const $ = (id) => document.getElementById(id);

const map = L.map("map").setView(LIMA_CENTER, 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
const layers = { routes: L.layerGroup().addTo(map) };

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
        `<br>Nivel: ${level}`)
      .addTo(layers.routes);
  }
}

function redraw() { drawRoutes(); }

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
  document.querySelectorAll(".tab").forEach((t) => (t.hidden = !["rutas"].includes(t.dataset.tab)));
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.id !== "tab-" + t.dataset.tab));
  }));
  $("btn-search").onclick = onSearch;
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
  $("district-filter").onchange = drawRoutes;
  renderAuth();
  redraw();
}

main();
