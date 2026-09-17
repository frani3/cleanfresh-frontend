import { useMsal } from "@azure/msal-react";

// Catálogo mockeado; luego vendría de la API (GET /services).
const SERVICES = [
  { id: 1, nombre: "Lavado y secado", descripcion: "Ropa de uso diario, ciclo estándar.", precio: 18000, icon: "🧺" },
  { id: 2, nombre: "Lavado en seco", descripcion: "Prendas delicadas y trajes.", precio: 25000, icon: "🥼" },
  { id: 3, nombre: "Planchado", descripcion: "Planchado por kilo de ropa.", precio: 9500, icon: "👔" },
  { id: 4, nombre: "Lavado de edredones", descripcion: "Edredones y cobijas de gran tamaño.", precio: 32000, icon: "🛏️" },
  { id: 5, nombre: "Servicio exprés", descripcion: "Entrega en menos de 4 horas.", precio: 12000, icon: "⚡" },
];

function Catalog() {
  const { accounts } = useMsal();
  const roles = accounts[0]?.idTokenClaims?.roles || [];
  const isCliente = roles.includes("Cliente");
  const canManage = roles.includes("Admin");

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Catálogo de Servicios</h1>
        <p className="page-subtitle">Servicios disponibles en todas las sucursales.</p>
      </div>

      {canManage && (
        <div className="callout">
          Como Admin puedes agregar, editar o desactivar servicios (próximamente).
        </div>
      )}

      <div className="catalog-grid">
        {SERVICES.map((service) => (
          <div key={service.id} className="catalog-card">
            <div className="catalog-card-icon" role="img" aria-hidden="true">
              {service.icon}
            </div>
            <h3>{service.nombre}</h3>
            <p className="catalog-card-desc">{service.descripcion}</p>
            <div className="catalog-card-footer">
              <span className="catalog-price">${service.precio.toLocaleString()}</span>
              {isCliente && (
                <button className="btn btn-primary">Solicitar servicio</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Catalog;
