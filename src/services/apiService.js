import axios from "axios";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { protectedResources } from "../authConfig";

const apiClient = axios.create({
  baseURL: protectedResources.bffApi.endpoint,
});

let msalInstance = null;

// Se llama una sola vez desde index.js, justo después de crear el
// PublicClientApplication. A partir de acá, el interceptor de abajo
// resuelve la cuenta activa solo — los componentes que llaman a las
// funciones de este archivo no necesitan pasar instance/account.
export function configureApiAuth(instance) {
  msalInstance = instance;
}

apiClient.interceptors.request.use(async (config) => {
  if (!msalInstance) {
    throw new Error(
      "apiService: configureApiAuth() no fue llamado todavía (falta inicializar MSAL)."
    );
  }

  // getActiveAccount() puede devolver null en una condición de carrera
  // (setActiveAccount() todavía no terminó su flujo async en index.js),
  // aunque ya haya una sesión iniciada — mismo patrón que Navbar.jsx y
  // BentoDashboard.jsx.
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
  if (!account) {
    throw new Error("apiService: no hay una cuenta activa para autenticar la petición.");
  }

  const request = {
    scopes: protectedResources.bffApi.scopes,
    account,
  };

  let token;
  try {
    const result = await msalInstance.acquireTokenSilent(request);
    token = result.idToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      const result = await msalInstance.acquireTokenPopup(request);
      token = result.idToken;
    } else {
      throw error;
    }
  }

  config.headers = config.headers || {};
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function getHealth() {
  const response = await apiClient.get("/health");
  return response.data;
}

// Traduce la forma del catálogo que expone el BFF (nombre/precio/
// duracionHoras/sucursales) a la que ya espera el resto del frontend
// (name/price/eta/branches) — así los componentes no necesitan saber
// que del otro lado hay un DTO distinto.
export async function getCatalog() {
  const response = await apiClient.get("/catalog");
  return response.data.map((item) => ({
    id: item.id,
    name: item.nombre,
    price: item.precio,
    eta: `${item.duracionHoras}h`,
    branches: item.sucursales,
  }));
}

// Idem para órdenes: numeroOrden/cliente/servicio/estado/fecha/total/
// sucursal -> id/customer/service/status/createdAt/price/branch.
function mapOrder(item, actor) {
  return {
    id: item.numeroOrden,
    customer: item.cliente,
    branch: item.sucursal,
    service: item.servicio,
    price: item.total,
    status: item.estado,
    createdAt: item.fecha,
    // El backend no trackea quién hizo cada cambio de estado; arrancamos
    // el historial con una sola entrada "de origen" (Spec 020) y a partir
    // de acá el frontend va sumando entradas reales por sesión. Para un
    // pedido recién creado (Spec 025) sí sabemos quién fue: quien llamó
    // a createOrder().
    history: [{ status: item.estado, actor: actor || "Sistema", timestamp: item.fecha }],
  };
}

// `sucursal` es opcional: el BFF la usa para el Operador (Spec 019); si
// no se pasa, el BFF cae a su mapeo fijo email->sucursal (Spec 016).
export async function getOrders(sucursal) {
  const response = await apiClient.get("/orders", {
    params: sucursal ? { sucursal } : undefined,
  });
  return response.data.map((item) => mapOrder(item));
}

// Spec 025: crea un pedido real en el backend (POST), visible para
// cualquier sesión que después haga GET /orders — a diferencia del
// resto del CRUD de este frontend, que solo vive en el estado de React.
// El BFF ignora cualquier "cliente" que se mande acá: lo resuelve del
// JWT de la sesión.
export async function createOrder({ service, price, branch }) {
  const response = await apiClient.post("/orders", {
    servicio: service,
    total: price,
    sucursal: branch,
  });
  return mapOrder(response.data, response.data.cliente);
}
