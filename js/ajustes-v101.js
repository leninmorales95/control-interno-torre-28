
/* ==========================================================
   TORRE 28 - AJUSTES V101
   Cargar DESPUÉS de app.js y configuracion-netlify.js
   ========================================================== */
(function () {
  "use strict";

  /* ----------------------------------------------------------
     1. BOTÓN REGISTRAR / REABRIR SALIDA
     ---------------------------------------------------------- */

  function estadoMovimientoAbiertoT28(mov) {
    if (!mov) return false;
    try {
      if (typeof normalizarTexto === "function") {
        return normalizarTexto(mov.estado || "").includes("abierto");
      }
    } catch (e) {}
    return String(mov.estado || "").toLowerCase().includes("abierto");
  }

  function tipoEstacionamientoMovimientoT28(mov) {
    if (mov && mov.tipoEstacionamiento) return mov.tipoEstacionamiento;
    return /^prestado$/i.test(String((mov && mov.estPrestado) || "").trim())
      ? "Prestado"
      : "Propio";
  }

  function horaEntradaPayloadT28(valor) {
    const v = String(valor || "").trim();
    if (!v) return "";

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
      return v.slice(0, 16);
    }

    try {
      if (typeof parseFechaDisplayALocal === "function") {
        const local = parseFechaDisplayALocal(v);
        if (local) return local;
      }
    } catch (e) {}

    return v;
  }

  function svgSalidaT28() {
    return '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';
  }

  function svgReabrirT28() {
    return '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M9 7H5v-4"/><path d="M5 7c2.1-2.7 5.1-4 8.2-3.5A8 8 0 1 1 6 16"/><path d="M12 8v5l3 2"/></svg>';
  }

  function actualizarAccionSalidaDetalleT28() {
    const btn = document.getElementById("btn-det-salida");
    if (!btn) return;

    let mov = null;
    try {
      if (typeof movimientoDetalleActual !== "undefined") {
        mov = movimientoDetalleActual;
      }
    } catch (e) {}

    if (!mov) return;

    const abierto = estadoMovimientoAbiertoT28(mov);

    btn.classList.remove("hidden");
    btn.style.setProperty("display", "flex", "important");

    if (abierto) {
      btn.classList.remove("t28-reopen-exit");
      btn.innerHTML = svgSalidaT28() + " Registrar salida";
      btn.onclick = function () {
        if (typeof abrirRegistrarSalidaMovimiento === "function") {
          abrirRegistrarSalidaMovimiento();
        }
      };
    } else {
      btn.classList.add("t28-reopen-exit");
      btn.innerHTML = svgReabrirT28() + " Reabrir salida";
      btn.onclick = abrirConfirmacionReabrirSalidaT28;
    }
  }

  const abrirDetalleOriginalT28 = window.abrirDetalleMovimiento;
  if (typeof abrirDetalleOriginalT28 === "function") {
    window.abrirDetalleMovimiento = function (filaIndex) {
      abrirDetalleOriginalT28(filaIndex);
      setTimeout(actualizarAccionSalidaDetalleT28, 0);
    };
  }

  function asegurarModalReabrirSalidaT28() {
    let modal = document.getElementById("modal-reabrir-salida-t28");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "modal-reabrir-salida-t28";
    modal.className = "hidden";
    modal.innerHTML = `
      <div class="t28-reopen-card" role="dialog" aria-modal="true" aria-labelledby="t28-reopen-title">
        <div class="t28-reopen-head">
          <div class="t28-reopen-icon">
            <svg viewBox="0 0 24 24"><path d="M9 7H5v-4"/><path d="M5 7c2.1-2.7 5.1-4 8.2-3.5A8 8 0 1 1 6 16"/><path d="M12 8v5l3 2"/></svg>
          </div>
          <h3 id="t28-reopen-title">¿Reabrir salida?</h3>
          <p>Se eliminará la hora de salida y el movimiento volverá a quedar como <b>Abierto</b>.</p>
        </div>

        <div id="t28-reopen-summary" class="t28-reopen-summary"></div>

        <div class="t28-reopen-actions">
          <button type="button" class="t28-reopen-cancel" onclick="cerrarConfirmacionReabrirSalidaT28()">Cancelar</button>
          <button id="btn-confirmar-reabrir-t28" type="button" class="t28-reopen-confirm" onclick="confirmarReabrirSalidaT28()">Sí, reabrir</button>
        </div>
      </div>`;

    modal.addEventListener("click", function (e) {
      if (e.target === modal) cerrarConfirmacionReabrirSalidaT28();
    });

    document.body.appendChild(modal);
    return modal;
  }

  window.abrirConfirmacionReabrirSalidaT28 = function () {
    let mov = null;
    try {
      if (typeof movimientoDetalleActual !== "undefined") {
        mov = movimientoDetalleActual;
      }
    } catch (e) {}

    if (!mov) return;

    const modal = asegurarModalReabrirSalidaT28();
    const resumen = document.getElementById("t28-reopen-summary");
    if (resumen) {
      const esc = typeof escapeHtml === "function"
        ? escapeHtml
        : function (x) { return String(x == null ? "" : x); };

      resumen.innerHTML =
        "<strong>" + esc(mov.placa || "---") + "</strong> · " +
        esc(mov.nombre || "Sin nombre") +
        "<br>Salida actual: <b>" + esc(mov.horaSalida || "---") + "</b>";
    }

    modal.classList.remove("hidden");
  };

  window.cerrarConfirmacionReabrirSalidaT28 = function () {
    const modal = document.getElementById("modal-reabrir-salida-t28");
    if (modal) modal.classList.add("hidden");
  };

  window.confirmarReabrirSalidaT28 = function () {
    let mov = null;
    try {
      if (typeof movimientoDetalleActual !== "undefined") {
        mov = movimientoDetalleActual;
      }
    } catch (e) {}

    if (!mov) return;

    const btn = document.getElementById("btn-confirmar-reabrir-t28");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Reabriendo...";
    }

    const payload = {
      filaIndex: mov.filaIndex,
      id: mov.id,
      placa: mov.placa || "",
      nombre: mov.nombre || "",
      tipoDocumento: mov.tipoDocumento || "",
      numeroDocumento: mov.numeroDocumento || "",
      empresa: mov.empresa || "",
      estacionamiento: mov.est || "",
      tipoIngreso: mov.tipoIngreso || "",
      observaciones: mov.observaciones || "",
      registradoPorId: mov.registradoPorId || "",
      registradoPorNombre: mov.registradoPor || "",
      tipoEstacionamiento: tipoEstacionamientoMovimientoT28(mov),
      horaEntrada: horaEntradaPayloadT28(mov.horaEntrada),
      horaSalida: "",
      acompanantes: Array.isArray(mov.acompanantes) ? mov.acompanantes : [],
      permitirEstacionamientoOcupado: false
    };

    google.script.run
      .withSuccessHandler(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Sí, reabrir";
        }

        cerrarConfirmacionReabrirSalidaT28();

        try {
          if (typeof cerrarDetalleMovimiento === "function") {
            cerrarDetalleMovimiento();
          }
        } catch (e) {}

        if (typeof mostrarToast === "function") {
          mostrarToast("Salida reabierta correctamente", "exito");
        }

        if (typeof cargarHistorialHoy === "function") {
          cargarHistorialHoy();
        } else if (typeof forzarActualizacion === "function") {
          forzarActualizacion();
        }
      })
      .withFailureHandler(function (err) {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Sí, reabrir";
        }

        let mensaje = String((err && err.message) || err || "No se pudo reabrir la salida.");

        if (mensaje.includes("ESTACIONAMIENTO_OCUPADO|")) {
          try {
            const datos = JSON.parse(mensaje.split("ESTACIONAMIENTO_OCUPADO|")[1]);
            mensaje =
              "No se puede reabrir porque el Est. " +
              (datos.est || "") +
              " ya está ocupado por " +
              (datos.nombre || "otro movimiento") +
              (datos.placa ? " · " + datos.placa : "") +
              ".";
          } catch (e) {}
        }

        if (typeof mostrarToast === "function") {
          mostrarToast(mensaje, "error");
        }
      })
      .actualizarMovimientoWeb(payload);
  };

  /* ----------------------------------------------------------
     2. FILTROS RÁPIDOS DE EMPRESAS EN USUARIOS
     ---------------------------------------------------------- */

  function obtenerEmpresasUsuariosT28() {
    const select = document.getElementById("filtro-empresa");
    if (select && select.options && select.options.length > 1) {
      return Array.from(select.options)
        .map(function (o) { return String(o.value || "").trim(); })
        .filter(Boolean);
    }

    try {
      if (typeof todosLosDatos !== "undefined" && Array.isArray(todosLosDatos)) {
        return Array.from(
          new Set(
            todosLosDatos
              .map(function (x) { return String((x && x.empresa) || "").trim(); })
              .filter(Boolean)
          )
        ).sort(function (a, b) { return a.localeCompare(b, "es"); });
      }
    } catch (e) {}

    return [];
  }

  function actualizarActivoChipsEmpresaT28() {
    const select = document.getElementById("filtro-empresa");
    const actual = select ? String(select.value || "") : "";

    document.querySelectorAll("#usuarios-empresa-chips .usuarios-empresa-chip")
      .forEach(function (btn) {
        btn.classList.toggle("is-active", String(btn.dataset.empresa || "") === actual);
      });
  }

  window.filtrarEmpresaRapidaUsuariosT28 = function (empresa) {
    const select = document.getElementById("filtro-empresa");
    if (!select) return;

    select.value = empresa || "";

    if (typeof filtrarDatos === "function") {
      filtrarDatos();
    }

    actualizarActivoChipsEmpresaT28();
  };

  window.renderFiltrosEmpresasUsuariosT28 = function () {
    const vista = document.getElementById("usuarios-vista-asignaciones");
    const controles = document.getElementById("usuarios-asignaciones-controles");
    if (!vista || !controles) return;

    let barra = document.getElementById("usuarios-empresa-chips");
    if (!barra) {
      barra = document.createElement("div");
      barra.id = "usuarios-empresa-chips";
      barra.setAttribute("aria-label", "Filtro rápido por empresa");
      vista.insertBefore(barra, controles);
    }

    const empresas = obtenerEmpresasUsuariosT28();
    barra.innerHTML = "";

    function crearChip(nombre, esTodas) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "usuarios-empresa-chip" + (esTodas ? " is-all" : "");
      btn.dataset.empresa = esTodas ? "" : nombre;
      btn.textContent = esTodas ? "Todas" : nombre;

      if (!esTodas) {
        try {
          if (typeof obtenerEstiloEmpresa === "function") {
            const estilo = obtenerEstiloEmpresa(nombre) || {};
            if (estilo.bg) btn.className += " " + estilo.bg;
            if (estilo.text) btn.className += " " + estilo.text;
          }
        } catch (e) {}
      }

      btn.addEventListener("click", function () {
        filtrarEmpresaRapidaUsuariosT28(btn.dataset.empresa || "");
      });

      barra.appendChild(btn);
    }

    crearChip("", true);
    empresas.forEach(function (empresa) {
      crearChip(empresa, false);
    });

    actualizarActivoChipsEmpresaT28();
  };

  function iniciarFiltrosEmpresaUsuariosT28() {
    const select = document.getElementById("filtro-empresa");
    if (!select) {
      setTimeout(iniciarFiltrosEmpresaUsuariosT28, 500);
      return;
    }

    renderFiltrosEmpresasUsuariosT28();

    select.addEventListener("change", actualizarActivoChipsEmpresaT28);

    const obs = new MutationObserver(function () {
      renderFiltrosEmpresasUsuariosT28();
    });

    obs.observe(select, { childList: true });
  }

  /* ----------------------------------------------------------
     3. ESC CIERRA CONFIRMACIÓN DE REAPERTURA
     ---------------------------------------------------------- */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    const modal = document.getElementById("modal-reabrir-salida-t28");
    if (modal && !modal.classList.contains("hidden")) {
      cerrarConfirmacionReabrirSalidaT28();
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(iniciarFiltrosEmpresaUsuariosT28, 350);
  });

})();
