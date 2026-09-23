import { UserManager } from "oidc-client-ts";

// Config de AWS Cognito (Hosted UI + Authorization Code flow). Antes se
// usaba MSAL contra Azure Entra External ID; el requisito de la
// evaluación cambió a Cognito, ver EXPLICACION-MSAL.md/README para el
// contexto de la migración.
export const cognitoAuthConfig = {
  authority: process.env.REACT_APP_COGNITO_AUTHORITY,
  client_id: process.env.REACT_APP_COGNITO_CLIENT_ID,
  redirect_uri: `${window.location.origin}/`,
  response_type: "code",
  scope: `openid email profile ${process.env.REACT_APP_API_SCOPE}`,
  post_logout_redirect_uri: window.location.origin,
  loadUserInfo: true,
};

// Cognito no implementa el end_session_endpoint estándar de OIDC — hay
// que armar la URL de logout a mano contra el dominio del Hosted UI
// (ver Navbar.jsx).
export const cognitoDomain = process.env.REACT_APP_COGNITO_DOMAIN;

// Una única instancia de UserManager, compartida entre el AuthProvider
// (index.js, para los hooks de React) y apiService.js (que no es un
// componente y no puede usar el hook useAuth() — necesita leer el
// usuario/token actual directamente).
export const userManager = new UserManager(cognitoAuthConfig);

export const bffApiUrl = process.env.REACT_APP_BFF_URL || "http://localhost:8080/api";
