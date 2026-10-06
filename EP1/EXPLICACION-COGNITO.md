# Login con AWS Cognito — explicado sin tecnicismos

Este documento es para entender qué es Cognito, qué hace en este
proyecto, y por qué eso es justo lo que pide la evaluación (EP1,
Indicador 1, 60% de la nota). Está pensado para alguien que no conoce
el proyecto en detalle.

> Nota: el proyecto arrancó usando MSAL + Azure AD para esto mismo, y
> se migró a AWS Cognito porque cambió el requisito de la pauta. La
> idea de fondo (delegar el login a un tercero, en vez de programarlo
> nosotros) es exactamente la misma — lo que cambia es quién presta
> ese servicio: antes Microsoft, ahora Amazon.

## ¿Qué problema resuelve?

Cualquier sistema con distintos tipos de usuario (en este caso: Admin,
Operador y Cliente) necesita dos cosas:

1. Saber **quién** está usando la app (login).
2. Saber **qué le está permitido ver o hacer** según quién es (roles).

Podríamos haber programado nosotros mismos un formulario de login con
usuario y contraseña guardados en nuestra propia base de datos. Pero la
evaluación pide específicamente que el login se delegue a un
**proveedor de identidad externo**. Es lo mismo que cuando una página
te deja "Iniciar sesión con Google": la página no guarda tu
contraseña, Google se encarga de todo el login y después le avisa a la
página "sí, es esta persona".

**AWS Cognito** es el servicio de Amazon que hace exactamente eso:
maneja usuarios, contraseñas, y el proceso de login completo, para que
nuestra app nunca tenga que tocar una contraseña.

## ¿Qué hace concretamente en este proyecto?

### 1. Login

Cuando alguien entra a la app sin haber iniciado sesión, ve una
pantalla simple con un botón "Iniciar sesión". Al tocarlo, la app
redirige a una página que administra Cognito (el "Hosted UI") donde la
persona pone su usuario y contraseña. Nosotros nunca vemos ni
guardamos esa contraseña — eso es justamente el punto: la seguridad de
login la maneja AWS, no nuestro código.

Después de un login exitoso, Cognito le entrega a nuestra app dos
"credenciales digitales" (se llaman **tokens**): un token que confirma
quién es la persona, y otro (el que realmente importa acá, el
**access token**) que la app usa para demostrarle a nuestro propio
servidor que quien pregunta está autorizado. Ambos vienen firmados
digitalmente por Cognito: nadie los puede inventar o modificar sin que
se note.

### 2. Roles

En Cognito, a cada usuario se lo puede meter en uno o más **grupos**
(en este proyecto: Admin, Operador o Cliente). Ese grupo se lo
asignamos nosotros de antemano desde el panel de administración de
Cognito para cada cuenta de prueba — no lo decide el usuario, no se
puede falsificar desde el navegador.

La app lee esos grupos del token y, según lo que digan, muestra una
vista distinta:

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
cada una de esas preguntas, va adjunto el **access token** como prueba
de que quien pregunta está realmente logueado y tiene permiso.

Esto pasa automáticamente gracias a un mecanismo que programamos una
sola vez (un "interceptor"): no hay que acordarse de mandar el token a
mano en cada pantalla, se agrega solo antes de que la petición salga
del navegador.

### 4. Logout

Al cerrar sesión, la app borra la credencial guardada en el navegador
y además manda a la persona a una página de Cognito que también cierra
la sesión del lado de AWS. Así, si alguien vuelve a entrar a la app,
tiene que loguearse de nuevo.

## ¿Por qué esto cumple lo que pide la evaluación?

La pauta pide, textual, 5 cosas para la nota máxima de este indicador.
Achicándolo a lenguaje simple:

| Lo que pide la pauta | Qué hicimos |
|---|---|
| Login y logout funcionando | Botones reales que usan Cognito, no un login inventado por nosotros |
| Guards sin fallas | La app nunca muestra una vista de un rol que no corresponde, ni siquiera al recargar la página |
| El token viaja en cada llamada | El interceptor lo agrega automáticamente a toda petición al servidor |
| Se pueden obtener tokens para consumir el servidor (BFF) | La librería renueva el token sola cuando hace falta, sin pedirle a la persona que se loguee de nuevo todo el tiempo |
| Los roles se leen del token, no se inventan | El grupo viene firmado por Cognito dentro del token; la app solo lo lee, no lo decide |

En otras palabras: **todo lo relacionado a "quién sos y qué podés
hacer" lo resuelve Cognito, no nuestro código** — que es exactamente el
punto de usar un proveedor de identidad externo en vez de programar un
login casero. Eso es lo que se está evaluando acá, y es lo que Cognito
nos permite demostrar.
