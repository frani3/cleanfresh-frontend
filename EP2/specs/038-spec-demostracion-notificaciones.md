---
id: 038
type: spec
status: approved
---

# Spec 038 — Demostración de las notificaciones con RabbitMQ: servicio visible por su nombre y script de la demo

## Qué debe hacer

El profesor pidió demostrar tres cosas:

1. **Recibir notificaciones.**
2. **Cliente → Operador, y también con el servicio caído**: que el mensaje persista y, cuando el servicio vuelva, el Operador
   reciba la notificación; y después, en el otro sentido, **Operador → Cliente**.
3. **Mostrar en la consola de RabbitMQ que `ms-cleanfresh-notificaciones` responde.**

El sistema ya hace 1 y 2. Esta spec cierra lo que faltaba para poder mostrarlo con claridad:

### A. El servicio se ve por su nombre en la consola de RabbitMQ

Hoy, en la pestaña **Connections**, las conexiones aparecen como "IP:puerto → IP:puerto". `orders` y `notificaciones` corren en
la misma máquina y con el mismo usuario, así que no se distinguen. Se les pone nombre:

| Servicio | Conexión (pestaña Connections) | Consumidores (Queues → cola → Consumers) |
|---|---|---|
| `ms-cleanfresh-notificaciones` | `ms-cleanfresh-notificaciones` | `ms-cleanfresh-notificaciones.q.cmd.email`, `...q.cmd.kitchen`, `...q.cmd.invoice` (con ACK manual) |
| `ms-cleanfresh-orders` | `ms-cleanfresh-orders` | no consume, solo publica |

### B. Script de la demostración completa

`EP2/despliegue/demo-notificaciones.sh` (en la EC2 de microservicios) recorre la secuencia que pidió el profesor, narrando cada
paso y comprobándolo; con `--pausas` espera un Enter entre pasos para mostrar la consola de RabbitMQ y la app:

1. Quién consume: lista los consumidores y las conexiones por nombre.
2. **Cliente → Operador**: el cliente solicita un servicio y el Operador recibe el aviso.
3. Se cae `notificaciones`: RabbitMQ ya no ve al consumidor.
4. **Cliente → Operador con el servicio caído**: la orden se acepta igual y los mensajes (persistentes) esperan en las colas.
5. Vuelve el servicio: el Operador recibe el aviso que había quedado guardado y las colas se vacían.
6. **Operador → Cliente**: el Operador cambia el estado y el Cliente recibe el aviso.
7. **Operador → Cliente con el servicio caído**: el cambio se guarda, el aviso espera en la cola y llega al volver el servicio.

Reemplaza en la demo a `demo-desacople.sh` (que se conserva: cubre solo el sentido Cliente → Operador).

## Fuera de alcance

- Cambiar cómo se generan o reparten los avisos (Specs 030, 033 y 035).
- Nombres de conexión para el administrador (`ms-cleanfresh-mq-admin` usa la API HTTP, no AMQP).

## Acceptance Criteria

1. En la pestaña **Connections** de RabbitMQ hay una conexión `ms-cleanfresh-notificaciones` y otra `ms-cleanfresh-orders`.
2. En cada cola de comandos, el consumidor se llama `ms-cleanfresh-notificaciones.<cola>` y consume con ACK manual.
3. Con `notificaciones` caído, las colas muestran 0 consumidores y, tras un pedido o un cambio de estado, mensajes esperando
   (persistentes); al volver el servicio, los consume y las colas quedan en 0.
4. El Operador recibe el aviso de un pedido hecho con el servicio caído, al volver; el Cliente recibe el aviso de un cambio de
   estado hecho con el servicio caído, al volver; sin duplicados.
5. `demo-notificaciones.sh` termina en "Demostración completa" ejecutado en AWS, y su guion está en la guía de demostración.
6. Pruebas automáticas de `orders` y `notificaciones` en verde y verificado en AWS.

## Verificación

⏳ Pendiente.
