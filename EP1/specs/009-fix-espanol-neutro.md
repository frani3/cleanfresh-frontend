---
id: 009
type: fix
status: verified
---

# Fix 009 — Español neutro

## Qué estaba mal

Revisando los textos de la app y de `specs/` encontré dos problemas de
consistencia regional:

1. Las sucursales mock (`Chapinero`, `Usaquén`, `Kennedy`, `Suba`) son
   barrios de **Bogotá, Colombia**, heredados del mock de v0.dev — pero la
   app ya está configurada en pesos chilenos (CLP, Fix 003), así que el
   nombre de las sucursales no es coherente con el país de operación.
2. Varios archivos de `specs/` usan la palabra "acá" (regionalismo de
   Argentina/Chile/Uruguay) en vez de "aquí" (neutro).

## Comportamiento correcto esperado

1. Las 4 sucursales mock pasan a ser comunas de Chile: **Providencia**,
   **Ñuñoa**, **Las Condes** y **Maipú**.
2. Todo el texto de la interfaz usa español neutro (sin voseo, sin
   modismos regionales). Los archivos `specs/*.md` que dicen "acá" pasan a
   decir "aquí".

## Acceptance Criteria

1. `BRANCHES` (y todo dato derivado: `BRANCH_ACTIVITY`, las órdenes mock,
   los selectores de sucursal en los modales) usa Providencia, Ñuñoa, Las
   Condes y Maipú en vez de los nombres de Bogotá.
2. No queda ninguna referencia a Chapinero/Usaquén/Kennedy/Suba en
   `src/`.
3. Los archivos `specs/001-spec-catalogo-crud.md`,
   `specs/002-spec-catalogo-eliminar-y-eta.md` y
   `specs/006-spec-ver-todas-las-ordenes.md` reemplazan "acá" por "aquí".
   `specs/005-fix-sucursal-dropdown-nueva-orden.md` actualiza la mención a
   los nombres de sucursal nuevos.
4. No se modifica ningún otro texto de la UI: esta revisión no encontró
   voseo (vos/tenés/podés) ni otros modismos fuera de estos dos casos, así
   que el resto de los textos queda igual.
5. El build compila sin errores después del cambio (los nombres de
   sucursal se usan como `value` de varios `<select>` y como clave en
   filtros; hay que verificar que no quede ninguna referencia rota).

### Adenda

Tras la verificación inicial se encontró un tercer caso de voseo que este
barrido no había cubierto: el texto "Escribí `{order.id}`..." del paso de
confirmación de borrado de orden (agregado por el Fix 008, justo antes de
esta revisión — el grep usado para auditar solo cubría una lista fija de
verbos y no incluía "escribí"). Se corrigió a "Escribe" (forma "tú",
estándar de español neutro/es-419 en software) y queda cubierto dentro
del alcance de este fix.
