// Pruebas unitarias de la lógica de negocio (node:test, sin dependencias externas).
// Cada bloque indica la historia de usuario cuyo criterio de aceptación verifica.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  haversine, distanceToPolyline, routeScore, classify, recommendRoutes, filterByDistrict, isValidEmail, isValidPassword, validateSignup, escapeHtml,
} from "../src/core.js";
import { DEMO_ROUTES, demoIncidents } from "../src/data/demo.js";

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

describe("US-02 Semáforo de seguridad", () => {
  test("≥75 verde, 50-74 amarillo, <50 rojo", () => {
    assert.equal(classify(75), "verde");
    assert.equal(classify(74), "amarillo");
    assert.equal(classify(50), "amarillo");
    assert.equal(classify(49), "rojo");
  });
  test("ruta segregada en buen estado y sin incidentes = 95", () => {
    assert.equal(routeScore(route, [], NOW), 95);
  });
  test("el estado del tramo baja el puntaje", () => {
    assert.ok(routeScore({ ...route, condition: "malo" }, [], NOW) < routeScore(route, [], NOW));
  });
});

describe("US-03 Ruta más segura entre distritos", () => {
  test("ordena de mayor a menor puntaje", () => {
    const res = recommendRoutes(DEMO_ROUTES, demoIncidents(NOW), "Miraflores", "San Isidro", NOW);
    assert.ok(res.length >= 1);
    for (let i = 1; i < res.length; i++) assert.ok(res[i - 1].score >= res[i].score);
    assert.ok(res.every((r) => r.districts.includes("Miraflores") && r.districts.includes("San Isidro")));
  });
  test("sin rutas que conecten devuelve lista vacía", () => {
    assert.deepEqual(recommendRoutes(DEMO_ROUTES, [], "Barranco", "San Borja", NOW), []);
  });
  test("origen igual al destino devuelve lista vacía", () => {
    assert.deepEqual(recommendRoutes(DEMO_ROUTES, [], "Miraflores", "Miraflores", NOW), []);
  });
});

describe("US-05 Filtro por distrito", () => {
  test("Barranco solo devuelve rutas que pasan por Barranco", () => {
    const res = filterByDistrict(DEMO_ROUTES, "Barranco");
    assert.ok(res.length > 0 && res.every((r) => r.districts.includes("Barranco")));
  });
  test("'Todos' devuelve todas", () => {
    assert.equal(filterByDistrict(DEMO_ROUTES, "").length, DEMO_ROUTES.length);
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
