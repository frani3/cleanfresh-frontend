import { compareNewestFirst, createdTime, formatOrderDate, orderNumber } from "./orders";

// Órdenes del backend: las nuevas traen el instante de creación (UTC), las anteriores solo la fecha.
const orden = (id, createdAtTime = null, createdAt = "2026-10-21") => ({ id, createdAtTime, createdAt });

describe("orderNumber", () => {
  test("saca el número del N° de orden", () => {
    expect(orderNumber({ id: "ORD-0014" })).toBe(14);
    expect(orderNumber({ id: "ORD-1760000000000" })).toBe(1760000000000);
    expect(orderNumber({ id: "sin-numero" })).toBe(0);
  });
});

describe("createdTime", () => {
  test("lee el instante, y devuelve null si falta o es inválido", () => {
    expect(createdTime(orden("ORD-0001", "2026-10-21T04:33:04.123456Z"))).toBe(Date.parse("2026-10-21T04:33:04.123Z"));
    expect(createdTime(orden("ORD-0001"))).toBeNull();
    expect(createdTime(orden("ORD-0001", "no-es-fecha"))).toBeNull();
  });
});

describe("compareNewestFirst (el más reciente arriba)", () => {
  const ids = (lista) => [...lista].sort(compareNewestFirst).map((o) => o.id);

  test("ordena por fecha y hora, no por número de orden", () => {
    const lista = [
      orden("ORD-0010", "2026-10-21T10:00:00Z"),
      orden("ORD-0012", "2026-10-21T09:00:00Z"), // número mayor pero hecha antes
      orden("ORD-0011", "2026-10-21T11:30:00Z"),
    ];
    expect(ids(lista)).toEqual(["ORD-0011", "ORD-0010", "ORD-0012"]);
  });

  test("con el mismo instante desempata por número de orden (el más alto, arriba)", () => {
    const lista = [orden("ORD-0010", "2026-10-21T10:00:00Z"), orden("ORD-0011", "2026-10-21T10:00:00Z")];
    expect(ids(lista)).toEqual(["ORD-0011", "ORD-0010"]);
  });

  test("las órdenes con hora quedan arriba de las anteriores, que van por número", () => {
    const lista = [
      orden("ORD-0003", null, "2026-10-08"),
      orden("ORD-0013", "2026-10-21T04:33:00Z"),
      orden("ORD-0007", null, "2026-10-08"),
      orden("ORD-0002", null, "2026-10-08"),
    ];
    expect(ids(lista)).toEqual(["ORD-0013", "ORD-0007", "ORD-0003", "ORD-0002"]);
  });

  test("sin hora en ninguna, es el orden por número de siempre", () => {
    expect(ids([orden("ORD-0001", null), orden("ORD-0006", null), orden("ORD-0003", null)])).toEqual(["ORD-0006", "ORD-0003", "ORD-0001"]);
  });

  test("no modifica la lista original", () => {
    const lista = [orden("ORD-0001", "2026-10-21T01:00:00Z"), orden("ORD-0002", "2026-10-21T02:00:00Z")];
    [...lista].sort(compareNewestFirst);
    expect(lista.map((o) => o.id)).toEqual(["ORD-0001", "ORD-0002"]);
  });
});

describe("formatOrderDate", () => {
  test("una orden nueva muestra fecha y hora en el formato 21-10-2026 01:26", () => {
    // 04:26 UTC = 01:26 en Chile (UTC-3 en octubre)
    expect(formatOrderDate(orden("ORD-0014", "2026-10-21T04:26:10.123456Z"), "America/Santiago")).toBe("21-10-2026 01:26");
  });

  test("la hora es de 24 horas y rellena con ceros", () => {
    expect(formatOrderDate(orden("a", "2026-03-05T22:07:00Z"), "UTC")).toBe("05-03-2026 22:07");
    expect(formatOrderDate(orden("a", "2026-03-05T00:05:00Z"), "UTC")).toBe("05-03-2026 00:05");
  });

  test("cambia de día según la zona horaria (la del navegador)", () => {
    const o = orden("a", "2026-10-21T01:30:00Z");
    expect(formatOrderDate(o, "UTC")).toBe("21-10-2026 01:30");
    expect(formatOrderDate(o, "America/Santiago")).toBe("20-10-2026 22:30");
  });

  test("una orden anterior, sin hora, muestra solo la fecha y no inventa una hora", () => {
    expect(formatOrderDate(orden("ORD-0001", null, "2026-10-08"))).toBe("08-10-2026");
  });

  test("sin fecha reconocible devuelve vacío", () => {
    expect(formatOrderDate({ id: "x" })).toBe("");
    expect(formatOrderDate(orden("x", null, "14:30"))).toBe("");
  });
});
