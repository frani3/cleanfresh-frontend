import { useState } from "react";
import { useMsal } from "@azure/msal-react";

const STATUS_OPTIONS = [
  "CREADO",
  "ACEPTADO",
  "EN_PREPARACION",
  "DESPACHADO",
  "ENTREGADO",
  "CANCELADO",
];

const STATUS_LABELS = {
  CREADO: "Creado",
  ACEPTADO: "Aceptado",
  EN_PREPARACION: "En preparación",
  DESPACHADO: "Despachado",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

const STATUS_BADGE_CLASS = {
  CREADO: "badge badge-creado",
  ACEPTADO: "badge badge-aceptado",
  EN_PREPARACION: "badge badge-en_preparacion",
  DESPACHADO: "badge badge-despachado",
  ENTREGADO: "badge badge-entregado",
  CANCELADO: "badge badge-cancelado",
};

// Órdenes mockeadas; luego vendrán de la API (GET /orders).
const MOCK_ORDERS = [
  { id: "ORD-1001", cliente: "María Gómez", servicio: "Lavado y secado", fecha: "2026-09-08", estado: "DESPACHADO", total: 18000 },
  { id: "ORD-1002", cliente: "Carlos Pérez", servicio: "Planchado", fecha: "2026-09-08", estado: "EN_PREPARACION", total: 9500 },
  { id: "ORD-1003", cliente: "Ana Torres", servicio: "Lavado en seco", fecha: "2026-09-09", estado: "CREADO", total: 25000 },
  { id: "ORD-1004", cliente: "Luis Rodríguez", servicio: "Lavado y secado", fecha: "2026-09-09", estado: "ENTREGADO", total: 18000 },
  { id: "ORD-1005", cliente: "Sofía Muñoz", servicio: "Servicio exprés", fecha: "2026-09-10", estado: "ACEPTADO", total: 12000 },
  { id: "ORD-1006", cliente: "Jorge Silva", servicio: "Lavado de edredones", fecha: "2026-09-10", estado: "CANCELADO", total: 32000 },
];

function Orders() {
  const { accounts } = useMsal();
  const roles = accounts[0]?.idTokenClaims?.roles || [];
  const canEditStatus = roles.includes("Admin") || roles.includes("Operador");

  const [orders, setOrders] = useState(MOCK_ORDERS);

  const handleStatusChange = (id, newStatus) => {
    setOrders((prev) =>
      prev.map((order) => (order.id === id ? { ...order, estado: newStatus } : order))
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Gestión de Órdenes</h1>
        <p className="page-subtitle">{orders.length} órdenes en el sistema.</p>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>N° Orden</th>
              <th>Cliente</th>
              <th>Servicio</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.cliente}</td>
                <td>{order.servicio}</td>
                <td>{order.fecha}</td>
                <td>
                  {canEditStatus ? (
                    <select
                      className="table-select"
                      value={order.estado}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={STATUS_BADGE_CLASS[order.estado]}>
                      {STATUS_LABELS[order.estado]}
                    </span>
                  )}
                </td>
                <td>${order.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Orders;
