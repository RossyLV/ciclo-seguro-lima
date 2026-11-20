# 🚲 CicloSeguro Lima

Aplicación web para ciclistas de Lima: muestra las ciclovías con un **semáforo de seguridad**, recomienda la **ruta más segura** entre distritos, permite **reportar incidentes** (robos, accidentes, invasión de ciclovía, tramos en mal estado) y encontrar **estacionamientos seguros**.

- **Solución desplegada (Vercel):** se publica automáticamente en cada merge a `main`
- **Espejo (GitHub Pages):** https://rossylv.github.io/ciclo-seguro-lima/
- **Pipeline:** pestaña *Actions* → workflow **CI-CD DevSecOps**

## Arquitectura

| Capa | Tecnología | Función |
|---|---|---|
| Frontend (SPA) | HTML + JavaScript (módulos ES) + Leaflet + OpenStreetMap | Mapa, formularios y cálculo del puntaje de seguridad en el navegador |
| Lógica de negocio | `src/core.js` (funciones puras) | Puntaje 0-100, recomendación de rutas, validaciones, estadísticas |
| Backend como servicio | Supabase (API REST autogenerada) | Lectura y escritura de datos vía HTTPS |
| Base de datos | PostgreSQL (Supabase) con Row Level Security | Rutas, incidentes, confirmaciones, estacionamientos, calificaciones |
| Autenticación | Supabase Auth (correo + contraseña, JWT) | Registro e inicio de sesión |
| Hosting | Vercel (CDN con HTTPS, cabeceras de seguridad) + GitHub Pages | Publica el sitio estático |

## Ramas

- `main`: producción. Solo recibe cambios mediante Pull Request desde `test`. Cada push a `main` despliega.
- `test`: integración y pruebas. Cada push ejecuta build, pruebas y controles de seguridad (sin desplegar).

## Pipeline CI/CD (escalonado)

```
1. Build ─┬─ 2a. Pruebas (node:test)       ─┐
          ├─ 2b. SAST (CodeQL)              ├─ 3. Deploy (GitHub Pages, solo main) ─ 4. Smoke test
          ├─ 2c. Secretos (Gitleaks)        │
          └─ 2d. Dependencias (Trivy)      ─┘
```

## Ejecutar en local

```bash
npm test          # pruebas unitarias e integración
npm run build     # genera dist/
npx serve dist    # abre http://localhost:3000
```

Sin variables `SUPABASE_URL` / `SUPABASE_ANON_KEY` la app funciona en **modo demostración** con datos de ejemplo.

## Base de datos

Ejecutar `supabase/schema.sql` en el SQL Editor de Supabase. Crea las tablas, las políticas RLS y los datos de prueba.
