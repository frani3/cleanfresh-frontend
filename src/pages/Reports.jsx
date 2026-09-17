// KPIs mockeados; en producción vendrían de la API de reportería (GET /reports/kpis).
const KPIS = [
  { label: "Ingresos del mes", value: "$3,250,000", icon: "💰" },
  { label: "Órdenes procesadas", value: 312, icon: "📦" },
  { label: "Ticket promedio", value: "$18,500", icon: "🧾" },
  { label: "Tiempo promedio de entrega", value: "6.4 hrs", icon: "⏱️" },
  { label: "Clientes activos", value: 156, icon: "👥" },
  { label: "Tasa de reincidencia", value: "68%", icon: "🔁" },
];

const REVENUE_BY_LOCAL = [
  { local: "Sucursal Centro", ordenes: 98, ingresos: 1120000 },
  { local: "Sucursal Norte", ordenes: 76, ingresos: 890000 },
  { local: "Sucursal Sur", ordenes: 64, ingresos: 720000 },
  { local: "Sucursal Occidente", ordenes: 74, ingresos: 520000 },
];

function Reports() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Reportería</h1>
        <p className="page-subtitle">
          Panel de indicadores clave (KPIs) para toma de decisiones — visible solo para Admin.
        </p>
      </div>

      <div className="card-grid">
        {KPIS.map((kpi, index) => (
          <div
            key={kpi.label}
            className={index % 2 === 1 ? "kpi-card accent-blue" : "kpi-card"}
          >
            <div className="kpi-icon" role="img" aria-hidden="true">
              {kpi.icon}
            </div>
            <div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-label">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="section">
        <h2 className="section-title">🏬 Ingresos por sucursal</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sucursal</th>
                <th>Órdenes</th>
                <th>Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {REVENUE_BY_LOCAL.map((row) => (
                <tr key={row.local}>
                  <td>{row.local}</td>
                  <td>{row.ordenes}</td>
                  <td>${row.ingresos.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Reports;
