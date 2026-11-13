# Documentación de la entrega 5 (EP5): Kafka

RabbitMQ sigue siendo el canal de **comandos** (EP2). En esta entrega se suma **Apache Kafka para eventos y analítica**: `orders` publica lo que ocurrió, y `reportes` y `auditoria` lo leen a su ritmo
para calcular KPIs y mantener la línea de tiempo de auditoría, que el panel Admin muestra en tiempo casi real. La justificación del diseño está en la [arquitectura](ARQUITECTURA.md) y en la
[Spec 044](specs/044-spec-kafka-eventos-y-analitica.md).

## Qué leer según lo que necesites

| Si quieres… | Lee |
|---|---|
| Entender por qué Kafka y cómo encaja con RabbitMQ (diagrama, tópicos, decisiones) | [`ARQUITECTURA.md`](ARQUITECTURA.md) |
| Presentar las demostraciones (clúster, eventos, grupos, caída de un broker, DLT, administrador) | [`demostraciones/KAFKA.md`](demostraciones/KAFKA.md) |
| Levantar Zookeeper, los brokers y Kafka-UI | [`despliegue/README.md`](despliegue/README.md) |
| Llevarlo a AWS (EC2 de Kafka, bases de la RDS, servicios, BFF) | [`despliegue/AWS.md`](despliegue/AWS.md) |
| Saber qué se hizo en cada paso y cómo se verificó | [`specs/README.md`](specs/README.md) |
| La evidencia de las verificaciones (salidas y capturas) | [`EVIDENCIA-EP5.md`](EVIDENCIA-EP5.md) |
| La arquitectura general, los datos de AWS y RabbitMQ | [`../EP2/README.md`](../EP2/README.md) y [`../CLAUDE.md`](../CLAUDE.md) |

## Estructura

```
EP5/
├── README.md                  # este índice
├── ARQUITECTURA.md            # diagrama, por qué Kafka, tópicos, cómo funciona cada servicio y decisiones
├── EVIDENCIA-EP5.md           # salidas reales de las verificaciones y capturas
├── capturas/                  # el panel Admin con la analítica y la auditoría
├── demostraciones/
│   └── KAFKA.md               # las 8 demostraciones, paso a paso
├── despliegue/
│   ├── README.md              # cómo levantar Kafka y Kafka-UI (local o en una EC2)
│   ├── AWS.md                 # despliegue en AWS (Spec 047)
│   ├── rds-crear-bases.sh/.sql  # reportes_db y auditoria_db en la RDS
│   ├── kafka/                 # docker-compose: Zookeeper x3 + brokers x3 + kafka-init (crear-topicos.sh) y verificar-kafka.sh
│   └── kafka-ui/              # docker-compose: Kafka-UI
└── specs/                     # specs 044 a 047 (+ README con el índice)
```

Las reglas de documentación son las de [`../EP2/README.md`](../EP2/README.md): los datos que cambian (IP, recursos) viven en `CLAUDE.md`, y ningún archivo lleva contraseñas ni tokens.

## Los repositorios de EP5

| Repositorio | Qué aporta |
|---|---|
| [ms-cleanfresh-orders](https://github.com/frani3/ms-cleanfresh-orders) | Productor: publica los eventos de negocio y la auditoría |
| [ms-cleanfresh-reportes](https://github.com/frani3/ms-cleanfresh-reportes) | Consumidor: KPIs, ventas por hora, lead time y servicios más pedidos |
| [ms-cleanfresh-auditoria](https://github.com/frani3/ms-cleanfresh-auditoria) | Consumidor: línea de tiempo y trazabilidad de las órdenes |
| ms-cleanfresh-kafka-admin | Administrador de Kafka: tópicos, configuraciones y consumer groups (el repositorio se publica en GitHub en la entrega) |
| [ms-cleanfresh-bff](https://github.com/frani3/ms-cleanfresh-bff) | `/api/kafka/**`, `/api/reportes/**` y `/api/auditoria/**` para el Admin |
