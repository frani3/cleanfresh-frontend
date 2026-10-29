---
id: 041
type: fix
status: draft
---

# Fix 041 — Un solo docker compose que levante todo el backend

## Qué estaba mal

Spec 029 (contenedores) y Spec 033 (clúster RabbitMQ). Observación del profesor en la presentación: el despliegue usa
**dos** `docker-compose.yml` que no se conocen entre sí.

| Archivo | EC2 | Levanta |
|---|---|---|
| `EP2/despliegue/docker-compose.yml` | ms (`cleanfresh-ms`) | orders, catalog, notificaciones, mq-admin, reportes, auditoria |
| `EP2/despliegue/mq/docker-compose.yml` | mq (`cleanfresh-mq`) | rabbit1, rabbit2, mq-init |

Consecuencias:

- **Sin orden de arranque:** `depends_on` solo funciona dentro de un mismo archivo. Los microservicios no pueden esperar
  a que RabbitMQ esté `healthy` ni a que `mq-init` cargue la topología; dependen de sus reintentos.
- **Recuperación manual:** si se cae o se reinicia una parte (por ejemplo la EC2 de RabbitMQ), hay que entrar por SSH a
  esa máquina y levantarla a mano; un `docker compose up` del otro lado no la recupera.
- **Configuración duplicada y por IP:** dos `.env` con las credenciales de RabbitMQ, y los servicios se conectan por la
  IP privada de otra EC2 (`RABBITMQ_ADDRESSES`, `RABBITMQ_MGMT_URLS`) en vez de por nombre de servicio.

## Comportamiento correcto esperado

- Un único `EP2/despliegue/docker-compose.yml` con los 6 microservicios, `rabbit1`, `rabbit2` y `mq-init`, en una red
  común. `docker compose up -d --build` levanta todo, en orden:
  1. `rabbit1` hasta `healthy`; después `rabbit2` (se une al clúster).
  2. `mq-init` carga la topología y las políticas (Fix 040).
  3. `orders`, `notificaciones` y `mq-admin` arrancan recién cuando `mq-init` terminó
     (`depends_on` con `condition: service_completed_successfully`); `catalog`, `reportes` y `auditoria` no dependen de
     RabbitMQ.
- Los servicios se conectan por nombre: `RABBITMQ_ADDRESSES=rabbit1:5672,rabbit2:5672` y
  `RABBITMQ_MGMT_URLS=http://rabbit1:15672/api,http://rabbit2:15672/api`, fijos en el compose (no en el `.env`).
  `RABBIT_ENABLED` pasa a `true` por defecto.
- Un solo `.env` (`.env.example` con `RABBITMQ_USER`, `RABBITMQ_PASSWORD` y `RABBITMQ_ERLANG_COOKIE`); se elimina
  `mq/docker-compose.yml` y `mq/.env.example`. `mq/` conserva `join-cluster.sh`, `definitions.json`, `politicas/` y los
  scripts de verificación, que pasan a usar el compose y el `.env` de la carpeta superior.
- Los nodos de RabbitMQ llevan `mem_limit` para convivir con las 6 JVM en la misma EC2 (el límite de memoria de
  RabbitMQ se calcula sobre él).
- Se mantienen los puertos publicados (5672/5673 y 15672/15673) para el túnel SSH de la consola, que ahora apunta a la
  EC2 `cleanfresh-ms`.
- Despliegue: el compose único corre en la EC2 `cleanfresh-ms`; la EC2 `cleanfresh-mq` queda sin uso (detenerla después
  de verificar). Antes, comprobar la memoria de `cleanfresh-ms` (`free -h`) y, si no alcanza, subir el tipo de instancia.
- Se actualizan `README.md` de `despliegue/` y de `mq/`, la guía de demostración y `DEMOSTRACIONES.md` (terminales,
  túnel y carpeta).

## Fuera de alcance

- El BFF: sigue en su propia EC2 detrás del API Gateway.
- Repartir el compose en varias máquinas (eso requiere un orquestador: Docker Swarm, Kubernetes o ECS). Queda como
  mejora propuesta.

## Acceptance Criteria

1. Existe un solo `docker-compose.yml` en `EP2/despliegue/` y `docker compose config` lo valida sin errores.
2. En una máquina limpia, un único `docker compose up -d --build` deja los 6 microservicios `Up`, `rabbit1` y `rabbit2`
   `healthy` y `mq-init` terminado con código 0.
3. `docker compose ps` muestra que `orders`, `notificaciones` y `mq-admin` arrancaron después de que terminó `mq-init`.
4. Tras `sudo reboot` de la EC2, todo vuelve a estar arriba sin intervención (`restart: unless-stopped` y Docker
   habilitado al arranque).
5. Ningún servicio usa IPs en la configuración de RabbitMQ: solo nombres de servicio.
6. `verificar.sh`, `verificar-mq.sh`, `verificar-flujo.sh` y las 3 demostraciones funcionan contra el compose único.
