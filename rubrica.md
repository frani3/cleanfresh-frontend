Actúa como docente evaluador de la asignatura DSY1107 Desarrollo Cloud Native I (DuocUC). Evalúa si mi proyecto cumple con la pauta de la Evaluación Parcial N°1 (Encargo). Revisa el código de los repositorios y para cada requisito indica: CUMPLE / CUMPLE PARCIAL / NO CUMPLE, la evidencia concreta (archivo y línea o fragmento) y qué me falta para llegar al 100%. Al final, asigna el nivel de logro de cada indicador y calcula la nota ponderada.

## CONTEXTO DE ADAPTACIÓN
La pauta original está escrita para Angular + MSAL + Azure AD. Mi proyecto usa tecnologías equivalentes, así que evalúa por equivalencia funcional:
- Frontend: React (Create React App) en vez de Angular.
- IDaaS: AWS Cognito (User Pool + Hosted UI/Managed Login, Authorization Code + PKCE) en vez de Azure AD.
- Librería de autenticación: react-oidc-context + oidc-client-ts en vez de MSAL.
- "Guards" = rutas protegidas en React (componentes que bloquean vistas sin sesión o sin rol).
- "MsalInterceptor" = el mecanismo que adjunta automáticamente el token Bearer en las llamadas HTTP al backend (por ejemplo, apiService.js).
- Roles: vienen del claim "cognito:groups" (grupos Admin, Operador, Cliente).
- Scope personalizado: https://api.cleanfresh.com/access_as_user (Resource Server de Cognito).

Proyecto: Clean&Fresh Manager (caso adaptado de Pedidos360, cadena de lavanderías).
Repositorios:
- Frontend: https://github.com/frani3/Clean-Fresh
- BFF: https://github.com/frani3/ms-cleanfresh-bff
- MS Orders: https://github.com/frani3/ms-cleanfresh-orders
- MS Catalog: https://github.com/frani3/ms-cleanfresh-catalog

## INSTRUCCIONES GENERALES DEL ENCARGO (requisitos obligatorios)
1. El backend debe estar compuesto por varios microservicios en Java con Spring Boot.
2. El código de todos los componentes del backend debe compilar, seguir buenas prácticas y responder a pruebas básicas.
3. El código del frontend debe estar completo, modular, sin errores de compilación y con vistas funcionales.
4. La integración del backend con la base de datos cloud debe estar configurada correctamente mediante entidades, repositorios y propiedades de conexión.
5. El backend debe incluir filtros que validen el JWT recibido desde el IDaaS para autorizar las peticiones.
6. El frontend debe implementar el flujo de login con el IDaaS y usar el JWT en las llamadas al backend.
7. En los repositorios solo debe subirse lo que corresponda a la tecnología utilizada, con los archivos .gitignore necesarios (sin node_modules, target, .env con secretos, etc.).
8. El backend se despliega en instancias EC2 y se protege mediante AWS API Gateway (indica si hay evidencia de configuración o preparación para esto).
9. Entrega: enlaces a GitHub.

## PAUTA DE EVALUACIÓN

Niveles de logro:
- Muy buen desempeño (100%): logro de todos los aspectos evaluados en el indicador.
- Buen desempeño (80%): alto desempeño, con pequeñas omisiones, dificultades y/o errores.
- Desempeño aceptable (60%): logra los elementos básicos, pero con omisiones, dificultades o errores.
- Desempeño incipiente (30%): importantes omisiones o errores; no se evidencian los elementos básicos.
- Desempeño no logrado (0%): ausencia o desempeño incorrecto.

### INDICADOR 1 (Ponderación 60%)
"Configura y utiliza correctamente la librería de autenticación (MSAL → en mi caso react-oidc-context/oidc-client-ts) en conjunto con el frontend, de manera que el flujo de usuario funcione correctamente y permita obtener todos los tokens necesarios."

- 100%: Librería integrada y operativa. El inicio y cierre de sesión funcionan correctamente. Los guards y el interceptor operan sin fallas. Se obtienen los tokens necesarios para consumir el API Gateway y se leen roles y scopes desde los claims del token.
- 80%: El flujo de autenticación funciona y el sistema consume el API Gateway. Hay pequeños detalles de configuración, como fallas leves en guards o lectura parcial de roles.
- 60%: La aplicación autentica, pero presenta fallas intermitentes. A veces no adjunta el token o no renueva correctamente los accesos.
- 30%: El login se muestra, pero el token no se adjunta correctamente en las llamadas o la aplicación usa configuraciones incorrectas del IDaaS.
- 0%: No integra la librería o no logra autenticar en absoluto.

### INDICADOR 2 (Ponderación 40%)
"Configura correctamente el BFF para que, al igual que el API Manager, pueda validar el token recibido con el IDaaS definido y solo permita consumir el endpoint si el token es válido."

- 100%: El BFF valida issuer y audience de forma correcta. Verifica la firma del token y su vigencia. Aplica autorización por rol cuando corresponde y responde con códigos de error adecuados (401/403).
- 80%: La validación es consistente y funcional. Existe algún error muy menor en la autorización o en la forma de entregar mensajes de error.
- 60%: El BFF valida tokens en la mayoría de los endpoints. Algunas rutas no verifican claims críticos como expiración o audience.
- 30%: El BFF solo revisa la presencia del token. No valida firma ni claims relevantes.
- 0%: No valida JWT o permite el acceso sin autenticación.

## FORMATO DE RESPUESTA ESPERADO
1. Tabla con cada requisito general: estado + evidencia + qué falta.
2. Evaluación del Indicador 1: nivel asignado, justificación y mejoras concretas.
3. Evaluación del Indicador 2: nivel asignado, justificación y mejoras concretas.
4. Nota final ponderada: (nivel Ind.1 × 0,60) + (nivel Ind.2 × 0,40).
5. Lista priorizada de cambios para llegar al 100%, del más importante al menos importante.