---
id: 042
type: fix
status: draft
---

# Fix 042 — Nombres de colas, exchanges y bindings centralizados en la configuración

## Qué estaba mal

Spec 033 y Spec 037. La pauta pide: *"Define en application.yml o clase @Configuration los nombres de colas, exchanges y
bindings de forma centralizada."*

Hoy los nombres están escritos a mano, repartidos por el código:

| Servicio | Dónde | Qué nombres |
|---|---|---|
| `ms-cleanfresh-orders` | `RabbitOrderEventPublisher` (constantes y textos sueltos) | `cmd.direct`, `cmd.topic`, `email.send`, `kitchen.ticket`, `invoice.gen` y sus variantes exprés |
| `ms-cleanfresh-notificaciones` | `ComandosListener` (`@RabbitListener(queues = "q.cmd.email")`, etc.) y `DlqDrainer` (lista `DLQS`) | `q.cmd.email`, `q.cmd.kitchen`, `q.cmd.invoice` y sus `.dlq` |
| `ms-cleanfresh-mq-admin` | `TopologiaBase` (clase con constantes) | Toda la topología |

Cambiar un nombre obliga a buscarlo en varias clases, y nada garantiza que coincida con `definitions.json`.

## Comportamiento correcto esperado

- `orders` y `notificaciones` declaran sus nombres en `application.yaml`, bajo `app.rabbit.topologia`, y los leen con
  una clase `@ConfigurationProperties` registrada en su `RabbitConfig` (`@Configuration`):
  - `orders`: los exchanges (`cmd.direct`, `cmd.topic`) y las claves de ruteo base y exprés de cada comando.
  - `notificaciones`: las 3 colas de comandos y el sufijo de sus DLQ.
- `ComandosListener` usa los nombres de la configuración (`@RabbitListener(queues = "${app.rabbit.topologia.cola-email}")`)
  y `DlqDrainer` arma la lista de DLQ desde ella.
- `mq-admin` mueve su topología base (exchanges, colas, bindings y claves de las DLQ) de `TopologiaBase` a su
  `application.yaml`, leída con `@ConfigurationProperties`.
- Los valores por defecto son los mismos de hoy y de `definitions.json`: no cambia ningún nombre ni el comportamiento.

## Fuera de alcance

- Cambiar nombres de colas o exchanges.
- Que los servicios declaren la topología por su cuenta (sigue a cargo de `mq-init` y de `mq-admin`).

## Acceptance Criteria

1. En el código Java de `orders`, `notificaciones` y `mq-admin` no queda ningún nombre de cola, exchange o clave de
   ruteo escrito a mano fuera de los tests: todos vienen de `application.yaml`.
2. Cambiar un nombre en `application.yaml` (por ejemplo con una variable de entorno) basta para que el servicio lo use,
   sin tocar código (prueba con un nombre distinto en los tests).
3. Los nombres de `application.yaml` coinciden con `EP2/despliegue/mq/definitions.json`.
4. Pruebas de los 3 servicios en verde; `verificar-flujo.sh` y las 3 demostraciones funcionan igual que antes.
