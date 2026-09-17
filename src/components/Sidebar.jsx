import { Link, useLocation } from "react-router-dom";
import { useMsal } from "@azure/msal-react";

// Links disponibles por rol. "Cliente" y "Operador" comparten Órdenes;
// Catálogo es visible para todos los roles autenticados; Reportería y
// Auditoría son exclusivos de Admin.
const LINKS_BY_ROLE = {
  Admin: [
    { to: "/dashboard", label: "Dashboard", icon: "📊" },
    { to: "/orders", label: "Órdenes", icon: "📦" },
    { to: "/catalog", label: "Catálogo", icon: "🧺" },
    { to: "/reports", label: "Reportería", icon: "📈" },
    { to: "/audit", label: "Auditoría", icon: "🕵️" },
  ],
  Operador: [
    { to: "/dashboard", label: "Dashboard", icon: "📊" },
    { to: "/orders", label: "Órdenes", icon: "📦" },
    { to: "/catalog", label: "Catálogo", icon: "🧺" },
  ],
  Cliente: [
    { to: "/dashboard", label: "Dashboard", icon: "📊" },
    { to: "/orders", label: "Mis órdenes", icon: "📦" },
    { to: "/catalog", label: "Catálogo", icon: "🧺" },
  ],
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

function Sidebar() {
  const { instance, accounts } = useMsal();
  const location = useLocation();

  const account = accounts[0];
  const roles = account?.idTokenClaims?.roles || [];
  const displayName = account?.name || account?.username;

  // Un usuario podría tener varios roles asignados; unimos los links
  // correspondientes sin duplicar rutas.
  const visibleLinks = Object.entries(LINKS_BY_ROLE)
    .filter(([role]) => roles.includes(role))
    .flatMap(([, links]) => links)
    .filter(
      (link, index, all) => all.findIndex((l) => l.to === link.to) === index
    );

  const handleLogout = () => {
    instance.logoutRedirect();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo" role="img" aria-label="Clean&Fresh">
          🧺
        </span>
        Clean&amp;Fresh Manager
      </div>

      <ul className="sidebar-nav">
        {visibleLinks.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className={
                location.pathname === link.to
                  ? "sidebar-link active"
                  : "sidebar-link"
              }
            >
              <span className="sidebar-link-icon" role="img" aria-hidden="true">
                {link.icon}
              </span>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer">
        <div className="sidebar-avatar">{getInitials(displayName)}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{displayName}</div>
          {roles.length > 0 && (
            <div className="sidebar-user-role">{roles.join(", ")}</div>
          )}
        </div>
        <button
          className="sidebar-logout"
          onClick={handleLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          ⏻
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
