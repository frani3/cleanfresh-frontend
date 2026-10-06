---
id: 011
type: spec
status: verified
---

# Spec 011 — Pestañas para módulos secundarios de Admin

## Qué debe hacer

La vista Admin hoy muestra 6 tarjetas juntas en un grid bento: Estado del
sistema, Indicadores del sistema, Órdenes recientes, Catálogo, Analítica
por sucursal y Registro de auditoría.

Pasa a dividirse en dos zonas:

1. **Arriba, sin cambios de contenido:** "Estado del sistema" e
   "Indicadores del sistema" siguen en el grid bento, visibles siempre.
2. **Abajo, en pestañas:** "Órdenes recientes", "Catálogo", "Analítica
   por sucursal" y "Registro de auditoría" dejan de mostrarse todas
   juntas. Se muestra una barra de pestañas y, debajo, una sola tarjeta
   bento grande con el contenido del módulo seleccionado (título, ícono y
   contenido cambian según la pestaña activa).

Ninguna funcionalidad existente dentro de esos 4 módulos cambia (CRUD de
catálogo, CRUD de órdenes, modales, filtro de sucursal, etc.) — solo
cambia dónde se ubican visualmente.

## Acceptance Criteria

1. El grid bento superior de Admin muestra únicamente "Estado del
   sistema" e "Indicadores del sistema", con el mismo contenido y
   comportamiento que tienen hoy.
2. Debajo del grid hay una barra de pestañas con 4 opciones: "Órdenes
   recientes", "Catálogo", "Analítica por sucursal", "Registro de
   auditoría".
3. Al entrar a la vista Admin, la pestaña activa por defecto es "Órdenes
   recientes".
4. Debajo de la barra de pestañas hay una única tarjeta bento (ancho
   completo) cuyo título, ícono y contenido corresponden a la pestaña
   activa. Solo se muestra el contenido de una pestaña a la vez.
5. Cambiar de pestaña no dispara llamadas nuevas al BFF ni pierde el
   estado que vive en `AdminView` (ej. la sucursal elegida en el filtro
   de Catálogo se mantiene si el usuario cambia de pestaña y vuelve).
6. Todas las acciones existentes de cada módulo (crear/editar/eliminar
   servicio, crear/ver/editar/eliminar orden, "ver todas las órdenes",
   filtro por sucursal en catálogo) siguen funcionando igual que antes
   del cambio.
7. La barra de pestañas usa un patrón accesible (`role="tablist"` en el
   contenedor, `role="tab"` y `aria-selected` en cada botón).
8. El diseño es responsive: en mobile la barra de pestañas no se corta ni
   se superpone (puede scrollear horizontalmente si no entran las 4
   pestañas en el ancho disponible).
9. Operador y Cliente no se ven afectados: sus vistas siguen con el grid
   bento tal como están hoy, sin pestañas.
