// Pruebas unitarias de la lógica de negocio (node:test, sin dependencias externas).
// Cada bloque indica la historia de usuario cuyo criterio de aceptación verifica.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  haversine, distanceToPolyline, isValidEmail, isValidPassword, validateSignup, escapeHtml,
} from "../src/core.js";


const NOW = new Date("2026-11-20T12:00:00Z");
const daysAgo = (d) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const route = { id: 1, name: "R", lane_type: "segregada", condition: "bueno", districts: ["A", "B"], coords: [[-12.10, -77.03], [-12.11, -77.03]] };

describe("Geometría", () => {
  test("haversine: 0,01° de latitud ≈ 1,11 km", () => {
    const d = haversine({ lat: -12.10, lng: -77.03 }, { lat: -12.11, lng: -77.03 });
    assert.ok(d > 1100 && d < 1120, `distancia ${d}`);
  });
  test("distancia a polilínea: punto sobre la ruta es ~0 m", () => {
    assert.ok(distanceToPolyline({ lat: -12.105, lng: -77.03 }, route.coords) < 1);
  });
});

describe("US-15 Registro", () => {
  test("correo válido / inválido", () => {
    assert.equal(isValidEmail("ciclista@correo.pe"), true);
    assert.equal(isValidEmail("ciclista@"), false);
  });
  test("contraseña mínima de 8 caracteres con letras y números", () => {
    assert.equal(isValidPassword("bici2026"), true);
    assert.equal(isValidPassword("corta1"), false);
    assert.equal(isValidPassword("soloLetras"), false);
  });
  test("correo inválido muestra 'Correo no válido.'", () => {
    assert.ok(validateSignup("malo", "bici2026").includes("Correo no válido."));
  });
});

describe("Seguridad: escape de HTML (XSS)", () => {
  test("escapa etiquetas y comillas", () => {
    assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});
