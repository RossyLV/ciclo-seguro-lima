// Pruebas unitarias de la lógica de negocio (node:test, sin dependencias externas).
// Cada bloque indica la historia de usuario cuyo criterio de aceptación verifica.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  haversine, distanceToPolyline, routeScore, classify, recommendRoutes, recentIncidents, recencyFactor,
  nearestParkings, averageRating, isValidRating, statsByDistrict, filterByDistrict, validateReport,
  isValidEmail, isValidPassword, validateSignup, addConfirmation, escapeHtml,
} from "../src/core.js";
import { DEMO_ROUTES, DEMO_PARKINGS, demoIncidents } from "../src/data/demo.js";

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

describe("US-08 Puntaje con incidentes recientes", () => {
  const robo = { type: "robo", lat: -12.105, lng: -77.0301, created_at: daysAgo(1), status: "publicado", confirmations: 0 };
  test("un robo reciente a menos de 150 m baja el puntaje", () => {
    assert.ok(routeScore(route, [robo], NOW) < routeScore(route, [], NOW));
  });
  test("un incidente de más de 30 días no afecta", () => {
    assert.equal(routeScore(route, [{ ...robo, created_at: daysAgo(45) }], NOW), 95);
  });
  test("un incidente lejano (>150 m) no afecta", () => {
    assert.equal(routeScore(route, [{ ...robo, lng: -77.04 }], NOW), 95);
  });
  test("los incidentes ocultos (moderados) no afectan", () => {
    assert.equal(routeScore(route, [{ ...robo, status: "oculto" }], NOW), 95);
  });
  test("más confirmaciones = más penalización", () => {
    assert.ok(routeScore(route, [{ ...robo, confirmations: 5 }], NOW) < routeScore(route, [robo], NOW));
  });
  test("el factor de antigüedad baja de 1 a 0,3", () => {
    assert.equal(recencyFactor(daysAgo(0), NOW), 1);
    assert.ok(Math.abs(recencyFactor(daysAgo(30), NOW) - 0.3) < 1e-9);
  });
  test("el puntaje nunca es menor que 0", () => {
    const many = Array.from({ length: 20 }, () => robo);
    assert.ok(routeScore({ ...route, lane_type: "compartida", condition: "malo" }, many, NOW) >= 0);
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

describe("US-06 Validación de reportes", () => {
  const ok = { type: "robo", lat: -12.12, lng: -77.03, description: "Me robaron el celular en la ciclovía" };
  test("reporte válido", () => assert.equal(validateReport(ok).ok, true));
  test("ubicación fuera de Lima es rechazada", () => {
    assert.equal(validateReport({ ...ok, lat: -13.5 }).ok, false);
  });
  test("descripción muy corta es rechazada", () => {
    assert.equal(validateReport({ ...ok, description: "corto" }).ok, false);
  });
  test("tipo inválido es rechazado", () => {
    assert.equal(validateReport({ ...ok, type: "otro" }).ok, false);
  });
});

describe("US-07 Incidentes recientes", () => {
  test("muestra el de hace 3 días y oculta el de hace 45", () => {
    const list = recentIncidents([{ id: 1, created_at: daysAgo(3) }, { id: 2, created_at: daysAgo(45) }], NOW);
    assert.deepEqual(list.map((i) => i.id), [1]);
  });
});

describe("US-09 Confirmar incidente", () => {
  test("la primera confirmación suma", () => {
    const r = addConfirmation([], "u1");
    assert.equal(r.added, true);
    assert.equal(r.confirmedBy.length, 1);
  });
  test("el mismo usuario no puede confirmar dos veces", () => {
    const r = addConfirmation(["u1"], "u1");
    assert.equal(r.added, false);
    assert.equal(r.confirmedBy.length, 1);
  });
});

describe("US-11 / US-12 / US-13 Estacionamientos", () => {
  test("devuelve los 5 más cercanos ordenados por distancia", () => {
    const res = nearestParkings(DEMO_PARKINGS, { lat: -12.1219, lng: -77.0297 }, 5);
    assert.equal(res.length, 5);
    assert.equal(res[0].name, "Parque Kennedy (zona vigilada)");
    for (let i = 1; i < res.length; i++) assert.ok(res[i - 1].distance <= res[i].distance);
  });
  test("promedio de calificaciones", () => {
    assert.equal(averageRating([5, 4, 4]), 4.3);
    assert.equal(averageRating([]), null);
  });
  test("solo se aceptan calificaciones de 1 a 5", () => {
    assert.equal(isValidRating(4), true);
    assert.equal(isValidRating(0), false);
    assert.equal(isValidRating(6), false);
    assert.equal(isValidRating(3.5), false);
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

describe("US-19 Estadísticas por distrito", () => {
  test("agrupa por distrito y tipo, ordenado de mayor a menor", () => {
    const stats = statsByDistrict(demoIncidents(NOW));
    assert.equal(stats[0].district, "Miraflores");
    assert.equal(stats[0].byType.robo, 2);
    for (let i = 1; i < stats.length; i++) assert.ok(stats[i - 1].total >= stats[i].total);
  });
});

describe("Seguridad: escape de HTML (XSS)", () => {
  test("escapa etiquetas y comillas", () => {
    assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});
