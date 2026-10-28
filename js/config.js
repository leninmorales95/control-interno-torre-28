/*
 * TORRE 28 - Configuración web / Vercel
 *
 * Esta primera base conserva el diseño actual exactamente como está.
 * El backend real de Google Sheets todavía se conecta en el siguiente paso.
 */
window.T28_WEB_CONFIG = {
  environment: "vercel",
  appName: "Torre 28",
  version: "Vercel - API",
  apiUrl: "https://script.google.com/macros/s/AKfycbwrcJIMTucvoSnJvLmAPAPQNE1A2I85c55hV1sjUy_k3y7cpqQBlZrgJ2vy2jCFVO6g/exec",
  backendReady: true,
  // Activate only after deploying and testing the authenticated receipt route.
  syncMovimientos: true,
  autoSyncMovimientos: true,
  syncSalidas: true,
  autoSyncSalidas: true,
  syncEdiciones: true,
  autoSyncEdiciones: true,
  syncEliminaciones: true,
  autoSyncEliminaciones: true
};
