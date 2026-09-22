---
id: 003
type: fix
status: verified
---

# Fix 003 — Moneda global CLP

## Qué estaba mal

Todos los montos de la app (catálogo, órdenes recientes, KPI "Ingresos
totales") se formatean como pesos colombianos (`toLocaleString("es-CO")`,
función `formatCOP`), heredado del mock del diseño de v0.dev. El negocio
opera en pesos chilenos.

## Comportamiento correcto esperado

Todos los montos de la app se muestran en formato de pesos chilenos (CLP):
sin decimales (el CLP no usa centavos) y con el separador de miles propio
de `es-CL`.

## Acceptance Criteria

1. La función de formateo de moneda usa locale/formato CLP (`es-CL`), sin
   decimales.
2. Los precios del catálogo se muestran en CLP en las tres vistas (Admin,
   Operador, Cliente).
3. Los precios de las órdenes (tabla "Órdenes recientes" de Admin, listado
   de Operador) se muestran en CLP.
4. El KPI "Ingresos totales" (Admin) se muestra en CLP.
5. El campo "Precio" del formulario de alta/edición de servicio aclara que
   es en pesos chilenos (label "Precio (CLP)"), sin cambiar cómo se ingresa
   el número.
6. No cambia ningún valor numérico mockeado — solo cómo se muestra.
