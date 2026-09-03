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
    let empresasCatalogoT28 = [];
    let empresaImagenNuevaT28 = '';
    let empresaCatalogoCargandoT28 = false;
    let empresaCatalogoConLogosT28 = false;
    let empresaCatalogoCargaSeqT28 = 0;
    let empresaCatalogoTimerT28 = null;
    let empresaDetalleActualT28 = null;

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
        'modal-personal-sin-est', 'modal-directorio', 'modal-cerrar-sesion',
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
      intervaloFechaHoraTopbar = setInterval(actualizarFechaHoraTopbar, 30000);
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
      administrador: ['dashboard','movimientos','usuarios','empresas','historial','directorio','suministros','crear','editar','eliminar','descargar','sincronizar','administrar'],
      admin: ['dashboard','movimientos','usuarios','empresas','historial','directorio','suministros','crear','editar','eliminar','descargar','sincronizar','administrar'],
      consulta: ['dashboard','movimientos','usuarios','empresas','historial','directorio','suministros'],
      control: ['dashboard','movimientos','usuarios','empresas','historial','directorio','suministros','crear','editar','descargar','sincronizar']
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
      return ({dashboard:'dashboard',movimientos:'movimientos',empresas:'usuarios',historial:'historial',directorio:'directorio',suministros:'suministros',catalogoempresas:'empresas'})[modulo] || modulo;
    }

    function aplicarPermisosInterfazT28() {
      const modulos=['dashboard','movimientos','empresas','historial','directorio','suministros','catalogoempresas'];
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
      document.body.classList.add('t28-auth-pending');
      if(intervaloSesionT28){clearInterval(intervaloSesionT28);intervaloSesionT28=null;}

      const login = document.getElementById('t28-login-screen');
      const app = document.getElementById('t28-app-shell');

      if (login) login.classList.remove('t28-login-hidden');
      if (app) app.classList.add('t28-app-locked');

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
        }).catch(function(){/* Una caída temporal de Internet no cierra la sesión. */});
      },60000);
    }

    function iniciarAplicacionT28() {
      document.body.classList.remove('dark-mode');
      aplicarConfiguracionT28(true);

      const toastEl = document.getElementById('toast-notificacion');
      if (toastEl) document.body.appendChild(toastEl);

      const esMovilT28 = window.matchMedia('(max-width: 768px)').matches;
      const datosLocales = localStorage.getItem('torre28_estacionamientos');

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

      T28Api.validarSesion(token)
        .then(function(res) {
          if (res && res.ok && res.usuario) {
            mostrarAplicacionT28(res.usuario);
          } else {
            localStorage.removeItem(T28_AUTH_TOKEN_KEY);
            mostrarPantallaLoginT28();
          }
        })
        .catch(function() {
          localStorage.removeItem(T28_AUTH_TOKEN_KEY);
          mostrarPantallaLoginT28();
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
        if (!tabla || !tabla.matches('#tabla-asignaciones, #tabla-personal-sin-est, #modulo-movimientos table, #tabla-historial, #tabla-suministros')) return;

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
        btn.setAttribute('title', 'Descargar directorio');
        btn.style.display = 'flex';
        if (texto) texto.textContent = 'Descargar directorio';
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
        !['dashboard', 'historial', 'catalogoempresas'].includes(modulo) &&
        !estaEnPersonalSinEst;

      btn.style.display = mostrar ? 'flex' : 'none';
    }

    function actualizarSincronizacionTopbarT28(modulo) {
      const btn = document.getElementById('btn-sync-global');
      if (!btn) return;

      const acciones = {
        dashboard: ['Sincronizar Inicio', () => forzarActualizacion()],
        movimientos: ['Actualizar movimientos', () => cargarHistorialHoy()],
        empresas: vistaUsuariosActual === 'personal'
          ? ['Actualizar personal', () => cargarCatalogosIngresoServidor()]
          : ['Actualizar trabajadores fijos', () => cargarDatosServidor(true)],
        historial: ['Buscar historial', () => buscarHistorialRango()],
        directorio: ['Actualizar directorio', () => cargarDirectorioServidor(true, true)],
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
      if(moduloActual === 'movimientos' || moduloActual === 'dashboard') cargarHistorialHoy();
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
        }
      };

      const configuracion = accionesFab[moduloActual] || null;
      const permitido = Boolean(configuracion) && !hayModalOperativoAbierto();

      if (configuracion) {
        fab.onpointerdown = null;
        // Un único click funciona con toque, mouse, teclado y navegadores Android antiguos.
        fab.onclick = function(evento) {
          evento.preventDefault();
          evento.stopPropagation();
          configuracion.accion();
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

      const modulosMas = ['directorio', 'suministros', 'catalogoempresas'];
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
      const modulos = ['dashboard','movimientos','empresas','historial','directorio','suministros','catalogoempresas'];
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
        directorio: ['Directorio', 'Contactos operativos y proveedores del edificio'],
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
          cargarHistorialHoy(movimientosOptimistasT28.length > 0);
        }
        return;
      }

      if (modulo === 'directorio') {
        cargarDirectorioServidor(false, false);
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
      const modulosValidos = ['dashboard','movimientos','empresas','historial','directorio','suministros','catalogoempresas'];
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
        directorio: ['Directorio', 'Contactos operativos y proveedores del edificio'],
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
          (!['dashboard', 'historial', 'catalogoempresas'].includes(modulo) && !ocultarEnPersonal)
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
          const pct = Math.round((topTipo[1] / total) * 100);
          insights.push({ icono: 'pulse', titulo: 'Tipo de ingreso predominante', valor: `${topTipo[0]} · ${pct}%`, sub: `${topTipo[1]} de ${total} movimientos de hoy` });
        }
      }

      const totalPuestos = (todosLosDatos || []).length;
      const abiertos = movs.filter(m => normalizarTexto(m.estado).includes('abierto')).length;
      const libresEstimado = Math.max(0, totalPuestos - abiertos);
      insights.push({ icono: 'parking', titulo: 'Disponibilidad estimada', valor: `${libresEstimado} de ${totalPuestos}`, sub: 'Puestos sin movimiento abierto ahora' });

      if (total) {
        const conteoHora = {};
        movs.forEach(m => {
          const h = String(m.horaEntrada || '').match(/(\d{1,2}):\d{2}/);
          if (h) { const hora = h[1].padStart(2, '0'); conteoHora[hora] = (conteoHora[hora] || 0) + 1; }
        });
        const topHora = Object.entries(conteoHora).sort((a, b) => b[1] - a[1])[0];
        if (topHora) insights.push({ icono: 'clock', titulo: 'Hora pico de hoy', valor: `${topHora[0]}:00 - ${topHora[0]}:59`, sub: `${topHora[1]} ingreso${topHora[1] === 1 ? '' : 's'} en esa hora` });
      }

      if (total) {
        const conteoEst = {};
        movs.forEach(m => { const e = String(m.est || '').trim(); if (e) conteoEst[e] = (conteoEst[e] || 0) + 1; });
        const topEst = Object.entries(conteoEst).sort((a, b) => b[1] - a[1])[0];
        if (topEst) insights.push({ icono: 'repeat', titulo: 'Estacionamiento más usado hoy', valor: `Est. ${topEst[0]}`, sub: `${topEst[1]} movimiento${topEst[1] === 1 ? '' : 's'} registrados ahí` });
      }

      if (!insights.length) {
        insights.push({ icono: 'info', titulo: 'Sin movimientos aún', valor: '—', sub: 'Los datos aparecerán cuando se registre el primer ingreso del día' });
      }
      return insights;
    }

    function renderizarInsightDashboard() {
      const cont = document.getElementById('dashboard-insight-contenido');
      const dots = document.getElementById('dashboard-insight-dots');
      if (!cont || !insightsActuales.length) return;
      if (insightIndiceActual >= insightsActuales.length) insightIndiceActual = 0;
      const ins = insightsActuales[insightIndiceActual];

      cont.classList.add('fading');
      setTimeout(() => {
        cont.innerHTML = `
          <div class="dash-insight-mini-icon">${INSIGHT_ICONS[ins.icono] || INSIGHT_ICONS.info}</div>
          <div class="dash-insight-mini-copy">
            <p class="dash-insight-mini-title">${escapeHtml(ins.titulo)}</p>
            <p class="dash-insight-mini-value">${escapeHtml(ins.valor)}</p>
            <p class="dash-insight-mini-sub">${escapeHtml(ins.sub)}</p>
          </div>`;
        cont.classList.remove('fading');
      }, 180);

      if (dots) {
        dots.innerHTML = insightsActuales.map((_, i) =>
          `<button type="button" onclick="irAInsight(${i})" class="dash-insight-dot ${i === insightIndiceActual ? 'active' : ''}" aria-label="Ver dato ${i + 1} de ${insightsActuales.length}"></button>`
        ).join('');
      }
    }

    function irAInsight(i) {
      insightIndiceActual = i;
      renderizarInsightDashboard();
      reiniciarRotacionInsights();
    }

    function avanzarInsight() {
      if (!insightsActuales.length) return;
      insightIndiceActual = (insightIndiceActual + 1) % insightsActuales.length;
      renderizarInsightDashboard();
    }

    function retrocederInsight() {
      if (!insightsActuales.length) return;
      insightIndiceActual = (insightIndiceActual - 1 + insightsActuales.length) % insightsActuales.length;
      renderizarInsightDashboard();
      reiniciarRotacionInsights();
    }

    function avanzarInsightManual() {
      avanzarInsight();
      reiniciarRotacionInsights();
    }

    function pausarRotacionInsights() {
      if (intervaloInsights) { clearInterval(intervaloInsights); intervaloInsights = null; }
    }

    function reiniciarRotacionInsights() {
      pausarRotacionInsights();
      intervaloInsights = setInterval(() => {
        if (moduloActual === 'dashboard' && !document.hidden) avanzarInsight();
      }, esMovilRendimientoT28() ? 12000 : 5000);
    }

    function actualizarInsightsDashboard() {
      insightsActuales = calcularInsightsDashboard();
      if (insightIndiceActual >= insightsActuales.length) insightIndiceActual = 0;
      renderizarInsightDashboard();
      if (!intervaloInsights) reiniciarRotacionInsights();
    }

    function cambiarVistaEst(tipo) {
      vistaEstActual = tipo;
      const btnTarjetas = document.getElementById('btn-vista-tarjetas');
      const btnTabla = document.getElementById('btn-vista-tabla');
      const containerTarjetas = document.getElementById('vista-tarjetas-container');
      const containerTabla = document.getElementById('vista-tabla-container');

      if (tipo === 'tarjetas') {
        btnTarjetas.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition bg-indigo-600 text-white shadow-sm btn-icon-inline";
        btnTabla.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition text-gray-600 hover:text-gray-900 btn-icon-inline";
        containerTarjetas.classList.remove('hidden');
        containerTabla.classList.add('hidden');
      } else {
        btnTabla.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition bg-indigo-600 text-white shadow-sm btn-icon-inline";
        btnTarjetas.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition text-gray-600 hover:text-gray-900 btn-icon-inline";
        containerTabla.classList.remove('hidden');
        containerTarjetas.classList.add('hidden');
      }
      filtrarDatos();
    }

    function fechaHoraLocalInput(fecha = new Date()) {
      const pad = n => String(n).padStart(2,'0');
      return `${fecha.getFullYear()}-${pad(fecha.getMonth()+1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
    }

    function cargarCatalogosIngresoServidor() {
      if (cargandoCatalogosIngreso) return;
      cargandoCatalogosIngreso = true;

      T28Api.catalogosIngreso()
        .then(function(res) {
          const data = res?.data;
          cargandoCatalogosIngreso = false;
          catalogosIngresoListosT28 = true;
          catalogosIngresoWeb = data || { visitantes: [], personal: [], encargadoDia: null };
          encargadoDiaActual = catalogosIngresoWeb.encargadoDia || null;

          ejecutarIdleT28(function() {
            prepararCatalogosIngreso();
            prepararSelectorEncargadoDia();
            actualizarUIEncargadoDia();
            prepararPersonalSinEstacionamiento();
            if (modoFormularioIngreso === 'crear') {
              aplicarEncargadoDiaIngreso();
            } else if (modoFormularioIngreso === 'editar' && movimientoEditandoActual) {
              seleccionarRegistradoPorMovimiento(movimientoEditandoActual);
            }
          }, 250);
        })
        .catch(function(err) {
          cargandoCatalogosIngreso = false;
          catalogosIngresoListosT28 = false;
          console.error(err);

          if (vistaUsuariosActual === 'personal') {
            const tbody = document.getElementById('personal-sin-est-cuerpo');
            if (tbody) {
              tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-red-500">No se pudo cargar Personal sin estacionamiento.</td></tr>`;
            }
          }
        });
    }

    function prepararCatalogosIngreso() {
      const empresas = obtenerEmpresasSistemaT28();
      const selEmpresa = document.getElementById('ing-empresa');
      if (selEmpresa) {
        const actual = selEmpresa.value;
        selEmpresa.innerHTML = '<option value="">Seleccione empresa...</option>';
        empresas.forEach(e => selEmpresa.add(new Option(e,e)));
        if (empresas.includes(actual)) selEmpresa.value = actual;
      }

      const dl = document.getElementById('ing-lista-placas');
      if (dl) {
        const opciones = [];
        const usadas = new Set();

        (todosLosDatos || []).forEach(item => (item.ocupantes || []).forEach(o => {
          if (o.esVirtual === true || !o.placa || o.placa === '---') return;
          const k = normalizarTexto(o.placa).replace(/\s+/g,'');
          if (usadas.has(k)) return;
          usadas.add(k);
          opciones.push(`<option value="${escapeHtml(o.placa)}">${escapeHtml(o.usuario || '')} | ${escapeHtml(item.empresa || '')} | Trab. fijo · Est. ${escapeHtml(item.est)}</option>`);
        }));

        (catalogosIngresoWeb.visitantes || []).forEach(v => {
          const k = normalizarTexto(v.placa).replace(/\s+/g,'');
          if (!k || usadas.has(k)) return;
          usadas.add(k);
          opciones.push(`<option value="${escapeHtml(v.placa)}">${escapeHtml(v.usuario || '')} | ${escapeHtml(v.empresa || '')} | Trab. provisional</option>`);
        });

        dl.innerHTML = opciones.join('');
      }

      const reg = document.getElementById('ing-reg-por');
      if (reg) {
        const actual = reg.value;
        reg.innerHTML = '<option value="">Seleccione personal...</option>';
        (catalogosIngresoWeb.personal || []).forEach(p => {
          const op = new Option(p.nombre || p.id, p.id || p.nombre);
          op.dataset.nombre = p.nombre || '';
          reg.add(op);
        });
        if ([...reg.options].some(o => o.value === actual)) reg.value = actual;
      }

      prepararSelectorEncargadoDia();
    }

    function prepararSelectorEncargadoDia() {
      const sel = document.getElementById('encargado-dia-select');
      if (!sel) return;

      const actual = encargadoDiaActual?.id || sel.value || '';
      sel.innerHTML = '<option value="">Seleccione personal...</option>';

      (catalogosIngresoWeb.personal || []).forEach(p => {
        const op = new Option(p.nombre || p.id, p.id || p.nombre);
        op.dataset.nombre = p.nombre || '';
        sel.add(op);
      });

      if ([...sel.options].some(o => String(o.value) === String(actual))) {
        sel.value = actual;
      }
    }

    function aplicarEncargadoDiaIngreso() {
      if (modoFormularioIngreso !== 'crear' || !encargadoDiaActual?.id) return;
      const reg = document.getElementById('ing-reg-por');
      if (!reg) return;
      if ([...reg.options].some(o => String(o.value) === String(encargadoDiaActual.id))) {
        reg.value = encargadoDiaActual.id;
      }
    }

    function seleccionarRegistradoPorMovimiento(movimiento) {
      const reg = document.getElementById('ing-reg-por');
      if (!reg || !movimiento) return;

      const id = String(movimiento.registradoPorId || '').trim();
      const nombre = String(movimiento.registradoPor || movimiento.registradoPorNombre || '').trim();
      const opcion = [...reg.options].find(o =>
        (id && String(o.value) === id) ||
        (nombre && normalizarTexto(o.dataset.nombre || o.textContent) === normalizarTexto(nombre))
      );

      if (opcion) reg.value = opcion.value;
    }

    function actualizarUIEncargadoDia() {
      const box = document.getElementById('encargado-dia-actual-box');
      const nombre = document.getElementById('encargado-dia-actual-nombre');
      if (box && nombre) {
        const hay = Boolean(encargadoDiaActual?.nombre);
        box.classList.toggle('hidden', !hay);
        nombre.textContent = hay ? encargadoDiaActual.nombre : '';
      }

      const sideBox = document.getElementById('sidebar-responsable-box');
      const sideNombre = document.getElementById('sidebar-responsable-nombre');
      if (sideBox && sideNombre) {
        sideBox.classList.remove('hidden');
        sideNombre.textContent = encargadoDiaActual?.nombre || 'Sin asignar';
      }

      actualizarEstadoBotonResponsable();
    }

    function actualizarEstadoBotonResponsable() {
      const sel = document.getElementById('encargado-dia-select');
      const btn = document.getElementById('btn-guardar-encargado-dia');
      if (!sel || !btn) return;

      const original = String(encargadoDiaActual?.id || '');
      const actual = String(sel.value || '');
      const cambio = Boolean(actual) && actual !== original;

      btn.disabled = !cambio;
      btn.textContent = cambio ? 'Guardar cambios' : 'Sin cambios';
    }

    function abrirModalEncargadoDia() {
      const modal = document.getElementById('modal-encargado-dia');
      const sel = document.getElementById('encargado-dia-select');
      const btn = document.getElementById('btn-guardar-encargado-dia');
      const fecha = document.getElementById('encargado-dia-fecha');

      if (fecha) {
        fecha.textContent = new Intl.DateTimeFormat('es-PE', {
          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        }).format(new Date());
      }

      modal.classList.remove('hidden');
      modal.classList.add('flex');

      if (sel) {
        sel.disabled = true;
        sel.innerHTML = '<option value="">Cargando personal...</option>';
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sin cambios';
      }

      google.script.run
        .withSuccessHandler(function(data) {
          const personal = Array.isArray(data?.personal) ? data.personal : [];
          const responsableId = String(data?.responsableId || data?.encargadoDia?.id || '').trim();

          catalogosIngresoWeb = data || { visitantes: [], personal: [], encargadoDia: null };
          encargadoDiaActual = responsableId
            ? {
                id: responsableId,
                nombre: (personal.find(p => String(p.id).trim() === responsableId)?.nombre || data?.encargadoDia?.nombre || '')
              }
            : null;

          catalogosIngresoWeb.encargadoDia = encargadoDiaActual;

          if (sel) {
            sel.disabled = false;
            sel.innerHTML = '<option value="">Seleccione personal...</option>';

            personal.forEach(p => {
              const id = String(p.id || '').trim();
              const nombre = String(p.nombre || '').trim();
              if (!id || !nombre) return;

              const op = new Option(nombre, id);
              op.dataset.nombre = nombre;
              sel.add(op);
            });

            if (responsableId && [...sel.options].some(o => String(o.value).trim() === responsableId)) {
              sel.value = responsableId;
            }
            sel.onchange = actualizarEstadoBotonResponsable;
          }

          prepararCatalogosIngreso();
          actualizarUIEncargadoDia();
          aplicarEncargadoDiaIngreso();
          actualizarEstadoBotonResponsable();
        })
        .withFailureHandler(function(err) {
          if (sel) {
            sel.disabled = true;
            sel.innerHTML = '<option value="">Error al cargar personal</option>';
          }
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'Sin cambios';
          }
          mostrarToast('No se pudo cargar el personal: ' + (err?.message || err), 'error');
        })
        .obtenerCatalogosIngresoWeb();
    }

    function cerrarModalEncargadoDia() {
      const modal = document.getElementById('modal-encargado-dia');
      if (!modal) return;
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    function guardarEncargadoDia() {
      const sel = document.getElementById('encargado-dia-select');
      const btn = document.getElementById('btn-guardar-encargado-dia');
      if (!sel || !sel.value) {
        marcarCamposFaltantes(['encargado-dia-select'], 'Selecciona al agente de turno.');
        return;
      }

      const original = String(encargadoDiaActual?.id || '');
      if (String(sel.value) === original) {
        cerrarModalEncargadoDia();
        return;
      }

      const opt = sel.options[sel.selectedIndex];
      const datos = {
        id: sel.value,
        nombre: opt?.dataset.nombre || opt?.textContent || ''
      };

      btn.disabled = true;
      btn.textContent = 'Guardando...';

      google.script.run
        .withSuccessHandler(function(res) {
          btn.disabled = false;
          btn.textContent = 'Guardar cambios';
          encargadoDiaActual = res || datos;
          catalogosIngresoWeb.encargadoDia = encargadoDiaActual;
          actualizarUIEncargadoDia();
          aplicarEncargadoDiaIngreso();
          cerrarModalEncargadoDia();
          mostrarToast(`Agente de turno: ${encargadoDiaActual.nombre}`, 'exito');
        })
        .withFailureHandler(function(err) {
          btn.disabled = false;
          btn.textContent = 'Guardar cambios';
          mostrarToast('No se pudo guardar el agente de turno: ' + err.message, 'error');
        })
        .guardarEncargadoDiaWeb(datos);
    }

    function abrirModalIngreso() {
      modoFormularioIngreso = 'crear';
      movimientoEditandoActual = null;

      prepararCatalogosIngreso();

      if (ingresoPendienteReintentoT28) {
        document.getElementById('ing-modal-titulo').innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.3 6.4L3 16"/><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8"/></svg> Reintentar ingreso vehicular';
        document.getElementById('ing-modal-titulo').classList.add('btn-icon-inline');
        document.getElementById('ing-modal-subtitulo').textContent = 'Los datos se conservaron porque la conexión falló';
        document.getElementById('btn-guardar-ingreso').textContent = 'Reintentar registro';
        const modalPendiente = document.getElementById('modal-ingreso');
        modalPendiente.classList.remove('hidden');
        modalPendiente.classList.add('flex');
        actualizarVisibilidadFabT28();
        return;
      }

      document.getElementById('ing-modal-titulo').innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M5 11 6.5 6a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 11"/><rect x="3" y="11" width="18" height="7" rx="2"/><circle cx="7.5" cy="18" r="1.4"/><circle cx="16.5" cy="18" r="1.4"/></svg> Registrar ingreso vehicular';
      document.getElementById('ing-modal-titulo').classList.add('btn-icon-inline');
      document.getElementById('ing-modal-subtitulo').textContent = 'Nuevo movimiento del día';
      document.getElementById('btn-guardar-ingreso').textContent = 'Guardar ingreso';

      limpiarCamposInvalidos(['ing-placa','ing-nombre','ing-empresa','ing-est','ing-hora','ing-reg-por']);
      document.getElementById('ing-placa').value = '';
      document.getElementById('ing-nombre').value = '';
      document.getElementById('ing-doc-tipo').value = 'DNI';
      document.getElementById('ing-doc-num').value = '';
      document.getElementById('ing-acomp').value = '0';
      document.getElementById('ing-acompanantes-container').innerHTML = '';
      document.getElementById('ing-obs').value = '';
      document.getElementById('ing-hora').value = fechaHoraLocalInput();
      document.getElementById('ing-hora-salida').value = '';
      document.getElementById('ing-empresa').value = '';
      document.getElementById('ing-reg-por').value = '';
      aplicarEncargadoDiaIngreso();

      seleccionarTipoIngreso('Trabajador');
      seleccionarTipoEstacionamiento('Propio');

      const m = document.getElementById('modal-ingreso');
      m.classList.remove('hidden');
      m.classList.add('flex');
      actualizarVisibilidadFabT28();

      if (!(catalogosIngresoWeb.personal || []).length) cargarCatalogosIngresoServidor();
    }

    function cerrarModalIngreso() {
      const m = document.getElementById('modal-ingreso');
      m.classList.remove('flex');
      m.classList.add('hidden');
      actualizarVisibilidadFabT28();
    }

    function seleccionarTipoIngreso(tipo) {
      document.getElementById('ing-tipo').value = tipo;
      ['Trabajador','Visita','Proveedor'].forEach(t => {
        const b = document.getElementById('ing-btn-' + t.toLowerCase());
        if (b) b.classList.toggle('active', t === tipo);
      });

      const esTrabajador = tipo === 'Trabajador';
      document.getElementById('ing-datos-visita').classList.toggle('hidden', esTrabajador);

      if (esTrabajador) {
        document.getElementById('ing-doc-num').value = '';
        document.getElementById('ing-acomp').value = '0';
        document.getElementById('ing-acompanantes-container').innerHTML = '';
      } else {
        renderizarAcompanantesIngreso();
      }
    }

    function seleccionarTipoEstacionamiento(tipo) {
      document.getElementById('ing-tipo-est').value = tipo;

      const btnPropio = document.getElementById('ing-btn-propio');
      const btnPrestado = document.getElementById('ing-btn-prestado');
      const selectMovil = document.getElementById('ing-tipo-est-select-mobile');

      if (btnPropio) btnPropio.classList.toggle('active', tipo === 'Propio');
      if (btnPrestado) btnPrestado.classList.toggle('active', tipo === 'Prestado');
      if (selectMovil && selectMovil.value !== tipo) selectMovil.value = tipo;

      document.getElementById('ing-aviso-prestado').classList.toggle('hidden', tipo !== 'Prestado');
      actualizarEstacionamientosIngreso();
    }

    function cambiarCantidadAcompanantes(delta) {
      const input = document.getElementById('ing-acomp');
      let n = parseInt(input.value || '0', 10);
      input.value = Math.max(0, Math.min(3, n + delta));
      renderizarAcompanantesIngreso();
    }

    function renderizarAcompanantesIngreso() {
      const cont = document.getElementById('ing-acompanantes-container');
      if (!cont || document.getElementById('ing-tipo').value === 'Trabajador') {
        if(cont) cont.innerHTML = '';
        return;
      }

      let n = Math.max(0, Math.min(3, parseInt(document.getElementById('ing-acomp').value || '0', 10)));
      document.getElementById('ing-acomp').value = n;

      const prev = [];
      for(let i=1; i<=3; i++) {
        prev.push({
          nombre: document.getElementById(`ing-acomp-${i}-nombre`)?.value || '',
          tipo: document.getElementById(`ing-acomp-${i}-tipo`)?.value || 'DNI',
          doc: document.getElementById(`ing-acomp-${i}-doc`)?.value || ''
        });
      }

      let html = '';
      for(let i=1; i<=n; i++) {
        const d = prev[i-1];
        html += `
          <div class="ing-acomp-row rounded-xl border border-indigo-100 bg-indigo-50/40">
            <span class="ing-acomp-number" aria-label="Acompañante ${i}">${i}</span>
            <input id="ing-acomp-${i}-nombre"
              value="${escapeHtml(d.nombre)}"
              placeholder="Nombre y apellidos"
              class="ing-acomp-name w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm">
            <select id="ing-acomp-${i}-tipo"
              aria-label="Tipo de documento acompañante ${i}"
              class="ing-acomp-type w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm">
              <option value="DNI" ${d.tipo === 'DNI' ? 'selected' : ''}>DNI</option>
              <option value="CE" ${d.tipo === 'CE' ? 'selected' : ''}>CE</option>
              <option value="Pasaporte" ${d.tipo === 'Pasaporte' ? 'selected' : ''}>Pasaporte</option>
            </select>
            <input id="ing-acomp-${i}-doc"
              value="${escapeHtml(d.doc)}"
              placeholder="Documento"
              class="ing-acomp-doc w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm">
          </div>`;
      }
      cont.innerHTML = html;
    }

    function normalizarPlacaIngreso(valor) {
      const limpio = String(valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!limpio) return '';
      if (limpio.length <= 3) return limpio;
      return limpio.slice(0, 3) + ' ' + limpio.slice(3);
    }

    function normalizarPlacaVisual(input, forzar = false) {
      if (!input) return;
      const actual = String(input.value || '');
      const limpio = actual.toUpperCase().replace(/[^A-Z0-9]/g, '');

      if (!limpio) {
        input.value = '';
        return;
      }
      input.value = (limpio.length >= 4 || forzar) ? normalizarPlacaIngreso(limpio) : limpio;
    }

    function horaCortaMovimiento(valor) {
      const t = String(valor || '').trim();
      if (!t) return '---';
      const m = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (!m) return t;

      let h = Number(m[1]);
      const min = m[2];
      const suf = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${min} ${suf}`;
    }

    function buscarOcupacionLocal(est) {
      if (!est) return null;
      return (movimientosHoy || []).find(m =>
        normalizarTexto(m.estado).includes('abierto') &&
        String(m.est) === String(est) &&
        !(modoFormularioIngreso === 'editar' &&
          movimientoEditandoActual &&
          Number(m.filaIndex) === Number(movimientoEditandoActual.filaIndex))
      ) || null;
    }

    function mostrarAdvertenciaOcupado(mov, est) {
      return new Promise(resolve => {
        resolverOcupadoPendiente = resolve;
        document.getElementById('ocupado-titulo').innerHTML = `<svg class="icon icon-lg" style="color:#d97706" viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Est. ${est} está ocupado`;
        document.getElementById('ocupado-persona').textContent = mov?.nombre || 'Sin nombre';
        document.getElementById('ocupado-placa').textContent = mov?.placa || '---';
        document.getElementById('ocupado-hora').textContent = horaCortaMovimiento(mov?.horaEntrada || mov?.hora || '');

        const modal = document.getElementById('modal-est-ocupado');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      });
    }

    function resolverAdvertenciaOcupado(usar) {
      const modal = document.getElementById('modal-est-ocupado');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
      const resolver = resolverOcupadoPendiente;
      resolverOcupadoPendiente = null;
      if (resolver) resolver(Boolean(usar));
    }

    function buscarVehiculoPorPlacaIngreso(placa) {
      const k = normalizarTexto(placa).replace(/\s+/g,'');
      if(!k) return null;

      for(const item of (todosLosDatos || [])) {
        for(const o of (item.ocupantes || [])) {
          if(o.esVirtual !== true && normalizarTexto(o.placa).replace(/\s+/g,'') === k)
            return { fuente: 'fijo', id: o.id || o.filaIndex || '', usuario: o.usuario || '', empresa: item.empresa || '', estacionamiento: item.est || '' };
        }
      }
      for(const v of (catalogosIngresoWeb.visitantes || [])) {
        if(normalizarTexto(v.placa).replace(/\s+/g,'') === k)
          return { fuente: 'visitante', id: v.id || '', usuario: v.usuario || '', empresa: v.empresa || '', estacionamiento: '' };
      }
      return null;
    }

    function autocompletarIngresoPorPlaca() {
      if(document.getElementById('ing-tipo').value !== 'Trabajador') return;
      const e = buscarVehiculoPorPlacaIngreso(document.getElementById('ing-placa').value.trim());
      if(!e) return;
      document.getElementById('ing-nombre').value = e.usuario;
      document.getElementById('ing-empresa').value = e.empresa;
      if(e.fuente === 'fijo'){
        seleccionarTipoEstacionamiento('Propio');
        actualizarEstacionamientosIngreso(e.estacionamiento);
      } else {
        actualizarEstacionamientosIngreso('');
      }
    }

    function actualizarEstacionamientosIngreso(estSeleccionar = '') {
      const emp = document.getElementById('ing-empresa').value || '';
      const tipo = document.getElementById('ing-tipo-est').value || 'Propio';
      const sel = document.getElementById('ing-est');
      let items = (todosLosDatos || []).slice();
      if(tipo === 'Propio') items = items.filter(x => emp && x.empresa === emp);
      items.sort((a,b) => String(a.est).localeCompare(String(b.est), undefined, { numeric: true }));

      sel.innerHTML = '<option value="">Seleccione estacionamiento...</option>';
      items.forEach(x => {
        const extra = tipo === 'Prestado' ? ` · ${x.empresa || ''}` : '';
        const op = new Option(`Est. ${x.est} (${x.ubi || 'S/U'})${extra}`, x.est);
        if(String(x.est) === String(estSeleccionar)) op.selected = true;
        sel.add(op);
      });
      actualizarDisponibilidadIngreso();
    }

    async function actualizarDisponibilidadIngreso(mostrarModal = false) {
      const est = document.getElementById('ing-est').value || '';
      const p = document.getElementById('ing-disponibilidad');

      if (!est) {
        p.textContent = '';
        estacionamientoAdvertidoActual = '';
        return;
      }

      const ocupado = buscarOcupacionLocal(est);

      if (!ocupado) {
        p.textContent = '🟢 Disponible hoy.';
        p.className = 'text-[10px] mt-1.5 text-emerald-600 italic';
        estacionamientoAdvertidoActual = '';
        return;
      }

      p.textContent = `⚠️ En uso por ${ocupado.nombre || 'otra persona'} desde ${horaCortaMovimiento(ocupado.horaEntrada)}.`;
      p.className = 'text-[10px] mt-1.5 text-amber-600 font-bold';

      if (mostrarModal && estacionamientoAdvertidoActual !== String(est)) {
        estacionamientoAdvertidoActual = String(est);
        const usar = await mostrarAdvertenciaOcupado(ocupado, est);

        if (!usar) {
          document.getElementById('ing-est').value = '';
          p.textContent = '';
          estacionamientoAdvertidoActual = '';
        }
      }
    }

    function obtenerAcompanantesFormulario() {
      if(document.getElementById('ing-tipo').value === 'Trabajador') return [];
      const n = Math.max(0, Math.min(3, parseInt(document.getElementById('ing-acomp').value || '0', 10)));
      const arr = [];
      for(let i=1; i<=n; i++) {
        arr.push({
          nombre: document.getElementById(`ing-acomp-${i}-nombre`)?.value.trim() || '',
          tipoDocumento: document.getElementById(`ing-acomp-${i}-tipo`)?.value || '',
          documento: document.getElementById(`ing-acomp-${i}-doc`)?.value.trim() || ''
        });
      }
      return arr;
    }

    function guardarIngresoMovimiento(event) {
      event.preventDefault();

      const btn = document.getElementById('btn-guardar-ingreso');
      const tipoIngreso = document.getElementById('ing-tipo').value;
      const reg = document.getElementById('ing-reg-por');
      const opt = reg.options[reg.selectedIndex];
      const acompanantes = obtenerAcompanantesFormulario();
      const editando = modoFormularioIngreso === 'editar';

      const datos = {
        tipoIngreso,
        placa: normalizarPlacaIngreso(document.getElementById('ing-placa').value),
        nombre: document.getElementById('ing-nombre').value.trim(),
        tipoDocumento: tipoIngreso === 'Trabajador' ? '' : document.getElementById('ing-doc-tipo').value,
        numeroDocumento: tipoIngreso === 'Trabajador' ? '' : document.getElementById('ing-doc-num').value.trim(),
        acompanantes,
        empresa: document.getElementById('ing-empresa').value,
        tipoEstacionamiento: document.getElementById('ing-tipo-est').value,
        estacionamiento: document.getElementById('ing-est').value,
        observaciones: document.getElementById('ing-obs').value.trim(),
        horaEntrada: document.getElementById('ing-hora').value,
        horaSalida: document.getElementById('ing-hora-salida').value,
        registradoPorId: reg.value,
        registradoPorNombre: opt ? (opt.dataset.nombre || opt.textContent || '') : ''
      };

      if(editando && movimientoEditandoActual){
        datos.filaIndex = movimientoEditandoActual.filaIndex;
        datos.id = movimientoEditandoActual.id;
      }

      const camposFaltantes = [];
      if (!datos.placa) camposFaltantes.push('ing-placa');
      if (!datos.nombre) camposFaltantes.push('ing-nombre');
      if (!datos.empresa) camposFaltantes.push('ing-empresa');
      if (!datos.estacionamiento) camposFaltantes.push('ing-est');
      if (!datos.horaEntrada) camposFaltantes.push('ing-hora');
      if (!datos.registradoPorId) camposFaltantes.push('ing-reg-por');
      if (camposFaltantes.length) {
        marcarCamposFaltantes(camposFaltantes, 'Completa los campos obligatorios resaltados en rojo.');
        return;
      }

      for(let i=0; i<acompanantes.length; i++){
        if(!acompanantes[i].nombre){
          marcarCamposFaltantes([`ing-acomp-${i+1}-nombre`], `Falta el nombre del acompañante ${i+1}.`);
          return;
        }
      }

      // El ingreso nuevo aparece ya; validación y escritura continúan detrás.
      const idOptimista = editando ? '' : 'mov-temp-' + Date.now();
      const respaldoEdicionMovimiento = editando ? JSON.stringify(movimientosHoy || []) : '';
      if (!editando) {
        const fechaIngreso = datos.horaEntrada ? new Date(datos.horaEntrada) : new Date();
        const horaVisible = Number.isNaN(fechaIngreso.getTime())
          ? datos.horaEntrada
          : fechaIngreso.toLocaleString('es-PE', { hour12: false });
        const provisional = {
          filaIndex: -Date.now(),
          id: idOptimista,
          _optimistaId: idOptimista,
          horaEntrada: horaVisible,
          placa: datos.placa,
          nombre: datos.nombre,
          documento: datos.numeroDocumento || '',
          empresa: datos.empresa,
          est: datos.estacionamiento,
          tipoIngreso: datos.tipoIngreso,
          observaciones: datos.observaciones,
          horaSalida: datos.horaSalida || '---',
          registradoPor: datos.registradoPorNombre,
          estado: datos.horaSalida ? 'Finalizado' : 'Abierto'
        };
        movimientosOptimistasT28.push(provisional);
      } else {
        const existente = movimientosHoy.find(m =>
          Number(m.filaIndex) === Number(datos.filaIndex) || (datos.id && m.id === datos.id)
        );
        if (existente) Object.assign(existente, {
          placa:datos.placa,nombre:datos.nombre,documento:datos.numeroDocumento||'',empresa:datos.empresa,
          est:datos.estacionamiento,tipoIngreso:datos.tipoIngreso,observaciones:datos.observaciones,
          horaEntrada:datos.horaEntrada,horaSalida:datos.horaSalida||'---',registradoPor:datos.registradoPorNombre,
          estado:datos.horaSalida?'Finalizado':'Abierto'
        });
      }

      const retirarMovimientoOptimista = function() {
        if (!idOptimista) return;
        movimientosOptimistasT28 = movimientosOptimistasT28.filter(m => m._optimistaId !== idOptimista);
        movimientosHoy = movimientosHoy.filter(m => m._optimistaId !== idOptimista);
        if (moduloActual === 'movimientos') filtrarMovimientos();
      };
      const revertirEdicionMovimiento = function() {
        if (!respaldoEdicionMovimiento) return;
        movimientosHoy = JSON.parse(respaldoEdicionMovimiento);
        if (moduloActual === 'movimientos') filtrarMovimientos();
      };

      ingresoPendienteReintentoT28 = { datos: Object.assign({}, datos), editando: editando };
      cerrarModalIngreso();
      cambiarModulo('movimientos');
      if (!editando) {
        movimientosHoy = movimientosOptimistasT28.concat(
          movimientosHoy.filter(m => !m._optimistaId)
        );
        poblarFiltrosMovimientos();
        filtrarMovimientos();
        mostrarToast('¡Ingreso agregado!', 'exito');
      } else {
        filtrarMovimientos();
        mostrarToast('¡Movimiento actualizado!', 'exito');
      }

      const ejecutarGuardado = function(permitirOcupado = false) {
        datos.permitirEstacionamientoOcupado = Boolean(permitirOcupado);

        btn.disabled = true;

        const llamada = google.script.run
          .withSuccessHandler(function(){
            btn.disabled = false;
            btn.textContent = editando ? 'Guardar cambios' : 'Guardar ingreso';
            ingresoPendienteReintentoT28 = null;
            marcarDestacadoT28('movimiento', datos.placa || datos.nombre || '');
            const panelMov = document.getElementById('modulo-movimientos');
            if (panelMov) {
              panelMov.classList.remove('t28-panel-flash');
              void panelMov.offsetWidth;
              panelMov.classList.add('t28-panel-flash');
            }
            if (editando) mostrarToast('Movimiento actualizado correctamente', 'exito');
            modoFormularioIngreso = 'crear';
            movimientoEditandoActual = null;
            // Conserva la fila instantánea hasta que llegue su versión real.
            setTimeout(function() { cargarHistorialHoy(true); }, 450);
          })
          .withFailureHandler(function(err){
            btn.disabled = false;
            btn.textContent = editando ? 'Reintentar cambios' : 'Reintentar registro';
            retirarMovimientoOptimista();
            revertirEdicionMovimiento();
            const mensaje = String(err?.message || err || 'No se pudo conectar con el servidor.');
            mostrarToast(
              (editando ? 'No se pudo actualizar. ' : 'No se pudo registrar. ') +
              mensaje + ' Los datos siguen disponibles en el botón +.',
              'error'
            );
          });

        if(editando) {
          llamada.actualizarMovimientoWeb(datos);
        } else {
          llamada.registrarMovimientoWeb(datos);
        }
      };

      btn.disabled = true;
      btn.textContent = editando ? 'Verificando...' : 'Guardar ingreso';

      google.script.run
        .withSuccessHandler(async function(res) {
          btn.disabled = false;
          btn.textContent = editando ? 'Guardar cambios' : 'Guardar ingreso';

          if (res && res.ocupado) {
            const usar = await mostrarAdvertenciaOcupado(res.movimiento || {}, datos.estacionamiento);
            if (!usar) {
              retirarMovimientoOptimista();
              revertirEdicionMovimiento();
              ingresoPendienteReintentoT28 = null;
              return;
            }
            ejecutarGuardado(true);
            return;
          }
          ejecutarGuardado(false);
        })
        .withFailureHandler(function(err) {
          btn.disabled = false;
          btn.textContent = editando ? 'Guardar cambios' : 'Guardar ingreso';
          retirarMovimientoOptimista();
          revertirEdicionMovimiento();
          mostrarToast('No se pudo verificar el estacionamiento: ' + err.message, 'error');
        })
        .validarEstacionamientoDisponibleHoyWeb(
          datos.estacionamiento,
          editando ? datos.filaIndex : null,
          editando ? datos.id : null
        );
    }

    function cargarHistorialHoy(silencioso = false) {
      if (cargandoMovimientos) return;
      cargandoMovimientos = true;

      if (!silencioso && moduloActual === 'movimientos') {
        mostrarToast("Cargando movimientos de hoy...", "guardando");
      }

      if (!movimientosHoy.length) {
        if (moduloActual === 'movimientos') renderSkeletonRows('hoy-cuerpo', 10, esMovilRendimientoT28() ? 3 : 6);
        else if (moduloActual === 'dashboard') renderSkeletonList('dash-ultimos-mov', esMovilRendimientoT28() ? 2 : 4);
      }

      T28Api.movimientosHoy()
        .then(function(res) {
          const data = res?.data;
          cargandoMovimientos = false;
          ultimaCargaMovimientosT28 = Date.now();
          const movimientosServidor = Array.isArray(data) ? data : [];
          movimientosOptimistasT28 = movimientosOptimistasT28.filter(temp =>
            !movimientosServidor.some(real =>
              normalizarPlacaIngreso(real.placa) === normalizarPlacaIngreso(temp.placa) &&
              normalizarTexto(real.nombre) === normalizarTexto(temp.nombre) &&
              String(real.est || '') === String(temp.est || '')
            )
          );
          movimientosHoy = movimientosOptimistasT28.concat(movimientosServidor);

          if (moduloActual === 'movimientos') {
            poblarFiltrosMovimientos();
            filtrarMovimientos();
          } else if (moduloActual === 'dashboard') {
            actualizarDashboard();
          }

          if (elementoVisiblePorId('modal-ingreso')) ejecutarIdleT28(prepararCatalogosIngreso, 250);
          registrarSincronizacionT28();

          if (!silencioso && moduloActual === 'movimientos') mostrarToast("Movimientos actualizados", "exito");
        })
        .catch(function(err) {
          cargandoMovimientos = false;
          if (!silencioso && moduloActual === 'movimientos') mostrarToast("Error al cargar movimientos: " + err.message, 'error');
          else console.error("Carga de movimientos:", err);
        });
    }

    function poblarFiltrosMovimientos() {
      const selEstado = document.getElementById('filtro-mov-estado');
      const selTipo = document.getElementById('filtro-mov-tipo');
      if (!selEstado || !selTipo) return;

      const estadoActual = selEstado.value;
      const tipoActual = selTipo.value;

      const estados = [...new Set(movimientosHoy.map(m => (m.estado || '').toString().trim()).filter(Boolean))].sort();
      const tipos = [...new Set(movimientosHoy.map(m => (m.tipoIngreso || '').toString().trim()).filter(Boolean))].sort();

      selEstado.innerHTML = '<option value="">📌 Todos los estados</option>';
      estados.forEach(v => selEstado.add(new Option(v, v)));
      if (estados.includes(estadoActual)) selEstado.value = estadoActual;

      selTipo.innerHTML = '<option value="">🚗 Todos los tipos de ingreso</option>';
      tipos.forEach(v => selTipo.add(new Option(v, v)));
      if (tipos.includes(tipoActual)) selTipo.value = tipoActual;
    }

    function limpiarFiltrosMovimientos() {
      document.getElementById('filtro-mov-estado').value = '';
      document.getElementById('filtro-mov-tipo').value = '';
      document.getElementById('buscador-mov').value = '';
      filtrarMovimientos();
    }

    function actualizarResumenMovimientos(datos) {
      const total = datos.length;
      const abiertos = datos.filter(m => normalizarTexto(m.estado).includes('abierto')).length;
      const finalizados = total - abiertos;
      const empresas = new Set(datos.map(m => (m.empresa || '').toString().trim()).filter(v => v && v !== 'N/A')).size;

      document.getElementById('resumen-mov-total').textContent = total;
      document.getElementById('resumen-mov-abiertos').textContent = abiertos;
      document.getElementById('resumen-mov-finalizados').textContent = finalizados;
      document.getElementById('resumen-mov-empresas').textContent = empresas;
    }

    function obtenerValorEstadoDisponible(tipo) {
      const select = document.getElementById('filtro-mov-estado');
      if (!select) return '';
      if (tipo === 'todos') return '';

      const opciones = [...select.options];
      const buscado = tipo === 'abiertos' ? 'abierto' : 'cerrado';

      let opcion = opciones.find(o => normalizarTexto(o.value) === buscado);
      if (!opcion && tipo === 'finalizados') {
        opcion = opciones.find(o => {
          const v = normalizarTexto(o.value);
          return v.includes('cerrado') || v.includes('finalizado');
        });
      }
      if (!opcion && tipo === 'abiertos') {
        opcion = opciones.find(o => normalizarTexto(o.value).includes('abierto'));
      }
      return opcion ? opcion.value : (tipo === 'abiertos' ? 'Abierto' : 'Cerrado');
    }

    function filtrarDesdeTarjetaEstado(tipo) {
      const select = document.getElementById('filtro-mov-estado');
      if (!select) return;
      select.value = obtenerValorEstadoDisponible(tipo);
      filtrarMovimientos();
    }

    function actualizarTarjetasFiltroEstado() {
      const valor = normalizarTexto(document.getElementById('filtro-mov-estado')?.value || '');
      const todos = document.getElementById('card-filtro-todos');
      const abiertos = document.getElementById('card-filtro-abiertos');
      const finalizados = document.getElementById('card-filtro-finalizados');

      [todos, abiertos, finalizados].forEach(card => {
        if (card) card.classList.remove('mov-summary-active');
      });

      if (!valor && todos) {
        todos.classList.add('mov-summary-active');
      } else if (valor.includes('abierto') && abiertos) {
        abiertos.classList.add('mov-summary-active');
      } else if ((valor.includes('cerrado') || valor.includes('finalizado')) && finalizados) {
        finalizados.classList.add('mov-summary-active');
      }
    }

    function filtrarMovimientos() {
      actualizarTarjetasFiltroEstado();
      const texto = normalizarTexto(document.getElementById('buscador-mov').value);
      const estado = document.getElementById('filtro-mov-estado').value;
      const tipo = document.getElementById('filtro-mov-tipo').value;

      movimientosFiltrados = movimientosHoy.filter(mov => {
        const cumpleEstado = !estado || normalizarTexto(mov.estado) === normalizarTexto(estado);
        const cumpleTipo = !tipo || normalizarTexto(mov.tipoIngreso) === normalizarTexto(tipo);
        const bolsa = [mov.placa, mov.nombre, mov.documento, mov.empresa, mov.estado, mov.est, mov.tipoIngreso, mov.observaciones, mov.registradoPor]
          .map(normalizarTexto).join(' ');
        return cumpleEstado && cumpleTipo && (!texto || bolsa.includes(texto));
      });

      actualizarResumenMovimientos(movimientosFiltrados);
      const info = document.getElementById('mov-filtros-info');
      if (info) info.textContent = `${movimientosFiltrados.length} de ${movimientosHoy.length} movimientos mostrados`;
      renderizarHistorialHoy(movimientosFiltrados);
    }

    function renderizarHistorialHoy(datos) {
      const tbody = document.getElementById('hoy-cuerpo');
      if (!datos.length) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center py-6 text-gray-500 font-medium text-xs">No hay movimientos que coincidan con la búsqueda.</td></tr>`;
        return;
      }

      tbody.innerHTML = datos.map(mov => {
        const esAbierto = normalizarTexto(mov.estado).includes('abierto');
        const badgeEstado = esAbierto ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700';
        const estiloEmp = obtenerEstiloEmpresa(mov.empresa);

        return `
          <tr onclick="abrirDetalleMovimiento(${Number(mov.filaIndex)})"
              class="hover:bg-indigo-50/60 transition cursor-pointer"
              title="Ver detalle del movimiento">
            <td class="py-1.5 px-3 font-medium text-slate-900">${escapeHtml(mov.horaEntrada)}</td>
            <td class="py-1.5 px-3"><span class="parking-plate bg-slate-900 text-white text-[11px] font-mono px-1.5 py-0.5 rounded">${escapeHtml(mov.placa)}</span></td>
            <td class="py-1.5 px-3 font-medium text-slate-800">${escapeHtml(mov.nombre)} <span class="text-[10px] text-slate-400 block">${escapeHtml(mov.documento || '')}</span></td>
            <td class="py-1.5 px-3 font-semibold"><span class="px-2 py-0.5 rounded text-[11px] font-bold ${estiloEmp.bg} ${estiloEmp.text}">${escapeHtml(mov.empresa)}</span></td>
            <td class="py-1.5 px-3 font-bold text-slate-700">Est. ${escapeHtml(mov.est)}</td>
            <td class="py-1.5 px-3 text-slate-600">${escapeHtml(mov.tipoIngreso)}</td>
            <td class="py-1.5 px-3 text-slate-500 italic">${escapeHtml(mov.observaciones || '---')}</td>
            <td class="py-1.5 px-3 text-slate-600">${escapeHtml(mov.horaSalida)}</td>
            <td class="py-1.5 px-3 font-medium text-slate-700">${escapeHtml(mov.registradoPor)}</td>
            <td class="py-1.5 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold ${badgeEstado}">${escapeHtml(mov.estado)}</span></td>
            <td class="py-1.5 px-3 text-center">
              <button type="button" class="t28-mov-row-action ${esAbierto?'is-exit':'is-reopen'}" onclick="accionRapidaMovimientoT28(event,${Number(mov.filaIndex)},'${esAbierto?'salida':'reabrir'}')" aria-label="${esAbierto?'Registrar salida':'Reabrir salida'}" title="${esAbierto?'Registrar salida':'Reabrir salida'}">
                ${esAbierto?'<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg><span>Salida</span>':'<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M9 7H5V3"/><path d="M5 7a8 8 0 1 1 1 10"/></svg><span>Reabrir</span>'}
              </button>
            </td>
          </tr>`;
      }).join('');
    }

    function accionRapidaMovimientoT28(evento, filaIndex, accion) {
      evento?.preventDefault?.();
      evento?.stopPropagation?.();
      if(!tienePermisoT28('editar')){mostrarToast('Tu cuenta no tiene permiso para modificar movimientos.','error');return;}
      const mov=buscarMovimientoPorFila(filaIndex);
      if(!mov){mostrarToast('No se encontró el movimiento. Sincroniza e inténtalo nuevamente.','error');return;}
      movimientoDetalleActual=mov;
      if(accion==='salida'){abrirRegistrarSalidaMovimiento();return;}
      if(typeof abrirConfirmacionReabrirSalidaT28==='function'){abrirConfirmacionReabrirSalidaT28();return;}
      mostrarToast('La acción Reabrir todavía no está disponible.','error');
    }

    function buscarMovimientoPorFila(filaIndex) {
      return (movimientosHoy || []).find(m => Number(m.filaIndex) === Number(filaIndex)) || null;
    }

    function abrirDetalleMovimiento(filaIndex) {
      const mov = buscarMovimientoPorFila(filaIndex);
      if (!mov) {
        mostrarToast('No se encontró el movimiento. Sincroniza e inténtalo nuevamente.', 'error');
        return;
      }
      movimientoDetalleActual = mov;

      document.getElementById('det-titulo').textContent = `${mov.nombre} · ${mov.placa}`;
      document.getElementById('det-placa').textContent = mov.placa || '---';
      document.getElementById('det-tipo').textContent = mov.tipoIngreso || '---';
      const tipoEstDetalle = mov.tipoEstacionamiento || (/^prestado$/i.test(String(mov.estPrestado || '').trim()) ? 'Prestado' : 'Propio');
      document.getElementById('det-est').textContent = `Est. ${mov.est || '---'} · ${tipoEstDetalle}`;
      document.getElementById('det-estado').textContent = mov.estado || '---';
      document.getElementById('det-estado').className = 'font-bold mt-1 ' + (normalizarTexto(mov.estado).includes('abierto') ? 'text-emerald-600' : 'text-slate-600');
      document.getElementById('det-nombre').textContent = mov.nombre || '---';
      document.getElementById('det-documento').textContent = mov.documento || '---';
      document.getElementById('det-empresa').textContent = mov.empresa || '---';
      document.getElementById('det-registrado').textContent = mov.registradoPor || '---';
      document.getElementById('det-entrada').textContent = mov.horaEntrada || '---';
      document.getElementById('det-salida').textContent = mov.horaSalida || '---';
      document.getElementById('det-obs').textContent = mov.observaciones || 'Sin observaciones';

      const acomp = Array.isArray(mov.acompanantes) ? mov.acompanantes : [];
      const bloque = document.getElementById('det-bloque-acomp');
      bloque.classList.toggle('hidden', acomp.length === 0);
      document.getElementById('det-cant-acomp').textContent = `${acomp.length} persona${acomp.length === 1 ? '' : 's'}`;
      document.getElementById('det-acompanantes').innerHTML = acomp.map((p, i) => `
        <div class="rounded-xl border border-indigo-100 bg-white p-3">
          <p class="text-[9px] uppercase font-bold text-indigo-500">Acompañante ${i+1}</p>
          <p class="text-xs font-bold text-slate-800 mt-1">${escapeHtml(p.nombre || 'Sin nombre')}</p>
          <p class="text-[10px] text-slate-500 mt-1">${escapeHtml([p.tipoDocumento, p.documento].filter(Boolean).join(' ') || 'Sin documento')}</p>
        </div>`).join('');

      const btnSalida = document.getElementById('btn-det-salida');
      btnSalida.classList.toggle('hidden', !normalizarTexto(mov.estado).includes('abierto'));

      const modal = document.getElementById('modal-detalle-mov');
      modal.classList.remove('hidden'); 
      modal.classList.add('flex');
    }

    function cerrarDetalleMovimiento() {
      const modal = document.getElementById('modal-detalle-mov');
      modal.classList.remove('flex'); 
      modal.classList.add('hidden');
    }

    function parseFechaDisplayALocal(valor) {
      if (!valor || valor === '---') return '';
      const m = String(valor).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (!m) return '';
      const pad = n => String(n).padStart(2,'0');
      return `${m[3]}-${pad(m[2])}-${pad(m[1])}T${pad(m[4])}:${pad(m[5])}`;
    }

    // Convierte "dd/mm/aaaa HH:mm:ss" (formato mostrado) a un objeto Date real,
    // usado para calcular cuánto tiempo lleva abierto un movimiento.
    function parseFechaDisplayADate(valor) {
      const m = String(valor || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (!m) return null;
      return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
    }

    function formatearDuracion(minutosTotales) {
      const min = Math.max(0, Math.round(minutosTotales));
      const h = Math.floor(min / 60);
      const m = min % 60;
      if (h <= 0) return `${m}m`;
      return `${h}h ${m}m`;
    }

    function abrirRegistrarSalidaMovimiento() {
      if (!movimientoDetalleActual) return;
      document.getElementById('mov-hora-salida').value = fechaHoraLocalInput();
      document.getElementById('salida-subtitulo').textContent = `${movimientoDetalleActual.placa} · ${movimientoDetalleActual.nombre}`;
      const m = document.getElementById('modal-salida-mov'); 
      m.classList.remove('hidden'); 
      m.classList.add('flex');
    }

    function cerrarModalSalidaMovimiento() {
      const m = document.getElementById('modal-salida-mov'); 
      m.classList.remove('flex'); 
      m.classList.add('hidden');
    }

    function guardarSalidaMovimiento() {
      if (!movimientoDetalleActual) return;
      const hora = document.getElementById('mov-hora-salida').value;
      if (!hora) { marcarCamposFaltantes(['mov-hora-salida'], 'Selecciona la hora de salida.'); return; }

      const respaldo=JSON.stringify(movimientosHoy||[]);
      const movimientoLocal=movimientosHoy.find(m=>Number(m.filaIndex)===Number(movimientoDetalleActual.filaIndex)||(movimientoDetalleActual.id&&m.id===movimientoDetalleActual.id));
      if(movimientoLocal){movimientoLocal.horaSalida=hora;movimientoLocal.estado='Finalizado';}
      cerrarModalSalidaMovimiento();cerrarDetalleMovimiento();filtrarMovimientos();mostrarToast('¡Salida registrada!','exito');

      google.script.run
        .withSuccessHandler(function() {
          cargarHistorialHoy(true);
        })
        .withFailureHandler(function(err) {
          movimientosHoy=JSON.parse(respaldo);filtrarMovimientos();
          mostrarToast('Error: ' + err.message, 'error');
        })
        .registrarSalidaMovimientoWeb({
          filaIndex: movimientoDetalleActual.filaIndex,
          id: movimientoDetalleActual.id,
          horaSalida: hora
        });
    }

    function abrirConfirmacionEliminacion(config) {
      document.getElementById('confirm-del-titulo').textContent = config.titulo || 'Confirmar eliminación';
      document.getElementById('confirm-del-mensaje').textContent = config.mensaje || '';

      document.getElementById('confirm-del-detalles').innerHTML = (config.detalles || []).map(([etiqueta, valor]) => `
        <div class="flex justify-between gap-3">
          <span class="text-slate-400">${escapeHtml(etiqueta)}</span>
          <span class="font-semibold text-slate-800 text-right">${escapeHtml(valor)}</span>
        </div>
      `).join('');

      const modal = document.getElementById('modal-confirmar-eliminacion');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function cerrarConfirmacionEliminacion() {
      const modal = document.getElementById('modal-confirmar-eliminacion');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
      accionPeligrosaActual = null;

      const btn = document.getElementById('btn-confirmar-eliminacion');
      btn.disabled = false;
      btn.innerHTML = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg> Eliminar';
    }

    function ejecutarEliminacionConfirmada() {
      const a = accionPeligrosaActual;
      if(!a) return;

      const btn = document.getElementById('btn-confirmar-eliminacion');
      btn.disabled = true;
      btn.textContent = 'Eliminando...';

      if(a.tipo === 'vehiculo'){
        const respaldo=JSON.stringify(todosLosDatos);
        todosLosDatos.forEach(item=>{item.ocupantes=(item.ocupantes||[]).filter(oc=>String(oc.filaIndex)!==String(a.filaIndex));if(!item.ocupantes.length)item.ocupantes=[{usuario:'LIBRE',placa:'---',esVirtual:true}];});
        cerrarConfirmacionEliminacion();cerrarModal();filtrarDatos();mostrarToast('Vehículo eliminado','exito');
        google.script.run
          .withSuccessHandler(function(){
            cargarDatosServidor(false);
          })
          .withFailureHandler(function(err){
            todosLosDatos=JSON.parse(respaldo);filtrarDatos();
            mostrarToast('No se pudo eliminar: ' + err.message, 'error');
          })
          .eliminarVehiculo({ filaIndex: a.filaIndex, placa: a.placa, usuario: a.usuario });
        return;
      }

      if(a.tipo === 'personal_sin_est'){
        const respaldo=JSON.stringify(catalogosIngresoWeb.visitantes||[]);
        catalogosIngresoWeb.visitantes=(catalogosIngresoWeb.visitantes||[]).filter(v=>Number(v.filaIndex)!==Number(a.filaIndex)&&String(v.id||'')!==String(a.id||''));
        cerrarConfirmacionEliminacion();cerrarModalPersonalSinEstacionamiento();prepararPersonalSinEstacionamiento();mostrarToast('Personal eliminado','exito');
        google.script.run
          .withSuccessHandler(function(){
            cargarCatalogosIngresoServidor();
          })
          .withFailureHandler(function(err){
            catalogosIngresoWeb.visitantes=JSON.parse(respaldo);prepararPersonalSinEstacionamiento();
            mostrarToast('No se pudo eliminar: ' + err.message, 'error');
          })
          .eliminarPersonalSinEstacionamientoWeb({
            filaIndex: a.filaIndex,
            id: a.id,
            placa: a.placa,
            usuario: a.usuario
          });
        return;
      }

      if(a.tipo === 'directorio'){
        const respaldo=JSON.stringify(todosLosContactos||[]);
        todosLosContactos=(todosLosContactos||[]).filter(c=>Number(c.filaIndex)!==Number(a.filaIndex));
        cerrarConfirmacionEliminacion();cerrarModalDirectorio();filtrarDirectorio();mostrarToast('Contacto eliminado','exito');
        google.script.run
          .withSuccessHandler(function(){
            cargarDirectorioServidor(false, true);
          })
          .withFailureHandler(function(err){
            todosLosContactos=JSON.parse(respaldo);filtrarDirectorio();
            mostrarToast('No se pudo eliminar: ' + err.message, 'error');
          })
          .eliminarDirectorioWeb({
            filaIndex: a.filaIndex,
            servicio: a.servicio,
            proveedor: a.proveedor
          });
        return;
      }

      if(a.tipo === 'movimiento'){
        const respaldo=JSON.stringify(movimientosHoy||[]);
        movimientosHoy=(movimientosHoy||[]).filter(m=>Number(m.filaIndex)!==Number(a.filaIndex)&&String(m.id||'')!==String(a.id||''));
        cerrarConfirmacionEliminacion();cerrarDetalleMovimiento();filtrarMovimientos();mostrarToast('Registro eliminado','exito');
        google.script.run
          .withSuccessHandler(function(){
            cargarHistorialHoy(true);
          })
          .withFailureHandler(function(err){
            movimientosHoy=JSON.parse(respaldo);filtrarMovimientos();
            mostrarToast('No se pudo eliminar: ' + err.message, 'error');
          })
          .eliminarMovimientoWeb({ filaIndex: a.filaIndex, id: a.id });
      }
    }

    function confirmarEliminarMovimiento() {
      if (!movimientoDetalleActual) return;
      const m = movimientoDetalleActual;

      accionPeligrosaActual = {
        tipo: 'movimiento',
        filaIndex: m.filaIndex,
        id: m.id
      };

      abrirConfirmacionEliminacion({
        titulo: 'Eliminar movimiento',
        mensaje: 'Se eliminará únicamente este registro de MOVIMIENTOS.',
        detalles: [
          ['Placa', m.placa || '---'],
          ['Persona', m.nombre || '---'],
          ['Entrada', m.horaEntrada || '---'],
          ['Estado', m.estado || '---']
        ]
      });
    }

    function abrirEditarMovimiento() {
      const m = movimientoDetalleActual;
      if (!m) return;

      modoFormularioIngreso = 'editar';
      movimientoEditandoActual = m;
      prepararCatalogosIngreso();

      document.getElementById('ing-modal-titulo').innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg> Editar movimiento';
      document.getElementById('ing-modal-titulo').classList.add('btn-icon-inline');
      document.getElementById('ing-modal-subtitulo').textContent = `${m.placa || ''} · ${m.nombre || ''}`;
      document.getElementById('btn-guardar-ingreso').textContent = 'Guardar cambios';

      seleccionarTipoIngreso(m.tipoIngreso || 'Trabajador');

      document.getElementById('ing-placa').value = m.placa || '';
      document.getElementById('ing-nombre').value = m.nombre || '';
      document.getElementById('ing-doc-tipo').value = m.tipoDocumento || 'DNI';
      document.getElementById('ing-doc-num').value = m.numeroDocumento || m.documento || '';
      document.getElementById('ing-obs').value = m.observaciones || '';
      document.getElementById('ing-hora').value = parseFechaDisplayALocal(m.horaEntrada);
      document.getElementById('ing-hora-salida').value = parseFechaDisplayALocal(m.horaSalida);
      document.getElementById('ing-empresa').value = m.empresa || '';

      const tipoEst = m.tipoEstacionamiento || (/^prestado$/i.test(String(m.estPrestado || '').trim()) ? 'Prestado' : 'Propio');
      seleccionarTipoEstacionamiento(tipoEst);
      actualizarEstacionamientosIngreso(m.est);

      if ((m.tipoIngreso || '') !== 'Trabajador') {
        const acomp = Array.isArray(m.acompanantes) ? m.acompanantes : [];
        document.getElementById('ing-acomp').value = String(acomp.length);
        renderizarAcompanantesIngreso();

        acomp.forEach((p, i) => {
          const n = i+1;
          const nom = document.getElementById(`ing-acomp-${n}-nombre`);
          const tipo = document.getElementById(`ing-acomp-${n}-tipo`);
          const doc = document.getElementById(`ing-acomp-${n}-doc`);
          if(nom) nom.value = p.nombre || '';
          if(tipo) tipo.value = p.tipoDocumento || 'DNI';
          if(doc) doc.value = p.documento || '';
        });
      }

      seleccionarRegistradoPorMovimiento(m);

      cerrarDetalleMovimiento();

      const modal = document.getElementById('modal-ingreso');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      actualizarVisibilidadFabT28();

      if (!(catalogosIngresoWeb.personal || []).length) cargarCatalogosIngresoServidor();
    }

    let promesaXlsxT28 = null;

    function cargarXlsxSoloCuandoSeNecesiteT28() {
      if (window.XLSX) return Promise.resolve(window.XLSX);
      if (promesaXlsxT28) return promesaXlsxT28;

      promesaXlsxT28 = new Promise(function(resolve, reject) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js';
        script.async = true;
        script.onload = function() {
          if (window.XLSX) resolve(window.XLSX);
          else reject(new Error('La librería de Excel no quedó disponible.'));
        };
        script.onerror = function() {
          promesaXlsxT28 = null;
          reject(new Error('No se pudo cargar la librería de Excel.'));
        };
        document.head.appendChild(script);
      });
      return promesaXlsxT28;
    }

    function descargarReporteExcel() {
      if (moduloActual === 'empresas' && vistaUsuariosActual === 'personal') {
        mostrarToast("La descarga de Usuarios corresponde a Trabajadores fijos con estacionamiento.", "aviso");
        actualizarBotonDescargaContextual('empresas');
        return;
      }

      let texto = moduloActual === 'movimientos' ? 
        "¿Deseas descargar el reporte en Excel de los movimientos de hoy?" : 
        (moduloActual === 'suministros' ? "¿Deseas descargar el reporte en Excel de los suministros de luz?" : "¿Deseas descargar el reporte en Excel de las empresas y estacionamientos?");
      
      document.getElementById('texto-confirmacion-descarga').textContent = texto;
      const modal = document.getElementById('modal-confirmar-descarga');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function cerrarModalDescarga() {
      const modal = document.getElementById('modal-confirmar-descarga');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    async function ejecutarDescargaExcel() {
      cerrarModalDescarga();
      mostrarToast("Preparando archivo Excel...", "guardando");
      try {
        await cargarXlsxSoloCuandoSeNecesiteT28();
      } catch (err) {
        mostrarToast(err.message || "No se pudo preparar Excel.", "error");
        return;
      }
      const wb = XLSX.utils.book_new();

      if (moduloActual === "movimientos") {
        if (movimientosFiltrados.length === 0) {
          mostrarToast("No hay movimientos para exportar.", 'aviso');
          return;
        }

        const datos = movimientosFiltrados.map(m => ({
          "Hora Entrada": m.horaEntrada,
          "Placa": m.placa,
          "Conductor": m.nombre,
          "Empresa": m.empresa,
          "Estacionamiento": "Est. " + m.est,
          "Tipo Ingreso": m.tipoIngreso,
          "Observaciones": m.observaciones || "",
          "Hora Salida": m.horaSalida,
          "Registrado Por": m.registradoPor,
          "Estado": m.estado
        }));

        const ws = XLSX.utils.json_to_sheet(datos);
        XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
        XLSX.writeFile(wb, "Historial_Movimientos_Hoy.xlsx");
      } else if (moduloActual === "directorio") {
        const datos = Array.isArray(contactosFiltrados) && contactosFiltrados.length
          ? contactosFiltrados
          : (todosLosContactos || []);

        if (!datos.length) {
          mostrarToast("No hay contactos para exportar.", 'aviso');
          return;
        }

        const filas = datos.map(c => ({
          "Servicio": c.servicio || "",
          "Proveedor": c.proveedor || "",
          "Persona de contacto": c.contacto || "",
          "Número": c.numero || "",
          "Número 2": c.numero2 || "",
          "Observación": c.observacion || ""
        }));

        const ws = XLSX.utils.json_to_sheet(filas);

        // Anchos cómodos para abrir directamente en Excel.
        ws['!cols'] = [
          { wch: 34 },
          { wch: 24 },
          { wch: 28 },
          { wch: 16 },
          { wch: 16 },
          { wch: 36 }
        ];

        // Filtro automático en cabeceras.
        if (ws['!ref']) {
          const rango = XLSX.utils.decode_range(ws['!ref']);
          ws['!autofilter'] = { ref: XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: rango.e.r, c: rango.e.c }
          }) };
        }

        XLSX.utils.book_append_sheet(wb, ws, "Directorio");

        const fecha = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Directorio_Torre28_${fecha}.xlsx`);
      } else if (moduloActual === "empresas") {
        let empresaFiltro = document.getElementById("filtro-empresa").value;
        let datosParaExportar = todosLosDatos;

        if (empresaFiltro) {
          datosParaExportar = datosParaExportar.filter(x => x.empresa == empresaFiltro);
        }

        if (datosParaExportar.length === 0) {
          mostrarToast("No hay datos para exportar.", 'aviso');
          return;
        }

        const filas = [];
        datosParaExportar.forEach(item => {
          item.ocupantes.forEach(oc => {
            filas.push({
              "Estacionamiento": item.est,
              "Ubicación": item.ubi,
              "Empresa": item.empresa,
              "Usuario": oc.usuario,
              "Placa": oc.placa
            });
          });
        });

        const ws = XLSX.utils.json_to_sheet(filas);
        XLSX.utils.book_append_sheet(wb, ws, "Estacionamientos");
        XLSX.writeFile(wb, empresaFiltro ? `Reporte_${empresaFiltro}.xlsx` : "Reporte_Estacionamientos.xlsx");
      }
      mostrarToast("Reporte generado correctamente", "exito");
    }

    function poblarSelectEmpresas(datos) {
      const select = document.getElementById('filtro-empresa');
      const selectModal = document.getElementById('edit-empresa-select');
      const selectNuevo = document.getElementById('nuevo-empresa');

      const valorActual = select.value;
      select.innerHTML = '<option value="">Todas las Empresas</option>';
      selectModal.innerHTML = '';
      selectNuevo.innerHTML = '<option value="">Selecciona una empresa...</option>';

      const empresasUnicas = obtenerEmpresasSistemaT28();
      
      empresasUnicas.forEach(empresa => {
        let option = document.createElement('option');
        option.value = empresa;
        option.textContent = empresa;
        if (empresa === valorActual) option.selected = true;
        select.appendChild(option);

        selectModal.appendChild(new Option(empresa, empresa));
        selectNuevo.appendChild(new Option(empresa, empresa));
      });

      // Mantiene sincronizada la lista del formulario de Personal sin estacionamiento.
      actualizarListaEmpresasPersonalT28();
    }

    function actualizarContadoresGlobales(datos) {
      let niveles = { VIP: [], S1: [], S2: [], S3: [], S4: [], S5: [] };
      (datos || []).forEach(item => {
        let ubiNorm = normalizarTexto(item.ubi);
        let estNum = parseInt(item.est) || item.est;
        if (ubiNorm.includes('vip')) niveles.VIP.push(estNum);
        else if (ubiNorm.includes('1')) niveles.S1.push(estNum);
        else if (ubiNorm.includes('2')) niveles.S2.push(estNum);
        else if (ubiNorm.includes('3')) niveles.S3.push(estNum);
        else if (ubiNorm.includes('4')) niveles.S4.push(estNum);
        else if (ubiNorm.includes('5')) niveles.S5.push(estNum);
      });

      function formatearRango(arr) {
        if (arr.length === 0) return 'Sin registros';
        let nums = arr.filter(n => !isNaN(n)).map(Number);
        if (nums.length === 0) return arr.join(', ');
        let min = Math.min(...nums), max = Math.max(...nums);
        return min === max ? `Est. ${min}` : `Est. ${min} al ${max}`;
      }

      const poner = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };
      ['VIP','S1','S2','S3','S4','S5'].forEach(n => {
        const clave = n.toLowerCase();
        const cantidad = niveles[n].length;
        const rango = formatearRango(niveles[n]);
        poner('cnt-' + clave, cantidad);
        poner('rango-' + clave, rango);
        poner('m-cnt-' + clave, cantidad);
        poner('m-rango-' + clave, rango);
      });
      actualizarDashboard();
    }

    function renderizarVistaEst(datos) {
      if (vistaEstActual === 'tarjetas') renderizarTarjetas(datos);
      else renderizarTabla(datos);
    }

    function renderizarTarjetas(datos) {
      const contenedor = document.getElementById('vista-tarjetas-container');
      if (!datos.length) {
        contenedor.innerHTML = '<div class="col-span-full text-center py-10 text-gray-500 font-medium bg-white rounded-xl shadow-sm border border-gray-200">No se encontraron registros.</div>';
        return;
      }

      const agrupado = datos.reduce((acc, item) => {
        if (!acc[item.empresa]) acc[item.empresa] = [];
        acc[item.empresa].push(item);
        return acc;
      }, {});

      const empresasOrdenadas = Object.keys(agrupado).sort((a, b) => agrupado[b].length - agrupado[a].length);

      contenedor.innerHTML = empresasOrdenadas.map(empresa => {
        let items = agrupado[empresa];
        let estilo = obtenerEstiloEmpresa(empresa);
        let logoUrl = items[0].logo || "";
        let puestosLibres = items.filter(i => i.ocupantes.some(o => o.usuario.toUpperCase() === 'LIBRE')).length;
        
        let headerLogo = logoUrl ? 
          `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(empresa)}" class="w-7 h-7 rounded-lg object-contain bg-white p-0.5 shadow-sm border border-white/20">` : 
          `<div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center font-bold text-xs">${escapeHtml(empresa.substring(0,2))}</div>`;

        let puestosHTML = items.map((item, index) => {
          let ocupanteActual = item.ocupantes[0];
          let esLibre = ocupanteActual.usuario.toUpperCase() === 'LIBRE';
          let borderColor = esLibre ? 'border-l-4 border-l-emerald-500 bg-emerald-50/50' : 'border-l-4 border-l-slate-400 bg-white';
          let ocupanteJson = JSON.stringify(ocupanteActual).replace(/"/g, '&quot;');
          let itemCompletoJson = JSON.stringify(item).replace(/"/g, '&quot;');

          let multiOcupantesHTML = '';
          if (item.ocupantes.length > 1) {
            let optionsHTML = item.ocupantes.map((oc, oIndex) => 
              `<option value="${oIndex}" ${oIndex === 0 ? 'selected' : ''}>${escapeHtml(oc.usuario)} (${escapeHtml(oc.placa)})</option>`
            ).join('');

            multiOcupantesHTML = `
              <div class="mt-2 pt-1.5 border-t border-gray-200 flex items-center justify-between gap-2">
                <span class="text-[10px] text-indigo-700 font-bold uppercase tracking-wide">${item.ocupantes.length} Ocupantes:</span>
                <select onchange='cambiarVistaOcupante(this, ${itemCompletoJson}, "${escapeHtml(empresa)}", ${index})' 
                  class="text-[11px] px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-50/80 text-indigo-900 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[170px] truncate">
                  ${optionsHTML}
                </select>
              </div>`;
          }

          return `
            <div id="card-puesto-${escapeHtml(empresa)}-${index}" class="p-2.5 rounded-lg border border-gray-200 ${borderColor} transition-all duration-200 hover:scale-[1.01] hover:shadow-md hover:border-indigo-400 cursor-pointer">
              <div class="flex justify-between items-start">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-900 text-xs">Est. ${escapeHtml(item.est)}</span>
                    <span class="text-[10px] px-1.5 py-0.2 bg-gray-100 rounded font-semibold text-slate-600 border border-gray-200">${escapeHtml(item.ubi)}</span>
                  </div>
                  <p id="txt-usuario-${escapeHtml(empresa)}-${index}" class="font-medium mt-0.5 text-slate-800 text-xs">${escapeHtml(ocupanteActual.usuario)}</p>
                </div>
                <div class="text-right flex items-center gap-1.5">
                  <span id="txt-placa-${escapeHtml(empresa)}-${index}" class="parking-plate bg-slate-900 text-white text-[11px] font-mono px-1.5 py-0.5 rounded tracking-wider shadow-sm">${escapeHtml(ocupanteActual.placa)}</span>
                  <button onclick='abrirModalPorOcupante(${ocupanteJson}, "${escapeHtml(item.est)}", "${escapeHtml(item.empresa)}")' class="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Editar" aria-label="Editar">${ICONS.edit}</button>
                </div>
              </div>
              ${multiOcupantesHTML}
            </div>`;
        }).join('');

        return `
          <div class="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 flex flex-col">
            <div class="${estilo.bg} ${estilo.text} px-4 py-3 flex justify-between items-center border-b border-black/10 shadow-sm">
              <div class="flex items-center gap-2.5">
                ${headerLogo}
                <h3 class="font-bold text-sm tracking-wide">${escapeHtml(empresa)}</h3>
              </div>
              <div class="flex items-center gap-2">
                <span class="bg-emerald-500/20 text-emerald-200 text-[11px] px-2 py-0.5 rounded font-medium border border-emerald-500/30">${puestosLibres} libres</span>
                <span class="${estilo.badge} text-[11px] px-2 py-0.5 rounded-full font-medium border">${items.length} est.</span>
              </div>
            </div>
            <div class="p-3.5 flex-1 space-y-2.5 overflow-y-auto max-h-[380px] custom-scroll pr-2">
              ${puestosHTML}
            </div>
          </div>`;
      }).join('');
    }

    function nivelCortoTabla(ubicacion) {
      const t = String(ubicacion || '').trim();
      const n = normalizarTexto(t);
      if (n.includes('vip')) return 'VIP';
      const mSotano = n.match(/(?:sotano|sótano)\s*(\d+)/);
      if (mSotano) return 'S' + mSotano[1];
      const mS = n.match(/^s\s*(\d+)/);
      if (mS) return 'S' + mS[1];
      return t || 'S/U';
    }

    function renderizarTabla(datos) {
      const tbody = document.getElementById('tabla-cuerpo');
      if (!datos.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-500 font-medium text-xs">No se encontraron registros.</td></tr>`;
        return;
      }

      const filas = [];
      datos.forEach(item => {
        let estilo = obtenerEstiloEmpresa(item.empresa);
        item.ocupantes.forEach(oc => {
          let esLibre = oc.usuario.toUpperCase() === 'LIBRE';
          let ocJson = JSON.stringify(oc).replace(/"/g, '&quot;');
          const nivelCorto = nivelCortoTabla(item.ubi);
          filas.push(`
            <tr class="t28-table-row ${esLibre ? 't28-row-free' : ''}">
              <td class="t28-col-est py-2 px-3 font-bold text-slate-900"><span class="t28-est-badge">Est. ${escapeHtml(item.est)}</span></td>
              <td class="py-2 px-3 text-slate-600">
                <span class="t28-level-badge" title="${escapeHtml(item.ubi || '')}">${escapeHtml(nivelCorto)}</span>
              </td>
              <td class="py-2 px-3 font-semibold ${estilo.borderTabla} pl-2.5">
                <span class="px-2 py-0.5 rounded text-[11px] font-bold ${estilo.bg} ${estilo.text}">${escapeHtml(item.empresa)}</span>
              </td>
              <td class="t28-col-user py-2 px-3 font-medium ${esLibre ? 'text-emerald-700 font-bold' : 'text-slate-800'}">
                ${esLibre ? '<span class="t28-free-badge">LIBRE</span>' : escapeHtml(oc.usuario)}
              </td>
              <td class="py-2 px-3"><span class="parking-plate t28-plate">${escapeHtml(oc.placa)}</span></td>
              <td class="t28-col-tipo-vehiculo py-2 px-3 text-slate-600">${escapeHtml(oc.tipoVehiculo || item.tipoVehiculo || 'No indicado')}</td>
              <td class="py-2 px-3 text-center">
                <button onclick='abrirModalPorOcupante(${ocJson}, "${escapeHtml(item.est)}", "${escapeHtml(item.empresa)}")'
                  class="t28-action-btn" title="Editar" aria-label="Editar">${ICONS.edit}</button>
              </td>
            </tr>`);
        });
      });
      tbody.innerHTML = filas.join('');
    }

    function cambiarVistaOcupante(selectElement, itemCompleto, empresa, indexCard) {
      const idxOcupante = Number(selectElement.value);
      const ocupanteSeleccionado = itemCompleto.ocupantes[idxOcupante];
      if (!ocupanteSeleccionado) return;

      document.getElementById(`txt-usuario-${empresa}-${indexCard}`).textContent = ocupanteSeleccionado.usuario;
      document.getElementById(`txt-placa-${empresa}-${indexCard}`).textContent = ocupanteSeleccionado.placa;

      const cardDiv = document.getElementById(`card-puesto-${empresa}-${indexCard}`);
      if (!cardDiv) return;

      const btnEditar = cardDiv.querySelector('button[title="Editar"]');
      if (!btnEditar) return;

      btnEditar.onclick = function(event) {
        if (event) event.stopPropagation();
        abrirModalPorOcupante(ocupanteSeleccionado, itemCompleto.est, itemCompleto.empresa);
      };
    }

    function filtrarDatos() {
      const inputBuscador = document.getElementById('buscador');
      const empresaSeleccionada = document.getElementById('filtro-empresa').value;
      const textoBuscador = normalizarTexto(inputBuscador.value);

      const filtrados = todosLosDatos.filter(item => {
        let cumpleEmpresa = empresaSeleccionada === "" || item.empresa === empresaSeleccionada;
        let coincideEst = normalizarTexto(item.est).includes(textoBuscador) || normalizarTexto(item.ubi).includes(textoBuscador);
        let coincideOcupante = item.ocupantes.some(o => 
          normalizarTexto(o.usuario).includes(textoBuscador) || normalizarTexto(o.placa).includes(textoBuscador)
        );
        let cumpleTexto = coincideEst || coincideOcupante || normalizarTexto(item.empresa).includes(textoBuscador);
        return cumpleEmpresa && cumpleTexto;
      });

      renderizarVistaEst(filtrados);
    }

    function actualizarEstacionamientosEdicion(estSeleccionar = '') {
      const empresa = document.getElementById('edit-empresa-select').value;
      const selectEst = document.getElementById('edit-est');
      selectEst.innerHTML = '';

      if (!empresa) {
        selectEst.innerHTML = '<option value="">Selecciona una empresa...</option>';
        return;
      }

      const puestos = todosLosDatos
        .filter(item => item.empresa === empresa)
        .sort((a, b) => String(a.est).localeCompare(String(b.est), undefined, { numeric: true }));

      if (puestos.length === 0) {
        selectEst.innerHTML = '<option value="">No hay estacionamientos para esta empresa</option>';
        return;
      }

      puestos.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.est;
        opt.textContent = `Est. ${item.est} (${item.ubi})`;
        if (String(item.est) === String(estSeleccionar)) opt.selected = true;
        selectEst.appendChild(opt);
      });
    }

    function abrirModalPorOcupante(ocupante, est, empresa) {
      const esVirtual = !ocupante.filaIndex || ocupante.esVirtual === true;
      document.getElementById('edit-fila-index').value = ocupante.filaIndex || '';
      document.getElementById('edit-empresa-original').value = empresa;
      document.getElementById('edit-est-original').value = est;
      document.getElementById('edit-empresa-select').value = empresa;
      actualizarEstacionamientosEdicion(est);
      document.getElementById('edit-usuario').value = esVirtual ? '' : ocupante.usuario;
      document.getElementById('edit-placa').value = (!esVirtual && ocupante.placa !== '---') ? ocupante.placa : '';
      document.getElementById('edit-tipo-vehiculo').value = esVirtual ? '' : (ocupante.tipoVehiculo || '');
      document.getElementById('modal-titulo').textContent = esVirtual ? `Asignar vehículo · Est. ${est}` : `Editar vehículo · ${ocupante.placa}`;

      const btnEliminar = document.getElementById('btn-eliminar-vehiculo');
      if (esVirtual) btnEliminar.classList.add('hidden');
      else btnEliminar.classList.remove('hidden');

      document.getElementById('modal-editar').classList.remove('hidden');
      document.getElementById('modal-editar').classList.add('flex');
    }

    function cerrarModal() {
      document.getElementById('modal-editar').classList.remove('flex');
      document.getElementById('modal-editar').classList.add('hidden');
    }

    function validarYGuardarCambios(event) {
      event.preventDefault();
      const empresaOriginal = document.getElementById('edit-empresa-original').value;
      const empresaNueva = document.getElementById('edit-empresa-select').value;
      const estOriginal = document.getElementById('edit-est-original').value;
      const estNuevo = document.getElementById('edit-est').value;
      const filaIndex = document.getElementById('edit-fila-index').value;
      const usuario = document.getElementById('edit-usuario').value.trim();
      const placa = document.getElementById('edit-placa').value.trim().toUpperCase();
      const tipoVehiculo = document.getElementById('edit-tipo-vehiculo').value.trim().toUpperCase();

      if (!empresaNueva || !estNuevo) {
        marcarCamposFaltantes(['edit-empresa-select','edit-est'], 'Selecciona una empresa y un estacionamiento.');
        return;
      }
      if (!usuario || !placa) {
        marcarCamposFaltantes(!usuario ? ['edit-usuario','edit-placa'] : ['edit-placa'], 'Completa el usuario y la placa.');
        return;
      }

      if (filaIndex && (empresaOriginal !== empresaNueva || String(estOriginal) !== String(estNuevo))) {
        const ok = confirm(`⚠️ REASIGNAR VEHÍCULO\n\nMoverás este vehículo de ${empresaOriginal} · Est. ${estOriginal} a ${empresaNueva} · Est. ${estNuevo}.\n\n¿Deseas continuar?`);
        if (!ok) return;
      }

      const btn = document.getElementById('btn-guardar');

      const datosModificados = {
        filaIndex: filaIndex,
        empresa: empresaNueva,
        estOriginal: estOriginal,
        est: estNuevo,
        usuario: usuario,
        placa: placa,
        tipoVehiculo: tipoVehiculo
      };

      const respaldoDatos = JSON.stringify(todosLosDatos);
      let ocupanteLocal = null;
      todosLosDatos.forEach(item => {
        const encontrado = (item.ocupantes || []).find(oc => String(oc.filaIndex || '') === String(filaIndex));
        if (encontrado) ocupanteLocal = encontrado;
        item.ocupantes = (item.ocupantes || []).filter(oc => String(oc.filaIndex || '') !== String(filaIndex));
        if (!item.ocupantes.length) item.ocupantes = [{usuario:'LIBRE',placa:'---',esVirtual:true}];
      });
      const destinoLocal = todosLosDatos.find(item => String(item.est) === String(estNuevo) && item.empresa === empresaNueva);
      if (destinoLocal) {
        destinoLocal.ocupantes = (destinoLocal.ocupantes || []).filter(oc => !(oc.esVirtual || String(oc.usuario).toUpperCase() === 'LIBRE'));
        destinoLocal.ocupantes.push(Object.assign({}, ocupanteLocal || {}, {filaIndex,usuario,placa,tipoVehiculo,esVirtual:false}));
      }
      cerrarModal();
      filtrarDatos();
      mostrarToast('¡Vehículo actualizado!', 'exito');

      google.script.run
        .withSuccessHandler(function() {
          marcarDestacadoT28('vehiculo', datosModificados.placa || datosModificados.usuario || '');
          const panelUsuarios = document.getElementById('modulo-empresas');
          if (panelUsuarios) {
            panelUsuarios.classList.remove('t28-panel-flash');
            void panelUsuarios.offsetWidth;
            panelUsuarios.classList.add('t28-panel-flash');
          }
          cargarDatosServidor(false);
        })
        .withFailureHandler(function(err) {
          todosLosDatos = JSON.parse(respaldoDatos);
          filtrarDatos();
          mostrarToast('Error: ' + err.message, 'error');
          abrirModalPorOcupante(Object.assign({}, ocupanteLocal || {}, {filaIndex,usuario,placa,tipoVehiculo}), estOriginal, empresaOriginal);
        })
        .actualizarEstacionamientoConTipoT28(datosModificados);
    }

    function confirmarEliminarVehiculo() {
      const filaIndex = document.getElementById('edit-fila-index').value;
      if (!filaIndex) {
        mostrarToast('Este puesto está libre; no existe un vehículo para eliminar.', 'error');
        return;
      }

      const usuario = document.getElementById('edit-usuario').value.trim();
      const placa = document.getElementById('edit-placa').value.trim().toUpperCase();
      const empresa = document.getElementById('edit-empresa-original').value;
      const est = document.getElementById('edit-est-original').value;

      accionPeligrosaActual = {
        tipo: 'vehiculo',
        filaIndex,
        placa,
        usuario
      };

      abrirConfirmacionEliminacion({
        titulo: 'Eliminar vehículo',
        mensaje: 'Se eliminará SOLO este vehículo de VEHICULOS. El estacionamiento y los demás vehículos asignados se conservarán.',
        detalles: [
          ['Usuario', usuario || '---'],
          ['Placa', placa || '---'],
          ['Empresa', empresa || '---'],
          ['Estacionamiento', `Est. ${est || '---'}`]
        ]
      });
    }

    function abrirModalNuevo() {
      document.getElementById('nuevo-usuario').value = '';
      document.getElementById('nuevo-placa').value = '';
      document.getElementById('nuevo-tipo-vehiculo').value = '';
      document.getElementById('nuevo-empresa').value = '';
      document.getElementById('nuevo-est').innerHTML = '<option value="">Primero elige una empresa...</option>';
      document.getElementById('modal-nuevo').classList.remove('hidden');
      document.getElementById('modal-nuevo').classList.add('flex');
      actualizarVisibilidadFabT28();
    }

    function cerrarModalNuevo() {
      document.getElementById('modal-nuevo').classList.remove('flex');
      document.getElementById('modal-nuevo').classList.add('hidden');
      actualizarVisibilidadFabT28();
    }

    function actualizarEstacionamientosDisponibles() {
      const empresaSeleccionada = document.getElementById('nuevo-empresa').value;
      const selectEst = document.getElementById('nuevo-est');
      selectEst.innerHTML = '';
      if (!empresaSeleccionada) {
        selectEst.innerHTML = '<option value="">Primero elige una empresa...</option>';
        return;
      }
      const puestosDeEmpresa = todosLosDatos.filter(item => item.empresa === empresaSeleccionada);
      if (puestosDeEmpresa.length === 0) {
        selectEst.innerHTML = '<option value="">No hay registros previos</option>';
        return;
      }
      puestosDeEmpresa.forEach(item => {
        let opt = document.createElement('option');
        opt.value = item.est + "|" + item.ubi;
        opt.textContent = `Est. ${item.est} (${item.ubi})`;
        selectEst.appendChild(opt);
      });
    }

    function guardarNuevoOcupante(event) {
      event.preventDefault();
      const btn = document.getElementById('btn-guardar-nuevo');
      let valEstUbi = document.getElementById('nuevo-est').value.split('|');
      const nuevoRegistro = {
        est: valEstUbi[0] || "",
        ubi: valEstUbi[1] || "",
        empresa: document.getElementById('nuevo-empresa').value,
        usuario: document.getElementById('nuevo-usuario').value,
        placa: document.getElementById('nuevo-placa').value.trim().toUpperCase(),
        tipoVehiculo: document.getElementById('nuevo-tipo-vehiculo').value.trim().toUpperCase()
      };

      // Respuesta optimista: cerrar y reflejar la fila antes de esperar a Sheets.
      const itemDestino = todosLosDatos.find(item =>
        String(item.est) === String(nuevoRegistro.est) &&
        String(item.empresa) === String(nuevoRegistro.empresa)
      );
      const idOptimista = 'temp-' + Date.now();
      const ocupanteOptimista = {
        filaIndex: '',
        usuario: nuevoRegistro.usuario,
        placa: nuevoRegistro.placa,
        tipoVehiculo: nuevoRegistro.tipoVehiculo,
        esVirtual: false,
        _optimistaId: idOptimista
      };
      if (itemDestino) {
        const ocupantesReales = (itemDestino.ocupantes || []).filter(oc =>
          !(oc.esVirtual === true || String(oc.usuario || '').toUpperCase() === 'LIBRE')
        );
        itemDestino.ocupantes = ocupantesReales.concat(ocupanteOptimista);
      }

      cerrarModalNuevo();
      filtrarDatos();
      mostrarToast('¡Registro agregado!', 'exito');

      google.script.run
        .withSuccessHandler(function() {
          // Reconciliación silenciosa con la fila real creada en Sheets.
          cargarDatosServidor(false);
        })
        .withFailureHandler(function(err) {
          if (itemDestino) {
            itemDestino.ocupantes = (itemDestino.ocupantes || []).filter(oc => oc._optimistaId !== idOptimista);
            if (!itemDestino.ocupantes.length) {
              itemDestino.ocupantes = [{ usuario: 'LIBRE', placa: '---', esVirtual: true }];
            }
          }
          filtrarDatos();
          mostrarToast("Error al agregar: " + err.message, 'error');
          // Recupera el formulario completo para corregir o reintentar sin perder datos.
          abrirModalNuevo();
          document.getElementById('nuevo-empresa').value = nuevoRegistro.empresa;
          actualizarEstacionamientosDisponibles();
          document.getElementById('nuevo-est').value = nuevoRegistro.est + '|' + nuevoRegistro.ubi;
          document.getElementById('nuevo-usuario').value = nuevoRegistro.usuario;
          document.getElementById('nuevo-placa').value = nuevoRegistro.placa;
          document.getElementById('nuevo-tipo-vehiculo').value = nuevoRegistro.tipoVehiculo;
        })
        .agregarEstacionamientoConTipoT28({
          est: nuevoRegistro.est,
          usuario: nuevoRegistro.usuario,
          placa: nuevoRegistro.placa,
          tipoVehiculo: nuevoRegistro.tipoVehiculo
        });
    }

    let ordenActualColumna = '';
    let ordenAscendente = true;

    function ordenarTabla(columna) {
      if (ordenActualColumna === columna) {
        ordenAscendente = !ordenAscendente;
      } else {
        ordenActualColumna = columna;
        ordenAscendente = true;
      }

      const empresaSeleccionada = document.getElementById('filtro-empresa').value;
      const textoBuscador = normalizarTexto(document.getElementById('buscador').value);

      let datosFiltrados = todosLosDatos.filter(item => {
        let cumpleEmpresa = empresaSeleccionada === "" || item.empresa === empresaSeleccionada;
        let coincideEst = normalizarTexto(item.est).includes(textoBuscador) || normalizarTexto(item.ubi).includes(textoBuscador);
        let coincideOcupante = item.ocupantes.some(o => 
          normalizarTexto(o.usuario).includes(textoBuscador) || normalizarTexto(o.placa).includes(textoBuscador)
        );
        return cumpleEmpresa && (coincideEst || coincideOcupante || normalizarTexto(item.empresa).includes(textoBuscador));
      });

      datosFiltrados.sort((a, b) => {
        let valA = "";
        let valB = "";

        if (columna === 'est') {
          valA = parseInt(a.est) || a.est;
          valB = parseInt(b.est) || b.est;
        } else if (columna === 'ubi') {
          valA = a.ubi;
          valB = b.ubi;
        } else if (columna === 'empresa') {
          valA = a.empresa;
          valB = b.empresa;
        } else if (columna === 'usuario') {
          valA = a.ocupantes[0].usuario;
          valB = b.ocupantes[0].usuario;
        } else if (columna === 'placa') {
          valA = a.ocupantes[0].placa;
          valB = b.ocupantes[0].placa;
        }

        if (valA < valB) return ordenAscendente ? -1 : 1;
        if (valA > valB) return ordenAscendente ? 1 : -1;
        return 0;
      });

      renderizarTabla(datosFiltrados);
    }

    // ================= CONFIGURACIÓN TORRE 28 =================
    const T28_CONFIG_KEY = 'torre28_config_v100';

    let configuracionT28 = {
      texto: 'normal',
      densidad: 'compacta',
      tipografia: 'Inter',
      fondo: 45,
      animaciones: true,
      sonidoAlertas: false,
      movimientoAlertas: true,
      autoRefresh: true
    };

    let audioContextT28 = null;

    function leerConfiguracionT28() {
      const defaults = {
        texto: 'normal',
        densidad: 'compacta',
        tipografia: 'Inter',
        fondo: 45,
        animaciones: true,
        sonidoAlertas: false,
        movimientoAlertas: true,
        autoRefresh: true
      };

      try {
        const raw = localStorage.getItem(T28_CONFIG_KEY);
        const guardada = raw ? JSON.parse(raw) : {};

        // Migra la tipografía que ya usaba la versión anterior.
        const fuenteAnterior = localStorage.getItem('torre28_fuente');
        if (!guardada.tipografia && fuenteAnterior) guardada.tipografia = fuenteAnterior;

        configuracionT28 = { ...defaults, ...guardada };
      } catch (e) {
        configuracionT28 = { ...defaults };
      }

      // Preferencias oficiales fijas: texto normal, densidad compacta y sincronización automática.
      configuracionT28.texto = 'normal';
      configuracionT28.densidad = 'compacta';
      configuracionT28.autoRefresh = true;

      // El modo oscuro deja de existir en Torre 28.
      try { localStorage.removeItem('torre28_tema'); } catch(e) {}
      document.body.classList.remove('dark-mode');

      return configuracionT28;
    }

    function guardarConfiguracionT28() {
      try {
        localStorage.setItem(T28_CONFIG_KEY, JSON.stringify(configuracionT28));
        localStorage.setItem('torre28_fuente', configuracionT28.tipografia);
      } catch (e) {}
    }

    function aplicarConfiguracionT28(actualizarControles = true) {
      const cfg = configuracionT28 || {};

      // Tema claro fijo.
      document.body.classList.remove('dark-mode');

      const html = document.documentElement;
      html.classList.remove('t28-font-large');
      html.classList.add('t28-density-compact');
      html.classList.toggle('t28-animations-off', cfg.animaciones === false);
      html.classList.toggle('t28-alert-motion-off', cfg.movimientoAlertas === false);

      const fuente = String(cfg.tipografia || 'Inter');
      document.body.style.fontFamily = `"${fuente}", "Inter", "Roboto", sans-serif`;

      autoActualizacionHabilitadaT28 = true;

      aplicarIntensidadFondoT28(Number(cfg.fondo || 45));

      if (actualizarControles) actualizarControlesConfiguracionT28();
    }

    function aplicarIntensidadFondoT28(valor) {
      const v = Math.max(30, Math.min(80, Number(valor) || 45));
      const t = (v - 30) / 50;

      // Mayor porcentaje = foto más visible = menor capa oscura.
      const a1 = (0.82 - 0.24 * t).toFixed(3);
      const a2 = (0.76 - 0.24 * t).toFixed(3);
      const a3 = (0.84 - 0.23 * t).toFixed(3);

      document.documentElement.style.setProperty('--t28-bg-a1', a1);
      document.documentElement.style.setProperty('--t28-bg-a2', a2);
      document.documentElement.style.setProperty('--t28-bg-a3', a3);

      const label = document.getElementById('cfg-fondo-valor');
      if (label) label.textContent = `${v}%`;
    }

    function actualizarControlesConfiguracionT28() {
      const cfg = configuracionT28;

      const activarSegmento = (id, activo) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', Boolean(activo));
      };

      activarSegmento('cfg-texto-normal', cfg.texto !== 'grande');
      activarSegmento('cfg-texto-grande', cfg.texto === 'grande');
      activarSegmento('cfg-densidad-normal', cfg.densidad !== 'compacta');
      activarSegmento('cfg-densidad-compacta', cfg.densidad === 'compacta');

      const tipografia = document.getElementById('cfg-tipografia');
      if (tipografia) tipografia.value = cfg.tipografia || 'Inter';

      const fondo = document.getElementById('cfg-fondo');
      if (fondo) fondo.value = Number(cfg.fondo || 45);
      aplicarIntensidadFondoT28(Number(cfg.fondo || 45));

      const anim = document.getElementById('cfg-animaciones');
      if (anim) anim.checked = cfg.animaciones !== false;

      const sonido = document.getElementById('cfg-sonido-alertas');
      if (sonido) sonido.checked = cfg.sonidoAlertas === true;

      const mov = document.getElementById('cfg-movimiento-alertas');
      if (mov) mov.checked = cfg.movimientoAlertas !== false;

      const auto = document.getElementById('cfg-auto-refresh');
      if (auto) auto.checked = cfg.autoRefresh !== false;

      actualizarCuentaConfigT28();
      actualizarUltimaSyncConfigT28();
    }

    function inicializarConfiguracionT28() {
      leerConfiguracionT28();
      aplicarConfiguracionT28(true);
    }

    function toggleMenuConfig(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      const menu = document.getElementById('menu-configuracion');
      if (!menu) return;

      const vaAbrir = menu.classList.contains('hidden');
      menu.classList.toggle('hidden');

      if (vaAbrir) {
        actualizarControlesConfiguracionT28();
      }
    }

    function cerrarMenuConfigT28(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      document.getElementById('menu-configuracion')?.classList.add('hidden');
    }

    window.addEventListener('click', function(e) {
      const menu = document.getElementById('menu-configuracion');
      const boton = e.target?.closest?.('button[aria-label="Configuración"]');

      if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && !boton) {
        menu.classList.add('hidden');
      }
    });

    function cambiarTamanoTextoT28(valor) {
      configuracionT28.texto = valor === 'grande' ? 'grande' : 'normal';
      guardarConfiguracionT28();
      aplicarConfiguracionT28(true);
      mostrarToast(
        configuracionT28.texto === 'grande' ? 'Texto grande activado' : 'Texto normal activado',
        'exito'
      );
    }

    function cambiarDensidadT28(valor) {
      configuracionT28.densidad = valor === 'compacta' ? 'compacta' : 'normal';
      guardarConfiguracionT28();
      aplicarConfiguracionT28(true);
      mostrarToast(
        configuracionT28.densidad === 'compacta' ? 'Vista compacta activada' : 'Densidad normal activada',
        'exito'
      );
    }

    function cambiarTipografia(fuente) {
const permitidas = [
  'Inter',
  'Roboto',
  'Poppins',
  'Segoe UI',
  'Montserrat',
  'Open Sans',
  'Lato',
  'Nunito Sans',
  'Manrope',
  'DM Sans'
];
      configuracionT28.tipografia = permitidas.includes(fuente) ? fuente : 'Inter';
      guardarConfiguracionT28();
      aplicarConfiguracionT28(true);
    }

    function cambiarFondoT28(valor, guardar = true) {
      configuracionT28.fondo = Math.max(30, Math.min(80, Number(valor) || 45));
      aplicarIntensidadFondoT28(configuracionT28.fondo);
      if (guardar) {
        guardarConfiguracionT28();
        mostrarToast('Fondo actualizado', 'exito');
      }
    }

    function cambiarAnimacionesT28(activo) {
      configuracionT28.animaciones = Boolean(activo);
      guardarConfiguracionT28();
      aplicarConfiguracionT28(true);
    }

    function cambiarMovimientoAlertasT28(activo) {
      configuracionT28.movimientoAlertas = Boolean(activo);
      guardarConfiguracionT28();
      aplicarConfiguracionT28(true);
    }

    function cambiarSonidoAlertasT28(activo) {
      configuracionT28.sonidoAlertas = Boolean(activo);
      guardarConfiguracionT28();
      aplicarConfiguracionT28(true);

      if (activo) {
        reproducirSonidoAlertaT28(true);
      }
    }

    function cambiarAutoRefreshT28() {
      configuracionT28.autoRefresh = true;
      autoActualizacionHabilitadaT28 = true;
      guardarConfiguracionT28();
      actualizarControlesConfiguracionT28();
      mostrarToast('Actualización automática activada', 'exito');
    }

    function actualizarCuentaConfigT28() {
      const nombre = document.getElementById('cfg-cuenta-nombre');
      const rol = document.getElementById('cfg-cuenta-rol');

      if (nombre) nombre.textContent =
        usuarioSesionT28?.nombre ||
        usuarioSesionT28?.usuario ||
        'Usuario';

      if (rol) rol.textContent =
        usuarioSesionT28?.rol ||
        'Acceso';

      const botonAdmin = document.getElementById('cfg-gestionar-usuarios');
      if (botonAdmin) botonAdmin.classList.toggle('hidden', !esAdministradorT28());
    }

    function esAdministradorT28() {
      const rol = normalizarTexto(usuarioSesionT28?.rol || '');
      const permisos=Array.isArray(usuarioSesionT28?.permisos)?usuarioSesionT28.permisos.map(normalizarTexto):[];
      return rol === 'administrador' || rol === 'admin' || permisos.includes('administrar');
    }

    function abrirGestionUsuariosT28() {
      if (!esAdministradorT28()) {
        mostrarToast('Solo el administrador puede gestionar usuarios.', 'error');
        return;
      }
      const modal=document.getElementById('modal-admin-usuarios');
      modal.classList.remove('hidden');modal.classList.add('flex');
      cambiarTabAdminT28('usuarios');
      document.getElementById('admin-usuarios-lista').innerHTML=htmlSkeletonT28(4);
      T28Api.listarUsuariosAdmin().then(res=>{
        usuariosAdminT28=Array.isArray(res?.data)?res.data:[];
        renderUsuariosAdminT28();
      }).catch(err=>{
        document.getElementById('admin-usuarios-lista').innerHTML=htmlEstadoVacioT28('No se pudieron cargar los usuarios',err?.message||'Inténtalo nuevamente.');
      });
    }

    function cerrarGestionUsuariosT28(){const m=document.getElementById('modal-admin-usuarios');m.classList.add('hidden');m.classList.remove('flex');}

    function cambiarTabAdminT28(tab) {
      const sesiones=tab==='sesiones';
      document.getElementById('admin-tab-usuarios')?.classList.toggle('active',!sesiones);
      document.getElementById('admin-tab-sesiones')?.classList.toggle('active',sesiones);
      document.getElementById('admin-panel-usuarios')?.classList.toggle('hidden',sesiones);
      document.getElementById('admin-panel-sesiones')?.classList.toggle('hidden',!sesiones);
      if(sesiones)cargarSesionesAdminT28();
    }

    function cargarSesionesAdminT28() {
      const cont=document.getElementById('admin-sesiones-lista');if(!cont)return;
      cont.innerHTML=htmlSkeletonT28(4);
      T28Api.listarSesionesAdmin().then(res=>{sesionesAdminT28=Array.isArray(res?.data)?res.data:[];renderSesionesAdminT28();}).catch(err=>{cont.innerHTML=htmlEstadoVacioT28('No se pudieron cargar los dispositivos',err?.message||'Inténtalo nuevamente.');});
    }

    function renderSesionesAdminT28() {
      const cont=document.getElementById('admin-sesiones-lista');if(!cont)return;
      if(!sesionesAdminT28.length){cont.innerHTML=htmlEstadoVacioT28('Sin sesiones','Todavía no hay dispositivos registrados.');return;}
      cont.innerHTML=sesionesAdminT28.map(s=>{
        const activa=normalizarTexto(s.estado)==='activa';
        const fecha=s.ultimaActividad?new Date(s.ultimaActividad).toLocaleString('es-PE',{dateStyle:'short',timeStyle:'short'}):'---';
        return `<article class="t28-admin-session-card ${activa?'':'is-disabled'}"><div class="t28-admin-device-icon">${activa?'●':'○'}</div><div><strong>${escapeHtml(s.nombre||s.usuario||'Usuario')}</strong><span>${escapeHtml(s.dispositivo||'Dispositivo')} · ${escapeHtml(s.navegador||'Navegador')} ${s.sistema?'· '+escapeHtml(s.sistema):''}</span><small>Última actividad: ${escapeHtml(fecha)}</small></div><b>${escapeHtml(s.estado||'---')}</b>${activa?`<button type="button" onclick="revocarSesionAdminT28('${escapeHtml(s.id)}')">Cerrar sesión</button>`:''}</article>`;
      }).join('');
    }

    function revocarSesionAdminT28(sesionId) {
      const sesion=sesionesAdminT28.find(s=>s.id===sesionId);if(!sesion)return;
      sesion.estado='REVOCADA';renderSesionesAdminT28();mostrarToast('Sesión cerrada en ese dispositivo.','exito');
      T28Api.revocarSesionAdmin(sesionId).catch(err=>{sesion.estado='ACTIVA';renderSesionesAdminT28();mostrarToast('No se pudo cerrar: '+(err?.message||err),'error');});
    }

    function renderUsuariosAdminT28() {
      const cont=document.getElementById('admin-usuarios-lista');if(!cont)return;
      const q=normalizarTexto(document.getElementById('admin-usuarios-buscar')?.value||'');
      const lista=(usuariosAdminT28||[]).filter(u=>!q||[u.nombre,u.usuario,u.rol].some(v=>normalizarTexto(v).includes(q)));
      if(!lista.length){cont.innerHTML=htmlEstadoVacioT28('Sin usuarios','No hay accesos que coincidan con la búsqueda.');return;}
      cont.innerHTML=lista.map(u=>{
        const obj=encodeURIComponent(JSON.stringify(u));
        const activo=normalizarTexto(u.activo)==='si';
        return `<article class="t28-admin-user-card ${activo?'':'is-disabled'}"><div class="t28-admin-user-avatar">${escapeHtml(String(u.nombre||u.usuario||'U').trim().charAt(0).toUpperCase())}</div><div><strong>${escapeHtml(u.nombre||'Sin nombre')}</strong><span>@${escapeHtml(u.usuario||'---')} · ${escapeHtml(u.rol||'Acceso')}</span></div><b>${activo?'Activo':'Inactivo'}</b><button type="button" onclick="abrirFormUsuarioAdminT28(JSON.parse(decodeURIComponent('${obj}')))">${ICONS.edit}<span>Editar</span></button></article>`;
      }).join('');
    }

    function abrirFormUsuarioAdminT28(usuario=null) {
      if(!esAdministradorT28())return;
      document.getElementById('admin-usuario-id').value=usuario?.id||'';
      document.getElementById('admin-usuario-nombre').value=usuario?.nombre||'';
      document.getElementById('admin-usuario-login').value=usuario?.usuario||'';
      document.getElementById('admin-usuario-pin').value='';
      document.getElementById('admin-usuario-pin').required=!usuario;
      document.getElementById('admin-usuario-pin-label').textContent=usuario?'Nuevo PIN (opcional)':'PIN *';
      document.getElementById('admin-usuario-rol').value=usuario?.rol||'CCTV';
      const permisos=Array.isArray(usuario?.permisos)&&usuario.permisos.length?usuario.permisos:(PERMISOS_ROL_T28[normalizarTexto(usuario?.rol||'control')]||PERMISOS_ROL_T28.control);
      document.querySelectorAll('.t28-admin-permissions input[type="checkbox"]').forEach(c=>{c.checked=permisos.map(normalizarTexto).includes(c.value);});
      document.getElementById('admin-usuario-activo').checked=!usuario||normalizarTexto(usuario.activo)==='si';
      document.getElementById('admin-usuario-form-titulo').textContent=usuario?'Editar usuario':'Nuevo usuario';
      const m=document.getElementById('modal-admin-usuario-form');m.classList.remove('hidden');m.classList.add('flex');
    }

    function cerrarFormUsuarioAdminT28(){const m=document.getElementById('modal-admin-usuario-form');m.classList.add('hidden');m.classList.remove('flex');}

    function aplicarPermisosRolAdminT28() {
      const rol=normalizarTexto(document.getElementById('admin-usuario-rol')?.value||'control');
      const permisos=PERMISOS_ROL_T28[rol]||PERMISOS_ROL_T28.control;
      document.querySelectorAll('.t28-admin-permissions input[type="checkbox"]').forEach(c=>{c.checked=permisos.includes(c.value);});
    }

    function guardarUsuarioAdminT28(event) {
      event.preventDefault();if(!esAdministradorT28())return;
      const datos={
        id:document.getElementById('admin-usuario-id').value.trim(),
        nombre:document.getElementById('admin-usuario-nombre').value.trim(),
        usuario:document.getElementById('admin-usuario-login').value.trim(),
        pin:document.getElementById('admin-usuario-pin').value.trim(),
        rol:document.getElementById('admin-usuario-rol').value,
        activo:document.getElementById('admin-usuario-activo').checked?'SI':'NO',
        permisos:Array.from(document.querySelectorAll('.t28-admin-permissions input[type="checkbox"]:checked')).map(c=>c.value)
      };
      const respaldo=JSON.stringify(usuariosAdminT28||[]);
      const local=Object.assign({},datos,{id:datos.id||('temp-'+Date.now()),fila:-Date.now()});delete local.pin;
      const pos=usuariosAdminT28.findIndex(u=>datos.id&&u.id===datos.id);
      if(pos>=0)usuariosAdminT28[pos]=Object.assign({},usuariosAdminT28[pos],local);else usuariosAdminT28.unshift(local);
      cerrarFormUsuarioAdminT28();renderUsuariosAdminT28();mostrarToast(datos.id?'¡Usuario actualizado!':'¡Usuario creado!','exito');
      T28Api.guardarUsuarioAdmin(datos).then(res=>{
        const guardado=res?.data||local;
        usuariosAdminT28=usuariosAdminT28.filter(u=>u.id!==local.id);
        const real=usuariosAdminT28.findIndex(u=>u.id===guardado.id);
        if(real>=0)usuariosAdminT28[real]=guardado;else usuariosAdminT28.unshift(guardado);
        renderUsuariosAdminT28();
      }).catch(err=>{
        usuariosAdminT28=JSON.parse(respaldo);renderUsuariosAdminT28();mostrarToast('No se pudo guardar: '+(err?.message||err),'error');abrirFormUsuarioAdminT28(local);
      });
    }

    function actualizarUltimaSyncConfigT28() {
      const el = document.getElementById('cfg-ultima-sync');
      if (!el) return;

      if (!ultimaSincronizacionT28) {
        const sidebar = document.getElementById('sidebar-ultima-sync');
        el.textContent = sidebar?.textContent?.trim() || '---';
        return;
      }

      el.textContent = new Intl.DateTimeFormat('es-PE', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(ultimaSincronizacionT28).replace(/\s+/g, ' ').toUpperCase();
    }

    function actualizarDesdeConfiguracionT28() {
      cerrarMenuConfigT28();
      forzarActualizacion();
    }

    function salirDesdeConfiguracionT28() {
      cerrarMenuConfigT28();
      solicitarCerrarSesionT28();
    }

    function obtenerAudioContextT28() {
      try {
        if (!audioContextT28) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return null;
          audioContextT28 = new Ctx();
        }
        if (audioContextT28.state === 'suspended') {
          audioContextT28.resume().catch(() => {});
        }
        return audioContextT28;
      } catch (e) {
        return null;
      }
    }

    function reproducirSonidoAlertaT28(forzar = false, aviso = null) {
      if (!forzar && configuracionT28.sonidoAlertas !== true) return;

      if (!forzar && aviso) {
        try {
          const key = `T28_ALERTA_SOUND_${aviso.id || aviso.filaIndex}_${aviso.fechaEventoMs || 0}`;
          const ultima = Number(localStorage.getItem(key) || 0);

          // Evita que una evaluación por minuto haga sonar la alerta de nuevo.
          if (Date.now() - ultima < 55 * 60 * 1000) return;
          localStorage.setItem(key, String(Date.now()));
        } catch (e) {}
      }

      const ctx = obtenerAudioContextT28();
      if (!ctx) return;

      const tocar = (inicio, frecuencia) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frecuencia, inicio);

        gain.gain.setValueAtTime(0.0001, inicio);
        gain.gain.exponentialRampToValueAtTime(0.10, inicio + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.17);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(inicio);
        osc.stop(inicio + 0.18);
      };

      const ahora = ctx.currentTime + 0.02;
      tocar(ahora, 720);
      tocar(ahora + 0.20, 900);
    }

    function probarAlertaConfiguracionT28() {
      cerrarMenuConfigT28();

      const panel = document.getElementById('alerta-flotante-t28');
      if (!panel) return;

      panel.classList.add('is-config-test');
      panel.classList.remove('hidden', 'is-critical');
      panel.classList.add('is-urgent', 'attention-now');

      const titulo = document.getElementById('alerta-flotante-titulo');
      const mensaje = document.getElementById('alerta-flotante-mensaje');
      const hora = document.getElementById('alerta-flotante-hora');
      const restante = document.getElementById('alerta-flotante-restante');
      const contador = document.getElementById('alerta-flotante-contador');

      if (titulo) titulo.textContent = 'Alerta de prueba';
      if (mensaje) mensaje.textContent = 'Así aparecerán los recordatorios programados de Torre 28.';
      if (hora) hora.textContent = 'Hoy · Prueba';
      if (restante) restante.textContent = 'Configuración correcta';
      if (contador) contador.classList.add('hidden');

      reproducirSonidoAlertaT28(true);

      setTimeout(function() {
        panel.classList.add('hidden');
        panel.classList.remove('is-config-test', 'is-urgent', 'attention-now');
        evaluarAlertasT28();
      }, 5000);
    }

    window.addEventListener('resize', function() {
      actualizarFechaHoraTopbar();
    });

    document.addEventListener('DOMContentLoaded', function() {
      inicializarConfiguracionT28();
      inicializarDetalleTablasMovilT28();
      actualizarBotonLimpiarHistorialT28();
    });



    // ================= AVISOS Y NOTAS =================
    function autorAvisoT28() {
      return String(usuarioSesionT28?.nombre || usuarioSesionT28?.usuario || 'Usuario').trim();
    }

    function cargarAvisosDashboardT28(forzar = false) {
      if (avisosCargandoT28 && !forzar) return;
      avisosCargandoT28 = true;
      const solicitudActual = ++solicitudAvisosT28;

      return T28Api.avisos()
        .then(function(res) {
          // Si empezó otra carga después, ignoramos esta respuesta antigua.
          if (solicitudActual !== solicitudAvisosT28) return;
          const data = res?.data;
          avisosCargandoT28 = false;
          avisosT28 = Array.isArray(data) ? data : [];
          if (avisoIndiceT28 >= avisosT28.length) avisoIndiceT28 = 0;
          renderAvisosT28();
          reiniciarAvisosT28();
          iniciarMotorAlertasT28();
          registrarSincronizacionT28();
          if (forzar) mostrarToast('Avisos actualizados', 'exito');
        })
        .catch(function(err) {
          if (solicitudActual !== solicitudAvisosT28) return;
          avisosCargandoT28 = false;
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

          const recibidos = Array.isArray(data) ? data : [];

          if (recibidos.length) {
            empresasCatalogoT28 = recibidos;
          } else if (!empresasCatalogoT28.length) {
            empresasCatalogoT28 = empresasFallbackT28();
          }

          if (incluirLogos) empresaCatalogoConLogosT28 = true;

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
    function cargarDirectorioServidor(mostrarNotif = false, forzar = false) {
      if (cargandoDirectorioT28) return;

      if (todosLosContactos.length && !mostrarNotif && !forzar) {
        filtrarDirectorio();
        return;
      }

      cargandoDirectorioT28 = true;
      const cont = document.getElementById('directorio-grid');
      if (cont && !todosLosContactos.length) cont.innerHTML = htmlSkeletonT28(esMovilRendimientoT28() ? 3 : 6);

      google.script.run
        .withSuccessHandler(function(data) {
          cargandoDirectorioT28 = false;
          ultimaCargaDirectorioT28 = Date.now();
          todosLosContactos = Array.isArray(data) ? data : [];
          registrarSincronizacionT28();

          const total = document.getElementById('directorio-total');
          if (total) total.textContent = todosLosContactos.length;
          if (moduloActual === 'directorio') filtrarDirectorio();
          if (mostrarNotif) mostrarToast('Directorio actualizado', 'exito');
        })
        .withFailureHandler(function(err) {
          cargandoDirectorioT28 = false;
          if (cont && moduloActual === 'directorio') {
            cont.innerHTML = htmlEstadoVacioT28('No se pudo cargar el Directorio', 'Prueba nuevamente con Actualizar.');
          }
          if (mostrarNotif) mostrarToast('Error al cargar directorio: ' + err.message, 'error');
        })
        .obtenerDirectorioWeb();
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

        const destacado = coincideDestacadoT28('directorio', c.servicio, c.proveedor) ? ' t28-just-updated' : '';
        return `<article class="directorio-card editable${destacado}">
          <div class="directorio-card-head">
            <div class="directorio-icon">
              <svg class="icon" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h5"/></svg>
            </div>
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
      document.getElementById('directorio-modal-titulo').textContent=registro?'Editar contacto':'Nuevo contacto';
      const btnEliminar = document.getElementById('btn-eliminar-directorio-form');
      if (btnEliminar) btnEliminar.classList.toggle('hidden', !registro);
      m.classList.remove('hidden');m.classList.add('flex');
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
      if(!servicio)return marcarCamposFaltantes(['directorio-form-servicio'],'Ingresa el servicio');
      if(!proveedor)return marcarCamposFaltantes(['directorio-form-proveedor'],'Ingresa el proveedor');
      const respaldo=JSON.stringify(todosLosContactos||[]);
      const registro={filaIndex:filaIndex||-Date.now(),servicio,proveedor,contacto,numero,numero2,observacion};
      const pos=todosLosContactos.findIndex(c=>filaIndex&&Number(c.filaIndex)===filaIndex);
      if(pos>=0)todosLosContactos[pos]=Object.assign({},todosLosContactos[pos],registro);else todosLosContactos.unshift(registro);
      cerrarModalDirectorio();filtrarDirectorio();mostrarToast(filaIndex?'¡Contacto actualizado!':'¡Contacto agregado!','exito');
      google.script.run.withSuccessHandler(()=>{marcarDestacadoT28('directorio',servicio||proveedor);cargarDirectorioServidor(false,true);})
      .withFailureHandler(err=>{todosLosContactos=JSON.parse(respaldo);filtrarDirectorio();mostrarToast('No se pudo guardar: '+err.message,'error');abrirModalDirectorio(registro);})
      .guardarDirectorioWeb({filaIndex,servicio,proveedor,contacto,numero,numero2,observacion});
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
