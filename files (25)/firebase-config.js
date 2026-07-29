/* =========================================================
   CONFIGURACIÓN DE DATOS
   Este archivo se carga ANTES que core.js en las dos páginas.
   ========================================================= */

/* "firebase" -> Realtime Database (todos los dispositivos ven lo mismo)
   "local"    -> localStorage (cada navegador por separado, sin internet)
   Si Firebase falla al conectar, la aplicación pasa sola a "local". */
const MODO_DATOS = "firebase";

/* Rama donde vive el estado. El proyecto se usa también para otra app,
   así que todo cuelga de "heladeria" y no se mezcla con lo demás. */
const RUTA_DATOS = "heladeria/estado";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDIcapPARBLUxGj2iuDWCjRYvqYf5_V0QY",
  authDomain: "sorteito-a3b9b.firebaseapp.com",
  databaseURL: "https://sorteito-a3b9b-default-rtdb.firebaseio.com",
  projectId: "sorteito-a3b9b",
  storageBucket: "sorteito-a3b9b.firebasestorage.app",
  messagingSenderId: "665091119157",
  appId: "1:665091119157:web:6c41c98e6cf4fbf203797c"
};

/* Analytics quedó afuera a propósito: no aporta nada a la demo,
   pesa, y falla si la página se abre sin servidor. */
