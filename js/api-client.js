/*
 * TORRE 28 - Cliente API completo para Netlify
 *
 * Mantiene autenticación explícita y añade RPC genérico para que
 * las llamadas antiguas google.script.run sigan funcionando
 * desde Netlify a través del mismo Apps Script /exec.
 */
window.T28Api = (function () {
  const TOKEN_KEY = "torre28_auth_token";

  function getUrl() {
    const url = String(window.T28_WEB_CONFIG?.apiUrl || "").trim();

    if (!url || url.includes("PEGA_AQUI")) {
      throw new Error(
        "Falta configurar la URL /exec de la API en js/config.js."
      );
    }

    return url;
  }

  async function request(action, payload, options) {
    const url = getUrl();
    const opts = options || {};
    const token = opts.withoutToken
      ? ""
      : String(localStorage.getItem(TOKEN_KEY) || "");

    let response;
    try {
      response = await fetch(url, {
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
      throw new Error(
        "La conexión con Google Sheets se interrumpió. Comprueba Internet e inténtalo nuevamente."
      );
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
      err.code = data?.code || "";
      throw err;
    }

    return data;
  }

  function dispositivoActual() {
    const ua = navigator.userAgent || "";
    const tipo = /ipad|tablet|android(?!.*mobile)/i.test(ua) ? "Tablet" : (/mobile|iphone|android/i.test(ua) ? "Celular" : "PC");
    const navegador = /edg/i.test(ua) ? "Edge" : (/chrome|crios/i.test(ua) ? "Chrome" : (/firefox|fxios/i.test(ua) ? "Firefox" : (/safari/i.test(ua) ? "Safari" : "Navegador")));
    const sistema = /windows/i.test(ua) ? "Windows" : (/android/i.test(ua) ? "Android" : (/iphone|ipad|mac os/i.test(ua) ? "Apple" : (/linux/i.test(ua) ? "Linux" : "")));
    return { dispositivo: tipo + " · " + screen.width + "×" + screen.height, navegador, sistema };
  }

  return {
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
      return request("rpc", {
        method: String(method || ""),
        args: Array.isArray(args) ? args : []
      });
    }
  };
})();
