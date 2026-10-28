/* Receipt-backed movements only. No replay of legacy RPC writes. */
(function(){
 'use strict';
 let running=false;
 async function tick(){
  if(running||(window.T28_WEB_CONFIG?.autoSyncMovimientos!==true&&window.T28_WEB_CONFIG?.autoSyncSalidas!==true&&window.T28_WEB_CONFIG?.autoSyncEdiciones!==true&&window.T28_WEB_CONFIG?.autoSyncEliminaciones!==true)||
    navigator.onLine===false||document.hidden||!window.T28Local||!window.T28Api)return;
  const session=localStorage.getItem('torre28_auth_token');if(!session)return;
  running=true;
  try{
   const capabilities=await T28Api.syncCapabilities();
   if(capabilities.data?.protocol!==1||!Array.isArray(capabilities.data?.methods))return;
   const records=await T28Local.listOperations();
   const blockedRecords=new Set();
   for(const record of records){
    // Never overtake an earlier unresolved write to the same movement.
    // Legacy failures also block: they may already have reached Google.
    const target=String(record.args?.[0]?.id||'');
    if(target&&blockedRecords.has(target))continue;
    if(target)blockedRecords.add(target);
    const adapters={
     'sync.movimientos.crear':['autoSyncMovimientos','movimientos.crear','reintentarMovimientoSeguro'],
     'sync.movimientos.salida':['autoSyncSalidas','movimientos.salida','reintentarSalidaSegura'],
     'sync.movimientos.editar':['autoSyncEdiciones','movimientos.editar','reintentarEdicionSegura'],
     'sync.movimientos.eliminar':['autoSyncEliminaciones','movimientos.eliminar','reintentarEliminacionSegura']
    };
    const adapter=adapters[record.method];
    if(!adapter||window.T28_WEB_CONFIG?.[adapter[0]]!==true||!capabilities.data.methods.includes(adapter[1]))continue;
    if(localStorage.getItem('torre28_auth_token')!==session||navigator.onLine===false)break;
    if(!await T28Local.claimRetry(record.id))continue;
    try{
     await T28Api[adapter[2]](record.id);
     if(target)blockedRecords.delete(target);
     if(typeof refrescarIngresosLocalesT28==='function')await refrescarIngresosLocalesT28();
     if(typeof cargarHistorialHoy==='function')cargarHistorialHoy(true);
    }catch(error){
     if(['AUTH_REQUIRED','AUTH_EXPIRED','SESSION_CHANGED','PERMISSION_DENIED'].includes(error.code))break;
    }
   }
  }catch(_){/* Pending records stay durable; the next bounded tick tries again. */}
  finally{running=false;}
 }
 window.addEventListener('online',tick);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
 setInterval(tick,30000);
 // Delayed first tick avoids competing with the normal startup reads.
 setTimeout(tick,3000);
})();
