/**
 * ============================================================
 * TORRE 28 - AUTENTICACIÓN
 * Archivo: T28_Auth.gs
 * Hoja: USUARIOS_APP
 * ============================================================
 */

const T28_AUTH_SHEET = 'USUARIOS_APP';
const T28_SESSION_SECONDS = 21600; // 6 horas

function t28AuthNorm_(valor) {
  return String(valor || '').trim().toLowerCase();
}

function generarHashPinT28(pin) {
  const texto = String(pin || '').trim();
  if (!texto) throw new Error('El PIN está vacío.');

  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    texto,
    Utilities.Charset.UTF_8
  );

  return bytes.map(function(b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function obtenerUsuariosAuthT28_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(T28_AUTH_SHEET);
  if (!sh) throw new Error('No existe la hoja USUARIOS_APP.');

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  return sh.getRange(2, 1, lastRow - 1, 6)
    .getDisplayValues()
    .map(function(row, i) {
      return {
        fila: i + 2,
        id: String(row[0] || '').trim(),
        nombre: String(row[1] || '').trim(),
        usuario: String(row[2] || '').trim(),
        pinHash: String(row[3] || '').trim(),
        rol: String(row[4] || '').trim(),
        activo: String(row[5] || '').trim()
      };
    });
}

function iniciarSesionT28(usuario, pin) {
  const usuarioIngresado = t28AuthNorm_(usuario);
  const pinIngresado = String(pin || '').trim();

  if (!usuarioIngresado || !pinIngresado) {
    throw new Error('Ingresa usuario y PIN.');
  }

  const usuarios = obtenerUsuariosAuthT28_();
  const encontrado = usuarios.find(function(u) {
    return t28AuthNorm_(u.usuario) === usuarioIngresado;
  });

  if (!encontrado) {
    throw new Error('Usuario o PIN incorrecto.');
  }

  if (t28AuthNorm_(encontrado.activo) !== 'si') {
    throw new Error('Este usuario está desactivado.');
  }

  const hashIngresado = generarHashPinT28(pinIngresado);

  if (hashIngresado !== encontrado.pinHash) {
    throw new Error('Usuario o PIN incorrecto.');
  }

  const token = Utilities.getUuid() + '-' + Utilities.getUuid();

  const sesion = {
    id: encontrado.id,
    nombre: encontrado.nombre,
    usuario: encontrado.usuario,
    rol: encontrado.rol,
    creado: new Date().toISOString()
  };

  CacheService.getScriptCache().put(
    'T28_SESSION_' + token,
    JSON.stringify(sesion),
    T28_SESSION_SECONDS
  );

  return {
    ok: true,
    token: token,
    usuario: sesion
  };
}

function validarSesionT28(token) {
  const tokenLimpio = String(token || '').trim();
  if (!tokenLimpio) return { ok: false };

  const cache = CacheService.getScriptCache();
  const data = cache.get('T28_SESSION_' + tokenLimpio);
  if (!data) return { ok: false };

  try {
    const sesion = JSON.parse(data);
    const usuarios = obtenerUsuariosAuthT28_();

    const vigente = usuarios.find(function(u) {
      return u.id === sesion.id &&
             t28AuthNorm_(u.usuario) === t28AuthNorm_(sesion.usuario);
    });

    if (!vigente || t28AuthNorm_(vigente.activo) !== 'si') {
      cache.remove('T28_SESSION_' + tokenLimpio);
      return { ok: false };
    }

    const actualizada = {
      id: vigente.id,
      nombre: vigente.nombre,
      usuario: vigente.usuario,
      rol: vigente.rol,
      creado: sesion.creado || new Date().toISOString()
    };

    cache.put(
      'T28_SESSION_' + tokenLimpio,
      JSON.stringify(actualizada),
      T28_SESSION_SECONDS
    );

    return {
      ok: true,
      usuario: actualizada
    };

  } catch (e) {
    cache.remove('T28_SESSION_' + tokenLimpio);
    return { ok: false };
  }
}

function cerrarSesionT28(token) {
  const tokenLimpio = String(token || '').trim();

  if (tokenLimpio) {
    CacheService.getScriptCache().remove(
      'T28_SESSION_' + tokenLimpio
    );
  }

  return { ok: true };
}

function t28AuthExigirAdministradorT28_(usuarioSesion) {
  const rol = t28AuthNorm_(usuarioSesion && usuarioSesion.rol);
  if (rol !== 'administrador' && rol !== 'admin') {
    const err = new Error('Solo un administrador puede gestionar usuarios.');
    err.t28Code = 'ADMIN_REQUIRED';
    throw err;
  }
}

function listarUsuariosPanelT28() {
  return obtenerUsuariosAuthT28_().map(function(u) {
    return { fila:u.fila,id:u.id,nombre:u.nombre,usuario:u.usuario,rol:u.rol,activo:u.activo };
  });
}

function guardarUsuarioPanelT28(datos, administradorActual) {
  datos = datos || {};
  const nombre = String(datos.nombre || '').trim();
  const usuario = String(datos.usuario || '').trim();
  const pin = String(datos.pin || '').trim();
  const rol = String(datos.rol || 'CCTV').trim();
  const activo = t28AuthNorm_(datos.activo) === 'no' ? 'NO' : 'SI';
  if (!nombre || !usuario) throw new Error('Completa nombre y usuario.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(T28_AUTH_SHEET);
    if (!sh) throw new Error('No existe la hoja USUARIOS_APP.');
    const actuales = obtenerUsuariosAuthT28_();
    const id = String(datos.id || '').trim();
    const existente = id ? actuales.find(function(u){ return u.id === id; }) : null;
    if (existente && administradorActual && existente.id === administradorActual.id) {
      const nuevoRol = t28AuthNorm_(rol);
      if (activo !== 'SI' || (nuevoRol !== 'administrador' && nuevoRol !== 'admin')) {
        throw new Error('No puedes desactivar ni quitar el rol Administrador de tu propia sesión.');
      }
    }
    const duplicado = actuales.find(function(u){
      return t28AuthNorm_(u.usuario) === t28AuthNorm_(usuario) && (!existente || u.id !== existente.id);
    });
    if (duplicado) throw new Error('Ese nombre de usuario ya existe.');
    if (!existente && !pin) throw new Error('El PIN es obligatorio para un usuario nuevo.');

    const usuarioId = existente ? existente.id : ('USR-' + Utilities.getUuid().slice(0,8).toUpperCase());
    const pinHash = pin ? generarHashPinT28(pin) : existente.pinHash;
    const fila = existente ? existente.fila : sh.getLastRow() + 1;
    sh.getRange(fila, 1, 1, 6).setValues([[usuarioId,nombre,usuario,pinHash,rol,activo]]);
    return {fila: fila,id:usuarioId,nombre:nombre,usuario:usuario,rol:rol,activo:activo};
  } finally {
    lock.releaseLock();
  }
}

function convertirPinsActualesAHashT28() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(T28_AUTH_SHEET);

  if (!sh) throw new Error('No existe la hoja USUARIOS_APP.');

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return 'No hay usuarios.';

  const rango = sh.getRange(2, 4, lastRow - 1, 1);
  const valores = rango.getDisplayValues();

  const nuevos = valores.map(function(row) {
    const actual = String(row[0] || '').trim();

    if (!actual) return [''];

    if (/^[a-f0-9]{64}$/i.test(actual)) {
      return [actual];
    }

    return [generarHashPinT28(actual)];
  });

  rango.setValues(nuevos);
  SpreadsheetApp.flush();

  return 'PIN convertidos correctamente.';
}
