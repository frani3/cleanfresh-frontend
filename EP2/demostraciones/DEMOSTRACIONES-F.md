# Demostraciones RabbitMQ — Clean&Fresh

Flujo seguido de la 1 a la 3: notificaciones se apaga en la Demo 1 y se vuelve a encender al final de la Demo 2.

## Terminales

| Terminal | Orden | Comando | Esperado |
|---|---|---|---|
| **1 TÚNEL** | único | `ssh -i "C:\Users\franc\Downloads\key.pem" -N -o ServerAliveInterval=30 -L 15682:localhost:15672 -L 15683:localhost:15673 ec2-user@184.197.107.103` | Sin prompt. No cerrar |
| **2 MICROSERVICIOS** | 1.º | `ssh -i "C:\Users\franc\Downloads\key.pem" -o ServerAliveInterval=30 ec2-user@52.86.68.49` | `[ec2-user@ip-172-31-39-91 ~]$` |
| | 2.º | `cd ~/cleanfresh/cleanfresh-frontend/EP2/despliegue` | `[ec2-user@ip-172-31-39-91 despliegue]$` |
| **3 FRONTEND** | 1.º | `cd C:\CloudNative\cleanfresh-frontend` | — |
| | 2.º | `npm start` | Abre `localhost:3000` |
| **4 RABBITMQ** | 1.º | `ssh -i "C:\Users\franc\Downloads\key.pem" -o ServerAliveInterval=30 ec2-user@184.197.107.103` | `[ec2-user@ip-172-31-18-141 ~]$` |
| | 2.º | `cd ~/mq` | `[ec2-user@ip-172-31-18-141 mq]$` |
| | 3.º | `cat .env` | Usuario y clave de la consola |

| Navegador | Dirección |
|---|---|
| Consola rabbit1 | `localhost:15682` |
| Consola rabbit2 (**usar esta todo el flujo**) | `localhost:15683` |
| App Cliente | `localhost:3000` |
| App Operador (incógnito, selector **Providencia**) | `localhost:3000` |

## Antes de empezar

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | Terminal 2 | `sudo docker compose ps -a` | Los 6 servicios **Up** |
| 2 | Terminal 4 | `sudo docker compose ps` | rabbit1 y rabbit2 **healthy** |
| 3 | `15683` → Queues | Revisar `q.cmd.email` | Node **rabbit1 +1** · Ready 0 · Consumers 1 |
| 4 | Terminal 4 | `sudo docker compose exec rabbit1 rabbitmqctl list_queues name slave_pids synchronised_slave_pids` | Cada cola con `rabbit2` en **las dos** columnas. Si no, **no botar rabbit1** |

> Si Node dice **rabbit2**: en la Demo 2 cambiar `rabbit1` → `rabbit2` y usar la consola `15682`.

## Demo 1 — Notificaciones caído

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | Terminal 2 | `sudo docker compose stop notificaciones` | `Stopped` · Consumers **0** |
| 2 | App Cliente | Catálogo → Providencia → Solicitar (Planchado) | `ORD-XXXX` en "Tus pedidos" |
| 3 | `15683` → Queues | F5 | `q.cmd.email` y `q.cmd.kitchen`: Ready **1** |
| 4 | `15683` → `q.cmd.email` → Get messages | **Nack message requeue true** → Get Message(s) | `ORDEN_CREADA` · `delivery_mode 2` · `destinatario SUCURSAL` |

**No levantar notificaciones: se sigue con la Demo 2.**

| Si hace falta levantarlo | Dónde | Comando | Esperado |
|---|---|---|---|
| Volver a levantar notificaciones | Terminal 2 | `sudo docker compose start notificaciones` | Esperar ~40 s · Ready **0** · Consumers **1** |

> **Qué decir:** "Apagué notificaciones y el pedido se creó igual, porque orders no depende de él: publica el mensaje en RabbitMQ y sigue. El mensaje queda guardado en la cola, persistente, esperando a que el servicio vuelva. Eso es el desacoplamiento: la caída de un servicio no rompe el flujo del cliente."

## Demo 2 — Cae un nodo de RabbitMQ

| Si notificaciones se volvió a levantar | Dónde | Comando | Esperado |
|---|---|---|---|
| Volver a bajarlo antes de empezar | Terminal 2 | `sudo docker compose stop notificaciones` | `Stopped` · Consumers **0** |

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

> **Qué decir:** "RabbitMQ funciona como un clúster de dos nodos, y cada cola está replicada en ambos con la política `ha-all`. Boté rabbit1, que tenía la copia principal con el mensaje dentro, y el espejo de rabbit2 tomó su lugar: el mensaje no se perdió. Los servicios conocen los dos nodos y se reconectaron solos, por eso el segundo pedido también llegó. Cuando rabbit1 volvió, se resincronizó automáticamente como espejo."

## Cierre Demo 1 y 2 — Levantar notificaciones

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | Terminal 2 | `sudo docker compose start notificaciones` | Esperar ~40 s |
| 2 | `15683` → Queues | F5 | Ready **0** · Consumers **1** |
| 3 | App Operador | Notificaciones | Los **2** avisos "Nuevo pedido" |

> **Qué decir:** "Al volver notificaciones, consumió los dos mensajes pendientes, los procesó y los confirmó con ACK; recién ahí RabbitMQ los borró de la cola. Los dos avisos llegaron al Operador: ni la caída del servicio ni la de un nodo hicieron perder un mensaje."

## Demo 3 — Cola muerta (DLQ)

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
Muestra en el log de notificaciones que el mensaje se intentó procesar **3 veces** y, al fallar todas, se rechazó con **NACK sin reencolar**. Ese rechazo es lo que lo manda a la cola muerta.

**Comando B**
```
sudo docker compose logs notificaciones --since 10m | grep "NO ENTREGADO"
```
Muestra que notificaciones **sacó el mensaje de la DLQ** (su revisión cada 30 s) y lo registró como no entregado, con la cola de origen y el motivo (`rejected`). Por eso la DLQ volvió a Ready 0.

**Comando C**
```
curl -s localhost:8083/api/muertos | python3 -m json.tool | head -40
```
Consulta la API de notificaciones, que lee la tabla `mensajes_muertos` en la base de datos. Prueba que el mensaje **no se perdió**: quedó guardado de forma permanente con su contenido, cola de origen y motivo, para revisarlo después.

> **Qué decir:** "Publiqué un mensaje defectuoso, que no es JSON, simulando un 'mensaje venenoso'. Notificaciones lo intentó procesar 3 veces y, al seguir fallando, lo rechazó sin reencolar para no bloquear la cola. RabbitMQ lo desvió a la cola muerta (DLQ), y el header `x-death` indica de qué cola vino y por qué murió. Cada 30 segundos notificaciones vacía la DLQ y guarda el mensaje en la base para revisarlo después. Así, un mensaje que falla no se pierde ni detiene el procesamiento de los demás."

## Al terminar

| # | Dónde | Comando | Esperado |
|---|---|---|---|
| 1 | Terminal 2 | `sudo docker compose ps -a` | Los 6 **Up** |
| 2 | Terminal 4 | `sudo docker compose ps` | rabbit1 y rabbit2 **healthy** |

admin@cleanfresh.com
CleanFresh2026!

operador@cleanfresh.com
CleanFresh2026!

cliente@cleanfresh.com
CleanFresh2026!

## Revisar en el computador de Francisca (antes de empezar)

| # | Qué revisar | Cómo | Si no coincide |
|---|---|---|---|
| 1 | **Carpeta de usuario** | PowerShell: `echo $env:USERPROFILE` | Debe salir `C:\Users\franc`. Si sale otro nombre, cambiar `franc` en los 3 comandos `ssh` (terminales 1, 2 y 4) |
| 2 | **Carpeta del frontend** | Explorador de archivos: buscar la carpeta `cleanfresh-frontend` | Si no está en `C:\CloudNative\cleanfresh-frontend`, cambiar el `cd` de la terminal 3. Dentro debe estar el `.env` y haberse corrido `npm install` |
