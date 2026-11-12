---
id: 043
type: spec
status: verified
---

# Spec 043 — Documentación ordenada en todos los repositorios

## Qué debe hacer

La documentación había crecido sin estructura: guías de demostración repetidas en cuatro sitios (dos de ellas sin versionar y con
contraseñas en texto plano), una guía de operación con sus secciones fuera de orden, un `README.md` de la raíz que seguía hablando de
Azure y MSAL, ningún índice de la entrega 2, y un `CLAUDE.md` de 538 líneas copiado idéntico en los 8 repositorios.

Se reorganiza solo la **documentación** (no cambia código, scripts ni configuración):

- `EP2/README.md`: índice único de la entrega 2 ("qué leer según lo que necesites").
- `EP2/demostraciones/OPERACION.md`: la antigua `EP2/GUIA-DEMOSTRACION.md`, movida con `git mv`, con las secciones 5.1 a 5.9 en orden,
  un contenido, enlaces corregidos y sin la tabla de IP que se repetía.
- `EP2/demostraciones/RABBITMQ.md`: las tres demostraciones de RabbitMQ en un solo documento, que reúne la guía para el compañero
  (`GUIA-COMPANERO-RABBITMQ.md`) y los dos `DEMOSTRACIONES*.md` sueltos. Sin contraseñas ni rutas o IP personales (van como `<IP-EC2-ms>`,
  `<IP-EC2-mq>` y `<ruta>`).
- `README.md` de la raíz reescrito para el sistema actual (Cognito, `react-oidc-context`, variables `REACT_APP_*`, repos del sistema).
- `EP2/despliegue/README.md` enlaza las demostraciones y documenta `demo-notificaciones.sh` y `servicio-notificaciones.ps1`.
- Los 7 repositorios de servicios: `CLAUDE.md` **corto** (rol, puerto, comandos y enlace al `CLAUDE.md` del frontend) y la sección
  "Arquitectura y decisiones técnicas" de cada `README.md` unificada.
- `CLAUDE.md` del frontend: describe la nueva estructura y las reglas de documentación.

Reglas que quedan: los datos que cambian (IP, recursos) se escriben una sola vez, en `CLAUDE.md`; ningún archivo lleva contraseñas ni
tokens; ya no se sincroniza una copia de `CLAUDE.md` en cada repositorio.

## Fuera de alcance

- Cambiar código, scripts, compose o políticas de RabbitMQ.
- Actualizar las IP públicas (cambian con cada Stop/Start del laboratorio) y reescribir `EP2/EVIDENCIA-EP2.md` o las specs anteriores
  (son registro histórico; algunas nombran `GUIA-DEMOSTRACION.md`, hoy `demostraciones/OPERACION.md`).
- Los borradores 040 a 042 de la otra persona del equipo, salvo la mención de `DEMOSTRACIONES.md` en la 041.

## Acceptance Criteria

1. Existe `EP2/README.md` con el índice y todos sus enlaces apuntan a archivos que existen.
2. `GUIA-DEMOSTRACION.md` está en `EP2/demostraciones/OPERACION.md` (historial conservado) con las secciones 5.1 a 5.9 en orden.
3. `EP2/demostraciones/RABBITMQ.md` cubre las tres demostraciones y reemplaza a los tres documentos anteriores, sin contraseñas.
4. Ningún archivo versionado de los 8 repos contiene contraseñas de usuarios ni la clave de RabbitMQ.
5. Todos los enlaces relativos entre archivos `.md` del repo del frontend, y los de los 7 repos de servicios, apuntan a archivos que existen.
6. Los 7 servicios tienen `CLAUDE.md` corto y `README.md` con la misma sección de arquitectura; el `README.md` de la raíz ya no menciona Azure ni MSAL.
7. Los 8 repos quedan con los cambios en commits y subidos.

## Verificación

| # | AC | Estado |
|---|---|---|
| 1 | Índice `EP2/README.md` con enlaces válidos | ✅ Cumple (revisión de enlaces, ver abajo) |
| 2 | Guía de operación movida y en orden | ✅ Cumple (`git mv`; secciones 5.1 a 5.9 en orden) |
| 3 | `RABBITMQ.md` reemplaza a los tres documentos | ✅ Cumple; los dos `DEMOSTRACIONES*.md` quedaron respaldados fuera del repo |
| 4 | Sin contraseñas en los repos | ✅ Cumple (búsqueda en los 8 repos) |
| 5 | Enlaces relativos válidos | ✅ Cumple (script de revisión de enlaces, ver abajo) |
| 6 | `CLAUDE.md` cortos, READMEs unificados, raíz sin Azure/MSAL | ✅ Cumple |
| 7 | Commits y push en los 8 repos | ✅ Cumple |
