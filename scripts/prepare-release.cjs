// Produce exact, reviewable production backend sources without deploying.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const output=path.resolve(root,'../outputs/release-movimientos');
fs.mkdirSync(output,{recursive:true});
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const files={
 'T28_Movimientos.gs':[
  'BACKEND_APPS_SCRIPT_NUEVO/T28_Movimientos.gs',
  'BACKEND_APPS_SCRIPT_NUEVO/T28_Sync.gs',
  'BACKEND_APPS_SCRIPT_NUEVO/T28_Sync_Salidas.gs'
 ].map(read).join('\n\n'),
 'T28_API.gs':read('BACKEND_APPS_SCRIPT_NUEVO/T28_API_Actual.gs')
};
for(const [name,content] of Object.entries(files)){
 if(/1umHzP2JlzJfoRdSQOah7lHSPQJWQesXT|t28StagingExigirRuta_|probarSyncMovimientosAisladoT28/.test(content))throw Error('Test code in production bundle: '+name);
 fs.writeFileSync(path.join(output,name),content);
}
const manifest={preparedAt:new Date().toISOString(),deployed:false,files:Object.fromEntries(Object.entries(files).map(([name,content])=>[name,{bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex')}]))};
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
console.log('Production backend bundle prepared: '+output);
