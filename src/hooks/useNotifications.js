import { useCallback, useEffect, useRef, useState } from "react";
import {
  getNotifications,
  markNotificationRead,
  markNotificationsRead,
} from "../services/apiService";
import { countUnread } from "../utils/notifications";

// Cada cuánto se vuelven a pedir los avisos (no hay websockets).
export const POLL_MS = 15000;

// Avisos del usuario de la sesión (Spec 030 y 034). Una sola consulta cada 15 s que comparten la
// campanita del encabezado y el módulo de notificaciones; al marcar leído se actualizan los dos.
//
// El BFF decide qué avisos le tocan a cada rol; acá solo se muestran. El Admin los ve todos pero en
// solo lectura (readOnly): no tiene contador ni los marca, para no borrarles los pendientes a los demás.
//
// enabled: no consulta hasta que la sesión y los datos base estén cargados.
// sucursal: solo el Operador (su sucursal en turno).
function useNotifications({ sucursal, readOnly, enabled }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState(() => new Set());
  const [markingAll, setMarkingAll] = useState(false);
  // Evita que una respuesta vieja (p. ej. de la sucursal anterior) pise a una más nueva.
  const lastRequest = useRef(0);

  const refresh = useCallback(() => {
    const request = ++lastRequest.current;
    return getNotifications(sucursal)
      .then((data) => {
        if (request !== lastRequest.current) return;
        setItems(Array.isArray(data) ? data : []);
        setError(false);
        setLoaded(true);
      })
      .catch(() => {
        if (request !== lastRequest.current) return;
        setError(true);
        setLoaded(true);
      });
  }, [sucursal]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  // Marca UN aviso. Primero el servidor y recién después se refresca la lista: hacerlo a la vez deja
  // que una respuesta vieja deshaga el cambio.
  const markOne = useCallback(
    async (id) => {
      if (readOnly) return;
      setActionError("");
      setPending((prev) => new Set(prev).add(id));
      try {
        await markNotificationRead(id, sucursal);
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
        await refresh();
      } catch (e) {
        setActionError(
          e?.response?.status === 404
            ? "Ese aviso ya no está disponible."
            : "No se pudo marcar el aviso como leído. Intenta de nuevo."
        );
        await refresh();
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [readOnly, sucursal, refresh]
  );

  const markAll = useCallback(async () => {
    if (readOnly) return;
    setActionError("");
    setMarkingAll(true);
    try {
      await markNotificationsRead(sucursal);
      await refresh();
    } catch (e) {
      setActionError("No se pudieron marcar los avisos como leídos. Intenta de nuevo.");
    } finally {
      setMarkingAll(false);
    }
  }, [readOnly, sucursal, refresh]);

  return {
    items,
    loaded,
    error,
    actionError,
    pending,
    markingAll,
    readOnly,
    unread: readOnly ? 0 : countUnread(items),
    refresh,
    markOne,
    markAll,
  };
}

export default useNotifications;
