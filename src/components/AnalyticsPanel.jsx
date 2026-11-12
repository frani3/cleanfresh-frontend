import { useState } from "react";
import { RefreshCw } from "lucide-react";
import useReports from "../hooks/useReports";
import { DEFAULT_RANGE, RANGES, activeStates, barPercent, formatMinutes, formatMoney, salesBars } from "../utils/reports";

// Analítica del panel Admin (Spec 045): lo que `reportes` calcula con los eventos de Kafka, en tiempo casi real. No consulta a
// `orders`: leer los reportes no le quita capacidad al flujo de pedidos.
function AnalyticsPanel() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const { data, loading, error, updatedAt, reload } = useReports(range);

  const kpis = data?.kpis;
  const bars = data ? salesBars(data.sales, range) : [];
  const topMax = data ? Math.max(0, ...data.top.map((t) => t.pedidos)) : 0;
  const branchMax = data ? Math.max(0, ...data.branches.map((b) => b.orders)) : 0;

  return (
    <div className="analytics">
      <div className="analytics-toolbar">
        <div className="notif-filters" role="group" aria-label="Rango de tiempo">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              className={`notif-filter${range === r.value ? " active" : ""}`}
              aria-pressed={range === r.value}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn2 btn2-outline" onClick={reload} disabled={loading}>
          <RefreshCw size={13} /> {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error && (
        <p className="notif-error" role="alert">
          No se pudieron cargar los reportes. Se vuelve a intentar solo en unos segundos.
        </p>
      )}
      {!data && loading && <p className="notif-empty">Cargando reportes...</p>}

      {kpis && (
        <>
          <div className="kpi-grid">
            <div className="kpi-tile">
              <span className="kpi-label">Pedidos</span>
              <strong className="kpi-value">{kpis.pedidos}</strong>
              <span className="kpi-hint">
                {kpis.entregados} entregados · {kpis.cancelados} cancelados
              </span>
            </div>
            <div className="kpi-tile">
              <span className="kpi-label">Ventas</span>
              <strong className="kpi-value">{formatMoney(kpis.ventas)}</strong>
              <span className="kpi-hint">Sin contar los cancelados</span>
            </div>
            <div className="kpi-tile">
              <span className="kpi-label">Ticket promedio</span>
              <strong className="kpi-value">{formatMoney(kpis.ticketPromedio)}</strong>
              <span className="kpi-hint">{kpis.pedidosNoCancelados} pedidos válidos</span>
            </div>
            <div className="kpi-tile">
              <span className="kpi-label">Lead time</span>
              <strong className="kpi-value">{formatMinutes(kpis.leadTime.promedioMin)}</strong>
              <span className="kpi-hint">
                {kpis.leadTime.muestras === 0
                  ? "Aún sin entregas"
                  : `de crear a entregar · mín ${formatMinutes(kpis.leadTime.minimoMin)} · máx ${formatMinutes(kpis.leadTime.maximoMin)}`}
              </span>
            </div>
          </div>

          <h3 className="analytics-title">Estados activos ahora</h3>
          <div className="state-row">
            {activeStates(kpis.estadosActivos).map((s) => (
              <div key={s.key} className="state-chip">
                <strong>{s.count}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          <h3 className="analytics-title">
            Ventas {range === "last7d" || range === "last30d" ? "por día" : "por hora"}
          </h3>
          {bars.every((b) => b.monto === 0) ? (
            <p className="notif-empty">Sin ventas en este rango.</p>
          ) : (
            <div className="sales-chart" role="img" aria-label="Gráfico de ventas">
              {bars.map((b, i) => (
                <div
                  key={`${b.label}-${i}`}
                  className="sales-col"
                  title={`${b.label}: ${b.pedidos} pedidos · ${formatMoney(b.monto)}`}
                >
                  <div className="sales-bar" style={{ height: `${b.percent}%` }} />
                  <span className="sales-label">{b.label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="analytics-split">
            <div>
              <h3 className="analytics-title">Servicios más pedidos</h3>
              {data.top.length === 0 ? (
                <p className="notif-empty">Sin pedidos en este rango.</p>
              ) : (
                <div className="branch2-list">
                  {data.top.map((t) => (
                    <div key={t.servicio}>
                      <div className="branch2-row-head">
                        <span className="branch-name">{t.servicio}</span>
                        <span className="branch-count">
                          {t.pedidos} {t.pedidos === 1 ? "pedido" : "pedidos"} · {formatMoney(t.monto)}
                        </span>
                      </div>
                      <div className="branch2-bar-track">
                        <div className="branch2-bar-fill" style={{ width: `${barPercent(t.pedidos, topMax)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="analytics-title">Pedidos por sucursal</h3>
              {data.branches.length === 0 ? (
                <p className="notif-empty">Sin pedidos en este rango.</p>
              ) : (
                <div className="branch2-list">
                  {data.branches.map((b) => (
                    <div key={b.branch}>
                      <div className="branch2-row-head">
                        <span className="branch-name">{b.branch}</span>
                        <span className="branch-count">{b.orders} órdenes</span>
                      </div>
                      <div className="branch2-bar-track">
                        <div className="branch2-bar-fill" style={{ width: `${barPercent(b.orders, branchMax)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="analytics-foot">
            Calculado con los eventos de Kafka
            {updatedAt ? ` · actualizado ${updatedAt.toLocaleTimeString("es-CL")}` : ""}
          </p>
        </>
      )}
    </div>
  );
}

export default AnalyticsPanel;
