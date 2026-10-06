---
id: 015
type: spec
status: verified
---

# Spec 015 — Sucursales en `ms-catalog` (+ corrección del DTO del BFF)

## Qué debe hacer

`ms-cleanfresh-catalog` agrega disponibilidad por sucursal a cada
servicio, con el mismo modelo que ya usa el frontend (Spec 010): un mapa
de sucursal → habilitado/deshabilitado, con las 4 sucursales de
`CLAUDE.md` (Providencia, Ñuñoa, Las Condes, Maipú). Sigue en memoria
(`List.of(...)`), sin base de datos — eso quedó fuera de este pedido.

De paso, se corrige un desajuste que encontré: el DTO `ServiceResponse`
del BFF (pensado como "espejo" del de `ms-catalog`) no coincide con el
real — le falta `duracionHoras` y tiene un campo `categoria` que
`ms-catalog` nunca envía.

## Acceptance Criteria

1. `ServiceResponse` en `ms-catalog` agrega un campo
   `Map<String, Boolean> sucursales` con las 4 sucursales.
2. Los 5 servicios mock de `ms-catalog` quedan con combinaciones
   variadas de sucursales habilitadas/deshabilitadas (al menos uno con
   alguna sucursal deshabilitada, para poder probar el caso — igual que
   ya hicimos en el mock del frontend).
3. `GET /api/catalog`, `/api/catalog/{id}` y `/api/catalog/disponibles`
   de `ms-catalog` devuelven el campo `sucursales` sin romper nada de lo
   que ya devolvían.
4. El DTO `ServiceResponse` del BFF se corrige para reflejar el
   contrato real de `ms-catalog`: agrega `duracionHoras` (`Double`) y
   `sucursales` (`Map<String, Boolean>`), y saca el campo `categoria`
   que no existe en el origen.
5. `GET /api/catalog` del BFF (autenticado, con `@PreAuthorize` ya
   existente) devuelve el campo `sucursales` correctamente, sin cambiar
   la autorización por rol que ya tiene.
6. Ninguno de los tres endpoints de `ms-catalog` ni del BFF agrega
   escritura (`POST`/`PUT`/`DELETE`) — siguen siendo solo lectura, según
   lo acordado.
