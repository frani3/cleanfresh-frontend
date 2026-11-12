# Demostraciones de RabbitMQ — Clean&Fresh

Guía paso a paso de las tres demostraciones que pide el profesor, pensada para ensayarlas y presentarlas con otra persona sin
conocer el proyecto:

1. **Servicio de notificaciones caído:** el mensaje se mantiene en RabbitMQ y llega al Operador cuando el servicio vuelve.
2. **Un nodo del clúster cae con un mensaje dentro:** el otro nodo lo conserva y el mensaje llega igual al Operador.
3. **Cola muerta (DLQ):** qué pasa con un mensaje que no se puede procesar.

Se hacen en este orden: la demo 1 deja `notificaciones` apagado y se sigue con la demo 2; al final de la demo 2 se levanta el
servicio (cierre). La demo 3 va aparte, con el servicio arriba.

Este documento reúne y reemplaza a la guía del compañero y a los dos `DEMOSTRACIONES*.md` sueltos que había. La operación
general (verificar, reiniciar, logs, bases de datos) está en [`OPERACION.md`](OPERACION.md).

> Los comandos son los del despliegue actual: **dos EC2** (`cleanfresh-ms` con los microservicios y `cleanfresh-mq` con el
> clúster). Si se aprueba la [Fix 041](../specs/041-fix-un-solo-docker-compose.md) (un solo `docker-compose.yml`), cambian las
> terminales 2 y 4 y hay que actualizar este documento.

## 1. Preparación

### Qué necesitas

| Qué | Detalle |
|---|---|
| La llave `key.pem` de las EC2 | La entrega quien administra el laboratorio de AWS |
| Tu IP permitida en los grupos de seguridad | SSH (22) en `cleanfresh-sg-ms` y `cleanfresh-sg-mq`, y los paneles (15672 y 15673) en `cleanfresh-sg-mq`. Quien comparte red con el autor ya está permitido |
| El usuario y la clave de la consola de RabbitMQ | En el `.env` de `~/mq` en la EC2 `cleanfresh-mq` (terminal 4, paso 3). No se documentan |
| Los usuarios de la app (Cliente y Operador) | Se piden a quien administra el User Pool de Cognito. No se documentan |
| El repo del frontend clonado, con su `.env` | `npm install` hecho. El `.env` apunta a API Gateway y a Cognito (ver [`CLAUDE.md`](../../CLAUDE.md)) |
| El laboratorio de AWS encendido | Las 3 EC2 y la RDS arriba |

Las **IP públicas** de `cleanfresh-ms` y `cleanfresh-mq` cambian cada vez que se apaga el laboratorio (se ven en la consola de
EC2 → Instances). Donde dice `<IP-EC2-ms>` o `<IP-EC2-mq>`, va la vigente. Las IP privadas (`172.31.39.91` y `172.31.18.141`) no
cambian. El detalle de todos los recursos está en [`CLAUDE.md`](../../CLAUDE.md), sección "Despliegue en AWS".

### Terminales

El túnel permite abrir las consolas de RabbitMQ como `localhost` aunque tu IP no tenga abiertos los puertos 15672 y 15673; solo
necesita SSH. Si esos puertos sí están abiertos para ti, puedes saltarte la terminal 1 y entrar directo a
`http://<IP-EC2-mq>:15672` (nodo 1) y `:15673` (nodo 2).

| Terminal | Orden | Comando | Esperado |
|---|---|---|---|
| **1 TÚNEL** | único | `ssh -i "<ruta>\key.pem" -N -o ServerAliveInterval=30 -L 15682:localhost:15672 -L 15683:localhost:15673 ec2-user@<IP-EC2-mq>` | Sin prompt. No cerrar |
| **2 MICROSERVICIOS** | 1.º | `ssh -i "<ruta>\key.pem" -o ServerAliveInterval=30 ec2-user@<IP-EC2-ms>` | `[ec2-user@ip-172-31-39-91 ~]$` |
| | 2.º | `cd ~/cleanfresh/cleanfresh-frontend/EP2/despliegue` | `[ec2-user@ip-172-31-39-91 despliegue]$` |
| **3 FRONTEND** | 1.º | `cd <ruta>\cleanfresh-frontend` | — |
| | 2.º | `npm start` | Abre `localhost:3000` |
| **4 RABBITMQ** | 1.º | `ssh -i "<ruta>\key.pem" -o ServerAliveInterval=30 ec2-user@<IP-EC2-mq>` | `[ec2-user@ip-172-31-18-141 ~]$` |
| | 2.º | `cd ~/mq` | `[ec2-user@ip-172-31-18-141 mq]$` |
| | 3.º | `cat .env` | Usuario y clave de la consola |

Si la ruta de la llave o la del frontend es distinta en tu PC, cámbiala en los comandos (`echo $env:USERPROFILE` en PowerShell
muestra tu carpeta de usuario).

### Navegador

| Qué | Dirección |
|---|---|
| Consola rabbit1 | `localhost:15682` |
| Consola rabbit2 (**usar esta todo el flujo**) | `localhost:15683` |
| App Cliente | `localhost:3000` |
| App Operador (ventana de incógnito, selector de sucursal en **Providencia**) | `localhost:3000` |

Se usa la consola de `rabbit2` en todo el flujo porque en la demo 2 se apaga `rabbit1` y su consola deja de responder.

### Cómo se lee la consola de RabbitMQ

- **Queues:** *Ready* son los mensajes esperando que alguien los lea; *Consumers* es cuántos servicios escuchan la cola (con
  `notificaciones` caído es 0); *Node* es el nodo dueño de la cola y `+1` indica que tiene un espejo en el otro. Se refresca con F5.
- **Ver un mensaje sin sacarlo de la cola:** entrar a la cola → **Get messages** → *Ack mode*: **Nack message requeue true** →
  **Get Message(s)**. Siempre con "requeue true", si no el mensaje sale de la cola.
- **Properties** del mensaje: `type` (el tipo de notificación), `delivery_mode = 2` (persistente) y los headers
  `destinatario` y `estado` (Spec 039).

## 2. Antes de empezar

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | Terminal 2 | `sudo docker compose ps -a` | Los 6 servicios **Up** |
| 2 | Terminal 4 | `sudo docker compose ps` | rabbit1 y rabbit2 **healthy** |
| 3 | `15683` → Queues | Revisar `q.cmd.email` | Node **rabbit1 +1** · Ready 0 · Consumers 1 |
| 4 | Terminal 4 | `sudo docker compose exec rabbit1 rabbitmqctl list_queues name slave_pids synchronised_slave_pids` | Cada cola con `rabbit2` en **las dos** columnas. Si no, **no botar rabbit1** |

> Si *Node* dice **rabbit2**: en la demo 2 cambiar `rabbit1` → `rabbit2` en los comandos y usar la consola `15682`.
>
> El paso 4 comprueba que el espejo de `rabbit2` está sincronizado. Si no lo está, al apagar `rabbit1` las colas pueden quedar
> en estado `down` en vez de pasar a `rabbit2`: es el problema que describe la [Fix 040](../specs/040-fix-rabbitmq-cola-caida-al-detener-nodo.md).
> Si pasa, esperar uno o dos minutos y repetir la comprobación, y no reiniciar los nodos varias veces seguidas antes de la demo.

## 3. Demo 1 — El servicio de notificaciones cae y el mensaje persiste

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | Terminal 2 | `sudo docker compose stop notificaciones` | `Stopped` · Consumers **0** |
| 2 | App Cliente | Catálogo → Providencia → Solicitar (Planchado) | `ORD-XXXX` en "Tus pedidos" |
| 3 | `15683` → Queues | F5 | `q.cmd.email` y `q.cmd.kitchen`: Ready **1** |
| 4 | `15683` → `q.cmd.email` → Get messages | **Nack message requeue true** → Get Message(s) | `ORDEN_CREADA` · `delivery_mode 2` · `destinatario SUCURSAL` |

**No levantar `notificaciones`: se sigue con la demo 2.** Si hace falta levantarlo antes: `sudo docker compose start notificaciones`
en la terminal 2 (esperar ~40 s; Ready **0** y Consumers **1**).

> **Qué decir:** "Apagué notificaciones y el pedido se creó igual, porque orders no depende de él: publica el mensaje en
> RabbitMQ y sigue. El mensaje queda guardado en la cola, persistente, esperando a que el servicio vuelva. Eso es el
> desacoplamiento: la caída de un servicio no rompe el flujo del cliente."

Mientras el servicio está caído, el módulo de notificaciones de la app puede mostrar "No se pudieron actualizar los avisos": es lo
esperado, porque los avisos los sirve ese mismo microservicio.

**Alternativa desde tu PC, sin entrar por SSH:** [`servicio-notificaciones.ps1`](../despliegue/servicio-notificaciones.ps1)
(en PowerShell, desde `EP2\despliegue`):

```powershell
.\servicio-notificaciones.ps1 estado -Ip <IP-EC2-ms>   # ver si está arriba
.\servicio-notificaciones.ps1 bajar  -Ip <IP-EC2-ms>   # lo detiene
.\servicio-notificaciones.ps1 subir  -Ip <IP-EC2-ms>   # lo levanta y espera a que responda
```

La ruta de la llave por defecto es la del autor del script; en otro PC agregar siempre `-Llave <ruta>\key.pem`.

## 4. Demo 2 — Cae un nodo de RabbitMQ con un mensaje dentro

Con `notificaciones` todavía caído (si se levantó, volver a detenerlo antes de empezar: `sudo docker compose stop notificaciones`).

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | Terminal 4 | `sudo docker compose stop rabbit1` | `Stopped` |
| 2 | `15682` | F5 | No carga |
| 3 | `15683` → Overview | F5 | rabbit1 en **rojo** |
| 4 | `15683` → Queues | F5 | `q.cmd.email`: Ready **1** · Node **rabbit2** (sin +1) |
| 5 | App Cliente | Otro pedido | `15683`: Ready **2** |
| 6 | Terminal 4 | `sudo docker compose start rabbit1` | — |
| 7 | Terminal 4 | `sudo docker compose ps` (repetir) | rabbit1 **healthy** |
| 8 | `15683` → Queues | F5 | De nuevo **+1** · Ready **2** |

> **Qué decir:** "RabbitMQ funciona como un clúster de dos nodos, y cada cola está replicada en ambos con la política `ha-all`.
> Boté rabbit1, que tenía la copia principal con el mensaje dentro, y el espejo de rabbit2 tomó su lugar: el mensaje no se
> perdió. Los servicios conocen los dos nodos y se reconectaron solos, por eso el segundo pedido también llegó. Cuando rabbit1
> volvió, se resincronizó automáticamente como espejo."

## 5. Cierre de las demos 1 y 2 — Levantar notificaciones

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | Terminal 2 | `sudo docker compose start notificaciones` | Esperar ~40 s |
| 2 | `15683` → Queues | F5 | Ready **0** · Consumers **1** |
| 3 | App Operador | Notificaciones | Los **2** avisos "Nuevo pedido" |

> **Qué decir:** "Al volver notificaciones, consumió los dos mensajes pendientes, los procesó y los confirmó con ACK; recién ahí
> RabbitMQ los borró de la cola. Los dos avisos llegaron al Operador: ni la caída del servicio ni la de un nodo hicieron perder
> un mensaje."

## 6. Demo 3 — Cola muerta (DLQ)

Con `notificaciones` **arriba**, porque es quien reintenta y rechaza el mensaje. Los nombres reales de las colas son
`q.cmd.email` (la normal) y `q.cmd.email.dlq` (su cola muerta).

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | `15683` → Overview | Esperar un pico marrón en el gráfico | — |
| 2 | `15683` → Exchanges → `cmd.direct` → Publish message | Routing key `email.send` · Payload `esto no es json` → Publish | "Message published" |
| 3 | `15683` → Queues | F5 | `q.cmd.email.dlq`: Ready **1** |
| 4 | `15683` → `q.cmd.email.dlq` → Get messages | **Nack message requeue true** → Get Message(s) | `x-death`: `q.cmd.email` · `rejected` |
| 5 | Terminal 2 | **Comando A** | 3 intentos fallidos + NACK |
| 6 | `15683` → Queues | F5 (~30 s después) | `q.cmd.email.dlq`: Ready **0** |
| 7 | Terminal 2 | **Comando B** | `Mensaje NO ENTREGADO ... esto no es json` |
| 8 | Terminal 2 | **Comando C** | El mensaje, primero de la lista |

**Comando A**
```
sudo docker compose logs notificaciones --since 10m | grep -E "intento|NACK"
```
Muestra en el log de notificaciones que el mensaje se intentó procesar **3 veces** y, al fallar todas, se rechazó con **NACK sin
reencolar**. Ese rechazo es lo que lo manda a la cola muerta.

**Comando B**
```
sudo docker compose logs notificaciones --since 10m | grep "NO ENTREGADO"
```
Muestra que notificaciones **sacó el mensaje de la DLQ** (su revisión cada 30 s) y lo registró como no entregado, con la cola de
origen y el motivo (`rejected`). Por eso la DLQ volvió a Ready 0.

**Comando C**
```
curl -s localhost:8083/api/muertos | python3 -m json.tool | head -40
```
Consulta la API de notificaciones, que lee la tabla `mensajes_muertos` de `notificaciones_db` (en la RDS). Prueba que el mensaje
**no se perdió**: quedó guardado de forma permanente con su contenido, cola de origen y motivo, para revisarlo después.

> **Qué decir:** "Publiqué un mensaje defectuoso, que no es JSON, simulando un 'mensaje venenoso'. Notificaciones lo intentó
> procesar 3 veces y, al seguir fallando, lo rechazó sin reencolar para no bloquear la cola. RabbitMQ lo desvió a la cola muerta
> (DLQ), y el header `x-death` indica de qué cola vino y por qué murió. Cada 30 segundos notificaciones vacía la DLQ y guarda el
> mensaje en la base para revisarlo después. Así, un mensaje que falla no se pierde ni detiene el procesamiento de los demás."

Para que el mensaje se vea más tiempo en la cola muerta, hacer el paso 4 enseguida, antes de que `notificaciones` lo registre.
Cada vez que se hace esta demo queda una fila más en `mensajes_muertos`.

## 7. Al terminar

| # | Dónde | Comando | Esperado |
|---|---|---|---|
| 1 | Terminal 2 | `sudo docker compose ps -a` | Los 6 **Up** |
| 2 | Terminal 4 | `sudo docker compose ps` | rabbit1 y rabbit2 **healthy** |

## 8. Referencia: colas y mensajes

| Cola | Cola muerta | Para qué | Cuándo se publica | `type` | `destinatario` |
|---|---|---|---|---|---|
| `q.cmd.email` | `q.cmd.email.dlq` | Aviso a la sucursal (Operador) o al Cliente | Al crear la orden, al despacharla y en cada cambio de estado | `ORDEN_CREADA`, `ORDEN_LISTA` u `ORDEN_ESTADO` | `SUCURSAL` o `CLIENTE` |
| `q.cmd.kitchen` | `q.cmd.kitchen.dlq` | Ticket de taller | Al crear la orden | `ORDEN_CREADA` | `TALLER` |
| `q.cmd.invoice` | `q.cmd.invoice.dlq` | Boleta | Solo al pasar a `DESPACHADO` | `ORDEN_LISTA` | `CLIENTE` |

- **El sobre es el mismo** en las tres colas (número de orden, cliente, servicio, sucursal, total, fecha y estado). Cambia lo que
  `notificaciones` hace con él: crea el aviso, el ticket de taller (texto para quien prepara el servicio) o la boleta (calcula neto =
  total / 1,19, IVA y número `BOL-` + el de la orden).
- **Cancelar un pedido** (solo Admin u Operador) publica un `ORDEN_ESTADO` con `estado = CANCELADO` en `q.cmd.email` y avisa al
  Cliente; no genera boleta ni ticket.
- **Servicio exprés:** las claves llevan sufijo (`email.send.high`, `kitchen.ticket.thermal`, `invoice.gen.pdf`) y entran por `cmd.topic`
  en vez de `cmd.direct`.
- **Exchanges:** `cmd.direct` (direct), `cmd.topic` (topic) y `cmd.dead.dlx` (el de las colas muertas). La topología completa y las
  políticas están en [`despliegue/mq/README.md`](../despliegue/mq/README.md).

## 9. Atajos automáticos

Para ensayar o dejar evidencia sin hacer los pasos a mano (detalle en [`OPERACION.md`](OPERACION.md), secciones 5.3 y 5.9):

| Qué | Comando | Dónde |
|---|---|---|
| Demo 1 y su continuación, narrada, con pausas para mirar la consola | `./demo-notificaciones.sh --pausas` | Terminal 2 |
| Demo 2: cae un nodo | `sudo ./demo-nodo-caido.sh` (usa `q.cmd.email` y la deja vacía) | Terminal 4, en `~/mq` |
| Demo 3 y el resto del flujo | `MQ_DIR=$PWD MQ_API=http://172.31.18.141:15672 ESPERA_DLQ=100 bash mq/verificar-flujo.sh` | Terminal 2 |
| Todo el sistema | `./verificar.sh` | Terminal 2 |

No usar los scripts mientras hay pedidos reales esperando en las colas.

## 10. Si algo falla

| Síntoma | Qué revisar |
|---|---|
| SSH o el túnel no conectan | La IP pública cambió (ver en la consola de EC2) o tu IP no está permitida en el grupo de seguridad |
| La consola no carga en `localhost:15682`/`15683` | El túnel (terminal 1) se cerró; volver a abrirlo |
| La app no inicia sesión | Laboratorio apagado, o `.env` del frontend desactualizado; `redirect_mismatch` si falta la callback `http://localhost:3000/` en Cognito |
| El pedido no aparece | Algún microservicio caído: `sudo docker compose ps -a` en la terminal 2 |
| `Consumers = 0` con `notificaciones` arriba | Esperar ~40 s tras levantarlo; si sigue, `sudo docker compose logs notificaciones` |
| El Operador no ve el aviso | La sucursal en turno del Operador debe ser la del pedido (Providencia) |
| Las colas quedan `down` al apagar `rabbit1` | Espejo sin sincronizar: ver el paso 4 de "Antes de empezar" y la [Fix 040](../specs/040-fix-rabbitmq-cola-caida-al-detener-nodo.md) |

Después de la evaluación hay que apagar o eliminar las EC2, la RDS y la API Gateway, y liberar la Elastic IP (ver la sección 7 de
[`OPERACION.md`](OPERACION.md)).
