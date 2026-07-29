/* =========================================================
   HELADERÍA Y CONGELADOS — núcleo compartido
   Lo usan las dos páginas:
     index.html  -> página pública del cliente
     panel.html  -> panel interno del negocio
   Ambas comparten el mismo estado porque están en el mismo
   origen (mismo host y puerto).
   ========================================================= */

/* ---------------------------------------------------------
   1) CONSTANTES CONFIGURABLES
   --------------------------------------------------------- */

const WHATSAPP_NUMBER = "5493624720516"; // sin +, sin espacios

const HORA_CORTE = 11;          // desde esta hora el pedido pasa al próximo día
const HORARIO_DESDE = "9:00";   // inicio aproximado del reparto
const HORARIO_HASTA = "13:30";  // fin aproximado del reparto
const STOCK_INICIAL = 10;       // paquetes por producto al iniciar la demo
const AVISO_STOCK_BAJO = 3;     // avisar cuando queden menos de esta cantidad
const MAX_PEDIDOS_SALIDA = 4;   // máximo de pedidos por salida

/* Zonas de reparto. Sirven para armar las salidas mirando qué queda cerca.
   Cambialas por los barrios reales del recorrido. */
const ZONAS = ["Centro", "Norte", "Sur", "Este", "Oeste", "Otra"];

/* Centro del mapa donde el cliente marca su ubicación (útil en pueblos sin
   nombres de calle). Poné las coordenadas de la plaza o el centro del pueblo:
   las buscás en Google Maps, clic derecho sobre el punto -> copian lat, lng. */
const MAPA_CENTRO = { lat: -27.4514, lng: -58.9867, zoom: 14 };

const CLAVE_ESTADO = "heladeria_demo_estado";
const VERSION_ESTADO = 2;
const CANAL = "heladeria_demo_canal";

/* Catálogo base. Los precios son de DEMOSTRACIÓN y se editan desde Stock. */
const PRODUCTOS_BASE = [
  { id: "fruta40",  nombre: "Fruta x40",      precio: 9000 },
  { id: "crema40",  nombre: "Crema x40",      precio: 12000 },
  { id: "bombon10", nombre: "Bombón x10",     precio: 7000 },
  { id: "oreo10",   nombre: "Oreo x10",       precio: 8000 },
  { id: "split10",  nombre: "Split x10",      precio: 7500 },
  { id: "pico10",   nombre: "Pico Dulce x10", precio: 6500 },
  { id: "hielo2",   nombre: "Hielo 2 kg",     precio: 1500 },
  { id: "hielo10",  nombre: "Hielo 10 kg",    precio: 5000 }
];

const COMBOS_BASE = [
  {
    id: "combo_premium",
    nombre: "Combo Premium",
    precio: 26000,
    contenido: "20 Oreo, 20 Split, 20 Pico Dulce, 20 Bombón",
    componentes: { oreo10: 2, split10: 2, pico10: 2, bombon10: 2 }
  },
  {
    id: "combo_emprendedor",
    nombre: "Combo Emprendedor",
    precio: 38000,
    contenido: "40 Fruta, 40 Crema, 10 Oreo, 10 Split, 10 Bombón, 10 Pico Dulce",
    componentes: { fruta40: 1, crema40: 1, oreo10: 1, split10: 1, bombon10: 1, pico10: 1 }
  }
];

/* ---------------------------------------------------------
   2) CAPA DE ALMACENAMIENTO (storageService)
   Única puerta de entrada a los datos.
   Para pasar a Firebase más adelante solo hay que reescribir
   leer / actualizar / suscribir / restablecer.
   --------------------------------------------------------- */

const storageService = (function () {
  const idPestania = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const suscriptores = new Set();
  let canal = null;
  let cache = null;
  let listo = false;
  let refEstado = null;
  let conectado = false;
  let modo = (typeof MODO_DATOS !== "undefined") ? MODO_DATOS : "local";

  /* ---------- Forma de los datos ----------
     Realtime Database no guarda listas vacías y devuelve las listas
     como objetos con claves numéricas. Esto las normaliza siempre. */
  function comoLista(valor) {
    if (Array.isArray(valor)) return valor.filter(function (x) { return x != null; });
    if (valor && typeof valor === "object") {
      return Object.keys(valor).map(function (k) { return valor[k]; })
        .filter(function (x) { return x != null; });
    }
    return [];
  }

  function estadoInicial() {
    return {
      version: VERSION_ESTADO,
      productos: PRODUCTOS_BASE.map(function (p) {
        return { id: p.id, nombre: p.nombre, precio: p.precio, stock: STOCK_INICIAL };
      }),
      combos: COMBOS_BASE.map(function (c) {
        return {
          id: c.id, nombre: c.nombre, precio: c.precio,
          contenido: c.contenido, componentes: Object.assign({}, c.componentes)
        };
      }),
      pedidos: [],
      salidas: [],
      caja: [],
      cajaDiaria: [],
      movimientosStock: [],
      config: {
        whatsapp: WHATSAPP_NUMBER,
        horaCorte: HORA_CORTE,
        contadorPedido: 1,
        contadorSalida: 1
      }
    };
  }

  /* Completa y normaliza un estado venga de donde venga. Es idempotente. */
  function migrar(datos) {
    datos.productos = comoLista(datos.productos);
    datos.combos = comoLista(datos.combos);
    datos.pedidos = comoLista(datos.pedidos);
    datos.salidas = comoLista(datos.salidas);
    datos.caja = comoLista(datos.caja);
    datos.cajaDiaria = comoLista(datos.cajaDiaria);
    datos.movimientosStock = comoLista(datos.movimientosStock);
    datos.pedidos.forEach(function (p) { p.items = comoLista(p.items); });
    datos.salidas.forEach(function (s) { s.pedidos = comoLista(s.pedidos); });
    if (!datos.productos.length) datos.productos = estadoInicial().productos;
    if (!datos.combos.length) datos.combos = estadoInicial().combos;
    if (!datos.config) datos.config = {};
    if (!datos.config.whatsapp) datos.config.whatsapp = WHATSAPP_NUMBER;
    if (!datos.config.contadorPedido) datos.config.contadorPedido = datos.pedidos.length + 1;
    if (!datos.config.contadorSalida) datos.config.contadorSalida = datos.salidas.length + 1;
    datos.version = VERSION_ESTADO;
    return datos;
  }

  /* ---------- Modo local (localStorage) ---------- */

  function leerLocal() {
    let crudo = null;
    try { crudo = localStorage.getItem(CLAVE_ESTADO); } catch (e) { crudo = null; }
    if (!crudo) { cache = estadoInicial(); escribirLocal(cache); return cache; }
    try { cache = migrar(JSON.parse(crudo)); }
    catch (e) { cache = estadoInicial(); escribirLocal(cache); }
    return cache;
  }

  function escribirLocal(estado) {
    try { localStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado)); }
    catch (e) { mostrarAviso("No se pudo guardar en este navegador.", "error"); }
  }

  function arrancarLocal(alEstarListo) {
    modo = "local";
    if (typeof BroadcastChannel !== "undefined" && !canal) {
      canal = new BroadcastChannel(CANAL);
      canal.onmessage = function (ev) {
        // Evita bucles: se ignoran los mensajes de esta misma pestaña.
        if (!ev.data || ev.data.origen === idPestania) return;
        leerLocal();
        avisar("externo");
      };
    }
    window.addEventListener("storage", function (ev) {
      if (ev.key !== CLAVE_ESTADO) return;
      leerLocal();
      avisar("externo");
    });
    leerLocal();
    conectado = true;
    listo = true;
    if (alEstarListo) alEstarListo();
    avisar("inicio");
  }

  /* ---------- Modo Firebase (Realtime Database) ---------- */

  function arrancarFirebase(alEstarListo) {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.database();
    refEstado = db.ref(RUTA_DATOS);

    // Estado real de la conexión, para avisar si se cortó internet.
    db.ref(".info/connected").on("value", function (s) {
      conectado = s.val() === true;
      avisar("conexion");
    });

    refEstado.on("value", function (snap) {
      const datos = snap.val();
      if (!datos) {
        // Primera vez: se siembra la base con los datos de demostración.
        cache = estadoInicial();
        refEstado.set(cache);
      } else {
        cache = migrar(datos);
      }
      if (!listo) { listo = true; if (alEstarListo) alEstarListo(); }
      avisar("remoto");
    }, function (error) {
      // Reglas cerradas, sin internet o URL equivocada: se sigue en local.
      mostrarAviso("Base de datos: " + error.message + ". Se sigue con este navegador.", "error");
      if (!listo) arrancarLocal(alEstarListo);
    });
  }

  /* ---------- Arranque ---------- */

  function iniciar(alEstarListo) {
    suscribir(pintarConexion);
    if (modo === "firebase") {
      if (typeof firebase === "undefined" || !firebase.database) {
        mostrarAviso("No se pudo cargar Firebase. Se sigue con este navegador.", "error");
        arrancarLocal(alEstarListo);
      } else {
        try { arrancarFirebase(alEstarListo); }
        catch (e) { console.error(e); arrancarLocal(alEstarListo); }
      }
    } else {
      arrancarLocal(alEstarListo);
    }
    pintarConexion();
  }

  /* ---------- Lectura y escritura ---------- */

  function leer() {
    if (cache) return cache;
    if (modo === "local") return leerLocal();
    cache = estadoInicial();   // provisorio hasta que llegue el primer dato
    return cache;
  }

  function guardar(estado) {
    if (modo === "firebase" && refEstado) {
      refEstado.set(estado).catch(function (e) {
        mostrarAviso("No se pudo guardar: " + e.message, "error");
      });
    } else {
      escribirLocal(estado);
      if (canal) canal.postMessage({ origen: idPestania, momento: Date.now() });
    }
  }

  function actualizar(fn) {
    const estado = leer();
    const resultado = fn(estado);
    cache = estado;
    guardar(estado);
    avisar("propio");
    return resultado;
  }

  function suscribir(fn) {
    suscriptores.add(fn);
    return function () { suscriptores.delete(fn); };
  }

  function avisar(origen) {
    suscriptores.forEach(function (fn) {
      try { fn(leer(), origen); } catch (e) { console.error(e); }
    });
  }

  function restablecer() {
    cache = estadoInicial();
    guardar(cache);
    avisar("propio");
  }

  function reemplazar(datos) {
    cache = migrar(datos);
    guardar(cache);
    avisar("propio");
  }

  /* ---------- Estado de la conexión ---------- */

  function estadoConexion() {
    if (modo === "local") return "local";
    if (!listo) return "conectando";
    return conectado ? "en-linea" : "sin-conexion";
  }

  function pintarConexion() {
    const el = document.getElementById("conexion");
    if (!el) return;
    const e = estadoConexion();
    el.textContent =
      e === "local" ? "Solo este navegador" :
      e === "conectando" ? "Conectando…" :
      e === "en-linea" ? "En línea" : "Sin conexión";
    el.className = "chapa-conexion " + e;
  }

  return {
    iniciar: iniciar, leer: leer, actualizar: actualizar, suscribir: suscribir,
    restablecer: restablecer, reemplazar: reemplazar, estadoConexion: estadoConexion
  };
})();

/* ---------------------------------------------------------
   3) UTILIDADES
   --------------------------------------------------------- */

const fmtPesos = new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0
});
function pesos(n) { return fmtPesos.format(n || 0); }

function ymd(fecha) {
  return fecha.getFullYear() + "-" +
    String(fecha.getMonth() + 1).padStart(2, "0") + "-" +
    String(fecha.getDate()).padStart(2, "0");
}
function desdeYmd(txt) {
  const p = String(txt).split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
function hoyYmd() { return ymd(new Date()); }

function fechaLarga(txt) {
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" })
    .format(desdeYmd(txt));
}
function fechaHora(iso) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  }).format(new Date(iso));
}
function soloHora(iso) {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/* Regla de reparto:
   antes de la hora de corte -> reparto de hoy;
   desde la hora de corte -> próximo día hábil;
   domingo nunca (pasa al lunes). */
function calcularFechaEntrega(ahora) {
  ahora = ahora || new Date();
  const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  if (ahora.getHours() >= HORA_CORTE) d.setDate(d.getDate() + 1);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1); // 0 = domingo
  return ymd(d);
}

function textoEntrega(fecha) {
  return "Entrega estimada: " + fechaLarga(fecha) + ", de " + HORARIO_DESDE +
    " a " + HORARIO_HASTA + " aproximadamente (el horario puede extenderse).";
}

function esc(txt) {
  return String(txt == null ? "" : txt)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function enlaceMapa(gps) {
  if (!gps) return "";
  return "https://www.google.com/maps?q=" + gps.lat + "," + gps.lng;
}

function enlaceWhatsapp(numero, texto) {
  const limpio = String(numero || "").replace(/\D/g, "");
  return "https://wa.me/" + limpio + "?text=" + encodeURIComponent(texto);
}

/* ---------------------------------------------------------
   4) REGLAS DE STOCK
   --------------------------------------------------------- */

function producto(estado, id) {
  return estado.productos.find(function (p) { return p.id === id; });
}

/* Cuántos paquetes de cada producto necesita una lista de items. */
function necesidadDeStock(items, estado) {
  const necesita = {};
  items.forEach(function (it) {
    if (it.tipo === "producto") {
      necesita[it.id] = (necesita[it.id] || 0) + it.cantidad;
    } else {
      const combo = estado.combos.find(function (c) { return c.id === it.id; });
      if (!combo) return;
      Object.keys(combo.componentes).forEach(function (pid) {
        necesita[pid] = (necesita[pid] || 0) + combo.componentes[pid] * it.cantidad;
      });
    }
  });
  return necesita;
}

/* Devuelve [] si alcanza, o la lista de faltantes. */
function faltantesDeStock(items, estado) {
  const necesita = necesidadDeStock(items, estado);
  const faltan = [];
  Object.keys(necesita).forEach(function (pid) {
    const p = producto(estado, pid);
    if (!p) return;
    if (p.stock < necesita[pid]) {
      faltan.push({ nombre: p.nombre, necesita: necesita[pid], hay: p.stock });
    }
  });
  return faltan;
}

/* Combos disponibles según el stock de sus componentes. */
function disponibilidadCombo(combo, estado) {
  let min = Infinity;
  Object.keys(combo.componentes).forEach(function (pid) {
    const p = producto(estado, pid);
    const hay = p ? Math.floor(p.stock / combo.componentes[pid]) : 0;
    if (hay < min) min = hay;
  });
  return min === Infinity ? 0 : min;
}

function aplicarStock(items, estado, signo, motivo, pedido) {
  const necesita = necesidadDeStock(items, estado);
  Object.keys(necesita).forEach(function (pid) {
    const p = producto(estado, pid);
    if (!p) return;
    p.stock = Math.max(0, p.stock + signo * necesita[pid]);
    anotarMovimiento(estado, pid, signo * necesita[pid], motivo, pedido);
  });
}

/* Historial: queda asentado quién movió el stock y por qué.
   Se llama SIEMPRE después de cambiar el número, para guardar el resultante. */
function anotarMovimiento(estado, productoId, delta, motivo, pedido) {
  if (!Array.isArray(estado.movimientosStock)) estado.movimientosStock = [];
  const p = producto(estado, productoId);
  if (!p) return;
  estado.movimientosStock.unshift({
    id: nuevoId(),
    fecha: new Date().toISOString(),
    productoId: productoId,
    nombre: p.nombre,
    delta: delta,
    resultante: p.stock,
    motivo: motivo || "ajuste",
    numero: pedido ? pedido.numero : "",
    cliente: pedido ? pedido.cliente : ""
  });
  // Se guardan los últimos 500 movimientos para no llenar el navegador.
  if (estado.movimientosStock.length > 500) estado.movimientosStock.length = 500;
}

/* ---------------------------------------------------------
   5) AVISOS Y MODAL (los usan las dos páginas)
   --------------------------------------------------------- */

function mostrarAviso(texto, tipo) {
  const cont = document.getElementById("avisos");
  if (!cont) return;
  const el = document.createElement("div");
  el.className = "aviso " + (tipo || "");
  el.textContent = texto;
  cont.appendChild(el);
  setTimeout(function () { el.remove(); }, 4200);
}

let modalAceptar = null;

function abrirModal(opciones) {
  const modal = document.getElementById("modal");
  if (!modal) return;
  document.getElementById("modal-titulo").textContent = opciones.titulo || "";
  document.getElementById("modal-cuerpo").innerHTML = opciones.cuerpo || "";
  const btnOk = document.getElementById("modal-aceptar");
  const btnNo = document.getElementById("modal-cancelar");
  btnOk.textContent = opciones.textoAceptar || "Confirmar";
  btnOk.className = "btn " + (opciones.clase || "btn-peligro");
  btnNo.textContent = opciones.textoCancelar || "Volver";
  modalAceptar = opciones.onAceptar || null;
  modal.classList.remove("oculto");
  btnOk.focus();
}

function cerrarModal() {
  const modal = document.getElementById("modal");
  if (modal) modal.classList.add("oculto");
  modalAceptar = null;
}

function pedirConfirmacion(titulo, texto, onAceptar, textoBoton) {
  abrirModal({
    titulo: titulo,
    cuerpo: "<p>" + esc(texto) + "</p>",
    textoAceptar: textoBoton || "Sí, continuar",
    onAceptar: onAceptar
  });
}

function iniciarModal() {
  const modal = document.getElementById("modal");
  if (!modal) return;
  document.getElementById("modal-cancelar").addEventListener("click", cerrarModal);
  document.getElementById("modal-aceptar").addEventListener("click", function () {
    if (!modalAceptar) { cerrarModal(); return; }
    if (modalAceptar() !== false) cerrarModal();
  });
  /* Cierra solo si el clic empezó Y terminó en el fondo oscuro. Algunos
     celulares, al elegir una opción de un <select>, disparan un "click"
     que el navegador reporta sobre el fondo en vez del <select> — sin este
     chequeo doble, eso cerraba el modal solo mientras se elegía el motivo
     de un movimiento de stock. */
  let mousedownEnFondo = false;
  modal.addEventListener("mousedown", function (ev) {
    mousedownEnFondo = ev.target.id === "modal";
  });
  modal.addEventListener("click", function (ev) {
    if (ev.target.id === "modal" && mousedownEnFondo) cerrarModal();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") cerrarModal();
  });
}

/* ---------------------------------------------------------
   6) MENSAJE DE WHATSAPP
   --------------------------------------------------------- */

function textoPedidoWhatsapp(pedido) {
  const l = [];
  l.push("*Pedido " + pedido.numero + "* — Heladería y Congelados");
  l.push("Cliente: " + pedido.cliente);
  l.push("Teléfono: " + pedido.telefono);
  l.push("");
  l.push("*Productos:*");
  pedido.items.forEach(function (it) {
    l.push("• " + it.cantidad + " x " + it.nombre + " — " + pesos(it.precio * it.cantidad));
  });
  l.push("*Total: " + pesos(pedido.total) + "*");
  l.push("");
  l.push("Entrega: " + (pedido.tipoEntrega === "delivery" ? "Delivery" : "Retiro en puerta"));
  l.push("Pago: " + (pedido.pago === "efectivo" ? "Efectivo" : "Transferencia"));
  l.push("Fecha estimada: " + fechaLarga(pedido.fechaEntrega) + ", de " + HORARIO_DESDE + " a " + HORARIO_HASTA);
  if (pedido.tipoEntrega === "delivery") {
    l.push("Dirección: " + (pedido.direccion || "(sin dirección escrita)"));
    l.push("Referencia: " + (pedido.referencia || "(sin referencia)"));
    if (pedido.gps) l.push("Ubicación (del navegador): " + enlaceMapa(pedido.gps));
    l.push("");
    /* La ubicación del navegador puede fallar o ser imprecisa (sobre todo si el link
       se abrió desde adentro de WhatsApp/Instagram). Pedirla acá, como ubicación nativa
       de WhatsApp, es más confiable y no requiere que el cliente cambie de navegador. */
    l.push("📍 Para ubicarnos mejor, mandanos también tu UBICACIÓN de WhatsApp: tocá el clip 📎 (o +) y elegí \"Ubicación\".");
  }
  l.push("Observaciones: " + (pedido.observaciones || "-"));
  return l.join("\n");
}

/* ---------------------------------------------------------
   7) ACCIONES DEL NEGOCIO
   --------------------------------------------------------- */

function crearPedido(datos) {
  return storageService.actualizar(function (estado) {
    const numero = "P-" + String(estado.config.contadorPedido).padStart(4, "0");
    estado.config.contadorPedido += 1;
    const pedido = {
      id: nuevoId(),
      numero: numero,
      creado: new Date().toISOString(),
      cliente: datos.cliente,
      telefono: datos.telefono,
      items: datos.items,
      total: datos.total,
      tipoEntrega: datos.tipoEntrega,
      pago: datos.pago,
      observaciones: datos.observaciones || "",
      direccion: datos.direccion || "",
      referencia: datos.referencia || "",
      zona: datos.zona || "",
      gps: datos.gps || null,
      fechaEntrega: datos.fechaEntrega,
      estado: "nuevo",           // nuevo | confirmado | rechazado | cancelado | finalizado
      stockDescontado: false,    // evita descuentos duplicados
      cobrado: false,            // evita cobros duplicados
      fechaCobro: null,
      estadoEnvio: "sin_asignar",
      salidaId: null,
      enPuerta: !!datos.enPuerta
    };
    estado.pedidos.unshift(pedido);
    return pedido;
  });
}

function confirmarVenta(pedidoId) {
  const estado = storageService.leer();
  const p = estado.pedidos.find(function (x) { return x.id === pedidoId; });
  if (!p || p.estado !== "nuevo") return;
  const faltan = faltantesDeStock(p.items, estado);
  if (faltan.length) {
    const detalle = faltan.map(function (f) {
      return f.nombre + ": necesita " + f.necesita + ", hay " + f.hay;
    }).join(" · ");
    mostrarAviso("Falta stock — " + detalle, "error");
    return;
  }
  storageService.actualizar(function (est) {
    const ped = est.pedidos.find(function (x) { return x.id === pedidoId; });
    if (!ped || ped.estado !== "nuevo" || ped.stockDescontado) return;
    aplicarStock(ped.items, est, -1, "venta", ped);
    ped.stockDescontado = true;
    ped.estado = "confirmado";
    ped.confirmado = new Date().toISOString();
    ped.estadoEnvio = ped.tipoEntrega === "delivery" ? "sin_asignar" : "no_aplica";
  });
  mostrarAviso("Venta confirmada. Stock descontado.", "ok");
}

function rechazarPedido(pedidoId) {
  storageService.actualizar(function (est) {
    const p = est.pedidos.find(function (x) { return x.id === pedidoId; });
    if (!p || p.estado !== "nuevo") return;
    p.estado = "rechazado"; // un pedido nuevo nunca tocó el stock
  });
  mostrarAviso("Pedido rechazado.", "ok");
}

function cancelarVenta(pedidoId) {
  storageService.actualizar(function (est) {
    const p = est.pedidos.find(function (x) { return x.id === pedidoId; });
    if (!p) return;
    if (p.estado !== "confirmado" && p.estado !== "finalizado") return;
    if (p.stockDescontado) {            // devuelve el stock una sola vez
      aplicarStock(p.items, est, +1, "devolución por cancelación", p);
      p.stockDescontado = false;
    }
    if (p.cobrado) {                    // anula el cobro para que la caja no quede inflada
      est.caja.unshift({
        id: nuevoId(), pedidoId: p.id, numero: p.numero, cliente: p.cliente,
        importe: -p.total, pago: p.pago, fecha: new Date().toISOString(), tipo: "anulacion"
      });
      p.cobrado = false;
      p.fechaCobro = null;
    }
    if (p.salidaId) {                   // sale de la salida de reparto
      const s = est.salidas.find(function (x) { return x.id === p.salidaId; });
      if (s) s.pedidos = s.pedidos.filter(function (id) { return id !== p.id; });
      p.salidaId = null;
    }
    p.estadoEnvio = "sin_asignar";
    p.estado = "cancelado";
  });
  mostrarAviso("Venta cancelada. Stock devuelto.", "ok");
}

function marcarCobrado(pedidoId) {
  storageService.actualizar(function (est) {
    const p = est.pedidos.find(function (x) { return x.id === pedidoId; });
    if (!p || p.cobrado) return;                       // no se cobra dos veces
    if (p.estado !== "confirmado" && p.estado !== "finalizado") return;
    p.cobrado = true;
    p.fechaCobro = new Date().toISOString();
    est.caja.unshift({
      id: nuevoId(), pedidoId: p.id, numero: p.numero, cliente: p.cliente,
      importe: p.total, pago: p.pago, fecha: p.fechaCobro, tipo: "cobro"
    });
  });
  mostrarAviso("Cobro registrado en Caja.", "ok");
}

function registrarGasto(monto, motivo, pago) {
  storageService.actualizar(function (est) {
    est.caja.unshift({
      id: nuevoId(), pedidoId: null, numero: "", cliente: motivo,
      importe: -Math.abs(monto), pago: pago, fecha: new Date().toISOString(), tipo: "gasto"
    });
  });
  mostrarAviso("Gasto registrado en Caja.", "ok");
}

/* ---------- Apertura y cierre de caja del día ---------- */

function registroCajaDelDia(estado, fecha) {
  return (estado.cajaDiaria || []).find(function (r) { return r.fecha === fecha; }) || null;
}

function abrirCajaDelDia(fecha, monto) {
  storageService.actualizar(function (est) {
    if (!est.cajaDiaria) est.cajaDiaria = [];
    let r = est.cajaDiaria.find(function (x) { return x.fecha === fecha; });
    if (!r) {
      r = {
        id: nuevoId(), fecha: fecha, apertura: 0, fechaApertura: null,
        cerrado: false, contado: null, diferencia: null, fechaCierre: null
      };
      est.cajaDiaria.unshift(r);
    }
    r.apertura = monto;
    r.fechaApertura = new Date().toISOString();
    r.cerrado = false;
    r.contado = null;
    r.diferencia = null;
    r.fechaCierre = null;
  });
  mostrarAviso("Caja abierta con " + pesos(monto) + ".", "ok");
}

function cerrarCajaDelDia(fecha, esperado, contado) {
  storageService.actualizar(function (est) {
    if (!est.cajaDiaria) est.cajaDiaria = [];
    let r = est.cajaDiaria.find(function (x) { return x.fecha === fecha; });
    if (!r) {
      r = {
        id: nuevoId(), fecha: fecha, apertura: 0, fechaApertura: null,
        cerrado: false, contado: null, diferencia: null, fechaCierre: null
      };
      est.cajaDiaria.unshift(r);
    }
    r.contado = contado;
    r.diferencia = contado - esperado;
    r.cerrado = true;
    r.fechaCierre = new Date().toISOString();
  });
  mostrarAviso("Caja cerrada.", "ok");
}

function reabrirCajaDelDia(fecha) {
  storageService.actualizar(function (est) {
    const r = (est.cajaDiaria || []).find(function (x) { return x.fecha === fecha; });
    if (r) { r.cerrado = false; r.contado = null; r.diferencia = null; r.fechaCierre = null; }
  });
  mostrarAviso("Cierre deshecho. Podés volver a contar y cerrar.", "ok");
}

function cambiarFechaEntrega(pedidoId, fecha) {
  if (desdeYmd(fecha).getDay() === 0) {
    mostrarAviso("Los domingos no se reparte. Elegí otro día.", "error");
    return;
  }
  storageService.actualizar(function (est) {
    const p = est.pedidos.find(function (x) { return x.id === pedidoId; });
    if (p) p.fechaEntrega = fecha;
  });
  mostrarAviso("Fecha de entrega actualizada.", "ok");
}

/* ---------- Salidas de reparto ---------- */

function crearSalida(idsPedidos) {
  if (!idsPedidos.length) { mostrarAviso("Elegí al menos un pedido.", "error"); return false; }
  if (idsPedidos.length > MAX_PEDIDOS_SALIDA) {
    mostrarAviso("Una salida lleva como máximo " + MAX_PEDIDOS_SALIDA + " pedidos.", "error");
    return false;
  }
  storageService.actualizar(function (est) {
    const salida = {
      id: nuevoId(),
      numero: est.config.contadorSalida,
      fecha: hoyYmd(),
      creado: new Date().toISOString(),
      pedidos: idsPedidos.slice(),
      estado: "preparacion" // preparacion | en_reparto | finalizada
    };
    est.config.contadorSalida += 1;
    est.salidas.unshift(salida);
    idsPedidos.forEach(function (pid) {
      const p = est.pedidos.find(function (x) { return x.id === pid; });
      if (p) { p.salidaId = salida.id; p.estadoEnvio = "asignado"; }
    });
  });
  mostrarAviso("Salida creada.", "ok");
  return true;
}

function moverEnSalida(salidaId, pedidoId, delta) {
  storageService.actualizar(function (est) {
    const s = est.salidas.find(function (x) { return x.id === salidaId; });
    if (!s || s.estado === "finalizada") return;
    const i = s.pedidos.indexOf(pedidoId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= s.pedidos.length) return;
    const tmp = s.pedidos[i]; s.pedidos[i] = s.pedidos[j]; s.pedidos[j] = tmp;
  });
}

function quitarDeSalida(salidaId, pedidoId) {
  storageService.actualizar(function (est) {
    const s = est.salidas.find(function (x) { return x.id === salidaId; });
    if (!s || s.estado !== "preparacion") return;
    s.pedidos = s.pedidos.filter(function (id) { return id !== pedidoId; });
    const p = est.pedidos.find(function (x) { return x.id === pedidoId; });
    if (p) { p.salidaId = null; p.estadoEnvio = "sin_asignar"; }
  });
  mostrarAviso("Pedido quitado de la salida.", "ok");
}

function iniciarSalida(salidaId) {
  storageService.actualizar(function (est) {
    const s = est.salidas.find(function (x) { return x.id === salidaId; });
    if (!s || s.estado !== "preparacion") return;
    s.estado = "en_reparto";
    s.inicio = new Date().toISOString();
    s.pedidos.forEach(function (pid) {
      const p = est.pedidos.find(function (x) { return x.id === pid; });
      if (p) p.estadoEnvio = "en_reparto";
    });
  });
  mostrarAviso("Salida en reparto.", "ok");
}

function marcarEntregado(pedidoId, tambienCobrar) {
  storageService.actualizar(function (est) {
    const p = est.pedidos.find(function (x) { return x.id === pedidoId; });
    if (!p || p.estadoEnvio === "entregado") return;
    p.estadoEnvio = "entregado";
    p.entregado = new Date().toISOString();
    p.estado = "finalizado";
    if (tambienCobrar && !p.cobrado) {
      p.cobrado = true;
      p.fechaCobro = p.entregado;
      est.caja.unshift({
        id: nuevoId(), pedidoId: p.id, numero: p.numero, cliente: p.cliente,
        importe: p.total, pago: p.pago, fecha: p.fechaCobro, tipo: "cobro"
      });
    }
  });
  mostrarAviso(tambienCobrar ? "Entregado y cobrado." : "Pedido entregado.", "ok");
}

/* Cierra una venta de Retiro en puerta o de mostrador.
   Esas ventas no pasan por Envíos, así que sin esto quedaban
   para siempre en la lista de Confirmados. */
function marcarRetirado(pedidoId, tambienCobrar) {
  storageService.actualizar(function (est) {
    const p = est.pedidos.find(function (x) { return x.id === pedidoId; });
    if (!p || p.estado !== "confirmado") return;
    p.estado = "finalizado";
    p.entregado = new Date().toISOString();
    if (tambienCobrar && !p.cobrado) {
      p.cobrado = true;
      p.fechaCobro = p.entregado;
      est.caja.unshift({
        id: nuevoId(), pedidoId: p.id, numero: p.numero, cliente: p.cliente,
        importe: p.total, pago: p.pago, fecha: p.fechaCobro, tipo: "cobro"
      });
    }
  });
  mostrarAviso(tambienCobrar ? "Retirado y cobrado." : "Venta cerrada.", "ok");
}

function marcarNoEntregado(pedidoId) {
  storageService.actualizar(function (est) {
    const p = est.pedidos.find(function (x) { return x.id === pedidoId; });
    if (p) p.estadoEnvio = "no_entregado";
  });
  mostrarAviso("Marcado como no entregado.", "ok");
}

function finalizarSalida(salidaId) {
  storageService.actualizar(function (est) {
    const s = est.salidas.find(function (x) { return x.id === salidaId; });
    if (!s || s.estado === "finalizada") return;
    s.estado = "finalizada";
    s.fin = new Date().toISOString();
    s.pedidos.forEach(function (pid) {
      const p = est.pedidos.find(function (x) { return x.id === pid; });
      if (!p) return;
      if (p.estadoEnvio !== "entregado") {
        // Vuelve a quedar disponible para la próxima salida
        p.estadoEnvio = "no_entregado";
        p.salidaId = null;
      }
    });
    s.pedidos = s.pedidos.filter(function (pid) {
      const p = est.pedidos.find(function (x) { return x.id === pid; });
      return p && p.estadoEnvio === "entregado";
    });
  });
  mostrarAviso("Salida finalizada.", "ok");
}

/* ---------- Stock ---------- */

function ajustarStock(productoId, delta, motivo) {
  storageService.actualizar(function (est) {
    const p = producto(est, productoId);
    if (!p) return;
    const anterior = p.stock;
    p.stock = Math.max(0, p.stock + delta);
    if (p.stock === anterior) return; // no anota si no cambió nada
    anotarMovimiento(est, productoId, p.stock - anterior,
      motivo || (delta > 0 ? "ingreso a mano" : "salida a mano"));
  });
}

/* Carga de varios paquetes de una vez, con el motivo elegido. */
function registrarMovimientoManual(productoId, cantidad, motivo) {
  const n = Math.abs(Math.round(Number(cantidad) || 0));
  if (!n) { mostrarAviso("Escribí una cantidad.", "error"); return false; }
  const entra = motivo === "compra" || motivo === "ajuste suma";
  ajustarStock(productoId, entra ? n : -n, motivo);
  mostrarAviso("Movimiento registrado.", "ok");
  return true;
}

function cambiarPrecio(tipo, id, valor) {
  const numero = Math.max(0, Math.round(Number(valor) || 0));
  storageService.actualizar(function (est) {
    const lista = tipo === "combo" ? est.combos : est.productos;
    const item = lista.find(function (x) { return x.id === id; });
    if (item) item.precio = numero;
  });
  mostrarAviso("Precio actualizado.", "ok");
}

/* ---------- Comanda / impresión ---------- */

function imprimirComanda(pedidoId) {
  const area = document.getElementById("area-impresion");
  if (!area) return;
  const estado = storageService.leer();
  const p = estado.pedidos.find(function (x) { return x.id === pedidoId; });
  if (!p) return;
  const filas = p.items.map(function (it) {
    return "<tr><td class='cant'>" + it.cantidad + "</td><td>" + esc(it.nombre) +
      "</td><td class='imp'>" + pesos(it.precio * it.cantidad) + "</td></tr>";
  }).join("");
  area.innerHTML =
    "<div class='comanda'>" +
    "<h2>Heladería y Congelados</h2>" +
    "<div>Comanda " + esc(p.numero) + "</div>" +
    "<div>" + fechaHora(p.creado) + "</div>" +
    "<div class='linea'></div>" +
    "<div><strong>Cliente:</strong> " + esc(p.cliente) + "</div>" +
    "<div><strong>Teléfono:</strong> " + esc(p.telefono || "-") + "</div>" +
    "<div><strong>Entrega:</strong> " + (p.tipoEntrega === "delivery" ? "Delivery" : "Retiro en puerta") + "</div>" +
    "<div><strong>Pago:</strong> " + (p.pago === "efectivo" ? "Efectivo" : "Transferencia") + "</div>" +
    "<div><strong>Fecha estimada:</strong> " + fechaLarga(p.fechaEntrega) + ", " + HORARIO_DESDE + " a " + HORARIO_HASTA + "</div>" +
    (p.tipoEntrega === "delivery"
      ? "<div><strong>Dirección:</strong> " + esc(p.direccion || "-") + "</div>" +
        "<div><strong>Referencia:</strong> " + esc(p.referencia || "-") + "</div>"
      : "") +
    "<div class='linea'></div>" +
    "<table>" + filas + "</table>" +
    "<div class='total-c'>TOTAL: " + pesos(p.total) + "</div>" +
    "<div class='linea'></div>" +
    "<div><strong>Observaciones:</strong> " + esc(p.observaciones || "-") + "</div>" +
    "</div>";
  window.print();
}

/* ---------- Hoja de ruta del repartidor ---------- */

function imprimirHojaDeRuta(salidaId) {
  const area = document.getElementById("area-impresion");
  if (!area) return;
  const estado = storageService.leer();
  const s = estado.salidas.find(function (x) { return x.id === salidaId; });
  if (!s) return;

  const pedidos = s.pedidos.map(function (id) {
    return estado.pedidos.find(function (p) { return p.id === id; });
  }).filter(Boolean);

  // Lo que el repartidor tiene que traer de vuelta en efectivo.
  const aCobrar = pedidos.reduce(function (suma, p) {
    return suma + (p.pago === "efectivo" && !p.cobrado ? p.total : 0);
  }, 0);

  let paradas = "";
  pedidos.forEach(function (p, i) {
    const items = p.items.map(function (it) {
      return it.cantidad + " x " + esc(it.nombre);
    }).join(", ");
    paradas +=
      "<div class='parada-print'>" +
      "<div class='parada-titulo'>" + (i + 1) + ". " + esc(p.cliente) + " — " + esc(p.numero) + "</div>" +
      "<div>" + esc(p.direccion || "sin dirección escrita") + "</div>" +
      "<div><em>Ref: " + esc(p.referencia || "-") + "</em></div>" +
      "<div>" + items + "</div>" +
      "<div><strong>" + pesos(p.total) + " · " +
        (p.cobrado ? "YA COBRADO" : (p.pago === "efectivo" ? "COBRAR EFECTIVO" : "Transferencia")) +
      "</strong></div>" +
      (p.telefono ? "<div>Tel: " + esc(p.telefono) + "</div>" : "") +
      (p.observaciones ? "<div>Obs: " + esc(p.observaciones) + "</div>" : "") +
      "<div class='firma'>Entregado: ______________</div>" +
      "</div>";
  });

  area.innerHTML =
    "<div class='comanda'>" +
    "<h2>Hoja de ruta — Salida " + s.numero + "</h2>" +
    "<div>" + fechaLarga(s.fecha) + " · " + pedidos.length + " parada(s)</div>" +
    "<div class='linea'></div>" +
    paradas +
    "<div class='linea'></div>" +
    "<div class='total-c'>A cobrar en efectivo: " + pesos(aCobrar) + "</div>" +
    "</div>";
  window.print();
}

/* ---------------------------------------------------------
   8) EDICIÓN DE UN PEDIDO TODAVÍA NO CONFIRMADO
   Solo se permite mientras está en "nuevo": en ese estado
   el pedido no tocó ni el stock ni la caja, así que cambiar
   cantidades no puede descuadrar nada.
   --------------------------------------------------------- */

function actualizarItemsPedido(pedidoId, items) {
  if (!items.length) { mostrarAviso("El pedido tiene que tener al menos un producto.", "error"); return false; }
  const total = items.reduce(function (s, it) { return s + it.precio * it.cantidad; }, 0);
  let ok = false;
  storageService.actualizar(function (est) {
    const p = est.pedidos.find(function (x) { return x.id === pedidoId; });
    if (!p || p.estado !== "nuevo") return;
    p.items = items;
    p.total = total;
    p.editado = new Date().toISOString();
    ok = true;
  });
  if (ok) mostrarAviso("Pedido actualizado.", "ok");
  else mostrarAviso("Solo se puede editar un pedido nuevo.", "error");
  return ok;
}

/* ---------------------------------------------------------
   9) CLIENTES QUE REPITEN
   --------------------------------------------------------- */

function soloDigitos(txt) {
  return String(txt == null ? "" : txt).replace(/\D/g, "");
}

/* Cuántas veces compró antes este teléfono (sin contar el pedido actual). */
function historialDelCliente(estado, pedido) {
  const tel = soloDigitos(pedido.telefono);
  if (!tel) return { compras: 0, ultimo: null };
  const previos = estado.pedidos.filter(function (p) {
    return p.id !== pedido.id &&
      soloDigitos(p.telefono) === tel &&
      p.estado !== "rechazado" && p.estado !== "cancelado";
  });
  return {
    compras: previos.length,
    ultimo: previos.length ? previos[0] : null
  };
}

/* ---------------------------------------------------------
   10) COPIA DE SEGURIDAD
   Mientras no haya base de datos, esto es lo único que salva
   los datos si alguien limpia el historial del navegador.
   --------------------------------------------------------- */

function exportarDatos() {
  const estado = storageService.leer();
  const texto = JSON.stringify(estado, null, 2);
  const blob = new Blob([texto], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "heladeria-" + hoyYmd() + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  mostrarAviso("Copia descargada.", "ok");
}

function importarDatos(archivo, alTerminar) {
  const lector = new FileReader();
  lector.onload = function () {
    let datos = null;
    try { datos = JSON.parse(lector.result); }
    catch (e) { mostrarAviso("El archivo no se pudo leer.", "error"); return; }
    if (!datos || !Array.isArray(datos.productos) || !Array.isArray(datos.pedidos)) {
      mostrarAviso("Ese archivo no es una copia de la heladería.", "error");
      return;
    }
    storageService.reemplazar(datos);
    mostrarAviso("Datos restaurados.", "ok");
    if (alTerminar) alTerminar();
  };
  lector.onerror = function () { mostrarAviso("El archivo no se pudo leer.", "error"); };
  lector.readAsText(archivo);
}
