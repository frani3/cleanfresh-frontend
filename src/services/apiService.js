import axios from "axios";
import { userManager, bffApiUrl } from "../authConfig";

const apiClient = axios.create({
  baseURL: bffApiUrl,
});

// A diferencia de MSAL (donde se necesitaba idToken porque el tenant
// CIAM no soportaba scopes de API custom), con Cognito sí hay un scope
// de API propio (ver REACT_APP_API_SCOPE) — por eso acá se manda el
// access_token, no el idToken.
apiClient.interceptors.request.use(async (config) => {
  let user = await userManager.getUser();

  if (!user || user.expired) {
    user = await userManager.signinSilent().catch(() => null);
  }

  if (!user) {
    throw new Error("apiService: no hay una sesión activa para autenticar la petición.");
  }

  config.headers = config.headers || {};
  config.headers.Authorization = `Bearer ${user.access_token}`;
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

// Spec 030: cambia el estado de una orden en el backend (antes solo vivía
// en el estado de React). `numeroOrden` es el id que usa la pantalla
// (ORD-0014). El Operador manda su sucursal en turno: el BFF solo le deja
// cambiar órdenes de esa sucursal.
export async function updateOrderStatus(numeroOrden, estado, sucursal) {
  const response = await apiClient.put(
    `/orders/${encodeURIComponent(numeroOrden)}/estado`,
    { estado },
    { params: sucursal ? { sucursal } : undefined }
  );
  return response.data;
}

// Spec 030: avisos del usuario de la sesión. El BFF decide cuáles le
// corresponden según su rol; el Operador indica su sucursal en turno.
export async function getNotifications(sucursal) {
  const response = await apiClient.get("/notificaciones", {
    params: sucursal ? { sucursal } : undefined,
  });
  return response.data;
}

export async function markNotificationsRead(sucursal) {
  await apiClient.post("/notificaciones/leidas", null, {
    params: sucursal ? { sucursal } : undefined,
  });
}
