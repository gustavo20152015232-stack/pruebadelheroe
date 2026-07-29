# Heladería y Congelados — demostración local

Demo funcional de un sistema de pedidos, ventas, envíos, stock y caja para una heladería y distribuidora de congelados.

Hecha con **HTML + CSS + JavaScript puro**. Sin backend, sin Firebase, sin React, sin npm y sin proceso de compilación.

## Dos páginas separadas

| Archivo | Quién lo usa | Qué ve |
|---|---|---|
| `index.html` | **El cliente** | Solo la página de pedidos |
| `panel.html` | **El negocio** | Ventas, Envíos, Stock y Caja |

La página del cliente **no tiene ninguna forma de llegar al panel**: no hay navegación, ni links, ni rutas ocultas. Son dos direcciones distintas.

Comparten los datos porque están en el mismo origen (mismo host y puerto): el pedido que entra por `index.html` aparece al instante en `panel.html`.

> **MODO DEMO LOCAL.** `panel.html` todavía no tiene usuarios ni contraseñas: cualquiera que conozca la dirección entra. **No pases ese link a clientes.** Cuando el sistema salga a producción hay que ponerle login de verdad. `localStorage` sirve para probar el circuito, pero no es un almacenamiento adecuado para la versión final. No cargues datos reales de clientes mientras probás.

---

## 1. Cómo abrirlo con Live Server

1. Abrí la carpeta del proyecto en Visual Studio Code.
2. Instalá la extensión **Live Server** (Ritwick Dey).
3. Clic derecho sobre `index.html` → **Open with Live Server**.
4. Se abre algo como `http://127.0.0.1:5500/index.html` (el cliente).
5. Para el panel, cambiá el final de la dirección por `panel.html`.

Alternativas sin VS Code, parada sobre la carpeta:

```bash
python3 -m http.server 5500      # luego http://localhost:5500
npx serve .                       # si tenés Node instalado
```

No abras los archivos con doble clic (`file://`): conviene un servidor local para que `navigator.geolocation` funcione bien.

Para subirlo a Netlify más adelante: arrastrá la carpeta completa a Netlify Drop, o conectá el repositorio sin comando de build y con la carpeta raíz como directorio de publicación. El cliente entra a `tusitio.netlify.app` y el negocio a `tusitio.netlify.app/panel.html`.

---

## 2. Cómo probar cada módulo

**Página del cliente (`index.html`)** — elegí productos y combos con los botones grandes, completá nombre y teléfono, elegí Delivery o Retiro y la forma de pago. En Delivery podés usar *Usar mi ubicación* o escribir dirección y referencia. Antes de confirmar se muestra la fecha estimada. Después de confirmar aparece el botón *Enviar pedido por WhatsApp*.

**Panel (`panel.html`)** — la navegación superior cambia de módulo:

| Ruta | Módulo | Para qué sirve |
|---|---|---|
| `panel.html#/ventas` | Ventas | Llegan los pedidos, se confirman o rechazan |
| `panel.html#/envios` | Envíos | Se arman las salidas de reparto |
| `panel.html#/stock` | Stock | Paquetes disponibles y precios |
| `panel.html#/caja` | Caja | Lo cobrado en el día |

- **Ventas:** los pedidos se agrupan por estado. Al confirmar se controla el stock, se descuenta una sola vez y, si es Delivery, el pedido pasa a Envíos. *Cargar venta en puerta* crea una venta presencial que descuenta stock, se marca cobrada e imprime la comanda, sin pasar por Envíos.
- **Envíos:** elegí entre 1 y 4 pedidos y tocá *Crear salida*. Ordenalos con Subir y Bajar, marcá *En reparto*, y después *Entregado* o *Entregado y cobrado*. *Abrir recorrido en Google Maps* respeta el orden manual (no optimiza nada ni usa API).
- **Stock:** sumá o quitá paquetes, cambiá precios y mirá cuántos combos se pueden armar. Avisa cuando quedan menos de 3 paquetes.
- **Caja:** el dinero entra solamente al usar *Marcar como cobrado* o *Entregado y cobrado*.

---

## 3. Abrir el cliente y el panel en pestañas separadas

Copiá la dirección que te dio Live Server y abrí tres pestañas:

```
http://127.0.0.1:5500/index.html
http://127.0.0.1:5500/panel.html#/ventas
http://127.0.0.1:5500/panel.html#/envios
```

Todas tienen que estar en el **mismo origen**. Si una está en `127.0.0.1` y otra en `localhost`, el navegador las trata como sitios distintos y no comparten datos. Es la causa más común de que parezca que no sincroniza.

---

## 4. Cómo verificar la sincronización

1. Poné `index.html` y `panel.html#/ventas` lado a lado.
2. Confirmá un pedido en la página del cliente.
3. En Ventas aparece en **Nuevos** sin recargar nada.
4. Confirmalo y mirá Stock en otra pestaña: los paquetes bajan solos.
5. En Envíos el pedido aparece en *Pedidos de hoy sin salida*.
6. Cambiá un precio en Stock y mirá la página del cliente: el precio nuevo aparece solo.

Funciona con `BroadcastChannel` y, como respaldo, con el evento `storage` del navegador. Los mensajes llevan el identificador de la pestaña que los emitió para que nadie reaccione a sus propios cambios y no se generen bucles.

---

## 5. Dónde cambiar cada cosa

Todo está al principio de `core.js`, en la sección **1) CONSTANTES CONFIGURABLES**:

| Qué | Constante |
|---|---|
| Número de WhatsApp | `WHATSAPP_NUMBER` |
| Hora de corte del reparto | `HORA_CORTE` (11) |
| Horario estimado de entrega | `HORARIO_DESDE`, `HORARIO_HASTA` |
| Stock inicial por producto | `STOCK_INICIAL` |
| Aviso de stock bajo | `AVISO_STOCK_BAJO` |
| Pedidos por salida | `MAX_PEDIDOS_SALIDA` |
| Zonas de reparto | `ZONAS` |
| Productos y precios | `PRODUCTOS_BASE` |
| Combos, precios y descuento de stock | `COMBOS_BASE` |

Los precios también se editan desde **Stock** sin tocar el código. Después de cambiar `PRODUCTOS_BASE` o `COMBOS_BASE` usá *Restablecer demo* para que el estado guardado tome el catálogo nuevo.

---

## Clientes que repiten

La página del cliente recuerda sus datos **en su propio dispositivo**, en una clave aparte (`heladeria_demo_cliente`). Al volver a entrar ve un saludo, el formulario ya cargado y un botón para pedir lo mismo que la vez pasada (saltea lo que quedó sin stock). El botón *No soy yo* borra esos datos.

En el panel, un pedido cuyo teléfono ya compró antes muestra la chapa **cliente habitual**. La comparación usa solo los dígitos, así que `362-499-9888` y `3624999888` son el mismo cliente.

---

## Copia de seguridad

En Stock hay *Descargar copia* y *Restaurar desde archivo*. La copia es un `.json` con todo el estado. Mientras no haya base de datos es lo único que salva los datos si alguien limpia el historial del navegador.

---

## Realtime Database

El estado vive en `heladeria/estado` dentro del proyecto Firebase. Todo lo que hay que tocar está en **`firebase-config.js`**:

```js
const MODO_DATOS = "firebase";        // o "local" para volver a localStorage
const RUTA_DATOS = "heladeria/estado";
```

Si Firebase no carga, las reglas rechazan la lectura o no hay internet, la aplicación **pasa sola a modo local** y avisa. La chapa arriba a la derecha dice en todo momento dónde están los datos: *En línea*, *Sin conexión* o *Solo este navegador*.

El SDK entra por CDN en su versión **compat**, porque los `import` del snippet oficial necesitan npm y un empaquetador, que este proyecto no tiene. Para actualizarlo, cambiá el número de versión en las dos etiquetas `<script>` de `index.html` y `panel.html`.

### Reglas de seguridad (esto hay que hacerlo sí o sí)

En la consola de Firebase → Realtime Database → Reglas. Para la prueba:

```json
{
  "rules": {
    "heladeria": { ".read": true, ".write": true }
  }
}
```

**Esto deja la rama abierta a cualquiera que vea el código de la página.** La clave de API no es un secreto (es un identificador público y está bien que se vea), pero las reglas sí deciden quién entra. Con estas reglas, cualquiera puede leer los pedidos y los teléfonos de los clientes. Sirve para probar; **no cargues datos reales de clientes hasta cerrar esto**.

El paso siguiente es partir la rama en tres, para que el cliente no pueda leer lo que no le corresponde:

| Rama | Cliente | Panel |
|---|---|---|
| `catalogo` (productos y precios) | lee | lee y escribe |
| `pedidos_entrantes` | solo escribe | lee y escribe |
| `estado` (ventas, caja, stock) | sin acceso | lee y escribe |

Con eso, el panel necesita login real y la página pública sigue sin necesitarlo.

### Un detalle sobre escrituras simultáneas

Cada cambio guarda el estado completo. Si dos dispositivos tocan algo en el mismo segundo, gana el último y el otro cambio se pierde. Para un negocio con una o dos pantallas abiertas no molesta, pero cuando sean más conviene pasar el descuento de stock a `transaction()`.

---

## Regla de la fecha de entrega

- Antes de las 11:00 → reparto de **hoy**.
- Desde las 11:00 → **próximo día de trabajo**.
- Se reparte de lunes a sábado; los domingos nunca.
- Sábado después de las 11:00 y todo el domingo → **lunes**.
- Se usa la hora local del dispositivo y la fecha puede cambiarse a mano desde Ventas.

Horario estimado: de 9:00 a 13:30 aproximadamente, con aviso de que puede extenderse.

---

## Combos y stock

Los combos no tienen stock propio. Su disponibilidad sale de los componentes:

- **Combo Premium** descuenta 2 Oreo x10, 2 Split x10, 2 Pico Dulce x10 y 2 Bombón x10.
- **Combo Emprendedor** descuenta 1 Fruta x40, 1 Crema x40, 1 Oreo x10, 1 Split x10, 1 Bombón x10 y 1 Pico Dulce x10.

Reglas de stock y caja:

- Un pedido nuevo no modifica stock ni caja.
- Confirmar descuenta stock una sola vez (la bandera `stockDescontado` lo impide dos veces).
- Cancelar una venta confirmada devuelve el stock una sola vez.
- Rechazar un pedido nuevo no modifica stock.
- Una venta no puede cobrarse dos veces (bandera `cobrado`).
- Si se cancela una venta ya cobrada, se registra una anulación para que el total del día no quede inflado.

---

## Circuito de prueba recomendado

1. Creá un pedido desde `index.html`.
2. Miralo aparecer en `panel.html#/ventas` sin recargar.
3. Confirmalo.
4. Verificá en Stock que bajaron los paquetes.
5. Miralo en Envíos, en *Pedidos de hoy sin salida*.
6. Elegilo y creá una salida.
7. Marcá *En reparto* y después *Entregado y cobrado*.
8. Mirá el importe en Caja.
9. Creá y confirmá otro pedido, y cancelalo desde Ventas.
10. Verificá en Stock que el stock volvió a su valor anterior.

---

## Cambiar `localStorage` por Firebase más adelante

Toda la persistencia pasa por el objeto **`storageService`** en `core.js`, con cuatro operaciones:

```js
storageService.iniciar(cb)     // conecta y llama a cb con el primer dato
storageService.leer()          // devuelve el estado completo
storageService.actualizar(fn)  // modifica el estado y lo propaga
storageService.suscribir(fn)   // ejecuta fn cuando el estado cambia
storageService.restablecer()   // vuelve a los datos de demostración
storageService.reemplazar(x)   // pisa todo con una copia importada
```

Ni `pedido.js` ni `panel.js` tocan `localStorage`. Para migrar alcanza con reescribir esas cuatro funciones contra Firestore (por ejemplo, `suscribir` sobre un `onSnapshot`) sin cambiar las vistas.

El estado guardado está versionado (`version`) bajo la clave `heladeria_demo_estado` y contiene: `productos`, `combos`, `pedidos`, `salidas`, `caja` y `config`.

---

## Archivos

```
index.html         página pública del cliente
panel.html         panel interno del negocio
firebase-config.js configuración y modo de datos
core.js            storageService, constantes y reglas de negocio (compartido)
pedido.js          vista del cliente
panel.js           vistas de ventas, envíos, stock y caja
styles.css         estilos mobile-first y estilos de impresión de la comanda
README.md          este archivo
```

`core.js` es el único archivo que cargan las dos páginas: las reglas de stock, caja y fechas viven en un solo lugar.
