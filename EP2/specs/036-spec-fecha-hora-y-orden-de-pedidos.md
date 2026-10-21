---
id: 036
type: spec
status: draft
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

⏳ Pendiente de aprobación.
