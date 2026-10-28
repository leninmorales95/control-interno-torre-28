/* Persistent recovery journal. Legacy writes are never replayed automatically:
 * the current server does not yet provide operation receipts. No session tokens
 * or administrator credentials belong in this database. */
(function () {
  'use strict';
  const DB_NAME = 'Torre28PendingWrites';
  let connection;
  let owner = '';
  const listeners = new Set();
  const scope = () => String(window.T28_WEB_CONFIG?.apiUrl || '');

  function open() {
    if (!connection) connection = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('El navegador no permite guardar los datos en este equipo.'));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('operations', { keyPath: 'id' });
        db.createObjectStore('drafts', { keyPath: 'id' });
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Cierra las otras pestañas de Torre 28 para actualizar el almacenamiento.'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); connection = null; };
        resolve(db);
      };
    }).catch(error => { connection = null; throw error; });
    return connection;
  }

  async function transaction(storeName, mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      let value;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(tx.error || new Error('No se pudo completar el guardado local.'));
      tx.onerror = () => {}; // onabort owns the final failure.
      try {
        const request = action(tx.objectStore(storeName));
        if (request) request.onsuccess = () => { value = request.result; };
      } catch (error) { tx.abort(); reject(error); }
    });
  }

  function identity() {
    if (!owner) throw new Error('Vuelve a iniciar sesión antes de guardar.');
    return { owner, scope: scope() };
  }
  const uuid = () => crypto.randomUUID();
  const belongs = (record, actor, endpoint) => record.owner === actor && record.scope === endpoint;
  let channel;
  try {
    if (window.BroadcastChannel) {
      channel = new BroadcastChannel('torre28-pending-writes');
      channel.onmessage = () => notify(false);
    }
  } catch (_) {}
  function notify(broadcast = true) {
    listeners.forEach(listener => { try { listener(); } catch (_) {} });
    if (broadcast) channel?.postMessage('changed');
  }

  async function list(storeName) {
    if (!owner) return [];
    const actor = owner, endpoint = scope();
    const records = await transaction(storeName, 'readonly', store => store.getAll());
    if (actor !== owner || endpoint !== scope()) return [];
    return records.filter(record => belongs(record, actor, endpoint)).sort((a, b) => a.createdAt - b.createdAt);
  }

  async function begin(method, args) {
    const record = { ...identity(), id: uuid(), method, args, createdAt: Date.now(), status: 'sending' };
    await transaction('operations', 'readwrite', store => store.add(record));
    notify();
    return record;
  }

  async function finish(record, error) {
    // Use the captured owner, not the account that may have signed in meanwhile.
    if (!error) {
      const db = await open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['operations','drafts'], 'readwrite');
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error || new Error('No se pudo confirmar el respaldo.'));
        tx.onerror = () => {};
        tx.objectStore('operations').delete(record.id);
        const draftId = ['sync.movimientos.crear','sync.movimientos.editar'].includes(record.method) && record.args?.[0]?._localDraftId;
        if (draftId) {
          const drafts = tx.objectStore('drafts'), request = drafts.get(draftId);
          request.onsuccess = () => {
            if (request.result && belongs(request.result, record.owner, record.scope)) drafts.delete(draftId);
          };
        }
      });
    } else {
      const updated = { ...record, leaseUntil:0, status: error.uncertain ? 'uncertain' : 'rejected', error: String(error.message || error), code: error.code || '' };
      await transaction('operations', 'readwrite', store => store.put(updated));
    }
    notify();
  }

  async function saveDraft(datos, editando) {
    const record = { ...identity(), id: uuid(), datos, editando: Boolean(editando), createdAt: Date.now() };
    await transaction('drafts', 'readwrite', store => store.add(record));
    notify();
    return record.id;
  }
  async function removeDraft(id) {
    const actor = owner, endpoint = scope();
    await transaction('drafts', 'readwrite', store => {
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result && belongs(request.result, actor, endpoint)) store.delete(id);
      };
      // Preserve the callback above; transaction completion confirms deletion.
    });
    notify();
  }
  async function markDraft(id, error) {
    const actor = owner, endpoint = scope();
    await transaction('drafts', 'readwrite', store => {
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result && belongs(request.result, actor, endpoint)) {
          store.put({ ...request.result, needsReview: true, error: String(error?.message || error || '') });
        }
      };
    });
    notify();
  }
  async function markReviewed(id) {
    const actor = owner, endpoint = scope();
    await transaction('operations', 'readwrite', store => {
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result && belongs(request.result, actor, endpoint)) {
          store.put({ ...request.result, status: 'reviewed', reviewedAt: Date.now() });
        }
      };
    });
    notify();
  }

  async function claimRetry(id) {
    const actor=owner,endpoint=scope(),now=Date.now();let claimed=false;
    await transaction('operations','readwrite',store=>{
      const request=store.get(id);
      request.onsuccess=()=>{
        const record=request.result;
        if(!record||!belongs(record,actor,endpoint)||!['sync.movimientos.crear','sync.movimientos.salida','sync.movimientos.editar','sync.movimientos.eliminar'].includes(record.method)||
          ['CONFLICT','OPERATION_MISMATCH','INVALID_OPERATION','SYNC_NOT_READY','AUTH_REQUIRED','AUTH_EXPIRED','PERMISSION_DENIED','SESSION_CHANGED','INVALID_RECEIPT','SERVER_REJECTED'].includes(record.code)||
          record.status==='reviewed'||record.leaseUntil>now||record.nextAttemptAt>now||
          record.status==='sending'&&now-record.createdAt<45000||
          record.status==='rejected'&&!['OFFLINE','BUSY','NETWORK_ERROR'].includes(record.code))return;
        const attempts=(record.attempts||0)+1;
        store.put({...record,attempts,leaseUntil:now+60000,
          nextAttemptAt:now+Math.min(300000,15000*Math.pow(2,Math.min(attempts-1,5)))});
        claimed=true;
      };
    });
    return claimed&&actor===owner&&endpoint===scope();
  }

  window.T28Local = {
    claimRetry,
    getOperation: async id => (await list('operations')).find(record => record.id === id),
    setOwner(value) { owner = String(value || ''); notify(false); },
    begin, finish, saveDraft, removeDraft, markDraft, markReviewed,
    listOperations: async () => (await list('operations')).filter(record => record.status !== 'reviewed'),
    listReviewedOperations: async () => (await list('operations')).filter(record => record.status === 'reviewed'),
    listDrafts: () => list('drafts'),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
})();
