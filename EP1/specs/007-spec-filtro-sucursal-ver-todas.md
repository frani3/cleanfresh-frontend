---
id: 007
type: spec
status: superseded
---

# Spec 007 — Filtro por sucursal en "Ver todas las órdenes"

Extiende la Spec 006.

## Qué debe hacer

El modal "Ver todas las órdenes" agrega un tercer filtro: selector de
sucursal, además de los ya existentes (búsqueda por cliente y filtro por
estado).

## Acceptance Criteria

1. El modal tiene un selector de sucursal con opción "Todas las
   sucursales" + las sucursales de `BRANCHES`.
2. Al elegir una sucursal, la tabla muestra solo las órdenes de esa
   sucursal.
3. El filtro de sucursal se combina (AND) con los filtros de cliente y
   estado ya existentes (Spec 006, AC5).
4. Si la combinación de los tres filtros no da resultados, se muestra
   "Sin resultados" (mismo comportamiento que Spec 006, AC6).
