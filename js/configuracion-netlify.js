/*
 * TORRE 28 - Configuración Netlify
 * Cargar DESPUÉS de app.js.
 * No contiene CSS.
 */
(function () {
  "use strict";

  function setVersionLabel() {
    const grid = document.querySelector("#menu-configuracion .t28-settings-system-grid");
    if (!grid) return;

    const cards = grid.querySelectorAll(":scope > div");
    if (cards[1]) {
      const strong = cards[1].querySelector("strong");
      if (strong) strong.textContent = "NETLIFY";
    }
  }

  function refreshSettingsPanel() {
    try {
      if (typeof actualizarControlesConfiguracionT28 === "function") {
        actualizarControlesConfiguracionT28();
      }
    } catch (e) {
      console.warn("[T28 Config] No se pudieron refrescar controles:", e);
    }

    setVersionLabel();
  }

  const toggleOriginal = window.toggleMenuConfig;
  if (typeof toggleOriginal === "function") {
    window.toggleMenuConfig = function (event) {
      toggleOriginal(event);
      setTimeout(refreshSettingsPanel, 0);
    };
  }

  window.probarAlertaConfiguracionT28 = function () {
    try {
      if (typeof cerrarMenuConfigT28 === "function") {
        cerrarMenuConfigT28();
      }

      const panel = document.getElementById("alerta-flotante-t28");
      if (!panel) {
        if (typeof mostrarToast === "function") {
          mostrarToast("La vista previa de alerta no está disponible.", "error");
        }
        return;
      }

      panel.classList.add("is-config-test");
      panel.classList.remove("hidden", "is-critical");
      panel.classList.add("is-urgent", "attention-now");

      const titulo = document.getElementById("alerta-flotante-titulo");
      const mensaje = document.getElementById("alerta-flotante-mensaje");
      const hora = document.getElementById("alerta-flotante-hora");
      const restante = document.getElementById("alerta-flotante-restante");
      const contador = document.getElementById("alerta-flotante-contador");

      if (titulo) titulo.textContent = "Alerta de prueba";
      if (mensaje) {
        mensaje.textContent =
          "Así aparecerán los recordatorios programados de Torre 28.";
      }
      if (hora) hora.textContent = "Hoy · Prueba";
      if (restante) restante.textContent = "Configuración correcta";
      if (contador) contador.classList.add("hidden");

      try {
        if (
          typeof configuracionT28 !== "undefined" &&
          configuracionT28.sonidoAlertas === true &&
          typeof reproducirSonidoAlertaT28 === "function"
        ) {
          reproducirSonidoAlertaT28(true);
        }
      } catch (e) {}

      setTimeout(function () {
        panel.classList.add("hidden");
        panel.classList.remove(
          "is-config-test",
          "is-urgent",
          "attention-now"
        );

        try {
          if (typeof evaluarAlertasT28 === "function") {
            evaluarAlertasT28();
          }
        } catch (e) {}
      }, 5000);

    } catch (err) {
      console.error("[T28 Config] Error en alerta de prueba:", err);

      if (typeof mostrarToast === "function") {
        mostrarToast("No se pudo mostrar la alerta de prueba.", "error");
      }
    }
  };

  const actualizarOriginal = window.actualizarDesdeConfiguracionT28;
  if (typeof actualizarOriginal === "function") {
    window.actualizarDesdeConfiguracionT28 = function () {
      actualizarOriginal();

      setTimeout(function () {
        try {
          if (typeof actualizarUltimaSyncConfigT28 === "function") {
            actualizarUltimaSyncConfigT28();
          }
        } catch (e) {}
      }, 1200);
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
      try {
        if (typeof leerConfiguracionT28 === "function") {
          leerConfiguracionT28();
        }

        if (typeof aplicarConfiguracionT28 === "function") {
          aplicarConfiguracionT28(true);
        }
      } catch (e) {
        console.warn("[T28 Config] No se pudieron aplicar preferencias:", e);
      }

      refreshSettingsPanel();
    }, 0);
  });
})();