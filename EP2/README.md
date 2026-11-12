# Documentación de la entrega 2 (EP2)

Índice de todo lo que hay en esta carpeta y de qué leer según lo que necesites.

## Qué leer según lo que necesites

| Si quieres… | Lee |
|---|---|
| Entender cómo está armado el sistema | [`ARQUITECTURA.md`](ARQUITECTURA.md) |
| Los datos de AWS (IP, recursos, grupos de seguridad) | [`../CLAUDE.md`](../CLAUDE.md), sección "Despliegue en AWS" (única fuente) |
| Levantar los servicios con Docker | [`despliegue/README.md`](despliegue/README.md) |
| Levantar o entender el clúster de RabbitMQ | [`despliegue/mq/README.md`](despliegue/mq/README.md) |
| Operar las EC2, ver logs, reiniciar, verificar | [`demostraciones/OPERACION.md`](demostraciones/OPERACION.md) |
| Presentar las demostraciones de RabbitMQ (servicio caído, nodo caído, cola muerta) | [`demostraciones/RABBITMQ.md`](demostraciones/RABBITMQ.md) |
| La evidencia de que cada punto funciona en AWS | [`EVIDENCIA-EP2.md`](EVIDENCIA-EP2.md) |
| Saber por qué se hizo cada cambio y cómo se verificó | [`specs/README.md`](specs/README.md) |

## Estructura

```
EP2/
├── README.md                 # este índice
├── ARQUITECTURA.md           # diagrama y decisiones de la entrega 2
├── EVIDENCIA-EP2.md          # salidas reales de las verificaciones en AWS
├── demostraciones/
│   ├── OPERACION.md          # operar y verificar (antes GUIA-DEMOSTRACION.md)
│   └── RABBITMQ.md           # las 3 demostraciones de RabbitMQ, paso a paso
├── despliegue/
│   ├── README.md             # docker compose de los microservicios y scripts de verificación
│   ├── docker-compose.yml, .env.example
│   ├── verificar.sh, demo-desacople.sh, demo-notificaciones.sh, servicio-notificaciones.ps1
│   └── mq/                   # clúster RabbitMQ: compose, definiciones, políticas y scripts
└── specs/                    # specs y fixes 029 en adelante (+ README con el índice)
```

## Cómo se documenta (resumen)

- Cada cambio funcional tiene su **spec** o **fix** en [`specs/`](specs/), con Acceptance Criteria y su verificación. La numeración
  continúa la de EP1 ([`../EP1/specs/README.md`](../EP1/specs/README.md)).
- Lo que cambia seguido (IP, recursos) se escribe **una sola vez**, en `CLAUDE.md`, y los demás documentos lo enlazan.
- Las contraseñas y los tokens no se documentan en ningún archivo del repositorio.
- Cada microservicio tiene su propio `README.md` (endpoints, variables, cómo levantarlo) en su repositorio:
  [bff](https://github.com/frani3/ms-cleanfresh-bff), [orders](https://github.com/frani3/ms-cleanfresh-orders),
  [catalog](https://github.com/frani3/ms-cleanfresh-catalog),
  [notificaciones](https://github.com/frani3/ms-cleanfresh-notificaciones),
  [reportes](https://github.com/frani3/ms-cleanfresh-reportes),
  [auditoría](https://github.com/frani3/ms-cleanfresh-auditoria) y
  [mq-admin](https://github.com/frani3/ms-cleanfresh-mq-admin).

La entrega 1 está en [`../EP1/`](../EP1/) (cerrada).
