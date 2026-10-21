---
id: 036
type: spec
status: verified
---

# Spec 036 — Fecha y hora de cada pedido, y el más reciente arriba

## Qué debe hacer

En **"Gestión de órdenes"** del Operador y en **"Tus pedidos"** del Cliente, cada pedido muestra **la fecha y la
hora en que se hizo** y la lista queda con **el más reciente arriba**.

Hoy:

- Ninguna de las dos listas muestra cuándo se hizo el pedido.
- El Operador ya ve "Más nuevas primero", pero ordenado por el número de orden; el Cliente **no tiene orden**: ve
  primero su pedido más viejo.
- El backend guarda solo la **fecha** de la orden (`2026-10-21`), sin hora, así que la hora hay que empezar a guardarla.

### Cómo se ve

```
ORD-0014  [En preparación]
ana@cleanfresh.com · Planchado · Providencia
21-10-2026 01:26
```

La fecha y la hora van en la línea de detalle de cada pedido, en la hora del navegador del usuario (Chile).

### Qué se guarda

- `orders` guarda el **instante exacto** de creación de cada orden nueva (nueva columna `fecha_hora`) y lo devuelve
  como `fechaHora` (ISO-8601, UTC). El BFF lo deja pasar tal cual.
- **Las órdenes anteriores no tienen hora** (no se guardó). Se siguen mostrando con **solo la fecha**
  ("08-10-2026") y no se inventa una hora. No se modifican sus datos.
- Orden: del pedido más reciente al más antiguo, por fecha y hora; si dos tienen el mismo instante o no tienen hora,
  por número de orden (el más alto, arriba).

### Dónde aplica

| Lista | Cambio |
|---|---|
| **Operador → Gestión de órdenes** | muestra fecha y hora; con "Más nuevas primero" (la opción por defecto) ordena por fecha y hora. Las demás opciones de orden y los filtros siguen igual |
| **Cliente → Tus pedidos** | muestra fecha y hora; queda siempre con el más reciente arriba |
| Admin (tabla de órdenes) | **sin cambios** (queda fuera de lo pedido) |

Un pedido que el Cliente acaba de crear aparece arriba, con su hora, en cuanto se confirma.

## Fuera de alcance

- Cambiar el Admin, el detalle de la orden (ventana "Ver") o la línea de tiempo del estado.
- Rellenar la hora de las órdenes anteriores.
- Zona horaria configurable: se usa la del navegador.

## Cambios por servicio

- **`ms-cleanfresh-orders`:** columna `fecha_hora` (nullable) en `ordenes`, se llena al crear; `OrderResponse` suma
  `fechaHora`. Es un cambio compatible: `ddl-auto: update` agrega la columna sin tocar los datos (no hace falta migración).
- **BFF:** `OrderResponse` suma `fechaHora`.
- **Frontend:** mostrar fecha y hora, ordenar y la función de formato (con pruebas).

## Acceptance Criteria

1. Una orden nueva guarda su fecha y hora de creación y `GET /api/orders` la devuelve en `fechaHora`; las órdenes
   anteriores la devuelven vacía y siguen funcionando.
2. En "Gestión de órdenes" (Operador) y en "Tus pedidos" (Cliente) cada pedido muestra su fecha y hora (solo la fecha si es
   una orden anterior, sin inventar hora).
3. "Tus pedidos" muestra el pedido más reciente arriba, y un pedido recién creado aparece arriba.
4. "Gestión de órdenes" con "Más nuevas primero" ordena por fecha y hora; "Más antiguas primero" invierte el orden.
5. Las órdenes con y sin hora conviven en el orden correcto (las anteriores quedan abajo, por número de orden).
6. Los filtros, la búsqueda y el "Ver más" del Operador siguen funcionando; el Admin no cambia.
7. Pruebas de `orders` y del BFF en verde; build del frontend sin errores y pruebas de la lógica de formato y orden;
   verificado en el navegador (Operador y Cliente) y desplegado en AWS con una orden real.

## Verificación

Fases: A backend (`orders`, BFF), B frontend, C verificación en el navegador, D despliegue en AWS. Capturas en
`EP2/capturas/036/`; salidas completas en [`EVIDENCIA-EP2.md`](../EVIDENCIA-EP2.md), sección 12.

**Backend.** `orders`: 42 pruebas (4 nuevas: guarda el instante de creación, una orden anterior devuelve `fechaHora`
nula, las sembradas no tienen hora, dos órdenes seguidas guardan instantes no decrecientes); BFF: 67 (1 nueva: el
campo pasa tal cual y una orden sin él lo trae nulo). La verificación encontró un detalle real: `Instant.now()` trae
nanosegundos y la base guarda microsegundos, así que la respuesta al crear no coincidía con la lectura posterior; se
trunca a microsegundos al guardar.

**Frontend.** Build sin errores ni advertencias; 23 pruebas de la lógica pura (12 nuevas: orden, comparador y formato,
incluida la zona horaria y el cambio de día). Verificación en Chrome con API simulada, un script por rol:

| # | AC | Estado |
|---|---|---|
| 1 | Una orden nueva guarda y devuelve su fecha y hora; las anteriores no | ✅ Cumple (pruebas, y AWS: `ORD-0021` con `2026-10-21T04:54:49.838608Z`; 20 órdenes anteriores sin hora) |
| 2 | Fecha y hora en "Gestión de órdenes" y "Tus pedidos"; solo la fecha en las anteriores | ✅ Cumple: `21-10-2026 01:42` en las nuevas y `08-10-2026` en las anteriores, sin inventar hora |
| 3 | "Tus pedidos" con el más reciente arriba; el pedido nuevo aparece arriba | ✅ Cumple: orden 0015, 0012, 0013 y la anterior 0007; el recién creado (0016) quedó primero con la hora de ese momento |
| 4 | "Más nuevas primero" por fecha y hora; "Más antiguas primero" invierte | ✅ Cumple: 0015, 0012, 0014, 0013 y las anteriores abajo por número (0007, 0002); 0012 (número menor, hecha después que 0013) va arriba de 0013 |
| 5 | Órdenes con y sin hora conviven en el orden correcto | ✅ Cumple (prueba del comparador y la lista del Operador) |
| 6 | Filtros, búsqueda y Admin siguen igual | ✅ Cumple: búsqueda "0013" y filtro "Entregado" funcionan; el Admin sigue ordenado por número (0015, 0014, 0013, 0012...) y sin línea de fecha |
| 7 | Pruebas, build, navegador y AWS | ✅ Cumple |

**AWS.** `orders` y BFF reconstruidos. `ddl-auto: update` agregó la columna `fecha_hora` (`timestamp with time zone`) a
`ordenes` en la RDS sin tocar datos ni hacer migración. BFF sin token: `401` (directo y por API Gateway).

**Límites.** Las 20 órdenes que ya existían (incluida `ORD-0013`) **no tienen hora** y se ven solo con la fecha; las
nuevas, con hora. La hora se muestra en la zona del navegador. Falta verlo en la app real con los usuarios.
