# Índice de specs y fixes — EP2

Misma metodología Spec-Driven Development que EP1 (spec/fix → plan →
aprobación → implementación → verificación por AC). La **numeración continúa**
la de EP1 (el índice de la entrega anterior llega hasta la 028, en
[`../../EP1/specs/README.md`](../../EP1/specs/README.md)), de modo que
"Spec NNN" sigue siendo inequívoco entre entregas.

Convención de archivos y frontmatter: ver la sección "Convención de archivos"
del índice de EP1; la plantilla está en
[`../../EP1/specs/_template.md`](../../EP1/specs/_template.md).

## Índice

| # | Tipo | Título | Estado | Archivo |
|---|------|--------|--------|---------|
| 029 | Spec | Arquitectura EP2: persistencia, contenedores, mensajería y nuevos microservicios | ✅ Verificado | [029-spec-arquitectura-ep2.md](029-spec-arquitectura-ep2.md) |
| 030 | Spec | Notificaciones dirigidas por SQS: aviso al Operador y al Cliente | ✅ Verificado | [030-spec-notificaciones-dirigidas.md](030-spec-notificaciones-dirigidas.md) |
| 031 | Spec | Búsqueda y navegación de órdenes (Operador y Admin) | ✅ Verificado (datos simulados) | [031-spec-busqueda-ordenes.md](031-spec-busqueda-ordenes.md) |
| 032 | Spec | Nombre legible del cliente y sucursal elegible al solicitar | ✅ Verificado | [032-spec-nombre-cliente-y-sucursal.md](032-spec-nombre-cliente-y-sucursal.md) |
| 033 | Spec | Mensajería de comandos con un clúster RabbitMQ de dos nodos (reemplaza a SQS) | ✅ Implementada y verificada en AWS (con pendientes menores, ver la spec) | [033-spec-rabbitmq.md](033-spec-rabbitmq.md) |
| 034 | Spec | Módulo propio de notificaciones con botón de leído | ✅ Implementada; verificada en el navegador (3 roles, sesión simulada) y desplegada en AWS (falta probarla con sesión real) | [034-spec-modulo-notificaciones.md](034-spec-modulo-notificaciones.md) |
| 035 | Spec | Avisos al Cliente en cada cambio de estado y "Tus pedidos" que se actualiza solo | ✅ Implementada; verificada en el navegador y desplegada en AWS (falta probarla con sesión real) | [035-spec-avisos-por-estado-y-actualizacion-automatica.md](035-spec-avisos-por-estado-y-actualizacion-automatica.md) |
| 036 | Spec | Fecha y hora de cada pedido, y el más reciente arriba (Operador y Cliente) | ✅ Implementada; verificada en el navegador y desplegada en AWS (falta verla con sesión real) | [036-spec-fecha-hora-y-orden-de-pedidos.md](036-spec-fecha-hora-y-orden-de-pedidos.md) |
| 037 | Spec | Topología de RabbitMQ como la guía del profesor (políticas de DLX y bindings del topic) | 🟡 Aprobada (en implementación) | [037-spec-topologia-como-la-guia.md](037-spec-topologia-como-la-guia.md) |
| 038 | Spec | Demostración de las notificaciones: servicio visible por su nombre en RabbitMQ y script de la demo | 🟡 Aprobada (en implementación) | [038-spec-demostracion-notificaciones.md](038-spec-demostracion-notificaciones.md) |
