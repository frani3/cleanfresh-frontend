import { useCallback, useEffect, useRef, useState } from "react";
import { getBranchReport, getReportKpis, getSalesByHour, getTopServices } from "../services/apiService";
import { POLL_MS } from "./useNotifications";

// Reportes del panel Admin (Spec 045): KPIs, ventas por hora, servicios más pedidos y pedidos por sucursal del rango elegido.
// Se calculan en `reportes` con los eventos de Kafka, así que se refrescan solos cada 15 s sin molestar al flujo de pedidos.
function useReports(range) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  // Evita que una respuesta vieja (de otro rango) pise a una más nueva.
  const lastRequest = useRef(0);
  // Una respuesta que llega con el panel ya cerrado no actualiza nada.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(() => {
    const id = ++lastRequest.current;
    const current = () => mounted.current && id === lastRequest.current;
    return Promise.all([getReportKpis(range), getSalesByHour(range), getTopServices(range), getBranchReport(range)])
      .then(([kpis, sales, top, branches]) => {
        if (!current()) return;
        setData({ kpis, sales, top, branches });
        setError(false);
        setUpdatedAt(new Date());
      })
      .catch(() => {
        if (current()) setError(true);
      })
      .finally(() => {
        if (current()) setLoading(false);
      });
  }, [range]);

  useEffect(() => {
    setLoading(true);
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { data, loading, error, updatedAt, reload: load };
}

export default useReports;
