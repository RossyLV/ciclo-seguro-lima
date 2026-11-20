// Datos de DEMOSTRACIÓN (coordenadas aproximadas, solo ilustrativas). Se usan cuando no hay base de datos configurada.
// Las fechas se expresan como "hace N días" para que la demo siempre tenga incidentes recientes.

export const DEMO_ROUTES = [
  { id: 1, name: "Ciclovía Av. Arequipa", lane_type: "segregada", condition: "bueno", districts: ["Lima", "Lince", "San Isidro", "Miraflores"],
    coords: [[-12.0600, -77.0370], [-12.0800, -77.0340], [-12.0950, -77.0330], [-12.1100, -77.0310], [-12.1190, -77.0295]] },
  { id: 2, name: "Ciclovía Av. Salaverry", lane_type: "segregada", condition: "regular", districts: ["Jesús María", "Magdalena", "San Isidro"],
    coords: [[-12.0700, -77.0510], [-12.0830, -77.0520], [-12.0960, -77.0530]] },
  { id: 3, name: "Ciclovía Malecón / Costa Verde", lane_type: "senalizada", condition: "bueno", districts: ["Miraflores", "Barranco"],
    coords: [[-12.1210, -77.0390], [-12.1290, -77.0340], [-12.1400, -77.0280], [-12.1500, -77.0270]] },
  { id: 4, name: "Ciclovía Av. Javier Prado", lane_type: "senalizada", condition: "invadido", districts: ["San Isidro", "San Borja"],
    coords: [[-12.0910, -77.0420], [-12.0910, -77.0300], [-12.0890, -77.0180], [-12.0880, -77.0050]] },
  { id: 5, name: "Ciclovía Av. Benavides", lane_type: "compartida", condition: "malo", districts: ["Miraflores", "Santiago de Surco"],
    coords: [[-12.1190, -77.0240], [-12.1260, -77.0100], [-12.1320, -76.9950]] },
];

export const DEMO_DISTRICTS = ["Barranco", "Jesús María", "Lima", "Lince", "Magdalena", "Miraflores", "San Borja", "San Isidro", "Santiago de Surco"];

const INCIDENTS_RAW = [
  { id: 1, type: "robo", district: "Miraflores", lat: -12.1150, lng: -77.0305, daysAgo: 3, confirmations: 4, description: "Robo de celular a ciclista cerca del óvalo, de noche." },
  { id: 2, type: "robo", district: "Miraflores", lat: -12.1180, lng: -77.0298, daysAgo: 6, confirmations: 2, description: "Intentaron llevarse la bicicleta amarrada afuera de un local." },
  { id: 3, type: "invasion", district: "San Isidro", lat: -12.0910, lng: -77.0300, daysAgo: 1, confirmations: 3, description: "Autos estacionados sobre la ciclovía durante todo el día." },
  { id: 4, type: "mal_estado", district: "Santiago de Surco", lat: -12.1260, lng: -77.0100, daysAgo: 9, confirmations: 1, description: "Hueco grande y pista rota en el carril de bicicletas." },
  { id: 5, type: "accidente", district: "San Isidro", lat: -12.0950, lng: -77.0331, daysAgo: 12, confirmations: 2, description: "Choque entre ciclista y auto al cruzar la avenida." },
  { id: 6, type: "mal_estado", district: "Magdalena", lat: -12.0830, lng: -77.0521, daysAgo: 20, confirmations: 0, description: "Tramo con baches y sin señalización en el carril." },
  { id: 7, type: "robo", district: "Barranco", lat: -12.1400, lng: -77.0282, daysAgo: 45, confirmations: 1, description: "Robo antiguo de una bicicleta (ya no es reciente)." },
  { id: 8, type: "invasion", district: "Lince", lat: -12.0800, lng: -77.0341, daysAgo: 2, confirmations: 1, description: "Motos circulando por la ciclovía a toda velocidad." },
];

export function demoIncidents(now = new Date()) {
  return INCIDENTS_RAW.map(({ daysAgo, ...i }) => ({
    ...i, status: "publicado", created_at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  }));
}

export const DEMO_PARKINGS = [
  { id: 1, name: "Parque Kennedy (zona vigilada)", district: "Miraflores", lat: -12.1219, lng: -77.0297, surveillance: true, covered: false, capacity: 30, fee: "Gratis", ratings: [5, 4, 4] },
  { id: 2, name: "Larcomar", district: "Miraflores", lat: -12.1313, lng: -77.0301, surveillance: true, covered: true, capacity: 60, fee: "S/ 2 por hora", ratings: [5, 5, 4] },
  { id: 3, name: "Parque El Olivar", district: "San Isidro", lat: -12.0990, lng: -77.0365, surveillance: true, covered: false, capacity: 20, fee: "Gratis", ratings: [4, 3] },
  { id: 4, name: "Estación Javier Prado", district: "San Isidro", lat: -12.0909, lng: -77.0334, surveillance: false, covered: true, capacity: 40, fee: "Gratis", ratings: [3, 3, 2] },
  { id: 5, name: "Plaza de Barranco", district: "Barranco", lat: -12.1496, lng: -77.0210, surveillance: true, covered: false, capacity: 25, fee: "Gratis", ratings: [4] },
];
