# BFF — explicado sin tecnicismos

Este documento es para entender qué es el BFF, qué hace en este
proyecto, y por qué eso es justo lo que pide la evaluación (EP1,
Indicador 2, 40% de la nota). Está pensado para alguien que no conoce
el proyecto en detalle.

## ¿Qué problema resuelve?

El frontend (lo que ve la persona en el navegador) **nunca** debería
hablar directo con las bases de datos ni con la lógica interna del
negocio. Si lo hiciera, cualquiera podría abrir las herramientas de
desarrollador del navegador y manipular las peticiones para, por
ejemplo, ver órdenes de otra sucursal o hacerse pasar por Admin.

Por eso se usa un **BFF** (Backend For Frontend — literalmente,
"backend hecho a medida para este frontend"). Es un servidor propio,
que no ve nadie más que nuestra app, y que cumple dos trabajos:

1. **Portero:** revisa que quien pregunta tenga una credencial válida
   (el token de Azure, explicado en el otro documento) antes de dejarlo
   pasar.
2. **Traductor/intermediario:** una vez que deja pasar a alguien, le va
   a buscar la información real a los otros dos servidores del sistema
   (uno que maneja el catálogo de servicios, otro que maneja las
   órdenes) y se la devuelve ya lista para el frontend.

En este proyecto son **3 servidores Java (Spring Boot) separados**:
el BFF, el de catálogo y el de órdenes. Eso es lo que la pauta llama
"microservicios" — en vez de un solo programa gigante que hace todo,
cada responsabilidad vive en su propio servidor chico.

## ¿Qué hace concretamente, paso a paso?

Cuando el frontend le pide algo al BFF (por ejemplo, "dame la lista de
órdenes"), pasa esto:

### 1. Revisa que la credencial (token) sea real

El BFF no confía a ciegas en el token que le mandan. Antes de hacer
cualquier otra cosa, verifica tres cosas sobre él:

- **Que lo haya emitido Azure** y no cualquier otro sitio (esto se
  llama validar el "issuer", el emisor).
- **Que sea para esta app específica** y no para otra app distinta que
  también use Azure (esto se llama validar el "audience", el
  destinatario).
- **Que la firma digital sea válida y que no esté vencido.** La firma
  es matemáticamente imposible de falsificar sin la clave privada de
  Azure — es la misma idea que un timbre notarial: si no coincide, se
  rechaza.

Si cualquiera de estas tres cosas falla (no hay token, el token es de
mentira, está vencido, o es para otra app), el BFF corta ahí mismo y
responde con un código **401** ("no sé quién sos" / "no estás
autenticado"). No llega ni a mirar qué se estaba pidiendo.

### 2. Revisa qué le está permitido hacer a ese rol

Si el token es válido, el BFF mira qué rol tiene esa persona (Admin,
Operador o Cliente — el mismo dato que ya viene firmado por Azure
dentro del token) y decide si esa acción específica le está permitida.

Por ejemplo: un Cliente puede consultar el catálogo, pero **no** puede
pedir la lista completa de órdenes filtradas por estado — eso es solo
para Admin y Operador. Si un Cliente lo intenta igual (aunque su token
sea válido), el BFF responde con un código **403** ("sí sé quién sos,
pero no te toca hacer esto").

Esta diferencia entre 401 y 403 es justo lo que pide la pauta: no es
lo mismo "no estás logueado" que "estás logueado pero no tenés
permiso" — son dos errores distintos con dos códigos distintos, y acá
se respeta esa diferencia.

### 3. Le pide los datos reales a los otros dos servidores

Recién en este punto, si todo lo anterior pasó, el BFF le pregunta al
servidor de catálogo o al de órdenes por los datos que realmente hacen
falta, y se los devuelve al frontend ya traducidos a un formato simple.

Esos dos servidores internos (catálogo y órdenes) **no hablan
directamente con el navegador de nadie** — solo el BFF les habla a
ellos. Así, toda la seguridad queda concentrada en un solo lugar (el
BFF), en vez de tener que repetir la misma lógica de validación en
cada servidor.

## ¿Por qué esto cumple lo que pide la evaluación?

| Lo que pide la pauta | Qué hicimos |
|---|---|
| Validar issuer y audience correctamente | El BFF los revisa automáticamente contra los datos reales del tenant de Azure de este proyecto |
| Verificar firma y vigencia del token | Mismo mecanismo — si la firma no calza o el token venció, se rechaza |
| Aplicar autorización por rol donde corresponde | Cada acción del BFF tiene declarado explícitamente qué roles la pueden usar |
| Responder con códigos de error adecuados (401/403) | 401 cuando no hay credencial válida, 403 cuando la credencial es válida pero el rol no alcanza |

En otras palabras: **el BFF es el guardia de seguridad de todo el
sistema.** No confía en nada de lo que le llegue del navegador sin
comprobarlo primero, y esa comprobación (quién sos + qué podés hacer)
es exactamente lo que este indicador de la pauta evalúa.
