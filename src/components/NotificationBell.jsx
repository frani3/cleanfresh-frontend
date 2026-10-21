import { Bell } from "lucide-react";

// Campanita del encabezado (Spec 030, rediseñada en la Spec 034): ya no abre un desplegable, es un
// indicador con el contador de avisos sin leer que lleva al módulo de notificaciones. El Admin la ve sin
// contador (solo lectura: los avisos son de los demás).
function NotificationBell({ unread, onClick }) {
  return (
    <div className="notif">
      <button
        type="button"
        className="notif-button"
        onClick={onClick}
        aria-label={unread > 0 ? `Ir a notificaciones: ${unread} sin leer` : "Ir a notificaciones"}
        title="Notificaciones"
      >
        <Bell size={18} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
    </div>
  );
}

export default NotificationBell;
