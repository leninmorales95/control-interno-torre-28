/*
 * TORRE 28 - Cliente API web
 *
 * Mantiene autenticación explícita y añade RPC genérico para que
 * las llamadas antiguas google.script.run sigan funcionando
 * desde el sitio web a través del mismo Apps Script /exec.
 */
window.T28Api = (function () {
  const TOKEN_KEY = "torre28_auth_token";
  const pendingReads = new Map();
  const WRITE_METHODS = new Set([
    'guardarEncargadoDiaWeb', 'registrarMovimientoWeb', 'actualizarMovimientoWeb',
    'registrarSalidaMovimientoWeb', 'eliminarMovimientoWeb', 'actualizarEstacionamiento',
    'actualizarEstacionamientoConTipoT28', 'agregarEstacionamiento', 'agregarEstacionamientoConTipoT28',
    'eliminarVehiculo', 'guardarPersonalSinEstacionamientoWeb', 'eliminarPersonalSinEstacionamientoWeb',
    'guardarEmpresaWebT28', 'guardarDirectorioWeb', 'guardarDirectorioFotoWebT28',
    'eliminarDirectorioWeb', 'guardarPersonaDirectorioWebT28', 'eliminarPersonaDirectorioWebT28',
    'actualizarSuministroLuz', 'guardarAvisoWebT28', 'eliminarAvisoWebT28'
  ]);

  function isRead(action, payload) {
    return action.startsWith('inicio.') || action.endsWith('.listar') ||
      (action === 'rpc' && /^(obtener|validarEstacionamiento)/.test(payload?.method || ''));
  }

  function request(action, payload, options) {
    if (!isRead(action, payload)) return send(action, payload, options);
    // Never merge across sessions or endpoints. Only concurrent reads share a
    // response; later calls always request fresh data, including AppSheet edits.
    const key = JSON.stringify([getUrl(), localStorage.getItem(TOKEN_KEY), action, payload]);
    if (!pendingReads.has(key)) {
      const task = send(action, payload, options).finally(() => pendingReads.delete(key));
      pendingReads.set(key, task);
    }
    return pendingReads.get(key);
  }

  function getUrl() {
    const url = String(window.T28_WEB_CONFIG?.apiUrl || "").trim();

    if (!url || url.includes("PEGA_AQUI")) {
      throw new Error(
        "Falta configurar la URL /exec de la API en js/config.js."
      );
    }

    return url;
  }

  async function send(action, payload, options) {
    const url = getUrl();
    const opts = options || {};
    const token = opts.withoutToken
      ? ""
      : String(localStorage.getItem(TOKEN_KEY) || "");

    const isSyncWrite = ['sync.movimientos.crear','sync.movimientos.salida','sync.movimientos.editar','sync.movimientos.eliminar'].includes(action);
    const isWrite = isSyncWrite || (action === 'rpc' && WRITE_METHODS.has(payload?.method));
    let operation;
    if (isWrite) {
      try {
        if (!window.T28Local) throw new Error('Almacenamiento local no disponible.');
        if (opts.operation) {
          operation = await window.T28Local.getOperation(opts.operation.id);
          if (!operation || operation.method !== action ||
              operation.status === 'reviewed') throw new Error('Operación no disponible en esta sesión.');
          payload = { operationId:operation.id, datos:operation.args[0] };
        } else {
          operation = await window.T28Local.begin(isSyncWrite ? action : payload.method,
            isSyncWrite ? [payload.datos] : payload.args);
          if (isSyncWrite) payload = { operationId:operation.id, datos:operation.args[0] };
        }
      } catch (_) {
        const error = new Error('No se pudo conservar el registro en este equipo. Libera espacio o habilita el almacenamiento del navegador e inténtalo de nuevo.');
        error.code = 'LOCAL_STORAGE_FAILED';
        throw error;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let dispatched = false;
    try {
    let response;
    try {
      if (!opts.withoutToken && (String(localStorage.getItem(TOKEN_KEY) || '') !== token || getUrl() !== url)) {
        const changed = new Error('La sesión o el servidor cambió durante el guardado. El registro permanece en este equipo.');
        changed.code = 'SESSION_CHANGED';
        throw changed;
      }
      if (navigator.onLine === false) {
        const offline = new Error('Sin conexión. El registro se conserva en este equipo para revisión.');
        offline.code = 'OFFLINE';
        throw offline;
      }
      dispatched = true;
      response = await fetch(url, {
        signal: controller.signal,
        method: "POST",
        redirect: "follow",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: action,
          token: token,
          payload: payload || {}
        })
      });
    } catch (error) {
      if (['OFFLINE','SESSION_CHANGED'].includes(error.code)) throw error;
      const interrupted = new Error(
        "La conexión con Google Sheets se interrumpió. Comprueba Internet e inténtalo nuevamente."
      );
      interrupted.code = 'NETWORK_ERROR';
      throw interrupted;
    }

    if (!response.ok) {
      throw new Error("No se pudo comunicar con el servidor de Torre 28.");
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      throw new Error(
        "La API respondió en un formato no válido. Revisa la implementación /exec."
      );
    }

    if (!data || data.ok === false) {
      const err = new Error(data?.error || "Ocurrió un error en Torre 28.");
      err.code = data?.code || (action === 'auth.validar' && data?.ok === false && !data?.error ? 'AUTH_INVALID' : '');
      throw err;
    }

    if (isWrite && (data?.data?.success === false || data?.data?.ok === false)) {
      const error = new Error(data.data.message || data.data.error || 'El servidor rechazó el guardado.');
      error.code = 'SERVER_REJECTED';
      error.confirmedRejected = true;
      throw error;
    }

    const expectedRecordId = isSyncWrite && action !== 'sync.movimientos.crear'
      ? String(operation.args?.[0]?.id || '') : '';
    if (isSyncWrite && (data?.data?.success !== true ||
        data.data.operationId !== operation.id || !data.data.id ||
        (action !== 'sync.movimientos.crear' && (!expectedRecordId || String(data.data.id) !== expectedRecordId)))) {
      const error = new Error('El servidor no confirmó el intento y el movimiento esperado. Se conserva para revisión.');
      error.code = 'INVALID_RECEIPT';
      throw error;
    }

    if (operation) {
      // A local cleanup failure must not turn a confirmed remote write into a
      // failed save. Its journal entry remains available for manual review.
      try { await window.T28Local.finish(operation); } catch (_) {}
      if (String(localStorage.getItem(TOKEN_KEY) || '') === token && window.dispatchEvent) {
        const method = {'sync.movimientos.crear':'registrarMovimientoWeb','sync.movimientos.salida':'registrarSalidaMovimientoWeb','sync.movimientos.editar':'actualizarMovimientoWeb','sync.movimientos.eliminar':'eliminarMovimientoWeb'}[action] || payload.method;
        window.dispatchEvent(new CustomEvent('t28-write-confirmed', { detail: { method } }));
      }
    }
    return data;
    } catch (error) {
      error.uncertain = dispatched && !error.confirmedRejected &&
        !['AUTH_REQUIRED', 'AUTH_EXPIRED', 'PERMISSION_DENIED', 'CONFLICT', 'SERVER_REJECTED'].includes(error.code);
      if (operation) {
        try { await window.T28Local.finish(operation, error); } catch (_) {}
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function dispositivoActual() {
    const ua = navigator.userAgent || "";
    const tipo = /ipad|tablet|android(?!.*mobile)/i.test(ua) ? "Tablet" : (/mobile|iphone|android/i.test(ua) ? "Celular" : "PC");
    const navegador = /edg/i.test(ua) ? "Edge" : (/chrome|crios/i.test(ua) ? "Chrome" : (/firefox|fxios/i.test(ua) ? "Firefox" : (/safari/i.test(ua) ? "Safari" : "Navegador")));
    const sistema = /windows/i.test(ua) ? "Windows" : (/android/i.test(ua) ? "Android" : (/iphone|ipad|mac os/i.test(ua) ? "Apple" : (/linux/i.test(ua) ? "Linux" : "")));
    return { dispositivo: tipo + " · " + screen.width + "×" + screen.height, navegador, sistema };
  }

  return {
    syncCapabilities() {
      return request('sync.capabilities');
    },
    crearMovimientoSeguro(datos) {
      return request('sync.movimientos.crear', { datos });
    },
    reintentarMovimientoSeguro(id) {
      // No fallback to the legacy append endpoint: unknown replies must reuse
      // precisely the durable ID and payload already stored on this device.
      return request('sync.movimientos.crear', {}, { operation: { id } });
    },
    salidaMovimientoSeguro(datos) {
      return request('sync.movimientos.salida', { datos });
    },
    eliminarMovimientoSeguro(datos) {
      return request('sync.movimientos.eliminar', { datos });
    },
    reintentarEliminacionSegura(id) {
      return request('sync.movimientos.eliminar', {}, { operation:{ id } });
    },
    reintentarSalidaSegura(id) {
      return request('sync.movimientos.salida', {}, { operation:{ id } });
    },
    editarMovimientoSeguro(datos) {
      return request('sync.movimientos.editar', { datos });
    },
    reintentarEdicionSegura(id) {
      return request('sync.movimientos.editar', {}, { operation:{ id } });
    },
    login(usuario, pin) {
      return request(
        "auth.login",
        { usuario, pin, dispositivo: dispositivoActual() },
        { withoutToken: true }
      );
    },

    validarSesion(token) {
      return request(
        "auth.validar",
        { token },
        { withoutToken: true }
      );
    },

    cerrarSesion(token) {
      return request(
        "auth.logout",
        { token },
        { withoutToken: true }
      );
    },

    listarUsuariosAdmin() {
      return request("admin.usuarios.listar");
    },

    guardarUsuarioAdmin(datos) {
      return request("admin.usuarios.guardar", datos || {});
    },

    listarSesionesAdmin() {
      return request("admin.sesiones.listar");
    },

    revocarSesionAdmin(sesionId) {
      return request("admin.sesiones.revocar", { sesionId });
    },

    revocarSesionesUsuarioAdmin(usuarioId) {
      return request("admin.sesiones.revocarUsuario", { usuarioId });
    },

    estacionamientos() {
      return request("inicio.estacionamientos");
    },

    depositos() {
      return request("inicio.depositos");
    },

    movimientosHoy() {
      return request("inicio.movimientosHoy");
    },

    catalogosIngreso() {
      return request("inicio.catalogosIngreso");
    },

    avisos() {
      return request("inicio.avisos");
    },

    empresas(incluirLogos) {
      return request("inicio.empresas", {
        incluirLogos: Boolean(incluirLogos)
      });
    },

    /*
     * Puente para todas las funciones restantes del sistema.
     * Devuelve {ok:true, data:<resultado de Apps Script>}.
     */
    rpc(method, args) {
      if (method === 'eliminarMovimientoWeb' && window.T28_WEB_CONFIG?.syncEliminaciones === true) {
        return request('sync.movimientos.eliminar', { datos:args?.[0] });
      }
      if (method === 'actualizarMovimientoWeb' && window.T28_WEB_CONFIG?.syncEdiciones === true) {
        return request('sync.movimientos.editar', { datos:args?.[0] });
      }
      if (method === 'registrarSalidaMovimientoWeb' && window.T28_WEB_CONFIG?.syncSalidas === true) {
        return request('sync.movimientos.salida', { datos:args?.[0] });
      }
      // Existing form callbacks remain unchanged. Safe mode never falls back to
      // legacy append, even when the server route is unavailable or times out.
      if (method === 'registrarMovimientoWeb' && window.T28_WEB_CONFIG?.syncMovimientos === true) {
        return request('sync.movimientos.crear', { datos:args?.[0] });
      }
      return request("rpc", {
        method: String(method || ""),
        args: Array.isArray(args) ? args : []
      });
    }
  };
})();
