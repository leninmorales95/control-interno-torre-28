(function () {
  'use strict';
  if (!window.T28Local) return;
  const names = {
    'sync.movimientos.crear': 'Ingreso con confirmación segura',
    'sync.movimientos.salida': 'Salida con confirmación segura',
    'sync.movimientos.editar': 'Edición con confirmación segura',
    'sync.movimientos.eliminar': 'Eliminación con confirmación segura',
    registrarMovimientoWeb: 'Ingreso', actualizarMovimientoWeb: 'Edición de movimiento',
    registrarSalidaMovimientoWeb: 'Salida', eliminarMovimientoWeb: 'Eliminar movimiento',
    guardarAvisoWebT28: 'Aviso', eliminarAvisoWebT28: 'Eliminar aviso',
    guardarEmpresaWebT28: 'Empresa', actualizarSuministroLuz: 'Suministro',
    guardarDirectorioFotoWebT28: 'Contacto', guardarDirectorioWeb: 'Contacto',
    guardarPersonaDirectorioWebT28: 'Directorio', guardarPersonalSinEstacionamientoWeb: 'Personal',
    guardarEncargadoDiaWeb: 'Responsable de turno'
  };
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 't28-local-pending';
  button.hidden = true;
  document.getElementById('sidebar-sync-box')?.appendChild(button);
  const dialog = document.createElement('dialog');
  dialog.className = 't28-local-review';
  dialog.setAttribute('aria-labelledby', 't28-local-review-title');
  const heading = document.createElement('h2');
  heading.id = 't28-local-review-title';
  heading.textContent = 'Guardados por revisar';
  const explanation = document.createElement('p');
  explanation.textContent = 'Estos datos se conservan en este equipo. Comprueba el registro actualizado antes de repetir un guardado: la respuesta pudo perderse después de aplicarse. Los formularios de ingreso se pueden recuperar desde Movimientos.';
  const warning = document.createElement('p');
  warning.textContent = 'Borrar los datos del navegador o usar navegación privada puede eliminar estos respaldos.';
  const list = document.createElement('div');
  list.className = 't28-local-review-list';
  const close = document.createElement('button');
  close.type = 'button'; close.textContent = 'Cerrar'; close.onclick = () => dialog.close();
  const download = document.createElement('button');
  download.type = 'button'; download.textContent = 'Descargar respaldo';
  const actions = document.createElement('div');
  actions.className = 't28-local-review-actions'; actions.append(download, close);
  dialog.append(heading, explanation, list, warning, actions);
  document.body.append(dialog);
  button.onclick = () => dialog.showModal();
  let operations = [], drafts = [], sequence = 0;
  const text = (tag, value) => { const node = document.createElement(tag); node.textContent = value; return node; };
  async function refresh() {
    const request = ++sequence;
    try {
      const [pending, forms] = await Promise.all([T28Local.listOperations(), T28Local.listDrafts()]);
      if (request !== sequence) return;
      operations = pending; drafts = forms;
      button.hidden = !pending.length && !forms.length;
      button.textContent = pending.length ? `${pending.length} guardado${pending.length === 1 ? '' : 's'} por confirmar` : `${forms.length} formulario${forms.length === 1 ? '' : 's'} conservado${forms.length === 1 ? '' : 's'}`;
      list.replaceChildren();
      for (const record of pending) {
        const card = document.createElement('article');
        const data = record.args?.[0];
        const description = data && typeof data === 'object' ? [data.placa, data.nombre, data.titulo, data.empresa, data.servicio].filter(Boolean).join(' · ') : '';
        const sending = record.status === 'sending' && Date.now() - record.createdAt < 30000;
        card.append(text('strong', names[record.method] || 'Registro del panel'), text('p', description),
          text('small', new Date(record.createdAt).toLocaleString('es-PE')),
          text('p', sending ? 'Confirmando con Google Sheets…' : record.error || 'Confirmación pendiente; revisa el registro antes de repetir.'));
        if (!sending) {
          if (['sync.movimientos.crear','sync.movimientos.salida','sync.movimientos.editar','sync.movimientos.eliminar'].includes(record.method)) {
            const retry = document.createElement('button');
            retry.type = 'button'; retry.textContent = 'Reintentar sin duplicar';
            retry.onclick = async () => {
              retry.disabled = true;
              try {
                if(record.method==='sync.movimientos.eliminar')await T28Api.reintentarEliminacionSegura(record.id);
                else if(record.method==='sync.movimientos.editar')await T28Api.reintentarEdicionSegura(record.id);
                else if(record.method==='sync.movimientos.salida')await T28Api.reintentarSalidaSegura(record.id);
                else await T28Api.reintentarMovimientoSeguro(record.id);
                if (typeof refrescarIngresosLocalesT28 === 'function') await refrescarIngresosLocalesT28();
                if (typeof cargarHistorialHoy === 'function') cargarHistorialHoy(true);
              } catch (error) { alert(String(error?.message || error)); }
              finally { await refresh(); }
            };
            card.append(retry);
          }
          const reviewed = document.createElement('button');
          reviewed.type = 'button'; reviewed.textContent = 'Ya comprobado';
          reviewed.onclick = async () => {
            if (!confirm('¿Ya comprobaste en la vista actualizada que el cambio está aplicado o que no debe repetirse? Esto retirará su respaldo de la lista.')) return;
            reviewed.disabled = true;
            try { await T28Local.markReviewed(record.id); }
            catch (_) { reviewed.disabled = false; alert('No se pudo actualizar el respaldo.'); }
          };
          card.append(reviewed);
        }
        list.append(card);
      }
      if (forms.length) list.append(text('p', `${forms.length} formulario(s) de ingreso disponibles para recuperar en Movimientos.`));
      if (button.hidden && dialog.open) dialog.close();
    } catch (_) {
      button.hidden = false;
      button.textContent = 'Revisar almacenamiento local';
      list.replaceChildren(text('p', 'No se pudo leer el respaldo. Revisa el espacio disponible y los permisos de almacenamiento del navegador.'));
    }
  }
  download.onclick = async () => {
    let reviewed;
    try { reviewed = await T28Local.listReviewedOperations(); }
    catch (_) { alert('No se pudo leer el respaldo. Intenta de nuevo.'); return; }
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), operations, drafts, reviewed }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `torre28-respaldo-${Date.now()}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  T28Local.subscribe(refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('online', refresh);
  setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  refresh();
})();
