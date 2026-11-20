// Interfaz de CicloSeguro Lima (Sprint 1): mapa de ciclovías (US-01) y autenticación (US-15, US-16).
import * as api from "./api.js";
import { CONFIG } from "./config.js";
import { escapeHtml, validateSignup } from "./core.js";

const LIMA_CENTER = [-12.1046, -77.0300];
const state = { routes: [], districts: [], user: null };
const $ = (id) => document.getElementById(id);

const map = L.map("map").setView(LIMA_CENTER, 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
const routesLayer = L.layerGroup().addTo(map);

function msg(el, text, ok = false) { el.textContent = text; el.className = "msg " + (ok ? "ok" : "error"); }

function drawRoutes() {
  routesLayer.clearLayers();
  for (const r of state.routes) {
    L.polyline(r.coords, { color: "#0b5cff", weight: 6, opacity: 0.8 })
      .bindPopup(`<b>${escapeHtml(r.name)}</b><br>Distritos: ${escapeHtml(r.districts.join(", "))}`)
      .addTo(routesLayer);
  }
}

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

async function main() {
  $("version").textContent = CONFIG.version;
  document.querySelectorAll(".tab").forEach((t) => (t.hidden = t.dataset.tab !== "rutas"));
  $("auth-form").addEventListener("submit", onAuthSubmit);
  try {
    await api.init();
    Object.assign(state, await api.loadData());
  } catch (err) {
    const b = $("mode-banner");
    b.hidden = false;
    b.textContent = "No se pudo conectar con la base de datos: " + err.message;
  }
  renderAuth();
  drawRoutes();
}

main();
