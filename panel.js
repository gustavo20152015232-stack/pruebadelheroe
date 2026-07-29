/* =========================================================
   PANEL INTERNO (panel.html)
   Ventas, Envíos, Stock y Caja.
   Esta página NO se le pasa al cliente.
   ========================================================= */

/* ---------------------------------------------------------
   VENTAS
   --------------------------------------------------------- */

let filtroVentas = { texto: "", periodo: "todo" };

const TOPE_LISTA = 15; // cuántas tarjetas viejas se muestran sin buscar

/* Compara sin distinguir mayúsculas ni acentos: "gomez" encuentra "Gómez". */
function normalizar(txt) {
  return String(txt == null ? "" : txt).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function coincideTexto(p, texto) {
  if (!texto.trim()) return true;
  const t = normalizar(texto);
  if (normalizar(p.numero).indexOf(t) >= 0) return true;
  if (normalizar(p.cliente).indexOf(t) >= 0) return true;
  if (normalizar(p.telefono).indexOf(t) >= 0) return true;
  if (normalizar(p.direccion).indexOf(t) >= 0) return true;
  return p.items.some(function (it) { return normalizar(it.nombre).indexOf(t) >= 0; });
}

function dentroDelPeriodo(p, periodo) {
  if (periodo === "todo") return true;
  if (periodo === "hoy") return ymd(new Date(p.creado)) === hoyYmd();
  const dias = periodo === "semana" ? 7 : 30;
  const limite = new Date();
  limite.setHours(0, 0, 0, 0);
  limite.setDate(limite.getDate() - (dias - 1));
  return new Date(p.creado) >= limite;
}

function vistaVentas(estado) {
  let html = "<div class='encabezado-vista'><h1>Ventas</h1>" +
    "<p>Los pedidos entran acá apenas el cliente confirma.</p></div>";

  html += "<div class='aviso-suave'>Este panel todavía no está protegido: no tiene usuarios ni contraseñas. " +
    "No compartas el link de <strong>panel.html</strong> con clientes.</div>";

  html += "<div class='fila' style='margin-bottom:12px'>" +
    "<button class='btn btn-principal' data-accion='venta-puerta'>Cargar venta en puerta</button>" +
    "<button class='btn btn-suave' data-accion='pedido-manual'>Cargar pedido (WhatsApp/Instagram)</button></div>";

  /* --- Buscador --- */
  const buscando = filtroVentas.texto.trim() !== "" || filtroVentas.periodo !== "todo";
  html += "<div class='tarjeta buscador'>" +
    "<div class='campo'><label for='busca'>Buscar una venta</label>" +
    "<input id='busca' type='search' data-filtro='texto' value='" + esc(filtroVentas.texto) +
    "' placeholder='Número, cliente, teléfono, dirección o producto'></div>" +
    "<div class='fila'>" +
    "<div class='campo' style='flex:1;margin:0'><label for='periodo'>Período</label>" +
    "<select id='periodo' data-filtro='periodo'>" +
    opcion("todo", "Todo", filtroVentas.periodo) +
    opcion("hoy", "Hoy", filtroVentas.periodo) +
    opcion("semana", "Últimos 7 días", filtroVentas.periodo) +
    opcion("mes", "Últimos 30 días", filtroVentas.periodo) +
    "</select></div>" +
    (buscando ? "<button class='btn btn-suave' data-accion='limpiar-filtro' style='align-self:flex-end'>Limpiar</button>" : "") +
    "</div></div>";

  const filtrados = estado.pedidos.filter(function (p) {
    return coincideTexto(p, filtroVentas.texto) && dentroDelPeriodo(p, filtroVentas.periodo);
  });

  /* Con un filtro puesto conviene una lista sola, ordenada por fecha. */
  if (buscando) {
    html += "<div class='grupo-titulo'>Resultados<span class='cuenta'>" + filtrados.length + "</span></div>";
    if (!filtrados.length) {
      html += "<div class='vacio'>Ninguna venta coincide. Probá con el número de pedido o parte del nombre.</div>";
    } else {
      filtrados.forEach(function (p) { html += tarjetaPedido(p, estado); });
    }
    return html;
  }

  /* Sin filtro, agrupado por estado. Las listas viejas se recortan. */
  const grupos = [
    { clave: "nuevo", titulo: "Nuevos", tope: 0 },
    { clave: "confirmado", titulo: "Confirmados", tope: 0 },
    { clave: "rechazado", titulo: "Rechazados", tope: TOPE_LISTA },
    { clave: "cancelado", titulo: "Cancelados", tope: TOPE_LISTA },
    { clave: "finalizado", titulo: "Finalizados", tope: TOPE_LISTA }
  ];

  grupos.forEach(function (g) {
    const lista = filtrados.filter(function (p) { return p.estado === g.clave; });
    html += "<div class='grupo-titulo'>" + g.titulo + "<span class='cuenta'>" + lista.length + "</span></div>";
    if (!lista.length) {
      html += "<div class='vacio'>Sin pedidos en este estado.</div>";
      return;
    }
    const visibles = g.tope ? lista.slice(0, g.tope) : lista;
    visibles.forEach(function (p) { html += tarjetaPedido(p, estado); });
    if (lista.length > visibles.length) {
      html += "<div class='vacio'>Se muestran " + visibles.length + " de " + lista.length +
        ". Usá el buscador de arriba para encontrar las anteriores.</div>";
    }
  });

  return html;
}

function opcion(valor, etiqueta, actual) {
  return "<option value='" + valor + "'" + (actual === valor ? " selected" : "") + ">" + esc(etiqueta) + "</option>";
}

function tarjetaPedido(p, estado) {
  let html = "<div class='tarjeta pedido e-" + p.estado + "'>";
  html += "<div class='pedido-cabecera'>" +
    "<div><div class='pedido-numero'>" + esc(p.numero) + (p.enPuerta ? " · en puerta" : "") + "</div>" +
    "<div class='pedido-meta'>" + fechaHora(p.creado) + "</div></div>" +
    "<div style='text-align:right'><span class='pill pill-" + p.estado + "'>" + p.estado.toUpperCase() + "</span>" +
    (p.cobrado ? " <span class='pill pill-confirmado'>COBRADO</span>" : "") + "</div></div>";

  const hist = historialDelCliente(estado, p);
  html += "<div class='dato'><strong>" + esc(p.cliente) + "</strong>" +
    (p.telefono ? " · " + esc(p.telefono) : "") +
    (hist.compras >= 2 ? " <span class='pill pill-info'>cliente habitual · " + hist.compras + " compras</span>" : "") +
    "</div>";
  html += "<ul class='pedido-items'>";
  p.items.forEach(function (it) {
    html += "<li>" + it.cantidad + " x " + esc(it.nombre) + " — " + pesos(it.precio * it.cantidad) + "</li>";
  });
  html += "</ul>";
  html += "<div class='dato'><strong>Total:</strong> " + pesos(p.total) +
    " · " + (p.pago === "efectivo" ? "Efectivo" : "Transferencia") +
    " · " + (p.tipoEntrega === "delivery" ? "Delivery" : "Retiro en puerta") + "</div>";
  html += "<div class='dato'><strong>Entrega:</strong> " + fechaLarga(p.fechaEntrega) +
    ", " + HORARIO_DESDE + " a " + HORARIO_HASTA + "</div>";
  if (p.tipoEntrega === "delivery") {
    html += "<div class='dato'><strong>Dirección:</strong> " + esc(p.direccion || "-") + "</div>";
    html += "<div class='dato'><strong>Referencia:</strong> " + esc(p.referencia || "-") + "</div>";
    if (p.zona) html += "<div class='dato'><strong>Zona:</strong> " + esc(p.zona) + "</div>";
    if (p.gps) {
      html += "<div class='dato'><a target='_blank' rel='noopener' href='" + esc(enlaceMapa(p.gps)) +
        "'>Ver ubicación en Google Maps</a></div>";
    }
  }
  if (p.observaciones) html += "<div class='dato'><strong>Observaciones:</strong> " + esc(p.observaciones) + "</div>";

  /* Acción principal siempre a la vista; el resto se pliega para no saturar el celular. */
  let principal = "";
  let secundarias = "";

  if (p.estado === "nuevo") {
    principal += btn("confirmar-venta", p.id, "Confirmar venta", "btn-principal");
    secundarias += btn("editar-pedido", p.id, "Editar pedido", "btn-suave");
    secundarias += btn("rechazar-pedido", p.id, "Rechazar", "btn-suave");
  }
  /* Los retiros no pasan por Envíos, así que se cierran desde acá. */
  if (p.estado === "confirmado" && p.tipoEntrega === "retiro") {
    if (!p.cobrado) principal += btn("retirado-cobrado", p.id, "Retirado y cobrado", "btn-principal");
    principal += btn("retirado", p.id, "Marcar retirado", "btn-principal");
  }
  if (p.estado === "confirmado" || p.estado === "finalizado") {
    if (!p.cobrado) principal += btn("cobrar", p.id, "Marcar como cobrado", "btn-principal");
    secundarias += btn("cancelar-venta", p.id, "Cancelar venta", "btn-suave");
  }
  if (p.estado !== "rechazado" && p.estado !== "cancelado") {
    secundarias += btn("imprimir", p.id, "Imprimir comanda", "btn-suave");
    secundarias += btn("cambiar-fecha", p.id, "Cambiar fecha", "btn-suave");
  }
  if (p.telefono) {
    secundarias += "<a class='btn btn-suave btn-chico' target='_blank' rel='noopener' href='" +
      esc(enlaceWhatsapp(p.telefono, "Hola " + p.cliente + ", te escribimos por tu pedido " + p.numero + ".")) +
      "'>WhatsApp</a>";
  }

  html += "<div class='acciones'>" + principal + "</div>";
  if (secundarias) {
    html += "<details class='mas-opciones'><summary>Más opciones</summary>" +
      "<div class='acciones'>" + secundarias + "</div></details>";
  }
  html += "</div>";
  return html;
}

function btn(accion, id, texto, clase) {
  return "<button class='btn btn-chico " + (clase || "btn-suave") + "' data-accion='" + accion +
    "' data-id='" + id + "'>" + esc(texto) + "</button>";
}

/* ---------- Venta en puerta ---------- */

let ventaPuerta = { items: {}, pago: "efectivo", cliente: "" };

function abrirVentaEnPuerta() {
  ventaPuerta = { items: {}, pago: "efectivo", cliente: "" };
  abrirModal({
    titulo: "Venta en puerta",
    cuerpo: cuerpoVentaPuerta(storageService.leer()),
    textoAceptar: "Confirmar y cobrar",
    clase: "btn-principal",
    onAceptar: confirmarVentaEnPuerta
  });
}

function cuerpoVentaPuerta(estado) {
  let html = "<div id='vp-cuerpo'>";
  html += "<div class='campo'><label for='vp-cliente'>Cliente (opcional)</label>" +
    "<input id='vp-cliente' data-vp='cliente' value='" + esc(ventaPuerta.cliente) + "' placeholder='Consumidor final'></div>";
  estado.productos.forEach(function (p) {
    const c = ventaPuerta.items["p:" + p.id] || 0;
    html += "<div class='producto'><div class='producto-datos'>" +
      "<div class='producto-nombre'>" + esc(p.nombre) + "</div>" +
      "<div class='producto-detalle'>" + pesos(p.precio) + " · stock " + p.stock + "</div></div>" +
      contadorVP("p", p.id, c, p.stock <= 0) + "</div>";
  });
  estado.combos.forEach(function (c) {
    const cant = ventaPuerta.items["c:" + c.id] || 0;
    const disp = disponibilidadCombo(c, estado);
    html += "<div class='producto'><div class='producto-datos'>" +
      "<div class='producto-nombre'>" + esc(c.nombre) + "</div>" +
      "<div class='producto-detalle'>" + pesos(c.precio) + " · se pueden armar " + disp + "</div></div>" +
      contadorVP("c", c.id, cant, disp <= 0) + "</div>";
  });
  html += "<div class='campo' style='margin-top:10px'><label>Forma de pago</label><div class='opciones'>" +
    "<label><input type='radio' name='vp-pago' data-vp='pago' value='efectivo'" +
    (ventaPuerta.pago === "efectivo" ? " checked" : "") + "> Efectivo</label>" +
    "<label><input type='radio' name='vp-pago' data-vp='pago' value='transferencia'" +
    (ventaPuerta.pago === "transferencia" ? " checked" : "") + "> Transferencia</label>" +
    "</div></div>";
  html += "<div class='total'><span>Total</span><span>" + pesos(totalVentaPuerta(estado)) + "</span></div>";
  html += "</div>";
  return html;
}

function contadorVP(tipo, id, cantidad, agotado) {
  return "<div class='contador'>" +
    "<button data-accion='vp-menos' data-tipo='" + tipo + "' data-id='" + id + "'" +
    (cantidad <= 0 ? " disabled" : "") + ">−</button>" +
    "<span class='cant'>" + cantidad + "</span>" +
    "<button data-accion='vp-mas' data-tipo='" + tipo + "' data-id='" + id + "'" +
    (agotado ? " disabled" : "") + ">+</button></div>";
}

function itemsVentaPuerta(estado) {
  const items = [];
  Object.keys(ventaPuerta.items).forEach(function (clave) {
    const cant = ventaPuerta.items[clave];
    if (cant <= 0) return;
    const partes = clave.split(":");
    const tipo = partes[0] === "p" ? "producto" : "combo";
    const origen = tipo === "producto"
      ? producto(estado, partes[1])
      : estado.combos.find(function (c) { return c.id === partes[1]; });
    if (origen) items.push({ tipo: tipo, id: partes[1], nombre: origen.nombre, precio: origen.precio, cantidad: cant });
  });
  return items;
}

function totalVentaPuerta(estado) {
  return itemsVentaPuerta(estado).reduce(function (s, it) { return s + it.precio * it.cantidad; }, 0);
}

function refrescarVentaPuerta() {
  const cuerpo = document.getElementById("modal-cuerpo");
  if (cuerpo) cuerpo.innerHTML = cuerpoVentaPuerta(storageService.leer());
}

function confirmarVentaEnPuerta() {
  const estado = storageService.leer();
  const items = itemsVentaPuerta(estado);
  if (!items.length) { mostrarAviso("Elegí al menos un producto.", "error"); return false; }
  const faltan = faltantesDeStock(items, estado);
  if (faltan.length) {
    mostrarAviso("Falta stock — " + faltan.map(function (f) { return f.nombre; }).join(", "), "error");
    return false;
  }
  const total = items.reduce(function (s, it) { return s + it.precio * it.cantidad; }, 0);
  const pedido = crearPedido({
    cliente: ventaPuerta.cliente.trim() || "Consumidor final",
    telefono: "",
    items: items,
    total: total,
    tipoEntrega: "retiro",       // nunca pasa por Envíos
    pago: ventaPuerta.pago,
    fechaEntrega: hoyYmd(),
    enPuerta: true
  });
  confirmarVenta(pedido.id);   // descuenta stock una sola vez
  marcarCobrado(pedido.id);    // entra a caja una sola vez
  marcarRetirado(pedido.id);   // se cierra en el acto: el cliente ya se llevó todo
  imprimirComanda(pedido.id);
  return true;
}

/* ---------- Pedido manual (tomado por WhatsApp o Instagram) ---------- */

let pedidoManual = {
  items: {}, cliente: "", telefono: "", tipoEntrega: "delivery", pago: "efectivo",
  direccion: "", referencia: "", zona: "", ubicacion: "", observaciones: ""
};

function abrirPedidoManual() {
  pedidoManual = {
    items: {}, cliente: "", telefono: "", tipoEntrega: "delivery", pago: "efectivo",
    direccion: "", referencia: "", zona: "", ubicacion: "", observaciones: ""
  };
  abrirModal({
    titulo: "Pedido por WhatsApp / Instagram",
    cuerpo: cuerpoPedidoManual(storageService.leer()),
    textoAceptar: "Cargar pedido",
    clase: "btn-principal",
    onAceptar: confirmarPedidoManual
  });
}

function campoTextoPM(campo, etiqueta, placeholder, tipo) {
  return "<div class='campo'><label for='pm-" + campo + "'>" + esc(etiqueta) + "</label>" +
    "<input id='pm-" + campo + "' type='" + (tipo || "text") + "' data-pm='" + campo +
    "' value='" + esc(pedidoManual[campo]) + "' placeholder='" + esc(placeholder || "") + "'></div>";
}

function radioPM(grupo, campo, valor, etiqueta) {
  return "<label><input type='radio' name='pm-" + grupo + "' data-pm='" + campo +
    "' value='" + valor + "'" + (pedidoManual[campo] === valor ? " checked" : "") + "> " + esc(etiqueta) + "</label>";
}

function cuerpoPedidoManual(estado) {
  let html = "<p class='ayuda'>Cargá acá un pedido que te llegó por chat, tal como te lo escribió el cliente.</p>";
  html += campoTextoPM("cliente", "Nombre del cliente", "Nombre y apellido");
  html += campoTextoPM("telefono", "Teléfono", "Ej. 3624720516", "tel");

  html += "<div id='pm-cuerpo'>";
  estado.productos.forEach(function (p) {
    const cant = pedidoManual.items["p:" + p.id] || 0;
    html += "<div class='producto'><div class='producto-datos'>" +
      "<div class='producto-nombre'>" + esc(p.nombre) + "</div>" +
      "<div class='producto-detalle'>" + pesos(p.precio) + " · stock " + p.stock + "</div></div>" +
      contadorPM("p", p.id, cant, p.stock <= 0) + "</div>";
  });
  estado.combos.forEach(function (c) {
    const cant = pedidoManual.items["c:" + c.id] || 0;
    const disp = disponibilidadCombo(c, estado);
    html += "<div class='producto'><div class='producto-datos'>" +
      "<div class='producto-nombre'>" + esc(c.nombre) + "</div>" +
      "<div class='producto-detalle'>" + pesos(c.precio) + " · se pueden armar " + disp + "</div></div>" +
      contadorPM("c", c.id, cant, disp <= 0) + "</div>";
  });

  html += "<div class='campo'><label>Tipo de pedido</label><div class='opciones'>" +
    radioPM("tipo", "tipoEntrega", "delivery", "Delivery") +
    radioPM("tipo", "tipoEntrega", "retiro", "Retiro en puerta") +
    "</div></div>";
  html += "<div class='campo'><label>Forma de pago</label><div class='opciones'>" +
    radioPM("pago", "pago", "efectivo", "Efectivo") +
    radioPM("pago", "pago", "transferencia", "Transferencia") +
    "</div></div>";

  if (pedidoManual.tipoEntrega === "delivery") {
    html += "<hr class='sep'>" +
      campoTextoPM("direccion", "Dirección (opcional)", "Calle y número, si tiene") +
      campoTextoPM("referencia", "Referencia", "Color de casa, esquina, negocio cercano");
    html += "<div class='campo'><label for='pm-zona'>Zona</label><select id='pm-zona' data-pm='zona'>" +
      "<option value=''" + (pedidoManual.zona ? "" : " selected") + ">Elegí la zona</option>";
    ZONAS.forEach(function (z) {
      html += "<option value='" + esc(z) + "'" + (pedidoManual.zona === z ? " selected" : "") + ">" + esc(z) + "</option>";
    });
    html += "</select></div>";
    html += "<div class='campo'><label for='pm-ubicacion'>Ubicación que compartió por chat</label>" +
      "<input id='pm-ubicacion' data-pm='ubicacion' value='" + esc(pedidoManual.ubicacion) +
      "' placeholder='Pegá el link de Google Maps o las coordenadas'></div>" +
      "<p class='ayuda'>Útil en zonas sin nombres de calle: pegá el link que manda WhatsApp cuando el cliente comparte su ubicación.</p>";
  }

  html += campoTextoPM("observaciones", "Observaciones", "Horario preferido, aclaraciones...");

  const items = itemsPedidoManual(estado);
  const total = items.reduce(function (s, it) { return s + it.precio * it.cantidad; }, 0);
  html += "<div class='total'><span>Total</span><span>" + pesos(total) + "</span></div>";
  html += "</div>";
  return html;
}

function contadorPM(tipo, id, cantidad, agotado) {
  return "<div class='contador'>" +
    "<button data-accion='pm-menos' data-tipo='" + tipo + "' data-id='" + id + "'" +
    (cantidad <= 0 ? " disabled" : "") + ">−</button>" +
    "<span class='cant'>" + cantidad + "</span>" +
    "<button data-accion='pm-mas' data-tipo='" + tipo + "' data-id='" + id + "'" +
    (agotado ? " disabled" : "") + ">+</button></div>";
}

function itemsPedidoManual(estado) {
  const items = [];
  Object.keys(pedidoManual.items).forEach(function (clave) {
    const cant = pedidoManual.items[clave];
    if (cant <= 0) return;
    const partes = clave.split(":");
    const tipo = partes[0] === "p" ? "producto" : "combo";
    const origen = tipo === "producto"
      ? producto(estado, partes[1])
      : estado.combos.find(function (c) { return c.id === partes[1]; });
    if (origen) items.push({ tipo: tipo, id: partes[1], nombre: origen.nombre, precio: origen.precio, cantidad: cant });
  });
  return items;
}

function refrescarPedidoManual() {
  const cuerpo = document.getElementById("modal-cuerpo");
  if (!cuerpo) return;
  const focoId = document.activeElement ? document.activeElement.id : null;
  cuerpo.innerHTML = cuerpoPedidoManual(storageService.leer());
  if (focoId) {
    const nodo = document.getElementById(focoId);
    if (nodo) nodo.focus();
  }
}

/* Reconoce "-27.451,-58.986", un link con "?q=lat,lng" o "@lat,lng,zoom". */
function parseGpsTexto(texto) {
  if (!texto) return null;
  const m = texto.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat: lat, lng: lng };
}

function confirmarPedidoManual() {
  const estado = storageService.leer();
  const items = itemsPedidoManual(estado);
  if (!items.length) { mostrarAviso("Elegí al menos un producto.", "error"); return false; }
  if (!pedidoManual.cliente.trim()) { mostrarAviso("Escribí el nombre del cliente.", "error"); return false; }
  const faltan = faltantesDeStock(items, estado);
  if (faltan.length) {
    mostrarAviso("Falta stock — " + faltan.map(function (f) { return f.nombre; }).join(", "), "error");
    return false;
  }
  const gps = pedidoManual.tipoEntrega === "delivery" ? parseGpsTexto(pedidoManual.ubicacion) : null;
  if (pedidoManual.tipoEntrega === "delivery") {
    const tieneDireccion = pedidoManual.direccion.trim().length >= 5 && pedidoManual.referencia.trim().length >= 3;
    if (!gps && !tieneDireccion) {
      mostrarAviso("Para delivery cargá la dirección con referencia, o pegá la ubicación que mandó el cliente.", "error");
      return false;
    }
  }
  const total = items.reduce(function (s, it) { return s + it.precio * it.cantidad; }, 0);
  const pedido = crearPedido({
    cliente: pedidoManual.cliente.trim(),
    telefono: pedidoManual.telefono.trim(),
    items: items,
    total: total,
    tipoEntrega: pedidoManual.tipoEntrega,
    pago: pedidoManual.pago,
    observaciones: pedidoManual.observaciones.trim(),
    direccion: pedidoManual.tipoEntrega === "delivery" ? pedidoManual.direccion.trim() : "",
    referencia: pedidoManual.tipoEntrega === "delivery" ? pedidoManual.referencia.trim() : "",
    zona: pedidoManual.tipoEntrega === "delivery" ? pedidoManual.zona : "",
    gps: gps,
    fechaEntrega: calcularFechaEntrega(new Date())
  });
  mostrarAviso("Pedido " + pedido.numero + " cargado en Nuevos.", "ok");
  return true;
}

/* ---------------------------------------------------------
   ENVÍOS
   --------------------------------------------------------- */

let seleccionEnvios = [];
let filtroZona = "todas";

function vistaEnvios(estado) {
  const hoy = hoyYmd();
  const delivery = estado.pedidos.filter(function (p) {
    return p.tipoEntrega === "delivery" && (p.estado === "confirmado" || p.estado === "finalizado");
  });

  const sinSalidaHoy = delivery.filter(function (p) {
    return !p.salidaId && p.estadoEnvio !== "entregado" && p.fechaEntrega <= hoy;
  });
  const proximas = delivery.filter(function (p) {
    return !p.salidaId && p.estadoEnvio !== "entregado" && p.fechaEntrega > hoy;
  });
  const abiertas = estado.salidas.filter(function (s) { return s.estado !== "finalizada"; });
  const salidasActivas = abiertas.filter(function (s) { return s.fecha === hoy; });
  const salidasViejas = abiertas.filter(function (s) { return s.fecha !== hoy; });
  const salidasCerradas = estado.salidas.filter(function (s) { return s.estado === "finalizada"; });

  let html = "<div class='encabezado-vista'><h1>Envíos</h1>" +
    "<p>Solo ventas confirmadas con delivery. Los retiros en puerta no aparecen acá.</p></div>";

  const zonasPresentes = [];
  sinSalidaHoy.forEach(function (p) {
    const z = p.zona || "Sin zona";
    if (zonasPresentes.indexOf(z) < 0) zonasPresentes.push(z);
  });
  const visiblesEnvios = filtroZona === "todas"
    ? sinSalidaHoy
    : sinSalidaHoy.filter(function (p) { return (p.zona || "Sin zona") === filtroZona; });

  html += "<div class='grupo-titulo'>Pedidos de hoy sin salida<span class='cuenta'>" + sinSalidaHoy.length + "</span></div>";
  if (!sinSalidaHoy.length) {
    html += "<div class='vacio'>No hay pedidos esperando salida.</div>";
  } else {
    html += "<div class='tarjeta'>";
    if (zonasPresentes.length > 1) {
      html += "<div class='campo'><label for='filtro-zona'>Ver zona</label>" +
        "<select id='filtro-zona' data-filtro-zona='1'>" + opcion("todas", "Todas las zonas", filtroZona);
      zonasPresentes.forEach(function (z) { html += opcion(z, z, filtroZona); });
      html += "</select></div>";
    }
    visiblesEnvios.forEach(function (p) {
      const marcado = seleccionEnvios.indexOf(p.id) >= 0;
      html += "<div class='producto'><div class='producto-datos'>" +
        "<div class='producto-nombre'>" + esc(p.numero) + " · " + esc(p.cliente) + "</div>" +
        "<div class='producto-detalle'>" + esc(p.direccion || "sin dirección") + " — " + esc(p.referencia || "sin referencia") + "</div>" +
        "<div class='producto-detalle'>" + (p.zona ? "<strong>" + esc(p.zona) + "</strong> · " : "") +
        pesos(p.total) + " · " + (p.pago === "efectivo" ? "Efectivo" : "Transferencia") +
        (p.estadoEnvio === "no_entregado" ? " · <span class='bajo'>no entregado antes</span>" : "") + "</div>" +
        "</div>" +
        "<button class='btn btn-chico " + (marcado ? "btn-principal" : "btn-suave") +
        "' data-accion='sel-envio' data-id='" + p.id + "'>" + (marcado ? "Elegido" : "Elegir") + "</button></div>";
    });
    html += "<div class='fila-entre' style='margin-top:12px'>" +
      "<span class='ayuda'>Elegidos: " + seleccionEnvios.length + " de " + MAX_PEDIDOS_SALIDA + "</span>" +
      "<button class='btn btn-principal' data-accion='crear-salida'" +
      (seleccionEnvios.length ? "" : " disabled") + ">Crear salida</button></div>";
    html += "</div>";
  }

  html += "<div class='grupo-titulo'>Salidas del día<span class='cuenta'>" + salidasActivas.length + "</span></div>";
  if (!salidasActivas.length) {
    html += "<div class='vacio'>Todavía no armaste ninguna salida.</div>";
  } else {
    salidasActivas.forEach(function (s) { html += tarjetaSalida(s, estado, false); });
  }

  if (salidasViejas.length) {
    html += "<div class='grupo-titulo'>Sin cerrar de días anteriores<span class='cuenta'>" + salidasViejas.length + "</span></div>";
    html += "<div class='aviso-suave'>Estas salidas quedaron abiertas. Cerralas para que no se mezclen con las de hoy.</div>";
    salidasViejas.forEach(function (s) { html += tarjetaSalida(s, estado, false); });
  }

  html += "<div class='grupo-titulo'>Próximo reparto<span class='cuenta'>" + proximas.length + "</span></div>";
  if (!proximas.length) {
    html += "<div class='vacio'>Sin pedidos para días siguientes.</div>";
  } else {
    html += "<div class='tarjeta'>";
    proximas.forEach(function (p) {
      html += "<div class='producto'><div class='producto-datos'>" +
        "<div class='producto-nombre'>" + esc(p.numero) + " · " + esc(p.cliente) + "</div>" +
        "<div class='producto-detalle'>" + fechaLarga(p.fechaEntrega) + " — " + esc(p.direccion || "sin dirección") + "</div>" +
        "</div></div>";
    });
    html += "</div>";
  }

  html += "<div class='grupo-titulo'>Entregas finalizadas<span class='cuenta'>" + salidasCerradas.length + "</span></div>";
  if (!salidasCerradas.length) {
    html += "<div class='vacio'>Sin salidas finalizadas.</div>";
  } else {
    salidasCerradas.forEach(function (s) { html += tarjetaSalida(s, estado, true); });
  }

  return html;
}

function tarjetaSalida(s, estado, cerrada) {
  const pedidos = s.pedidos.map(function (id) {
    return estado.pedidos.find(function (p) { return p.id === id; });
  }).filter(Boolean);

  let html = "<div class='tarjeta pedido e-" + (cerrada ? "finalizado" : "confirmado") + "'>";
  html += "<div class='fila-entre'><div class='pedido-numero'>Salida " + s.numero + "</div>" +
    "<span class='pill pill-info'>" + s.estado.replace("_", " ").toUpperCase() + "</span></div>";
  html += "<div class='pedido-meta'>" + fechaLarga(s.fecha) + " · creada " + soloHora(s.creado) + "</div>";

  if (!pedidos.length) html += "<p class='ayuda'>Sin pedidos.</p>";

  pedidos.forEach(function (p, i) {
    html += "<div class='parada'>";
    html += "<div class='fila-entre'><strong>" + (i + 1) + ". " + esc(p.numero) + " · " + esc(p.cliente) + "</strong>" +
      "<span class='pill pill-info'>" + p.estadoEnvio.replace("_", " ") + "</span></div>";
    html += "<div class='dato'>" + (p.zona ? "<strong>" + esc(p.zona) + "</strong> · " : "") +
      esc(p.direccion || "sin dirección") + " — " + esc(p.referencia || "sin referencia") + "</div>";
    html += "<div class='dato'>" + pesos(p.total) + " · " + (p.pago === "efectivo" ? "Efectivo" : "Transferencia") +
      (p.cobrado ? " · <strong>cobrado</strong>" : "") + "</div>";
    html += "<div class='acciones'>";
    if (p.gps) {
      html += "<a class='btn btn-chico btn-suave' target='_blank' rel='noopener' href='" +
        esc(enlaceMapa(p.gps)) + "'>Ver en el mapa</a>";
    }
    if (s.estado === "preparacion") {
      html += "<button class='btn btn-chico btn-suave' data-accion='subir' data-salida='" + s.id + "' data-id='" + p.id + "'>Subir</button>";
      html += "<button class='btn btn-chico btn-suave' data-accion='bajar' data-salida='" + s.id + "' data-id='" + p.id + "'>Bajar</button>";
      html += "<button class='btn btn-chico btn-suave' data-accion='quitar-salida' data-salida='" + s.id + "' data-id='" + p.id + "'>Quitar</button>";
    }
    if (s.estado === "en_reparto" && p.estadoEnvio !== "entregado") {
      if (p.pago === "efectivo" && !p.cobrado) {
        html += "<button class='btn btn-chico btn-principal' data-accion='entregado-cobrado' data-id='" + p.id + "'>Entregado y cobrado</button>";
      }
      html += "<button class='btn btn-chico btn-principal' data-accion='entregado' data-id='" + p.id + "'>Entregado</button>";
      html += "<button class='btn btn-chico btn-suave' data-accion='no-entregado' data-id='" + p.id + "'>No entregado</button>";
    }
    html += "</div></div>";
  });

  const aCobrar = pedidos.reduce(function (suma, p) {
    return suma + (p.pago === "efectivo" && !p.cobrado ? p.total : 0);
  }, 0);
  if (aCobrar > 0) {
    html += "<div class='dato pie-salida'><strong>A cobrar en efectivo: " + pesos(aCobrar) + "</strong></div>";
  }

  html += "<div class='acciones pie-salida'>";
  if (pedidos.length) {
    html += "<button class='btn btn-chico btn-suave' data-accion='hoja-ruta' data-salida='" + s.id + "'>Imprimir hoja de ruta</button>";
  }
  if (s.estado === "preparacion") {
    html += "<button class='btn btn-chico btn-principal' data-accion='iniciar-salida' data-salida='" + s.id + "'>Marcar en reparto</button>";
  }
  if (s.estado !== "finalizada") {
    html += "<button class='btn btn-chico btn-suave' data-accion='finalizar-salida' data-salida='" + s.id + "'>Finalizar salida</button>";
  }
  const conGps = pedidos.filter(function (p) { return p.gps; });
  if (conGps.length) {
    html += "<a class='btn btn-chico btn-suave' target='_blank' rel='noopener' href='" +
      esc(enlaceRecorrido(conGps)) + "'>Abrir recorrido en Google Maps</a>";
  }
  html += "</div></div>";
  return html;
}

/* Recorrido en el orden manual, sin optimizar y sin API. */
function enlaceRecorrido(pedidos) {
  const puntos = pedidos.map(function (p) { return p.gps.lat + "," + p.gps.lng; });
  const destino = puntos[puntos.length - 1];
  const medio = puntos.slice(0, -1);
  let url = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(destino);
  if (medio.length) url += "&waypoints=" + encodeURIComponent(medio.join("|"));
  return url + "&travelmode=driving";
}

/* ---------------------------------------------------------
   STOCK
   --------------------------------------------------------- */

function vistaStock(estado) {
  let html = "<div class='encabezado-vista'><h1>Stock</h1>" +
    "<p>Los precios son de demostración y podés cambiarlos acá.</p></div>";

  html += "<div class='tarjeta'><h2>Productos</h2>";
  estado.productos.forEach(function (p) {
    const bajo = p.stock < AVISO_STOCK_BAJO;
    html += "<div class='stock-fila'>" +
      "<div><div class='producto-nombre'>" + esc(p.nombre) + "</div>" +
      "<div class='producto-detalle" + (bajo ? " bajo" : "") + "'>" + p.stock + " paquete(s)" +
      (bajo ? " · quedan pocos" : "") + "</div>" +
      "<div class='stock-precio'><label for='precio-" + p.id + "' class='ayuda'>Precio</label>" +
      "<input id='precio-" + p.id + "' type='number' min='0' step='100' value='" + p.precio +
      "' data-precio='producto' data-id='" + p.id + "'></div>" +
      "<button class='btn btn-chico btn-suave' data-accion='movimiento' data-id='" + p.id +
      "' style='margin-top:6px'>Registrar movimiento</button></div>" +
      contadorStock(p.id, p.stock) +
      "</div>";
  });
  html += "</div>";

  html += "<div class='tarjeta'><h2>Combos</h2>" +
    "<p class='ayuda'>Los combos no tienen stock propio: se calcula con sus componentes.</p>";
  estado.combos.forEach(function (c) {
    html += "<div class='stock-fila'>" +
      "<div><div class='producto-nombre'>" + esc(c.nombre) + "</div>" +
      "<div class='producto-detalle'>" + esc(c.contenido) + "</div>" +
      "<div class='producto-detalle'>Se pueden armar: <strong>" + disponibilidadCombo(c, estado) + "</strong></div>" +
      "<div class='stock-precio'><label for='precio-" + c.id + "' class='ayuda'>Precio</label>" +
      "<input id='precio-" + c.id + "' type='number' min='0' step='100' value='" + c.precio +
      "' data-precio='combo' data-id='" + c.id + "'></div></div><div></div></div>";
  });
  html += "</div>";

  html += seccionMovimientos(estado);

  html += "<div class='tarjeta'><h2>Datos de prueba</h2>" +
    "<p class='ayuda'>Esta demo guarda todo en el navegador (localStorage). No sirve para la versión final ni para datos reales.</p>" +
    "<div class='acciones'>" +
    "<button class='btn btn-suave' data-accion='pedidos-ejemplo'>Cargar pedidos de ejemplo</button>" +
    "<button class='btn btn-peligro' data-accion='restablecer'>Restablecer demo</button>" +
    "</div></div>";

  html += "<div class='tarjeta'><h2>Copia de seguridad</h2>" +
    "<p class='ayuda'>Los datos viven en este navegador. Si se limpia el historial, se pierden. " +
    "Bajá una copia de vez en cuando.</p>" +
    "<div class='acciones'>" +
    "<button class='btn btn-suave' data-accion='exportar'>Descargar copia</button>" +
    "<button class='btn btn-suave' data-accion='importar'>Restaurar desde archivo</button>" +
    "</div>" +
    "<input type='file' id='archivo-import' accept='application/json,.json' style='display:none'>" +
    "</div>";

  return html;
}

/* ---------- Editar un pedido todavía no confirmado ---------- */

let edicion = { pedidoId: null, items: {} };

function abrirEdicionPedido(pedidoId) {
  const estado = storageService.leer();
  const p = estado.pedidos.find(function (x) { return x.id === pedidoId; });
  if (!p || p.estado !== "nuevo") { mostrarAviso("Solo se puede editar un pedido nuevo.", "error"); return; }
  edicion = { pedidoId: pedidoId, items: {} };
  p.items.forEach(function (it) {
    edicion.items[(it.tipo === "producto" ? "p:" : "c:") + it.id] = it.cantidad;
  });
  abrirModal({
    titulo: "Editar " + p.numero,
    cuerpo: cuerpoEdicion(estado),
    textoAceptar: "Guardar cambios",
    clase: "btn-principal",
    onAceptar: function () {
      return actualizarItemsPedido(edicion.pedidoId, itemsDeEdicion(storageService.leer()));
    }
  });
}

function cuerpoEdicion(estado) {
  let html = "<div id='ed-cuerpo'><p class='ayuda'>Un pedido nuevo todavía no descontó stock, " +
    "así que cambiar cantidades acá no descuadra nada.</p>";
  estado.productos.forEach(function (p) {
    const c = edicion.items["p:" + p.id] || 0;
    html += "<div class='producto'><div class='producto-datos'>" +
      "<div class='producto-nombre'>" + esc(p.nombre) + "</div>" +
      "<div class='producto-detalle'>" + pesos(p.precio) + " · stock " + p.stock + "</div></div>" +
      contadorEd("p", p.id, c) + "</div>";
  });
  estado.combos.forEach(function (c) {
    const cant = edicion.items["c:" + c.id] || 0;
    html += "<div class='producto'><div class='producto-datos'>" +
      "<div class='producto-nombre'>" + esc(c.nombre) + "</div>" +
      "<div class='producto-detalle'>" + pesos(c.precio) + " · se pueden armar " +
      disponibilidadCombo(c, estado) + "</div></div>" +
      contadorEd("c", c.id, cant) + "</div>";
  });
  const items = itemsDeEdicion(estado);
  const total = items.reduce(function (s, it) { return s + it.precio * it.cantidad; }, 0);
  html += "<div class='total'><span>Nuevo total</span><span>" + pesos(total) + "</span></div></div>";
  return html;
}

function contadorEd(tipo, id, cantidad) {
  return "<div class='contador'>" +
    "<button data-accion='ed-menos' data-tipo='" + tipo + "' data-id='" + id + "'" +
    (cantidad <= 0 ? " disabled" : "") + ">−</button>" +
    "<span class='cant'>" + cantidad + "</span>" +
    "<button data-accion='ed-mas' data-tipo='" + tipo + "' data-id='" + id + "'>+</button></div>";
}

function itemsDeEdicion(estado) {
  const items = [];
  Object.keys(edicion.items).forEach(function (clave) {
    const cant = edicion.items[clave];
    if (cant <= 0) return;
    const partes = clave.split(":");
    const tipo = partes[0] === "p" ? "producto" : "combo";
    const origen = tipo === "producto"
      ? producto(estado, partes[1])
      : estado.combos.find(function (c) { return c.id === partes[1]; });
    if (origen) items.push({ tipo: tipo, id: partes[1], nombre: origen.nombre, precio: origen.precio, cantidad: cant });
  });
  return items;
}

function refrescarEdicion() {
  const cuerpo = document.getElementById("modal-cuerpo");
  if (cuerpo) cuerpo.innerHTML = cuerpoEdicion(storageService.leer());
}

/* ---------- Historial de movimientos de stock ---------- */

let filtroMovimientos = "todos";
const TOPE_MOVIMIENTOS = 40;

function seccionMovimientos(estado) {
  const todos = estado.movimientosStock || [];
  const lista = filtroMovimientos === "todos"
    ? todos
    : todos.filter(function (m) { return m.productoId === filtroMovimientos; });

  let html = "<div class='tarjeta'><h2>Historial de movimientos</h2>" +
    "<p class='ayuda'>Queda registrado cada cambio de stock y por qué se hizo.</p>";

  html += "<div class='campo'><label for='filtro-mov'>Producto</label>" +
    "<select id='filtro-mov' data-filtro-mov='1'>" + opcion("todos", "Todos los productos", filtroMovimientos);
  estado.productos.forEach(function (p) {
    html += opcion(p.id, p.nombre, filtroMovimientos);
  });
  html += "</select></div>";

  if (!lista.length) {
    html += "<div class='vacio'>Todavía no hay movimientos registrados.</div></div>";
    return html;
  }

  lista.slice(0, TOPE_MOVIMIENTOS).forEach(function (m) {
    const entra = m.delta > 0;
    html += "<div class='mov-stock'>" +
      "<span class='mov-delta " + (entra ? "entra" : "sale") + "'>" +
      (entra ? "+" : "") + m.delta + "</span>" +
      "<span class='mov-datos'><strong>" + esc(m.nombre) + "</strong>" +
      "<br><span class='ayuda'>" + esc(m.motivo) +
      (m.numero ? " · " + esc(m.numero) + (m.cliente ? " · " + esc(m.cliente) : "") : "") +
      " · " + fechaHora(m.fecha) + "</span></span>" +
      "<span class='mov-queda'>queda " + m.resultante + "</span>" +
      "</div>";
  });

  if (lista.length > TOPE_MOVIMIENTOS) {
    html += "<div class='vacio'>Se muestran los últimos " + TOPE_MOVIMIENTOS + " de " + lista.length +
      ". Filtrá por producto para ver los demás.</div>";
  }
  html += "</div>";
  return html;
}

function abrirMovimiento(productoId) {
  const estado = storageService.leer();
  const p = producto(estado, productoId);
  if (!p) return;
  abrirModal({
    titulo: "Movimiento de " + p.nombre,
    cuerpo:
      "<p class='ayuda'>Ahora hay " + p.stock + " paquete(s).</p>" +
      "<div class='campo'><label for='mov-cantidad'>Cantidad de paquetes</label>" +
      "<input id='mov-cantidad' type='number' min='1' step='1' value='1'></div>" +
      "<div class='campo'><label for='mov-motivo'>Motivo</label><select id='mov-motivo'>" +
      "<option value='compra'>Compra / reposición (entra)</option>" +
      "<option value='ajuste suma'>Ajuste a favor (entra)</option>" +
      "<option value='rotura'>Rotura o pérdida (sale)</option>" +
      "<option value='consumo interno'>Consumo interno (sale)</option>" +
      "<option value='ajuste resta'>Ajuste en contra (sale)</option>" +
      "</select></div>",
    textoAceptar: "Registrar",
    clase: "btn-principal",
    onAceptar: function () {
      const cantidad = document.getElementById("mov-cantidad").value;
      const motivo = document.getElementById("mov-motivo").value;
      return registrarMovimientoManual(productoId, cantidad, motivo);
    }
  });
}

function contadorStock(id, stock) {
  return "<div class='contador'>" +
    "<button data-accion='stock-menos' data-id='" + id + "'" + (stock <= 0 ? " disabled" : "") + ">−</button>" +
    "<span class='cant'>" + stock + "</span>" +
    "<button data-accion='stock-mas' data-id='" + id + "'>+</button></div>";
}

function cargarPedidosEjemplo() {
  const estado = storageService.leer();
  const fecha = calcularFechaEntrega();
  const p1 = estado.productos[0], p2 = estado.productos[3], combo = estado.combos[0];
  crearPedido({
    cliente: "Marta Gómez", telefono: "3624111222",
    items: [{ tipo: "producto", id: p1.id, nombre: p1.nombre, precio: p1.precio, cantidad: 2 }],
    total: p1.precio * 2, tipoEntrega: "delivery", pago: "efectivo",
    direccion: "Av. Alberdi 1200", referencia: "Casa celeste, frente a la plaza",
    gps: { lat: -27.4512, lng: -58.9866 }, fechaEntrega: fecha, observaciones: "Tocar timbre dos veces"
  });
  crearPedido({
    cliente: "Kiosco El Sol", telefono: "3624333444",
    items: [{ tipo: "combo", id: combo.id, nombre: combo.nombre, precio: combo.precio, cantidad: 1 }],
    total: combo.precio, tipoEntrega: "delivery", pago: "transferencia",
    direccion: "Santa María de Oro 450", referencia: "Kiosco esquina",
    gps: { lat: -27.4402, lng: -58.9750 }, fechaEntrega: fecha
  });
  crearPedido({
    cliente: "Julián Ríos", telefono: "3624555666",
    items: [{ tipo: "producto", id: p2.id, nombre: p2.nombre, precio: p2.precio, cantidad: 1 }],
    total: p2.precio, tipoEntrega: "retiro", pago: "efectivo", fechaEntrega: fecha
  });
  mostrarAviso("Se cargaron 3 pedidos de ejemplo.", "ok");
}

/* ---------------------------------------------------------
   CAJA
   --------------------------------------------------------- */

function vistaCaja(estado) {
  const hoy = hoyYmd();
  const delDia = estado.caja.filter(function (m) { return ymd(new Date(m.fecha)) === hoy; });
  const total = delDia.reduce(function (s, m) { return s + m.importe; }, 0);
  const efectivo = delDia.filter(function (m) { return m.pago === "efectivo"; })
    .reduce(function (s, m) { return s + m.importe; }, 0);
  const transferencia = delDia.filter(function (m) { return m.pago === "transferencia"; })
    .reduce(function (s, m) { return s + m.importe; }, 0);

  const canalDeMovimiento = function (m) {
    const p = estado.pedidos.find(function (x) { return x.id === m.pedidoId; });
    return p && p.tipoEntrega === "delivery" ? "delivery" : "local";
  };
  const delivery = delDia.filter(function (m) { return canalDeMovimiento(m) === "delivery"; })
    .reduce(function (s, m) { return s + m.importe; }, 0);
  const local = delDia.filter(function (m) { return canalDeMovimiento(m) === "local"; })
    .reduce(function (s, m) { return s + m.importe; }, 0);

  let html = "<div class='encabezado-vista'><h1>Caja</h1>" +
    "<p>El dinero entra solamente cuando marcás una venta como cobrada.</p></div>";

  html += "<div class='tarjeta'><div class='resumen'>" +
    "<div><span class='cifra'>" + pesos(total) + "</span><span class='rotulo'>Cobrado hoy</span></div>" +
    "<div><span class='cifra'>" + pesos(efectivo) + "</span><span class='rotulo'>Efectivo</span></div>" +
    "<div><span class='cifra'>" + pesos(transferencia) + "</span><span class='rotulo'>Transferencia</span></div>" +
    "</div></div>";

  html += "<div class='tarjeta'><div class='resumen'>" +
    "<div><span class='cifra'>" + pesos(delivery) + "</span><span class='rotulo'>Delivery</span></div>" +
    "<div><span class='cifra'>" + pesos(local) + "</span><span class='rotulo'>Local / retiro</span></div>" +
    "</div></div>";

  html += "<div class='grupo-titulo'>Movimientos de hoy<span class='cuenta'>" + delDia.length + "</span></div>";
  if (!delDia.length) {
    html += "<div class='vacio'>Todavía no se cobró ninguna venta hoy.</div>";
  } else {
    html += "<div class='tarjeta'>";
    delDia.forEach(function (m) {
      const esDelivery = canalDeMovimiento(m) === "delivery";
      html += "<div class='mov " + (m.tipo === "anulacion" ? "anulacion" : "") + "'>" +
        "<span><strong>" + esc(m.numero) + "</strong> · " + esc(m.cliente) +
        "<br><span class='ayuda'>" + (m.pago === "efectivo" ? "Efectivo" : "Transferencia") +
        " · " + (esDelivery ? "Delivery" : "Local") +
        " · " + fechaHora(m.fecha) + (m.tipo === "anulacion" ? " · anulación" : "") + "</span></span>" +
        "<span><strong>" + pesos(m.importe) + "</strong></span></div>";
    });
    html += "</div>";
  }

  const otros = estado.caja.filter(function (m) { return ymd(new Date(m.fecha)) !== hoy; });
  if (otros.length) {
    html += "<div class='grupo-titulo'>Días anteriores<span class='cuenta'>" + otros.length + "</span></div><div class='tarjeta'>";
    otros.forEach(function (m) {
      html += "<div class='mov " + (m.tipo === "anulacion" ? "anulacion" : "") + "'>" +
        "<span><strong>" + esc(m.numero) + "</strong> · " + esc(m.cliente) +
        "<br><span class='ayuda'>" + fechaHora(m.fecha) + "</span></span>" +
        "<span>" + pesos(m.importe) + "</span></div>";
    });
    html += "</div>";
  }

  return html;
}

/* ---------------------------------------------------------
   RUTEO Y RENDER
   --------------------------------------------------------- */

const RUTAS = ["/ventas", "/envios", "/stock", "/caja"];

function rutaActual() {
  const h = location.hash.replace("#", "");
  return RUTAS.indexOf(h) >= 0 ? h : "/ventas";
}

function render() {
  const app = document.getElementById("app");
  const estado = storageService.leer();
  const ruta = rutaActual();

  const activo = document.activeElement;
  const idFoco = activo && activo.id && app.contains(activo) ? activo.id : null;
  const inicio = idFoco ? activo.selectionStart : null;
  const fin = idFoco ? activo.selectionEnd : null;

  let html = "";
  if (ruta === "/ventas") html = vistaVentas(estado);
  else if (ruta === "/envios") html = vistaEnvios(estado);
  else if (ruta === "/stock") html = vistaStock(estado);
  else if (ruta === "/caja") html = vistaCaja(estado);
  app.innerHTML = html;

  if (idFoco) {
    const nodo = document.getElementById(idFoco);
    if (nodo) {
      nodo.focus();
      try { nodo.setSelectionRange(inicio, fin); } catch (e) { /* campos sin selección */ }
    }
  }

  document.querySelectorAll("#nav a[data-ruta]").forEach(function (a) {
    a.classList.toggle("activo", a.getAttribute("data-ruta") === ruta);
  });
}

/* ---------------------------------------------------------
   EVENTOS
   --------------------------------------------------------- */

document.addEventListener("click", function (ev) {
  const nodo = ev.target.closest("[data-accion]");
  if (!nodo) return;
  const accion = nodo.getAttribute("data-accion");
  const id = nodo.getAttribute("data-id");
  const tipo = nodo.getAttribute("data-tipo");
  const salida = nodo.getAttribute("data-salida");

  switch (accion) {
    /* --- Ventas --- */
    case "confirmar-venta":
      confirmarVenta(id);
      break;
    case "rechazar-pedido":
      pedirConfirmacion("Rechazar pedido", "El pedido queda rechazado y no se descuenta stock.", function () {
        rechazarPedido(id); return true;
      }, "Sí, rechazar");
      break;
    case "cancelar-venta":
      pedirConfirmacion("Cancelar venta", "Se devuelve el stock y, si estaba cobrada, se anula el cobro en Caja.", function () {
        cancelarVenta(id); return true;
      }, "Sí, cancelar");
      break;
    case "cobrar":
      marcarCobrado(id);
      break;
    case "retirado":
      marcarRetirado(id, false);
      break;
    case "retirado-cobrado":
      marcarRetirado(id, true);
      break;
    case "limpiar-filtro":
      filtroVentas = { texto: "", periodo: "todo" };
      render();
      break;
    case "imprimir":
      imprimirComanda(id);
      break;
    case "cambiar-fecha":
      abrirCambioFecha(id);
      break;
    case "venta-puerta":
      abrirVentaEnPuerta();
      break;
    case "pedido-manual":
      abrirPedidoManual();
      break;
    case "pm-mas": {
      const clave = tipo + ":" + id;
      pedidoManual.items[clave] = (pedidoManual.items[clave] || 0) + 1;
      refrescarPedidoManual();
      break;
    }
    case "pm-menos": {
      const clave = tipo + ":" + id;
      pedidoManual.items[clave] = Math.max(0, (pedidoManual.items[clave] || 0) - 1);
      refrescarPedidoManual();
      break;
    }
    case "editar-pedido":
      abrirEdicionPedido(id);
      break;
    case "ed-mas": {
      const clave = tipo + ":" + id;
      edicion.items[clave] = (edicion.items[clave] || 0) + 1;
      refrescarEdicion();
      break;
    }
    case "ed-menos": {
      const clave = tipo + ":" + id;
      edicion.items[clave] = Math.max(0, (edicion.items[clave] || 0) - 1);
      refrescarEdicion();
      break;
    }
    case "vp-mas": {
      const clave = tipo + ":" + id;
      ventaPuerta.items[clave] = (ventaPuerta.items[clave] || 0) + 1;
      refrescarVentaPuerta();
      break;
    }
    case "vp-menos": {
      const clave = tipo + ":" + id;
      ventaPuerta.items[clave] = Math.max(0, (ventaPuerta.items[clave] || 0) - 1);
      refrescarVentaPuerta();
      break;
    }

    /* --- Envíos --- */
    case "sel-envio": {
      const i = seleccionEnvios.indexOf(id);
      if (i >= 0) seleccionEnvios.splice(i, 1);
      else if (seleccionEnvios.length >= MAX_PEDIDOS_SALIDA) {
        mostrarAviso("Una salida lleva como máximo " + MAX_PEDIDOS_SALIDA + " pedidos.", "error");
      } else seleccionEnvios.push(id);
      render();
      break;
    }
    case "crear-salida":
      if (crearSalida(seleccionEnvios)) seleccionEnvios = [];
      break;
    case "subir":
      moverEnSalida(salida, id, -1);
      break;
    case "bajar":
      moverEnSalida(salida, id, 1);
      break;
    case "quitar-salida":
      quitarDeSalida(salida, id);
      break;
    case "iniciar-salida":
      iniciarSalida(salida);
      break;
    case "entregado":
      marcarEntregado(id, false);
      break;
    case "entregado-cobrado":
      marcarEntregado(id, true);
      break;
    case "no-entregado":
      marcarNoEntregado(id);
      break;
    case "finalizar-salida":
      pedirConfirmacion("Finalizar salida", "Los pedidos no entregados vuelven a quedar disponibles para otra salida.", function () {
        finalizarSalida(salida); return true;
      }, "Sí, finalizar");
      break;

    case "hoja-ruta":
      imprimirHojaDeRuta(salida);
      break;

    /* --- Stock --- */
    case "stock-mas":
      ajustarStock(id, 1);
      break;
    case "stock-menos":
      ajustarStock(id, -1);
      break;
    case "movimiento":
      abrirMovimiento(id);
      break;
    case "pedidos-ejemplo":
      cargarPedidosEjemplo();
      break;
    case "exportar":
      exportarDatos();
      break;
    case "importar": {
      const input = document.getElementById("archivo-import");
      if (input) input.click();
      break;
    }
    case "restablecer":
      pedirConfirmacion("Restablecer demo",
        "Se borran pedidos, salidas y movimientos de caja, y el stock vuelve a " + STOCK_INICIAL + " paquetes.",
        function () {
          storageService.restablecer();
          seleccionEnvios = [];
          mostrarAviso("Demo restablecida.", "ok");
          return true;
        }, "Sí, borrar todo");
      break;
  }
});

document.addEventListener("input", function (ev) {
  const vp = ev.target.getAttribute("data-vp");
  if (vp) { ventaPuerta[vp] = ev.target.value; return; }
  const pm = ev.target.getAttribute("data-pm");
  if (pm) { pedidoManual[pm] = ev.target.value; return; }
  const filtro = ev.target.getAttribute("data-filtro");
  if (filtro) { filtroVentas[filtro] = ev.target.value; render(); }
});

document.addEventListener("change", function (ev) {
  const vp = ev.target.getAttribute("data-vp");
  if (vp) { ventaPuerta[vp] = ev.target.value; return; }
  const pm = ev.target.getAttribute("data-pm");
  if (pm) {
    pedidoManual[pm] = ev.target.value;
    if (pm === "tipoEntrega") refrescarPedidoManual();
    return;
  }
  const filtro = ev.target.getAttribute("data-filtro");
  if (filtro) { filtroVentas[filtro] = ev.target.value; render(); return; }
  if (ev.target.getAttribute("data-filtro-mov")) {
    filtroMovimientos = ev.target.value;
    render();
    return;
  }
  if (ev.target.getAttribute("data-filtro-zona")) {
    filtroZona = ev.target.value;
    render();
    return;
  }
  if (ev.target.id === "archivo-import" && ev.target.files && ev.target.files[0]) {
    const archivo = ev.target.files[0];
    pedirConfirmacion("Restaurar datos",
      "Se reemplaza todo lo que hay ahora por el contenido de " + archivo.name + ".",
      function () {
        importarDatos(archivo, function () { seleccionEnvios = []; render(); });
        return true;
      }, "Sí, restaurar");
    ev.target.value = "";
    return;
  }
  const precio = ev.target.getAttribute("data-precio");
  if (precio) cambiarPrecio(precio, ev.target.getAttribute("data-id"), ev.target.value);
});

function abrirCambioFecha(pedidoId) {
  const estado = storageService.leer();
  const p = estado.pedidos.find(function (x) { return x.id === pedidoId; });
  if (!p) return;
  abrirModal({
    titulo: "Cambiar fecha de entrega",
    cuerpo: "<div class='campo'><label for='nueva-fecha'>Nueva fecha (no se reparte los domingos)</label>" +
      "<input id='nueva-fecha' type='date' value='" + p.fechaEntrega + "'></div>",
    textoAceptar: "Guardar fecha",
    clase: "btn-principal",
    onAceptar: function () {
      const valor = document.getElementById("nueva-fecha").value;
      if (!valor) { mostrarAviso("Elegí una fecha.", "error"); return false; }
      if (desdeYmd(valor).getDay() === 0) { mostrarAviso("Los domingos no se reparte.", "error"); return false; }
      cambiarFechaEntrega(pedidoId, valor);
      return true;
    }
  });
}

/* ---------------------------------------------------------
   ARRANQUE
   --------------------------------------------------------- */

window.addEventListener("hashchange", function () {
  seleccionEnvios = [];
  filtroZona = "todas";
  render();
});

storageService.suscribir(function () { render(); });

iniciarModal();
if (!location.hash) location.hash = "#/ventas";

document.getElementById("app").innerHTML =
  "<div class='vacio'>Cargando los datos…</div>";

storageService.iniciar(function () { render(); });
