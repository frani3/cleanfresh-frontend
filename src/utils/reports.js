// Lógica pura de la analítica y la auditoría del panel Admin (Spec 045): rangos, formatos, barras y filtros. Está separada de los
// componentes para poder probarla sin navegador.

export const RANGES = [
  { value: "last1h", label: "Última hora" },
  { value: "last24h", label: "24 horas" },
  { value: "last7d", label: "7 días" },
  { value: "last30d", label: "30 días" },
];

export const DEFAULT_RANGE = "last24h";

const pad = (n) => String(n).padStart(2, "0");

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export function formatMoney(value) {
  return clp.format(Number.isFinite(value) ? value : 0);
}

// Minutos a un texto legible: "—" si no hay dato, segundos si dura menos de un minuto, minutos y, desde la hora, horas y minutos.
export function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return "—";
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  if (minutes < 60) return `${Number(minutes.toFixed(1)).toLocaleString("es-CL")} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes - hours * 60);
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// Ancho de una barra (0 a 100) respecto del mayor valor. Un valor mayor que cero siempre se alcanza a ver.
export function barPercent(value, max) {
  if (!max || max <= 0 || !value || value <= 0) return 0;
  return Math.max(4, Math.min(100, (value / max) * 100));
}

// "14:00" en la hora local del navegador, para el eje de ventas por hora.
export function hourLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getHours())}:00`;
}

// Para el rango de 7 o 30 días la serie por hora es larga: se agrupa por día para que el gráfico se pueda leer.
export function groupSalesByDay(series) {
  const days = new Map();
  for (const row of series) {
    const date = new Date(row.hora);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${pad(date.getDate())}-${pad(date.getMonth() + 1)}`;
    const current = days.get(key) || { label: key, pedidos: 0, monto: 0 };
    current.pedidos += row.pedidos;
    current.monto += row.monto;
    days.set(key, current);
  }
  return [...days.values()];
}

// La serie lista para graficar: por hora hasta 24 horas y por día desde 7 días.
export function salesBars(series, range) {
  const bars =
    range === "last7d" || range === "last30d"
      ? groupSalesByDay(series)
      : series.map((row) => ({ label: hourLabel(row.hora), pedidos: row.pedidos, monto: row.monto }));
  const max = Math.max(0, ...bars.map((b) => b.monto));
  return bars.map((b) => ({ ...b, percent: barPercent(b.monto, max) }));
}

const STATE_LABELS = {
  CREADO: "Creado",
  ACEPTADO: "Aceptado",
  EN_PREPARACION: "En preparación",
  DESPACHADO: "Despachado",
};

// Los estados activos en el orden del flujo, con su etiqueta.
export function activeStates(counts = {}) {
  return Object.keys(STATE_LABELS).map((key) => ({ key, label: STATE_LABELS[key], count: counts[key] || 0 }));
}

const ACTION_LABELS = {
  OrderCreated: "Pedido creado",
  OrderAccepted: "Pedido aceptado",
  OrderPreparing: "En preparación",
  OrderDispatched: "Pedido despachado",
  OrderDelivered: "Pedido entregado",
  OrderCancelled: "Pedido cancelado",
};

export function actionLabel(tipo) {
  return ACTION_LABELS[tipo] || tipo || "";
}

// Punto de color de cada acción en la línea de tiempo (reusa los puntos info / warn / error del panel).
export function actionLevel(tipo) {
  if (tipo === "OrderCancelled") return "error";
  if (tipo === "OrderDelivered") return "info";
  return "warn";
}

// Fecha y hora de un registro, en la hora local: "12-11-2026 20:14:06".
export function formatAuditWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return (
    `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export const AUDIT_PAGE_SIZE = 10;

export const EMPTY_AUDIT_FILTERS = { usuario: "", tipo: "", entidadId: "", desde: "", hasta: "" };

// Los filtros de la pantalla a los parámetros de la consulta: los vacíos no se mandan y el resto va sin espacios sobrantes.
export function buildAuditParams(filters, page = 0, size = AUDIT_PAGE_SIZE) {
  const params = { pagina: page, tamano: size };
  for (const key of Object.keys(EMPTY_AUDIT_FILTERS)) {
    const value = (filters[key] || "").trim();
    if (value) params[key] = value;
  }
  return params;
}

export function hasActiveFilters(filters) {
  return Object.keys(EMPTY_AUDIT_FILTERS).some((key) => (filters[key] || "").trim() !== "");
}

// Dónde está la página actual: "11–20 de 37", y si hay página anterior y siguiente.
export function pageInfo(total, page, size) {
  if (!total) return { from: 0, to: 0, pages: 0, hasPrev: false, hasNext: false };
  const pages = Math.ceil(total / size);
  return {
    from: page * size + 1,
    to: Math.min(total, (page + 1) * size),
    pages,
    hasPrev: page > 0,
    hasNext: page < pages - 1,
  };
}
