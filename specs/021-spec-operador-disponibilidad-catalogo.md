---
id: 021
type: spec
status: verified
---

# Spec 021 — Operador puede marcar disponibilidad de servicios en su sucursal (Catálogo)

## Qué debe hacer

En "Consulta rápida de catálogo" (vista Operador), cada servicio del
listado agrega un botón para marcar "No disponible" / "Reactivar" **en
la sucursal en turno del Operador** (la que ya selecciona en
"Indicadores operativos"). Reutiliza el mismo mecanismo que ya usa
Admin por sucursal (Spec 010: `branches[sucursal]`), pero acotado a la
sucursal del propio Operador — no puede tocar otras sucursales ni otros
campos del servicio (nombre, precio, ETA).

## Acceptance Criteria

1. Cada fila de "Consulta rápida de catálogo" (Operador) tiene un botón
   para alternar disponibilidad en la sucursal en turno.
2. El toggle solo modifica `branches[sucursal]` de esa sucursal — el
   resto de las sucursales del servicio queda intacto.
3. El cambio se refleja de inmediato en la etiqueta
   "Disponible"/"No disponible" de esa fila.
4. El mismo cambio se ve reflejado en Admin (catálogo, mismo estado
   `services`) y en Cliente (botón "Solicitar" deshabilitado si queda
   no disponible en todas partes).
5. El Operador no puede editar nombre, precio ni ETA desde esta vista
   (solo el toggle de disponibilidad).
6. No rompe el buscador de catálogo existente ni el resto de specs de
   Operador/Admin.

## Verificación

| # | AC | Estado |
|---|---|---|
| 1 | Botón agregado por fila en `op2-catalog-item` | ✅ Cumple |
| 2 | `onToggleServiceBranch(s.id, sucursal)` reutiliza el toggle existente, acotado a `sucursal` | ✅ Cumple |
| 3 | Etiqueta usa `s.branches[sucursal]` recalculado en cada render | ✅ Cumple |
| 4 | `services` es el mismo estado compartido por Admin/Operador/Cliente; no hay copia local | ✅ Cumple |
| 5 | Solo se agregó el botón de toggle; no hay inputs de nombre/precio/ETA en esta vista | ✅ Cumple |
| 6 | Lint y `npm run build` sin errores | ✅ Cumple |

Verificado por lectura de código + build; pendiente de confirmación
visual en navegador (login real como Operador).
