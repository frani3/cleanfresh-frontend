import {
  countUnread,
  filterNotifications,
  formatWhen,
  kindLabel,
  recipientLabel,
} from "./notifications";

const NOW = new Date("2026-10-21T12:00:00Z").getTime();
const hace = (ms) => new Date(NOW - ms).toISOString();

const avisos = [
  { id: 3, tipo: "ORDEN_LISTA", leida: false },
  { id: 2, tipo: "ORDEN_CREADA", leida: true },
  { id: 1, tipo: "ORDEN_CREADA", leida: false },
];

describe("formatWhen", () => {
  test("lo reciente se dice en relativo", () => {
    expect(formatWhen(hace(10 * 1000), NOW)).toBe("hace un momento");
    expect(formatWhen(hace(5 * 60 * 1000), NOW)).toBe("hace 5 min");
    expect(formatWhen(hace(59 * 60 * 1000), NOW)).toBe("hace 59 min");
    expect(formatWhen(hace(3 * 3600 * 1000), NOW)).toBe("hace 3 h");
  });

  test("pasado un día muestra la fecha completa", () => {
    const texto = formatWhen(hace(2 * 24 * 3600 * 1000), NOW);
    expect(texto).not.toMatch(/^hace/);
    expect(texto).toMatch(/2026/);
  });

  test("una fecha inválida no rompe", () => {
    expect(formatWhen("no-es-fecha", NOW)).toBe("");
    expect(formatWhen(undefined, NOW)).toBe("");
  });
});

describe("contador y filtro", () => {
  test("cuenta solo los sin leer", () => {
    expect(countUnread(avisos)).toBe(2);
    expect(countUnread([])).toBe(0);
  });

  test("el filtro Sin leer deja solo los pendientes y Todas deja todos", () => {
    expect(filterNotifications(avisos, "UNREAD").map((n) => n.id)).toEqual([3, 1]);
    expect(filterNotifications(avisos, "ALL")).toHaveLength(3);
  });

  test("no modifica la lista original", () => {
    filterNotifications(avisos, "UNREAD");
    expect(avisos).toHaveLength(3);
  });
});

describe("kindLabel", () => {
  test("traduce los tipos conocidos y deja pasar los demás", () => {
    expect(kindLabel("ORDEN_CREADA")).toBe("Pedido nuevo");
    expect(kindLabel("ORDEN_LISTA")).toBe("Pedido listo");
    expect(kindLabel("ORDEN_ESTADO")).toBe("Estado del pedido");
    expect(kindLabel("OTRO")).toBe("OTRO");
  });
});

describe("recipientLabel (lo que ve el Admin)", () => {
  const ordenes = [{ id: "ORD-0014", customer: "ana@cleanfresh.com" }];

  test("un aviso de sucursal dice la sucursal", () => {
    expect(recipientLabel({ destinatarioTipo: "SUCURSAL", destinatario: "Providencia" })).toBe("Sucursal Providencia");
  });

  test("un aviso de cliente muestra su nombre si la orden está en la lista", () => {
    const n = { destinatarioTipo: "CLIENTE", destinatario: "64888468-1021-70ae-1c1b-36e6f67b3175", numeroOrden: "ORD-0014" };
    expect(recipientLabel(n, ordenes)).toBe("Cliente ana@cleanfresh.com");
  });

  test("si no conoce la orden, abrevia el identificador", () => {
    const n = { destinatarioTipo: "CLIENTE", destinatario: "64888468-1021-70ae-1c1b-36e6f67b3175", numeroOrden: "ORD-9999" };
    expect(recipientLabel(n, ordenes)).toBe("Cliente 64888468…");
  });

  test("un identificador corto se muestra completo", () => {
    expect(recipientLabel({ destinatarioTipo: "CLIENTE", destinatario: "ana" }, [])).toBe("Cliente ana");
  });
});
