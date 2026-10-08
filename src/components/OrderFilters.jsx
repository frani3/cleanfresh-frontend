import { RefreshCw } from "lucide-react";

// Barra de búsqueda y filtros de órdenes (Spec 031), compartida por las
// vistas de Admin y Operador. El estado vive en el hook useOrderFilters; acá
// solo se dibuja.
//
// statusOptions: [{ value, label }] — la opción "ALL" ("Todos los estados") se
//   agrega siempre; pasar también { value: "ACTIVE", ... } si la vista la usa.
// branches: si viene, se muestra el filtro por sucursal (Admin).
function OrderFilters({ filters, statusOptions, branches, onRefresh, placeholder }) {
  return (
    <div className="orders-filter-bar">
      <input
        className="form-input"
        value={filters.query}
        onChange={(e) => filters.setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar órdenes"
      />
      <select
        className="form-input form-select"
        value={filters.status}
        onChange={(e) => filters.setStatus(e.target.value)}
        aria-label="Filtrar por estado"
      >
        <option value="ALL">Todos los estados</option>
        {statusOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {branches && (
        <select
          className="form-input form-select"
          value={filters.branch}
          onChange={(e) => filters.setBranch(e.target.value)}
          aria-label="Filtrar por sucursal"
        >
          <option value="ALL">Todas las sucursales</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      )}
      <select
        className="form-input form-select"
        value={filters.sort}
        onChange={(e) => filters.setSort(e.target.value)}
        aria-label="Ordenar órdenes"
      >
        <option value="NEW">Más nuevas primero</option>
        <option value="OLD">Más antiguas primero</option>
      </select>
      <button
        type="button"
        className="btn2 btn2-outline"
        onClick={onRefresh}
        title="Volver a pedir las órdenes al backend"
      >
        <RefreshCw size={12} /> Actualizar
      </button>
    </div>
  );
}

// Pie de la lista: contador, "Ver más" y el mensaje cuando no hay resultados.
export function OrderListFooter({ filters }) {
  if (filters.matches === 0) {
    return (
      <p className="op2-empty-sm orders-empty">
        {filters.total === 0 ? "Todavía no hay órdenes." : "Ninguna orden coincide con la búsqueda."}
      </p>
    );
  }
  return (
    <div className="orders-list-footer">
      <span className="orders-count" role="status">
        Mostrando {filters.shown} de {filters.matches}
      </span>
      {filters.hasMore && (
        <button type="button" className="btn2 btn2-outline" onClick={filters.showMore}>
          Ver más
        </button>
      )}
    </div>
  );
}

export default OrderFilters;
