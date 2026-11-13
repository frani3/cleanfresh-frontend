# Demostraciones de Kafka — Clean&Fresh

Guía paso a paso para mostrar Kafka en la defensa, pensada para ensayarla y presentarla con otra persona sin conocer el proyecto. Complementa a
[`../../EP2/demostraciones/RABBITMQ.md`](../../EP2/demostraciones/RABBITMQ.md) (los comandos de RabbitMQ no cambian). Por qué Kafka y no solo RabbitMQ: ver la [Spec 044](../specs/044-spec-kafka-eventos-y-analitica.md) y
la [arquitectura](../ARQUITECTURA.md).

Las ocho demostraciones, en este orden:

1. El clúster: Zookeeper de 3 nodos, 3 brokers y Kafka-UI.
2. Un pedido genera eventos en dos tópicos.
3. Reportes y auditoría reales en el panel Admin.
4. Consumer groups.
5. Se cae un broker y el sistema sigue.
6. Un mensaje malo va a la cola de mensajes fallidos (DLT).
7. El administrador de Kafka (tópicos y configuraciones).
8. RabbitMQ sigue funcionando igual.

## 1. Preparación

### Qué necesitas

| Qué | Detalle |
|---|---|
| La llave `key.pem` de las EC2 | La entrega quien administra el laboratorio de AWS |
| Tu IP permitida en los grupos de seguridad | SSH (22) en `cleanfresh-sg-kafka` y `cleanfresh-sg-ms`, y Kafka-UI (8090) en `cleanfresh-sg-kafka`. Quien comparte red con el autor ya está permitido |
| El usuario y la clave de Kafka-UI | En el `.env` de `EP5/despliegue/kafka-ui/` en la EC2 de Kafka. No se documentan |
| Los usuarios de la app (Cliente y Admin) | Se piden a quien administra el User Pool de Cognito. No se documentan |
| El repo del frontend clonado, con su `.env` | `npm install` hecho |
| El laboratorio encendido y Kafka desplegado | Ver [`../despliegue/AWS.md`](../despliegue/AWS.md) |

Las **IP públicas** cambian cada vez que se apaga el laboratorio (consola de EC2 → Instances): donde dice `<IP-EC2-kafka>` o `<IP-EC2-ms>` va la vigente.

### Terminales y navegador

| Terminal | Orden | Comando | Esperado |
|---|---|---|---|
| **1 KAFKA** | 1.º | `ssh -i "<ruta>\key.pem" -o ServerAliveInterval=30 ec2-user@<IP-EC2-kafka>` | `[ec2-user@ip-... ~]$` |
| | 2.º | `cd ~/cleanfresh-frontend/EP5/despliegue/kafka` | |
| **2 MICROSERVICIOS** | 1.º | `ssh -i "<ruta>\key.pem" -o ServerAliveInterval=30 ec2-user@<IP-EC2-ms>` | |
| | 2.º | `cd ~/cleanfresh/cleanfresh-frontend/EP2/despliegue` | |
| **3 FRONTEND** | 1.º | `cd <ruta>\cleanfresh-frontend` y `npm start` | Abre `localhost:3000` |

| Navegador | Dirección |
|---|---|
| **Kafka-UI** | `http://<IP-EC2-kafka>:8090` (usuario y clave del `.env` de `kafka-ui/`) |
| App Cliente y Admin (ventana de incógnito para el segundo) | `localhost:3000` |

### Cómo se lee Kafka-UI

- **Brokers**: los 3 brokers, con su rol de controlador y las particiones que lideran.
- **Topics → un tópico**: *Overview* (particiones, réplicas, mensajes), *Messages* (el contenido, la clave, la partición, el offset y las cabeceras), *Consumers* (qué grupos lo leen), *Settings* (la configuración).
- **Consumers**: los consumer groups con su estado, miembros y *lag* (mensajes que le faltan por leer).

### Antes de empezar

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | Terminal 1 | `./verificar-kafka.sh` | **Todo OK** |
| 2 | Terminal 2 | `docker compose ps` | Los 7 servicios **Up** |

## 2. Demo 1 — El clúster: Zookeeper ×3, brokers ×3 y Kafka-UI

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | Terminal 1 | `docker compose ps` | `zk1`, `zk2`, `zk3`, `kafka1`, `kafka2` y `kafka3` **healthy** |
| 2 | Terminal 1 | `for z in zk1 zk2 zk3; do docker compose exec -T $z bash -c 'echo srvr \| nc localhost 2181 \| grep Mode'; done` | Un `leader` y dos `follower` |
| 3 | Kafka-UI → **Brokers** | — | **3 brokers**, uno de ellos controlador |
| 4 | Kafka-UI → **Topics** | — | `orders.events`, `audit.timeline` y los tres `.DLT`, cada uno con **3 particiones** y **réplicas 3** |
| 5 | Kafka-UI → `orders.events` → **Settings** | — | `cleanup.policy = delete`, `retention.ms = 604800000` (7 días), `min.insync.replicas = 2` |
| 6 | Kafka-UI → `audit.timeline` → **Settings** | — | `cleanup.policy = compact,delete`, `retention.ms = 2592000000` (30 días) |

> **Qué decir:** "El clúster tiene tres brokers coordinados por un Zookeeper de tres nodos. Cada tópico tiene tres particiones y tres réplicas: cada partición está copiada en los tres brokers. Con `min.insync.replicas = 2` y `acks = all`, un evento confirmado ya está en al menos dos brokers, así que se tolera la caída de uno sin perder datos. `orders.events` borra a los 7 días; `audit.timeline` usa `compact,delete`, que conserva el último registro por clave y borra lo viejo a los 30 días."

## 3. Demo 2 — Un pedido genera eventos en dos tópicos

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | Kafka-UI → `orders.events` → **Messages** | Anotar cuántos hay | — |
| 2 | App Cliente | Catálogo → sucursal → **Solicitar** (por ejemplo, Planchado) | `ORD-XXXX` en "Tus pedidos" |
| 3 | Kafka-UI → `orders.events` → **Messages** | Actualizar | Un mensaje nuevo: clave `ORD-XXXX`, cabeceras `type = OrderCreated`, `eventId` y `traceId`; el cuerpo es el evento con `payload` (servicio, sucursal, total, estado `CREADO`, actor) |
| 4 | Kafka-UI → `audit.timeline` → **Messages** | Actualizar | Un registro nuevo: clave `orden:ORD-XXXX:<eventId>`, con `actor` (el cliente), `accion = OrderCreated` y `origen` (la IP) |
| 5 | App Admin o Operador | Abrir la orden → **Ajustar estado** → **Aceptado** → Confirmar | — |
| 6 | Kafka-UI → `orders.events` | Actualizar | `OrderAccepted` con la **misma clave** `ORD-XXXX` y **la misma partición** que `OrderCreated` |

> **Qué decir:** "Cada cambio de una orden publica un evento en `orders.events`, con el número de orden como clave: todos los eventos de una misma orden caen en la misma partición y se leen en orden. Además se publica un registro de auditoría en `audit.timeline` con quién lo hizo y desde qué IP. El envío es asíncrono: si Kafka estuviera caído, la orden se guarda y responde igual."

## 4. Demo 3 — Reportes y auditoría reales en el panel Admin

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | App Admin → pestaña **Analítica** | Elegir **24 horas** | Pedidos, ventas, ticket promedio, **lead time**, **estados activos**, ventas por hora, servicios más pedidos y pedidos por sucursal |
| 2 | App Cliente | Hacer otro pedido | — |
| 3 | App Admin → **Analítica** | Esperar unos 15 s (o **Actualizar**) | Los números suben y aparece en el gráfico de ventas por hora y en "Estados activos" |
| 4 | App Admin → pestaña **Auditoría** | — | La línea de tiempo con quién hizo qué, cuándo y desde dónde |
| 5 | Auditoría | Filtrar por **Usuario**, **Evento** o **Fechas** → **Buscar** | Solo los registros que coinciden |
| 6 | Auditoría | Pulsar el número de una orden | **Historia de ORD-XXXX**: cada estado, quién lo hizo y desde dónde |

> **Qué decir:** "Los reportes no consultan a `orders`: `reportes` lee los eventos de Kafka y calcula ventas, lead time y estados activos con su propia base. Si `orders` está lento o caído, los reportes siguen disponibles, y si cambiamos cómo se calcula un KPI se puede reconstruir releyendo los eventos desde el principio. La auditoría es de solo lectura: no hay forma de modificar un registro por la API."

## 5. Demo 4 — Consumer groups

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | Kafka-UI → **Consumers** | — | Dos grupos: `reportes-kpis` y `auditoria-registro`, ambos **Stable**, con **lag 0** |
| 2 | Kafka-UI → `reportes-kpis` | Abrir el grupo | 3 miembros, uno por partición de `orders.events` |
| 3 | Kafka-UI → `auditoria-registro` | Abrir el grupo | Lee **dos tópicos** (`audit.timeline` y `orders.events`), una partición por hilo |
| 4 | Terminal 2 | `curl -s localhost:8087/api/kafka/groups/reportes-kpis` | JSON con los miembros, sus particiones y el lag por partición (lo mismo que muestra Kafka-UI) |

> **Qué decir:** "`reportes` y `auditoria` leen los mismos eventos de `orders.events` pero cada uno con su propio grupo, así que cada uno recibe todos los mensajes y avanza a su ritmo: uno puede ir atrasado sin afectar al otro. Dentro de un grupo, las particiones se reparten entre las instancias: si levantamos una segunda instancia de `reportes`, comparte la carga o queda de respaldo, y si la primera cae, la segunda toma sus particiones sin perder mensajes. El offset solo avanza después de guardar el evento (commit manual)."

## 6. Demo 5 — Se cae un broker y el sistema sigue

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | Kafka-UI → `orders.events` → **Overview** | Ver la tabla de particiones | Cada una con su líder y réplicas `1, 2, 3` en sincronía |
| 2 | Terminal 1 | `docker compose stop kafka3` | `Stopped` |
| 3 | Kafka-UI → **Brokers** (tras ~10 s) | Actualizar | **2 brokers** activos |
| 4 | Kafka-UI → `orders.events` → **Overview** | — | Las particiones que lideraba `kafka3` pasaron a otro broker; **In sync replicas = 2** |
| 5 | App Cliente | Hacer otro pedido | Se crea igual; aparece el evento nuevo en `orders.events` (con `acks = all` y 2 réplicas sincronizadas) |
| 6 | Terminal 1 | `docker compose start kafka3` | — |
| 7 | Kafka-UI → `orders.events` → **Overview** (tras ~1 min) | Actualizar | De nuevo las 3 réplicas en sincronía |

La misma comprobación, automática: `./verificar-kafka.sh --caida` (detiene `kafka3`, publica y lee con `acks = all`, lo levanta y espera la resincronización).

> **Qué decir:** "Al caer un broker, Kafka elige nuevos líderes entre las réplicas sincronizadas y el sistema sigue. Como cada tópico exige dos réplicas sincronizadas (`min.insync.replicas = 2`) y los productores usan `acks = all`, con un broker caído todavía se puede publicar; con dos caídos se dejaría de aceptar escrituras antes que arriesgar perder datos. Cuando el broker vuelve, se resincroniza solo."

## 7. Demo 6 — Un mensaje malo va a la cola de mensajes fallidos (DLT)

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | Kafka-UI → `orders.events` → **Produce Message** | Clave `ORD-0100`, valor `esto no es json` → **Produce** | "Message produced" |
| 2 | Kafka-UI → **Topics** | Actualizar | `orders.events.reportes.DLT` y `orders.events.auditoria.DLT` con **1 mensaje** cada uno |
| 3 | Kafka-UI → `orders.events.reportes.DLT` → **Messages** | Abrir el mensaje | El **valor original** (`esto no es json`) y las cabeceras `kafka_dlt-exception-fqcn`, `kafka_dlt-exception-stacktrace`, `kafka_dlt-original-topic`, `kafka_dlt-original-partition`, `kafka_dlt-original-offset` y el grupo |
| 4 | Terminal 2 | `docker compose logs reportes auditoria --since 5m \| grep "NO PROCESADO"` | Una línea por servicio: tópico, partición, offset, clave, DLT de destino y causa |
| 5 | App Cliente | Hacer otro pedido | **Se procesa con normalidad** (el mensaje malo no detuvo el consumo) |
| 6 | Terminal 2 | `curl -s localhost:8087/api/kafka/metricas` | `"hayAlerta": true` y la lista de DLT con mensajes |

> **Qué decir:** "Publiqué un mensaje que no es JSON. Ni `reportes` ni `auditoria` pudieron leerlo, y como reintentarlo no lo arregla, cada uno lo mandó a su propio Dead Letter Topic con el mensaje original y el motivo del error, y siguieron con los demás. Si el error fuera pasajero, por ejemplo la base caída un momento, se reintenta tres veces con espera creciente antes de mandarlo al DLT. El administrador de Kafka avisa cuando un DLT tiene mensajes."

## 8. Demo 7 — El administrador de Kafka

`ms-cleanfresh-kafka-admin` (:8087) usa la API de administración de Kafka. Solo se llega por el BFF y solo con rol **Admin**. Desde la consola del navegador (F12 → Console), con la sesión de **Admin** iniciada (Chrome pide escribir `allow pasting` antes de pegar):

```js
const k = Object.keys(sessionStorage).find(k => k.startsWith('oidc.user:'));
const t = JSON.parse(sessionStorage[k]).access_token;
const base = 'https://0ksy5y3586.execute-api.us-east-1.amazonaws.com/api/kafka/';
const llamar = async (m, r, cuerpo) => { const x = await fetch(base + r, {method: m, headers: {Authorization: 'Bearer ' + t, 'Content-Type': 'application/json'}, body: cuerpo && JSON.stringify(cuerpo)}); console.log(m, r, x.status, (await x.text()).slice(0, 300)); };
await llamar('GET', 'cluster');                                   // id del clúster y sus 3 brokers
await llamar('GET', 'topics');                                    // tópicos con particiones, réplicas, política y retención
await llamar('GET', 'groups');                                    // consumer groups
await llamar('GET', 'groups/reportes-kpis');                      // miembros, particiones y lag
await llamar('POST', 'topics/demo.pagos', {particiones: 3, replicas: 3, configuracion: {'retention.ms': '3600000'}});   // crear un tópico
await llamar('PUT', 'topics/demo.pagos/config', {configuracion: {'retention.ms': '7200000'}});                         // modificar su retención
await llamar('PUT', 'topics/demo.pagos/partitions', {particiones: 6});                                                 // subir particiones
await llamar('GET', 'topics/demo.pagos');                         // ver el resultado
await llamar('DELETE', 'topics/demo.pagos');                      // eliminarlo
await llamar('DELETE', 'topics/orders.events');                   // 409: es un tópico base, hace falta force=true
await llamar('GET', 'metricas');                                  // mensajes por tópico, lag por grupo y alertas
```

Esperado: `200` en todas con rol **Admin** (salvo el último `DELETE`, que da `409`); con **Operador** o **Cliente**, `403`; sin token, `401`. El administrador tiene Swagger:
`ssh -L 8087:localhost:8087 ec2-user@<IP-EC2-ms>` y abrir `http://localhost:8087/swagger-ui.html`. También se ve en Kafka-UI: aparece y desaparece `demo.pagos` en **Topics**.

> **Qué decir:** "El administrador crea, lista, describe, modifica y elimina tópicos, cambia sus configuraciones —retención, política de limpieza, mínimo de réplicas—, sube particiones y muestra los consumer groups con su lag. Los tópicos base del sistema están protegidos: borrarlos exige `force=true`. Restaurar la topología base es idempotente."

## 9. Demo 8 — RabbitMQ sigue funcionando igual

Kafka no reemplazó a RabbitMQ: cada uno hace lo suyo. RabbitMQ lleva los **comandos** (enviar un aviso, generar una boleta: alguien debe ejecutarlos y el mensaje desaparece al confirmarse). Kafka lleva los **eventos**
(algo ya ocurrió: varios servicios lo leen a su ritmo y el mensaje se conserva). Con los dos encendidos, las demostraciones de [`RABBITMQ.md`](../../EP2/demostraciones/RABBITMQ.md) (servicio de notificaciones caído, nodo caído y cola
muerta) se hacen igual; al crear una orden, `orders` publica en RabbitMQ (aviso, ticket y boleta) **y** en Kafka (evento y auditoría), y si uno de los dos cae el otro sigue funcionando.

| # | Dónde | Comando / acción | Esperado |
|---|---|---|---|
| 1 | Terminal 2 | `./verificar.sh` | **Todo OK** (incluye el recorrido por RabbitMQ) |
| 2 | Terminal 2 | `./demo-notificaciones.sh` | Termina en "Demostración completa" |

## 10. Al terminar

| # | Dónde | Comando | Esperado |
|---|---|---|---|
| 1 | Terminal 1 | `docker compose ps` | Los 6 contenedores del clúster **healthy** |
| 2 | Terminal 2 | `docker compose ps` | Los 7 servicios **Up** |
| 3 | Terminal 1 | `./verificar-kafka.sh` | **Todo OK** |

## 11. Si algo falla

| Síntoma | Qué revisar |
|---|---|
| SSH o Kafka-UI no abren | La IP pública cambió (ver en AWS) o tu IP no está permitida en `cleanfresh-sg-kafka` |
| Kafka-UI pide usuario y clave | Están en el `.env` de `EP5/despliegue/kafka-ui/` (terminal 1: `cat ../kafka-ui/.env`) |
| La Analítica no carga | `reportes` o el administrador caídos: `docker compose ps` en la terminal 2; el panel lo reintenta solo cada 15 s |
| No aparecen eventos nuevos | `KAFKA_ENABLED` en `false` en el `.env` de `EP2/despliegue`, o `orders` no alcanza los brokers (`docker compose logs orders \| grep -i kafka`) |
| El broker no vuelve a sincronizarse | Esperar 1 a 2 minutos; `./verificar-kafka.sh` muestra las particiones con réplicas sin sincronizar |
| Más casos | [`../despliegue/AWS.md`](../despliegue/AWS.md), sección "Problemas frecuentes" |
