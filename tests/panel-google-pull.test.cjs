const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('real pull preserves session and calls Google instead of the memory fixture',async()=>{
 const calls=[];
 const context=vm.createContext({Response,document:{addEventListener(){}},fetch:async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body)});
  return new Response(JSON.stringify({ok:true,data:[{id:'remote-only'}]}));
 }});context.window=context;
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../tests/panel-google-config.js'),'utf8'),context);
 context.T28_WEB_CONFIG.stagingRealPull=true;
 const response=await context.fetch(context.T28_WEB_CONFIG.apiUrl,{method:'POST',body:JSON.stringify({action:'rpc',token:'session-only-in-memory',payload:{method:'obtenerMovimientosHoy',args:[]}})});
 assert.equal((await response.json()).data[0].id,'remote-only');
 assert.equal(calls.length,1);assert.equal(calls[0].body.action,'inicio.movimientosHoy');
 assert.equal(calls[0].body.token,'session-only-in-memory');
});
