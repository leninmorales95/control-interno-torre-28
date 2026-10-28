// TEST ONLY: real authentication/receipt writes to the copied Google project;
// fictional catalogs. Never import this configuration in the production build.
window.T28_WEB_CONFIG={apiUrl:'https://script.google.com/macros/s/AKfycbw-PhXN9lp5QaqsirmvM-wf4AkU0P_C0-VzQlNkkPDh5mx0AITNvzoS1CuyQLRlbFXhZg/exec',syncMovimientos:true,syncSalidas:true,syncEdiciones:true,stagingRealPull:true,environment:'COPIA DE PRUEBAS',backendReady:true};
(function(){
 const transport=window.fetch.bind(window),confirmed=[];
 const catalog={visitantes:[],personal:[{id:'qa',nombre:'Prueba aislada'}],encargadoDia:{id:'qa',nombre:'Prueba aislada'},responsableId:'qa'};
 window.fetch=async function(url,options){
  if(String(url)!==T28_WEB_CONFIG.apiUrl)return transport(url,options);
  const body=JSON.parse(options?.body||'{}'),action=body.action,payload=body.payload||{};
  const reply=data=>new Response(JSON.stringify({ok:true,data}),{status:200,headers:{'Content-Type':'application/json'}});
  if(action.startsWith('auth.')||action==='sync.capabilities')return transport(url,options);
  if(['sync.movimientos.salida','sync.movimientos.editar'].includes(action))return transport(url,options);
  if(action==='sync.movimientos.crear'){
   const response=await transport(url,options),result=await response.clone().json();
   if(result.ok&&result.data?.success&&!confirmed.some(item=>item.id===result.data.id)){
    const data=payload.datos;
    confirmed.push({id:result.data.id,filaIndex:result.data.filaIndex,placa:data.placa,nombre:data.nombre,empresa:data.empresa,est:data.estacionamiento,tipoIngreso:data.tipoIngreso,horaEntrada:data.horaEntrada,horaSalida:'---',estado:'Abierto',registradoPor:data.registradoPorNombre,observaciones:data.observaciones});
   }
   return response;
  }
  if(action==='inicio.movimientosHoy'||payload.method==='obtenerMovimientosHoy'){
   // Explicit opt-in only after staging gateway deployment has been updated.
   // Never present the in-memory fixture as a verified Google pull.
   if(T28_WEB_CONFIG.stagingRealPull===true){
    return transport(url,{...options,body:JSON.stringify({...body,action:'inicio.movimientosHoy',payload:{}})});
   }
   return reply(confirmed);
  }
  if(action==='inicio.estacionamientos')return reply([{est:'18',empresa:'EMPRESA DEMO',ubicacion:'Sotano 1',ocupantes:[{usuario:'LIBRE',placa:'---',esVirtual:true}]}]);
  if(action==='inicio.catalogosIngreso'||payload.method==='obtenerCatalogosIngresoWeb')return reply(catalog);
  if(action==='inicio.empresas')return reply([{filaIndex:2,empresa:'EMPRESA DEMO'}]);
  if(payload.method==='validarEstacionamientoDisponibleHoyWeb')return reply({ocupado:false});
  if(action.startsWith('inicio.')||action==='rpc'&&/^obtener/.test(payload.method||''))return reply([]);
  return new Response(JSON.stringify({ok:false,code:'STAGING_ROUTE_DISABLED',error:'Solo se permite crear ingresos de prueba en esta vista.'}),{status:200});
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const notice=document.createElement('div');notice.textContent='PRUEBAS · Catálogos ficticios · Ingresos en la copia de Google · No es producción';
  notice.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#fff3cd;color:#513c00;text-align:center;font:12px system-ui;padding:5px;pointer-events:none';document.body.append(notice);
 });
})();
