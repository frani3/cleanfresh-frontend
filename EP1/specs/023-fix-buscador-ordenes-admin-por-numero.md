---
id: 023
type: fix
status: verified
---

# Fix 023 — Buscador de "Órdenes recientes" (Admin) también busca por N° de orden

## Qué estaba mal

El buscador integrado en "Órdenes recientes" (Spec 012) solo filtraba
por nombre de cliente. No había forma de encontrar una orden puntual
por su N° (`ORD-XXXX`) sin recorrer la lista o combinarlo con los
filtros de estado/sucursal.

## Comportamiento correcto esperado

El mismo input filtra por nombre de cliente **o** por N° de orden
(case-insensitive, substring), igual que ya se hizo para el buscador
equivalente de "Gestión de órdenes" en Operador (Spec 022).

## Acceptance Criteria

1. El buscador de "Órdenes recientes" (Admin) filtra coincidencias por
   N° de orden además de por cliente.
2. Se sigue combinando (AND) con los filtros de estado y sucursal ya
   existentes.
3. El placeholder del input reflejar que ahora se puede buscar por
   ambos campos.
4. No rompe el resto del módulo de Órdenes ni las specs anteriores.

## Verificación

| # | AC | Estado |
|---|---|---|
| 1 | `matchesQuery` ahora incluye `o.id.toLowerCase().includes(normalizedQuery)` | ✅ Cumple |
| 2 | `matchesQuery && matchesStatus && matchesBranch` sin cambios en la combinación | ✅ Cumple |
| 3 | Placeholder actualizado a "Buscar por cliente o N° de orden..." | ✅ Cumple |
| 4 | Lint y `npm run build` sin errores | ✅ Cumple |

Verificado por lectura de código + build; pendiente de confirmación
visual en navegador (login real como Admin).
