import { useState } from "react";
import { Bell, Check } from "lucide-react";
import {
  countUnread,
  filterNotifications,
  formatFull,
  formatWhen,
  kindLabel,
  recipientLabel,
} from "../utils/notifications";

// Módulo de notificaciones (Spec 034): la lista completa de avisos con su estado y el botón de leído.
// Se usa dentro de una tarjeta (Operador y Cliente) o de la pestaña "Notificaciones" (Admin).
//
// notifications: lo que devuelve useNotifications. readOnly (Admin): ve los avisos de todos, con el
// destinatario de cada uno, y no tiene botones de leído.
function NotificationsPanel({ notifications, orders = [] }) {
  const { items, loaded, error, actionError, pending, markingAll, readOnly, markOne, markAll } = notifications;
  const [filter, setFilter] = useState("ALL");

  const unread = countUnread(items);
  const visible = filterNotifications(items, filter);

  return (
    <div className="notif-module">
      <div className="notif-toolbar">
        <div className="notif-filters" role="group" aria-label="Filtrar avisos">
          <button
            type="button"
            className={`notif-filter${filter === "ALL" ? " active" : ""}`}
            aria-pressed={filter === "ALL"}
            onClick={() => setFilter("ALL")}
          >
            Todas <span className="notif-filter-count">{items.length}</span>
          </button>
          <button
            type="button"
            className={`notif-filter${filter === "UNREAD" ? " active" : ""}`}
            aria-pressed={filter === "UNREAD"}
            onClick={() => setFilter("UNREAD")}
          >
            Sin leer <span className="notif-filter-count">{unread}</span>
          </button>
        </div>
        {readOnly ? (
          <span className="notif-readonly-hint">Solo lectura: ves los avisos de todos</span>
        ) : (
          <button
            type="button"
            className="btn2 btn2-outline"
            onClick={markAll}
            disabled={unread === 0 || markingAll}
          >
            <Check size={13} /> {markingAll ? "Marcando..." : "Marcar todas leídas"}
          </button>
        )}
      </div>

      {actionError && (
        <p className="notif-error" role="alert">
          {actionError}
        </p>
      )}
      {error && <p className="notif-error">No se pudieron actualizar los avisos.</p>}

      {!loaded ? (
        <p className="notif-empty">Cargando avisos...</p>
      ) : visible.length === 0 ? (
        <div className="notif-empty-state">
          <Bell size={26} aria-hidden="true" />
          <p>{filter === "UNREAD" ? "No tienes avisos sin leer." : "No hay avisos por ahora."}</p>
        </div>
      ) : (
        <ul className="notif-feed">
          {visible.map((n) => {
            const isNew = !n.leida;
            return (
              <li key={n.id} className={`notif-card${isNew ? " notif-card-new" : ""}`}>
                <span className="notif-dot" aria-hidden="true" />
                <div className="notif-card-body">
                  <div className="notif-card-meta">
                    <span className={`notif-kind notif-kind-${n.tipo}`}>{kindLabel(n.tipo)}</span>
                    {n.numeroOrden && <span className="notif-order">{n.numeroOrden}</span>}
                    <span className="notif-when" title={formatFull(n.fechaHora)}>
                      {formatWhen(n.fechaHora)}
                    </span>
                    {readOnly && <span className="notif-recipient">Para: {recipientLabel(n, orders)}</span>}
                  </div>
                  <p className="notif-card-text">{n.mensaje}</p>
                </div>
                <div className="notif-card-action">
                  {readOnly ? (
                    <span className={isNew ? "notif-state-new" : "notif-state-read"}>
                      {isNew ? "Sin leer" : "Leído"}
                    </span>
                  ) : isNew ? (
                    <button
                      type="button"
                      className="btn2 btn2-primary"
                      onClick={() => markOne(n.id)}
                      disabled={pending.has(n.id)}
                      aria-label={`Marcar como leído: ${n.mensaje}`}
                    >
                      <Check size={13} /> {pending.has(n.id) ? "Marcando..." : "Marcar leído"}
                    </button>
                  ) : (
                    <span className="notif-state-read">
                      <Check size={13} /> Leído
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default NotificationsPanel;
