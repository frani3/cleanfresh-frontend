# Documentación de la entrega 5 (EP5): Kafka

RabbitMQ sigue siendo el canal de **comandos** (EP2). En esta entrega se suma **Apache Kafka para eventos y analítica**: `orders` y `catalog`
publican lo que ocurrió, y `reportes` y `auditoria` lo leen a su ritmo para calcular KPIs y mantener la línea de tiempo. La justificación del
diseño está en la [Spec 044](specs/044-spec-kafka-eventos-y-analitica.md).

## Qué leer según lo que necesites

| Si quieres… | Lee |
|---|---|
| Entender por qué Kafka y qué viaja por él | [`specs/044-spec-kafka-eventos-y-analitica.md`](specs/044-spec-kafka-eventos-y-analitica.md) |
| Levantar Zookeeper, los brokers y Kafka-UI | [`despliegue/README.md`](despliegue/README.md) |
| Saber qué se hizo en cada paso y cómo se verificó | [`specs/README.md`](specs/README.md) |
| La evidencia de las verificaciones | [`EVIDENCIA-EP5.md`](EVIDENCIA-EP5.md) |
| La arquitectura general, los datos de AWS y RabbitMQ | [`../EP2/README.md`](../EP2/README.md) y [`../CLAUDE.md`](../CLAUDE.md) |

## Estructura

```
EP5/
├── README.md                  # este índice
├── EVIDENCIA-EP5.md           # salidas reales de las verificaciones
├── despliegue/
│   ├── README.md
│   ├── kafka/                 # docker-compose: Zookeeper x3 + brokers x3 + kafka-init (crear-topicos.sh)
│   └── kafka-ui/              # docker-compose: Kafka-UI
└── specs/                     # specs y fixes 044 en adelante (+ README con el índice)
```

Las reglas de documentación son las de [`../EP2/README.md`](../EP2/README.md): los datos que cambian (IP, recursos) viven en `CLAUDE.md`, y ningún
archivo lleva contraseñas ni tokens.
