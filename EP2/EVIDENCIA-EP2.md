# Evidencia EP2

Comandos ejecutados y resultados obtenidos al verificar la Spec 029 sobre el
despliegue en AWS (`us-east-1`). Complementa la tabla de verificación de
[`specs/029-spec-arquitectura-ep2.md`](specs/029-spec-arquitectura-ep2.md). Los
valores de los recursos están en la sección "Despliegue en AWS" de `CLAUDE.md`.
Contraseñas y tokens no se incluyen.

> **Capturas de pantalla:** por adjuntar en `EP2/capturas/` (panel del Admin,
> del Operador y del Cliente con `ORD-0008`, y las pantallas de la consola de
> AWS).

## 1. Persistencia en RDS (ACs 1–4, 13)

En la EC2 #2, con las bases creadas en la RDS y los servicios levantados con
`docker compose up -d --build`:

```bash
curl -s localhost:8081/api/orders | head -c 150   # [{"id":1,"numeroOrden":"ORD-0001",...
curl -s localhost:8082/api/catalog | head -c 150  # [{"id":1,"nombre":"Lavado y secado",...
```

Se creó una orden y se reinició `orders`; las 7 órdenes siguieron ahí:

```bash
curl -s -X POST localhost:8081/api/orders -H 'Content-Type: application/json' \
  -d '{"cliente":"Prueba RDS","servicio":"Planchado","total":9500,"sucursal":"Providencia"}'
# {"id":7,"numeroOrden":"ORD-0007",...,"estado":"CREADO",...}
docker compose restart orders; sleep 35
curl -s localhost:8081/api/orders | grep -o '"numeroOrden"' | wc -l   # 7
```

Incidente: la primera vez `orders` y `catalog` entraron en bucle de reinicios con
`FATAL: database "orders_db" does not exist`. En RDS, `CREATE DATABASE ... OWNER x`
requiere ser miembro de `x`; se resolvió con `GRANT orders_user TO postgres` (y
lo mismo para `catalog_user`) y creando las bases. Ambos servicios arrancaron
solos gracias a `restart: unless-stopped`.

## 2. Mensajería SQS (ACs 9–11)

Con `SQS_ENABLED=true` y el `LabInstanceProfile` de la EC2 #2, tras el `POST` de
`ORD-0007`:

```bash
docker compose logs notificaciones 2>&1 | grep "ORD-"
# Notificación: la orden ORD-0007 de Prueba RDS (Planchado, sucursal Providencia, total 9500.0) fue creada
```

## 3. Red y seguridad (ACs 16–17)

Desde la máquina de desarrollo (fuera de AWS):

| Prueba | Resultado |
|---|---|
| Puertos 8081–8085 de la EC2 #2 | sin respuesta |
| Puerto 5432 de la RDS (IP privada `172.31.77.18`) | sin respuesta |
| `GET /actuator/health` al BFF (`:8080`) | 200, `status: UP` |
| `GET /api/orders` al BFF sin token | 401 |
| `GET /api/orders` a API Gateway sin token | 401 (authorizer) |
| `GET /api/orders` a API Gateway con token falso | 401 |
| Preflight `OPTIONS /api/orders` con `Origin: http://localhost:3000` | 200, con `access-control-allow-origin: http://localhost:3000` (lo resuelve el BFF) |

Autorización por rol, desde la consola del navegador con el access token real de
cada sesión (`GET https://<api-gateway>/api/reportes` y `/api/auditoria`):

| Rol | `/api/reportes` | `/api/auditoria` |
|---|---|---|
| Admin | 200 | 200 |
| Operador | 403 | 403 |

## 4. Flujo completo con los tres roles (AC 18)

En `http://localhost:3000`, con usuarios de Cognito:

- **Cliente:** solicitó "Lavado y secado". Se creó `ORD-0008`; `orders` la guardó
  en la RDS y publicó `ORDEN_CREADA`; `notificaciones` registró:
  `Notificación: la orden ORD-0008 de 64888468-1021-70ae-1c1b-36e6f67b3175 (Lavado y secado, sucursal Providencia, total 25000.0) fue creada`.
  El `cliente` es el `username` del access token (UUID).
- **Admin:** panel de administración con las 8 órdenes (incluida `ORD-0008`) y
  las pestañas de analítica y auditoría.
- **Operador:** panel operativo con KPIs, gestión de órdenes y catálogo; ve las
  órdenes de la sucursal en turno (Providencia: `ORD-0001`, `ORD-0007`, `ORD-0008`).

Incidente: el primer intento de login falló con `redirect_mismatch`. La app envía
`redirect_uri=http://localhost:3000/` y el App Client solo tenía registrado
`http://localhost:3000/redirect.html`. Se agregó la URL exacta con la barra final
y el login funcionó.

## 5. Reinicios (ACs 14–15)

| Prueba | Resultado |
|---|---|
| Reinicio de la EC2 #1 | `bff Up 17 seconds`, `/actuator/health` 200 |
| Reinicio de la EC2 #2 | los 5 contenedores volvieron solos, pero la máquina quedó sin responder (ni SSH ni Instance Connect) |
| Stop → cambio a `t3.medium` → Start de la EC2 #2 | 5 contenedores `Up`, `curl localhost:8081/api/orders` → 8 órdenes, `free -m` 3835 MB |

La causa del cuelgue fue memoria: cinco JVM con el heap por defecto en una
`t3.small` (2 GB) con el swap perdido tras el reinicio. Se subió a `t3.medium` y
se dejó el swap en `/etc/fstab` (`Swap: 2047`).

## 6. Verificación final automatizada (`verificar.sh --reiniciar`)

Ejecutada en la EC2 #2 sobre el despliegue en AWS, con el `LabInstanceProfile`
para SQS y las credenciales de cada servicio para la RDS. Crea una orden de
prueba (`ORD-0009`), por eso las órdenes pasan de 8 a 9.

```
1) Contenedores
  OK   orders Up 14 minutes
  OK   catalog Up 14 minutes
  OK   notificaciones Up 14 minutes
  OK   reportes Up 14 minutes
  OK   auditoria Up 14 minutes
2) Servicios responden
  OK   orders: 8 órdenes
  OK   catalog: 5 servicios
  OK   reportes: respuesta fija
  OK   auditoria: respuesta fija
  OK   notificaciones: proceso activo (HTTP 404; no tiene endpoints propios)
3) Bases de datos en la RDS (consulta directa con el usuario de cada servicio)
  OK   orders_db: 8 órdenes, última ORD-0008
  OK   catalog_db: 5 servicios, 20 filas de disponibilidad por sucursal
4) Aislamiento: cada usuario solo entra a su base
  OK   orders_user NO puede entrar a catalog_db
  OK   catalog_user NO puede entrar a orders_db
5) Cola SQS: orders publica y notificaciones consume
  OK   orden creada: ORD-0009 (Verificacion-040315)
  OK   notificaciones recibió ORD-0009 desde SQS: Notificación: la orden ORD-0009 de Verificacion-040315 (Planchado, sucursal Providencia, total 9500.0) fue creada
  OK   orders sin errores de publicación
6) Persistencia tras reiniciar orders
  OK   antes: 9, después: 9 órdenes

Todo OK
```

Esto demuestra en vivo: los 5 servicios en Docker, los datos en PostgreSQL
(RDS) con una base y un usuario por servicio, el aislamiento entre bases, el
recorrido completo por SQS y la persistencia tras un reinicio.
