/**
 * ============================================================
 * TORRE 28 - API COMPLETA PARA NETLIFY + ROUTER TELEGRAM
 *
 * Este archivo reemplaza SOLO el contenido de T28_API_NETLIFY.gs.
 * No reemplaza doGet(), T28_Auth.gs ni ningún módulo existente.
 *
 * UNA SOLA URL /exec y un único doPost para Netlify + Telegram.
 * ============================================================
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
    }
    const body = JSON.parse(e.postData.contents);
    if (body.update_id !== undefined || body.message || body.callback_query) {
      if (typeof procesarTelegram_ === 'function') return procesarTelegram_(body);
      return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
    }
    return t28ApiProcesarPost_(body);
  } catch (err) {
    return t28ApiJson_({ok:false,code:err&&err.t28Code?err.t28Code:'',error:err&&err.message?err.message:'Error interno de Torre 28.'});
  }
}

function t28ApiProcesarPost_(body) {
  try {
    body = body || {};
    const action = String(body.action || '').trim();
    const payload = body.payload || {};
    const token = String(body.token || '').trim();

    // ---------------- AUTENTICACIÓN ----------------
    switch (action) {
      case 'auth.login':
        return t28ApiJson_(
          iniciarSesionT28(
            String(payload.usuario || ''),
            String(payload.pin || ''),
            payload.dispositivo || {}
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
      case 'sync.capabilities':
      case 'sync.movimientos.crear':
      case 'sync.movimientos.salida':
      case 'sync.movimientos.editar':
      case 'sync.movimientos.eliminar':
        return t28ApiOk_(t28ApiSync_(action, payload, usuarioApi));

      case 'inicio.estacionamientos':
      
        return t28ApiOk_(obtenerDatosEstacionamientosConTipoT28());

      case 'inicio.depositos':
        return t28ApiOk_(obtenerDepositosPlanoT28());

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

      case 'admin.sesiones.listar':
        t28AuthExigirAdministradorT28_(usuarioApi);
        return t28ApiOk_(listarSesionesPanelT28());

      case 'admin.sesiones.revocar':
        t28AuthExigirAdministradorT28_(usuarioApi);
        return t28ApiOk_(revocarSesionPanelT28(String(payload.sesionId || '')));

      case 'admin.sesiones.revocarUsuario':
        t28AuthExigirAdministradorT28_(usuarioApi);
        return t28ApiOk_(revocarSesionesUsuarioPanelT28(String(payload.usuarioId || '')));

      case 'rpc':
        t28ApiExigirPermisoRpc_(usuarioApi, String(payload.method || ''));
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

// Private adapter. The HTTP router above always validates the session first.
// Kept outside RPC allowlist; integration tests can exercise authorization
// without creating test credentials or changing the real session validator.
function t28ApiSync_(action, payload, usuario) {
  if (!usuario || !(usuario.id || usuario.usuario)) {
    const error = new Error('Sesión requerida.');
    error.t28Code = 'AUTH_REQUIRED';
    throw error;
  }
  if (action === 'sync.capabilities') return { protocol:1, methods:['movimientos.crear','movimientos.salida','movimientos.editar','movimientos.eliminar'] };
  if (action === 'sync.movimientos.eliminar') {
    t28ApiExigirPermiso_(usuario, 'eliminar');
    return t28SyncEliminarMovimiento_(payload, usuario);
  }
  if (action === 'sync.movimientos.editar') {
    t28ApiExigirPermiso_(usuario, 'editar');
    return t28SyncEditarMovimiento_(payload, usuario);
  }
  if (action === 'sync.movimientos.salida') {
    t28ApiExigirPermiso_(usuario, 'editar');
    return t28SyncSalidaMovimiento_(payload, usuario);
  }
  if (action !== 'sync.movimientos.crear') throw new Error('Acción de sincronización no válida.');
  t28ApiExigirPermiso_(usuario, 'crear');
  return t28SyncCrearMovimiento_(payload, usuario);
}

function t28ApiTienePermiso_(usuario, permiso) {
  const rol = t28AuthNorm_(usuario && usuario.rol);
  if (rol === 'administrador' || rol === 'admin') return true;
  const permisos = Array.isArray(usuario && usuario.permisos) ? usuario.permisos : t28PermisosPorRol_(usuario && usuario.rol);
  return permisos.map(t28AuthNorm_).indexOf(t28AuthNorm_(permiso)) >= 0;
}

function t28ApiExigirPermiso_(usuario, permiso) {
  if (t28ApiTienePermiso_(usuario, permiso)) return;
  const err = new Error('Tu cuenta no tiene permiso para realizar esta acción.');
  err.t28Code = 'PERMISSION_DENIED';
  throw err;
}

function t28ApiExigirPermisoRpc_(usuario, metodo) {
  const crear = ['registrarMovimientoWeb','agregarEstacionamiento','agregarEstacionamientoConTipoT28','guardarPersonalSinEstacionamientoWeb','guardarEmpresaWebT28','guardarDirectorioWeb','guardarDirectorioFotoWebT28','guardarPersonaDirectorioWebT28','guardarAvisoWebT28'];
  const editar = ['actualizarMovimientoWeb','registrarSalidaMovimientoWeb','actualizarEstacionamiento','actualizarEstacionamientoConTipoT28','actualizarSuministroLuz','guardarEncargadoDiaWeb'];
  const eliminar = ['eliminarMovimientoWeb','eliminarVehiculo','eliminarPersonalSinEstacionamientoWeb','eliminarDirectorioWeb','eliminarPersonaDirectorioWebT28','eliminarAvisoWebT28'];
  if (crear.indexOf(metodo) >= 0) return t28ApiExigirPermiso_(usuario, 'crear');
  if (editar.indexOf(metodo) >= 0) return t28ApiExigirPermiso_(usuario, 'editar');
  if (eliminar.indexOf(metodo) >= 0) return t28ApiExigirPermiso_(usuario, 'eliminar');
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

    case 'obtenerDirectorioFotosWebT28':
      return obtenerDirectorioFotosWebT28.apply(null, args);

    case 'guardarDirectorioWeb':
      return guardarDirectorioWeb.apply(null, args);

    case 'guardarDirectorioFotoWebT28':
      return guardarDirectorioFotoWebT28.apply(null, args);

    case 'eliminarDirectorioWeb':
      return eliminarDirectorioWeb.apply(null, args);

    case 'obtenerPersonasDirectorioWebT28':
      return obtenerPersonasDirectorioWebT28.apply(null, args);

    case 'guardarPersonaDirectorioWebT28':
      return guardarPersonaDirectorioWebT28.apply(null, args);

    case 'eliminarPersonaDirectorioWebT28':
      return eliminarPersonaDirectorioWebT28.apply(null, args);


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

    case 'obtenerDepositosPlanoT28':
      return obtenerDepositosPlanoT28.apply(null, args);

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


// Acceso de Netlify a la hoja DEPOSITOS
function obtenerDepositosPlanoT28() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DEPOSITOS');
  if (!sh) throw new Error('No existe la hoja DEPOSITOS.');
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];
  const rows = sh.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const h = rows[0].map(x => String(x || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const col = names => names.reduce((found, n) => found >= 0 ? found : h.indexOf(n), -1);
  const u=col(['ubicacion','sotano','nivel']), e=col(['estacionamiento','est','puesto']), emp=col(['empresa']), o=col(['observacion','observaciones','notas']), t=col(['tipo','categoria','clase']);
  return rows.slice(1).map((r,i) => ({filaIndex:i+2, ubicacion:u>=0?String(r[u]||'').trim():'', estacionamiento:e>=0?String(r[e]||'').trim():'', empresa:emp>=0?String(r[emp]||'').trim():'', observacion:o>=0?String(r[o]||'').trim():'', tipo:t>=0?String(r[t]||'').trim():'deposito'})).filter(x=>x.ubicacion||x.estacionamiento||x.empresa);
}
