/**
 * ============================================================
 * TORRE 28 - API COMPLETA PARA NETLIFY
 *
 * Este archivo reemplaza SOLO el contenido de T28_API_NETLIFY.gs.
 * No reemplaza doGet(), T28_Auth.gs ni ningún módulo existente.
 *
 * UNA SOLA URL /exec para toda Torre 28.
 * ============================================================
 */

function doPost(e) {
  try {
    const body = t28ApiParseBody_(e);
    const action = String(body.action || '').trim();
    const payload = body.payload || {};
    const token = String(body.token || '').trim();

    // ---------------- AUTENTICACIÓN ----------------
    switch (action) {
      case 'auth.login':
        return t28ApiJson_(
          iniciarSesionT28(
            String(payload.usuario || ''),
            String(payload.pin || '')
          )
        );

      case 'auth.validar':
        return t28ApiJson_(
          validarSesionT28(
            String(payload.token || '')
          )
        );

      case 'auth.logout':
        return t28ApiJson_(
          cerrarSesionT28(
            String(payload.token || '')
          )
        );
    }

    // Todo lo demás requiere sesión válida.
    const usuarioApi = t28ApiExigirSesion_(token);

    // ---------------- INICIO ----------------
    switch (action) {
      case 'inicio.estacionamientos':
        return t28ApiOk_(obtenerDatosEstacionamientosConTipoT28());

      case 'inicio.movimientosHoy':
        return t28ApiOk_(obtenerMovimientosHoy());

      case 'inicio.catalogosIngreso':
        return t28ApiOk_(obtenerCatalogosIngresoWeb());

      case 'inicio.avisos':
        return t28ApiOk_(obtenerAvisosWebT28());

      case 'inicio.empresas':
        return t28ApiOk_(
          obtenerEmpresasWebT28(Boolean(payload.incluirLogos))
        );

      case 'admin.usuarios.listar':
        t28AuthExigirAdministradorT28_(usuarioApi);
        return t28ApiOk_(listarUsuariosPanelT28());

      case 'admin.usuarios.guardar':
        t28AuthExigirAdministradorT28_(usuarioApi);
        return t28ApiOk_(guardarUsuarioPanelT28(payload, usuarioApi));

      case 'rpc':
        return t28ApiOk_(
          t28ApiEjecutarRpc_(
            String(payload.method || ''),
            Array.isArray(payload.args) ? payload.args : []
          )
        );

      default:
        throw new Error('Acción API no válida: ' + action);
    }

  } catch (err) {
    return t28ApiJson_({
      ok: false,
      code: err && err.t28Code ? err.t28Code : '',
      error: err && err.message
        ? err.message
        : 'Error interno de Torre 28.'
    });
  }
}


/**
 * Lista cerrada de funciones que la web Netlify puede ejecutar.
 * No se permite invocar nombres arbitrarios.
 */
function t28ApiEjecutarRpc_(metodo, args) {
  switch (metodo) {

    // ===== CONFIG / AGENTE =====
    case 'obtenerCatalogosIngresoWeb':
      return obtenerCatalogosIngresoWeb.apply(null, args);

    case 'guardarEncargadoDiaWeb':
      return guardarEncargadoDiaWeb.apply(null, args);


    // ===== MOVIMIENTOS =====
    case 'validarEstacionamientoDisponibleHoyWeb':
      return validarEstacionamientoDisponibleHoyWeb.apply(null, args);

    case 'registrarMovimientoWeb':
      return registrarMovimientoWeb.apply(null, args);

    case 'actualizarMovimientoWeb':
      return actualizarMovimientoWeb.apply(null, args);

    case 'registrarSalidaMovimientoWeb':
      return registrarSalidaMovimientoWeb.apply(null, args);

    case 'eliminarMovimientoWeb':
      return eliminarMovimientoWeb.apply(null, args);

    case 'obtenerMovimientosPorRango':
      return obtenerMovimientosPorRango.apply(null, args);


    // ===== USUARIOS / VEHÍCULOS =====
    case 'actualizarEstacionamiento':
      return actualizarEstacionamiento.apply(null, args);

    case 'agregarEstacionamiento':
      return agregarEstacionamiento.apply(null, args);

    case 'agregarEstacionamientoConTipoT28':
      return agregarEstacionamientoConTipoT28.apply(null, args);

    case 'eliminarVehiculo':
      return eliminarVehiculo.apply(null, args);


    // ===== PERSONAL SIN ESTACIONAMIENTO =====
    case 'guardarPersonalSinEstacionamientoWeb':
      return guardarPersonalSinEstacionamientoWeb.apply(null, args);

    case 'eliminarPersonalSinEstacionamientoWeb':
      return eliminarPersonalSinEstacionamientoWeb.apply(null, args);


    // ===== EMPRESAS =====
    case 'obtenerEmpresasWebT28':
      return obtenerEmpresasWebT28.apply(null, args);

    case 'guardarEmpresaWebT28':
      return guardarEmpresaWebT28.apply(null, args);


    // ===== DIRECTORIO =====
    case 'obtenerDirectorioWeb':
      return obtenerDirectorioWeb.apply(null, args);

    case 'guardarDirectorioWeb':
      return guardarDirectorioWeb.apply(null, args);

    case 'eliminarDirectorioWeb':
      return eliminarDirectorioWeb.apply(null, args);


    // ===== SUMINISTROS =====
    case 'obtenerSuministrosLuz':
      return obtenerSuministrosLuz.apply(null, args);

    case 'actualizarSuministroLuz':
      return actualizarSuministroLuz.apply(null, args);


    // ===== AVISOS / ALERTAS =====
    case 'obtenerAvisosWebT28':
      return obtenerAvisosWebT28.apply(null, args);

    case 'guardarAvisoWebT28':
      return guardarAvisoWebT28.apply(null, args);

    case 'eliminarAvisoWebT28':
      return eliminarAvisoWebT28.apply(null, args);


    // ===== CARGAS GENERALES =====
    case 'obtenerDatosEstacionamientos':
      return obtenerDatosEstacionamientos.apply(null, args);

    case 'actualizarEstacionamientoConTipoT28':
      return actualizarEstacionamientoConTipoT28.apply(null, args);

    case 'obtenerMovimientosHoy':
      return obtenerMovimientosHoy.apply(null, args);

    default:
      throw new Error(
        'Función no habilitada para Netlify: ' + metodo
      );
  }
}


function t28ApiExigirSesion_(token) {
  if (!token) {
    const err = new Error('Sesión requerida.');
    err.t28Code = 'AUTH_REQUIRED';
    throw err;
  }

  const sesion = validarSesionT28(token);

  if (!sesion || !sesion.ok || !sesion.usuario) {
    const err = new Error(
      'La sesión venció. Vuelve a iniciar sesión.'
    );
    err.t28Code = 'AUTH_EXPIRED';
    throw err;
  }

  return sesion.usuario;
}


function t28ApiParseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    throw new Error('Solicitud API inválida.');
  }
}


function t28ApiOk_(data) {
  return t28ApiJson_({
    ok: true,
    data: data
  });
}


function t28ApiJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
