import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { loginRequest } from "./authConfig";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Catalog from "./pages/Catalog";
import Reports from "./pages/Reports";
import Audit from "./pages/Audit";
import "./App.css";

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

function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">{children}</div>
    </div>
  );
}

function App() {
  const isAuthenticated = useIsAuthenticated();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoute allowedRoles={["Admin", "Operador", "Cliente"]}>
              <AppLayout>
                <Orders />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/catalog"
          element={
            <ProtectedRoute allowedRoles={["Admin", "Operador", "Cliente"]}>
              <AppLayout>
                <Catalog />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AppLayout>
                <Reports />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AppLayout>
                <Audit />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
