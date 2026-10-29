# Guía rápida para la evaluación: las 3 demostraciones de RabbitMQ

Para quien presenta o ayuda en la evaluación. Cada demostración se puede hacer sin leer el resto del proyecto.

## 0. Antes de empezar

### Qué hay en AWS

| Qué | Dónde |
|---|---|
| Frontend | `http://localhost:3000` (se levanta en tu PC con `npm start` en la carpeta del frontend) |
| EC2 de microservicios (`cleanfresh-ms`) | IP pública **34.201.162.21** (corre `notificaciones` y los demás servicios) |
| EC2 de RabbitMQ (`cleanfresh-mq`) | IP pública **54.221.189.167** (corre `rabbit1` y `rabbit2`) |
| Consola de RabbitMQ, nodo 1 | `http://54.221.189.167:15672` |
| Consola de RabbitMQ, nodo 2 | `http://54.221.189.167:15673` |

**Las IP públicas cambian cada vez que se apaga y se vuelve a encender el laboratorio de AWS.** Si no coinciden, se ven en la consola de AWS → EC2 → Instances (`cleanfresh-ms` y `cleanfresh-mq`). En todo este texto, reemplaza las IP por las vigentes.

### Qué necesitas

- La llave `key.pem` de las EC2 (pídela a quien armó el proyecto).
- Que **tu IP esté permitida** en los grupos de seguridad de las EC2 (SSH y panel de RabbitMQ). Si SSH o la consola no abren, es lo primero que hay que revisar.
- El usuario y la clave de la consola de RabbitMQ: están en el archivo `.env` de `EP2/despliegue/` (variables `RABBITMQ_USER` y `RABBITMQ_PASSWORD`).
- Un usuario con rol **Cliente** y otro con rol **Operador** en la app (se pide el correo y la clave a quien armó el proyecto).
- Tener clonado el repositorio del frontend: https://github.com/frani3/cleanfresh-frontend

### Cómo entrar por SSH

Desde PowerShell:

```powershell
# EC2 de microservicios (notificaciones)
ssh -i C:\ruta\key.pem ec2-user@34.201.162.21

# EC2 de RabbitMQ (nodos rabbit1 y rabbit2)
ssh -i C:\ruta\key.pem ec2-user@54.221.189.167
```

### Cómo botar y levantar el microservicio de notificaciones

Hay dos formas. La primera es la más simple.

**Forma 1: con el script (desde tu PC).** En PowerShell, dentro de `EP2\despliegue` del repositorio:

```powershell
.\servicio-notificaciones.ps1 estado -Ip 34.201.162.21   # ver si está arriba o caído
.\servicio-notificaciones.ps1 bajar  -Ip 34.201.162.21   # lo bota
.\servicio-notificaciones.ps1 subir  -Ip 34.201.162.21   # lo levanta y espera a que responda
```

Si la llave no está en `C:\Users\franc\Downloads\key.pem`, agrega `-Llave C:\ruta\key.pem`.

**Forma 2: a mano, por SSH** (ya dentro de la EC2 de microservicios):

```bash
cd ~/cleanfresh/cleanfresh-frontend/EP2/despliegue
sudo docker compose stop notificaciones     # botarlo
sudo docker compose start notificaciones    # levantarlo
sudo docker compose ps -a                   # ver el estado de todos
```

Con el servicio caído, el módulo de notificaciones de la app puede mostrar "No se pudieron actualizar los avisos". Es normal.

### Cómo botar y levantar un nodo de RabbitMQ

Por SSH a la EC2 de RabbitMQ:

```bash
cd ~/mq
sudo docker compose stop rabbit1      # botar el nodo 1
sudo docker compose start rabbit1     # levantarlo de nuevo
sudo docker compose ps                # ver el estado de los dos nodos
```

Lo mismo con `rabbit2`.

### Cómo se lee la consola de RabbitMQ

1. Abre `http://54.221.189.167:15672` e ingresa con el usuario y la clave del `.env`.
2. Pestaña **Queues**: ahí están las colas. Las columnas que importan:
   - **Ready**: mensajes esperando que alguien los lea.
   - **Consumers**: cuántos servicios están escuchando la cola (con `notificaciones` caído es 0).
3. Para ver un mensaje sin sacarlo de la cola: entra a la cola → baja a **Get messages** → *Ack mode*: **Nack message requeue true** → **Get Message(s)**. Siempre con "requeue true", si no el mensaje se saca de la cola.
4. En el mensaje, **Properties** muestra:
   - `type`: el tipo de notificación (`ORDEN_CREADA` es un pedido nuevo)
   - `delivery_mode = 2`: el mensaje es persistente (se guarda en disco)
   - headers `destinatario` (`SUCURSAL` es el aviso al Operador, `TALLER` es el ticket) y `estado`.

### Las colas que se usan

| Cola | Para qué |
|---|---|
| `q.cmd.email` | Avisos a Operador y Cliente |
| `q.cmd.kitchen` | Ticket de taller |
| `q.cmd.invoice` | Boleta |
| `q.cmd.email.dlq`, `q.cmd.kitchen.dlq`, `q.cmd.invoice.dlq` | Colas muertas: ahí van los mensajes que no se pudieron procesar |

---

## Demostración 1: el mensaje se mantiene en RabbitMQ mientras `notificaciones` está caído

**Qué se demuestra:** si el microservicio que recibe los avisos está caído, el pedido igual se hace y el mensaje no se pierde: espera guardado en la cola hasta que el servicio vuelve, y entonces llega al Operador.

1. **Abrir la consola** de RabbitMQ (nodo 1) → **Queues**. Dejar a la vista `q.cmd.email` y `q.cmd.kitchen` (ambas con Ready = 0 y Consumers = 1).
2. **Botar `notificaciones`** (ver arriba). En la consola, Consumers de las colas pasa a **0**.
3. **Entrar a la app como Cliente** (`http://localhost:3000`):
   - En el **Catálogo**, elegir una **sucursal** (por ejemplo, Providencia).
   - Pulsar **Solicitar** en un servicio (por ejemplo, Planchado).
   - El pedido aparece en "Tus pedidos".
4. **Mirar la consola** (actualizar la página de Queues):
   - `q.cmd.email` y `q.cmd.kitchen` quedan con **Ready = 1** y **Consumers = 0**. Ese es el mensaje guardado porque nadie lo está leyendo.
   - Entrar a `q.cmd.email` → **Get messages** (requeue true). Se ve `type = ORDEN_CREADA`, `delivery_mode = 2` (persistente) y `destinatario = SUCURSAL`.
5. **Levantar `notificaciones`** (ver arriba) y esperar unos segundos. En la consola, **Ready vuelve a 0** y **Consumers a 1**: el servicio recibió los mensajes pendientes.
6. **Entrar como Operador** de esa sucursal: en el módulo de notificaciones aparece el aviso "Nuevo pedido ORD-XXXX …".

Qué decir: el mensaje estuvo guardado en RabbitMQ (persistente) todo el tiempo que el servicio estuvo caído, y se entregó apenas volvió. El pedido nunca falló, porque `orders` y `notificaciones` no dependen uno del otro.

---

## Demostración 2: se cae un nodo de RabbitMQ y el mensaje sigue en el otro, hasta llegar al Operador

**Qué se demuestra:** el clúster tiene dos nodos que guardan copia de cada cola. Si uno cae con un mensaje esperando, el otro lo conserva, y el mensaje llega igual al Operador.

1. **Abrir las dos consolas** en dos pestañas: nodo 1 (`:15672`) y nodo 2 (`:15673`). En **Overview → Nodes** se ven los dos nodos en verde.
2. **Botar `notificaciones`** (para que el mensaje se quede esperando).
3. **Hacer un pedido como Cliente** (igual que en la demostración 1). Queda **Ready = 1** en `q.cmd.email`.
4. **Botar el nodo 1** (por SSH a la EC2 de RabbitMQ):
   ```bash
   cd ~/mq
   sudo docker compose stop rabbit1
   ```
5. **Mirar la consola del nodo 2** (`:15673`; la del nodo 1 deja de responder): `rabbit1` aparece caído (rojo), pero `q.cmd.email` **sigue con Ready = 1**. La copia espejo del nodo 2 pasó a ser la cola principal.
6. **Hacer otro pedido como Cliente**. Entra igual (los servicios se reconectan solos al nodo que sigue vivo): Ready = 2.
7. **Levantar el nodo 1**: `sudo docker compose start rabbit1`. Vuelve a verde y se sincroniza solo.
8. **Levantar `notificaciones`** (ver arriba). Ready baja a 0.
9. **Entrar como Operador**: aparecen los avisos de los dos pedidos.

Qué decir: aunque se cayó un nodo con el mensaje dentro, no se perdió, porque cada cola está replicada en los dos nodos (política `ha-all`). Los servicios usan la lista de los dos nodos, así que cambian de uno al otro sin intervención.

Alternativa automática, que narra todo paso a paso (por SSH a la EC2 de RabbitMQ). Usa la cola `q.cmd.email` y la deja vacía, así que no usarla con pedidos reales en espera:

```bash
cd ~/mq
sudo ./demo-nodo-caido.sh
```

---

## Demostración 3: colas muertas (qué pasa si un mensaje no se puede procesar)

**Qué se demuestra:** un mensaje que `notificaciones` no logra procesar se reintenta 3 veces; si sigue fallando, no se pierde ni bloquea la cola: RabbitMQ lo manda a la cola muerta (`q.cmd.email.dlq`), y queda registrado.

Hacerla con `notificaciones` **arriba**, porque es quien reintenta y rechaza el mensaje.

1. **Abrir la consola** → **Queues** y dejar a la vista `q.cmd.email.dlq` (Ready = 0).
2. **Publicar un mensaje defectuoso:** pestaña **Exchanges** → `cmd.direct` → **Publish message**:
   - *Routing key*: `email.send`
   - *Payload*: `esto no es json`
   - Pulsar **Publish message**.
3. **Ver la cola muerta:** en **Queues**, `q.cmd.email.dlq` pasa a **Ready = 1** a los pocos segundos (el servicio lo intentó 3 veces y lo rechazó).
4. Entrar a `q.cmd.email.dlq` → **Get messages** (requeue true). En los headers aparece `x-death`: la cola de origen (`q.cmd.email`) y el motivo (`rejected`).
5. **Ver el registro** (unos 30 segundos después `notificaciones` lo registra y confirma, y la cola muerta vuelve a 0). Por SSH a la EC2 de microservicios:
   ```bash
   cd ~/cleanfresh/cleanfresh-frontend/EP2/despliegue
   curl -s localhost:8083/api/muertos
   sudo docker compose logs notificaciones | grep "NO ENTREGADO"
   ```
   Si se quiere mostrar el mensaje en la cola muerta con calma, hacer el paso 4 enseguida, antes de que se limpie.

Qué decir: las colas normales y las muertas son distintas. El mensaje que falla no se pierde: queda en `q.cmd.email.dlq` para revisarlo, y el sistema sigue procesando los demás. Lo mismo ocurre en `q.cmd.kitchen.dlq` y `q.cmd.invoice.dlq`.

Dato extra para el profesor: el administrador de RabbitMQ avisa cuando hay mensajes en una cola muerta (`GET /api/mq/metricas` con rol Admin responde `hayAlerta: true`).

Alternativa automática: `verificar-flujo.sh` incluye este caso (mensaje defectuoso → 3 intentos → cola muerta → registro). Por SSH a la EC2 de microservicios:

```bash
cd ~/cleanfresh/cleanfresh-frontend/EP2/despliegue
MQ_DIR=$PWD MQ_API=http://172.31.18.141:15672 ESPERA_DLQ=100 bash mq/verificar-flujo.sh
```

---

## Si algo no funciona

| Síntoma | Qué revisar |
|---|---|
| SSH o la consola de RabbitMQ no abren | La IP pública cambió (ver en AWS) o tu IP no está permitida en el grupo de seguridad |
| La app no inicia sesión | El laboratorio de AWS apagado, o `.env` del frontend desactualizado |
| El pedido no aparece | Revisar que los 6 microservicios estén arriba: `sudo docker compose ps` en la EC2 de microservicios |
| `Consumers = 0` aunque `notificaciones` está arriba | Esperar unos segundos tras levantarlo; si sigue en 0, `sudo docker compose logs notificaciones` |
| El Operador no ve el aviso | Confirmar que la sucursal en turno del Operador es la misma del pedido |

Después de la evaluación hay que apagar o eliminar las EC2, la RDS y la API Gateway, y liberar la Elastic IP, porque cuestan mientras existan.
