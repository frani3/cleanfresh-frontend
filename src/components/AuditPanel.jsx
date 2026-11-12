import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Route, Search, X } from "lucide-react";
import { getAuditLog, getAuditTypes, getOrderTrace } from "../services/apiService";
import { POLL_MS } from "../hooks/useNotifications";
import {
  AUDIT_PAGE_SIZE,
  EMPTY_AUDIT_FILTERS,
  actionLabel,
  actionLevel,
  buildAuditParams,
  formatAuditWhen,
  hasActiveFilters,
  pageInfo,
} from "../utils/reports";

// Auditoría del panel Admin (Spec 045): la línea de tiempo de acciones (quién, qué, cuándo y desde dónde) que `auditoria` guarda a partir
// de Kafka, con filtros por usuario, tipo de evento, orden y fechas, y la trazabilidad completa de cada orden. Es solo lectura.
function AuditPanel() {
  const [draft, setDraft] = useState(EMPTY_AUDIT_FILTERS);
  const [applied, setApplied] = useState(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [types, setTypes] = useState([]);
  const [trace, setTrace] = useState(null); // null | { numero, loading, steps, error }
  const lastRequest = useRef(0);
  // Una respuesta que llega con el panel ya cerrado no actualiza nada.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    getAuditTypes()
      .then((list) => {
        if (mounted.current) setTypes(list);
      })
      .catch(() => {
        if (mounted.current) setTypes([]);
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(() => {
    const id = ++lastRequest.current;
    const current = () => mounted.current && id === lastRequest.current;
    return getAuditLog(buildAuditParams(applied, page, AUDIT_PAGE_SIZE))
      .then((data) => {
        if (!current()) return;
        setResult(data);
        setError("");
      })
      .catch((e) => {
        if (!current()) return;
        setError(
          e.response?.status === 400
            ? "Revisa los filtros: las fechas deben ser válidas y «desde» anterior a «hasta»."
            : "No se pudo cargar la auditoría. Se vuelve a intentar solo en unos segundos."
        );
      })
      .finally(() => {
        if (current()) setLoading(false);
      });
  }, [applied, page]);

  useEffect(() => {
    setLoading(true);
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const submit = (event) => {
    event.preventDefault();
    setPage(0);
    setApplied(draft);
  };

  const clear = () => {
    setDraft(EMPTY_AUDIT_FILTERS);
    setApplied(EMPTY_AUDIT_FILTERS);
    setPage(0);
  };

  const openTrace = (numero) => {
    setTrace({ numero, loading: true, steps: [], error: "" });
    getOrderTrace(numero)
      .then((steps) => setTrace({ numero, loading: false, steps, error: "" }))
      .catch((e) =>
        setTrace({
          numero,
          loading: false,
          steps: [],
          error: e.response?.status === 404 ? "Esta orden no tiene registros." : "No se pudo cargar la trazabilidad.",
        })
      );
  };

  const set = (key) => (event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }));
  const info = pageInfo(result?.total || 0, page, AUDIT_PAGE_SIZE);

  return (
    <div className="audit-module">
      <form className="audit-filters" onSubmit={submit}>
        <label>
          Usuario
          <input type="text" value={draft.usuario} onChange={set("usuario")} placeholder="Parte del nombre" />
        </label>
        <label>
          Evento
          <select value={draft.tipo} onChange={set("tipo")}>
            <option value="">Todos</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {actionLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Orden
          <input type="text" value={draft.entidadId} onChange={set("entidadId")} placeholder="ORD-0042" />
        </label>
        <label>
          Desde
          <input type="date" value={draft.desde} onChange={set("desde")} />
        </label>
        <label>
          Hasta
          <input type="date" value={draft.hasta} onChange={set("hasta")} />
        </label>
        <div className="audit-filter-actions">
          <button type="submit" className="btn2 btn2-primary">
            <Search size={13} /> Buscar
          </button>
          <button type="button" className="btn2 btn2-outline" onClick={clear} disabled={!hasActiveFilters(draft) && !hasActiveFilters(applied)}>
            Limpiar
          </button>
        </div>
      </form>

      {error && (
        <p className="notif-error" role="alert">
          {error}
        </p>
      )}
      {loading && !result && <p className="notif-empty">Cargando auditoría...</p>}
      {result && result.registros.length === 0 && !error && (
        <p className="notif-empty">
          {hasActiveFilters(applied) ? "Ningún registro coincide con los filtros." : "Aún no hay registros de auditoría."}
        </p>
      )}

      {result && result.registros.length > 0 && (
        <ul className="audit2-list">
          {result.registros.map((r) => (
            <li key={r.eventId} className="audit2-item">
              <span className={`audit2-dot audit2-dot-${actionLevel(r.accion)}`} />
              <div className="audit2-body">
                <p className="audit2-action">
                  {actionLabel(r.accion)} ·{" "}
                  <button type="button" className="audit-link" onClick={() => openTrace(r.entidadId)} title="Ver la historia de esta orden">
                    {r.entidadId}
                  </button>
                </p>
                <p className="audit2-actor">
                  {r.actor}
                  {r.origen ? ` · desde ${r.origen}` : ""}
                  {r.detalle ? ` · ${r.detalle}` : ""}
                </p>
              </div>
              <span className="audit2-time">{formatAuditWhen(r.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}

      {result && result.total > 0 && (
        <div className="audit-pager">
          <span>
            {info.from}–{info.to} de {result.total}
          </span>
          <div>
            <button type="button" className="btn2 btn2-outline" onClick={() => setPage(page - 1)} disabled={!info.hasPrev} aria-label="Página anterior">
              <ChevronLeft size={13} />
            </button>
            <span className="audit-page-number">
              Página {page + 1} de {info.pages}
            </span>
            <button type="button" className="btn2 btn2-outline" onClick={() => setPage(page + 1)} disabled={!info.hasNext} aria-label="Página siguiente">
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {trace && (
        <div className="audit-trace" role="region" aria-label={`Historia de ${trace.numero}`}>
          <div className="audit-trace-head">
            <strong>
              <Route size={14} /> Historia de {trace.numero}
            </strong>
            <button type="button" className="btn2 btn2-outline" onClick={() => setTrace(null)} aria-label="Cerrar la historia">
              <X size={13} />
            </button>
          </div>
          {trace.loading && <p className="notif-empty">Cargando...</p>}
          {trace.error && <p className="notif-error">{trace.error}</p>}
          {trace.steps.length > 0 && (
            <ol className="audit-trace-steps">
              {trace.steps.map((s) => (
                <li key={`${s.traceId}-${s.tipo}`}>
                  <span className={`audit2-dot audit2-dot-${actionLevel(s.tipo)}`} />
                  <div>
                    <p className="audit2-action">
                      {actionLabel(s.tipo)} <span className="audit-state">{s.estado}</span>
                    </p>
                    <p className="audit2-actor">
                      {s.actor || "desconocido"}
                      {s.origen ? ` · desde ${s.origen}` : ""} · {s.servicio} · {s.sucursal}
                    </p>
                  </div>
                  <span className="audit2-time">{formatAuditWhen(s.timestamp)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

export default AuditPanel;
