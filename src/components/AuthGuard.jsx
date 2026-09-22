import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { loginRequest } from "../authConfig";

function Login() {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginRedirect(loginRequest);
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
          Iniciar sesión con Microsoft
        </button>
        <div className="login-footer">Gestión de lavanderías Clean&amp;Fresh</div>
      </div>
    </div>
  );
}

// Protege el contenido autenticado de la app. No hay React Router (todo
// vive en una sola página), así que el "guard" no protege rutas: protege
// qué se renderiza según haya o no una sesión MSAL activa.
function AuthGuard({ children }) {
  const isAuthenticated = useIsAuthenticated();

  if (!isAuthenticated) {
    return <Login />;
  }

  return children;
}

export default AuthGuard;
