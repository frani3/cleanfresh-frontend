import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { getNotifications, markNotificationsRead } from "../services/apiService";

// Cada cuánto se vuelven a pedir los avisos (no hay websockets).
const POLL_MS = 15000;

function formatTime(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("es-CL");
}

const KIND_LABELS = {
  ORDEN_CREADA: "Pedido nuevo",
  ORDEN_LISTA: "Pedido listo",
};

// Campanita con contador de avisos sin leer (Spec 030). El BFF decide qué
// avisos le tocan a cada rol; acá solo se muestran. El Admin los ve todos
// pero en modo lectura: no tiene contador ni los marca como leídos, para no
// borrarles los pendientes a los demás.
function NotificationBell({ roleVariant, sucursal }) {
  const readOnly = roleVariant === "admin";
  const rootRef = useRef(null);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  // Avisos que estaban sin leer cuando se abrió el panel: se siguen resaltando
  // mientras está abierto, aunque ya se hayan marcado como leídos en el servidor.
  const [highlight, setHighlight] = useState(() => new Set());

  const refresh = useCallback(() => {
    return getNotifications(sucursal)
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setError(false);
      })
      .catch(() => setError(true));
  }, [sucursal]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unread = readOnly ? 0 : items.filter((n) => !n.leida).length;

  const toggle = () => {
    if (open) {
      setOpen(false);
      setHighlight(new Set());
      return;
    }
    setHighlight(new Set(items.filter((n) => !n.leida).map((n) => n.id)));
    setOpen(true);
    if (!readOnly && unread > 0) {
      // Primero se marcan como leídos y recién después se vuelve a pedir la
      // lista: hacerlo a la vez deja que una respuesta vieja pise el estado.
      markNotificationsRead(sucursal)
        .then(refresh)
        .catch(() => setError(true));
    } else {
      refresh();
    }
  };

  return (
    <div className="notif" ref={rootRef}>
      <button
        type="button"
        className="notif-button"
        onClick={toggle}
        aria-label={unread > 0 ? `Avisos: ${unread} sin leer` : "Avisos"}
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Avisos">
          <div className="notif-panel-title">
            Avisos{readOnly && <span className="notif-panel-hint"> · solo lectura</span>}
          </div>
          {error && <p className="notif-error">No se pudieron actualizar los avisos.</p>}
          {items.length === 0 && !error && <p className="notif-empty">No hay avisos por ahora.</p>}
          <ul className="notif-list">
            {items.map((n) => (
              <li
                key={n.id}
                className={`notif-item${highlight.has(n.id) || (!readOnly && !n.leida) ? " notif-item-new" : ""}`}
              >
                <span className="notif-item-kind">{KIND_LABELS[n.tipo] || n.tipo}</span>
                <span className="notif-item-text">{n.mensaje}</span>
                <span className="notif-item-time">{formatTime(n.fechaHora)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
