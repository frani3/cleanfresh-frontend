import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { getHealth } from "../services/apiService";

// Datos mockeados: en producción vendrían de la API de órdenes/reportería.
const ADMIN_SUMMARY = [
  { label: "Órdenes activas", value: 42, icon: "📦" },
  { label: "Locales operando", value: 8, icon: "🏬" },
  { label: "Ingresos del mes", value: "$3,250,000", icon: "💰" },
  { label: "Alertas de auditoría", value: 3, icon: "⚠️" },
];

const OPERADOR_SUMMARY = [
  { label: "Órdenes pendientes", value: 12, icon: "🕒" },
  { label: "Órdenes en proceso", value: 5, icon: "🧼" },
  { label: "Órdenes listas para entrega", value: 4, icon: "✅" },
];

const CLIENTE_SUMMARY = [
  { label: "Órdenes activas", value: 1, icon: "📦" },
  { label: "Órdenes completadas", value: 7, icon: "✅" },
  { label: "Puntos de fidelidad", value: 140, icon: "⭐" },
];

function getSummary(roles) {
  if (roles.includes("Admin")) return { title: "Resumen general", cards: ADMIN_SUMMARY };
  if (roles.includes("Operador")) return { title: "Resumen de operación", cards: OPERADOR_SUMMARY };
  return { title: "Mi resumen", cards: CLIENTE_SUMMARY };
}

function Dashboard() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const roles = account?.idTokenClaims?.roles || [];
  const { title, cards } = getSummary(roles);

  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);

  useEffect(() => {
    if (!account) return;

    getHealth(instance, account)
      .then((data) => {
        setHealthError(null);
        setHealth(data);
      })
      .catch((error) => {
        setHealth(null);
        setHealthError(error?.response?.data?.message || error.message || "Error desconocido");
      });
  }, [instance, account]);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Bienvenido, {account?.name || account?.username}
          {roles.length > 0 ? ` (${roles.join(", ")})` : ""}
        </p>
      </div>

      <div className="section">
        <h2 className="section-title">{title}</h2>
        <div className="card-grid">
          {cards.map((card, index) => (
            <div
              key={card.label}
              className={index % 2 === 1 ? "kpi-card accent-blue" : "kpi-card"}
            >
              <div className="kpi-icon" role="img" aria-hidden="true">
                {card.icon}
              </div>
              <div>
                <div className="kpi-value">{card.value}</div>
                <div className="kpi-label">{card.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">🩺 Estado del BFF</h2>
        {healthError && (
          <div className="status-banner error">
            <span className="status-dot" />
            Error al consultar /api/health: {healthError}
          </div>
        )}
        {!healthError && !health && (
          <div className="status-banner pending">
            <span className="status-dot" />
            Consultando GET /api/health...
          </div>
        )}
        {health && (
          <>
            <div className="status-banner ok">
              <span className="status-dot" />
              BFF disponible
            </div>
            <pre className="status-pre">{JSON.stringify(health, null, 2)}</pre>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
