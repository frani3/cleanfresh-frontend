// Lógica pura de los avisos (Spec 034): formatos, filtro y destinatario. Está separada de los
// componentes para poder probarla sin navegador.

export const KIND_LABELS = {
  ORDEN_CREADA: "Pedido nuevo",
  ORDEN_LISTA: "Pedido listo",
  // Spec 035: cambio de estado (aceptado, en preparación, entregado, cancelado); el mensaje dice cuál.
  ORDEN_ESTADO: "Estado del pedido",
};

export function kindLabel(tipo) {
  return KIND_LABELS[tipo] || tipo;
}

// "hace 5 min" para lo reciente y la fecha completa para lo antiguo. `now` se puede inyectar en pruebas.
export function formatWhen(iso, now = Date.now()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.floor((now - date.getTime()) / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return date.toLocaleString("es-CL");
}

export function formatFull(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("es-CL");
}

export function countUnread(items) {
  return items.filter((n) => !n.leida).length;
}

// filter: "ALL" | "UNREAD"
export function filterNotifications(items, filter) {
  return filter === "UNREAD" ? items.filter((n) => !n.leida) : items;
}

// Para quién es un aviso (lo ve el Admin, que recibe los de todos). Los avisos de cliente guardan su
// identificador de Cognito (un UUID): si la orden está en la lista se muestra el nombre del cliente;
// si no, un identificador abreviado.
export function recipientLabel(notification, orders = []) {
  if (notification.destinatarioTipo === "SUCURSAL") {
    return `Sucursal ${notification.destinatario}`;
  }
  const order = orders.find((o) => o.id === notification.numeroOrden);
  const name = order?.customer;
  if (name && name !== notification.destinatario) return `Cliente ${name}`;
  const id = String(notification.destinatario || "");
  return `Cliente ${id.length > 10 ? `${id.slice(0, 8)}…` : id}`;
}
