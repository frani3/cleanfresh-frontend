// Eventos de auditoría mockeados; en producción vendrían de la API
// (GET /audit/events), registrados por acciones sensibles del sistema.
const AUDIT_EVENTS = [
  {
    id: 1,
    fecha: "2026-09-10 09:12",
    usuario: "admin@cleanfresh.com",
    accion: "Cambio de estado de orden",
    detalle: "ORD-1002 pasó de 'Aceptado' a 'En preparación'",
  },
  {
    id: 2,
    fecha: "2026-09-09 17:45",
    usuario: "operador.norte@cleanfresh.com",
    accion: "Creación de orden",
    detalle: "Se creó ORD-1004 para el cliente Luis Rodríguez",
  },
  {
    id: 3,
    fecha: "2026-09-09 14:03",
    usuario: "admin@cleanfresh.com",
    accion: "Edición de catálogo",
    detalle: "Se actualizó el precio del servicio 'Lavado en seco'",
  },
  {
    id: 4,
    fecha: "2026-09-08 11:20",
    usuario: "admin@cleanfresh.com",
    accion: "Asignación de rol",
    detalle: "Se asignó el rol 'Operador' a operador.sur@cleanfresh.com",
  },
  {
    id: 5,
    fecha: "2026-09-08 08:30",
    usuario: "sistema",
    accion: "Inicio de sesión fallido",
    detalle: "3 intentos fallidos para cliente@correo.com",
  },
];

function Audit() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Auditoría</h1>
        <p className="page-subtitle">
          Historial de eventos relevantes del sistema — visible solo para Admin.
        </p>
      </div>

      <div className="timeline">
        {AUDIT_EVENTS.map((event) => (
          <div key={event.id} className="timeline-item">
            <span className="timeline-dot" />
            <div className="timeline-card">
              <div className="timeline-meta">
                <span>🕒 {event.fecha}</span>
                <span>· {event.usuario}</span>
              </div>
              <div className="timeline-action">{event.accion}</div>
              <div className="timeline-detail">{event.detalle}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Audit;
