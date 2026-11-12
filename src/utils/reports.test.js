import {
  EMPTY_AUDIT_FILTERS,
  actionLabel,
  actionLevel,
  activeStates,
  barPercent,
  buildAuditParams,
  formatMinutes,
  groupSalesByDay,
  hasActiveFilters,
  pageInfo,
  salesBars,
} from "./reports";

describe("formatMinutes", () => {
  test("sin dato muestra una raya", () => {
    expect(formatMinutes(null)).toBe("—");
    expect(formatMinutes(undefined)).toBe("—");
  });

  test("menos de un minuto va en segundos", () => {
    expect(formatMinutes(0.5)).toBe("30 s");
    expect(formatMinutes(0.01)).toBe("1 s");
  });

  test("menos de una hora va en minutos", () => {
    expect(formatMinutes(12)).toBe("12 min");
    expect(formatMinutes(12.34)).toBe("12,3 min");
  });

  test("desde una hora va en horas y minutos", () => {
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(80)).toBe("1 h 20 min");
  });
});

describe("barPercent", () => {
  test("el mayor valor llena la barra", () => {
    expect(barPercent(50, 50)).toBe(100);
  });

  test("un valor chico igual se ve", () => {
    expect(barPercent(1, 1000)).toBe(4);
  });

  test("cero, vacío o sin máximo no dibuja barra", () => {
    expect(barPercent(0, 10)).toBe(0);
    expect(barPercent(undefined, 10)).toBe(0);
    expect(barPercent(5, 0)).toBe(0);
  });

  test("proporcional entre el mínimo y el máximo", () => {
    expect(barPercent(25, 100)).toBe(25);
  });
});

describe("ventas por hora y por día", () => {
  const serie = [
    { hora: "2026-10-14T10:00:00", pedidos: 1, monto: 1000 },
    { hora: "2026-10-14T11:00:00", pedidos: 2, monto: 3000 },
    { hora: "2026-10-15T09:00:00", pedidos: 1, monto: 500 },
  ];

  test("agrupa por día sumando pedidos y monto", () => {
    expect(groupSalesByDay(serie)).toEqual([
      { label: "14-10", pedidos: 3, monto: 4000 },
      { label: "15-10", pedidos: 1, monto: 500 },
    ]);
  });

  test("hasta 24 horas se grafica por hora y el mayor monto llena la barra", () => {
    const bars = salesBars(serie, "last24h");
    expect(bars).toHaveLength(3);
    expect(bars[0].label).toBe("10:00");
    expect(bars[1].percent).toBe(100);
    expect(bars[0].percent).toBeCloseTo(33.33, 1);
  });

  test("desde 7 días se grafica por día", () => {
    expect(salesBars(serie, "last7d").map((b) => b.label)).toEqual(["14-10", "15-10"]);
  });

  test("una serie vacía no rompe", () => {
    expect(salesBars([], "last24h")).toEqual([]);
  });

  test("las horas sin pedidos dibujan una barra vacía", () => {
    const bars = salesBars([{ hora: "2026-10-14T10:00:00", pedidos: 0, monto: 0 }], "last24h");
    expect(bars[0].percent).toBe(0);
  });
});

describe("estados activos y acciones", () => {
  test("los estados activos salen en el orden del flujo con ceros donde no hay", () => {
    expect(activeStates({ ACEPTADO: 2, DESPACHADO: 1 })).toEqual([
      { key: "CREADO", label: "Creado", count: 0 },
      { key: "ACEPTADO", label: "Aceptado", count: 2 },
      { key: "EN_PREPARACION", label: "En preparación", count: 0 },
      { key: "DESPACHADO", label: "Despachado", count: 1 },
    ]);
  });

  test("cada evento tiene su etiqueta y una desconocida se muestra tal cual", () => {
    expect(actionLabel("OrderCreated")).toBe("Pedido creado");
    expect(actionLabel("OrderCancelled")).toBe("Pedido cancelado");
    expect(actionLabel("Otra")).toBe("Otra");
    expect(actionLabel(undefined)).toBe("");
  });

  test("el nivel de la acción marca la cancelación como error y la entrega como info", () => {
    expect(actionLevel("OrderCancelled")).toBe("error");
    expect(actionLevel("OrderDelivered")).toBe("info");
    expect(actionLevel("OrderAccepted")).toBe("warn");
  });
});

describe("filtros de la auditoría", () => {
  test("los filtros vacíos no se mandan y los otros van sin espacios", () => {
    expect(buildAuditParams({ ...EMPTY_AUDIT_FILTERS, usuario: "  ana ", tipo: "OrderCreated" }, 2, 10)).toEqual({
      pagina: 2,
      tamano: 10,
      usuario: "ana",
      tipo: "OrderCreated",
    });
  });

  test("sin filtros solo van la página y el tamaño", () => {
    expect(buildAuditParams(EMPTY_AUDIT_FILTERS)).toEqual({ pagina: 0, tamano: 10 });
  });

  test("detecta si hay algún filtro activo", () => {
    expect(hasActiveFilters(EMPTY_AUDIT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_AUDIT_FILTERS, usuario: "   " })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_AUDIT_FILTERS, desde: "2026-10-15" })).toBe(true);
  });
});

describe("pageInfo", () => {
  test("sin resultados no hay páginas", () => {
    expect(pageInfo(0, 0, 10)).toEqual({ from: 0, to: 0, pages: 0, hasPrev: false, hasNext: false });
  });

  test("primera página de varias", () => {
    expect(pageInfo(37, 0, 10)).toEqual({ from: 1, to: 10, pages: 4, hasPrev: false, hasNext: true });
  });

  test("última página con menos filas", () => {
    expect(pageInfo(37, 3, 10)).toEqual({ from: 31, to: 37, pages: 4, hasPrev: true, hasNext: false });
  });

  test("una sola página", () => {
    expect(pageInfo(4, 0, 10)).toEqual({ from: 1, to: 4, pages: 1, hasPrev: false, hasNext: false });
  });
});
