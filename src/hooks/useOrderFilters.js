import { useMemo, useState } from "react";

// Cuántas órdenes se muestran por bloque antes de pedir "Ver más".
export const ORDER_PAGE_SIZE = 10;

// Estados "en curso": lo que el Operador gestiona en su turno. Entregado y
// Cancelado ya no requieren gestión, pero siguen accesibles con "Todos".
export const ACTIVE_STATUSES = ["CREADO", "ACEPTADO", "EN_PREPARACION", "DESPACHADO"];

// El N° de orden (ORD-0014) crece con cada orden, así que sirve para ordenar de
// la más nueva a la más antigua. Las que crea el Admin en pantalla usan
// ORD-<timestamp>, que también es mayor que las del backend.
function orderNumber(order) {
  const digits = String(order.id).replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function matchesStatus(order, status) {
  if (status === "ALL") return true;
  if (status === "ACTIVE") return ACTIVE_STATUSES.includes(order.status);
  return order.status === status;
}

// Búsqueda, filtros, orden y paginado de una lista de órdenes (Spec 031).
// Lo comparten las vistas de Admin y Operador. Cualquier cambio de texto,
// filtro u orden vuelve al primer bloque.
//
// initialStatus: "ALL" (todas, incluidas Entregado y Cancelado), "ACTIVE"
// (en curso) o un estado concreto.
function useOrderFilters(orders, { initialStatus = "ALL" } = {}) {
  const [query, setQueryState] = useState("");
  const [status, setStatusState] = useState(initialStatus);
  const [branch, setBranchState] = useState("ALL");
  const [sort, setSortState] = useState("NEW");
  const [limit, setLimit] = useState(ORDER_PAGE_SIZE);

  const resetPage = () => setLimit(ORDER_PAGE_SIZE);
  const setQuery = (value) => {
    setQueryState(value);
    resetPage();
  };
  const setStatus = (value) => {
    setStatusState(value);
    resetPage();
  };
  const setBranch = (value) => {
    setBranchState(value);
    resetPage();
  };
  const setSort = (value) => {
    setSortState(value);
    resetPage();
  };

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const result = orders.filter((o) => {
      const matchesText =
        !text ||
        String(o.id).toLowerCase().includes(text) ||
        String(o.customer || "").toLowerCase().includes(text) ||
        String(o.service || "").toLowerCase().includes(text);
      const matchesBranch = branch === "ALL" || o.branch === branch;
      return matchesText && matchesStatus(o, status) && matchesBranch;
    });
    const direction = sort === "NEW" ? -1 : 1;
    return [...result].sort((a, b) => direction * (orderNumber(a) - orderNumber(b)));
  }, [orders, query, status, branch, sort]);

  const visibleOrders = filtered.slice(0, limit);

  return {
    query,
    setQuery,
    status,
    setStatus,
    branch,
    setBranch,
    sort,
    setSort,
    visibleOrders,
    matches: filtered.length,
    shown: visibleOrders.length,
    total: orders.length,
    hasMore: filtered.length > visibleOrders.length,
    showMore: () => setLimit((current) => current + ORDER_PAGE_SIZE),
  };
}

export default useOrderFilters;
