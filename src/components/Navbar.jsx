import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { WashingMachine, Sparkles, LogOut, Shield, Wrench, User } from "lucide-react";
import { loginRequest } from "../authConfig";

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
  const { instance, accounts, inProgress } = useMsal();

  // Lectura provisoria mientras se resuelve acquireTokenSilent (ver abajo):
  // tras un F5, la cuenta reconstruida solo desde localStorage puede traer
  // idTokenClaims incompleto (sin "roles"). Sirve solo como placeholder.
  const cachedAccount = instance.getActiveAccount() || accounts[0];

  const [account, setAccount] = useState(cachedAccount || null);
  const [roles, setRoles] = useState(cachedAccount?.idTokenClaims?.roles || []);

  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return;

    const activeAccount = instance.getActiveAccount() || accounts[0];
    if (!activeAccount) return;

    instance
      .acquireTokenSilent({ ...loginRequest, account: activeAccount })
      .then((result) => {
        setAccount(result.account);
        setRoles(result.account?.idTokenClaims?.roles || []);
      })
      .catch(() => {
        // Si la renovación silenciosa falla, seguimos mostrando lo que
        // había en caché en vez de romper el navbar.
        setAccount(activeAccount);
        setRoles(activeAccount.idTokenClaims?.roles || []);
      });
  }, [inProgress, instance, accounts]);

  const displayName = account?.name || account?.username;
  const primaryRole = roles.includes("Admin")
    ? "Admin"
    : roles.includes("Operador")
    ? "Operador"
    : roles.includes("Cliente")
    ? "Cliente"
    : null;

  const handleLogout = () => {
    instance.logoutRedirect();
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
              <p className="navbar2-user-email">{account?.username}</p>
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
