import { useAuth } from "react-oidc-context";

function Login() {
  const auth = useAuth();

  const handleLogin = () => {
    auth.signinRedirect();
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo" role="img" aria-label="Clean&Fresh">
          🧺
        </div>
        <h1>Clean&amp;Fresh Manager</h1>
        <p>Por favor inicia sesión para continuar</p>
        <button className="login-btn" onClick={handleLogin}>
          Iniciar sesión
        </button>
        <div className="login-footer">Gestión de lavanderías Clean&amp;Fresh</div>
      </div>
    </div>
  );
}

// Protege el contenido autenticado de la app. No hay React Router (todo
// vive en una sola página), así que el "guard" no protege rutas: protege
// qué se renderiza según haya o no una sesión de Cognito activa.
function AuthGuard({ children }) {
  const auth = useAuth();

  // Mientras oidc-client-ts procesa el callback de login o restaura la
  // sesión desde el storage, no mostrar la pantalla de login (evita el
  // destello de "iniciar sesión" en cada F5 con sesión ya activa).
  if (auth.isLoading) {
    return null;
  }

  if (!auth.isAuthenticated) {
    return <Login />;
  }

  return children;
}

export default AuthGuard;
