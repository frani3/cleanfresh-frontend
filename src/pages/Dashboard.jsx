import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { getHealth } from "../services/apiService";

const styles = {
  container: { padding: "1.5rem" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "1rem",
    marginTop: "1rem",
  },
  card: {
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "1rem",
    backgroundColor: "#fafafa",
  },
  cardValue: { fontSize: "1.8rem", fontWeight: "bold", margin: "0.25rem 0" },
  cardLabel: { color: "#666", fontSize: "0.9rem" },
};

// Datos mockeados: en producción vendrían de la API de órdenes/reportería.
const ADMIN_SUMMARY = [
  { label: "Órdenes activas", value: 42 },
  { label: "Locales operando", value: 8 },
  { label: "Ingresos del mes", value: "$3,250,000" },
  { label: "Alertas de auditoría", value: 3 },
];

const OPERADOR_SUMMARY = [
  { label: "Órdenes pendientes", value: 12 },
  { label: "Órdenes en proceso", value: 5 },
  { label: "Órdenes listas para entrega", value: 4 },
];

const CLIENTE_SUMMARY = [
  { label: "Órdenes activas", value: 1 },
  { label: "Órdenes completadas", value: 7 },
  { label: "Puntos de fidelidad", value: 140 },
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
    <div style={styles.container}>
      <h1>Dashboard</h1>
      <p>
        Bienvenido, {account?.name || account?.username}
        {roles.length > 0 ? ` (${roles.join(", ")})` : ""}
      </p>

      <h2>{title}</h2>
      <div style={styles.grid}>
        {cards.map((card) => (
          <div key={card.label} style={styles.card}>
            <div style={styles.cardValue}>{card.value}</div>
            <div style={styles.cardLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      <h2>Estado del BFF</h2>
      {healthError && <p style={{ color: "crimson" }}>Error al consultar /api/health: {healthError}</p>}
      {!healthError && !health && <p>Consultando GET /api/health...</p>}
      {health && <pre style={styles.card}>{JSON.stringify(health, null, 2)}</pre>}
    </div>
  );
}

export default Dashboard;
