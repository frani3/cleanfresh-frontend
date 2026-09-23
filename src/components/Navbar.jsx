import { useAuth } from "react-oidc-context";
import { WashingMachine, Sparkles, LogOut, Shield, Wrench, User } from "lucide-react";
import { cognitoAuthConfig, cognitoDomain } from "../authConfig";

const ROLE_BADGE = {
  Admin: { className: "role-badge role-badge-admin", Icon: Shield },
  Operador: { className: "role-badge role-badge-operador", Icon: Wrench },
  Cliente: { className: "role-badge role-badge-cliente", Icon: User },
};

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function RoleBadge({ role }) {
  const config = ROLE_BADGE[role];
  if (!config) return null;
  const { className, Icon } = config;
  return (
    <span className={className}>
      <Icon size={13} />
      {role}
    </span>
  );
}

function Navbar() {
  const auth = useAuth();
  const profile = auth.user?.profile;

  const displayName = profile?.name || profile?.email;
  const roles = profile?.["cognito:groups"] || [];
  const primaryRole = roles.includes("Admin")
    ? "Admin"
    : roles.includes("Operador")
    ? "Operador"
    : roles.includes("Cliente")
    ? "Cliente"
    : null;

  // Cognito no implementa el end_session_endpoint estándar de OIDC:
  // hay que borrar la sesión local y después mandar al navegador al
  // endpoint /logout del Hosted UI a mano.
  const handleLogout = async () => {
    await auth.removeUser();
    const logoutUrl = new URL(`${cognitoDomain}/logout`);
    logoutUrl.searchParams.set("client_id", cognitoAuthConfig.client_id);
    logoutUrl.searchParams.set("logout_uri", cognitoAuthConfig.post_logout_redirect_uri);
    window.location.href = logoutUrl.toString();
  };

  return (
    <header className="navbar2">
      <div className="navbar2-inner">
        <div className="navbar2-brand">
          <span className="navbar2-logo">
            <WashingMachine size={19} />
            <Sparkles size={15} className="navbar2-logo-sparkle" />
          </span>
          <div>
            <h1 className="navbar2-title">
              Clean<span className="navbar2-title-accent">&amp;</span>Fresh
            </h1>
            <p className="navbar2-subtitle">Manager</p>
          </div>
        </div>

        <div className="navbar2-right">
          <div className="navbar2-user">
            <div className="navbar2-avatar">{getInitials(displayName)}</div>
            <div className="navbar2-user-info">
              <p className="navbar2-user-name">{displayName || "Cargando..."}</p>
              <p className="navbar2-user-email">{profile?.email}</p>
            </div>
            {primaryRole && <RoleBadge role={primaryRole} />}
            <button className="navbar2-logout" onClick={handleLogout} aria-label="Cerrar sesión">
              <LogOut size={13} />
              <span className="navbar2-logout-label">Salir</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
