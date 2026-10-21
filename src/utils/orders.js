// Lógica pura de las órdenes (Spec 036): número, fecha y hora, y orden "más reciente arriba". Está separada de los
// componentes para poder probarla sin navegador.

// El N° de orden (ORD-0014) crece con cada orden, así que sirve para ordenar de la más nueva a la más antigua. Las
// que crea el Admin en pantalla usan ORD-<timestamp>, que también es mayor que las del backend.
export function orderNumber(order) {
  const digits = String(order.id).replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

// Instante de creación en milisegundos, o null si la orden no lo tiene (las anteriores a la Spec 036 solo
// guardaron la fecha).
export function createdTime(order) {
  if (!order.createdAtTime) return null;
  const time = new Date(order.createdAtTime).getTime();
  return Number.isNaN(time) ? null : time;
}

// Comparador "más reciente primero": por fecha y hora; la orden que tiene hora es posterior a una que no la tiene
// (las sin hora son las anteriores a la Spec 036); y con el mismo instante, o sin hora las dos, por número de orden.
export function compareNewestFirst(a, b) {
  const ta = createdTime(a);
  const tb = createdTime(b);
  if (ta !== null && tb !== null && ta !== tb) return tb - ta;
  if (ta !== null && tb === null) return -1;
  if (ta === null && tb !== null) return 1;
  return orderNumber(b) - orderNumber(a);
}

const pad = (n) => String(n).padStart(2, "0");

// "21-10-2026 01:26" en la hora del navegador. Una orden anterior, sin hora, se muestra solo con la fecha
// ("08-10-2026"): no se inventa una hora. Devuelve "" si no hay una fecha reconocible. `zonaHoraria` solo se usa
// en las pruebas (por defecto, la del navegador).
export function formatOrderDate(order, zonaHoraria) {
  const time = createdTime(order);
  if (time !== null) {
    const partes = new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: zonaHoraria,
    }).formatToParts(new Date(time));
    const valor = (tipo) => partes.find((p) => p.type === tipo)?.value;
    return `${valor("day")}-${valor("month")}-${valor("year")} ${valor("hour")}:${valor("minute")}`;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(order.createdAt || ""));
  return match ? `${pad(match[3])}-${pad(match[2])}-${match[1]}` : "";
}
