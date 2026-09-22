import { useCallback, useEffect, useMemo, useState } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus, InteractionRequiredAuthError } from "@azure/msal-browser";
import {
  Activity,
  DollarSign,
  Package,
  Loader,
  Users,
  ClipboardList,
  LayoutGrid,
  BarChart3,
  ShieldCheck,
  KeyRound,
  Eye,
  ListChecks,
  Zap,
  Truck,
  KanbanSquare,
  Search,
  Clock,
  Gift,
  ListTodo,
  Check,
  Plus,
  WashingMachine,
  Pencil,
  Ban,
  RotateCcw,
  Trash2,
  X,
  RefreshCw,
} from "lucide-react";
import { loginRequest } from "../authConfig";
import { getHealth, getCatalog, getOrders, createOrder } from "../services/apiService";

/* =========================================================
   Datos mock — en producción vendrían de las APIs de
   órdenes / catálogo / reportería / auditoría.
   (Adaptado de lib/laundry-data.ts del diseño de v0.)
   ========================================================= */

const STATUS_FLOW = ["CREADO", "ACEPTADO", "EN_PREPARACION", "DESPACHADO", "ENTREGADO"];

const STATUS_LABELS = {
  CREADO: "Creado",
  ACEPTADO: "Aceptado",
  EN_PREPARACION: "En preparación",
  DESPACHADO: "Despachado",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

function isServiceAvailableAnywhere(service) {
  return Object.values(service.branches).some(Boolean);
}

const BRANCH_ACTIVITY = [
  { branch: "Providencia", orders: 42 },
  { branch: "Ñuñoa", orders: 35 },
  { branch: "Las Condes", orders: 28 },
  { branch: "Maipú", orders: 19 },
];

const BRANCHES = BRANCH_ACTIVITY.map((b) => b.branch);

const AUDIT_LOG = [
  { time: "11:32", actor: "operador@cf.co", action: "Actualizó ORD-2047 → EN_PREPARACION", level: "info" },
  { time: "11:05", actor: "admin@cf.co", action: "Modificó precio de catálogo (Planchado)", level: "warn" },
  { time: "10:48", actor: "auth.azure", action: "Token JWT renovado (Azure CIAM)", level: "info" },
  { time: "10:12", actor: "system", action: "Intento de acceso rechazado (rol insuficiente)", level: "error" },
];

const POINTS = 450;
const POINTS_GOAL = 600;

const ETA_OPTIONS = ["4h", "12h", "24h", "48h", "72h"];

function formatCLP(value) {
  return value.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

/* =========================================================
   Componentes reutilizables (adaptados de bento-card.tsx,
   kpi-stat.tsx, status-badge.tsx, service-card.tsx)
   ========================================================= */

function BentoCard({ title, subtitle, icon: Icon, className, children }) {
  return (
    <section className={`bento2-card ${className || ""}`}>
      <div className="bento2-card-head">
        <div className="bento2-card-head-left">
          {Icon && (
            <span className="bento2-card-icon">
              <Icon size={17} />
            </span>
          )}
          <div>
            <h2 className="bento2-card-title">{title}</h2>
            {subtitle && <p className="bento2-card-subtitle">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="bento2-card-body">{children}</div>
    </section>
  );
}

function KpiStat({ label, value, icon: Icon, trend, accent }) {
  return (
    <div className="kpi2">
      <div className="kpi2-head">
        <span className={`kpi2-icon ${accent}`}>
          <Icon size={15} />
        </span>
        {trend && <span className="kpi2-trend">{trend}</span>}
      </div>
      <p className="kpi2-value">{value}</p>
      <p className="kpi2-label">{label}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const className = `status2-badge status2-${status.toLowerCase()}`;
  return <span className={className}>{STATUS_LABELS[status] || status}</span>;
}

/* =========================================================
   Línea de tiempo visual de una orden (Spec 020)
   ========================================================= */

function OrderTracker({ status }) {
  const currentIdx = STATUS_FLOW.indexOf(status);

  return (
    <div className="order-tracker-steps">
      {STATUS_FLOW.map((step, i) => {
        const done = i <= currentIdx;
        const isLast = i === STATUS_FLOW.length - 1;
        return (
          <div key={step} className={`order-tracker-step ${!isLast ? "grow" : ""}`}>
            <div className="order-tracker-step-inner">
              <span className={`order-tracker-dot ${done ? "done" : ""}`}>
                {done ? <Check size={11} /> : i + 1}
              </span>
              <span className="order-tracker-step-label">{STATUS_LABELS[step]}</span>
            </div>
            {!isLast && <div className={`order-tracker-line ${i < currentIdx ? "done" : ""}`} />}
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   Modal de línea de tiempo / historial de una orden (Spec 020)
   ========================================================= */

function OrderLifecycleModal({ order, canEdit, onChangeStatus, onClose }) {
  const [nextStatus, setNextStatus] = useState(order.status);
  const [confirmingChange, setConfirmingChange] = useState(false);

  const handleConfirmChange = () => {
    if (nextStatus === order.status) return;
    setConfirmingChange(true);
  };

  if (confirmingChange) {
    return (
      <ConfirmModal
        title={`Orden ${order.id}`}
        message={`¿Cambiar la orden ${order.id} a "${STATUS_LABELS[nextStatus]}"?`}
        onConfirm={() => {
          onChangeStatus(order.id, nextStatus);
          setConfirmingChange(false);
        }}
        onCancel={() => setConfirmingChange(false)}
      />
    );
  }

  return (
    <Modal title={`Orden ${order.id}`} onClose={onClose}>
      <p className="op2-order-meta" style={{ marginBottom: "1rem" }}>
        {order.customer} · {order.service} · {order.branch} · {formatCLP(order.price)}
      </p>

      <OrderTracker status={order.status} />

      {canEdit && (
        <div className="form-field" style={{ marginTop: "1.25rem" }}>
          <label className="form-label" htmlFor="lifecycle-status">
            Ajustar estado
          </label>
          <select
            id="lifecycle-status"
            className="form-input form-select"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
          >
            {STATUS_FLOW.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <div className="modal-footer">
            <button
              type="button"
              className="btn2 btn2-primary"
              disabled={nextStatus === order.status}
              onClick={handleConfirmChange}
            >
              Confirmar cambio
            </button>
          </div>
        </div>
      )}

      <div className="section-title" style={{ marginTop: "1.5rem" }}>
        Historial
      </div>
      <ul className="order-history-list">
        {order.history.map((entry, i) => (
          <li key={i} className="order-history-item">
            <StatusBadge status={entry.status} />
            <span className="order-history-actor">{entry.actor}</span>
            <span className="order-history-time">{entry.timestamp}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function ServiceCard({ service, action }) {
  return (
    <div className="service2-card">
      <div className="service2-head">
        <span className="service2-icon">
          <WashingMachine size={16} />
        </span>
        <span
          className={`service2-avail ${
            isServiceAvailableAnywhere(service) ? "service2-avail-yes" : "service2-avail-no"
          }`}
        >
          {isServiceAvailableAnywhere(service) ? "Disponible" : "No disponible"}
        </span>
      </div>
      <div>
        <h3 className="service2-name">{service.name}</h3>
        <div className="service2-eta">
          <Clock size={11} />
          Entrega {service.eta}
        </div>
      </div>
      <div className="service2-footer">
        <span className="service2-price">{formatCLP(service.price)}</span>
        {action}
      </div>
    </div>
  );
}

/* =========================================================
   Modal genérico (reutilizable: catálogo, órdenes, "ver todas")
   ========================================================= */

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-panel ${wide ? "modal-panel-wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* =========================================================
   Modal de confirmación genérico (reemplaza window.confirm en
   toda la app — Fix 025: el diálogo nativo del navegador se ve
   fuera de estilo y no es consistente entre vistas).
   ========================================================= */

function ConfirmModal({ title = "Confirmar", message, confirmLabel = "Aceptar", onConfirm, onCancel }) {
  return (
    <div className="modal-overlay confirm-overlay" onClick={onCancel}>
      <div
        className="modal-panel confirm-panel"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
        </div>
        <div className="modal-body">
          <p className="confirm-message">{message}</p>
          <div className="modal-footer">
            <button type="button" className="btn2 btn2-outline" onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" className="btn2 btn2-primary" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Formulario de alta/edición de servicio (Catálogo — Admin)
   ========================================================= */

function ServiceFormModal({ initialService, onSubmit, onClose }) {
  const isEdit = Boolean(initialService);
  const [name, setName] = useState(initialService?.name || "");
  const [price, setPrice] = useState(initialService ? String(initialService.price) : "");
  const [eta, setEta] = useState(
    initialService?.eta && ETA_OPTIONS.includes(initialService.eta)
      ? initialService.eta
      : ETA_OPTIONS[0]
  );
  const [branches, setBranches] = useState(
    initialService?.branches || BRANCHES.reduce((acc, b) => ({ ...acc, [b]: true }), {})
  );
  const [error, setError] = useState(null);

  const toggleBranch = (b) => {
    setBranches((prev) => ({ ...prev, [b]: !prev[b] }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const numericPrice = Number(price);

    if (!trimmedName) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!price || Number.isNaN(numericPrice) || numericPrice <= 0) {
      setError("El precio debe ser un número mayor a 0.");
      return;
    }

    onSubmit({
      id: initialService?.id,
      name: trimmedName,
      price: numericPrice,
      eta,
      branches,
    });
  };

  return (
    <Modal title={isEdit ? "Editar servicio" : "Nuevo servicio"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-label" htmlFor="svc-name">
            Nombre
          </label>
          <input
            id="svc-name"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Lavado y secado"
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="svc-price">
            Precio (CLP)
          </label>
          <input
            id="svc-price"
            className="form-input"
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ej: 18000"
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="svc-eta">
            Tiempo de entrega
          </label>
          <select
            id="svc-eta"
            className="form-input form-select"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
          >
            {ETA_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="form-label">Sucursales donde se ofrece</label>
          <div className="branch-checkbox-list">
            {BRANCHES.map((b) => (
              <label key={b} className="branch-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(branches[b])}
                  onChange={() => toggleBranch(b)}
                />
                {b}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-footer">
          <button type="button" className="btn2 btn2-outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn2 btn2-primary">
            {isEdit ? "Guardar cambios" : "Crear servicio"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* =========================================================
   Modal "Ver / Editar" de una orden (Órdenes recientes — Admin)
   ========================================================= */

function OrderViewModal({ order, services, onSave, onDelete, onClose }) {
  const [customer, setCustomer] = useState(order.customer);
  const [branch, setBranch] = useState(order.branch);
  const [serviceName, setServiceName] = useState(order.service);
  const [price, setPrice] = useState(String(order.price));
  const [status, setStatus] = useState(order.status);
  const [error, setError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [pendingSave, setPendingSave] = useState(null);

  const branchServices = useMemo(
    () => services.filter((s) => s.branches[branch]),
    [services, branch]
  );

  // Si se cambia la sucursal y el servicio elegido ya no está disponible
  // ahí, se pasa automáticamente al primer servicio válido para la nueva
  // sucursal (y se actualiza el precio sugerido).
  useEffect(() => {
    if (branchServices.length === 0) return;
    if (!branchServices.some((s) => s.name === serviceName)) {
      setServiceName(branchServices[0].name);
      setPrice(String(branchServices[0].price));
    }
  }, [branchServices, serviceName]);

  const handleServiceChange = (e) => {
    const nextName = e.target.value;
    setServiceName(nextName);
    const match = services.find((s) => s.name === nextName);
    if (match) {
      setPrice(String(match.price));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmedCustomer = customer.trim();
    const numericPrice = Number(price);

    if (!trimmedCustomer) {
      setError("El cliente es obligatorio.");
      return;
    }
    if (!price || Number.isNaN(numericPrice) || numericPrice <= 0) {
      setError("El precio debe ser un número mayor a 0.");
      return;
    }

    setPendingSave({
      ...order,
      customer: trimmedCustomer,
      branch,
      service: serviceName,
      price: numericPrice,
      status,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmText !== order.id) return;
    onDelete(order.id);
  };

  if (pendingSave) {
    return (
      <ConfirmModal
        title={`Orden ${order.id}`}
        message={`¿Guardar los cambios en la orden ${order.id}?`}
        onConfirm={() => onSave(pendingSave)}
        onCancel={() => setPendingSave(null)}
      />
    );
  }

  if (confirmingDelete) {
    return (
      <Modal title={`Eliminar orden ${order.id}`} onClose={onClose}>
        <p className="form-error" style={{ margin: "0 0 1rem" }}>
          Esta acción no se puede deshacer. Escribe <strong>{order.id}</strong> para
          confirmar la eliminación.
        </p>
        <div className="form-field">
          <label className="form-label" htmlFor="ord-delete-confirm">
            N° de orden
          </label>
          <input
            id="ord-delete-confirm"
            className="form-input"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={order.id}
            autoFocus
          />
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn2 btn2-outline"
            onClick={() => {
              setConfirmingDelete(false);
              setDeleteConfirmText("");
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn2 btn2-primary btn2-danger-solid"
            disabled={deleteConfirmText !== order.id}
            onClick={handleConfirmDelete}
          >
            <Trash2 size={12} /> Confirmar eliminación
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Orden ${order.id}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-label">N° de orden</label>
          <input className="form-input" value={order.id} disabled readOnly />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="ord-customer">
            Cliente
          </label>
          <input
            id="ord-customer"
            className="form-input"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="ord-branch">
            Sucursal
          </label>
          <select
            id="ord-branch"
            className="form-input form-select"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            {BRANCHES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="ord-service">
            Servicio
          </label>
          <select
            id="ord-service"
            className="form-input form-select"
            value={serviceName}
            onChange={handleServiceChange}
          >
            {branchServices.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="ord-price">
            Precio (CLP)
          </label>
          <input
            id="ord-price"
            className="form-input"
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="ord-status">
            Estado
          </label>
          <select
            id="ord-status"
            className="form-input form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_FLOW.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-footer modal-footer-split">
          <button
            type="button"
            className="btn2 btn2-outline btn2-danger"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 size={12} /> Eliminar orden
          </button>
          <div className="modal-footer-actions">
            <button type="button" className="btn2 btn2-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn2 btn2-primary">
              Guardar cambios
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* =========================================================
   Modal "Nueva orden" (Órdenes recientes — Admin)
   ========================================================= */

function NewOrderModal({ services, onCreate, onClose }) {
  const [customer, setCustomer] = useState("");
  const [branch, setBranch] = useState(BRANCHES[0]);

  const branchServices = useMemo(
    () => services.filter((s) => s.branches[branch]),
    [services, branch]
  );

  const [serviceName, setServiceName] = useState(branchServices[0]?.name || "");
  const [error, setError] = useState(null);

  // Si se cambia la sucursal y el servicio elegido ya no está disponible
  // ahí, se selecciona automáticamente el primer servicio válido.
  useEffect(() => {
    if (!branchServices.some((s) => s.name === serviceName)) {
      setServiceName(branchServices[0]?.name || "");
    }
  }, [branchServices, serviceName]);

  const selectedService = branchServices.find((s) => s.name === serviceName);

  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmedCustomer = customer.trim();

    if (!trimmedCustomer || !branch || !selectedService) {
      setError("Cliente, sucursal y servicio son obligatorios.");
      return;
    }

    const now = new Date();
    onCreate({
      customer: trimmedCustomer,
      branch,
      service: selectedService.name,
      price: selectedService.price,
      status: "CREADO",
      createdAt: now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
    });
  };

  return (
    <Modal title="Nueva orden" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-label" htmlFor="new-ord-customer">
            Cliente
          </label>
          <input
            id="new-ord-customer"
            className="form-input"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Ej: María Gómez"
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="new-ord-branch">
            Sucursal
          </label>
          <select
            id="new-ord-branch"
            className="form-input form-select"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            {BRANCHES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="new-ord-service">
            Servicio
          </label>
          <select
            id="new-ord-service"
            className="form-input form-select"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
          >
            {branchServices.length === 0 && <option value="">No hay servicios disponibles</option>}
            {branchServices.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="form-label">Precio (CLP)</label>
          <input
            className="form-input"
            value={selectedService ? formatCLP(selectedService.price) : ""}
            disabled
            readOnly
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-footer">
          <button type="button" className="btn2 btn2-outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn2 btn2-primary" disabled={!selectedService}>
            Crear orden
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* =========================================================
   Modal "Solicitar servicio" (Catálogo — Cliente, Spec 024)
   ========================================================= */

function RequestServiceModal({ service, onCreate, onClose }) {
  const availableBranches = BRANCHES.filter((b) => service.branches[b]);
  const [branch, setBranch] = useState(availableBranches[0] || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Spec 025: acá sí se llama al backend de verdad (POST /orders vía el
  // BFF), a diferencia del resto del CRUD de este frontend — así el
  // pedido queda persistido y visible para Operador/Admin en otra
  // sesión, no solo en el estado de React de esta pestaña.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!branch || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ branch, service: service.name, price: service.price });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "No se pudo crear el pedido.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Solicitar ${service.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-label" htmlFor="req-branch">
            Sucursal
          </label>
          <select
            id="req-branch"
            className="form-input form-select"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            {availableBranches.length === 0 && <option value="">No disponible en ninguna sucursal</option>}
            {availableBranches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="form-label">Precio (CLP)</label>
          <input className="form-input" value={formatCLP(service.price)} disabled readOnly />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-footer">
          <button type="button" className="btn2 btn2-outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn2 btn2-primary" disabled={!branch || submitting}>
            {submitting ? "Solicitando..." : "Confirmar solicitud"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* =========================================================
   Vista Admin
   ========================================================= */

const ADMIN_TABS = [
  { key: "orders", label: "Órdenes recientes", subtitle: "Actividad en tiempo real", icon: ClipboardList },
  { key: "catalog", label: "Catálogo", subtitle: "Servicios disponibles", icon: LayoutGrid },
  { key: "branches", label: "Analítica por sucursal", subtitle: "Órdenes e ingresos", icon: BarChart3 },
  { key: "audit", label: "Registro de auditoría", subtitle: "Eventos de seguridad", icon: ShieldCheck },
];

function AdminView({
  orders,
  healthError,
  latencyMs,
  services,
  onAddService,
  onUpdateService,
  onToggleServiceBranch,
  onToggleServiceAvailability,
  onDeleteService,
  onAddOrder,
  onUpdateOrder,
  onDeleteOrder,
  onRefreshOrders,
}) {
  const revenue = orders.reduce((sum, o) => sum + o.price, 0);
  const active = orders.filter((o) => o.status !== "ENTREGADO").length;
  const processing = orders.filter((o) => o.status === "EN_PREPARACION").length;
  const customers = new Set(orders.map((o) => o.customer)).size;
  const maxOrders = Math.max(...BRANCH_ACTIVITY.map((b) => b.orders));

  const [serviceModal, setServiceModal] = useState(null); // null | "new" | service object
  const [orderModal, setOrderModal] = useState(null); // null | "new" | order object
  const [deleteServiceTarget, setDeleteServiceTarget] = useState(null); // null | service object
  const [catalogBranch, setCatalogBranch] = useState(BRANCHES[0]);
  const [activeTab, setActiveTab] = useState("orders");

  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("ALL");
  const [orderBranchFilter, setOrderBranchFilter] = useState("ALL");

  const filteredOrders = useMemo(() => {
    const normalizedQuery = orderQuery.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesQuery =
        !normalizedQuery ||
        o.customer.toLowerCase().includes(normalizedQuery) ||
        o.id.toLowerCase().includes(normalizedQuery);
      const matchesStatus = orderStatusFilter === "ALL" || o.status === orderStatusFilter;
      const matchesBranch = orderBranchFilter === "ALL" || o.branch === orderBranchFilter;
      return matchesQuery && matchesStatus && matchesBranch;
    });
  }, [orders, orderQuery, orderStatusFilter, orderBranchFilter]);

  const currentTab = ADMIN_TABS.find((t) => t.key === activeTab);

  const handleServiceSubmit = (data) => {
    if (data.id) {
      onUpdateService(data);
    } else {
      onAddService(data);
    }
    setServiceModal(null);
  };

  const handleOrderSave = (data) => {
    onUpdateOrder(data);
    setOrderModal(null);
  };

  const handleOrderDelete = (id) => {
    onDeleteOrder(id);
    setOrderModal(null);
  };

  const handleOrderCreate = (data) => {
    onAddOrder(data);
    setOrderModal(null);
  };

  return (
    <>
      <div className="bento2-grid role-admin-top">
        <BentoCard title="Estado del sistema" subtitle="Salud de servicios" icon={Activity} className="card-health">
          <div className="health2-list">
            <div className={`health2-row ${healthError ? "health2-row-error" : "health2-row-ok"}`}>
              <div className="health2-row-left">
                <span className="health2-dot-wrap">
                  <span className="health2-dot-ping" />
                  <span className="health2-dot-core" />
                </span>
                BFF Service
              </div>
              <span className="health2-row-right">
                {healthError ? "Sin conexión" : "Online · :8080"}
              </span>
            </div>
            <div className="health2-row health2-row-muted">
              <span className="health2-row-left">
                <KeyRound size={13} /> JWT Azure CIAM
              </span>
              <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                {healthError ? "No validado" : "Válido"}
              </span>
            </div>
            <div className="health2-row health2-row-muted">
              <span className="health2-row-left">
                <Activity size={13} /> Latencia
              </span>
              <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                {latencyMs != null ? `${latencyMs} ms` : "—"}
              </span>
            </div>
            {healthError && (
              <p style={{ fontSize: "0.68rem", color: "var(--color-rose-700)", margin: 0 }}>
                {healthError}
              </p>
            )}
          </div>
        </BentoCard>

        <BentoCard title="Indicadores del sistema" subtitle="Métricas globales" icon={BarChart3} className="card-kpis">
          <div className="kpi2-grid">
            <KpiStat label="Ingresos totales" value={formatCLP(revenue)} icon={DollarSign} trend="+12%" accent="kpi2-icon-emerald" />
            <KpiStat label="Órdenes activas" value={String(active)} icon={Package} trend="+4" accent="kpi2-icon-indigo" />
            <KpiStat label="En preparación" value={String(processing)} icon={Loader} accent="kpi2-icon-amber" />
            <KpiStat label="Clientes" value={String(customers)} icon={Users} trend="+2" accent="kpi2-icon-sky" />
          </div>
        </BentoCard>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Módulos de administración">
        {ADMIN_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={`admin-tab ${activeTab === t.key ? "active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <BentoCard
        title={currentTab.label}
        subtitle={currentTab.subtitle}
        icon={currentTab.icon}
        className="admin-tab-panel"
      >
        {activeTab === "orders" && (
          <>
            <div className="orders2-actions">
              <button className="btn2 btn2-primary orders2-new-btn" onClick={() => setOrderModal("new")}>
                <Plus size={12} /> Nueva orden
              </button>
            </div>

            <div className="orders-filter-bar">
              <input
                className="form-input"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                placeholder="Buscar por cliente o N° de orden..."
              />
              <select
                className="form-input form-select"
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
              >
                <option value="ALL">Todos los estados</option>
                {STATUS_FLOW.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <select
                className="form-input form-select"
                value={orderBranchFilter}
                onChange={(e) => setOrderBranchFilter(e.target.value)}
              >
                <option value="ALL">Todas las sucursales</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn2 btn2-outline"
                onClick={onRefreshOrders}
                title="Volver a pedir las órdenes al backend"
              >
                <RefreshCw size={12} /> Actualizar
              </button>
            </div>

            {filteredOrders.length === 0 ? (
              <p className="op2-empty-sm">Sin resultados</p>
            ) : (
              <div className="table2-wrapper">
                <table className="table2">
                  <thead>
                    <tr>
                      <th>Orden</th>
                      <th>Cliente</th>
                      <th>Sucursal</th>
                      <th>Servicio</th>
                      <th>Precio</th>
                      <th>Estado</th>
                      <th className="align-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="cell-strong">{o.id}</td>
                        <td>{o.customer}</td>
                        <td>{o.branch}</td>
                        <td>{o.service}</td>
                        <td className="cell-strong">{formatCLP(o.price)}</td>
                        <td>
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="align-right">
                          <button className="btn2 btn2-outline" onClick={() => setOrderModal(o)}>
                            <Eye size={11} /> Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {orderModal === "new" && (
              <NewOrderModal services={services} onCreate={handleOrderCreate} onClose={() => setOrderModal(null)} />
            )}
            {orderModal && orderModal !== "new" && (
              <OrderViewModal
                order={orderModal}
                services={services}
                onSave={handleOrderSave}
                onDelete={handleOrderDelete}
                onClose={() => setOrderModal(null)}
              />
            )}
          </>
        )}

        {activeTab === "catalog" && (
          <>
            <button className="btn2 btn2-primary catalog2-new-btn" onClick={() => setServiceModal("new")}>
              <Plus size={12} /> Nuevo servicio
            </button>
            <div className="form-field">
              <label className="form-label" htmlFor="catalog-branch-filter">
                Ver disponibilidad en
              </label>
              <select
                id="catalog-branch-filter"
                className="form-input form-select"
                value={catalogBranch}
                onChange={(e) => setCatalogBranch(e.target.value)}
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="catalog2-list">
              {services.map((s) => {
                const enabledHere = Boolean(s.branches[catalogBranch]);
                const enabledCount = Object.values(s.branches).filter(Boolean).length;
                const availableAnywhere = isServiceAvailableAnywhere(s);
                return (
                  <div key={s.id} className={`catalog2-row ${!enabledHere ? "catalog2-row-inactive" : ""}`}>
                    <div>
                      <p className="catalog2-row-name">
                        {s.name}
                        {!availableAnywhere ? (
                          <span className="catalog2-row-tag">No disponible</span>
                        ) : (
                          !enabledHere && (
                            <span className="catalog2-row-tag">No disponible en {catalogBranch}</span>
                          )
                        )}
                      </p>
                      <p className="catalog2-row-eta">
                        Entrega {s.eta} · {enabledCount}/{BRANCHES.length} sucursales
                      </p>
                    </div>
                    <div className="catalog2-row-actions">
                      <span className="catalog2-row-price">{formatCLP(s.price)}</span>
                      <button
                        className="btn2 btn2-outline"
                        onClick={() => setServiceModal(s)}
                        aria-label={`Editar ${s.name}`}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className="btn2 btn2-outline"
                        onClick={() => onToggleServiceBranch(s.id, catalogBranch)}
                        aria-label={
                          enabledHere
                            ? `Desactivar ${s.name} en ${catalogBranch}`
                            : `Reactivar ${s.name} en ${catalogBranch}`
                        }
                        title={
                          enabledHere
                            ? `Desactivar en ${catalogBranch}`
                            : `Reactivar en ${catalogBranch}`
                        }
                      >
                        {enabledHere ? <Ban size={12} /> : <RotateCcw size={12} />}
                      </button>
                      <button
                        className={`btn2 ${availableAnywhere ? "btn2-outline btn2-danger" : "btn2-outline"}`}
                        onClick={() => onToggleServiceAvailability(s.id)}
                        aria-label={
                          availableAnywhere
                            ? `Marcar ${s.name} como no disponible en todas las sucursales`
                            : `Reactivar ${s.name} en todas las sucursales`
                        }
                        title={availableAnywhere ? "Marcar no disponible" : "Reactivar en todas partes"}
                      >
                        {availableAnywhere ? "No disponible" : "Reactivar"}
                      </button>
                      <button
                        className="btn2 btn2-outline btn2-danger"
                        onClick={() => setDeleteServiceTarget(s)}
                        aria-label={`Eliminar ${s.name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {serviceModal && (
              <ServiceFormModal
                initialService={serviceModal === "new" ? null : serviceModal}
                onSubmit={handleServiceSubmit}
                onClose={() => setServiceModal(null)}
              />
            )}

            {deleteServiceTarget && (
              <ConfirmModal
                title="Eliminar servicio"
                message={`¿Eliminar "${deleteServiceTarget.name}" del catálogo? Esta acción no se puede deshacer.`}
                confirmLabel="Eliminar"
                onConfirm={() => {
                  onDeleteService(deleteServiceTarget.id);
                  setDeleteServiceTarget(null);
                }}
                onCancel={() => setDeleteServiceTarget(null)}
              />
            )}
          </>
        )}

        {activeTab === "branches" && (
          <div className="branch2-list">
            {BRANCH_ACTIVITY.map((b) => (
              <div key={b.branch}>
                <div className="branch2-row-head">
                  <span className="branch-name">{b.branch}</span>
                  <span className="branch-count">{b.orders} órdenes</span>
                </div>
                <div className="branch2-bar-track">
                  <div className="branch2-bar-fill" style={{ width: `${(b.orders / maxOrders) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "audit" && (
          <ul className="audit2-list">
            {AUDIT_LOG.map((log, i) => (
              <li key={i} className="audit2-item">
                <span className={`audit2-dot audit2-dot-${log.level}`} />
                <div className="audit2-body">
                  <p className="audit2-action">{log.action}</p>
                  <p className="audit2-actor">{log.actor}</p>
                </div>
                <span className="audit2-time">{log.time}</span>
              </li>
            ))}
          </ul>
        )}
      </BentoCard>
    </>
  );
}

/* =========================================================
   Vista Operador
   ========================================================= */

function OperadorView({
  orders,
  onChangeStatus,
  services,
  onToggleServiceBranch,
  sucursal,
  onSucursalChange,
  onRefreshOrders,
}) {
  const [query, setQuery] = useState("");
  const [viewOrder, setViewOrder] = useState(null);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("ALL");

  const pending = orders.filter((o) => o.status === "CREADO" || o.status === "ACEPTADO").length;
  const express = orders.filter((o) => o.service === "Servicio exprés").length;
  const pipeline = orders.filter((o) => o.status === "DESPACHADO").length;

  const filteredServices = useMemo(
    () => services.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
    [query, services]
  );

  const activeOrders = useMemo(() => {
    const normalizedQuery = orderQuery.trim().toLowerCase();
    return orders.filter((o) => {
      // Sin filtro explícito, oculta las entregadas (ya no requieren
      // gestión); si el operador elige "Entregado" a propósito, se muestran.
      if (orderStatusFilter === "ALL" && o.status === "ENTREGADO") return false;
      const matchesQuery =
        !normalizedQuery ||
        o.id.toLowerCase().includes(normalizedQuery) ||
        o.customer.toLowerCase().includes(normalizedQuery);
      const matchesStatus = orderStatusFilter === "ALL" || o.status === orderStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [orders, orderQuery, orderStatusFilter]);

  return (
    <div className="bento2-grid role-operador">
      <BentoCard title="Indicadores operativos" subtitle="Tu turno" icon={ListChecks} className="card-op-kpis">
        <div className="form-field">
          <label className="form-label" htmlFor="operador-sucursal">
            Sucursal en turno
          </label>
          <select
            id="operador-sucursal"
            className="form-input form-select"
            value={sucursal}
            onChange={(e) => onSucursalChange(e.target.value)}
          >
            {BRANCHES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="kpi2-grid cols-3">
          <KpiStat label="Pendientes de preparación" value={String(pending)} icon={Clock} accent="kpi2-icon-amber" />
          <KpiStat label="Órdenes exprés" value={String(express)} icon={Zap} accent="kpi2-icon-violet" />
          <KpiStat label="En despacho" value={String(pipeline)} icon={Truck} accent="kpi2-icon-sky" />
        </div>
      </BentoCard>

      <BentoCard title="Gestión de órdenes" subtitle="Consulta y ajusta el estado de cada orden" icon={KanbanSquare} className="card-op-orders">
        <div className="orders-filter-bar">
          <input
            className="form-input"
            value={orderQuery}
            onChange={(e) => setOrderQuery(e.target.value)}
            placeholder="Buscar por N° de orden o cliente..."
          />
          <select
            className="form-input form-select"
            value={orderStatusFilter}
            onChange={(e) => setOrderStatusFilter(e.target.value)}
          >
            <option value="ALL">Todos los estados</option>
            {STATUS_FLOW.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn2 btn2-outline"
            onClick={onRefreshOrders}
            title="Volver a pedir las órdenes al backend"
          >
            <RefreshCw size={12} /> Actualizar
          </button>
        </div>

        <ul className="op2-order-list">
          {activeOrders.map((o) => {
            return (
              <li key={o.id} className="op2-order-item">
                <div>
                  <div className="op2-order-id-row">
                    <span className="op2-order-id">{o.id}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="op2-order-meta">
                    {o.customer} · {o.service} · {o.branch}
                  </p>
                </div>
                <div className="modal-footer-actions">
                  <button className="btn2 btn2-outline" onClick={() => setViewOrder(o)}>
                    <Eye size={11} /> Ver
                  </button>
                </div>
              </li>
            );
          })}
          {activeOrders.length === 0 && <li className="op2-empty">No hay órdenes activas.</li>}
        </ul>

        {viewOrder && (
          <OrderLifecycleModal
            order={viewOrder}
            canEdit
            onChangeStatus={(id, status) => {
              onChangeStatus(id, status);
              setViewOrder(null);
            }}
            onClose={() => setViewOrder(null)}
          />
        )}
      </BentoCard>

      <BentoCard title="Consulta rápida de catálogo" subtitle="Precios y disponibilidad" icon={Search} className="card-op-catalog">
        <div className="op2-search-wrap">
          <span className="op2-search-icon">
            <Search size={14} />
          </span>
          <input
            className="op2-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar servicio..."
          />
        </div>
        <ul className="op2-catalog-list">
          {filteredServices.map((s) => {
            const availableHere = Boolean(s.branches[sucursal]);
            return (
              <li key={s.id} className="op2-catalog-item">
                <div>
                  <p className="op2-catalog-name">{s.name}</p>
                  <span className={availableHere ? "op2-catalog-avail" : "op2-catalog-unavail"}>
                    {availableHere ? "Disponible" : "No disponible"}
                  </span>
                </div>
                <div className="op2-catalog-right">
                  <span className="op2-catalog-price">{formatCLP(s.price)}</span>
                  <button
                    className="btn2 btn2-outline"
                    onClick={() => onToggleServiceBranch(s.id, sucursal)}
                    aria-label={
                      availableHere
                        ? `Marcar ${s.name} como no disponible en ${sucursal}`
                        : `Reactivar ${s.name} en ${sucursal}`
                    }
                    title={availableHere ? `No disponible en ${sucursal}` : `Reactivar en ${sucursal}`}
                  >
                    {availableHere ? <Ban size={12} /> : <RotateCcw size={12} />}
                  </button>
                </div>
              </li>
            );
          })}
          {filteredServices.length === 0 && <li className="op2-empty-sm">Sin resultados</li>}
        </ul>
      </BentoCard>
    </div>
  );
}

/* =========================================================
   Vista Cliente
   ========================================================= */

function ClienteView({ services, orders, actor, onRequestOrder }) {
  const progress = Math.min(100, (POINTS / POINTS_GOAL) * 100);
  const [viewOrder, setViewOrder] = useState(null);
  const [requestingService, setRequestingService] = useState(null);

  // No existe en el backend un vínculo real entre la cuenta Azure y el
  // pedido (Spec 020 nota de alcance); se usa el nombre/email de la
  // sesión como comparación exacta (case-insensitive) contra `cliente`,
  // que es lo que también se guarda al crear un pedido acá mismo.
  const normalizedActor = actor.trim().toLowerCase();
  const myOrders = orders.filter((o) => o.customer.trim().toLowerCase() === normalizedActor);

  return (
    <div className="bento2-grid role-cliente">
      <BentoCard title="Puntos de fidelidad" subtitle="Clean&Fresh Rewards" icon={Gift} className="card-loyalty">
        <div className="loyalty2-hero">
          <div className="loyalty2-label">
            <Zap size={13} /> Saldo disponible
          </div>
          <p className="loyalty2-value">{POINTS}</p>
          <p className="loyalty2-unit">puntos</p>
        </div>
        <div className="loyalty2-progress">
          <div className="loyalty2-progress-head">
            <span className="muted">Próxima recompensa</span>
            <span className="strong">
              {POINTS}/{POINTS_GOAL}
            </span>
          </div>
          <div className="loyalty2-progress-track">
            <div className="loyalty2-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <button className="loyalty2-redeem-btn">Redimir puntos</button>
        </div>
      </BentoCard>

      <BentoCard title="Tus pedidos" subtitle="Solo tus órdenes" icon={ListTodo} className="card-cli-orders">
        <ul className="op2-order-list">
          {myOrders.map((o) => (
            <li key={o.id} className="op2-order-item">
              <div>
                <div className="op2-order-id-row">
                  <span className="op2-order-id">{o.id}</span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="op2-order-meta">
                  {o.customer} · {o.service} · {o.branch}
                </p>
              </div>
              <button className="btn2 btn2-outline" onClick={() => setViewOrder(o)}>
                <Eye size={11} /> Ver
              </button>
            </li>
          ))}
          {myOrders.length === 0 && (
            <li className="op2-empty">Todavía no tienes pedidos. Solicita uno desde el catálogo.</li>
          )}
        </ul>

        {viewOrder && (
          <OrderLifecycleModal order={viewOrder} canEdit={false} onClose={() => setViewOrder(null)} />
        )}
      </BentoCard>

      <BentoCard title="Catálogo de servicios" subtitle="Solicita un nuevo servicio" icon={Zap} className="card-cli-catalog">
        <div className="service2-grid">
          {services.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              action={
                <button
                  className="btn2 btn2-primary"
                  disabled={!isServiceAvailableAnywhere(s)}
                  onClick={() => setRequestingService(s)}
                >
                  <Plus size={11} /> Solicitar
                </button>
              }
            />
          ))}
        </div>

        {requestingService && (
          <RequestServiceModal
            service={requestingService}
            onCreate={onRequestOrder}
            onClose={() => setRequestingService(null)}
          />
        )}
      </BentoCard>
    </div>
  );
}

/* =========================================================
   Dashboard principal
   ========================================================= */

function BentoDashboard() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  // Al recargar (F5), MSAL restaura la sesión desde localStorage de forma
  // asíncrona y getActiveAccount()/accounts[0] pueden traer idTokenClaims
  // incompleto (sin "roles") porque reconstruyen la cuenta desde caché sin
  // volver a validar el token. acquireTokenSilent() fuerza esa validación y
  // devuelve una cuenta con los claims reales y completos.
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [account, setAccount] = useState(null);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    if (inProgress !== InteractionStatus.None || !isAuthenticated) return;

    const activeAccount = instance.getActiveAccount() || accounts[0];
    if (!activeAccount) return;

    let cancelled = false;

    instance
      .acquireTokenSilent({ ...loginRequest, account: activeAccount })
      .then((result) => {
        if (cancelled) return;
        setAccount(result.account);
        setRoles(result.account?.idTokenClaims?.roles || []);
        setRolesLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect({ ...loginRequest, account: activeAccount });
          return;
        }
        setAccount(activeAccount);
        setRoles(activeAccount.idTokenClaims?.roles || []);
        setRolesLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [inProgress, isAuthenticated, instance, accounts]);

  const isAdmin = roles.includes("Admin");
  const isOperador = roles.includes("Operador");
  const roleVariant = isAdmin ? "admin" : isOperador ? "operador" : "cliente";

  const [orders, setOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [healthError, setHealthError] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);

  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [dataError, setDataError] = useState(null);

  // Nombre/email de quien está en esta sesión — se usa como "actor" en el
  // historial de cambios de estado de una orden (Spec 020).
  const actor = account?.name || account?.username || "Desconocido";

  // Sucursal "en turno" del Operador (Spec 019): arranca en la primera
  // de la lista; cambiarla dispara un pedido nuevo al BFF, no filtra
  // client-side sobre datos ya traídos.
  const [operadorSucursal, setOperadorSucursal] = useState(BRANCHES[0]);

  // Llamada real al BFF (GET /api/health) — solo para Admin, que es quien
  // ve la tarjeta "Estado del sistema".
  useEffect(() => {
    if (!rolesLoaded || !account || !isAdmin) return;

    const startedAt = performance.now();
    getHealth()
      .then(() => {
        setLatencyMs(Math.round(performance.now() - startedAt));
        setHealthError(null);
      })
      .catch((error) => {
        setLatencyMs(Math.round(performance.now() - startedAt));
        setHealthError(error?.response?.data?.message || error.message || "Error desconocido");
      });
  }, [instance, account, isAdmin, rolesLoaded]);

  // Catálogo real (GET /api/catalog) — todas las vistas lo necesitan.
  useEffect(() => {
    if (!rolesLoaded || !account) return;

    getCatalog()
      .then((data) => {
        setServices(data);
        setCatalogLoaded(true);
      })
      .catch((error) => {
        setDataError(error?.response?.data?.message || error.message || "Error desconocido");
      });
  }, [rolesLoaded, account]);

  // Órdenes reales (GET /api/orders) — las necesitan las tres vistas
  // desde la Spec 020 (Cliente ya no usa un mock aparte). Se expone
  // como función aparte (fetchOrders) para que Admin/Operador puedan
  // volver a pedirlas a demanda con un botón "Actualizar" (Spec 025) —
  // sin esto, un pedido creado por Cliente en otra sesión no aparece
  // hasta recargar la página entera.
  const fetchOrders = useCallback(() => {
    return getOrders(roleVariant === "operador" ? operadorSucursal : undefined)
      .then((data) => {
        setOrders(data);
        setOrdersLoaded(true);
      })
      .catch((error) => {
        setDataError(error?.response?.data?.message || error.message || "Error desconocido");
      });
  }, [roleVariant, operadorSucursal]);

  useEffect(() => {
    if (!rolesLoaded || !account) return;
    fetchOrders();
  }, [rolesLoaded, account, fetchOrders]);

  // Agrega una entrada al historial solo si el estado realmente cambió
  // (Spec 020) — usado por cualquier camino que modifique el estado de
  // una orden, sin importar desde qué vista.
  const recordStatusChange = (order, newStatus) => {
    if (order.status === newStatus) return order;
    return {
      ...order,
      status: newStatus,
      history: [
        ...order.history,
        { status: newStatus, actor, timestamp: new Date().toLocaleString("es-CL") },
      ],
    };
  };

  const changeOrderStatus = (id, newStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? recordStatusChange(o, newStatus) : o)));
  };

  const addService = (data) => {
    const id = `svc-${Date.now()}`;
    setServices((prev) => [...prev, { ...data, id }]);
  };

  const updateService = (data) => {
    setServices((prev) => prev.map((s) => (s.id === data.id ? { ...s, ...data } : s)));
  };

  const toggleServiceBranch = (id, branchName) => {
    setServices((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, branches: { ...s.branches, [branchName]: !s.branches[branchName] } }
          : s
      )
    );
  };

  const deleteService = (id) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  // Toggle rápido "servicio completo": si está disponible en alguna
  // sucursal lo desactiva en todas; si no está disponible en ninguna,
  // lo reactiva en todas. Complementa el toggle por sucursal individual.
  const toggleServiceAvailability = (id) => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const makeAvailable = !isServiceAvailableAnywhere(s);
        const branches = Object.keys(s.branches).reduce(
          (acc, b) => ({ ...acc, [b]: makeAvailable }),
          {}
        );
        return { ...s, branches };
      })
    );
  };

  const addOrder = (data) => {
    const id = `ORD-${Date.now()}`;
    const timestamp = new Date().toLocaleString("es-CL");
    setOrders((prev) => [
      { ...data, id, history: [{ status: data.status, actor, timestamp }] },
      ...prev,
    ]);
  };

  // Spec 025: a diferencia de addOrder (client-side puro, usado por
  // "Nueva orden" de Admin), esto crea el pedido de verdad en el
  // backend — por eso es async y puede fallar (lo maneja
  // RequestServiceModal). El pedido creado ya viene con su propio
  // historial seedeado desde createOrder().
  const requestOrder = async (data) => {
    const created = await createOrder(data);
    setOrders((prev) => [created, ...prev]);
  };

  const updateOrder = (data) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== data.id) return o;
        // Fusiono primero los campos que no son el estado, y dejo que
        // recordStatusChange sea el único que decide si corresponde
        // agregar una entrada al historial (comparando contra el estado
        // original, antes de la fusión).
        const merged = { ...o, ...data, status: o.status };
        return recordStatusChange(merged, data.status);
      })
    );
  };

  const deleteOrder = (id) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const dataLoaded = catalogLoaded && ordersLoaded;

  if (dataError) {
    return (
      <div className="bento-loading">
        No se pudo cargar la información del sistema: {dataError}
      </div>
    );
  }

  if (!rolesLoaded || !dataLoaded) {
    return (
      <div className="bento-loading">
        <span className="bento-loading-spinner" aria-hidden="true" />
        Cargando...
      </div>
    );
  }

  return (
    <main className="dash2-main">
      <div className="dash2-header">
        <h2>
          {roleVariant === "admin" && "Panel de administración"}
          {roleVariant === "operador" && "Panel operativo"}
          {roleVariant === "cliente" && "Mi cuenta"}
        </h2>
        <p>
          {roleVariant === "admin" && "Vista general del sistema, órdenes y sucursales."}
          {roleVariant === "operador" && "Gestiona el flujo de las órdenes en tu turno."}
          {roleVariant === "cliente" && "Sigue tus pedidos y solicita nuevos servicios."}
        </p>
      </div>

      {roleVariant === "admin" && (
        <AdminView
          orders={orders}
          healthError={healthError}
          latencyMs={latencyMs}
          services={services}
          onAddService={addService}
          onUpdateService={updateService}
          onToggleServiceBranch={toggleServiceBranch}
          onToggleServiceAvailability={toggleServiceAvailability}
          onDeleteService={deleteService}
          onAddOrder={addOrder}
          onUpdateOrder={updateOrder}
          onDeleteOrder={deleteOrder}
          onRefreshOrders={fetchOrders}
        />
      )}
      {roleVariant === "operador" && (
        <OperadorView
          orders={orders}
          onChangeStatus={changeOrderStatus}
          services={services}
          onToggleServiceBranch={toggleServiceBranch}
          sucursal={operadorSucursal}
          onSucursalChange={setOperadorSucursal}
          onRefreshOrders={fetchOrders}
        />
      )}
      {roleVariant === "cliente" && (
        <ClienteView services={services} orders={orders} actor={actor} onRequestOrder={requestOrder} />
      )}
    </main>
  );
}

export default BentoDashboard;
