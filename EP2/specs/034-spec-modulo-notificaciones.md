---
id: 034
type: spec
status: verified
---

# Spec 034 — Módulo propio de notificaciones, con botón de leído

## Qué debe hacer

Hoy los avisos (pedido nuevo para el Operador, pedido listo para el Cliente) viven en una
campanita del encabezado que abre un desplegable de ~320 px. Los avisos son una parte central
del sistema —son lo que le dice al Operador que entró un pedido y al Cliente que ya está
listo— y ahí se pierden. Esta spec los convierte en un **módulo propio, del mismo tamaño que los
demás**, y reemplaza el "se marcan como leídos solos al abrirlos" por un **botón de leído**.

### Dónde aparece

| Rol | Dónde |
|---|---|
| **Admin** | Una pestaña nueva **"Notificaciones"** junto a Órdenes recientes, Catálogo, Analítica por sucursal y Registro de auditoría (mismo panel grande) |
| **Operador** | Una tarjeta **"Notificaciones"** de ancho completo en su panel, justo debajo de "Indicadores operativos" (que ya trae la sucursal en turno) |
| **Cliente** | Una tarjeta **"Notificaciones"** de ancho completo arriba de "Mis órdenes" |

La campanita del encabezado se queda, pero como **indicador**: muestra el contador de avisos sin
leer y al pulsarla **lleva al módulo** (Admin: abre la pestaña; Operador y Cliente: baja hasta la
tarjeta) en vez de abrir el desplegable pequeño.

### Qué muestra el módulo

```
┌ Notificaciones ─────────────────────────────────────────────────────────────┐
│ [ Todas (12) ] [ Sin leer (3) ]                     [ Marcar todas leídas ] │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ● PEDIDO NUEVO · hace 5 min                              [ Marcar leído ]│ │
│ │   Nuevo pedido ORD-0014: Planchado de Ana en Providencia (total $9.500) │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │   PEDIDO LISTO · 10/10/2026 12:04                                  Leído │ │
│ │   Tu pedido ORD-0012 (Lavado en seco) está listo                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

- Cada aviso: tipo (Pedido nuevo / Pedido listo), mensaje, número de orden, fecha y hora, y su
  estado: **sin leer** (resaltado, con punto) o **leído** (atenuado).
- **Marcar leído** en cada aviso sin leer, y **Marcar todas leídas** arriba.
- Filtro **Todas / Sin leer**, con la cantidad de cada uno.
- Lista con scroll dentro de la tarjeta (los más nuevos primero) y mensaje claro cuando no hay
  avisos o cuando falla la carga.
- **Admin: solo lectura.** Ve los avisos de todos y cada uno indica **para quién es** (sucursal o
  cliente), pero no tiene botones ni contador: marcar leído no debe borrarles los pendientes a los
  Operadores y Clientes (igual que hoy).

### Cambio de comportamiento

Abrir el módulo **ya no marca nada como leído**: solo lo hace el botón. Hoy abrir la campanita
marca todo como leído en el servidor y se pierde qué estaba pendiente.

### Una sola consulta

Hoy la campanita consulta cada 15 s. El módulo y la campanita **comparten** esa misma consulta
(un solo `GET /api/notificaciones` cada 15 s), y al marcar leído se actualizan los dos a la vez.

## Cambios en el backend (para que el botón sea por aviso)

Hoy el backend solo sabe marcar **todos** los avisos de un destinatario. Para "marcar este aviso":

- **`ms-cleanfresh-notificaciones`:** `PUT /api/notificaciones/{id}/leida?cliente=` o `?sucursal=`.
  Marca ese aviso **solo si es de ese destinatario**; si no existe o es de otro, `404` (no revela
  si existe). Un filtro en blanco, o los dos a la vez, `400`, igual que el resto.
- **BFF:** `POST /api/notificaciones/{id}/leida?sucursal=`. El destinatario sale **del token**, nunca
  de un parámetro (el Cliente por su `username`; el Operador por su sucursal en turno, validada como hoy).
  Admin → `403`. Sin token → `401`.

## Fuera de alcance

- Notificaciones push / websockets / sonido (se sigue consultando cada 15 s).
- Eliminar avisos, o "marcar como no leído".
- Paginación en el servidor (la lista tiene scroll; los avisos son pocos por usuario).
- Cambiar qué avisos ve cada rol ni cómo se generan (Spec 030 y 033).

## Acceptance Criteria

**Frontend**

1. Admin tiene la pestaña **Notificaciones** con el mismo panel que las otras; Operador y Cliente
   tienen la tarjeta de ancho completo en la posición indicada. Ninguno depende de abrir un desplegable.
2. Cada aviso muestra tipo, mensaje, número de orden, fecha/hora y su estado (sin leer / leído).
3. **Marcar leído** de un aviso lo deja leído en la pantalla y en el servidor (sigue leído tras
   recargar); **Marcar todas leídas** marca todos los del usuario.
4. El filtro **Todas / Sin leer** funciona y muestra las cantidades correctas.
5. Abrir o ver el módulo no marca ningún aviso como leído.
6. La campanita muestra el contador de sin leer (Operador y Cliente) y al pulsarla lleva al módulo; el
   contador baja al marcar leídos. En Admin no hay contador.
7. Admin ve los avisos de todos con el destinatario de cada uno y **sin** botones de leído.
8. Hay un solo `GET /api/notificaciones` cada 15 s, compartido por campanita y módulo.
9. Estados vacío y de error claros; en pantallas angostas (móvil) el módulo no se desborda.

**Backend**

10. `PUT /api/notificaciones/{id}/leida` marca solo ese aviso y solo si es del destinatario indicado;
    `404` si no existe o es de otro; `400` con filtro en blanco o doble.
11. BFF `POST /api/notificaciones/{id}/leida`: el Cliente solo puede marcar los suyos (un id ajeno
    da `404` y no cambia nada), el Operador solo los de su sucursal en turno, Admin `403`, sin token `401`.
12. Marcar uno no afecta a los demás avisos ni a los de otros usuarios.

**Cierre**

13. Pruebas automáticas de los dos servicios y del frontend (build sin errores) en verde.
14. Verificado en el navegador con los tres roles (capturas) y desplegado en AWS
    (`notificaciones` y BFF reconstruidos); `verificar.sh` sigue en "Todo OK".

## Verificación

Fases: A backend `notificaciones`, B BFF, C frontend, D verificación en el navegador con los tres roles,
E despliegue en AWS. Las capturas están en `EP2/capturas/034/`.

**A y B — backend (hecho).** `notificaciones`: 45 pruebas (7 nuevas); BFF: 66 pruebas (12 nuevas). Cubren
que marcar uno no toca los demás, que un aviso ajeno o inexistente da `404` sin cambiar nada (otro cliente,
cliente vs. sucursal, otra sucursal), que el destinatario sale del token y no de un parámetro, que el Admin
recibe `403`, que sin token es `401`, el filtro en blanco o doble `400`, y que el repositorio del BFF arma bien la
URL (tildes y espacios) y traduce el `404` del microservicio.

**C y D — frontend (hecho).** `npm run build` compila sin errores ni advertencias; 11 pruebas de la lógica
pura (`src/utils/notifications.test.js`). Verificación en Chrome con sesión y API simuladas (con estado: marcar
leído cambia lo que devuelve el siguiente GET), un script por rol:

| # | AC | Estado |
|---|---|---|
| 1 | Pestaña del Admin y tarjeta de ancho completo del Operador (2.ª, bajo Indicadores) y del Cliente (1.ª) | ✅ Cumple: 1232 px de 1232 px; sin el desplegable viejo |
| 2 | Cada aviso muestra tipo, mensaje, N° de orden, fecha/hora y estado | ✅ Cumple ("hace 3 min" para lo reciente, fecha completa para lo antiguo) |
| 3 | Marcar leído de un aviso y marcar todas | ✅ Cumple: una sola llamada por aviso, queda leído y los demás no cambian; el Operador manda su sucursal en turno (también al cambiar a Maipú) |
| 4 | Filtro Todas / Sin leer con cantidades | ✅ Cumple (Todas 3 · Sin leer 2 → 1); también en el Admin |
| 5 | Ver el módulo no marca nada | ✅ Cumple: 0 llamadas al servidor tras abrirlo |
| 6 | Campanita con contador que lleva al módulo; sin contador en el Admin | ✅ Cumple (el contador baja 2 → 1 → sin contador; en el Admin abre la pestaña) |
| 7 | Admin: avisos de todos, con destinatario, sin botones | ✅ Cumple ("Para: Cliente cliente@cleanfresh.com" tomado de la orden, "Para: Sucursal Providencia") |
| 8 | Una sola consulta cada 15 s | ✅ Cumple: 2 GET en 31 s (los dos componentes comparten la consulta) |
| 9 | Vacío, error y móvil | ✅ Cumple: "No tienes avisos sin leer", "No hay avisos por ahora", mensaje de error si falla la consulta, sin desborde a 390 px |
| 10–12 | Backend | ✅ Cumple (pruebas automáticas) |

**E — AWS:** ⏳ pendiente (ver más abajo cuando se despliegue).
