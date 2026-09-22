# MSAL — explicado sin tecnicismos

Este documento es para entender qué es MSAL, qué hace en este
proyecto, y por qué eso es justo lo que pide la evaluación (EP1,
Indicador 1, 60% de la nota). Está pensado para alguien que no conoce
el proyecto en detalle.

## ¿Qué problema resuelve?

Cualquier sistema con distintos tipos de usuario (en este caso: Admin,
Operador y Cliente) necesita dos cosas:

1. Saber **quién** está usando la app (login).
2. Saber **qué le está permitido ver o hacer** según quién es (roles).

Podríamos haber programado nosotros mismos un formulario de login con
usuario y contraseña guardados en nuestra propia base de datos. Pero la
evaluación pide específicamente que el login se delegue a un
**proveedor de identidad externo** — en este caso, Microsoft (Azure).
Es lo mismo que cuando una página te deja "Iniciar sesión con Google":
la página no guarda tu contraseña, Google se encarga de todo el login y
después le avisa a la página "sí, es esta persona".

**MSAL** (Microsoft Authentication Library) es la librería oficial de
Microsoft para que una aplicación (nuestro frontend en React) hable con
Azure y haga ese login.

## ¿Qué hace concretamente en este proyecto?

### 1. Login

Cuando alguien entra a la app sin haber iniciado sesión, ve una
pantalla simple con un botón "Iniciar sesión con Microsoft". Al
tocarlo, MSAL redirige a una página de Microsoft (Azure) donde la
persona pone su usuario y contraseña. Nosotros nunca vemos ni
guardamos esa contraseña — eso es justamente el punto: la seguridad de
login la maneja Microsoft, no nuestro código.

Después de un login exitoso, Azure le entrega a nuestra app una especie
de "credencial digital" (se llama **token**, específicamente un
**idToken**). Ese token es como una cédula de identidad firmada por
Azure: dice quién es la persona, y viene con una firma digital que
demuestra que es auténtica (nadie la pudo inventar o modificar).

### 2. Roles

Dentro de esa "cédula digital" (el token), además del nombre y el
correo, viene un dato clave para este proyecto: el **rol** de esa
persona (Admin, Operador o Cliente). Ese rol se lo asignamos
nosotros de antemano en el panel de Azure para cada cuenta de prueba —
no lo decide el usuario, no se puede falsificar desde el navegador.

La app lee ese rol del token y, según lo que diga, muestra una vista
distinta:

- **Admin** ve todo: catálogo, órdenes, reportes, auditoría.
- **Operador** ve solo lo necesario para atender pedidos en su
  sucursal.
- **Cliente** ve su catálogo para pedir servicios y sus propios
  pedidos.

Esto es lo que en la evaluación se llama "guards" — no es una palabra
rara, es simplemente: la app protege qué se muestra según quién sos.

### 3. Token en cada llamada al servidor

Cada vez que la app necesita datos reales (por ejemplo, la lista de
órdenes), no le pregunta directo a la base de datos: le pregunta a
nuestro propio servidor (el BFF, explicado en el otro documento). Y en
cada una de esas preguntas, va adjunta la "cédula digital" (el token)
como prueba de que quien pregunta está realmente logueado y tiene
permiso.

Esto pasa automáticamente gracias a un mecanismo que programamos una
sola vez (un "interceptor"): no hay que acordarse de mandar el token a
mano en cada pantalla, se agrega solo antes de que la petición salga
del navegador.

### 4. Logout

Al cerrar sesión, MSAL avisa a Azure que la sesión terminó y borra la
credencial guardada en el navegador. Así, si alguien vuelve a entrar a
la app, tiene que loguearse de nuevo.

## ¿Por qué esto cumple lo que pide la evaluación?

La pauta pide, textual, 5 cosas para la nota máxima de este indicador.
Achicándolo a lenguaje simple:

| Lo que pide la pauta | Qué hicimos |
|---|---|
| Login y logout funcionando | Botones reales que usan Azure, no un login inventado por nosotros |
| Guards sin fallas | La app nunca muestra una vista de un rol que no corresponde, ni siquiera al recargar la página |
| El token viaja en cada llamada | El interceptor lo agrega automáticamente a toda petición al servidor |
| Se pueden obtener tokens para consumir el servidor (BFF) | MSAL renueva el token solo cuando hace falta, sin pedirle a la persona que se loguee de nuevo todo el tiempo |
| Los roles se leen del token, no se inventan | El rol viene firmado por Azure dentro del token; la app solo lo lee, no lo decide |

En otras palabras: **todo lo relacionado a "quién sos y qué podés
hacer" lo resuelve Azure, no nuestro código** — que es exactamente el
punto de usar un proveedor de identidad externo en vez de programar un
login casero. Eso es lo que se está evaluando acá, y es lo que MSAL
nos permite demostrar.
