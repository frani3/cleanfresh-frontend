---
id: 016
type: spec
status: verified
---

# Spec 016 — Sucursal en `ms-orders` + filtro por rol en el BFF

## Qué debe hacer

`ms-cleanfresh-orders` agrega el campo `sucursal` a cada orden (mismas 4
sucursales: Providencia, Ñuñoa, Las Condes, Maipú). El BFF, al
responder `GET /api/orders` y `GET /api/orders/estado/{estado}`, filtra
automáticamente las órdenes según el rol del que pregunta:

- **Admin**: ve todas las órdenes, de todas las sucursales (sin cambios).
- **Operador**: ve solo las órdenes de **su** sucursal. La sucursal del
  operador sale de un mapeo simple email→sucursal en el propio BFF (no
  hay base de datos ni claim custom en Azure para esto todavía).
- **Cliente**: sin cambios — ve todas las órdenes igual que hoy (filtrar
  "mis propias órdenes" es un problema distinto, fuera de esta spec).

De paso, se corrige el mismo tipo de desajuste que en la Spec 015: el
`OrderResponse` del BFF no coincide con el contrato real de
`ms-orders` (le faltan `numeroOrden`, `servicio` y `cliente`; tiene
`clienteId`/`clienteNombre`/`fechaCreacion` que no existen en el
origen).

## Acceptance Criteria

1. `OrderResponse` en `ms-orders` agrega el campo `String sucursal`.
2. Las 6 órdenes mock de `ms-orders` quedan repartidas entre las 4
   sucursales (no todas en la misma).
3. `GET /api/orders`, `/api/orders/{id}` y `/api/orders/estado/{estado}`
   de `ms-orders` devuelven `sucursal` sin romper el resto de los campos.
4. El DTO `OrderResponse` del BFF se corrige para reflejar el contrato
   real: `id`, `numeroOrden`, `cliente`, `servicio`, `estado`, `fecha`
   (`String`), `total` (`Double`), `sucursal`.
5. El BFF tiene un mapeo email→sucursal (mínimo el usuario de prueba
   `Operador@CleanFreshChain.onmicrosoft.com` → una sucursal fija).
6. `GET /api/orders` del BFF: si quien llama tiene rol Admin, devuelve
   todas las órdenes; si tiene rol Operador, devuelve solo las de su
   sucursal (según el mapeo del AC5); si tiene rol Cliente, devuelve
   todas (sin cambios).
7. `GET /api/orders/estado/{estado}` del BFF aplica el mismo filtro por
   sucursal para Operador que el AC6 (este endpoint ya es exclusivo de
   Admin/Operador, no lo usa Cliente).
8. `GET /api/orders/{id}` del BFF: si quien llama es Operador y la orden
   pedida no es de su sucursal, no la devuelve (mismo resultado que si
   no existiera) — no se filtra para Admin.
9. Si un Operador no tiene sucursal asignada en el mapeo del AC5, ve una
   lista vacía en vez de ver todo (evita que un operador "huérfano" vea
   de más por defecto).
10. No se agrega ningún endpoint de escritura (`POST`/`PUT`/`DELETE`).
