/* =========================================================
   PÁGINA PÚBLICA DEL CLIENTE (index.html)
   Solo permite armar y enviar un pedido.
   No tiene acceso a Ventas, Envíos, Stock ni Caja.
   ========================================================= */

/* -----------------------------------------------------------
   Datos recordados del cliente.
   Se guardan en SU dispositivo, aparte del estado del negocio,
   para que no tenga que escribir todo cada vez que compra.
   ----------------------------------------------------------- */

const CLAVE_CLIENTE = "heladeria_demo_cliente";

function leerCliente() {
  try {
    const crudo = localStorage.getItem(CLAVE_CLIENTE);
    return crudo ? JSON.parse(crudo) : null;
  } catch (e) { return null; }
}

function guardarCliente(pedido) {
  try {
    localStorage.setItem(CLAVE_CLIENTE, JSON.stringify({
      cliente: pedido.cliente,
      telefono: pedido.telefono,
      tipoEntrega: pedido.tipoEntrega,
      direccion: pedido.direccion,
      referencia: pedido.referencia,
      zona: pedido.zona,
      gps: pedido.gps,
      pago: pedido.pago,
      ultimosItems: pedido.items
    }));
  } catch (e) { /* si el navegador no deja guardar, no pasa nada */ }
}

function olvidarCliente() {
  try { localStorage.removeItem(CLAVE_CLIENTE); } catch (e) { /* nada */ }
  reiniciarBorrador();
  mostrarAviso("Listo, empezamos de cero.", "ok");
  render();
}

/* Carga los datos guardados al abrir la página. */
function precargarCliente() {
  const c = leerCliente();
  if (!c) return;
  borrador.cliente = c.cliente || "";
  borrador.telefono = c.telefono || "";
  borrador.tipoEntrega = c.tipoEntrega || "delivery";
  borrador.pago = c.pago || "efectivo";
  borrador.direccion = c.direccion || "";
  borrador.referencia = c.referencia || "";
  borrador.zona = c.zona || "";
  borrador.gps = c.gps || null;
}

/* Vuelve a cargar en el carrito lo que pidió la vez pasada,
   salteando lo que ya no existe o está sin stock. */
function repetirUltimoPedido() {
  const c = leerCliente();
  const estado = storageService.leer();
  if (!c || !c.ultimosItems || !c.ultimosItems.length) {
    mostrarAviso("Todavía no tenés un pedido anterior.", "error");
    return;
  }
  let agregados = 0, salteados = 0;
  borrador.items = {};
  c.ultimosItems.forEach(function (it) {
    if (it.tipo === "producto") {
      const p = producto(estado, it.id);
      if (!p || p.stock <= 0) { salteados++; return; }
    } else {
      const combo = estado.combos.find(function (x) { return x.id === it.id; });
      if (!combo || disponibilidadCombo(combo, estado) <= 0) { salteados++; return; }
    }
    borrador.items[(it.tipo === "producto" ? "p:" : "c:") + it.id] = it.cantidad;
    agregados++;
  });
  if (!agregados) {
    mostrarAviso("Nada de tu pedido anterior está disponible ahora.", "error");
  } else if (salteados) {
    mostrarAviso("Cargamos tu pedido anterior. " + salteados + " producto(s) no están disponibles.", "ok");
  } else {
    mostrarAviso("Cargamos tu pedido anterior.", "ok");
  }
  render();
}

let borrador = {
  items: {},         // clave "p:id" o "c:id" -> cantidad
  cliente: "", telefono: "", tipoEntrega: "delivery", pago: "efectivo",
  observaciones: "", direccion: "", referencia: "", zona: "", gps: null,
  ultimoPedidoId: null
};

function reiniciarBorrador() {
  borrador = {
    items: {}, cliente: "", telefono: "", tipoEntrega: "delivery", pago: "efectivo",
    observaciones: "", direccion: "", referencia: "", zona: "", gps: null, ultimoPedidoId: null
  };
}

function itemsDelBorrador(estado) {
  const items = [];
  Object.keys(borrador.items).forEach(function (clave) {
    const cant = borrador.items[clave];
    if (cant <= 0) return;
    const partes = clave.split(":");
    const tipo = partes[0] === "p" ? "producto" : "combo";
    const id = partes[1];
    const origen = tipo === "producto"
      ? producto(estado, id)
      : estado.combos.find(function (c) { return c.id === id; });
    if (!origen) return;
    items.push({ tipo: tipo, id: id, nombre: origen.nombre, precio: origen.precio, cantidad: cant });
  });
  return items;
}

/* ---------------------------------------------------------
   Vista
   --------------------------------------------------------- */

function vistaPedido(estado) {
  const items = itemsDelBorrador(estado);
  const total = items.reduce(function (s, it) { return s + it.precio * it.cantidad; }, 0);
  const fecha = calcularFechaEntrega();
  const ultimo = borrador.ultimoPedidoId
    ? estado.pedidos.find(function (p) { return p.id === borrador.ultimoPedidoId; })
    : null;

  if (ultimo) {
    return "" +
      "<div class='tarjeta'>" +
      "<h1>¡Pedido recibido!</h1>" +
      "<p>Tu número de pedido es <strong>" + esc(ultimo.numero) + "</strong>. Lo vamos a revisar y confirmar.</p>" +
      "<p class='dato'>" + esc(textoEntrega(ultimo.fechaEntrega)) + "</p>" +
      "<div class='total'><span>Total</span><span>" + pesos(ultimo.total) + "</span></div>" +
      "<div class='acciones'>" +
      "<a class='btn btn-principal btn-ancho' target='_blank' rel='noopener' href='" +
        esc(enlaceWhatsapp(estado.config.whatsapp, textoPedidoWhatsapp(ultimo))) +
        "'>Enviar pedido por WhatsApp</a>" +
      "</div>" +
      "<div class='acciones'><button class='btn btn-suave btn-ancho' data-accion='pedido-nuevo'>Hacer otro pedido</button></div>" +
      "</div>";
  }

  const conocido = leerCliente();
  let html = "";
  html += "<div class='encabezado-vista'><h1>Hacé tu pedido</h1>" +
    "<p>Elegí tus productos y te los llevamos. Precios de demostración.</p></div>";

  if (conocido && conocido.cliente) {
    html += "<div class='tarjeta bienvenida'>" +
      "<h2>Hola de nuevo, " + esc(conocido.cliente.split(" ")[0]) + "</h2>" +
      "<p class='ayuda'>Dejamos tus datos cargados abajo.</p>" +
      "<div class='acciones'>" +
      (conocido.ultimosItems && conocido.ultimosItems.length
        ? "<button class='btn btn-principal' data-accion='repetir-pedido'>Pedir lo mismo que la vez pasada</button>"
        : "") +
      "<button class='btn btn-suave btn-chico' data-accion='olvidar-cliente'>No soy yo</button>" +
      "</div></div>";
  }

  html += "<div class='tarjeta'><h2>Productos</h2>";
  estado.productos.forEach(function (p) {
    const cant = borrador.items["p:" + p.id] || 0;
    html += "<div class='producto'>" +
      "<div class='producto-datos'>" +
      "<div class='producto-nombre'>" + esc(p.nombre) + "</div>" +
      "<div class='producto-precio'>" + pesos(p.precio) + "</div>" +
      "<div class='producto-detalle" + (p.stock <= 0 ? " bajo" : (p.stock <= AVISO_STOCK_BAJO ? " bajo" : "")) + "'>" +
      (p.stock <= 0 ? "Sin stock por ahora" : "Quedan " + p.stock) + "</div>" +
      "</div>" +
      contadorHTML("p", p.id, cant, p.stock) +
      "</div>";
  });
  html += "</div>";

  html += "<div class='tarjeta'><h2>Combos</h2>";
  estado.combos.forEach(function (c) {
    const cant = borrador.items["c:" + c.id] || 0;
    const disp = disponibilidadCombo(c, estado);
    html += "<div class='producto'>" +
      "<div class='producto-datos'>" +
      "<div class='producto-nombre'>" + esc(c.nombre) + "</div>" +
      "<div class='producto-detalle'>" + esc(c.contenido) + "</div>" +
      "<div class='producto-precio'>" + pesos(c.precio) + "</div>" +
      "<div class='producto-detalle" + (disp <= AVISO_STOCK_BAJO ? " bajo" : "") + "'>" +
      (disp <= 0 ? "Sin stock por ahora" : "Se pueden armar " + disp) + "</div>" +
      "</div>" +
      contadorHTML("c", c.id, cant, disp) +
      "</div>";
  });
  html += "</div>";

  html += "<div class='tarjeta' id='carrito'><h2>Tu carrito</h2>";
  if (!items.length) {
    html += "<p class='ayuda'>Todavía no agregaste productos.</p>";
  } else {
    items.forEach(function (it) {
      html += "<div class='carrito-linea'><span>" + it.cantidad + " x " + esc(it.nombre) +
        "</span><span>" + pesos(it.precio * it.cantidad) + "</span></div>";
    });
    html += "<div class='total'><span>Total</span><span>" + pesos(total) + "</span></div>";
  }
  html += "</div>";

  html += "<div class='tarjeta'><h2>Tus datos</h2>" +
    campoTexto("cliente", "Nombre", borrador.cliente, "Nombre y apellido") +
    campoTexto("telefono", "Teléfono", borrador.telefono, "Ej. 3624720516", "tel") +
    "<div class='campo'><label>Tipo de pedido</label><div class='opciones'>" +
    radio("tipoEntrega", "delivery", "Delivery", borrador.tipoEntrega) +
    radio("tipoEntrega", "retiro", "Retiro en puerta", borrador.tipoEntrega) +
    "</div></div>" +
    "<div class='campo'><label>Forma de pago</label><div class='opciones'>" +
    radio("pago", "efectivo", "Efectivo", borrador.pago) +
    radio("pago", "transferencia", "Transferencia", borrador.pago) +
    "</div></div>";

  if (borrador.tipoEntrega === "delivery") {
    html += "<hr class='sep'><h3>¿Dónde te llevamos el pedido?</h3>" +
      campoTexto("direccion", "Dirección (opcional)", borrador.direccion, "Calle y número") +
      campoTexto("referencia", "Referencia para encontrarte", borrador.referencia, "Color de casa, esquina, negocio cercano") +
      selectZona(borrador.zona) +
      "<div class='campo'><button class='btn btn-suave btn-ancho' data-accion='usar-ubicacion'>Usar mi ubicación</button></div>";
    if (borrador.gps) {
      html += "<p class='dato'>Ubicación guardada. " +
        "<a target='_blank' rel='noopener' href='" + esc(enlaceMapa(borrador.gps)) + "'>Ver en Google Maps</a></p>";
    } else {
      html += "<p class='ayuda'>Necesitamos tu ubicación GPS o una dirección con referencia para poder llegar.</p>";
    }
  }

  html += "<div class='campo'><label for='observaciones'>Observaciones</label>" +
    "<textarea id='observaciones' data-campo='observaciones' placeholder='Horario preferido, aclaraciones...'>" +
    esc(borrador.observaciones) + "</textarea></div>";
  html += "</div>";

  html += "<div class='tarjeta'><h2>Entrega estimada</h2><p class='dato'>" + esc(textoEntrega(fecha)) + "</p>" +
    "<button class='btn btn-principal btn-ancho' data-accion='confirmar-pedido'>Confirmar pedido</button></div>";

  html += "<div class='barra-total no-print'><span><strong>" + pesos(total) + "</strong>" +
    "<br><span style='font-size:.75rem'>" + items.length + " renglón(es)</span></span>" +
    "<button class='btn btn-principal' data-accion='ir-carrito'>Ver carrito</button></div>";

  return html;
}

function contadorHTML(tipo, id, cantidad, tope) {
  return "<div class='contador'>" +
    "<button data-accion='menos' data-tipo='" + tipo + "' data-id='" + id + "' aria-label='Quitar uno'" +
    (cantidad <= 0 ? " disabled" : "") + ">−</button>" +
    "<span class='cant'>" + cantidad + "</span>" +
    "<button data-accion='mas' data-tipo='" + tipo + "' data-id='" + id + "' aria-label='Agregar uno'" +
    (cantidad >= tope ? " disabled" : "") + ">+</button>" +
    "</div>";
}

function topeDisponible(estado, tipo, id) {
  if (tipo === "p") {
    const p = producto(estado, id);
    return p ? p.stock : 0;
  }
  const c = estado.combos.find(function (x) { return x.id === id; });
  return c ? disponibilidadCombo(c, estado) : 0;
}

function campoTexto(campo, etiqueta, valor, ayuda, tipo) {
  return "<div class='campo'><label for='" + campo + "'>" + esc(etiqueta) + "</label>" +
    "<input id='" + campo + "' type='" + (tipo || "text") + "' data-campo='" + campo +
    "' value='" + esc(valor) + "' placeholder='" + esc(ayuda || "") + "'></div>";
}

function selectZona(actual) {
  let html = "<div class='campo'><label for='zona'>Zona</label>" +
    "<select id='zona' data-campo='zona'>" +
    "<option value=''" + (actual ? "" : " selected") + ">Elegí tu zona</option>";
  ZONAS.forEach(function (z) {
    html += "<option value='" + esc(z) + "'" + (actual === z ? " selected" : "") + ">" + esc(z) + "</option>";
  });
  return html + "</select></div>";
}

function radio(campo, valor, etiqueta, actual) {
  return "<label><input type='radio' name='" + campo + "' data-campo='" + campo +
    "' value='" + valor + "'" + (actual === valor ? " checked" : "") + "> " + esc(etiqueta) + "</label>";
}

/* ---------------------------------------------------------
   Confirmación y validaciones
   --------------------------------------------------------- */

function confirmarPedidoCliente() {
  const estado = storageService.leer();
  const items = itemsDelBorrador(estado);
  if (!items.length) { mostrarAviso("El carrito está vacío.", "error"); return; }
  const faltan = faltantesDeStock(items, estado);
  if (faltan.length) {
    mostrarAviso("Justo se agotó: " + faltan.map(function (f) { return f.nombre; }).join(", ") +
      ". Ajustá las cantidades y probá de nuevo.", "error");
    render();
    return;
  }
  if (!borrador.cliente.trim()) { mostrarAviso("Escribí tu nombre.", "error"); return; }
  if (!borrador.telefono.trim()) { mostrarAviso("Escribí tu teléfono.", "error"); return; }
  if (borrador.tipoEntrega === "delivery") {
    const tieneDireccion = borrador.direccion.trim().length >= 5 && borrador.referencia.trim().length >= 3;
    if (!borrador.gps && !tieneDireccion) {
      mostrarAviso("Para delivery necesitamos tu ubicación GPS o dirección con referencia.", "error");
      return;
    }
  }
  const total = items.reduce(function (s, it) { return s + it.precio * it.cantidad; }, 0);
  const pedido = crearPedido({
    cliente: borrador.cliente.trim(),
    telefono: borrador.telefono.trim(),
    items: items,
    total: total,
    tipoEntrega: borrador.tipoEntrega,
    pago: borrador.pago,
    observaciones: borrador.observaciones.trim(),
    direccion: borrador.tipoEntrega === "delivery" ? borrador.direccion.trim() : "",
    referencia: borrador.tipoEntrega === "delivery" ? borrador.referencia.trim() : "",
    zona: borrador.tipoEntrega === "delivery" ? borrador.zona : "",
    gps: borrador.tipoEntrega === "delivery" ? borrador.gps : null,
    fechaEntrega: calcularFechaEntrega()
  });
  guardarCliente(pedido);   // para que la próxima vez no escriba todo de nuevo
  borrador.ultimoPedidoId = pedido.id;
  mostrarAviso("Pedido " + pedido.numero + " enviado.", "ok");
  window.scrollTo(0, 0);
}

function pedirUbicacion() {
  if (!navigator.geolocation) {
    mostrarAviso("Este navegador no permite compartir la ubicación.", "error");
    return;
  }
  mostrarAviso("Buscando tu ubicación...");
  navigator.geolocation.getCurrentPosition(function (pos) {
    borrador.gps = {
      lat: Number(pos.coords.latitude.toFixed(6)),
      lng: Number(pos.coords.longitude.toFixed(6))
    };
    mostrarAviso("Ubicación guardada.", "ok");
    render();
  }, function () {
    mostrarAviso("No se pudo obtener la ubicación. Escribí dirección y referencia.", "error");
  }, { enableHighAccuracy: true, timeout: 10000 });
}

/* ---------------------------------------------------------
   Render y eventos
   --------------------------------------------------------- */

function render() {
  const app = document.getElementById("app");

  // Guarda el foco para no interrumpir mientras alguien escribe
  const activo = document.activeElement;
  const idFoco = activo && activo.id && app.contains(activo) ? activo.id : null;
  const inicio = idFoco ? activo.selectionStart : null;
  const fin = idFoco ? activo.selectionEnd : null;

  app.innerHTML = vistaPedido(storageService.leer());

  if (idFoco) {
    const nodo = document.getElementById(idFoco);
    if (nodo) {
      nodo.focus();
      try { nodo.setSelectionRange(inicio, fin); } catch (e) { /* campos sin selección */ }
    }
  }
}

document.addEventListener("click", function (ev) {
  const nodo = ev.target.closest("[data-accion]");
  if (!nodo) return;
  const accion = nodo.getAttribute("data-accion");
  const id = nodo.getAttribute("data-id");
  const tipo = nodo.getAttribute("data-tipo");

  if (accion === "mas") {
    const clave = tipo + ":" + id;
    const tope = topeDisponible(storageService.leer(), tipo, id);
    const actual = borrador.items[clave] || 0;
    if (actual >= tope) { mostrarAviso("No queda más stock de ese producto.", "error"); return; }
    borrador.items[clave] = actual + 1;
    render();
  } else if (accion === "menos") {
    const clave = tipo + ":" + id;
    borrador.items[clave] = Math.max(0, (borrador.items[clave] || 0) - 1);
    if (!borrador.items[clave]) delete borrador.items[clave];
    render();
  } else if (accion === "ir-carrito") {
    const c = document.getElementById("carrito");
    if (c) c.scrollIntoView({ block: "start" });
  } else if (accion === "usar-ubicacion") {
    pedirUbicacion();
  } else if (accion === "confirmar-pedido") {
    confirmarPedidoCliente();
    render();
  } else if (accion === "pedido-nuevo") {
    reiniciarBorrador();
    precargarCliente();
    render();
  } else if (accion === "repetir-pedido") {
    repetirUltimoPedido();
  } else if (accion === "olvidar-cliente") {
    olvidarCliente();
  }
});

document.addEventListener("input", function (ev) {
  const campo = ev.target.getAttribute("data-campo");
  if (campo) borrador[campo] = ev.target.value;
});

document.addEventListener("change", function (ev) {
  const campo = ev.target.getAttribute("data-campo");
  if (!campo) return;
  borrador[campo] = ev.target.value;
  if (campo === "tipoEntrega") render();
});

/* Si el negocio cambia precios o stock, el cliente lo ve al instante. */
storageService.suscribir(function () { render(); });

iniciarModal();
precargarCliente();

// Hasta que llegue el primer dato no se puede mostrar el catálogo.
document.getElementById("app").innerHTML =
  "<div class='vacio'>Cargando el catálogo…</div>";

storageService.iniciar(function () { render(); });
