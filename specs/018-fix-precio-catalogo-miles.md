---
id: 018
type: fix
status: verified
---

# Fix 018 — Precio de `ms-catalog` en miles en vez de pesos completos

## Qué estaba mal

El mock de `ms-catalog` (preexistente, no tocado por la Spec 015 más
allá de agregar `sucursales`) tiene el campo `precio` en miles de pesos
(`25.0`, `45.0`, `15.0`, `35.0`, `40.0`) en vez del monto completo. El
frontend (`formatCLP`) siempre esperó el monto completo en pesos, como
ya hacía con el mock viejo (`18000`, `25000`, etc.). Resultado: la vista
Admin muestra "$25" en vez de "$25.000".

## Comportamiento correcto esperado

`precio` en `ms-catalog` refleja el monto completo en pesos chilenos.

## Acceptance Criteria

1. Los 5 servicios mock de `ms-catalog` tienen `precio` multiplicado
   ×1000 respecto al valor actual (25.0→25000.0, 45.0→45000.0,
   15.0→15000.0, 35.0→35000.0, 40.0→40000.0).
2. `GET /api/catalog` de `ms-catalog` y del BFF devuelven el precio
   corregido.
3. La vista Admin muestra los precios como "$25.000", "$45.000", etc.
4. No cambia ningún otro campo (`duracionHoras`, `disponible`,
   `sucursales`, nombres, descripciones).
