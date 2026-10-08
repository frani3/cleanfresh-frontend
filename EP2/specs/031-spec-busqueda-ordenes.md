---
id: 031
type: spec
status: verified
---

# Spec 031 — Búsqueda y navegación de órdenes para que no se pierdan al crecer la lista

## Qué debe hacer

Hoy las listas de órdenes de Admin y Operador no escalan: si llegan más órdenes se
vuelven difíciles de recorrer y, en el caso del Operador, hay órdenes que no aparecen
sin que él lo pida. Esta spec ordena y completa la búsqueda, solo en el frontend (el
backend no cambia):

- El **Operador** tiene las mismas herramientas de búsqueda que el Admin, y además
  puede encontrar cualquier orden de su sucursal en turno, incluidas las entregadas y
  canceladas.
- Las órdenes se muestran **de la más nueva a la más antigua** (hoy salen de la más
  antigua a la más nueva, así que las que llegan quedan al final de la lista).
- Se ve **cuántas hay** ("Mostrando 10 de 37") y se recorren de a bloques con **"Ver
  más"**, en vez de una lista interminable.
- La lógica de filtrado se comparte entre las dos vistas (un hook y un componente de
  filtros), en vez de estar duplicada.

## Qué hay hoy (revisado en el código)

| | Admin | Operador |
|---|---|---|
| Buscar por N° de orden o cliente | ✅ | ✅ |
| Filtrar por estado | ✅ | ✅ |
| Filtrar por sucursal | ✅ | no aplica: ve solo la de su turno (selector "Sucursal en turno") |
| Orden de la lista | más antiguas primero | más antiguas primero |
| Muestra "Todos los estados" | todas | **oculta las entregadas** aunque diga "Todos" |
| Contador de resultados | no | no |
| Paginación / "Ver más" | no (tabla completa) | no (lista completa) |

## Fuera de alcance

- Cambios en el backend: el filtrado y el orden se hacen en el navegador sobre las
  órdenes que ya devuelve el BFF (con el volumen de este sistema es suficiente; con
  miles de órdenes habría que paginar y filtrar en el servidor).
- Filtrar por rango de fechas (las órdenes solo traen la fecha de creación, sin hora).
- Que el Operador vea más de una sucursal a la vez.
- Corregir que `GET /api/orders` devuelva todas las órdenes a un Cliente (pendiente
  de seguridad aparte, anotado en `CLAUDE.md`).

## Decisiones de diseño

- **Vista por defecto del Operador: "Activas"** (Creado, Aceptado, En preparación y
  Despachado), que es lo que gestiona en su turno. "Todos los estados" pasa a mostrar
  **todas**, incluidas Entregado y Cancelado, igual que en el Admin. Así nada queda
  oculto sin que él lo haya elegido.
- **Orden por defecto: más nuevas primero**, con un selector para invertirlo. Se ordena
  por el número de la orden (`ORD-0014` > `ORD-0013`), que crece con cada orden.
- **Búsqueda:** el texto se busca en el N° de orden, el cliente **y el servicio** (se
  amplía a las dos vistas).
- **Bloques de 10** órdenes con el botón "Ver más"; al cambiar la búsqueda o un filtro
  se vuelve al primer bloque.

## Acceptance Criteria

1. El Operador busca por N° de orden, cliente o servicio, y el resultado se actualiza al
   escribir. La misma búsqueda existe en el Admin.
2. El filtro de estado del Operador tiene "Activas" (por defecto), "Todos los estados" y
   cada estado. "Todos los estados" incluye las entregadas y canceladas; "Activas" no.
3. Las órdenes aparecen de la más nueva a la más antigua en el Operador y en el Admin,
   y un selector permite invertir el orden.
4. Un contador indica "Mostrando X de Y" según los filtros aplicados, en las dos vistas.
5. Con más de 10 resultados se muestran 10 y un botón "Ver más" agrega los siguientes;
   cambiar el texto o un filtro vuelve al primer bloque. Con 10 o menos no aparece el botón.
6. Si ninguna orden coincide, se muestra un mensaje claro ("Ninguna orden coincide con la
   búsqueda") y no la lista vacía.
7. Sin regresiones: el botón "Actualizar", el filtro por sucursal del Admin, el selector
   "Sucursal en turno" del Operador y el cambio de estado siguen funcionando igual.
8. La lógica de filtrado, orden y paginado vive en un solo lugar (hook y componente
   compartidos), usada por las dos vistas. La app compila sin advertencias.

## Verificación

Probada con la app compilada (`npm run build`, sin advertencias) en Chrome sin interfaz,
con una sesión de Cognito simulada y **37 órdenes simuladas** del BFF (con entregadas,
canceladas, cinco servicios y dos sucursales), como en la Spec 030. Se simularon los
datos del backend; no se probó todavía con las órdenes reales del entorno de AWS.

| # | AC | Estado |
|---|---|---|
| 1 | Búsqueda por N° (`ORD-0013`), cliente (`cliente-3`) y servicio (`seco`) en las dos vistas: el resultado coincide con lo esperado (p. ej. `seco`: 8 de 8 en el Admin; 2 de 2 en el Operador, que por defecto ve solo las activas) | ✅ Cumple |
| 2 | El Operador arranca en "Activas": 14 de sus 19 órdenes y ninguna entregada ni cancelada. "Todos los estados" muestra las 19; los filtros Entregado (3) y Cancelado (2) las encuentran. Se agregó Cancelado al filtro de estados de las dos vistas | ✅ Cumple |
| 3 | Las dos vistas arrancan con `ORD-0037` primero (la más nueva); el selector la invierte (`ORD-0001` primero) | ✅ Cumple |
| 4 | "Mostrando 10 de 14" en el Operador y "Mostrando 10 de 37" en el Admin; el contador sigue a los filtros | ✅ Cumple |
| 5 | Se muestran 10 y "Ver más" agrega el siguiente bloque (Admin: 20 de 37; Operador: 14 de 14, y el botón desaparece cuando no queda nada); cambiar el orden vuelve al primer bloque | ✅ Cumple |
| 6 | Con la búsqueda `zzzzzz` aparece "Ninguna orden coincide con la búsqueda." en las dos vistas | ✅ Cumple |
| 7 | Siguen presentes y funcionando el botón Actualizar, el filtro por sucursal del Admin (Las Condes: 18) y el selector "Sucursal en turno" del Operador | ✅ Cumple |
| 8 | Un hook (`src/hooks/useOrderFilters.js`) y un componente (`src/components/OrderFilters.jsx`, con el pie `OrderListFooter`) compartidos; el estado y el filtrado duplicados desaparecieron de las dos vistas. Compila sin advertencias | ✅ Cumple |

Detalle: la comprobación del Operador falló en una primera pasada por un error de la
propia prueba (esperaba 20 filas tras "Ver más" cuando solo había 14 activas, y buscaba
una orden de otra sucursal); se corrigió la prueba y no la app. Al revisar la captura se
acortó el texto del buscador, que se cortaba.

Límites: el filtrado y el orden se hacen en el navegador sobre las órdenes que devuelve el
BFF; con miles de órdenes habría que paginar y filtrar en el servidor.
