Warning: truncated output (original token count: 80136)
Total output lines: 7264

let todosLosDatos = [];
    let movimientosHoy = [];
    let movimientosFiltrados = [];
    let catalogosIngresoWeb = { visitantes: [], personal: [], encargadoDia: null };
    let encargadoDiaActual = null;
    let resolverOcupadoPendiente = null;
    let estacionamientoAdvertidoActual = '';
    let movimientoDetalleActual = null;
    let modoFormularioIngreso = 'crear';
    let movimientoEditandoActual = null;
    let ingresoPendienteReintentoT28 = null;
    let accionPeligrosaActual = null;
    let todosLosSuministros = [];
    let suministrosFiltrados = [];
    let todosLosContactos = [];
    let contactosFiltrados = [];
    let personasDirectorioT28 = [];
    let personasDirectorioFiltradasT28 = [];
    let imagenesPersonaDirectorioNuevasT28 = ['', '', ''];
    let cargandoPersonasDirectorioT28 = false;
    let timerEstadoPersonasDirectorioT28 = null;
    let directorioImagenNuevaT28 = '';
    let empresasCatalogoT28 = [];
    let empresaImagenNuevaT28 = '';
    let empresaCatalogoCargandoT28 = false;
    let empresaCatalogoConLogosT28 = false;
    let empresaCatalogoCargaSeqT28 = 0;
    let empresaCatalogoTimerT28 = null;
    let empresaDetalleActualT28 = null;
    let accionFabActualT28 = null;

    const T28_VISUAL_DB = 'Torre28VisualCache';
    function abrirCacheVisualT28() {
      return new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('IndexedDB no disponible'));
        const req = indexedDB.open(T28_VISUAL_DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore('datos');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    async function guardarCacheVisualT28(clave, valor) {
      try {
        const db = await abrirCacheVisualT28();
        const tx = db.transaction('datos', 'readwrite');
        tx.objectStore('datos').put({ valor, actualizado: Date.now() }, clave);
        await new Promise((ok, fail) => { tx.oncomplete = ok; tx.onerror = () => fail(tx.error); });
        db.close();
      } catch(e) {}
    }
    async function leerCacheVisualT28(clave) {
      try {
        const db = await abrirCacheVisualT28();
        const tx = db.transaction('datos', 'readonly');
        const req = tx.objectStore('datos').get(clave);
        const registro = await new Promise((ok, fail) => { req.onsuccess = () => ok(req.result); req.onerror = () => fail(req.error); });
        db.close();
        return registro?.valor || null;
      } catch(e) { return null; }
    }
    function hidratarCacheVisualT28() {
      leerCacheVisualT28('empresas').then(datos => {
        if (!empresasCatalogoT28.length && Array.isArray(datos) && datos.length) {
          empresasCatalogoT28 = datos;
          empresaCatalogoConLogosT28 = datos.some(e => e?.logoDataUrl);
          sincronizarCatalogoEmpresasT28();
          if (moduloActual === 'catalogoempresas') renderEmpresasGestionT28();
        }
      });
      leerCacheVisualT28('directorio').then(datos => {
        if (!todosLosContactos.length && Array.isArray(datos) && datos.length) {
          todosLosContactos = datos;
          contactosFiltrados = datos;
          const total = document.getElementById('directorio-total');
          if (total) total.textContent = datos.length;
          if (moduloActual === 'directorio') filtrarDirectorio();
        }
      });
      leerCacheVisualT28('personas_directorio').then(datos => {
        if (!personasDirectorioT28.length && Array.isArray(datos) && datos.length) {
          personasDirectorioT28 = datos;
          personasDirectorioFiltradasT28 = datos;
          actualizarTotalPersonasDirectorioT28();
          // Se prepara aunque la vista aún no esté activa: evita quedar con contador pero sin tarjetas.
          filtrarPersonasDirectorioT28();
          if (moduloActual === 'personasdirectorio') {
            actualizarEstadoPersonasDirectorioT28('Directorio disponible desde caché', false, false, 1600);
          }
        }
      });
    }

    let vistaUsuariosActual = 'asignaciones';
    let moduloActual = 'dashboard'; 
    let vistaEstActual = 'tabla'; 

    // Banderas de control para evitar sobrecarga de peticiones
    let cargandoMovimientos = false;
    let cargandoDatosServidor = false;
    let cargandoCatalogosIngreso = false;
    let catalogosIngresoListosT28 = false;
    let cargandoDirectorioT28 = false;
    let ultimaCargaMovimientosT28 = 0;
    let ultimaCargaDatosT28 = 0;
    let ultimaCargaDirectorioT28 = 0;
    let cambioModuloSecuenciaT28 = 0;

    function esMovilRendimientoT28() {
      return window.matchMedia('(max-width: 768px)').matches ||
             window.matchMedia('(max-width: 1180px) and (pointer: coarse)').matches;
    }

    function ejecutarIdleT28(fn, timeout = 500) {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout });
      else setTimeout(fn, 30);
    }

    // Íconos SVG reutilizables (reemplazan a los emoji en contenido generado por JS)
    const ICONS = {
      edit: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>',
      clock: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
      check: '<svg class="icon" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
      sync: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.3 6.4L3 16"/><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8"/><path d="M3 16v-4h4"/><path d="M21 8v4h-4"/></svg>'
    };

    // ================= VALIDACIÓN INLINE DE CAMPOS =================
    // Reemplaza los alert() de "falta completar X" por un resalte visual del
    // campo (borde rojo) + foco automático, en vez de un popup del navegador.
    function resaltarCampoInvalido(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add('field-invalid');
      const limpiar = () => { el.classList.remove('field-invalid'); el.removeEventListener('input', limpiar); el.removeEventListener('change', limpiar); };
      el.addEventListener('input', limpiar);
      el.addEventListener('change', limpiar);
    }

    function limpiarCamposInvalidos(ids) {
      ids.forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('field-invalid'); });
    }

    // ================= SKELETONS DE CARGA =================
    // Reemplazan el texto plano "Cargando..." por placeholders animados con
    // la forma real del contenido, solo en la primera carga (cuando aún no
    // hay datos en memoria) para no parpadear en cada autoactualización.
    function renderSkeletonRows(tbodyId, columnas, filas = 6) {
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;
      let html = '';
      for (let f = 0; f < filas; f++) {
        html += '<tr>' + Array.from({ length: columnas }).map(() =>
          `<td class="py-2.5 px-3"><span class="t28-skel t28-skel-text" style="width:${55 + Math.round(Math.random() * 35)}%"></span></td>`
        ).join('') + '</tr>';
      }
      tbody.innerHTML = html;
    }

    function renderSkeletonCards(containerId, cantidad = 3) {
      const cont = document.getElementById(containerId);
      if (!cont) return;
      cont.innerHTML = Array.from({ length: cantidad }).map(() => `
        <div class="t28-skel-card">
          <div class="t28-skel" style="height:46px;border-radius:0"></div>
          <div class="p-3.5 space-y-2.5">
            ${Array.from({ length: 3 }).map(() => `<div class="t28-skel" style="height:50px"></div>`).join('')}
          </div>
        </div>`).join('');
    }

    function renderSkeletonList(containerId, filas = 4) {
      const cont = document.getElementById(containerId);
      if (!cont) return;
      cont.innerHTML = Array.from({ length: filas }).map(() => `
        <div class="px-4 py-3 flex items-center gap-3">
          <span class="t28-skel" style="width:40px;height:40px;border-radius:12px;flex-shrink:0"></span>
          <div class="flex-1 space-y-1.5">
            <span class="t28-skel t28-skel-text" style="width:50%"></span>
            <span class="t28-skel t28-skel-text" style="width:78%"></span>
          </div>
        </div>`).join('');
    }

    // Resalta uno o varios campos, enfoca el primero y avisa por toast (sin alert()).
    function marcarCamposFaltantes(ids, mensaje) {
      ids.forEach(resaltarCampoInvalido);
      const primero = document.getElementById(ids[0]);
      if (primero) {
        primero.scrollIntoView({ behavior: 'smooth', block: 'center' });
        primero.focus({ preventScroll: true });
      }
      mostrarToast(mensaje, 'error');
    }

    const coloresEmpresas = {
      "TYPSA": { bg: "bg-red-800", text: "text-white", badge: "bg-red-900/40 text-red-200 border-red-700", borderTabla: "border-l-4 border-l-red-700" },
      "BENITES": { bg: "bg-rose-900", text: "text-white", badge: "bg-rose-950/40 text-rose-200 border-rose-800", borderTabla: "border-l-4 border-l-rose-800" },
      "RED DIGITAL": { bg: "bg-purple-900", text: "text-white", badge: "bg-purple-950/40 text-purple-200 border-purple-800", borderTabla: "border-l-4 border-l-purple-800" },
      "NETAFIM": { bg: "bg-blue-900", text: "text-white", badge: "bg-blue-950/40 text-blue-200 border-blue-800", borderTabla: "border-l-4 border-l-blue-800" },
      "CLINICA OLIVAR": { bg: "bg-emerald-800", text: "text-white", badge: "bg-emerald-950/40 text-emerald-200 border-emerald-700", borderTabla: "border-l-4 border-l-emerald-700" },
      "PAS UNE MARQUE": { bg: "bg-slate-900", text: "text-white", badge: "bg-slate-800 text-slate-300 border-slate-700", borderTabla: "border-l-4 border-l-slate-700" },
      "RODRIGO GABER": { bg: "bg-amber-800", text: "text-white", badge: "bg-amber-950/40 text-amber-200 border-amber-700", borderTabla: "border-l-4 border-l-amber-700" },
      "ALDESA": { bg: "bg-green-800", text: "text-white", badge: "bg-green-950/40 text-green-200 border-green-700", borderTabla: "border-l-4 border-l-green-700" },
      "SERVICIOS MINERA": { bg: "bg-teal-900", text: "text-white", badge: "bg-teal-950/40 text-teal-200 border-teal-800", borderTabla: "border-l-4 border-l-teal-800" },
      "NEC": { bg: "bg-blue-950", text: "text-white", badge: "bg-blue-900/40 text-blue-200 border-blue-800", borderTabla: "border-l-4 border-l-blue-900" },
      "FIBERHOME": { bg: "bg-orange-800", text: "text-white", badge: "bg-orange-950/40 text-orange-200 border-orange-700", borderTabla: "border-l-4 border-l-orange-700" },
      "TORRE 28": { bg: "bg-slate-800", text: "text-white", badge: "bg-slate-700 text-slate-200 border-slate-600", borderTabla: "border-l-4 border-l-slate-600" }
    };

    function escapeHtml(v) {
      if (v === null || v === undefined) return '';
      return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function normalizarTexto(texto) {
      if (!texto) return "";
      return texto.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    // Paleta para empresas que no están en coloresEmpresas: cada empresa nueva
    // recibe un color determinístico (mismo nombre → siempre el mismo color)
    // en vez de caer todas al gris genérico.
    const PALETA_EMPRESA_AUTO = [
      { bg: "bg-cyan-800",     text: "text-white", badge: "bg-cyan-950/40 text-cyan-200 border-cyan-700",         borderTabla: "border-l-4 border-l-cyan-700" },
      { bg: "bg-fuchsia-800",  text: "text-white", badge: "bg-fuchsia-950/40 text-fuchsia-200 border-fuchsia-700", borderTabla: "border-l-4 border-l-fuchsia-700" },
      { bg: "bg-pink-800",     text: "text-white", badge: "bg-pink-950/40 text-pink-200 border-pink-700",         borderTabla: "border-l-4 border-l-pink-700" },
      { bg: "bg-indigo-800",   text: "text-white", badge: "bg-indigo-950/40 text-indigo-200 border-indigo-700",   borderTabla: "border-l-4 border-l-indigo-700" },
      { bg: "bg-violet-800",   text: "text-white", badge: "bg-violet-950/40 text-violet-200 border-violet-700",   borderTabla: "border-l-4 border-l-violet-700" },
      { bg: "bg-sky-800",      text: "text-white", badge: "bg-sky-950/40 text-sky-200 border-sky-700",           borderTabla: "border-l-4 border-l-sky-700" },
      { bg: "bg-yellow-800",   text: "text-white", badge: "bg-yellow-950/40 text-yellow-200 border-yellow-700",   borderTabla: "border-l-4 border-l-yellow-700" },
      { bg: "bg-stone-700",    text: "text-white", badge: "bg-stone-900/40 text-stone-200 border-stone-600",     borderTabla: "border-l-4 border-l-stone-600" }
    ];

    function hashTextoEstable(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
      return h;
    }

    function obtenerEstiloEmpresa(nombreEmpresa) {
      if (coloresEmpresas[nombreEmpresa]) return coloresEmpresas[nombreEmpresa];
      const nombre = (nombreEmpresa || '').toString().trim();
      if (!nombre) return { bg: "bg-slate-800", text: "text-white", badge: "bg-slate-700 text-slate-200 border-slate-600", borderTabla: "border-l-4 border-l-slate-500" };
      return PALETA_EMPRESA_AUTO[hashTextoEstable(nombre) % PALETA_EMPRESA_AUTO.length];
    }


    // ================= TECLA ESC: cerrar modal/formulario activo =================
    function elementoVisiblePorId(id) {
      const el = document.getElementById(id);
      return !!(el && !el.classList.contains('hidden'));
    }

    function cerrarModalActivoConEsc() {
      // Prioridad de arriba hacia abajo según la importancia / z-index.
      const busquedaTopbar = document.getElementById('topbar-dashboard-search');
      if (busquedaTopbar?.classList.contains('is-open') && window.innerWidth <= 768) {
        cerrarBusquedaTopbarT28(false);
        return true;
      }
      if (menuMasMovilAbiertoT28()) { cerrarMenuMasMovilT28(); return true; }
      if (elementoVisiblePorId('modal-aviso-imagen')) { cerrarImagenAvisoAmpliadaT28(null, true); return true; }
      if (elementoVisiblePorId('modal-eliminar-aviso')) { cerrarEliminarAvisoT28(); return true; }
      if (elementoVisiblePorId('modal-aviso-form')) { cerrarFormAvisoT28(); return true; }
      if (elementoVisiblePorId('modal-aviso-detalle')) { cerrarDetalleAvisoT28(); return true; }
      if (elementoVisiblePorId('modal-empresa-form')) { cerrarFormEmpresaT28(); return true; }
      if (elementoVisiblePorId('modal-persona-directorio')) { cerrarFormPersonaDirectorioT28(); return true; }
      if (elementoVisiblePorId('modal-empresa-detalle')) { cerrarDetalleEmpresaT28(); return true; }
      if (elementoVisiblePorId('modal-cerrar-sesion')) { cerrarModalCerrarSesionT28(); return true; }
      if (elementoVisiblePorId('modal-personal-sin-est')) { cerrarModalPersonalSinEstacionamiento(); return true; }
      if (elementoVisiblePorId('modal-directorio')) { cerrarModalDirectorio(); return true; }
      if (elementoVisiblePorId('modal-est-ocupado')) {
        resolverAdvertenciaOcupado(false);
        return true;
      }
      if (elementoVisiblePorId('modal-confirmar-eliminacion')) {
        cerrarConfirmacionEliminacion();
        return true;
      }
      if (elementoVisiblePorId('modal-salida-mov')) {
        cerrarModalSalidaMovimiento();
        return true;
      }
      if (elementoVisiblePorId('modal-ingreso')) {
        cerrarModalIngreso();
        return true;
      }
      if (elementoVisiblePorId('modal-detalle-mov')) {
        cerrarDetalleMovimiento();
        return true;
      }
      if (elementoVisiblePorId('modal-encargado-dia')) {
        cerrarModalEncargadoDia();
        return true;
      }
      if (elementoVisiblePorId('modal-editar-suministro')) {
        cerrarModalSuministro();
        return true;
      }
      if (elementoVisiblePorId('modal-nuevo')) {
        cerrarModalNuevo();
        return true;
      }
      if (elementoVisiblePorId('modal-editar')) {
        cerrarModal();
        return true;
      }
      if (elementoVisiblePorId('modal-confirmar-descarga')) {
        cerrarModalDescarga();
        return true;
      }
      if (elementoVisiblePorId('modal-distribucion-mobile')) {
        cerrarDistribucionMobile();
        return true;
      }

      // Si no hay modal, Esc cierra los resultados de búsqueda rápida.
      const resultados = document.getElementById('dash-buscar-resultados');
      if (resultados && !resultados.classList.contains('hidden')) {
        resultados.classList.add('hidden');
        const input = document.getElementById('dash-buscar-placa');
        if (input) input.blur();
        return true;
      }

      // Y finalmente el menú de configuración si estuviera abierto.
      const menu = document.getElementById('menu-configuracion');
      if (menu && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
        return true;
      }

      return false;
    }

    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Escape') return;
      if (cerrarModalActivoConEsc()) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // ================= AUTOACTUALIZACIÓN INTELIGENTE =================
    let intervaloAutoMovimientos = null;
    let intervaloAutoUsuarios = null;
    let intervaloAutoDirectorio = null;
    let intervaloTiempoAlertas = null;
    let autoActualizacionHabilitadaT28 = true;

    function hayModalOperativoAbierto() {
      const ids = [
        'modal-ingreso', 'modal-detalle-mov', 'modal-salida-mov',
        'modal-confirmar-eliminacion', 'modal-editar', 'modal-nuevo',
        'modal-editar-suministro', 'modal-encargado-dia', 'modal-confirmar-descarga',
        'modal-personal-sin-est', 'modal-directorio', 'modal-persona-directorio', 'modal-cerrar-sesion',
        'modal-empresa-form', 'modal-aviso-detalle', 'modal-aviso-form', 'modal-eliminar-aviso', 'modal-aviso-imagen'
      ];
      return ids.some(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
      });
    }

    function puedeAutoActualizar() {
      return autoActualizacionHabilitadaT28 &&
             !document.hidden &&
             !hayModalOperativoAbierto();
    }

    function iniciarAutoActualizacion() {
      const movil = esMovilRendimientoT28();

      if (intervaloAutoMovimientos) clearInterval(intervaloAutoMovimientos);
      intervaloAutoMovimientos = setInterval(function() {
        if (!puedeAutoActualizar() || cargandoMovimientos) return;
        if (moduloActual === 'movimientos' || moduloActual === 'dashboard') cargarHistorialHoy(true);
      }, movil ? 60000 : 30000);

      if (intervaloAutoUsuarios) clearInterval(intervaloAutoUsuarios);
      intervaloAutoUsuarios = setInterval(function() {
        if (!puedeAutoActualizar() || cargandoDatosServidor) return;
        if (movil) {
          if (moduloActual === 'empresas') cargarDatosServidor(false);
        } else if (moduloActual === 'empresas' || moduloActual === 'dashboard') {
          cargarDatosServidor(false);
        }
      }, movil ? 120000 : 60000);

      if (intervaloAutoDirectorio) clearInterval(intervaloAutoDirectorio);
      intervaloAutoDirectorio = setInterval(function() {
        if (!puedeAutoActualizar() || cargandoDirectorioT28) return;
        if (moduloActual === 'directorio') cargarDirectorioServidor(false, true);
        if (moduloActual === 'personasdirectorio' && !cargandoPersonasDirectorioT28) cargarPersonasDirectorioT28(false, true);
      }, movil ? 120000 : 60000);

      if (intervaloTiempoAlertas) clearInterval(intervaloTiempoAlertas);
      intervaloTiempoAlertas = setInterval(function() {
        if (moduloActual === 'dashboard' && !document.hidden) actualizarAlertasTiempo();
      }, movil ? 120000 : 60000);
    }

    function actualizarFechaHoraTopbar() {
      const fechaEl = document.getElementById('topbar-fecha');
      const horaEl = document.getElementById('topbar-hora');
      if (!fechaEl || !horaEl) return;

      const ahora = new Date();

      const fechaDesktop = new Intl.DateTimeFormat('es-PE', {
        weekday: 'short',
        day: '2-digit',
        month: 'short'
      }).format(ahora).replace(/\./g, '');

      const fechaMovil = new Intl.DateTimeFormat('es-PE', {
        day: '2-digit',
        month: 'short'
      }).format(ahora).replace(/\./g, '');

      const hora = new Intl.DateTimeFormat('es-PE', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(ahora).replace(/\s+/g, ' ').toUpperCase();

      const esCompacto = window.matchMedia('(max-width: 760px)').matches;
      fechaEl.textContent = esCompacto ? fechaMovil : fechaDesktop;
      horaEl.textContent = hora;
    }

    let intervaloFechaHoraTopbar = null;

    function iniciarFechaHoraTopbar() {
      actualizarFechaHoraTopbar();

      if (intervaloFechaHoraTopbar) clearInterval(intervaloFechaHoraTopbar);
      intervaloFechaHoraTopbar = setInterval(actualizarFechaHoraTopbar, 1000);
    }


    // ================= AUTENTICACIÓN TORRE 28 =================
    const T28_AUTH_TOKEN_KEY = 'torre28_auth_token';
    let usuarioSesionT28 = null;
    let appT28Inicializada = false;
    let verificacionSesionIniciadaT28 = false;
    let movimientosOptimistasT28 = [];
    let usuariosAdminT28 = [];
    let sesionesAdminT28 = [];
    let intervaloSesionT28 = null;

    const PERMISOS_ROL_T28 = {
      administrador: ['dashboard','movimientos','usuarios','empresas','historial','directorio','personasdirectorio','suministros','crear','editar','eliminar','descargar','sincronizar','administrar'],
      admin: ['dashboard','movimientos','usuarios','empresas','historial','directorio','personasdirectorio','suministros','crear','editar','eliminar','descargar','sincronizar','administrar'],
      consulta: ['dashboard','movimientos','usuarios','empresas','historial','directorio','personasdirectorio','suministros'],
      control: ['dashboard','movimientos','usuarios','empresas','historial','directorio','personasdirectorio','suministros','crear','editar','descargar','sincronizar']
    };

    function permisosSesionT28() {
      const rolActual=normalizarTexto(usuarioSesionT28?.rol || '');
      if (rolActual==='administrador'||rolActual==='admin') return PERMISOS_ROL_T28.administrador.slice();
      const recibidos = Array.isArray(usuarioSesionT28?.permisos) ? usuarioSesionT28.permisos : [];
      if (recibidos.length) return recibidos.map(normalizarTexto);
      const rol = normalizarTexto(usuarioSesionT28?.rol || 'control');
      return (PERMISOS_ROL_T28[rol] || PERMISOS_ROL_T28.control).slice();
    }

    function tienePermisoT28(permiso) {
      const rolActual=normalizarTexto(usuarioSesionT28?.rol || '');
      return rolActual==='administrador'||rolActual==='admin'||permisosSesionT28().includes(normalizarTexto(permiso));
    }

    function permisoModuloT28(modulo) {
      return ({dashboard:'dashboard',movimientos:'movimientos',empresas:'usuarios',historial:'historial',directorio:'directorio',personasdirectorio:'directorio',suministros:'suministros',catalogoempresas:'empresas'})[modulo] || modulo;
    }

    function aplicarPermisosInterfazT28() {
      const modulos=['dashboard','movimientos','empresas','historial','directorio','personasdirectorio','suministros','catalogoempresas'];
      modulos.forEach(function(modulo){
        const visible=tienePermisoT28(permisoModuloT28(modulo));
        ['nav-'+modulo,'mnav-'+modulo,'more-nav-'+modulo].forEach(function(id){document.getElementById(id)?.classList.toggle('hidden',!visible);});
      });
      document.getElementById('btn-descarga-global')?.classList.toggle('hidden',!tienePermisoT28('descargar'));
      document.getElementById('btn-sync-global')?.classList.toggle('hidden',!tienePermisoT28('sincronizar'));
      document.getElementById('mnav-more')?.classList.toggle('hidden',!['directorio','suministros','empresas'].some(tienePermisoT28));
      document.body.classList.toggle('t28-no-crear',!tienePermisoT28('crear'));
      document.body.classList.toggle('t28-no-editar',!tienePermisoT28('editar'));
      document.body.classList.toggle('t28-no-eliminar',!tienePermisoT28('eliminar'));
      const actualPermitido=tienePermisoT28(permisoModuloT28(moduloActual||'dashboard'));
      if(!actualPermitido){
        const primero=modulos.find(m=>tienePermisoT28(permisoModuloT28(m)));
        if(primero)setTimeout(()=>cambiarModulo(primero),0);
      }
    }

    /**
     * Base para CRUD instantáneo en vistas nuevas.
     * aplicar() actualiza la pantalla; ejecutar(ok, error) trabaja detrás;
     * revertir() restaura el estado si Google Sheets falla.
     */
    function ejecutarAccionInstantaneaT28(config) {
      const c = config || {};
      try { c.aplicar?.(); } catch (error) { c.revertir?.(error); throw error; }
      if (c.mensaje) mostrarToast(c.mensaje, 'exito');
      c.ejecutar?.(
        function(resultado) { c.confirmar?.(resultado); },
        function(error) {
          c.revertir?.(error);
          mostrarToast(c.mensajeError || ('No se pudo completar: ' + (error?.message || error)), 'error');
        }
      );
    }
    let avisosT28 = [];
    let avisoIndiceT28 = 0;
    let avisoDetalleActualT28 = null;
    let avisoImagenNuevaT28 = '';
    let avisoQuitarImagenT28 = false;
    let avisosCargandoT28 = false;
    let solicitudAvisosT28 = 0;
    let intervaloAvisosT28 = null;
    let avisoSwipeXT28 = null;
    let alertasHoyT28 = [];
    let alertaFlotanteIndiceT28 = 0;
    let intervaloMotorAlertasT28 = null;
    let arrastreAlertaT28 = null;
    let alertaOcultaPorModalT28 = false;

    function mostrarPantallaLoginT28() {
      document.body.classList.remove('t28-restoring-session');
      document.body.classList.add('t28-auth-pending');
      if(intervaloSesionT28){clearInterval(intervaloSesionT28);intervaloSesionT28=null;}

      const login = document.getElementById('t28-login-screen');
      const app = document.getElementById('t28-app-shell');

      if (login) login.classList.remove('t28-login-hidden');
      if (app) app.classList.add('t28-app-locked');
      actualizarVisibilidadFabT28();

      const error = document.getElementById('t28-login-error');
      if (error) error.classList.add('hidden');

      const pin = document.getElementById('t28-login-pin');
      if (pin) pin.value = '';

      setTimeout(function() {
        const usuario = document.getElementById('t28-login-usuario');
        if (usuario) usuario.focus();
      }, 120);
    }

    function mostrarAplicacionT28(usuario) {
      document.body.classList.remove('t28-restoring-session');
      usuarioSesionT28 = usuario || null;

      const login = document.getElementById('t28-login-screen');
      const app = document.getElementById('t28-app-shell');

      if (login) login.classList.add('t28-login-hidden');
      if (app) app.classList.remove('t28-app-locked');
      document.body.classList.remove('t28-auth-pending');

      const box = document.getElementById('sidebar-auth-box');
      const nombre = document.getElementById('sidebar-auth-nombre');
      const rol = document.getElementById('sidebar-auth-rol');

      if (box) box.classList.remove('hidden');
      if (nombre) nombre.textContent = usuario?.nombre || usuario?.usuario || 'Usuario';
      if (rol) rol.textContent = usuario?.rol || 'Acceso';

      actualizarCuentaConfigT28();
      renderIngresosFallidosT28();
      aplicarPermisosInterfazT28();
      iniciarVigilanciaSesionT28();

      if (!appT28Inicializada) {
        appT28Inicializada = true;
        iniciarAplicacionT28();
      } else {
        cambiarModulo('dashboard');

        if (window.matchMedia('(max-width: 768px)').matches) {
          cargarHistorialHoy(true);
          setTimeout(function() {
            if (usuarioSesionT28) cargarDatosServidor(false);
          }, 280);
        } else {
          cargarDatosServidor(false);
          cargarHistorialHoy(true);
        }
      }
    }

    function iniciarVigilanciaSesionT28() {
      if(intervaloSesionT28)clearInterval(intervaloSesionT28);
      intervaloSesionT28=setInterval(function(){
        const token=localStorage.getItem(T28_AUTH_TOKEN_KEY);if(!token)return;
        T28Api.validarSesion(token).then(function(res){
          if(!res?.ok||!res?.usuario){localStorage.removeItem(T28_AUTH_TOKEN_KEY);usuarioSesionT28=null;mostrarPantallaLoginT28();mostrarToast('La sesión fue cerrada por el administrador.','error');return;}
          usuarioSesionT28=res.usuario;actualizarCuentaConfigT28();aplicarPermisosInterfazT28();
        }).catch(function(err){
          if (err?.code === 'AUTH_INVALID' || err?.code === 'AUTH_REQUIRED') {
            localStorage.removeItem(T28_AUTH_TOKEN_KEY); usuarioSesionT28=null; mostrarPantallaLoginT28();
          }
          /* Una caída temporal de Internet no cierra la sesión. */
        });
      },60000);
    }

    function iniciarAplicacionT28() {
      document.body.classList.remove('dark-mode');
      aplicarConfiguracionT28(true);

      const toastEl = document.getElementById('toast-notificacion');
      if (toastEl) document.body.appendChild(toastEl);

      const esMovilT28 = window.matchMedia('(max-width: 768px)').matches;
      const datosLocales = localStorage.getItem('torre28_estacionamientos');
      hidratarCacheVisualT28();

      if (datosLocales) {
        try {
          todosLosDatos = JSON.parse(datosLocales);
          poblarSelectEmpresas(todosLosDatos);
          actualizarContadoresGlobales(todosLosDatos);

          // La tabla/tarjetas completas de Usuarios no necesitan renderizarse
          // al arrancar en móvil. Se pintan cuando el usuario entra a esa vista.
          if (!esMovilT28) {
            renderizarVistaEst(todosLosDatos);
          }
        } catch(e) {}
      }

      iniciarFechaHoraTopbar();
      inicializarTooltipsT28();

      cambiarModulo('dashboard');

      // Carga silenciosa y ligera del catálogo maestro después del arranque.
      // No bloquea Inicio ni la navegación.
      setTimeout(function() {
        if (!empresasCatalogoT28.length) cargarEmpresasCatalogoT28(false, false, false);
      }, 1400);
      setTimeout(function() {
        cargarAvisosDashboardT28(false);
      }, esMovilT28 ? 900 : 350);

      if (esMovilT28) {
        // Prioridad móvil: Movimientos alimenta Inicio y debe aparecer primero.
        cargarHistorialHoy();

        // Refresco de estacionamientos en segundo plano, sin competir al mismo
        // instante con la carga principal del dashboard.
        setTimeout(function() {
          if (usuarioSesionT28) cargarDatosServidor(false);
        }, 280);

        // Catálogos de ingreso quedan en lazy-load:
        // abrirModalIngreso() ya los pide si todavía no están disponibles.
      } else {
        // PC conserva la precarga completa.
        cargarDatosServidor(false);
        cargarHistorialHoy();
        cargarCatalogosIngresoServidor();
      }

      iniciarAutoActualizacion();
    }

    function verificarSesionInicialT28() {
      if (verificacionSesionIniciadaT28) return;
      verificacionSesionIniciadaT28 = true;
      const token = localStorage.getItem(T28_AUTH_TOKEN_KEY);

      if (!token) {
        mostrarPantallaLoginT28();
        return;
      }

      document.body.classList.add('t28-restoring-session');
      const estado = document.getElementById('t28-session-status');
      if (estado) estado.textContent = 'Recuperando tu sesión…';

      T28Api.validarSesion(token)
        .then(function(res) {
          if (res && res.ok && res.usuario) {
            mostrarAplicacionT28(res.usuario);
          } else {
            localStorage.removeItem(T28_AUTH_TOKEN_KEY);
            mostrarPantallaLoginT28();
          }
        })
        .catch(function(err) {
          if (err?.code === 'AUTH_INVALID' || err?.code === 'AUTH_REQUIRED') {
            localStorage.removeItem(T28_AUTH_TOKEN_KEY);
            mostrarPantallaLoginT28();
            return;
          }
          if (estado) estado.textContent = 'Esperando conexión para recuperar tu sesión. No necesitas volver a escribir tus datos.';
          setTimeout(function() {
            verificacionSesionIniciadaT28 = false;
            verificarSesionInicialT28();
          }, 10000);
        });
    }

    function iniciarSesionDesdeLoginT28(event) {
      if (event) event.preventDefault();

      const usuarioEl = document.getElementById('t28-login-usuario');
      const pinEl = document.getElementById('t28-login-pin');
      const btn = document.getElementById('t28-login-btn');
      const btnText = document.getElementById('t28-login-btn-text');

      const usuario = String(usuarioEl?.value || '').trim();
      const pin = String(pinEl?.value || '').trim();

      if (!usuario || !pin) {
        mostrarErrorLoginT28('Ingresa tu usuario y PIN.');
        return;
      }

      const error = document.getElementById('t28-login-error');
      if (error) error.classList.add('hidden');

      if (btn) btn.disabled = true;
      if (btnText) btnText.textContent = 'Validando acceso...';
      if (btn) btn.classList.add('is-loading');

      T28Api.login(usuario, pin)
        .then(function(res) {
          if (btn) btn.disabled = false;
          if (btnText) btnText.textContent = 'Ingresar al panel';
          if (btn) btn.classList.remove('is-loading');

          if (!res || !res.ok || !res.token) {
            mostrarErrorLoginT28('No se pudo iniciar sesión.');
            return;
          }

          localStorage.setItem(T28_AUTH_TOKEN_KEY, res.token);
          mostrarAplicacionT28(res.usuario);
        })
        .catch(function(err) {
          if (btn) btn.disabled = false;
          if (btnText) btnText.textContent = 'Ingresar al panel';
          if (btn) btn.classList.remove('is-loading');

          mostrarErrorLoginT28(
            err && err.message ? err.message : 'Usuario o PIN incorrecto.'
          );

          if (pinEl) {
            pinEl.value = '';
            pinEl.focus();
          }
        });
    }

    function mostrarErrorLoginT28(texto) {
      const error = document.getElementById('t28-login-error');
      const card = document.querySelector('.t28-login-card');

      if (error) {
        error.textContent = texto;
        error.classList.remove('hidden');
      }

      if (card) {
        card.classList.remove('t28-login-shake');
        void card.offsetWidth;
        card.classList.add('t28-login-shake');
      }
    }

    function alternarPinLoginT28() {
      const pin = document.getElementById('t28-login-pin');
      const btn = document.querySelector('.t28-login-eye');

      if (!pin) return;

      const mostrar = pin.type === 'password';
      pin.type = mostrar ? 'text' : 'password';

      if (btn) {
        btn.setAttribute('title', mostrar ? 'Ocultar PIN' : 'Mostrar PIN');
      }
    }

    function solicitarCerrarSesionT28() {
      const modal = document.getElementById('modal-cerrar-sesion');
      const texto = document.getElementById('t28-logout-text');
      const nombre = usuarioSesionT28?.nombre || usuarioSesionT28?.usuario || 'este usuario';

      if (texto) {
        texto.textContent = `Se cerrará la sesión de ${nombre} y volverás a la pantalla de acceso.`;
      }

      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.classList.add('overflow-hidden');
      }
    }

    function cerrarModalCerrarSesionT28() {
      const modal = document.getElementById('modal-cerrar-sesion');
      if (!modal) return;

      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.classList.remove('overflow-hidden');
    }

    function confirmarCerrarSesionT28() {
      const btn = document.getElementById('btn-confirmar-cerrar-sesion');
      if (btn) {
        btn.disabled = true;
        btn.classList.add('is-loading');
      }

      cerrarSesionClienteT28();
    }

    function cerrarSesionClienteT28() {
      const token = localStorage.getItem(T28_AUTH_TOKEN_KEY);

      localStorage.removeItem(T28_AUTH_TOKEN_KEY);
      usuarioSesionT28 = null;

      const finalizarSalida = function() {
        cerrarModalCerrarSesionT28();

        const box = document.getElementById('sidebar-auth-box');
        if (box) box.classList.add('hidden');

        const usuarioInput = document.getElementById('t28-login-usuario');
        const pinInput = document.getElementById('t28-login-pin');
        const btn = document.getElementById('btn-confirmar-cerrar-sesion');

        if (usuarioInput) usuarioInput.value = '';
        if (pinInput) pinInput.value = '';
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('is-loading');
        }

        // El panel queda completamente oculto y volvemos al login sin recargar.
        mostrarPantallaLoginT28();
      };

      if (token) {
        T28Api.cerrarSesion(token)
          .then(finalizarSalida)
          .catch(finalizarSalida);
      } else {
        finalizarSalida();
      }
    }



    // Las imágenes del panel no deben retrasar la pantalla de acceso.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', verificarSesionInicialT28, { once: true });
    } else {
      verificarSesionInicialT28();
    }

    document.addEventListener('visibilitychange', function() {
      if (!usuarioSesionT28 || document.hidden || !puedeAutoActualizar()) return;

      const movil = esMovilRendimientoT28();
      const ahora = Date.now();

      if (moduloActual === 'movimientos' || moduloActual === 'dashboard') {
        if (!movil || ahora - ultimaCargaMovimientosT28 > 60000) cargarHistorialHoy(true);
      }
      if (moduloActual === 'empresas') {
        if (!movil || ahora - ultimaCargaDatosT28 > 120000) cargarDatosServidor(false);
      }
      if (moduloActual === 'directorio') {
        if (!movil || ahora - ultimaCargaDirectorioT28 > 120000) cargarDirectorioServidor(false, true);
      }
    });

    // Cola de notificaciones: evita que un toast pise a otro cuando dos
    // acciones terminan casi al mismo tiempo (ej. autosincronización + guardado).
    // 'guardando' es un estado en curso y se muestra de inmediato (reemplaza lo
    // que hubiera); 'exito'/'error'/'aviso' son mensajes puntuales y se encolan.
    let colaToast = [];
    let toastMostrandose = false;
    const TOAST_BASE = "fixed bottom-6 right-6 z-50 transform transition-all duration-300 ease-in-out px-4 py-2.5 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-medium";
    const TOAST_ESTILOS = {
      guardando: { icono: 'clock',  clase: "bg-slate-900 text-white border-slate-700" },
      exito:     { icono: 'check',  clase: "bg-emerald-900 text-white border-emerald-700" },
      error:     { icono: 'alerta', clase: "bg-red-900 text-white border-red-700" },
      aviso:     { icono: 'alerta', clase: "bg-amber-500 text-slate-950 border-amber-400" },
      info:      { icono: 'sync',   clase: "bg-slate-900 text-white border-slate-700" }
    };

    function pintarToast(texto, tipo) {
      const toast = document.getElementById('toast-notificacion');
      const icono = document.getElementById('toast-icono');
      const textoElemento = document.getElementById('toast-texto');
      const estilo = TOAST_ESTILOS[tipo] || TOAST_ESTILOS.info;

      textoElemento.textContent = texto;
      icono.innerHTML = estilo.icono === 'alerta'
        ? '<svg class="icon" viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
        : ICONS[estilo.icono];
      toast.className = `${TOAST_BASE} translate-y-0 opacity-100 ${estilo.clase}`;
      // Refuerzo a prueba de fallos: fija el z-index directo en el elemento con
      // !important, para que quede siempre por encima de CUALQUIER modal sin
      // depender del orden en que Tailwind (CDN) inyecte sus propias reglas.
      toast.style.setProperty('position', 'fixed', 'important');
      toast.style.setProperty('z-index', '2147483647', 'important');
    }

    function ocultarToast() {
      const toast = document.getElementById('toast-notificacion');
      toast.className = `${TOAST_BASE} translate-y-20 opacity-0 bg-slate-900 text-white border-slate-700`;
    }

    function procesarColaToast() {
      if (toastMostrandose || colaToast.length === 0) return;
      toastMostrandose = true;
      const siguiente = colaToast.shift();
      pintarToast(siguiente.texto, siguiente.tipo);
      setTimeout(() => {
        ocultarToast();
        setTimeout(() => {
          toastMostrandose = false;
          procesarColaToast();
        }, 320);
      }, 3000);
    }


    // ================= PULIDO UX GLOBAL =================
    let ultimaSincronizacionT28 = null;
    let ultimoDestacadoT28 = null;
    let tooltipT28 = null;

    function registrarSincronizacionT28() {
      ultimaSincronizacionT28 = new Date();
      const el = document.getElementById('sidebar-ultima-sync');
      if (!el) return;

      const hora = new Intl.DateTimeFormat('es-PE', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(ultimaSincronizacionT28).replace(/\s+/g, ' ').toUpperCase();

      el.textContent = hora;

      const cfgSync = document.getElementById('cfg-ultima-sync');
      if (cfgSync) cfgSync.textContent = hora;

      el.classList.remove('t28-sync-flash');
      void el.offsetWidth;
      el.classList.add('t28-sync-flash');
    }

    function animarNumeroT28(id, nuevoValor) {
      const el = document.getElementById(id);
      if (!el) return;
      if (esMovilRendimientoT28()) {
        el.textContent = nuevoValor;
        return;
      }

      const objetivo = Number(nuevoValor);
      const actual = Number(String(el.textContent || '').replace(/[^\d.-]/g, ''));
      if (!Number.isFinite(objetivo) || !Number.isFinite(actual) || actual === objetivo) {
        el.textContent = nuevoValor;
        return;
      }

      const inicio = performance.now();
      const duracion = 320;
      const desde = actual;

      function frame(t) {
        const p = Math.min(1, (t - inicio) / duracion);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(desde + (objetivo - desde) * ease);
        if (p < 1) requestAnimationFrame(frame);
        else {
          el.textContent = objetivo;
          el.classList.remove('t28-counter-pop');
          void el.offsetWidth;
          el.classList.add('t28-counter-pop');
        }
      }
      requestAnimationFrame(frame);
    }

    function marcarDestacadoT28(tipo, clave) {
      ultimoDestacadoT28 = {
        tipo,
        clave: normalizarTexto(clave || ''),
        vence: Date.now() + 5000
      };
    }

    function coincideDestacadoT28(tipo, ...valores) {
      if (!ultimoDestacadoT28 || ultimoDestacadoT28.tipo !== tipo || Date.now() > ultimoDestacadoT28.vence) return false;
      const bolsa = valores.map(v => normalizarTexto(v || '')).join(' | ');
      return !!ultimoDestacadoT28.clave && bolsa.includes(ultimoDestacadoT28.clave);
    }

    function activarTransicionModuloT28(el) {
      if (!el) return;
      if (esMovilRendimientoT28()) return;
      el.classList.remove('t28-module-enter');
      void el.offsetWidth;
      el.classList.add('t28-module-enter');
      setTimeout(() => el.classList.remove('t28-module-enter'), 260);
    }

    function htmlEstadoVacioT28(titulo, texto = '') {
      return `<div class="t28-empty-state">
        <div class="t28-empty-icon">
          <svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <div><strong>${escapeHtml(titulo)}</strong>${texto ? `<span>${escapeHtml(texto)}</span>` : ''}</div>
      </div>`;
    }

    function cerrarDetalleFilaMovilT28() {
      const modal = document.getElementById('modal-fila-mobile');
      if (modal) modal.classList.add('hidden');
    }

    function inicializarDetalleTablasMovilT28() {
      document.addEventListener('click', function(evento) {
        if (!window.matchMedia('(max-width: 768px)').matches) return;
        if (evento.target.closest('button, a, input, select, textarea, label')) return;

        const fila = evento.target.closest('tbody tr');
        if (!fila || fila.querySelector('td[colspan]')) return;

        const tabla = fila.closest('table');
        if (!tabla || !tabla.matches('#tabla-historial, #tabla-suministros')) return;

        const cabeceras = [...tabla.querySelectorAll('thead th')];
        const celdas = [...fila.children];
        const datos = celdas.map(function(celda, indice) {
          const etiqueta = String(cabeceras[indice]?.textContent || `Dato ${indice + 1}`).replace(/↕/g, '').trim();
          const valor = String(celda.textContent || '').replace(/\s+/g, ' ').trim();
          return { etiqueta, valor };
        }).filter(item => item.valor && item.etiqueta.toLowerCase() !== 'acción');

        if (!datos.length) return;
        const titulo = document.getElementById('modal-fila-mobile-titulo');
        const contenido = document.getElementById('modal-fila-mobile-contenido');
        const modal = document.getElementById('modal-fila-mobile');
        if (!titulo || !contenido || !modal) return;

        titulo.textContent = datos.find(item => /placa|usuario|empresa|suministro/i.test(item.etiqueta))?.valor || 'Información';
        contenido.innerHTML = datos.map(item => `
          <div class="t28-mobile-row-field">
            <span>${escapeHtml(item.etiqueta)}</span>
            <strong>${escapeHtml(item.valor)}</strong>
          </div>`).join('');
        modal.classList.remove('hidden');
      });

      document.getElementById('modal-fila-mobile')?.addEventListener('click', function(evento) {
        if (evento.target === this) cerrarDetalleFilaMovilT28();
      });
    }

    function htmlSkeletonT28(cantidad = 4) {
      return Array.from({length:cantidad}, () => `
        <div class="t28-skeleton-line-card">
          <span class="t28-sk t28-sk-icon"></span>
          <div class="t28-sk-col">
            <span class="t28-sk t28-sk-a"></span>
            <span class="t28-sk t28-sk-b"></span>
          </div>
        </div>`).join('');
    }

    function inicializarTooltipsT28() {
      if (tooltipT28) return;
      tooltipT28 = document.createElement('div');
      tooltipT28.id = 't28-tooltip';
      tooltipT28.className = 't28-tooltip';
      document.body.appendChild(tooltipT28);

      document.addEventListener('mouseover', function(e) {
        const target = e.target.closest('button[title], [data-tooltip]');
        if (!target) return;
        if (target.closest('#app-sidebar')) return;
        const texto = target.getAttribute('data-tooltip') || target.getAttribute('title');
        if (!texto) return;

        tooltipT28.textContent = texto;
        tooltipT28.classList.add('show');

        const r = target.getBoundingClientRect();
        const tr = tooltipT28.getBoundingClientRect();
        let left = r.left + r.width/2 - tr.width/2;
        let top = r.top - tr.height - 9;
        left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));
        if (top < 8) top = r.bottom + 9;
        tooltipT28.style.left = left + 'px';
        tooltipT28.style.top = top + 'px';
      });

      document.addEventListener('mouseout', function(e) {
        if (!e.target.closest('button[title], [data-tooltip]')) return;
        tooltipT28.classList.remove('show');
      });
    }

    function mostrarToast(texto, tipo = 'info') {
      if (tipo === 'exito' || tipo === 'error' || tipo === 'aviso') {
        colaToast.push({ texto, tipo });
        procesarColaToast();
        return;
      }
      // 'guardando' (y cualquier otro estado en curso) se pinta de inmediato,
      // sin pasar por la cola, porque representa el estado actual de una acción.
      pintarToast(texto, tipo);
    }

    function descargarDirectorioCSV() {
      const datos = Array.isArray(contactosFiltrados) && contactosFiltrados.length
        ? contactosFiltrados
        : (todosLosContactos || []);

      if (!datos.length) {
        mostrarToast('No hay contactos para descargar', 'aviso');
        return;
      }

      const buscador = document.getElementById('buscador-directorio');
      const filtrado = !!String(buscador?.value || '').trim();

      const texto = filtrado
        ? `Se descargarán ${datos.length} contactos que coinciden con la búsqueda actual.`
        : `Se descargarán los ${datos.length} contactos del Directorio.`;

      const textoEl = document.getElementById('texto-confirmacion-descarga');
      if (textoEl) textoEl.textContent = texto;

      const modal = document.getElementById('modal-confirmar-descarga');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function actualizarBotonDescargaContextual(modulo) {
      const btn = document.getElementById('btn-descarga-global');
      if (!btn) return;

      const texto = btn.querySelector('span');

      if (modulo === 'directorio') {
        btn.setAttribute('onclick', 'descargarDirectorioCSV()');
        btn.setAttribute('title', 'Descargar contactos');
        btn.style.display = 'flex';
        if (texto) texto.textContent = 'Descargar contactos';
        return;
      }

      // Función global normal para los módulos que ya la usaban.
      btn.setAttribute('onclick', 'descargarReporteExcel()');
      btn.setAttribute('title', 'Descargar reporte en Excel');
      if (texto) texto.textContent = 'Descargar';

      // El Excel de "Usuarios" exporta las asignaciones con estacionamiento.
      // Por eso NO debe aparecer en la pestaña Personal sin estacionamiento.
      const estaEnPersonalSinEst =
        modulo === 'empresas' && vistaUsuariosActual === 'personal';

      // Inicio e Historial tampoco usan el botón global.
      const mostrar =
        !['dashboard', 'historial', 'catalogoempresas', 'personasdirectorio'].includes(modulo) &&
        !estaEnPersonalSinEst;

      btn.style.display = mostrar ? 'flex' : 'none';
    }

    function actualizarSincronizacionTopbarT28(modulo) {
      const btn = document.getElementById('btn-sync-global');
      if (!btn) return;

      const acciones = {
        dashboard: ['Sincronizar Inicio', () => forzarActualizacion()],
        movimientos: ['Actualizar movimientos', () => cargarHistorialHoy(false)],
        empresas: vistaUsuariosActual === 'personal'
          ? ['Actualizar personal', () => cargarCatalogosIngresoServidor()]
          : ['Actualizar trabajadores fijos', () => cargarDatosServidor(true)],
        historial: ['Buscar historial', () => buscarHistorialRango()],
        directorio: ['Actualizar contactos', () => cargarDirectorioServidor(true, true)],
        personasdirectorio: ['Actualizar directorio', () => cargarPersonasDirectorioT28(true, true)],
        suministros: ['Actualizar suministros', () => cargarSuministrosServidor(true)],
        catalogoempresas: ['Actualizar empresas', () => cargarVistaEmpresasT28(true)]
      };

      const config = acciones[modulo];
      if (!config) {
        btn.style.setProperty('display', 'none', 'important');
        return;
      }

      btn.onclick = config[1];
      btn.setAttribute('title', config[0]);
      btn.setAttribute('aria-label', config[0]);
      btn.style.removeProperty('display');
    }

    function forzarActualizacion() {
      mostrarToast("Sincronizando...", "guardando");
      // En Inicio, Avisos confirma por separado el resultado para evitar que
      // otra consulta exitosa haga parecer que también se actualizaron avisos.
      cargarDatosServidor(moduloActual !== 'dashboard');
      if(moduloActual === 'movimientos' || moduloActual === 'dashboard') cargarHistorialHoy(false);
      if(moduloActual === 'suministros') cargarSuministrosServidor(true);
      if(moduloActual === 'directorio') cargarDirectorioServidor(true, true);
      if(moduloActual === 'catalogoempresas') cargarEmpresasCatalogoT28(false, true, true);
      if(moduloActual === 'dashboard') cargarAvisosDashboardT28(true);
    }

    function cargarDatosServidor(mostrarNotif) {
      if (cargandoDatosServidor) return;
      cargandoDatosServidor = true;

      if (!todosLosDatos.length && moduloActual === 'empresas') {
        renderSkeletonCards('vista-tarjetas-container', 3);
        renderSkeletonRows('tabla-cuerpo', 6, 4);
      }

      T28Api.estacionamientos()
        .then(function(res) {
          const data = res?.data;
          cargandoDatosServidor = false;
          ultimaCargaDatosT28 = Date.now();
          todosLosDatos = Array.isArray(data) ? data : [];

          ejecutarIdleT28(function() {
            try { localStorage.setItem('torre28_estacionamientos', JSON.stringify(todosLosDatos)); } catch(e) {}
          });

          poblarSelectEmpresas(todosLosDatos);
          actualizarContadoresGlobales(todosLosDatos);

          if (moduloActual === 'empresas') {
            filtrarDatos();
          } else if (moduloActual === 'dashboard') {
            ejecutarIdleT28(function() {
              if (moduloActual === 'dashboard') actualizarDashboard();
            }, 250);
          }

          if (!esMovilRendimientoT28() || elementoVisiblePorId('modal-ingreso')) {
            ejecutarIdleT28(prepararCatalogosIngreso, 400);
          }

          registrarSincronizacionT28();
          if(mostrarNotif) mostrarToast("¡Actualizado correctamente!", "exito");
        })
        .catch(function(error) {
          cargandoDatosServidor = false;
          if(mostrarNotif) mostrarToast('Error al sincronizar: ' + error.message, 'error');
          else console.error('Estacionamientos:', error);
        });
    }

    function actualizarVisibilidadFabT28() {
      const fab = document.getElementById('btn-dashboard-ingreso-flotante');
      if (!fab) return;

      const esTabletFab=window.matchMedia('(min-width:769px) and (max-width:1180px) and (pointer:coarse)').matches;
      const topbar=document.querySelector('.app-topbar > div');
      if(esTabletFab && topbar && fab.parentElement!==topbar) topbar.appendChild(fab);
      else if(!esTabletFab && fab.parentElement!==document.body) document.body.appendChild(fab);

      const accionesFab = {
        dashboard: {
          texto: 'Registrar ingreso',
          accion: () => abrirModalIngreso()
        },
        movimientos: {
          texto: 'Registrar ingreso',
          accion: () => abrirModalIngreso()
        },
        empresas: vistaUsuariosActual === 'personal'
          ? {
              texto: 'Nuevo personal sin estacionamiento',
              accion: () => abrirModalPersonalSinEstacionamiento()
            }
          : {
              texto: 'Nuevo trabajador fijo',
              accion: () => abrirModalNuevo()
            },
        catalogoempresas: {
          texto: 'Nueva empresa',
          accion: () => abrirFormEmpresaT28()
        },
        directorio: {
          texto: 'Nuevo contacto',
          accion: () => abrirModalDirectorio()
        },
        personasdirectorio: {
          texto: 'Nuevo registro',
          accion: () => abrirFormPersonaDirectorioT28()
        }
      };

      const configuracion = accionesFab[moduloActual] || null;
      accionFabActualT28 = configuracion?.accion || null;
      const permitido = Boolean(usuarioSesionT28) && !document.getElementById('t28-app-shell')?.classList.contains('t28-app-locked') && Boolean(configuracion) && !hayModalOperativoAbierto();

      if (configuracion) {
        fab.onpointerdown = null;
        // Un único click funciona con toque, mouse, teclado y navegadores Android antiguos.
        fab.onclick = function(evento) {
          evento.preventDefault();
          evento.stopPropagation();
          if (usuarioSesionT28 && !document.getElementById('t28-app-shell')?.classList.contains('t28-app-locked')) configuracion.accion();
        };
        fab.setAttribute('aria-label', configuracion.texto);
        fab.setAttribute('title', configuracion.texto);
        const texto = fab.querySelector('span');
        if (texto) texto.textContent = configuracion.texto;
      } else {
        fab.onpointerdown = null;
        fab.onclick = null;
      }

      // !important inline para ganar a reglas antiguas del CSS.
      fab.style.setProperty(
        'display',
        permitido ? 'inline-flex' : 'none',
        'important'
      );
    }

    document.addEventListener('pointerup', function(evento) {
      const fab = document.getElementById('btn-dashboard-ingreso-flotante');
      if (!fab || !accionFabActualT28 || fab.contains(evento.target) || hayModalOperativoAbierto()) return;
      const estilo = getComputedStyle(fab);
      if (estilo.display === 'none' || estilo.visibility === 'hidden') return;
      const r = fab.getBoundingClientRect();
      if (evento.clientX < r.left || evento.clientX > r.right || evento.clientY < r.top || evento.clientY > r.bottom) return;
      evento.preventDefault();
      evento.stopImmediatePropagation();
      accionFabActualT28();
    }, true);

    function resetFiltrosMovimientosEntradaT28() {
      const estado = document.getElementById('filtro-mov-estado');
      const tipo = document.getElementById('filtro-mov-tipo');
      const buscador = document.getElementById('buscador-mov');

      if (estado) estado.value = '';
      if (tipo) tipo.value = '';
      if (buscador) buscador.value = '';

      actualizarTarjetasFiltroEstado();
    }

    function actualizarBusquedaTopbarT28(modulo) {
      const wrap = document.getElementById('topbar-dashboard-search-wrap');
      const input = document.getElementById('dash-buscar-placa');
      if (!wrap || !input) return;

      document.body.classList.toggle('t28-mobile-dashboard', modulo === 'dashboard');

      const buscadores = {
        movimientos: ['buscador-mov', 'Buscar movimiento...'],
        empresas: [vistaUsuariosActual === 'personal' ? 'buscador-personal' : 'buscador', 'Buscar usuario...'],
        directorio: ['buscador-directorio', 'Buscar contacto...'],
        personasdirectorio: ['buscador-personasdirectorio', 'Buscar en directorio...'],
        suministros: ['buscador-suministros', 'Buscar suministro...'],
        catalogoempresas: ['empresa-config-buscar', 'Buscar empresa...']
      };

      if (modulo === 'dashboard') {
        wrap.classList.remove('hidden');
        input.dataset.target = '';
        input.placeholder = 'Buscar placa, persona, est. o empresa...';
        input.oninput = buscarPlacaDashboard;
        return;
      }

      const config = buscadores[modulo];
      wrap.classList.toggle('hidden', !config);
      cerrarBusquedaTopbarT28(false);
      cerrarResultadosBusquedaDashboardT28();
      if (!config) return;

      const destino = document.getElementById(config[0]);
      input.dataset.target = config[0];
      input.placeholder = config[1];
      input.value = destino?.value || '';
      input.oninput = function() {
        const campo = document.getElementById(this.dataset.target || '');
        if (!campo) return;
        campo.value = this.value;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        campo.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified' }));
      };
    }

    function toggleBusquedaTopbarT28(evento) {
      if (evento) { evento.preventDefault(); evento.stopPropagation(); }
      const search = document.getElementById('topbar-dashboard-search');
      const toggle = document.getElementById('topbar-search-toggle');
      if (!search) return;
      const abierto = search.classList.toggle('is-open');
      if (toggle) toggle.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      if (abierto) setTimeout(() => document.getElementById('dash-buscar-placa')?.focus(), 60);
      else cerrarResultadosBusquedaDashboardT28();
    }

    function cerrarBusquedaTopbarT28(limpiar = false) {
      const search = document.getElementById('topbar-dashboard-search');
      const toggle = document.getElementById('topbar-search-toggle');
      const input = document.getElementById('dash-buscar-placa');
      if (search) search.classList.remove('is-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      if (limpiar && input) input.value = '';
      cerrarResultadosBusquedaDashboardT28();
    }

    function cerrarResultadosBusquedaDashboardT28() {
      const resultados = document.getElementById('dash-buscar-resultados');
      if (resultados) resultados.classList.add('hidden');
    }

    function limpiarBusquedaTopbarT28(evento) {
      if (evento) { evento.preventDefault(); evento.stopPropagation(); }
      const input = document.getElementById('dash-buscar-placa');
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }
      cerrarResultadosBusquedaDashboardT28();
    }

    let ultimoTouchNavT28 = 0;
    let ultimoTouchMasT28 = 0;

    function menuMasMovilAbiertoT28() {
      const sheet = document.getElementById('mobile-more-sheet');
      return Boolean(sheet && !sheet.classList.contains('hidden'));
    }

    function actualizarEstadoNavMasT28(modulo) {
      const btn = document.getElementById('mnav-more');
      if (!btn) return;

      const modulosMas = ['directorio', 'personasdirectorio', 'suministros', 'catalogoempresas'];
      const activo = modulosMas.includes(modulo);

      btn.classList.toggle('active', activo);

      modulosMas.forEach(nombre => {
        const op = document.getElementById('more-nav-' + nombre);
        if (op) op.classList.toggle('is-active', nombre === modulo);
      });
    }

    function abrirMenuMasMovilT28() {
      const sheet = document.getElementById('mobile-more-sheet');
      const backdrop = document.getElementById('mobile-more-backdrop');
      const btn = document.getElementById('mnav-more');

      if (!sheet || !backdrop) return;

      sheet.classList.remove('hidden');
      backdrop.classList.remove('hidden');
      sheet.setAttribute('aria-hidden', 'false');
      backdrop.setAttribute('aria-hidden', 'false');
      if (btn) btn.setAttribute('aria-expanded', 'true');

      // Fuerza repaint antes de la animación.
      requestAnimationFrame(() => {
        sheet.classList.add('is-open');
        backdrop.classList.add('is-open');
      });

      actualizarEstadoNavMasT28(moduloActual);
    }

    function cerrarMenuMasMovilT28() {
      const sheet = document.getElementById('mobile-more-sheet');
      const backdrop = document.getElementById('mobile-more-backdrop');
      const btn = document.getElementById('mnav-more');

      if (!sheet || !backdrop) return;

      sheet.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      sheet.setAttribute('aria-hidden', 'true');
      backdrop.setAttribute('aria-hidden', 'true');
      if (btn) btn.setAttribute('aria-expanded', 'false');

      setTimeout(() => {
        if (!sheet.classList.contains('is-open')) sheet.classList.add('hidden');
        if (!backdrop.classList.contains('is-open')) backdrop.classList.add('hidden');
      }, 180);
    }

    function toggleMenuMasMovilT28(evento) {
      const tipo = evento?.type || '';

      if (tipo === 'touchstart') {
        ultimoTouchNavT28 = Date.now();
        if (evento.cancelable) evento.preventDefault();
        evento.stopPropagation();

        if (menuMasMovilAbiertoT28()) cerrarMenuMasMovilT28();
        else abrirMenuMasMovilT28();
        return false;
      }

      if (tipo === 'click' && Date.now() - ultimoTouchNavT28 < 700) {
        if (evento.cancelable) evento.preventDefault();
        evento.stopPropagation();
        return false;
      }

      if (evento?.cancelable) evento.preventDefault();
      evento?.stopPropagation?.();

      if (menuMasMovilAbiertoT28()) cerrarMenuMasMovilT28();
      else abrirMenuMasMovilT28();
      return false;
    }

    function navegarDesdeMasMovilT28(evento, modulo) {
      const tipo = evento?.type || '';

      if (tipo === 'touchstart') {
        ultimoTouchMasT28 = Date.now();
        if (evento.cancelable) evento.preventDefault();
        evento.stopPropagation();

        cerrarMenuMasMovilT28();
        pintarModuloMovilInmediatoT28(modulo);
        return false;
      }

      if (tipo === 'click' && Date.now() - ultimoTouchMasT28 < 700) {
        if (evento.cancelable) evento.preventDefault();
        evento.stopPropagation();
        return false;
      }

      if (evento?.cancelable) evento.preventDefault();
      evento?.stopPropagation?.();

      cerrarMenuMasMovilT28();
      pintarModuloMovilInmediatoT28(modulo);
      return false;
    }


    function pintarModuloMovilInmediatoT28(modulo) {
      if (!tienePermisoT28(permisoModuloT28(modulo))) {
        mostrarToast('Tu cuenta no tiene acceso a esta sección.', 'error');
        return;
      }
      const modulos = ['dashboard','movimientos','empresas','historial','directorio','personasdirectorio','suministros','catalogoempresas'];
      const moduloAnterior = moduloActual;

      if (modulo === 'movimientos' && moduloAnterior !== 'movimientos') {
        resetFiltrosMovimientosEntradaT28();
      }

      moduloActual = modulo;
      const secuencia = ++cambioModuloSecuenciaT28;

      // Inline styles ganan a todas las capas CSS antiguas.
      modulos.forEach(function(nombre) {
        const panel = document.getElementById('modulo-' + nombre);
        const mnav = document.getElementById('mnav-' + nombre);
        const nav = document.getElementById('nav-' + nombre);

        if (panel) {
          if (nombre === modulo) {
            panel.classList.remove('hidden');
panel.style.setProperty(
  'display',
  nombre === 'dashboard' ? 'grid' : 'block',
  'important'
);
            panel.style.visibility = 'visible';
            panel.style.pointerEvents = 'auto';
          } else {
            panel.classList.add('hidden');
            panel.style.setProperty('display', 'none', 'important');
            panel.style.visibility = 'hidden';
            panel.style.pointerEvents = 'none';
          }
        }

        if (mnav) mnav.classList.toggle('active', nombre === modulo);
        if (nav) nav.classList.toggle('active', nombre === modulo);
      });

      actualizarEstadoNavMasT28(modulo);
      actualizarBusquedaTopbarT28(modulo);
      cerrarMenuMasMovilT28();

      const nombres = {
        dashboard: ['Inicio', 'Resumen operativo del edificio'],
        movimientos: ['Movimientos Hoy', 'Actividad vehicular registrada durante el día'],
        empresas: ['Usuarios', 'Trabajadores fijos y personal sin estacionamiento'],
        historial: ['Historial', 'Consulta de movimientos por rango de fechas'],
        directorio: ['Contactos', 'Contactos operativos y proveedores del edificio'],
        personasdirectorio: ['Directorio', 'Personas, empresas e imágenes autorizadas'],
        suministros: ['Suministros de Luz', 'Información y notas de suministros'],
        catalogoempresas: ['Empresas', 'Catálogo maestro, logos y observaciones']
      };

      const meta = nombres[modulo] || [modulo, ''];
      const titulo = document.getElementById('titulo-modulo');
      const subtitulo = document.getElementById('subtitulo-modulo');
      if (titulo) titulo.textContent = meta[0];
      if (subtitulo) subtitulo.textContent = meta[1];

      actualizarVisibilidadFabT28();

      const dist = document.getElementById('btn-distribucion-mobile');
      if (dist) dist.classList.toggle('hidden', modulo !== 'dashboard');

      actualizarBotonDescargaContextual(modulo);
      actualizarSincronizacionTopbarT28(modulo);

      // Siempre llevar la nueva vista arriba.
      try { window.scrollTo(0, 0); } catch(e) {}

      // Carga de datos DESPUÉS de que la interfaz ya cambió.
      setTimeout(function() {
        if (secuencia !== cambioModuloSecuenciaT28 || moduloActual !== modulo) return;
        ejecutarCargaModuloT28(modulo, secuencia);
      }, 180);
    }

    function navegarMovilT28(evento, modulo) {
      const tipo = evento?.type || '';

      if (tipo === 'touchstart') {
        ultimoTouchNavT28 = Date.now();

        // El navbar no debe convertirse en gesto de scroll.
        if (evento.cancelable) evento.preventDefault();
        evento.stopPropagation();

        pintarModuloMovilInmediatoT28(modulo);
        return false;
      }

      // El navegador suele generar click después del touchstart:
      // ignoramos ese segundo evento para no abrir dos veces.
      if (tipo === 'click' && Date.now() - ultimoTouchNavT28 < 700) {
        if (evento.cancelable) evento.preventDefault();
        evento.stopPropagation();
        return false;
      }

      // Mouse / emulación móvil / accesibilidad.
      if (evento?.cancelable) evento.preventDefault();
      evento?.stopPropagation?.();
      pintarModuloMovilInmediatoT28(modulo);
      return false;
    }

    function ejecutarCargaModuloT28(modulo, secuencia) {
      if (secuencia !== cambioModuloSecuenciaT28 || moduloActual !== modulo) return;

      if (modulo === 'dashboard') {
        actualizarDashboard();
        if (!avisosT28.length && !avisosCargandoT28) cargarAvisosDashboardT28(false);
        return;
      }

      if (modulo === 'empresas') {
        // Si el usuario dejó abierta la pestaña Personal sin estacionamiento,
        // en móvil hay que pedir sus catálogos al volver a Usuarios.
        if (vistaUsuariosActual === 'personal') {
          if (catalogosIngresoListosT28) {
            prepararPersonalSinEstacionamiento();
          } else {
            mostrarCargaPersonalSinEstacionamientoT28();
            cargarCatalogosIngresoServidor();
          }
        }

        if (todosLosDatos.length) {
          filtrarDatos();

          if (esMovilRendimientoT28() &&
              Date.now() - ultimaCargaDatosT28 > 120000 &&
              !cargandoDatosServidor) {
            ejecutarIdleT28(() => {
              if (moduloActual === 'empresas') cargarDatosServidor(false);
            }, 650);
          }
        } else {
          cargarDatosServidor(false);
        }
        return;
      }

      if (modulo === 'movimientos') {
        if (esMovilRendimientoT28() &&
            movimientosHoy.length &&
            Date.now() - ultimaCargaMovimientosT28 < 45000) {
          poblarFiltrosMovimientos();
          filtrarMovimientos();
        } else {
          cargarHistorialHoy(true);
        }
        return;
      }

      if (modulo === 'directorio') {
        cargarDirectorioServidor(false, false);
        return;
      }

      if (modulo === 'personasdirectorio') {
        if (personasDirectorioT28.length) filtrarPersonasDirectorioT28();
        else {
          const grid = document.getElementById('personasdirectorio-grid');
          if (grid && !grid.children.length) grid.innerHTML = htmlSkeletonPersonasDirectorioT28(esMovilRendimientoT28()?3:4);
        }
        cargarPersonasDirectorioT28(false, true);
        return;
      }

      if (modulo === 'catalogoempresas') {
        cargarVistaEmpresasT28(false);
        return;
      }

      if (modulo === 'suministros') {
        if (todosLosSuministros.length === 0) cargarSuministrosServidor(false);
        else renderizarTablaSuministros(todosLosSuministros);
      }
    }

    function cambiarModulo(modulo) {
      const modulosValidos = ['dashboard','movimientos','empresas','historial','directorio','personasdirectorio','suministros','catalogoempresas'];
      if (!modulosValidos.includes(modulo)) return;
      if (!tienePermisoT28(permisoModuloT28(modulo))) {
        mostrarToast('Tu cuenta no tiene acceso a esta sección.', 'error');
        return;
      }

      const moduloAnterior = moduloActual;
      if (modulo === 'movimientos' && moduloAnterior !== 'movimientos') {
        resetFiltrosMovimientosEntradaT28();
      }

      moduloActual = modulo;
      const secuencia = ++cambioModuloSecuenciaT28;

      // PRIMERO: cambio visual inmediato. Nada pesado antes de esto.
      modulosValidos.forEach(nombre => {
        const nav = document.getElementById('nav-' + nombre);
        const mod = document.getElementById('modulo-' + nombre);
        const mnav = document.getElementById('mnav-' + nombre);

        if (nav) nav.classList.toggle('active', nombre === modulo);
        if (mnav) mnav.classList.toggle('active', nombre === modulo);

        if (mod) {
          // Limpia overrides de la navegación táctil antes de usar flujo normal.
          mod.style.removeProperty('display');
          mod.style.removeProperty('visibility');
          mod.style.removeProperty('pointer-events');

          if (nombre === modulo) mod.classList.remove('hidden');
          else mod.classList.add('hidden');
        }
      });

      actualizarEstadoNavMasT28(modulo);
      actualizarBusquedaTopbarT28(modulo);
      cerrarMenuMasMovilT28();

      const nombres = {
        dashboard: ['Inicio', 'Resumen operativo del edificio'],
        movimientos: ['Movimientos Hoy', 'Actividad vehicular registrada durante el día'],
        empresas: ['Usuarios', 'Trabajadores fijos y personal sin estacionamiento'],
        historial: ['Historial', 'Consulta de movimientos por rango de fechas'],
        directorio: ['Contactos', 'Contactos operativos y proveedores del edificio'],
        personasdirectorio: ['Directorio', 'Personas, empresas e imágenes autorizadas'],
        suministros: ['Suministros de Luz', 'Información y notas de suministros'],
        catalogoempresas: ['Empresas', 'Catálogo maestro, logos y observaciones']
      };

      const meta = nombres[modulo] || [modulo, ''];
      const titulo = document.getElementById('titulo-modulo');
      const subtitulo = document.getElementById('subtitulo-modulo');
      if (titulo) titulo.textContent = meta[0];
      if (subtitulo) subtitulo.textContent = meta[1];

      actualizarBotonDescargaContextual(modulo);
      actualizarSincronizacionTopbarT28(modulo);

      actualizarVisibilidadFabT28();

      const btnDescarga = document.getElementById('btn-descarga-global');
      if (btnDescarga && modulo !== 'directorio') {
        const ocultarEnPersonal =
          modulo === 'empresas' && vistaUsuariosActual === 'personal';

        btnDescarga.style.display =
          (!['dashboard', 'historial', 'catalogoempresas', 'personasdirectorio'].includes(modulo) && !ocultarEnPersonal)
            ? 'flex'
            : 'none';
      }

      const btnDistribucion = document.getElementById('btn-distribucion-mobile');
      if (btnDistribucion) btnDistribucion.classList.toggle('hidden', modulo !== 'dashboard');
      if (modulo !== 'dashboard') cerrarDistribucionDesktop();

      const modActivo = document.getElementById('modulo-' + modulo);

      // En PC mantenemos transición. En móvil evitamos cualquier trabajo
      // antes del primer repintado.
      if (!esMovilRendimientoT28()) {
        activarTransicionModuloT28(modActivo);
        ejecutarCargaModuloT28(modulo, secuencia);
        return;
      }

      // Fuerza al navegador a pintar la nueva vista ANTES de renderizar tablas.
      requestAnimationFrame(function() {
        if (secuencia !== cambioModuloSecuenciaT28) return;

        requestAnimationFrame(function() {
          if (secuencia !== cambioModuloSecuenciaT28) return;

          // deja respirar al hilo principal para terminar el toque/scroll
          setTimeout(function() {
            ejecutarCargaModuloT28(modulo, secuencia);
          }, 35);
        });
      });
    }

    function abrirDistribucionMobile() {
      const modal = document.getElementById('modal-distribucion-mobile');
      if (!modal) return;
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.body.classList.add('overflow-hidden');
    }

    function cerrarDistribucionMobile() {
      const modal = document.getElementById('modal-distribucion-mobile');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.classList.remove('overflow-hidden');
    }

    function accionDistribucion() {
      if (window.innerWidth <= 640) {
        abrirDistribucionMobile();
        return;
      }
      const panel = document.getElementById('dashboard-distribucion');
      const btn = document.getElementById('btn-distribucion-mobile');
      if (!panel) return;

      const abierto = panel.classList.toggle('dist-open');
      if (btn) btn.classList.toggle('dist-active', abierto);
    }

    function cerrarDistribucionDesktop() {
      const panel = document.getElementById('dashboard-distribucion');
      const btn = document.getElementById('btn-distribucion-mobile');
      if (panel) panel.classList.remove('dist-open');
      if (btn) btn.classList.remove('dist-active');
    }

    function obtenerPuestoPlanoT28(numero) {
      const numeroTxt = String(numero);
      const maestro = (todosLosDatos || []).find(item => String(item?.est ?? '').trim() === numeroTxt) || null;
      const movimiento = (movimientosHoy || []).find(mov =>
        String(mov?.est ?? '').trim() === numeroTxt && normalizarTexto(mov?.estado).includes('abierto')
      ) || null;
      return { numero, maestro, movimiento };
    }

    function htmlPuestoPlanoT28(numero) {
      const puesto = obtenerPuestoPlanoT28(numero);
      const clase = !puesto.maestro ? 'is-missing' : (puesto.movimiento ? 'is-busy' : 'is-free');
      const estado = !puesto.maestro ? 'Sin registro' : (puesto.movimiento ? 'Ocupado' : 'Libre');
      const placa = puesto.movimiento?.placa || '';
      return `<button type="button" class="t28-parking-space ${clase}" onclick="seleccionarPuestoPlanoT28(${Number(numero)})" aria-label="Estacionamiento ${Number(numero)}, ${estado}">
        <span>EST.</span><strong>${Number(numero)}</strong><small>${escapeHtml(placa || estado)}</small>
      </button>`;
    }

    function renderPlanoEstacionamientosT28() {
      const arriba = document.getElementById('t28-parking-row-top');
      const abajo = document.getElementById('t28-parking-row-bottom');
      if (!arriba || !abajo) return;
      arriba.innerHTML = [10,11,12,13,14,15,16,17].map(htmlPuestoPlanoT28).join('');
      abajo.innerHTML = [24,23,22,21,20,19,18].map(htmlPuestoPlanoT28).join('');
    }

    function abrirPlanoEstacionamientosT28(nivel) {
      if (nivel !== 'S1') return;
      renderPlanoEstacionamientosT28();
      const modal = document.getElementById('modal-plano-estacionamientos');
      if (!modal) return;
      modal.classList.remove('hidden');
      modal.classList.add('is-open');
      document.body.classList.add('overflow-hidden');
    }

    function cerrarPlanoEstacionamientosT28() {
      const modal = document.getElementById('modal-plano-estacionamientos');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.classList.remove('is-open');
      document.body.classList.remove('overflow-hidden');
    }

    function cerrarPlanoDesdeFondoT28(evento) {
      if (evento?.target?.id === 'modal-plano-estacionamientos') cerrarPlanoEstacionamientosT28();
    }

    function seleccionarPuestoPlanoT28(numero) {
      const { maestro, movimiento } = obtenerPuestoPlanoT28(numero);
      const detalle = document.getElementById('t28-parking-map-detail');
      if (!detalle) return;
      document.querySelectorAll('.t28-parking-space.is-selected').forEach(el => el.classList.remove('is-selected'));
      document.querySelector(`.t28-parking-space[aria-label^="Estacionamiento ${Number(numero)},"]`)?.classList.add('is-selected');
      if (!maestro) {
        detalle.innerHTML = `<div><small>ESTACIONAMIENTO ${Number(numero)}</small><strong>Sin registro en el sistema</strong><p>Este espacio aparece en el plano físico, pero todavía no figura en la hoja de estacionamientos.</p></div>`;
        return;
      }
      const ocupanteAsignado = (maestro.ocupantes || []).find(oc => normalizarTexto(oc?.usuario) !== 'libre');
      const ocupado = Boolean(movimiento);
      detalle.innerHTML = `<div>
        <small>ESTACIONAMIENTO ${Number(numero)} · SÓTANO 1</small>
        <strong class="${ocupado ? 'is-busy-text' : 'is-free-text'}">${ocupado ? 'Ocupado actualmente' : 'Libre actualmente'}</strong>
        <p>${ocupado ? `${escapeHtml(movimiento.placa || 'Sin placa')} · ${escapeHtml(movimiento.nombre || 'Sin nombre')}` : 'No tiene un movimiento abierto en este momento.'}</p>
      </div><dl>
        <div><dt>Empresa asignada</dt><dd>${escapeHtml(maestro.empresa || 'Sin empresa')}</dd></div>
        <div><dt>Usuario asignado</dt><dd>${escapeHtml(ocupanteAsignado?.usuario || 'LIBRE')}</dd></div>
        <div><dt>Ingreso actual</dt><dd>${escapeHtml(movimiento?.horaEntrada || '—')}</dd></div>
      </dl>`;
    }

    function abrirSidebarMovil() {
      document.getElementById('app-sidebar').classList.add('open');
      document.getElementById('mobile-overlay').classList.add('show');
    }

    function cerrarSidebarMovil() {
      document.getElementById('app-sidebar').classList.remove('open');
      document.getElementById('mobile-overlay').classList.remove('show');
    }

    function actualizarDashboard() {
      const movs = Array.isArray(movimientosHoy) ? movimientosHoy : [];
      const total = movs.length;
      const abiertos = movs.filter(m => normalizarTexto(m.estado).includes('abierto')).length;
      const finalizados = total - abiertos;
      const puestos = Array.isArray(todosLosDatos) ? todosLosDatos : [];

      const poner = (id, valor) => animarNumeroT28(id, valor);
      poner('dash-mov-total', total);
      poner('dash-mov-abiertos', abiertos);
      poner('dash-mov-finalizados', finalizados);
      poner('dash-empresas-total', new Set(puestos.map(p => (p.empresa || '').toString().trim()).filter(Boolean)).size);
      poner('dash-est-total', puestos.length);

      // Mantiene el plano físico sincronizado con los movimientos abiertos.
      renderPlanoEstacionamientosT28();

      // Estado operativo compacto
      const ahoraDash = new Date();
      let mas1h = 0;
      let mas3h = 0;
      movs.filter(m => normalizarTexto(m.estado).includes('abierto')).forEach(m => {
        const entrada = parseFechaDisplayADate(m.horaEntrada);
        if (!entrada) return;
        const mins = (ahoraDash - entrada) / 60000;
        if (mins >= 60) mas1h++;
        if (mins >= 180) mas3h++;
      });
      poner('dash-op-abiertos', abiertos);
      poner('dash-op-finalizados', finalizados);
      poner('dash-op-atencion', mas1h);
      poner('dash-op-criticos', mas3h);

      const cont = document.getElementById('dash-ultimos-mov');
      if (!cont) return;
      if (!movs.length) {
        cont.innerHTML = htmlEstadoVacioT28('Sin movimientos hoy', 'Los nuevos ingresos aparecerán aquí automáticamente.');
        return;
      }
      cont.innerHTML = movs.slice(0, 6).map(m => {
        const estilo = obtenerEstiloEmpresa(m.empresa);
        const estadoAbierto = normalizarTexto(m.estado).includes('abierto');
        return `<div class="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition">
          <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
            <svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M5 11 6.5 6a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 11"/><rect x="3" y="11" width="18" height="7" rx="2"/><circle cx="7.5" cy="18" r="1.4"/><circle cx="16.5" cy="18" r="1.4"/></svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono font-bold text-xs text-slate-900 whitespace-nowrap">${escapeHtml(m.placa || '---')}</span>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${estilo.bg} ${estilo.text}">${escapeHtml(m.empresa || 'N/A')}</span>
            </div>
            <p class="text-xs text-slate-700 truncate mt-0.5">${escapeHtml(m.nombre || 'Sin Nombre')} · Est. ${escapeHtml(m.est || 'N/A')}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-[10px] text-slate-500">${escapeHtml(m.horaEntrada || '')}</p>
            <span class="text-[9px] font-bold ${estadoAbierto ? 'text-amber-600' : 'text-emerald-600'}">${escapeHtml(m.estado || '')}</span>
          </div>
        </div>`;
      }).join('');

      actualizarAlertasTiempo();
      actualizarInsightsDashboard();
    }


    function irDesdeStatDashboard(destino) {
      if (destino === 'empresas') {
        cambiarModulo('empresas');
        return;
      }

      if (destino === 'estacionamientos') {
        if (moduloActual !== 'dashboard') cambiarModulo('dashboard');
        setTimeout(() => accionDistribucion(), 80);
        return;
      }

      cambiarModulo('movimientos');
      setTimeout(() => {
        if (destino === 'abiertos') filtrarDesdeTarjetaEstado('abiertos');
        else if (destino === 'finalizados') filtrarDesdeTarjetaEstado('finalizados');
        else filtrarDesdeTarjetaEstado('todos');
      }, 80);
    }

    // ================= ALERTAS DE TIEMPO (Inicio) =================
    // Lista los movimientos abiertos ordenados por cuánto tiempo llevan sin
    // salida, para detectar vehículos "olvidados" de un vistazo.
    function actualizarAlertasTiempo() {
      const cont = document.getElementById('dash-alertas-tiempo-lista');
      if (!cont) return;

      const ahora = new Date();
      const abiertos = (movimientosHoy || [])
        .filter(m => normalizarTexto(m.estado).includes('abierto'))
        .map(m => {
          const entrada = parseFechaDisplayADate(m.horaEntrada);
          const minutos = entrada ? (ahora - entrada) / 60000 : 0;
          return { mov: m, minutos };
        })
        .sort((a, b) => b.minutos - a.minutos)
        .slice(0, 6);

      if (!abiertos.length) {
        cont.innerHTML = `<div class="p-8 text-center text-xs text-slate-400 btn-icon-inline justify-center">
          <svg class="icon" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> No hay vehículos con movimiento abierto ahora mismo.
        </div>`;
        return;
      }

      cont.innerHTML = abiertos.map(({ mov: m, minutos }) => {
        const estilo = obtenerEstiloEmpresa(m.empresa);
        let badgeBg = 'var(--t28-surface-2)', badgeFg = 'var(--t28-text-soft)', iconBg = 'var(--t28-surface-2)', iconFg = 'var(--t28-text-soft)';
        let prioridad = 'normal';
        let prioridadTxt = 'Normal';
        if (minutos >= 180) {
          badgeBg = 'rgba(215,55,63,.12)'; badgeFg = 'var(--t28-danger)';
          iconBg = 'rgba(215,55,63,.10)'; iconFg = 'var(--t28-danger)';
          prioridad = 'critico'; prioridadTxt = 'Crítico';
        } else if (minutos >= 60) {
          badgeBg = 'rgba(242,169,34,.16)'; badgeFg = 'var(--t28-accent-dark)';
          iconBg = 'rgba(242,169,34,.14)'; iconFg = 'var(--t28-accent-dark)';
          prioridad = 'atencion'; prioridadTxt = 'Atención';
        }

        return `<button type="button" onclick="abrirDetalleMovimiento(${Number(m.filaIndex)})" class="dash-alert-row dash-prioridad-${prioridad} w-full text-left px-4 py-3 flex items-center gap-3 transition">
          <span class="dash-priority-bar"></span>
          <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:${iconBg};color:${iconFg}">
            <svg class="icon" viewBox="0 0 24 24"><path d="M5 11 6.5 6a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 11"/><rect x="3" y="11" width="18" height="7" rx="2"/><circle cx="7.5" cy="18" r="1.4"/><circle cx="16.5" cy="18" r="1.4"/></svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono font-bold text-xs text-slate-900">${escapeHtml(m.placa || '---')}</span>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${estilo.bg} ${estilo.text}">${escapeHtml(m.empresa || 'N/A')}</span>
              ${prioridad !== 'normal' ? `<span class="dash-priority-label is-${prioridad}">${prioridadTxt}</span>` : ''}
            </div>
            <p class="text-xs text-slate-600 truncate mt-0.5">${escapeHtml(m.nombre || 'Sin nombre')} · Est. ${escapeHtml(m.est || 'N/A')}</p>
          </div>
          <span class="text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0" style="background:${badgeBg};color:${badgeFg}">${formatearDuracion(minutos)}</span>
        </button>`;
      }).join('');
    }

    // ================= BÚSQUEDA RÁPIDA GLOBAL (Inicio) =================
    // Busca por placa, persona, estacionamiento, empresa y documento.
    function normalizarBusquedaDashboard(valor) {
      return normalizarTexto(valor || '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function coincideBusquedaDashboard(texto, campos) {
      const q = normalizarBusquedaDashboard(texto);
      if (!q) return false;

      const bolsa = campos
        .filter(v => v !== null && v !== undefined)
        .map(v => normalizarBusquedaDashboard(v))
        .join(' | ');

      // También compara sin espacios para placas escritas como AZZ060 / AZZ 060.
      return bolsa.includes(q) ||
        bolsa.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
    }

    function buscarPlacaDashboard() {
      const input = document.getElementById('dash-buscar-placa');
      const cont = document.getElementById('dash-buscar-resultados');
      if (!input || !cont) return;

      const texto = normalizarBusquedaDashboard(input.value);
      if (!texto) {
        cont.classList.add('hidden');
        cont.innerHTML = '';
        return;
      }

      const resultados = [];
      const clavesListadas = new Set();

      // 1) Movimientos de HOY: placa, persona, empresa, estacionamiento y documento.
      (movimientosHoy || []).forEach(m => {
        if (!coincideBusquedaDashboard(texto, [
          m.placa,
          m.nombre,
          m.empresa,
          m.est,
          `est ${m.est || ''}`,
          `estacionamiento ${m.est || ''}`,
          m.documento,
          m.tipoIngreso,
          m.estado
        ])) return;

        const clave = 'mov-' + String(m.filaIndex || m.id || [m.placa, m.horaEntrada].join('-'));
        if (clavesListadas.has(clave)) return;
        clavesListadas.add(clave);
        resultados.push({ tipo: 'movimiento', mov: m });
      });

      // 2) Asignaciones fijas: placa, usuario, empresa y estacionamiento.
      (todosLosDatos || []).forEach(item => {
        (item.ocupantes || []).forEach(o => {
          if (o.esVirtual === true) return;

          const coincide = coincideBusquedaDashboard(texto, [
            o.placa,
            o.usuario,
            item.empresa,
            item.est,
            `est ${item.est || ''}`,
            `estacionamiento ${item.est || ''}`,
            item.ubi,
            item.ubicacion
          ]);

          if (!coincide) return;

          const clave = 'fijo-' + [
            String(item.est || ''),
            normalizarBusquedaDashboard(o.placa || ''),
            normalizarBusquedaDashboard(o.usuario || '')
          ].join('-');

          if (clavesListadas.has(clave)) return;
          clavesListadas.add(clave);

          // Si esa misma placa ya tiene movimiento hoy, priorizamos el movimiento
          // y evitamos duplicarla como asignación fija.
          const placaNorm = normalizarBusquedaDashboard(o.placa || '').replace(/\s+/g, '');
          const yaEnMovimiento = placaNorm && resultados.some(r =>
            r.tipo === 'movimiento' &&
            normalizarBusquedaDashboard(r.mov?.placa || '').replace(/\s+/g, '') === placaNorm
          );
          if (!yaEnMovimiento) resultados.push({ tipo: 'fijo', item, ocupante: o });
        });
      });

      if (!resultados.length) {
        cont.innerHTML = `
          <div class="dash-search-empty">
            <svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <div>
              <strong>Sin coincidencias</strong>
              <span>Prueba con placa, nombre, empresa o estacionamiento.</span>
            </div>
          </div>`;
        cont.classList.remove('hidden');
        return;
      }

      cont.innerHTML = resultados.slice(0, 7).map(r => {
        if (r.tipo === 'movimiento') {
          const m = r.mov;
          const abierto = normalizarTexto(m.estado).includes('abierto');
          const estilo = obtenerEstiloEmpresa(m.empresa);
          const salida = String(m.horaSalida || '').trim();

          return `<button type="button" onclick="irADetalleDesdeBusquedaDash(${Number(m.filaIndex)})" class="dash-search-card dash-search-card-mov">
            <div class="dash-search-origin-row">
              <span class="dash-search-origin is-mov">
                <svg class="icon" viewBox="0 0 24 24"><path d="M5 11 6.5 6a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 11"/><rect x="3" y="11" width="18" height="7" rx="2"/></svg>
                MOVIMIENTO DE HOY
              </span>
              <span class="dash-search-status ${abierto ? 'is-open' : 'is-closed'}">${escapeHtml(m.estado || (abierto ? 'Abierto' : 'Cerrado'))}</span>
            </div>

            <div class="dash-search-main">
              <span class="parking-plate t28-plate">${escapeHtml(m.placa || '---')}</span>
              <div class="dash-search-person">${escapeHtml(m.nombre || 'Sin nombre')}</div>
            </div>

            <div class="dash-search-meta">
              <span class="dash-search-company ${estilo.bg} ${estilo.text}">${escapeHtml(m.empresa || 'N/A')}</span>
              <span class="dash-search-meta-chip">Est. ${escapeHtml(m.est || 'N/A')}</span>
            </div>

            <div class="dash-search-times">
              <div>
                <span>ENTRADA</span>
                <strong>${escapeHtml(m.horaEntrada || '---')}</strong>
              </div>
              <div>
                <span>SALIDA</span>
                <strong class="${salida ? '' : 'is-pending'}">${escapeHtml(salida || 'Pendiente')}</strong>
              </div>
            </div>

            <div class="dash-search-hint">
              <span>Ver en Movimientos Hoy</span>
              <span>→</span>
            </div>
          </button>`;
        }

        const estilo = obtenerEstiloEmpresa(r.item.empresa);
        const placa = r.ocupante.placa && r.ocupante.placa !== '---'
          ? r.ocupante.placa
          : 'SIN PLACA';
        const usuario = r.ocupante.usuario || 'LIBRE';
        const libre = normalizarTexto(usuario) === 'libre';

        return `<button type="button" onclick="irAUsuarioDesdeBusquedaDash('${escapeHtml(r.ocupante.placa || '')}', '${escapeHtml(r.ocupante.usuario || '')}', '${escapeHtml(r.item.est || '')}')" class="dash-search-card dash-search-card-user">
          <div class="dash-search-origin-row">
            <span class="dash-search-origin is-user">
              <svg class="icon" viewBox="0 0 24 24"><circle cx="9" cy="7" r="3"/><path d="M3.5 19c.5-4 2.5-6 5.5-6s5 2 5.5 6"/></svg>
              USUARIOS · ASIGNACIÓN
            </span>
            <span class="dash-search-status ${libre ? 'is-free' : 'is-idle'}">${libre ? 'Libre' : 'Asignado'}</span>
          </div>

          <div class="dash-search-main">
            <span class="parking-plate t28-plate">${escapeHtml(placa)}</span>
            <div class="dash-search-person">${escapeHtml(usuario)}</div>
          </div>

          <div class="dash-search-meta">
            <span class="dash-search-company ${estilo.bg} ${estilo.text}">${escapeHtml(r.item.empresa || 'N/A')}</span>
            <span class="dash-search-meta-chip">Est. ${escapeHtml(r.item.est || 'N/A')}</span>
            ${r.item.ubi ? `<span class="dash-search-meta-chip">${escapeHtml(r.item.ubi)}</span>` : ''}
          </div>

          <div class="dash-search-assignment-note">
            <span>REGISTRO</span>
            <strong>${libre ? 'Estacionamiento disponible' : 'Usuario asignado a este puesto'}</strong>
          </div>

          <div class="dash-search-hint">
            <span>Ver en Usuarios</span>
            <span>→</span>
          </div>
        </button>`;
      }).join('');

      cont.classList.remove('hidden');
    }

    function irADetalleDesdeBusquedaDash(filaIndex) {
      document.getElementById('dash-buscar-resultados').classList.add('hidden');
      document.getElementById('dash-buscar-placa').value = '';
      cambiarModulo('movimientos');
      setTimeout(() => abrirDetalleMovimiento(filaIndex), 90);
    }

    function irAUsuarioDesdeBusquedaDash(placa, usuario, est) {
      document.getElementById('dash-buscar-resultados').classList.add('hidden');
      document.getElementById('dash-buscar-placa').value = '';
      cambiarModulo('empresas');
      setTimeout(() => {
        const buscador = document.getElementById('buscador');
        if (!buscador) return;
        // Usa el dato más específico disponible.
        buscador.value = placa || usuario || est || '';
        filtrarDatos();
      }, 60);
    }

    window.addEventListener('click', function(e) {
      const cont = document.getElementById('dash-buscar-resultados');
      const input = document.getElementById('dash-buscar-placa');
      if (cont && !cont.classList.contains('hidden') && input && !input.contains(e.target) && !cont.contains(e.target)) {
        cont.classList.add('hidden');
      }
    });

    // ================= TARJETA ROTATIVA DE DATOS (Inicio) =================
    const INSIGHT_ICONS = {
      building: '<svg class="icon icon-lg" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-4h6v4"/><path d="M9 7h1"/><path d="M9 11h1"/><path d="M14 7h1"/><path d="M14 11h1"/></svg>',
      pulse: '<svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M3 12h4l2-8 4 16 2-8h6"/></svg>',
      parking: '<svg class="icon icon-lg" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 16V8h4a2.5 2.5 0 0 1 0 5H9"/></svg>',
      clock: '<svg class="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
      repeat: '<svg class="icon icon-lg" viewBox="0 0 24 24"><path d="m17 2 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
      info: '<svg class="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/></svg>'
    };

    let insightsActuales = [];
    let insightIndiceActual = 0;
    let intervaloInsights = null;

    function calcularInsightsDashboard() {
      const movs = movimientosHoy || [];
      const total = movs.length;
      const insights = [];

      if (total) {
        const conteoEmpresa = {};
        movs.forEach(m => { const e = (m.empresa || '').trim(); if (e) conteoEmpresa[e] = (conteoEmpresa[e] || 0) + 1; });
        const top = Object.entries(conteoEmpresa).sort((a, b) => b[1] - a[1])[0];
        if (top) insights.push({ icono: 'building', titulo: 'Empresa más activa hoy', valor: top[0], sub: `${top[1]} movimiento${top[1] === 1 ? '' : 's'} registrados` });
      }

      if (total) {
        const conteoTipo = {};
        movs.forEach(m => { const t = (m.tipoIngreso || 'Otro').trim(); conteoTipo[t] = (conteoTipo[t] || 0) + 1; });
        const topTipo = Object.entries(conteoTipo).sort((a, b) => b[1] - a[1])[0];
        if (topTipo) {
          const pct = Math.round((topTipo[1] /…30136 tokens truncated…;
          const load = document.getElementById('av-loading');
          const empty = document.getElementById('av-empty');
          const label = document.getElementById('av-count-label');
          if (load) load.classList.add('hidden');
          if (label && avisosT28.length) {
            label.textContent = `${avisosT28.length} avisos · sin actualizar`;
          }
          if (empty && !avisosT28.length) {
            empty.classList.remove('hidden');
            empty.innerHTML = '<strong>No se pudieron cargar los avisos</strong><span>Revisa la API de Torre 28.</span>';
          }
          if (forzar) mostrarToast('No se pudieron actualizar los avisos: ' + (err?.message || err), 'error');
          else console.error('Avisos:', err);
        });
    }

    function renderAvisosT28() {
      const load = document.getElementById('av-loading');
      const empty = document.getElementById('av-empty');
      const car = document.getElementById('av-carousel');
      const dots = document.getElementById('av-dots');
      const label = document.getElementById('av-count-label');

      if (load) load.classList.add('hidden');

      if (!avisosT28.length) {
        if (empty) empty.classList.remove('hidden');
        if (car) car.classList.add('hidden');
        if (dots) dots.innerHTML = '';
        if (label) label.textContent = 'No hay avisos activos';
        return;
      }

      if (empty) empty.classList.add('hidden');
      if (car) car.classList.remove('hidden');

      const a = avisosT28[avisoIndiceT28];
      document.getElementById('av-titulo').textContent = a.titulo || 'Sin título';
      document.getElementById('av-mensaje').textContent = a.mensaje || '';
      document.getElementById('av-fecha').textContent = a.fecha || '';
      document.getElementById('av-autor').textContent = a.autor || 'Torre 28';

      const img = document.getElementById('av-img');
      const ph = document.getElementById('av-img-placeholder');
      if (a.imagenDataUrl) {
        img.src = a.imagenDataUrl;
        img.classList.remove('hidden');
        ph.classList.add('hidden');
      } else {
        img.removeAttribute('src');
        img.classList.add('hidden');
        ph.classList.remove('hidden');
      }

      const multiple = avisosT28.length > 1;

      if (car) {
        car.classList.toggle('is-single', !multiple);
        car.classList.toggle('is-multiple', multiple);
      }

      document.getElementById('av-prev').classList.toggle('hidden', !multiple);
      document.getElementById('av-next').classList.toggle('hidden', !multiple);

      if (label) {
        label.textContent = avisosT28.length === 1
          ? '1 aviso activo'
          : `${avisosT28.length} avisos activos`;
      }

      dots.innerHTML = multiple ? avisosT28.map((_,i) =>
        `<button type="button" class="t28-av-dot ${i===avisoIndiceT28?'active':''}" onclick="irAvisoT28(${i})"></button>`
      ).join('') : '';
    }

    function irAvisoT28(i) {
      if (!avisosT28.length) return;
      avisoIndiceT28 = Number(i) || 0;
      renderAvisosT28();
      reiniciarAvisosT28();
    }

    function avSiguienteT28() {
      if (avisosT28.length < 2) return;
      avisoIndiceT28 = (avisoIndiceT28 + 1) % avisosT28.length;
      renderAvisosT28();
      reiniciarAvisosT28();
    }

    function avAnteriorT28() {
      if (avisosT28.length < 2) return;
      avisoIndiceT28 = (avisoIndiceT28 - 1 + avisosT28.length) % avisosT28.length;
      renderAvisosT28();
      reiniciarAvisosT28();
    }

    function pausarAvisosT28() {
      if (intervaloAvisosT28) clearInterval(intervaloAvisosT28);
      intervaloAvisosT28 = null;
    }

    function reiniciarAvisosT28() {
      pausarAvisosT28();
      if (avisosT28.length < 2) return;
      intervaloAvisosT28 = setInterval(function() {
        if (!document.hidden && moduloActual === 'dashboard' && !hayModalOperativoAbierto()) {
          avisoIndiceT28 = (avisoIndiceT28 + 1) % avisosT28.length;
          renderAvisosT28();
        }
      }, 8000);
    }

    function avSwipeStartT28(e) {
      avisoSwipeXT28 = e?.changedTouches?.[0]?.clientX ?? null;
      pausarAvisosT28();
    }

    function avSwipeEndT28(e) {
      const fin = e?.changedTouches?.[0]?.clientX ?? null;
      if (avisoSwipeXT28 !== null && fin !== null && Math.abs(fin-avisoSwipeXT28) > 45) {
        fin < avisoSwipeXT28 ? avSiguienteT28() : avAnteriorT28();
      } else reiniciarAvisosT28();
      avisoSwipeXT28 = null;
    }

    let zoomImagenAvisoT28 = 1;
    let imagenAvisoXT28 = 0;
    let imagenAvisoYT28 = 0;
    let arrastreImagenAvisoT28 = null;
    let pellizcoImagenAvisoT28 = null;
    const punterosImagenAvisoT28 = new Map();

    function datosPellizcoImagenAvisoT28() {
      const puntos = Array.from(punterosImagenAvisoT28.values());
      if (puntos.length < 2) return null;
      const a = puntos[0], b = puntos[1];
      return {
        distancia: Math.hypot(b.x - a.x, b.y - a.y),
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
      };
    }

    function aplicarZoomImagenAvisoT28() {
      const img = document.getElementById('av-imagen-ampliada');
      const valor = document.getElementById('av-imagen-zoom-valor');
      if (img) {
        img.style.transform = `translate(${imagenAvisoXT28}px, ${imagenAvisoYT28}px) scale(${zoomImagenAvisoT28})`;
        img.classList.toggle('is-zoomed', zoomImagenAvisoT28 > 1);
      }
      if (valor) valor.textContent = `${Math.round(zoomImagenAvisoT28 * 100)}%`;
    }

    function cambiarZoomImagenAvisoT28(delta) {
      zoomImagenAvisoT28 = Math.max(0.5, Math.min(4, zoomImagenAvisoT28 + delta));
      if (zoomImagenAvisoT28 <= 1) imagenAvisoXT28 = imagenAvisoYT28 = 0;
      aplicarZoomImagenAvisoT28();
    }

    function restablecerZoomImagenAvisoT28() {
      zoomImagenAvisoT28 = 1;
      imagenAvisoXT28 = imagenAvisoYT28 = 0;
      arrastreImagenAvisoT28 = null;
      pellizcoImagenAvisoT28 = null;
      punterosImagenAvisoT28.clear();
      aplicarZoomImagenAvisoT28();
    }

    function zoomRuedaImagenAvisoT28(evento) {
      evento.preventDefault();
      evento.stopPropagation();
      cambiarZoomImagenAvisoT28(evento.deltaY < 0 ? 0.25 : -0.25);
    }

    function iniciarArrastreImagenAvisoT28(evento) {
      if (evento.pointerType === 'mouse' && evento.button !== 0) return;
      evento.preventDefault();
      evento.stopPropagation();
      evento.currentTarget.setPointerCapture?.(evento.pointerId);
      punterosImagenAvisoT28.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });

      const datos = datosPellizcoImagenAvisoT28();
      if (datos) {
        pellizcoImagenAvisoT28 = {
          distancia: Math.max(1, datos.distancia), zoom: zoomImagenAvisoT28,
          x: datos.x, y: datos.y, ox: imagenAvisoXT28, oy: imagenAvisoYT28
        };
        arrastreImagenAvisoT28 = null;
      } else if (zoomImagenAvisoT28 > 1) {
        arrastreImagenAvisoT28 = { id: evento.pointerId, x: evento.clientX, y: evento.clientY, ox: imagenAvisoXT28, oy: imagenAvisoYT28 };
      }
    }

    function moverImagenAvisoT28(evento) {
      if (!punterosImagenAvisoT28.has(evento.pointerId)) return;
      evento.preventDefault();
      evento.stopPropagation();
      punterosImagenAvisoT28.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });

      const datos = datosPellizcoImagenAvisoT28();
      if (datos && pellizcoImagenAvisoT28) {
        zoomImagenAvisoT28 = Math.max(0.5, Math.min(4,
          pellizcoImagenAvisoT28.zoom * datos.distancia / pellizcoImagenAvisoT28.distancia));
        if (zoomImagenAvisoT28 > 1) {
          imagenAvisoXT28 = pellizcoImagenAvisoT28.ox + datos.x - pellizcoImagenAvisoT28.x;
          imagenAvisoYT28 = pellizcoImagenAvisoT28.oy + datos.y - pellizcoImagenAvisoT28.y;
        } else {
          imagenAvisoXT28 = imagenAvisoYT28 = 0;
        }
      } else if (arrastreImagenAvisoT28?.id === evento.pointerId) {
        imagenAvisoXT28 = arrastreImagenAvisoT28.ox + evento.clientX - arrastreImagenAvisoT28.x;
        imagenAvisoYT28 = arrastreImagenAvisoT28.oy + evento.clientY - arrastreImagenAvisoT28.y;
      }
      aplicarZoomImagenAvisoT28();
    }

    function terminarArrastreImagenAvisoT28(evento) {
      evento.currentTarget.releasePointerCapture?.(evento.pointerId);
      punterosImagenAvisoT28.delete(evento.pointerId);
      pellizcoImagenAvisoT28 = null;

      const restante = Array.from(punterosImagenAvisoT28.entries())[0];
      if (restante && zoomImagenAvisoT28 > 1) {
        arrastreImagenAvisoT28 = {
          id: restante[0], x: restante[1].x, y: restante[1].y,
          ox: imagenAvisoXT28, oy: imagenAvisoYT28
        };
      } else {
        arrastreImagenAvisoT28 = null;
      }
    }

    function abrirImagenAvisoAmpliadaT28(evento) {
      if (evento) {
        evento.preventDefault();
        evento.stopPropagation();
      }

      const origen = document.getElementById('av-det-img');
      const destino = document.getElementById('av-imagen-ampliada');
      const modal = document.getElementById('modal-aviso-imagen');

      if (!origen || !destino || !modal) return;
      if (origen.classList.contains('hidden') || !origen.src) return;

      destino.src = origen.src;
      destino.alt = origen.alt || 'Imagen ampliada del aviso';
      restablecerZoomImagenAvisoT28();

      modal.classList.remove('hidden');
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');

      document.body.classList.add('t28-lightbox-open');
    }

    function cerrarImagenAvisoAmpliadaT28(evento, forzar = false) {
      if (evento && !forzar) {
        const target = evento.target;
        const modal = document.getElementById('modal-aviso-imagen');
        if (target !== modal) return;
      }

      if (evento) {
        evento.preventDefault();
        evento.stopPropagation();
      }

      const modal = document.getElementById('modal-aviso-imagen');
      const img = document.getElementById('av-imagen-ampliada');

      if (!modal) return;

      modal.classList.remove('is-open');
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');

      if (img) img.removeAttribute('src');
      restablecerZoomImagenAvisoT28();

      document.body.classList.remove('t28-lightbox-open');
    }

    function abrirDetalleAvisoT28(aviso = null) {
      const a = aviso || avisosT28[avisoIndiceT28];
      if (!a) return;
      avisoDetalleActualT28 = a;

      const alertaFlotante = document.getElementById('alerta-flotante-t28');
      if (alertaFlotante && !alertaFlotante.classList.contains('hidden')) {
        alertaOcultaPorModalT28 = true;
        alertaFlotante.classList.add('hidden');
      }

      document.getElementById('av-det-titulo').textContent = a.titulo || '';
      document.getElementById('av-det-mensaje').textContent = a.mensaje || '';
      document.getElementById('av-det-fecha').textContent = a.fecha || '';
      document.getElementById('av-det-autor').textContent = a.autor || 'Torre 28';

      const eventoBox = document.getElementById('av-det-evento');
      const eventoTexto = document.getElementById('av-det-evento-texto');
      if (eventoBox && eventoTexto) {
        const tieneEvento = Boolean(a.alertaActiva && a.fechaEventoMs);
        eventoBox.classList.toggle('hidden', !tieneEvento);
        eventoTexto.textContent = tieneEvento
          ? `Alerta programada · ${a.fechaEvento || ''}`
          : '';
      }

      const img = document.getElementById('av-det-img');
      const ph = document.getElementById('av-det-placeholder');
      if (a.imagenDataUrl) {
        img.src = a.imagenDataUrl;
        img.classList.remove('hidden');
        ph.classList.add('hidden');
      } else {
        img.removeAttribute('src');
        img.classList.add('hidden');
        ph.classList.remove('hidden');
      }

      pausarAvisosT28();
      const m = document.getElementById('modal-aviso-detalle');
      m.classList.remove('hidden'); m.classList.add('flex');
    }

    function cerrarDetalleAvisoT28() {
      const m = document.getElementById('modal-aviso-detalle');
      if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }

      cerrarImagenAvisoAmpliadaT28(null, true);

      avisoDetalleActualT28 = null;
      reiniciarAvisosT28();

      if (alertaOcultaPorModalT28) {
        alertaOcultaPorModalT28 = false;
        setTimeout(evaluarAlertasT28, 180);
      }
    }

    function abrirFormAvisoT28(a = null) {
      avisoImagenNuevaT28 = '';
      avisoQuitarImagenT28 = false;

      document.getElementById('av-form-fila').value = a?.filaIndex || '';
      document.getElementById('av-form-id').value = a?.id || '';
      document.getElementById('av-form-titulo').value = a?.titulo || '';
      document.getElementById('av-form-mensaje').value = a?.mensaje || '';
      document.getElementById('av-form-heading').textContent = a?.filaIndex ? 'Editar aviso' : 'Nuevo aviso';
      document.getElementById('av-file').value = '';

      const alertaCheck = document.getElementById('av-form-alerta');
      const fechaEventoInput = document.getElementById('av-form-fecha-evento');
      if (alertaCheck) alertaCheck.checked = Boolean(a?.alertaActiva);
      if (fechaEventoInput) fechaEventoInput.value = a?.fechaEventoInput || '';
      toggleAlertaAvisoT28();

      actualizarPreviewAvisoT28(a?.imagenDataUrl || '', a?.imagen || '');

      pausarAvisosT28();
      const m = document.getElementById('modal-aviso-form');
      m.classList.remove('hidden'); m.classList.add('flex');
    }

    function cerrarFormAvisoT28() {
      const m = document.getElementById('modal-aviso-form');
      if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
      avisoImagenNuevaT28 = '';
      avisoQuitarImagenT28 = false;
      reiniciarAvisosT28();
    }

    function editarAvisoDesdeDetalleT28() {
      const a = avisoDetalleActualT28;
      if (!a) return;
      cerrarDetalleAvisoT28();
      abrirFormAvisoT28(a);
    }

    function actualizarPreviewAvisoT28(dataUrl, ruta) {
      const img = document.getElementById('av-preview-img');
      const ph = document.getElementById('av-preview-placeholder');
      const r = document.getElementById('av-ruta');
      const quitar = document.getElementById('av-remove-photo');

      if (dataUrl) {
        img.src = dataUrl; img.classList.remove('hidden'); ph.classList.add('hidden');
      } else {
        img.removeAttribute('src'); img.classList.add('hidden'); ph.classList.remove('hidden');
      }
      r.textContent = ruta || (dataUrl ? 'Nueva foto seleccionada' : 'Puedes publicar sin imagen.');
      quitar.classList.toggle('hidden', !(dataUrl || ruta));
    }

    function seleccionarImagenAvisoT28(input) {
      const f = input?.files?.[0];
      if (!f) return;
      if (!['image/png','image/jpeg','image/webp'].includes(f.type)) {
        input.value=''; mostrarToast('Usa PNG, JPG o WebP.', 'aviso'); return;
      }
      if (f.size > 4*1024*1024) {
        input.value=''; mostrarToast('Máximo 4 MB.', 'aviso'); return;
      }
      const rd = new FileReader();
      rd.onload = e => {
        avisoImagenNuevaT28 = String(e.target?.result || '');
        avisoQuitarImagenT28 = false;
        actualizarPreviewAvisoT28(avisoImagenNuevaT28, 'Nueva foto seleccionada');
      };
      rd.readAsDataURL(f);
    }

    function quitarFotoAvisoT28() {
      avisoImagenNuevaT28 = '';
      avisoQuitarImagenT28 = true;
      document.getElementById('av-file').value = '';
      actualizarPreviewAvisoT28('', '');
    }

    function toggleAlertaAvisoT28() {
      const check = document.getElementById('av-form-alerta');
      const campos = document.getElementById('av-form-alerta-campos');
      const fecha = document.getElementById('av-form-fecha-evento');

      if (!check || !campos) return;

      const activa = check.checked;
      campos.classList.toggle('hidden', !activa);

      if (!activa && fecha) {
        fecha.classList.remove('field-invalid');
      }
    }

    function guardarAvisoT28() {
      const filaIndex = Number(document.getElementById('av-form-fila').value || 0);
      const id = document.getElementById('av-form-id').value.trim();
      const titulo = document.getElementById('av-form-titulo').value.trim();
      const mensaje = document.getElementById('av-form-mensaje').value.trim();
      const alertaActiva = Boolean(document.getElementById('av-form-alerta')?.checked);
      const fechaEvento = String(document.getElementById('av-form-fecha-evento')?.value || '').trim();

      const faltan=[];
      if(!titulo) faltan.push('av-form-titulo');
      if(!mensaje) faltan.push('av-form-mensaje');
      if(alertaActiva && !fechaEvento) faltan.push('av-form-fecha-evento');

      if(faltan.length){
        marcarCamposFaltantes(
          faltan,
          alertaActiva && !fechaEvento
            ? 'Completa título, mensaje y la fecha/hora del evento.'
            : 'Completa título y mensaje.'
        );
        return;
      }

      const btn=document.getElementById('av-save-btn');
      const imagenDataUrl=avisoImagenNuevaT28;
      const quitarImagen=avisoQuitarImagenT28;
      const respaldo=JSON.stringify(avisosT28||[]);
      const registroLocal={filaIndex:filaIndex||-Date.now(),id:id||('temp-'+Date.now()),titulo,mensaje,autor:autorAvisoT28(),imagenDataUrl,alertaActiva,fechaEventoInput:fechaEvento,activo:'SI'};
      const posLocal=avisosT28.findIndex(a=>(filaIndex&&Number(a.filaIndex)===filaIndex)||(id&&a.id===id));
      if(posLocal>=0)avisosT28[posLocal]=Object.assign({},avisosT28[posLocal],registroLocal);else avisosT28.unshift(registroLocal);
      cerrarFormAvisoT28();renderAvisosT28();mostrarToast(filaIndex?'¡Aviso actualizado!':'¡Aviso publicado!','exito');

      google.script.run
        .withSuccessHandler(function(){
          cargarAvisosDashboardT28(false);
        })
        .withFailureHandler(function(err){
          avisosT28=JSON.parse(respaldo);renderAvisosT28();
          mostrarToast('No se pudo guardar: '+(err?.message||err),'error');
          abrirFormAvisoT28(registroLocal);
        })
        .guardarAvisoWebT28({
          filaIndex,id,titulo,mensaje,
          autor:autorAvisoT28(),
          imagenDataUrl:imagenDataUrl,
          quitarImagen:quitarImagen,
          activo:'SI',
          alerta: alertaActiva ? 'SI' : 'NO',
          fechaEvento: alertaActiva ? fechaEvento : ''
        });
    }

    function solicitarEliminarAvisoT28(){
      if(!avisoDetalleActualT28) return;
      const m=document.getElementById('modal-eliminar-aviso');
      m.classList.remove('hidden'); m.classList.add('flex');
    }

    function cerrarEliminarAvisoT28(){
      const m=document.getElementById('modal-eliminar-aviso');
      if(m){m.classList.add('hidden');m.classList.remove('flex');}
    }

    function confirmarEliminarAvisoT28(){
      const a=avisoDetalleActualT28;
      if(!a?.filaIndex) return;
      const respaldo=JSON.stringify(avisosT28||[]);
      avisosT28=avisosT28.filter(x=>Number(x.filaIndex)!==Number(a.filaIndex));
      cerrarEliminarAvisoT28();cerrarDetalleAvisoT28();avisoIndiceT28=0;renderAvisosT28();mostrarToast('Aviso eliminado','exito');

      google.script.run
        .withSuccessHandler(function(){
          cargarAvisosDashboardT28(false);
        })
        .withFailureHandler(function(err){
          avisosT28=JSON.parse(respaldo);renderAvisosT28();
          mostrarToast('No se pudo eliminar: '+(err?.message||err),'error');
        })
        .eliminarAvisoWebT28(Number(a.filaIndex));
    }


    // ================= ALERTAS PROGRAMADAS =================
    function claveDiaLocalT28(fecha = new Date()) {
      const y = fecha.getFullYear();
      const m = String(fecha.getMonth() + 1).padStart(2, '0');
      const d = String(fecha.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    function claveSnoozeAlertaT28(aviso) {
      const id = String(aviso?.id || aviso?.filaIndex || 'aviso');
      const evento = Number(aviso?.fechaEventoMs || 0);
      return `T28_ALERTA_SNOOZE_${id}_${evento}`;
    }

    function ultimoCierreAlertaT28(aviso) {
      try {
        return Number(localStorage.getItem(claveSnoozeAlertaT28(aviso)) || 0);
      } catch (e) {
        return 0;
      }
    }

    function guardarCierreAlertaT28(aviso) {
      try {
        localStorage.setItem(claveSnoozeAlertaT28(aviso), String(Date.now()));
      } catch (e) {}
    }

    function alertasDisponiblesHoyT28() {
      const ahora = Date.now();
      const hoy = claveDiaLocalT28(new Date());
      const unaHora = 60 * 60 * 1000;

      return (avisosT28 || [])
        .filter(a => {
          if (!a?.alertaActiva || !Number(a?.fechaEventoMs || 0)) return false;
          if (String(a.fechaEventoDia || '') !== hoy) return false;

          const evento = Number(a.fechaEventoMs);
          if (ahora >= evento) return false;

          const cerrado = ultimoCierreAlertaT28(a);
          if (cerrado && (ahora - cerrado) < unaHora) return false;

          return true;
        })
        .sort((a, b) => Number(a.fechaEventoMs) - Number(b.fechaEventoMs));
    }

    function iniciarMotorAlertasT28() {
      restaurarPosicionAlertaT28();
      evaluarAlertasT28();

      if (intervaloMotorAlertasT28) clearInterval(intervaloMotorAlertasT28);

      // Revisa cada minuto:
      // - si empezó un nuevo día
      // - actualiza el contador
      // - retira la alerta al llegar la hora del evento
      intervaloMotorAlertasT28 = setInterval(evaluarAlertasT28, 60 * 1000);
    }


    function clavePosicionAlertaT28() {
      return 'T28_ALERTA_POSICION';
    }

    function restaurarPosicionAlertaT28() {
      const panel = document.getElementById('alerta-flotante-t28');
      if (!panel) return;

      // En móvil dejamos la posición superior predeterminada.
      // El usuario puede moverla durante la sesión, pero no forzamos
      // una posición guardada que pudiera quedar fuera de pantalla.
      if (window.innerWidth <= 768) return;

      try {
        const raw = localStorage.getItem(clavePosicionAlertaT28());
        if (!raw) return;

        const pos = JSON.parse(raw);
        const left = Number(pos?.left);
        const top = Number(pos?.top);

        if (!Number.isFinite(left) || !Number.isFinite(top)) return;

        panel.style.left = Math.max(8, Math.min(left, window.innerWidth - 260)) + 'px';
        panel.style.top = Math.max(8, Math.min(top, window.innerHeight - 120)) + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.classList.add('is-user-positioned');
      } catch (e) {}
    }

    function guardarPosicionAlertaT28(left, top) {
      try {
        localStorage.setItem(
          clavePosicionAlertaT28(),
          JSON.stringify({ left: Math.round(left), top: Math.round(top) })
        );
      } catch (e) {}
    }

    function iniciarArrastreAlertaT28(evento) {
      if (!evento || evento.button > 0) return;

      // Cerrar, contador y otros controles deben seguir siendo clickeables.
      if (evento.target?.closest?.('button')) return;

      const panel = document.getElementById('alerta-flotante-t28');
      if (!panel || panel.classList.contains('hidden')) return;

      const rect = panel.getBoundingClientRect();

      arrastreAlertaT28 = {
        pointerId: evento.pointerId,
        offsetX: evento.clientX - rect.left,
        offsetY: evento.clientY - rect.top,
        width: rect.width,
        height: rect.height
      };

      // Convertimos right/bottom a left/top para permitir movimiento libre.
      panel.style.left = rect.left + 'px';
      panel.style.top = rect.top + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.width = rect.width + 'px';
      panel.classList.add('is-dragging', 'is-user-positioned');

      try {
        evento.currentTarget.setPointerCapture(evento.pointerId);
      } catch (e) {}

      document.addEventListener('pointermove', moverAlertaFlotanteT28, { passive: false });
      document.addEventListener('pointerup', finalizarArrastreAlertaT28, { passive: false });
      document.addEventListener('pointercancel', finalizarArrastreAlertaT28, { passive: false });

      if (evento.cancelable) evento.preventDefault();
    }

    function moverAlertaFlotanteT28(evento) {
      const panel = document.getElementById('alerta-flotante-t28');
      const drag = arrastreAlertaT28;

      if (!panel || !drag || evento.pointerId !== drag.pointerId) return;

      const margen = 8;
      const maxLeft = Math.max(margen, window.innerWidth - drag.width - margen);
      const maxTop = Math.max(margen, window.innerHeight - drag.height - margen);

      const left = Math.min(
        Math.max(margen, evento.clientX - drag.offsetX),
        maxLeft
      );

      const top = Math.min(
        Math.max(margen, evento.clientY - drag.offsetY),
        maxTop
      );

      panel.style.left = left + 'px';
      panel.style.top = top + 'px';

      if (evento.cancelable) evento.preventDefault();
    }

    function finalizarArrastreAlertaT28(evento) {
      const panel = document.getElementById('alerta-flotante-t28');
      const drag = arrastreAlertaT28;

      if (!drag) return;
      if (evento?.pointerId != null && evento.pointerId !== drag.pointerId) return;

      if (panel) {
        panel.classList.remove('is-dragging');

        const rect = panel.getBoundingClientRect();
        guardarPosicionAlertaT28(rect.left, rect.top);
      }

      arrastreAlertaT28 = null;

      document.removeEventListener('pointermove', moverAlertaFlotanteT28);
      document.removeEventListener('pointerup', finalizarArrastreAlertaT28);
      document.removeEventListener('pointercancel', finalizarArrastreAlertaT28);
    }

    function evaluarAlertasT28() {
      const anteriores = alertasHoyT28;
      const idActual = anteriores[alertaFlotanteIndiceT28]?.id || '';
      alertasHoyT28 = alertasDisponiblesHoyT28();

      const panel = document.getElementById('alerta-flotante-t28');
      if (!panel) return;

      const avisoModalAbierto =
        elementoVisiblePorId('modal-aviso-detalle') ||
        elementoVisiblePorId('modal-aviso-form') ||
        elementoVisiblePorId('modal-eliminar-aviso') ||
        elementoVisiblePorId('modal-aviso-imagen');

      if (avisoModalAbierto) {
        panel.classList.add('hidden');
        alertaOcultaPorModalT28 = true;
        return;
      }

      if (!alertasHoyT28.length) {
        panel.classList.add('hidden');
        alertaFlotanteIndiceT28 = 0;
        return;
      }

      const mismoIndice = alertasHoyT28.findIndex(a => String(a.id || '') === String(idActual || ''));
      if (mismoIndice >= 0) alertaFlotanteIndiceT28 = mismoIndice;
      else if (alertaFlotanteIndiceT28 >= alertasHoyT28.length) alertaFlotanteIndiceT28 = 0;

      const estabaOculta = panel.classList.contains('hidden');

      renderAlertaFlotanteT28();
      panel.classList.remove('hidden');

      if (estabaOculta) {
        reproducirSonidoAlertaT28(false, alertasHoyT28[alertaFlotanteIndiceT28]);
      }

      // Reinicia un pequeño efecto de entrada/atención cuando vuelve a aparecer.
      panel.classList.remove('attention-now');
      void panel.offsetWidth;
      panel.classList.add('attention-now');
      setTimeout(() => panel.classList.remove('attention-now'), 900);
    }

    function formatoHoraEventoT28(ms) {
      const fecha = new Date(Number(ms));
      if (isNaN(fecha)) return '--:--';

      return fecha.toLocaleTimeString('es-PE', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }

    function textoRestanteAlertaT28(msEvento) {
      const diff = Math.max(0, Number(msEvento) - Date.now());
      const totalMin = Math.ceil(diff / 60000);

      if (totalMin <= 1) return 'Falta menos de 1 min';

      const horas = Math.floor(totalMin / 60);
      const minutos = totalMin % 60;

      if (horas > 0 && minutos > 0) return `Faltan ${horas} h ${minutos} min`;
      if (horas > 0) return `Faltan ${horas} h`;
      return `Faltan ${minutos} min`;
    }

    function renderAlertaFlotanteT28() {
      const panel = document.getElementById('alerta-flotante-t28');
      const a = alertasHoyT28[alertaFlotanteIndiceT28];
      if (!panel || !a) return;

      panel.classList.remove('is-config-test');

      const titulo = document.getElementById('alerta-flotante-titulo');
      const mensaje = document.getElementById('alerta-flotante-mensaje');
      const hora = document.getElementById('alerta-flotante-hora');
      const restante = document.getElementById('alerta-flotante-restante');
      const contador = document.getElementById('alerta-flotante-contador');
      const nav = document.getElementById('alerta-flotante-nav');

      if (titulo) titulo.textContent = a.titulo || 'Recordatorio';
      if (mensaje) mensaje.textContent = a.mensaje || '';
      if (hora) hora.textContent = `Hoy · ${formatoHoraEventoT28(a.fechaEventoMs)}`;
      if (restante) restante.textContent = textoRestanteAlertaT28(a.fechaEventoMs);

      const multiples = alertasHoyT28.length > 1;
      if (contador) {
        contador.textContent = `${alertaFlotanteIndiceT28 + 1} de ${alertasHoyT28.length}`;
        contador.classList.toggle('hidden', !multiples);
      }
      if (nav) nav.classList.toggle('hidden', !multiples);

      const minutos = Math.ceil((Number(a.fechaEventoMs) - Date.now()) / 60000);
      panel.classList.toggle('is-urgent', minutos > 15 && minutos <= 60);
      panel.classList.toggle('is-critical', minutos <= 15);
    }

    function cerrarAlertaFlotanteT28() {
      const actual = alertasHoyT28[alertaFlotanteIndiceT28];
      if (!actual) return;

      guardarCierreAlertaT28(actual);

      const panel = document.getElementById('alerta-flotante-t28');
      if (panel) panel.classList.add('hidden');

      // Si hay otro recordatorio de hoy que no fue cerrado,
      // lo permite aparecer sin apilar varias ventanas.
      setTimeout(evaluarAlertasT28, 250);
    }

    function alertaSiguienteT28() {
      if (alertasHoyT28.length < 2) return;
      alertaFlotanteIndiceT28 = (alertaFlotanteIndiceT28 + 1) % alertasHoyT28.length;
      renderAlertaFlotanteT28();
    }

    function alertaAnteriorT28() {
      if (alertasHoyT28.length < 2) return;
      alertaFlotanteIndiceT28 =
        (alertaFlotanteIndiceT28 - 1 + alertasHoyT28.length) % alertasHoyT28.length;
      renderAlertaFlotanteT28();
    }

    function verAvisoDesdeAlertaT28() {
      const a = alertasHoyT28[alertaFlotanteIndiceT28];
      if (!a) return;
      abrirDetalleAvisoT28(a);
    }

    // ================= EMPRESAS / LOGOS =================
    function empresasFallbackT28() {
      const mapa = new Map();

      const agregar = (nombre) => {
        const empresa = String(nombre || '').trim();
        if (!empresa) return;
        const clave = normalizarTexto(empresa).trim();
        if (!clave || mapa.has(clave)) return;
        mapa.set(clave, {
          filaIndex: 0,
          empresa,
          logo: '',
          observaciones: '',
          logoDataUrl: '',
          logoError: '',
          esFallback: true
        });
      };

      (todosLosDatos || []).forEach(x => agregar(x?.empresa));
      (catalogosIngresoWeb.visitantes || []).forEach(x => agregar(x?.empresa));

      return Array.from(mapa.values()).sort((a,b) =>
        a.empresa.localeCompare(b.empresa, 'es', { sensitivity:'base' })
      );
    }

    function cargarVistaEmpresasT28(forzar = false) {
      renderEmpresasGestionT28();

      // Primero solo la hoja: esto debe responder rápido.
      cargarEmpresasCatalogoT28(false, true, Boolean(forzar));

      // Los logos se cargan DESPUÉS, cuando ya haya empresas en pantalla.
    }

    function cargarEmpresasCatalogoT28(incluirLogos = false, mostrarEstado = false, forzar = false) {
      if (empresaCatalogoCargandoT28 && !forzar) return;

      if (!forzar) {
        if (!incluirLogos && empresasCatalogoT28.length) {
          sincronizarCatalogoEmpresasT28();
          renderEmpresasGestionT28();

          if (moduloActual === 'catalogoempresas' && !empresaCatalogoConLogosT28) {
            setTimeout(() => cargarEmpresasCatalogoT28(true, false, true), 120);
          }
          return;
        }

        if (incluirLogos && empresaCatalogoConLogosT28) {
          renderEmpresasGestionT28();
          return;
        }
      }

      empresaCatalogoCargandoT28 = true;
      const secuencia = ++empresaCatalogoCargaSeqT28;

      if (empresaCatalogoTimerT28) clearTimeout(empresaCatalogoTimerT28);

      const estado = document.getElementById('empresa-config-estado');
      if (mostrarEstado && estado) {
        estado.classList.remove('hidden');
        estado.className = 't28-company-status is-loading';
        estado.textContent = incluirLogos
          ? 'Cargando logos desde Drive...'
          : 'Cargando empresas desde la hoja EMPRESAS...';
      }

      if (!empresasCatalogoT28.length) renderEmpresasGestionT28();

      // Evita que la pantalla quede eternamente en "Cargando..."
      empresaCatalogoTimerT28 = setTimeout(function() {
        if (secuencia !== empresaCatalogoCargaSeqT28) return;

        empresaCatalogoCargandoT28 = false;

        if (!empresasCatalogoT28.length) {
          const fallback = empresasFallbackT28();
          if (fallback.length) empresasCatalogoT28 = fallback;
        }

        if (estado) {
          estado.classList.remove('hidden');
          estado.className = 't28-company-status is-error';
          estado.textContent = empresasCatalogoT28.length
            ? 'Mostrando la información disponible. Los logos continúan cargando en segundo plano.'
            : 'Empresas está tardando más de lo normal. Intenta actualizar nuevamente.';
        }

        renderEmpresasGestionT28();
      }, incluirLogos ? 60000 : 30000);

      T28Api.empresas(Boolean(incluirLogos))
        .then(function(res) {
          const data = res?.data;
          if (secuencia !== empresaCatalogoCargaSeqT28) return;

          if (empresaCatalogoTimerT28) clearTimeout(empresaCatalogoTimerT28);
          empresaCatalogoTimerT28 = null;
          empresaCatalogoCargandoT28 = false;

          let recibidos = Array.isArray(data) ? data : [];
          if (!incluirLogos && empresasCatalogoT28.length) {
            const visuales = new Map(empresasCatalogoT28.map(e => [normalizarTexto(e.empresa), e]));
            recibidos = recibidos.map(e => {
              const anterior = visuales.get(normalizarTexto(e.empresa));
              return anterior?.logoDataUrl ? { ...e, logoDataUrl: anterior.logoDataUrl } : e;
            });
          }

          if (recibidos.length) {
            empresasCatalogoT28 = recibidos;
          } else if (!empresasCatalogoT28.length) {
            empresasCatalogoT28 = empresasFallbackT28();
          }

          if (incluirLogos) empresaCatalogoConLogosT28 = true;
          if (incluirLogos && empresasCatalogoT28.length) {
            guardarCacheVisualT28('empresas', empresasCatalogoT28);
          }

          if (estado) {
            estado.classList.add('hidden');
            estado.textContent = '';
          }

          sincronizarCatalogoEmpresasT28();
          renderEmpresasGestionT28();

          if (!incluirLogos &&
              moduloActual === 'catalogoempresas' &&
              recibidos.length &&
              !empresaCatalogoConLogosT28) {
            setTimeout(function() {
              if (moduloActual === 'catalogoempresas') {
                cargarEmpresasCatalogoT28(true, false, true);
              }
            }, 120);
          }
        })
        .catch(function(err) {
          if (secuencia !== empresaCatalogoCargaSeqT28) return;

          if (empresaCatalogoTimerT28) clearTimeout(empresaCatalogoTimerT28);
          empresaCatalogoTimerT28 = null;
          empresaCatalogoCargandoT28 = false;

          console.error('Empresas T28:', err);

          if (!empresasCatalogoT28.length) {
            empresasCatalogoT28 = empresasFallbackT28();
          }

          if (estado && mostrarEstado) {
            estado.classList.remove('hidden');
            estado.className = 't28-company-status is-error';
            estado.textContent =
              'No se pudo leer la hoja EMPRESAS: ' + (err?.message || err);
          }

          sincronizarCatalogoEmpresasT28();
          renderEmpresasGestionT28();
        });
    }

    function sincronizarCatalogoEmpresasT28() {
      try { poblarSelectEmpresas(todosLosDatos || []); } catch(e) {}
      try { prepararCatalogosIngreso(); } catch(e) {}
      try { actualizarListaEmpresasPersonalT28(); } catch(e) {}
    }

    function inicialesEmpresaT28(nombre) {
      const partes = String(nombre || 'EMP').trim().split(/\s+/).filter(Boolean);
      if (!partes.length) return 'EMP';
      if (partes.length === 1) return partes[0].slice(0, 3).toUpperCase();
      return partes.slice(0, 2).map(p => p[0]).join('').toUpperCase();
    }

    function renderEmpresasGestionT28() {
      const cont = document.getElementById('empresa-config-grid');
      const total = document.getElementById('empresa-config-total');
      if (!cont) return;

      const q = normalizarTexto(document.getElementById('empresa-config-buscar')?.value || '');
      const datos = (empresasCatalogoT28 || []).filter(e => {
        if (!q) return true;
        return [e.empresa, e.observaciones, e.logo]
          .some(v => normalizarTexto(v).includes(q));
      });

      if (total) total.textContent = empresasCatalogoT28.length;

      if (empresaCatalogoCargandoT28 && !empresasCatalogoT28.length) {
        cont.innerHTML = '<div class="t28-company-loading">Cargando empresas...</div>';
        return;
      }

      if (!datos.length) {
        cont.innerHTML = `
          <div class="t28-company-empty">
            <strong>Sin empresas</strong>
            <span>No hay coincidencias con la búsqueda actual.</span>
          </div>`;
        return;
      }

      cont.innerHTML = datos.map(e => {
        const logo = String(e.logoDataUrl || '');
        const img = logo
          ? `<img src="${escapeHtml(logo)}" alt="Logo ${escapeHtml(e.empresa || '')}">`
          : `<span>${escapeHtml(inicialesEmpresaT28(e.empresa))}</span>`;

        const ruta = String(e.logo || '').trim();
        const rutaCorta = ruta ? ruta.split('/').pop() : 'Sin logo';

        return `
          <article class="t28-company-card t28-company-card-clickable"
                   role="button"
                   tabindex="0"
                   onclick="abrirDetalleEmpresaT28(${Number(e.filaIndex || 0)})"
                   onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();abrirDetalleEmpresaT28(${Number(e.filaIndex || 0)});}">
            <div class="t28-company-card-logo">${img}</div>
            <div class="t28-company-card-copy">
              <h4>${escapeHtml(e.empresa || 'Sin nombre')}</h4>
              <p>${escapeHtml(e.observaciones || 'Sin observaciones')}</p>
              <small title="${escapeHtml(ruta)}">${escapeHtml(rutaCorta)}</small>
            </div>
            <span class="t28-company-card-arrow" aria-hidden="true">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
            </span>
          </article>`;
      }).join('');
    }

    function buscarEmpresaCatalogoPorFilaT28(filaIndex) {
      return (empresasCatalogoT28 || []).find(e =>
        Number(e.filaIndex || 0) === Number(filaIndex || 0)
      ) || null;
    }


    function obtenerResumenEmpresaT28(empresaNombre) {
      const clave = normalizarTexto(empresaNombre || '').trim();

      const puestos = (todosLosDatos || []).filter(item =>
        normalizarTexto(item?.empresa || '').trim() === clave
      );

      const estacionamientos = [];
      const usuarios = new Set();
      const vehiculos = new Set();

      puestos.forEach(item => {
        const est = String(item?.est || '').trim();
        if (est && !estacionamientos.includes(est)) estacionamientos.push(est);

        (item?.ocupantes || []).forEach(oc => {
          if (oc?.esVirtual === true) return;

          const usuario = String(oc?.usuario || '').trim();
          const placa = String(oc?.placa || '').trim();

          if (usuario && normalizarTexto(usuario) !== 'libre') {
            usuarios.add(normalizarTexto(usuario));
          }

          if (placa && placa !== '---') {
            vehiculos.add(normalizarTexto(placa).replace(/\s+/g,''));
          }
        });
      });

      estacionamientos.sort((a,b) => {
        const na = Number(String(a).replace(/\D/g,''));
        const nb = Number(String(b).replace(/\D/g,''));
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
        return String(a).localeCompare(String(b), 'es', { numeric:true, sensitivity:'base' });
      });

      return {
        estacionamientos,
        totalEstacionamientos: estacionamientos.length,
        totalUsuarios: usuarios.size,
        totalVehiculos: vehiculos.size
      };
    }

    function abrirDetalleEmpresaT28(filaIndex) {
      const registro = buscarEmpresaCatalogoPorFilaT28(filaIndex);

      // Las empresas fallback todavía no tienen una fila real en EMPRESAS.
      if (!registro) {
        mostrarToast('No se pudo abrir el detalle de esta empresa.', 'aviso');
        return;
      }

      empresaDetalleActualT28 = registro;

      const modal = document.getElementById('modal-empresa-detalle');
      if (!modal) return;

      const resumen = obtenerResumenEmpresaT28(registro.empresa);

      const nombre = document.getElementById('empresa-detalle-nombre');
      const obs = document.getElementById('empresa-detalle-observaciones');
      const est = document.getElementById('empresa-detalle-estacionamientos');
      const usu = document.getElementById('empresa-detalle-usuarios');
      const veh = document.getElementById('empresa-detalle-vehiculos');
      const lista = document.getElementById('empresa-detalle-estacionamientos-lista');
      const resumenEst = document.getElementById('empresa-detalle-estacionamientos-resumen');
      const ruta = document.getElementById('empresa-detalle-logo-ruta');
      const img = document.getElementById('empresa-detalle-logo-img');
      const ini = document.getElementById('empresa-detalle-iniciales');
      const btnEditar = document.getElementById('btn-editar-desde-detalle-empresa');

      if (nombre) nombre.textContent = registro.empresa || 'Sin nombre';
      if (obs) obs.textContent = registro.observaciones || 'Sin observaciones';
      if (est) est.textContent = resumen.totalEstacionamientos;
      if (usu) usu.textContent = resumen.totalUsuarios;
      if (veh) veh.textContent = resumen.totalVehiculos;
      if (ruta) ruta.textContent = registro.logo || 'Sin logo';
      if (resumenEst) {
        resumenEst.textContent = resumen.totalEstacionamientos
          ? `${resumen.totalEstacionamientos} puesto${resumen.totalEstacionamientos === 1 ? '' : 's'}`
          : 'Sin puestos';
      }

      if (lista) {
        if (resumen.estacionamientos.length) {
          lista.innerHTML = resumen.estacionamientos
            .map(n => `<span class="t28-company-parking-chip">Est. ${escapeHtml(n)}</span>`)
            .join('');
        } else {
          lista.innerHTML = '<span class="t28-company-parking-empty">Sin estacionamientos asignados</span>';
        }
      }

      if (img && ini) {
        if (registro.logoDataUrl) {
          img.src = registro.logoDataUrl;
          img.classList.remove('hidden');
          ini.classList.add('hidden');
        } else {
          img.removeAttribute('src');
          img.classList.add('hidden');
          ini.textContent = inicialesEmpresaT28(registro.empresa);
          ini.classList.remove('hidden');
        }
      }

      // Fallbacks no se pueden editar hasta que exista la fila real en EMPRESAS.
      if (btnEditar) {
        btnEditar.disabled = Boolean(registro.esFallback) || !Number(registro.filaIndex || 0);
      }

      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function cerrarDetalleEmpresaT28() {
      const modal = document.getElementById('modal-empresa-detalle');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      empresaDetalleActualT28 = null;
    }

    function editarEmpresaDesdeDetalleT28() {
      const registro = empresaDetalleActualT28;
      if (!registro || !Number(registro.filaIndex || 0)) {
        mostrarToast('Esta empresa todavía no está disponible para editar.', 'aviso');
        return;
      }

      const filaIndex = Number(registro.filaIndex);
      cerrarDetalleEmpresaT28();
      abrirFormEmpresaT28(filaIndex);
    }

    function abrirFormEmpresaT28(filaIndex = 0) {
      const registro = filaIndex ? buscarEmpresaCatalogoPorFilaT28(filaIndex) : null;

      empresaImagenNuevaT28 = '';

      const modal = document.getElementById('modal-empresa-form');
      if (!modal) return;

      document.getElementById('empresa-form-fila').value = registro?.filaIndex || '';
      document.getElementById('empresa-form-nombre').value = registro?.empresa || '';
      document.getElementById('empresa-form-observaciones').value = registro?.observaciones || '';
      document.getElementById('empresa-form-logo').value = '';
      document.getElementById('empresa-form-titulo').textContent =
        registro ? 'Editar empresa' : 'Nueva empresa';

      actualizarPreviewLogoEmpresaT28(
        registro?.logoDataUrl || '',
        registro?.empresa || '',
        registro?.logo || ''
      );

      modal.classList.remove('hidden');
      modal.classList.add('flex');

      setTimeout(() => document.getElementById('empresa-form-nombre')?.focus(), 80);
    }

    function cerrarFormEmpresaT28() {
      const modal = document.getElementById('modal-empresa-form');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      empresaImagenNuevaT28 = '';
    }

    function actualizarPreviewLogoEmpresaT28(dataUrl, nombre, ruta) {
      const img = document.getElementById('empresa-logo-img-preview');
      const ini = document.getElementById('empresa-logo-iniciales');
      const rutaEl = document.getElementById('empresa-logo-ruta-actual');

      if (img && ini) {
        if (dataUrl) {
          img.src = dataUrl;
          img.classList.remove('hidden');
          ini.classList.add('hidden');
        } else {
          img.removeAttribute('src');
          img.classList.add('hidden');
          ini.textContent = inicialesEmpresaT28(nombre);
          ini.classList.remove('hidden');
        }
      }

      if (rutaEl) {
        rutaEl.textContent = ruta
          ? ruta
          : (dataUrl ? 'Nueva imagen seleccionada' : 'Sin imagen seleccionada');
      }
    }

    function seleccionarLogoEmpresaT28(input) {
      const file = input?.files?.[0];
      if (!file) return;

      const permitidos = ['image/png', 'image/jpeg', 'image/webp'];
      if (!permitidos.includes(file.type)) {
        input.value = '';
        mostrarToast('Usa una imagen PNG, JPG o WebP.', 'aviso');
        return;
      }

      if (file.size > 3 * 1024 * 1024) {
        input.value = '';
        mostrarToast('El logo debe pesar máximo 3 MB.', 'aviso');
        return;
      }

      const reader = new FileReader();
      reader.onload = function(ev) {
        empresaImagenNuevaT28 = String(ev.target?.result || '');
        const nombre = document.getElementById('empresa-form-nombre')?.value || '';
        actualizarPreviewLogoEmpresaT28(empresaImagenNuevaT28, nombre, 'Nueva imagen seleccionada');
      };
      reader.onerror = function() {
        mostrarToast('No se pudo leer la imagen.', 'error');
      };
      reader.readAsDataURL(file);
    }

    function guardarEmpresaT28() {
      const filaIndex = Number(document.getElementById('empresa-form-fila')?.value || 0);
      const empresa = document.getElementById('empresa-form-nombre')?.value.trim() || '';
      const observaciones = document.getElementById('empresa-form-observaciones')?.value.trim() || '';

      if (!empresa) {
        marcarCamposFaltantes(['empresa-form-nombre'], 'Ingresa el nombre de la empresa.');
        return;
      }

      const imagenDataUrl=empresaImagenNuevaT28;
      const respaldo=JSON.stringify(empresasCatalogoT28||[]);
      const registroLocal={filaIndex:filaIndex||-Date.now(),empresa,observaciones,logoDataUrl:imagenDataUrl};
      const posLocal=empresasCatalogoT28.findIndex(e=>filaIndex&&Number(e.filaIndex)===filaIndex);
      if(posLocal>=0)empresasCatalogoT28[posLocal]=Object.assign({},empresasCatalogoT28[posLocal],registroLocal);else empresasCatalogoT28.push(registroLocal);
      empresasCatalogoT28.sort((a,b)=>String(a.empresa||'').localeCompare(String(b.empresa||''),'es',{sensitivity:'base'}));
      cerrarFormEmpresaT28();sincronizarCatalogoEmpresasT28();renderEmpresasGestionT28();mostrarToast(filaIndex?'¡Empresa actualizada!':'¡Empresa agregada!','exito');

      google.script.run
        .withSuccessHandler(function(registro) {
          const nuevo = registro || {};
          empresasCatalogoT28=empresasCatalogoT28.filter(e=>Number(e.filaIndex)!==Number(registroLocal.filaIndex));
          const pos = (empresasCatalogoT28 || []).findIndex(e =>
            Number(e.filaIndex || 0) === Number(nuevo.filaIndex || 0)
          );

          if (pos >= 0) empresasCatalogoT28[pos] = nuevo;
          else empresasCatalogoT28.push(nuevo);

          empresasCatalogoT28.sort((a, b) =>
            String(a.empresa || '').localeCompare(String(b.empresa || ''), 'es', { sensitivity:'base' })
          );

          empresaCatalogoConLogosT28 = true;
          guardarCacheVisualT28('empresas', empresasCatalogoT28);
          empresaImagenNuevaT28 = '';

          sincronizarCatalogoEmpresasT28();
          renderEmpresasGestionT28();
          // Confirma contra la hoja real y vuelve a traer logos.
          setTimeout(function() {
            if (moduloActual === 'catalogoempresas') cargarEmpresasCatalogoT28(false, false, true);
          }, 250);
        })
        .withFailureHandler(function(err) {
          empresasCatalogoT28=JSON.parse(respaldo);sincronizarCatalogoEmpresasT28();renderEmpresasGestionT28();
          mostrarToast('No se pudo guardar la empresa: ' + (err?.message || err), 'error');
          abrirFormEmpresaT28(filaIndex);
        })
        .guardarEmpresaWebT28({
          filaIndex,
          empresa,
          observaciones,
          imagenDataUrl: imagenDataUrl
        });
    }

    // ================= USUARIOS: PERSONAL SIN ESTACIONAMIENTO =================
    // Empresas disponibles para Personal sin estacionamiento:
    // toma las empresas de las asignaciones/estacionamientos del sistema
    // y además conserva cualquier empresa ya usada en Personal sin estacionamiento.
    function obtenerEmpresasSistemaT28() {
      const mapa = new Map();

      const agregar = (valor) => {
        const nombre = String(valor || '').trim();
        if (!nombre) return;
        const clave = normalizarTexto(nombre).trim();
        if (!clave) return;
        if (!mapa.has(clave)) mapa.set(clave, nombre);
      };

      // 1) Fuente oficial: hoja EMPRESAS.
      (empresasCatalogoT28 || []).forEach(e => agregar(e?.empresa));

      // 2) Fallbacks para que el sistema siga funcionando incluso
      //    antes de terminar la carga del catálogo maestro.
      (todosLosDatos || []).forEach(item => agregar(item?.empresa));
      (catalogosIngresoWeb.visitantes || []).forEach(v => agregar(v?.empresa));

      return Array.from(mapa.values()).sort((a, b) =>
        a.localeCompare(b, 'es', { sensitivity: 'base' })
      );
    }

    function actualizarListaEmpresasPersonalT28() {
      const lista = document.getElementById('personal-form-lista-empresas');
      if (!lista) return;

      const empresas = obtenerEmpresasSistemaT28();
      lista.innerHTML = empresas
        .map(e => `<option value="${escapeHtml(e)}"></option>`)
        .join('');
    }

    function mostrarCargaPersonalSinEstacionamientoT28() {
      const tbody = document.getElementById('personal-sin-est-cuerpo');
      if (!tbody) return;

      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="t28-empty-state">
              <strong>Cargando personal...</strong>
              <span>Consultando Personal sin estacionamiento.</span>
            </div>
          </td>
        </tr>`;
    }

    function cambiarVistaUsuarios(vista) {
      vistaUsuariosActual = vista === 'personal' ? 'personal' : 'asignaciones';

      const asig = document.getElementById('usuarios-vista-asignaciones');
      const personal = document.getElementById('usuarios-vista-personal');
      const btnAsig = document.getElementById('tab-usuarios-asignaciones');
      const btnPersonal = document.getElementById('tab-usuarios-personal');

      if (asig) asig.classList.toggle('hidden', vistaUsuariosActual !== 'asignaciones');
      if (personal) personal.classList.toggle('hidden', vistaUsuariosActual !== 'personal');
      if (btnAsig) btnAsig.classList.toggle('active', vistaUsuariosActual === 'asignaciones');
      if (btnPersonal) btnPersonal.classList.toggle('active', vistaUsuariosActual === 'personal');

      if (vistaUsuariosActual === 'personal') {
        if (catalogosIngresoListosT28) {
          prepararPersonalSinEstacionamiento();
        } else {
          mostrarCargaPersonalSinEstacionamientoT28();
          cargarCatalogosIngresoServidor();
        }
      }

      // El Excel de Usuarios corresponde a Trabajadores fijos.
      // En Personal sin estacionamiento no debe mostrarse ese botón.
      if (moduloActual === 'empresas') {
        actualizarBotonDescargaContextual('empresas');
        actualizarBusquedaTopbarT28('empresas');
        actualizarSincronizacionTopbarT28('empresas');
        actualizarVisibilidadFabT28();
      }
    }

    function prepararPersonalSinEstacionamiento() {
      const datos = Array.isArray(catalogosIngresoWeb.visitantes) ? catalogosIngresoWeb.visitantes : [];

      const empresas = [...new Set(datos.map(v => v.empresa).filter(Boolean))].sort();
      const filtro = document.getElementById('filtro-personal-empresa');
      if (filtro) {
        const actual = filtro.value;
        filtro.innerHTML = '<option value="">Todas las empresas</option>';
        empresas.forEach(e => filtro.add(new Option(e, e)));
        if (empresas.includes(actual)) filtro.value = actual;
      }

      const poner = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.textContent = valor;
      };
      poner('personal-stat-total', datos.length);
      poner('personal-stat-empresas', empresas.length);
      poner('personal-stat-placa', datos.filter(v => String(v.placa || '').trim()).length);
      poner('personal-stat-sinplaca', datos.filter(v => !String(v.placa || '').trim()).length);

      filtrarPersonalSinEstacionamiento();
    }

    function filtrarPersonalSinEstacionamiento() {
      const q = normalizarTexto(document.getElementById('buscador-personal')?.value || '');
      const emp = document.getElementById('filtro-personal-empresa')?.value || '';
      const datos = (catalogosIngresoWeb.visitantes || []).filter(v => {
        if (emp && v.empresa !== emp) return false;
        if (!q) return true;
        return [
          v.usuario, v.placa, v.empresa, v.observaciones, v.tipoVehiculo
        ].some(x => normalizarTexto(x).includes(q));
      });
      renderPersonalSinEstacionamiento(datos);
    }

    function renderPersonalSinEstacionamiento(datos) {
      const tbody = document.getElementById('personal-sin-est-cuerpo');
      if (!tbody) return;
      if (!datos.length) {
        tbody.innerHTML = '<tr><td colspan="6">' + htmlEstadoVacioT28('Sin coincidencias', 'No hay personal que coincida con los filtros actuales.') + '</td></tr>';
        return;
      }
      tbody.innerHTML = datos.map(v => {
        const estilo = obtenerEstiloEmpresa(v.empresa);
        const placa = String(v.placa || '').trim();
        const obj = encodeURIComponent(JSON.stringify(v));
        const destacado = coincideDestacadoT28('personal', placa, v.usuario) ? ' t28-just-updated' : '';
        return `<tr class="t28-table-row${destacado}">
          <td class="py-2.5 px-3 font-bold text-slate-800">${escapeHtml(v.usuario || 'Sin nombre')}</td>
          <td class="py-2.5 px-3">${placa ? `<span class="parking-plate t28-plate">${escapeHtml(placa)}</span>` : '<span class="text-slate-400">Sin placa</span>'}</td>
          <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold ${estilo.bg} ${estilo.text}">${escapeHtml(v.empresa || 'Sin empresa')}</span></td>
          <td class="py-2.5 px-3 text-slate-600">${escapeHtml(v.observaciones || '---')}</td>
          <td class="py-2.5 px-3 text-slate-600">${escapeHtml(v.tipoVehiculo || 'No indicado')}</td>
          <td class="py-2.5 px-3"><div class="t28-row-actions">
            <button class="t28-icon-action" title="Editar" onclick="abrirModalPersonalSinEstacionamiento(JSON.parse(decodeURIComponent('${obj}')))">${ICONS.edit}</button>
            <button class="t28-icon-action is-danger" title="Eliminar" onclick="confirmarEliminarPersonalSinEstacionamiento(JSON.parse(decodeURIComponent('${obj}')))">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>
          </div></td>
        </tr>`;
      }).join('');
    }

    function abrirModalPersonalSinEstacionamiento(registro = null) {
      const modal = document.getElementById('modal-personal-sin-est');

      document.getElementById('personal-edit-fila').value = registro?.filaIndex || '';
      document.getElementById('personal-edit-id').value = registro?.id || '';
      document.getElementById('personal-form-usuario').value = registro?.usuario || '';
      document.getElementById('personal-form-placa').value = registro?.placa || '';
      document.getElementById('personal-form-empresa').value = registro?.empresa || '';
      document.getElementById('personal-form-tipo').value = registro?.tipoVehiculo || '';
      document.getElementById('personal-form-observacion').value = registro?.observaciones || '';
      document.getElementById('personal-modal-titulo').textContent = registro ? 'Editar personal' : 'Nuevo personal';
      const btnEliminar = document.getElementById('btn-eliminar-personal-form');
      if (btnEliminar) btnEliminar.classList.toggle('hidden', !registro);
      modal.classList.remove('hidden'); modal.classList.add('flex');
      actualizarVisibilidadFabT28();

      // Mostrar primero el formulario; actualizar catálogos después del repintado.
      requestAnimationFrame(function() {
        setTimeout(function() {
          actualizarListaEmpresasPersonalT28();
          if (!(todosLosDatos || []).length && !cargandoDatosServidor) {
            cargarDatosServidor(false);
          }
        }, 0);
      });
    }
    function cerrarModalPersonalSinEstacionamiento(){const m=document.getElementById('modal-personal-sin-est');m.classList.add('hidden');m.classList.remove('flex');actualizarVisibilidadFabT28();}
    function guardarPersonalSinEstacionamiento(){
      const filaIndex=Number(document.getElementById('personal-edit-fila').value||0);
      const id=document.getElementById('personal-edit-id').value.trim();
      const usuario=document.getElementById('personal-form-usuario').value.trim();
      const placa=normalizarPlacaIngreso(document.getElementById('personal-form-placa').value);
      const empresa=document.getElementById('personal-form-empresa').value.trim();
      const tipoVehiculo=document.getElementById('personal-form-tipo').value.trim();
      const observaciones=document.getElementById('personal-form-observacion').value.trim();
      if(!usuario)return marcarCamposFaltantes(['personal-form-usuario'],'Ingresa el nombre');
      if(!placa)return marcarCamposFaltantes(['personal-form-placa'],'Ingresa la placa');
      if(!empresa)return marcarCamposFaltantes(['personal-form-empresa'],'Ingresa la empresa');
      const respaldo=JSON.stringify(catalogosIngresoWeb.visitantes||[]);
      const registro={filaIndex:filaIndex||-Date.now(),id:id||('temp-'+Date.now()),usuario,placa,empresa,observaciones,tipoVehiculo};
      const lista=catalogosIngresoWeb.visitantes||(catalogosIngresoWeb.visitantes=[]);
      const pos=lista.findIndex(v=>(filaIndex&&Number(v.filaIndex)===filaIndex)||(id&&v.id===id));
      if(pos>=0)lista[pos]=Object.assign({},lista[pos],registro);else lista.unshift(registro);
      cerrarModalPersonalSinEstacionamiento();prepararPersonalSinEstacionamiento();mostrarToast(filaIndex?'¡Personal actualizado!':'¡Personal agregado!','exito');
      google.script.run.withSuccessHandler(()=>{marcarDestacadoT28('personal',placa||usuario);cargarCatalogosIngresoServidor();})
      .withFailureHandler(err=>{catalogosIngresoWeb.visitantes=JSON.parse(respaldo);prepararPersonalSinEstacionamiento();mostrarToast('No se pudo guardar: '+err.message,'error');abrirModalPersonalSinEstacionamiento(registro);})
      .guardarPersonalSinEstacionamientoWeb({filaIndex,id,usuario,placa,empresa,observaciones,tipoVehiculo});
    }


    function confirmarEliminarPersonalSinEstacionamiento(registro) {
      if (!registro) return;
      accionPeligrosaActual = {
        tipo: 'personal_sin_est',
        filaIndex: Number(registro.filaIndex || 0),
        id: registro.id || '',
        placa: registro.placa || '',
        usuario: registro.usuario || ''
      };
      abrirConfirmacionEliminacion({
        titulo: 'Eliminar personal',
        mensaje: 'Se eliminará este registro de Personal sin estacionamiento.',
        detalles: [
          ['Usuario', registro.usuario || '---'],
          ['Placa', registro.placa || '---'],
          ['Empresa', registro.empresa || '---']
        ]
      });
    }

    function confirmarEliminarPersonalDesdeForm() {
      confirmarEliminarPersonalSinEstacionamiento({
        filaIndex: Number(document.getElementById('personal-edit-fila').value || 0),
        id: document.getElementById('personal-edit-id').value || '',
        usuario: document.getElementById('personal-form-usuario').value || '',
        placa: document.getElementById('personal-form-placa').value || '',
        empresa: document.getElementById('personal-form-empresa').value || ''
      });
    }

    // ================= DIRECTORIO =================
    function cargarDirectorioServidor(mostrarNotif = false, forzar = false, incluirFotosForzado = null) {
      if (cargandoDirectorioT28) return;

      if (todosLosContactos.length && !mostrarNotif && !forzar) {
        filtrarDirectorio();
        return;
      }

      cargandoDirectorioT28 = true;
      const incluirFotos = incluirFotosForzado === null
        ? !(todosLosContactos || []).some(c => c?.fotoDataUrl)
        : Boolean(incluirFotosForzado);
      const fotosPrevias = new Map((todosLosContactos || []).map(c => [Number(c.filaIndex || 0), c]));
      const cont = document.getElementById('directorio-grid');
      if (cont && !todosLosContactos.length) cont.innerHTML = htmlSkeletonT28(esMovilRendimientoT28() ? 3 : 6);

      google.script.run
        .withSuccessHandler(function(data) {
          cargandoDirectorioT28 = false;
          ultimaCargaDirectorioT28 = Date.now();
          todosLosContactos = Array.isArray(data) ? data : [];
          if (!incluirFotos) {
            todosLosContactos = todosLosContactos.map(c => {
              const anterior = fotosPrevias.get(Number(c.filaIndex || 0));
              return anterior?.foto === c.foto && anterior?.fotoDataUrl
                ? { ...c, fotoDataUrl: anterior.fotoDataUrl }
                : c;
            });
          }
          guardarCacheVisualT28('directorio', todosLosContactos);
          registrarSincronizacionT28();

          const total = document.getElementById('directorio-total');
          if (total) total.textContent = todosLosContactos.length;
          if (moduloActual === 'directorio') filtrarDirectorio();
          if (mostrarNotif) mostrarToast('Directorio actualizado', 'exito');
          if (!incluirFotos && todosLosContactos.some(c => c.foto && !c.fotoDataUrl)) {
            setTimeout(() => cargarDirectorioServidor(false, true, true), 120);
          }
        })
        .withFailureHandler(function(err) {
          cargandoDirectorioT28 = false;
          if (cont && moduloActual === 'directorio') {
            cont.innerHTML = htmlEstadoVacioT28('No se pudo cargar el Directorio', 'Prueba nuevamente con Actualizar.');
          }
          if (mostrarNotif) mostrarToast('Error al cargar directorio: ' + err.message, 'error');
        })
        .obtenerDirectorioFotosWebT28(incluirFotos);
    }

    function filtrarDirectorio() {
      const q = normalizarTexto(document.getElementById('buscador-directorio')?.value || '');
      contactosFiltrados = (todosLosContactos || []).filter(c => {
        if (!q) return true;
        return [c.servicio, c.proveedor, c.contacto, c.numero, c.numero2, c.observacion]
          .some(x => normalizarTexto(x).includes(q));
      });
      renderDirectorio(contactosFiltrados);
    }

    function renderDirectorio(datos) {
      const cont = document.getElementById('directorio-grid');
      if (!cont) return;

      if (!datos.length) {
        cont.innerHTML = htmlEstadoVacioT28('Sin coincidencias', 'Prueba con otro servicio, proveedor, contacto o número.');
        return;
      }

      cont.innerHTML = datos.map(c => {
        const n1 = String(c.numero || '').trim();
        const n2 = String(c.numero2 || '').trim();
        const obj = encodeURIComponent(JSON.stringify(c));
        const foto = String(c.fotoDataUrl || '').trim();
        const avatar = foto
          ? `<img src="${escapeHtml(foto)}" alt="Foto de ${escapeHtml(c.contacto || c.proveedor || 'contacto')}">`
          : `<span>${escapeHtml(inicialesEmpresaT28(c.contacto || c.proveedor || 'CT'))}</span>`;

        const destacado = coincideDestacadoT28('directorio', c.servicio, c.proveedor) ? ' t28-just-updated' : '';
        return `<article class="directorio-card editable${destacado}">
          <div class="directorio-card-head">
            <div class="directorio-icon directorio-photo">${avatar}</div>
            <div class="min-w-0 flex-1">
              <p>${escapeHtml(c.servicio || 'Servicio')}</p>
              <h4>${escapeHtml(c.proveedor || 'Sin proveedor')}</h4>
            </div>
            <div class="directorio-card-actions">
              <button type="button" class="t28-icon-action directorio-edit-btn" title="Editar" onclick="abrirModalDirectorio(JSON.parse(decodeURIComponent('${obj}')))">
                ${ICONS.edit}
              </button>
              <button type="button" class="t28-icon-action is-danger" title="Eliminar" onclick="confirmarEliminarDirectorio(JSON.parse(decodeURIComponent('${obj}')))">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              </button>
            </div>
          </div>

          <div class="directorio-card-body">
            <div class="directorio-contact-line">
              <span>Persona de contacto</span>
              <strong>${escapeHtml(c.contacto || 'No indicado')}</strong>
            </div>

            <div class="directorio-phones">
              ${n1 ? `<button type="button" onclick="accionTelefonoDirectorio('${escapeHtml(n1)}')">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M6 2h4l2 5-3 2c1.5 3 3.5 5 6 6l2-3 5 2v4c0 2-1 3-3 3C9 21 3 15 3 5c0-2 1-3 3-3Z"/></svg>
                ${escapeHtml(n1)}
              </button>` : ''}
              ${n2 ? `<button type="button" onclick="accionTelefonoDirectorio('${escapeHtml(n2)}')">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M6 2h4l2 5-3 2c1.5 3 3.5 5 6 6l2-3 5 2v4c0 2-1 3-3 3C9 21 3 15 3 5c0-2 1-3 3-3Z"/></svg>
                ${escapeHtml(n2)}
              </button>` : ''}
              ${!n1 && !n2 ? '<span class="directorio-no-phone">Sin teléfono</span>' : ''}
            </div>

            ${c.observacion ? `<div class="directorio-note">${escapeHtml(c.observacion)}</div>` : ''}
          </div>
        </article>`;
      }).join('');
    }


    function confirmarEliminarDirectorio(registro) {
      if (!registro) return;
      accionPeligrosaActual = {
        tipo: 'directorio',
        filaIndex: Number(registro.filaIndex || 0),
        servicio: registro.servicio || '',
        proveedor: registro.proveedor || '',
        contacto: registro.contacto || ''
      };
      abrirConfirmacionEliminacion({
        titulo: 'Eliminar contacto',
        mensaje: 'Se eliminará este contacto del Directorio.',
        detalles: [
          ['Servicio', registro.servicio || '---'],
          ['Proveedor', registro.proveedor || '---'],
          ['Contacto', registro.contacto || '---']
        ]
      });
    }

    function confirmarEliminarDirectorioDesdeForm() {
      confirmarEliminarDirectorio({
        filaIndex: Number(document.getElementById('directorio-edit-fila').value || 0),
        servicio: document.getElementById('directorio-form-servicio').value || '',
        proveedor: document.getElementById('directorio-form-proveedor').value || '',
        contacto: document.getElementById('directorio-form-contacto').value || ''
      });
    }

    async function accionTelefonoDirectorio(numero) {
      const limpio = String(numero || '').trim();
      if (!limpio) return;

      const esMovil = window.matchMedia('(max-width: 768px)').matches ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (esMovil) {
        window.location.href = 'tel:' + limpio.replace(/\s+/g, '');
        return;
      }

      try {
        await navigator.clipboard.writeText(limpio);
        mostrarToast('Número copiado: ' + limpio, 'exito');
      } catch (e) {
        const area = document.createElement('textarea');
        area.value = limpio;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
        mostrarToast('Número copiado: ' + limpio, 'exito');
      }
    }

    function abrirModalDirectorio(registro=null){
      const m=document.getElementById('modal-directorio');
      document.getElementById('directorio-edit-fila').value=registro?.filaIndex||'';
      document.getElementById('directorio-form-servicio').value=registro?.servicio||'';
      document.getElementById('directorio-form-proveedor').value=registro?.proveedor||'';
      document.getElementById('directorio-form-contacto').value=registro?.contacto||'';
      document.getElementById('directorio-form-numero').value=registro?.numero||'';
      document.getElementById('directorio-form-numero2').value=registro?.numero2||'';
      document.getElementById('directorio-form-observacion').value=registro?.observacion||'';
      directorioImagenNuevaT28='';
      document.getElementById('directorio-form-foto').value='';
      actualizarPreviewFotoDirectorioT28(registro?.fotoDataUrl||'',registro?.contacto||registro?.proveedor||'CT',registro?.foto||'');
      document.getElementById('directorio-modal-titulo').textContent=registro?'Editar contacto':'Nuevo contacto';
      const btnEliminar = document.getElementById('btn-eliminar-directorio-form');
      if (btnEliminar) btnEliminar.classList.toggle('hidden', !registro);
      m.classList.remove('hidden');m.classList.add('flex');
    }
    function actualizarPreviewFotoDirectorioT28(dataUrl,nombre,ruta){
      const img=document.getElementById('directorio-foto-preview');
      const ini=document.getElementById('directorio-foto-iniciales');
      const rutaEl=document.getElementById('directorio-foto-ruta');
      if(dataUrl){img.src=dataUrl;img.classList.remove('hidden');ini.classList.add('hidden');}
      else{img.removeAttribute('src');img.classList.add('hidden');ini.textContent=inicialesEmpresaT28(nombre);ini.classList.remove('hidden');}
      rutaEl.textContent=ruta||(dataUrl?'Nueva imagen seleccionada':'Sin imagen seleccionada');
    }
    function seleccionarFotoDirectorioT28(input){
      const file=input?.files?.[0];if(!file)return;
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)){input.value='';return mostrarToast('Usa una imagen PNG, JPG o WebP.','aviso');}
      if(file.size>3*1024*1024){input.value='';return mostrarToast('La foto debe pesar máximo 3 MB.','aviso');}
      const reader=new FileReader();
      reader.onload=e=>{directorioImagenNuevaT28=String(e.target?.result||'');actualizarPreviewFotoDirectorioT28(directorioImagenNuevaT28,document.getElementById('directorio-form-contacto').value||document.getElementById('directorio-form-proveedor').value,'');};
      reader.onerror=()=>mostrarToast('No se pudo leer la foto.','error');reader.readAsDataURL(file);
    }
    function cerrarModalDirectorio(){const m=document.getElementById('modal-directorio');m.classList.add('hidden');m.classList.remove('flex');}
    function guardarDirectorio(){
      const filaIndex=Number(document.getElementById('directorio-edit-fila').value||0);
      const servicio=document.getElementById('directorio-form-servicio').value.trim();
      const proveedor=document.getElementById('directorio-form-proveedor').value.trim();
      const contacto=document.getElementById('directorio-form-contacto').value.trim();
      const numero=document.getElementById('directorio-form-numero').value.trim();
      const numero2=document.getElementById('directorio-form-numero2').value.trim();
      const observacion=document.getElementById('directorio-form-observacion').value.trim();
      const imagenDataUrl=directorioImagenNuevaT28;
      if(!servicio)return marcarCamposFaltantes(['directorio-form-servicio'],'Ingresa el servicio');
      if(!proveedor)return marcarCamposFaltantes(['directorio-form-proveedor'],'Ingresa el proveedor');
      const respaldo=JSON.stringify(todosLosContactos||[]);
      const pos=todosLosContactos.findIndex(c=>filaIndex&&Number(c.filaIndex)===filaIndex);
      const anterior=pos>=0?todosLosContactos[pos]:null;
      const registro={filaIndex:filaIndex||-Date.now(),servicio,proveedor,contacto,numero,numero2,observacion,foto:anterior?.foto||'',fotoDataUrl:imagenDataUrl||anterior?.fotoDataUrl||''};
      if(pos>=0)todosLosContactos[pos]=Object.assign({},todosLosContactos[pos],registro);else todosLosContactos.unshift(registro);
      cerrarModalDirectorio();filtrarDirectorio();mostrarToast(filaIndex?'¡Contacto actualizado!':'¡Contacto agregado!','exito');
      google.script.run.withSuccessHandler(()=>{directorioImagenNuevaT28='';marcarDestacadoT28('directorio',servicio||proveedor);cargarDirectorioServidor(false,true);})
      .withFailureHandler(err=>{todosLosContactos=JSON.parse(respaldo);filtrarDirectorio();mostrarToast('No se pudo guardar: '+err.message,'error');abrirModalDirectorio(registro);})
      .guardarDirectorioFotoWebT28({filaIndex,servicio,proveedor,contacto,numero,numero2,observacion,imagenDataUrl});
    }

    // ================= DIRECTORIO DE PERSONAS =================
    function actualizarTotalPersonasDirectorioT28(){
      const total=document.getElementById('personasdirectorio-total');
      if(total)total.textContent=personasDirectorioT28.length;
    }

    function actualizarEstadoPersonasDirectorioT28(texto, cargando=false, error=false, ocultarMs=0){
      const estado=document.getElementById('personasdirectorio-estado');if(!estado)return;
      clearTimeout(timerEstadoPersonasDirectorioT28);
      estado.classList.remove('hidden');
      estado.classList.toggle('is-loading',Boolean(cargando));
      estado.classList.toggle('is-error',Boolean(error));
      estado.innerHTML=`<span class="t28-directory-spinner" aria-hidden="true"></span><span>${escapeHtml(texto||'')}</span>`;
      if(ocultarMs>0)timerEstadoPersonasDirectorioT28=setTimeout(()=>estado.classList.add('hidden'),ocultarMs);
    }
    function ocultarEstadoPersonasDirectorioT28(){
      clearTimeout(timerEstadoPersonasDirectorioT28);
      document.getElementById('personasdirectorio-estado')?.classList.add('hidden');
    }
    function htmlSkeletonPersonasDirectorioT28(cantidad=4){
      return Array.from({length:cantidad},()=>`<article class="t28-people-card t28-people-skeleton" aria-hidden="true">
        <div class="t28-people-skeleton-head"><span class="t28-sk t28-people-sk-title"></span><span class="t28-sk t28-people-sk-action"></span><span class="t28-sk t28-people-sk-subtitle"></span></div>
        <span class="t28-sk t28-people-sk-photo"></span>
        <div class="t28-people-skeleton-note"><span class="t28-sk"></span></div>
      </article>`).join('');
    }

    function cargarPersonasDirectorioT28(mostrarNotif=false,forzar=false,incluirImagenesForzado=null){
      if(cargandoPersonasDirectorioT28){if(!personasDirectorioT28.length||mostrarNotif)actualizarEstadoPersonasDirectorioT28('Directorio sincronizándose…',true);return;}
      if(personasDirectorioT28.length&&!forzar){filtrarPersonasDirectorioT28();ocultarEstadoPersonasDirectorioT28();return;}
      cargandoPersonasDirectorioT28=true;
      const incluirImagenes=incluirImagenesForzado===null?!personasDirectorioT28.some(p=>imagenesRegistroDirectorioT28(p).length):Boolean(incluirImagenesForzado);
      const anteriores=new Map(personasDirectorioT28.map(p=>[String(p.id||p.filaIndex),p]));
      const grid=document.getElementById('personasdirectorio-grid');
      if(grid&&!personasDirectorioT28.length)grid.innerHTML=htmlSkeletonPersonasDirectorioT28(esMovilRendimientoT28()?3:4);
      if(!personasDirectorioT28.length||mostrarNotif)actualizarEstadoPersonasDirectorioT28(personasDirectorioT28.length?'Sincronizando Directorio…':(incluirImagenes?'Cargando Directorio y fotografías…':'Cargando registros del Directorio…'),true);
      google.script.run.withSuccessHandler(function(data){
        cargandoPersonasDirectorioT28=false;
        let nuevos=Array.isArray(data)?data:[];
        if(!incluirImagenes)nuevos=nuevos.map(p=>{const a=anteriores.get(String(p.id||p.filaIndex));if(!a)return p;return {...p,imagenDataUrl:a.imagen===p.imagen?a.imagenDataUrl:'',imagen2DataUrl:a.imagen2===p.imagen2?a.imagen2DataUrl:'',imagen3DataUrl:a.imagen3===p.imagen3?a.imagen3DataUrl:''};});
        if(nuevos.length||!personasDirectorioT28.length)personasDirectorioT28=nuevos;
        personasDirectorioFiltradasT28=personasDirectorioT28;
        guardarCacheVisualT28('personas_directorio',personasDirectorioT28);
        actualizarTotalPersonasDirectorioT28();
        if(moduloActual==='personasdirectorio')filtrarPersonasDirectorioT28();
        if(mostrarNotif||!anteriores.size)actualizarEstadoPersonasDirectorioT28(incluirImagenes?'Directorio y fotografías actualizados':'Directorio actualizado',false,false,1600);
        else ocultarEstadoPersonasDirectorioT28();
        if(mostrarNotif)mostrarToast('Directorio actualizado','exito');
        if(!incluirImagenes&&personasDirectorioT28.some(p=>(p.imagen&&!p.imagenDataUrl)||(p.imagen2&&!p.imagen2DataUrl)||(p.imagen3&&!p.imagen3DataUrl)))setTimeout(()=>cargarPersonasDirectorioT28(false,true,true),120);
      }).withFailureHandler(function(err){
        cargandoPersonasDirectorioT28=false;
        if(grid&&!personasDirectorioT28.length)grid.innerHTML=htmlEstadoVacioT28('No se pudo cargar el Directorio','Revisa la conexión y vuelve a intentarlo.');
        actualizarEstadoPersonasDirectorioT28(personasDirectorioT28.length?'Mostrando la copia guardada · sin conexión':'No se pudo cargar el Directorio',false,true,personasDirectorioT28.length?2600:0);
        if(mostrarNotif)mostrarToast('Error al cargar Directorio: '+(err?.message||err),'error');
      }).obtenerPersonasDirectorioWebT28(incluirImagenes);
    }

    function filtrarPersonasDirectorioT28(){
      const q=normalizarTexto(document.getElementById('buscador-personasdirectorio')?.value||'');
      personasDirectorioFiltradasT28=(personasDirectorioT28||[]).filter(p=>!q||[p.nombre,p.empresa,p.observaciones,p.id].some(v=>normalizarTexto(v).includes(q)));
      renderPersonasDirectorioT28(personasDirectorioFiltradasT28);
    }

    function imagenesRegistroDirectorioT28(p){
      return [p?.imagenDataUrl,p?.imagen2DataUrl,p?.imagen3DataUrl].filter(Boolean);
    }

    function renderPersonasDirectorioT28(datos){
      const grid=document.getElementById('personasdirectorio-grid');if(!grid)return;
      if(!datos.length){grid.innerHTML=htmlEstadoVacioT28('Sin registros','No hay coincidencias en el Directorio.');return;}
      grid.innerHTML=datos.map(p=>{
        const imagenes=imagenesRegistroDirectorioT28(p);
        const principal=imagenes[0]||'';
        const indice=personasDirectorioT28.findIndex(x=>Number(x.filaIndex)===Number(p.filaIndex));
        const visual=principal?`<img src="${escapeHtml(principal)}" alt="${escapeHtml(p.nombre||'Registro del directorio')}" loading="lazy" onclick="event.stopPropagation();abrirImagenPersonaDirectorioT28(${indice},0)">`:`<div class="t28-people-empty-image"><span>${escapeHtml(inicialesEmpresaT28(p.nombre||'DIR'))}</span><small>Sin imagen</small></div>`;
        const miniaturas=imagenes.length>1?`<div class="t28-people-thumbs">${imagenes.map((src,i)=>`<button type="button" onclick="event.stopPropagation();abrirImagenPersonaDirectorioT28(${indice},${i})"><img src="${escapeHtml(src)}" alt="Imagen ${i+1}"></button>`).join('')}</div>`:'';
        return `<article class="t28-people-card"><div class="t28-people-card-head"><div><h4>${escapeHtml(p.nombre||'Sin nombre')}</h4><p>${escapeHtml(p.empresa||'Sin empresa')}</p></div><button type="button" class="t28-icon-action" title="Editar" onclick="abrirFormPersonaDirectorioT28(${Number(p.filaIndex||0)})">${ICONS.edit}</button></div><div class="t28-people-main-image">${visual}</div>${miniaturas}<div class="t28-people-card-note">${escapeHtml(p.observaciones||'Sin observaciones')}</div></article>`;
      }).join('');
    }

    function abrirImagenPersonaDirectorioT28(indice,imagenIndice){
      const registro=personasDirectorioT28[indice];const src=imagenesRegistroDirectorioT28(registro)[imagenIndice];if(!src)return;
      const destino=document.getElementById('av-imagen-ampliada');const modal=document.getElementById('modal-aviso-imagen');if(!destino||!modal)return;
      destino.src=src;destino.alt=registro?.nombre||'Imagen del Directorio';restablecerZoomImagenAvisoT28();
      modal.classList.remove('hidden');modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');document.body.classList.add('t28-lightbox-open');
    }

    function actualizarPreviewPersonaDirectorioT28(numero,src){
      const img=document.getElementById('persona-directorio-preview-'+numero);const ph=document.getElementById('persona-directorio-placeholder-'+numero);if(!img||!ph)return;
      if(src){img.src=src;img.classList.remove('hidden');ph.classList.add('hidden');}else{img.removeAttribute('src');img.classList.add('hidden');ph.classList.remove('hidden');}
    }

    function abrirFormPersonaDirectorioT28(filaIndex=0){
      const p=(personasDirectorioT28||[]).find(x=>Number(x.filaIndex)===Number(filaIndex))||null;
      document.getElementById('persona-directorio-fila').value=p?.filaIndex||'';
      document.getElementById('persona-directorio-id').value=p?.id||'';
      document.getElementById('persona-directorio-nombre').value=p?.nombre||'';
      document.getElementById('persona-directorio-empresa').value=p?.empresa||'';
      document.getElementById('persona-directorio-observaciones').value=p?.observaciones||'';
      imagenesPersonaDirectorioNuevasT28=['','',''];
      const clavesImagen=['imagenDataUrl','imagen2DataUrl','imagen3DataUrl'];
      [1,2,3].forEach(n=>{document.getElementById('persona-directorio-imagen-'+n).value='';actualizarPreviewPersonaDirectorioT28(n,p?p[clavesImagen[n-1]]||'':'');});
      document.getElementById('persona-directorio-titulo').textContent=p?'Editar registro':'Nuevo registro';
      document.getElementById('btn-eliminar-persona-directorio').classList.toggle('hidden',!p);
      const modal=document.getElementById('modal-persona-directorio');modal.classList.remove('hidden');modal.classList.add('flex');actualizarVisibilidadFabT28();
    }

    function cerrarFormPersonaDirectorioT28(){const modal=document.getElementById('modal-persona-directorio');modal.classList.add('hidden');modal.classList.remove('flex');actualizarVisibilidadFabT28();}

    function seleccionarImagenPersonaDirectorioT28(input,numero){
      const file=input?.files?.[0];if(!file)return;
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)){input.value='';return mostrarToast('Usa imágenes PNG, JPG o WebP.','aviso');}
      if(file.size>4*1024*1024){input.value='';return mostrarToast('Cada imagen debe pesar máximo 4 MB.','aviso');}
      const reader=new FileReader();reader.onload=e=>{const src=String(e.target?.result||'');imagenesPersonaDirectorioNuevasT28[numero-1]=src;actualizarPreviewPersonaDirectorioT28(numero,src);};reader.onerror=()=>mostrarToast('No se pudo leer la imagen.','error');reader.readAsDataURL(file);
    }

    function guardarPersonaDirectorioT28(){
      const filaIndex=Number(document.getElementById('persona-directorio-fila').value||0);const id=document.getElementById('persona-directorio-id').value.trim();
      const nombre=document.getElementById('persona-directorio-nombre').value.trim();const empresa=document.getElementById('persona-directorio-empresa').value.trim();const observaciones=document.getElementById('persona-directorio-observaciones').value.trim();
      if(!nombre)return marcarCamposFaltantes(['persona-directorio-nombre'],'Ingresa el nombre.');if(!empresa)return marcarCamposFaltantes(['persona-directorio-empresa'],'Ingresa la empresa.');
      const anterior=personasDirectorioT28.find(p=>Number(p.filaIndex)===filaIndex)||{};const temporal={...anterior,filaIndex:filaIndex||-Date.now(),id:id||'',nombre,empresa,observaciones};
      ['imagenDataUrl','imagen2DataUrl','imagen3DataUrl'].forEach((k,i)=>{if(imagenesPersonaDirectorioNuevasT28[i])temporal[k]=imagenesPersonaDirectorioNuevasT28[i];});
      const respaldo=personasDirectorioT28.slice();const pos=personasDirectorioT28.findIndex(p=>filaIndex&&Number(p.filaIndex)===filaIndex);if(pos>=0)personasDirectorioT28[pos]=temporal;else personasDirectorioT28.unshift(temporal);
      cerrarFormPersonaDirectorioT28();filtrarPersonasDirectorioT28();guardarCacheVisualT28('personas_directorio',personasDirectorioT28);mostrarToast(filaIndex?'Registro actualizado':'Registro agregado','exito');
      google.script.run.withSuccessHandler(()=>{cargarPersonasDirectorioT28(false,true);}).withFailureHandler(err=>{personasDirectorioT28=respaldo;filtrarPersonasDirectorioT28();mostrarToast('No se pudo guardar: '+(err?.message||err),'error');}).guardarPersonaDirectorioWebT28({filaIndex,id,nombre,empresa,observaciones,imagenDataUrl:imagenesPersonaDirectorioNuevasT28[0],imagen2DataUrl:imagenesPersonaDirectorioNuevasT28[1],imagen3DataUrl:imagenesPersonaDirectorioNuevasT28[2]});
    }

    function eliminarPersonaDirectorioT28(){
      const filaIndex=Number(document.getElementById('persona-directorio-fila').value||0);if(!filaIndex||!confirm('¿Eliminar este registro del Directorio?'))return;
      const respaldo=personasDirectorioT28.slice();personasDirectorioT28=personasDirectorioT28.filter(p=>Number(p.filaIndex)!==filaIndex);cerrarFormPersonaDirectorioT28();filtrarPersonasDirectorioT28();actualizarTotalPersonasDirectorioT28();guardarCacheVisualT28('personas_directorio',personasDirectorioT28);
      google.script.run.withSuccessHandler(()=>mostrarToast('Registro eliminado','exito')).withFailureHandler(err=>{personasDirectorioT28=respaldo;filtrarPersonasDirectorioT28();mostrarToast('No se pudo eliminar: '+(err?.message||err),'error');}).eliminarPersonaDirectorioWebT28(filaIndex);
    }

    function cargarSuministrosServidor(mostrarNotif) {
      if(mostrarNotif) mostrarToast("Cargando suministros...", "guardando");
      if (!todosLosSuministros.length) renderSkeletonRows('suministros-cuerpo', 7, 6);
      google.script.run
        .withSuccessHandler(function(data) {
          todosLosSuministros = Array.isArray(data) ? data : [];
          suministrosFiltrados = todosLosSuministros;
          renderizarTablaSuministros(todosLosSuministros);
          if(mostrarNotif) mostrarToast("Suministros actualizados", "exito");
        })
        .withFailureHandler(function(error) {
          if(mostrarNotif) mostrarToast('Error al cargar suministros: ' + error.message, 'error');
        })
        .obtenerSuministrosLuz();
    }

    function filtrarSuministros() {
      const texto = normalizarTexto(document.getElementById('buscador-suministros').value);
      suministrosFiltrados = todosLosSuministros.filter(s => {
        return normalizarTexto(s.numSuministro).includes(texto) ||
               normalizarTexto(s.numOficina).includes(texto) ||
               normalizarTexto(s.empresa).includes(texto) ||
               normalizarTexto(s.descripcion).includes(texto) ||
               normalizarTexto(s.notas).includes(texto);
      });
      renderizarTablaSuministros(suministrosFiltrados);
    }

    function renderizarTablaSuministros(datos) {
      const tbody = document.getElementById('suministros-cuerpo');
      if (!datos.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-500 font-medium text-xs">No se encontraron suministros registrados.</td></tr>`;
        return;
      }

      tbody.innerHTML = datos.map(s => {
        let suministroJson = JSON.stringify(s).replace(/"/g, '&quot;');
        return `
          <tr class="t28-table-row">
            <td class="py-2.5 px-3 font-bold text-slate-700">${escapeHtml(s.id)}</td>
            <td class="py-2.5 px-3"><span class="parking-plate t28-plate">${escapeHtml(s.numSuministro)}</span></td>
            <td class="py-2.5 px-3 font-semibold text-slate-800">${escapeHtml(s.numOficina)}</td>
            <td class="py-2.5 px-3"><span class="t28-company-soft">${escapeHtml(s.empresa)}</span></td>
            <td class="py-2.5 px-3 text-slate-600">${escapeHtml(s.descripcion)}</td>
            <td class="py-2.5 px-3 text-slate-500 italic">${escapeHtml(s.notas || '---')}</td>
            <td class="py-2.5 px-3 text-center">
              <button onclick='abrirModalSuministro(${suministroJson})' class="t28-action-btn" title="Editar notas" aria-label="Editar notas">${ICONS.edit}</button>
            </td>
          </tr>`;
      }).join('');
    }

    function abrirModalSuministro(s) {
      document.getElementById('sum-fila-index').value = s.filaIndex;
      document.getElementById('sum-num').value = s.numSuministro;
      document.getElementById('sum-oficina').value = s.numOficina;
      document.getElementById('sum-empresa').value = s.empresa;
      document.getElementById('sum-desc').value = s.descripcion;
      document.getElementById('sum-notas').value = s.notas;
      document.getElementById('modal-suministro-titulo').textContent = `Editar Suministro: ${s.numSuministro} (Oficina ${s.numOficina})`;
      
      const modal = document.getElementById('modal-editar-suministro');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function cerrarModalSuministro() {
      const modal = document.getElementById('modal-editar-suministro');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    function guardarCambiosSuministro(event) {
      event.preventDefault();
      const datosSuministro = {
        filaIndex: document.getElementById('sum-fila-index').value,
        notas: document.getElementById('sum-notas').value
      };
      const suministroLocal=todosLosSuministros.find(s=>String(s.filaIndex)===String(datosSuministro.filaIndex));
      const notasAnteriores=suministroLocal?.notas||'';
      if(suministroLocal)suministroLocal.notas=datosSuministro.notas;
      cerrarModalSuministro();renderizarTablaSuministros(todosLosSuministros);mostrarToast('¡Notas actualizadas!','exito');

      google.script.run
        .withSuccessHandler(function() {
          cargarSuministrosServidor(false);
        })
        .withFailureHandler(function(err) {
          if(suministroLocal)suministroLocal.notas=notasAnteriores;
          renderizarTablaSuministros(todosLosSuministros);
          mostrarToast("Error al actualizar: " + err.message, 'error');
          abrirModalSuministro(suministroLocal);
        })
        .actualizarSuministroLuz(datosSuministro);
    }

    let historialRangoActual = [];

    function limpiarFiltrosHistorial() {
      document.getElementById('hist-fecha-inicio').value = '';
      document.getElementById('hist-fecha-fin').value = '';
      document.getElementById('hist-info').textContent = '';
      document.getElementById('btn-descargar-historial').disabled = true;
      historialRangoActual = [];

      const cuerpo = document.getElementById('historial-cuerpo');
      if (cuerpo) {
        cuerpo.innerHTML = '<tr><td colspan="10" class="text-center py-8 text-gray-400 font-medium text-xs">Selecciona un rango de fechas y presiona Buscar.</td></tr>';
      }
      actualizarBotonLimpiarHistorialT28();
    }

    function actualizarBotonLimpiarHistorialT28() {
      const inicio = document.getElementById('hist-fecha-inicio')?.value || '';
      const fin = document.getElementById('hist-fecha-fin')?.value || '';
      const btn = document.getElementById('btn-limpiar-historial');
      if (btn) btn.classList.toggle('hidden', !inicio && !fin);
    }

    function buscarHistorialRango() {
      const inicio = document.getElementById('hist-fecha-inicio').value;
      const fin = document.getElementById('hist-fecha-fin').value;

      if (!inicio || !fin) {
        marcarCamposFaltantes(!inicio ? ['hist-fecha-inicio','hist-fecha-fin'] : ['hist-fecha-fin'], 'Selecciona ambas fechas (Desde y Hasta).');
        return;
      }

      const btn = document.getElementById('btn-buscar-historial');
      btn.disabled = true;
      btn.textContent = "Buscando...";
      document.getElementById('btn-descargar-historial').disabled = true;
      document.getElementById('hist-info').textContent = "";
      mostrarToast("Consultando historial...", "guardando");
      renderSkeletonRows('historial-cuerpo', 10, 5);

      google.script.run
        .withSuccessHandler(function(resultado) {
          btn.disabled = false;
          btn.innerHTML = '<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg> Buscar';
          historialRangoActual = resultado.datos;
          renderizarHistorialRango(resultado.datos);

          const infoEl = document.getElementById('hist-info');
          if (resultado.datos.length === 0) {
            infoEl.textContent = "No se encontraron movimientos en ese rango.";
          } else {
            infoEl.textContent = `${resultado.datos.length} registro(s) encontrado(s)` +
              (resultado.truncado ? " — mostrando solo los más recientes (rango muy amplio, acórtalo para ver todo)." : ".");
            document.getElementById('btn-descargar-historial').disabled = false;
          }
          mostrarToast("Búsqueda completada", "exito");
        })
        .withFailureHandler(function(err) {
          btn.disabled = false;
          btn.innerHTML = '<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg> Buscar';
          mostrarToast("Error: " + err.message, 'error');
        })
        .obtenerMovimientosPorRango(inicio, fin);
    }

    function renderizarHistorialRango(datos) {
      const tbody = document.getElementById('historial-cuerpo');
      if (!datos.length) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-gray-400 font-medium text-xs">Sin resultados para ese rango.</td></tr>`;
        return;
      }

      tbody.innerHTML = datos.map(mov => {
        let esAbierto = mov.estado.toLowerCase().includes('abierto');
        let badgeEstado = esAbierto ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700';
        let estiloEmp = obtenerEstiloEmpresa(mov.empresa);

        return `
          <tr class="t28-table-row">
            <td class="py-2.5 px-3 font-medium text-slate-900">${escapeHtml(mov.horaEntrada)}</td>
            <td class="py-2.5 px-3"><span class="parking-plate t28-plate">${escapeHtml(mov.placa)}</span></td>
            <td class="t28-col-user py-2.5 px-3 font-medium text-slate-800">${escapeHtml(mov.nombre)} <span class="text-[10px] text-slate-400 block">${escapeHtml(mov.documento)}</span></td>
            <td class="py-2.5 px-3 font-semibold"><span class="px-2 py-0.5 rounded text-[11px] font-bold ${estiloEmp.bg} ${estiloEmp.text}">${escapeHtml(mov.empresa)}</span></td>
            <td class="py-2.5 px-3 font-bold text-slate-700"><span class="t28-est-badge">Est. ${escapeHtml(mov.est)}</span></td>
            <td class="py-2.5 px-3 text-slate-600">${escapeHtml(mov.tipoIngreso)}</td>
            <td class="py-2.5 px-3 text-slate-500 italic">${escapeHtml(mov.observaciones || '---')}</td>
            <td class="py-2.5 px-3 text-slate-600">${escapeHtml(mov.horaSalida)}</td>
            <td class="py-2.5 px-3 font-medium text-slate-700">${escapeHtml(mov.registradoPor)}</td>
            <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${badgeEstado}">${escapeHtml(mov.estado)}</span></td>
          </tr>`;
      }).join('');
    }

    async function descargarHistorialRango() {
      if (historialRangoActual.length === 0) {
        mostrarToast("No hay datos cargados para descargar. Haz una búsqueda primero.", 'aviso');
        return;
      }
      const inicio = document.getElementById('hist-fecha-inicio').value;
      const fin = document.getElementById('hist-fecha-fin').value;

      mostrarToast("Preparando archivo Excel...", "guardando");
      try {
        await cargarXlsxSoloCuandoSeNecesiteT28();
      } catch (err) {
        mostrarToast(err.message || "No se pudo preparar Excel.", "error");
        return;
      }

      const wb = XLSX.utils.book_new();
      const datos = historialRangoActual.map(m => ({
        "Hora Entrada": m.horaEntrada,
        "Placa": m.placa,
        "Conductor": m.nombre,
        "Documento": m.documento,
        "Empresa": m.empresa,
        "Estacionamiento": "Est. " + m.est,
        "Tipo Ingreso": m.tipoIngreso,
        "Observaciones": m.observaciones || "",
        "Hora Salida": m.horaSalida,
        "Registrado Por": m.registradoPor,
        "Estado": m.estado
      }));

      const ws = XLSX.utils.json_to_sheet(datos);
      ws['!cols'] = Object.keys(datos[0]).map(k => ({ wch: Math.max(k.length, 14) }));
      XLSX.utils.book_append_sheet(wb, ws, "Historial");
      XLSX.writeFile(wb, `Historial_${inicio}_a_${fin}.xlsx`);
      mostrarToast("Reporte descargado correctamente", "exito");
    }

