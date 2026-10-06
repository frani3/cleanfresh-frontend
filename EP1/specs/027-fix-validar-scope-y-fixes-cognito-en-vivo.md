---
id: 027
type: fix
status: verified
---

# Fix 027 — Validar scope en el BFF + fixes en vivo de la migración a Cognito

## Qué estaba mal

Al probar la Spec 026 (migración a Cognito) en un navegador real aparecieron
tres problemas que no se podían detectar sin login real, más una omisión
detectada al revisar la pauta de evaluación clausula por clausula:

1. **"Login pages unavailable"**: error de configuración en `.env`
   (typo en `REACT_APP_COGNITO_CLIENT_ID`), no de código.
2. **401 con `invalid_token` / "no matching key(s) found"**: el BFF
   corría desde un jar viejo — solo se había hecho `mvnw compile`
   (actualiza clases) después de migrar a Cognito, nunca `mvnw
   package` (rearma el jar). El jar en ejecución seguía teniendo
   hardcodeado el issuer de Azure CIAM.
3. **Pedidos del Cliente invisibles**: el BFF guarda `cliente` con el
   claim `username` del access token (un identificador tipo UUID), pero
   el frontend filtraba "Tus pedidos" comparando contra
   `name`/`email` de la sesión — nunca iban a coincidir.
4. **Omisión contra la pauta**: la pauta de evaluación pide
   explícitamente "se leen roles y scopes desde los claims del
   token". Los roles sí se leían (`cognito:groups`), pero ningún
   código leía o validaba el claim `scope` — el scope custom se pedía
   al loguearse pero nada lo inspeccionaba después.

## Comportamiento correcto esperado

1. `.env` con los valores reales de Cognito (client id corregido).
2. El jar del BFF se reconstruye (`mvnw clean package`) después de
   cualquier cambio de código, no solo se compila.
3. "Tus pedidos" (Cliente) filtra comparando contra el mismo claim
   (`cognito:username`, vía el idToken/userinfo) que el BFF usa para
   guardar `cliente` (`username`, vía el access token) — mismo valor
   subyacente de Cognito, dos nombres de claim distintos según el tipo
   de token.
4. `CognitoTokenValidator` (BFF) valida también que el access token
   tenga el scope custom (`https://api.cleanfresh.com/access_as_user`)
   en su claim `scope`, además de `token_use` y `client_id`.

## Acceptance Criteria

1. El login contra Cognito funciona con las credenciales reales del
   `.env`.
2. El BFF valida JWTs contra el issuer de Cognito (no Azure) —
   confirmado que el jar en ejecución corresponde al código actual.
3. Un pedido creado por Cliente aparece en "Tus pedidos" de esa misma
   cuenta.
4. `CognitoTokenValidator` rechaza (401, `insufficient_scope`) un
   access token que no tenga el scope requerido en su claim `scope`.
5. Con un token real y bien configurado, todo sigue funcionando igual
   que antes de agregar la validación de scope (no rompe nada).

## Verificación

| # | AC | Estado |
|---|---|---|
| 1 | Confirmado en vivo por el usuario tras corregir el `.env` | ✅ Cumple |
| 2 | Confirmado en vivo: log de debug mostró el fetch al JWKS de Cognito (no Azure) tras reconstruir el jar con `mvnw clean package` | ✅ Cumple |
| 3 | `ClienteView` ahora filtra por `cognitoUsername` (`account?.profile?.["cognito:username"]`) en vez de `actor`; confirmado en vivo que los pedidos ya creados (ORD-0007 a ORD-0011) aparecen | ✅ Cumple |
| 4 | `CognitoTokenValidator.validate()` agrega el chequeo `scope.split(" ").contains(requiredScope)`, con `insufficient_scope` como error | ✅ Cumple |
| 5 | Confirmado en vivo por el usuario ("todo bien") tras reiniciar el BFF con la validación de scope activa | ✅ Cumple |

Todo verificado en vivo contra el Cognito real de este proyecto (no
solo por lectura de código), a diferencia de la mayoría de los ítems
anteriores de este documento.
