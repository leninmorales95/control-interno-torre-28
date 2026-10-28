// Local-only transport integration: real API router + receipt helper, synthetic
// sessions and in-memory Sheets adapter. Never connects to Google or Vercel.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const tables={MOVIMIENTOS:[['id']]};
let dropNext=true, requests=0, inserts=0;
function sheet(name) {
  return {
    getLastRow:()=>tables[name].length,
    getLastColumn:()=>tables[name][0].length,
    appendRow:row=>tables[name].push([...row]),
    getRange(r,c,h=1,w=1) {return {
      getValues:()=>tables[name].slice(r-1,r-1+h).map(row=>row.slice(c-1,c-1+w)),
      setValues:rows=>rows.forEach((row,i)=>row.forEach((value,j)=>{
        if(!tables[name][r-1+i]) tables[name][r-1+i]=[];
        tables[name][r-1+i][c-1+j]=value;
      })),
      createTextFinder:value=>({
        matchEntireCell(){return this;},matchCase(){return this;},useRegularExpression(){return this;},
        findAll:()=>tables[name].slice(r-1,r-1+h).flatMap((row,i)=>String(row[c-1])===value?[{getRow:()=>r+i}]:[])
      })
    };}
  };
}
const ss={getSheetByName:name=>tables[name]?sheet(name):null,insertSheet(name){tables[name]=[];return sheet(name);}};
const context=vm.createContext({
  ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})},
  SpreadsheetApp:{getActiveSpreadsheet:()=>ss,flush(){}},
  Utilities:{getUuid:()=>crypto.randomUUID()},
  validarSesionT28:token=>token==='synthetic-local-session'?{ok:true,usuario:{id:'qa',rol:'operador',permisos:['crear']}}:{ok:false},
  t28AuthNorm_:value=>String(value||'').toLowerCase(),t28PermisosPorRol_:()=>[],
  t28MovVersion_:value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),
  t28MovConBloqueo_:fn=>fn(),
  t28MovFechas_:input=>{if(!input||isNaN(new Date(input.horaEntrada))) throw Error('Fecha inválida');},
  t28MovError_:(message,code)=>{const err=Error(message);err.t28Code=code;throw err;},
  indiceCabeceraEst_:(headers,aliases)=>headers.findIndex(h=>aliases.includes(h)),
  t28RegistrarMovimientoSinBloqueo_:input=>{
    inserts++;tables.MOVIMIENTOS.push([input._syncRecordId]);return {filaIndex:tables.MOVIMIENTOS.length};
  }
});
for(const file of ['T28_API_Actual.gs','T28_Sync.gs']) vm.runInContext(fs.readFileSync(path.join(root,'BACKEND_APPS_SCRIPT_NUEVO',file),'utf8'),context);
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4174');
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'&&url.pathname==='/stats') {
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({requests,inserts,records:tables.MOVIMIENTOS.length-1,receipts:(tables._T28_SYNC_OPERACIONES||[]).length-1}));return;
  }
  if(req.method==='POST'&&url.pathname==='/api') {
    let input='';for await(const chunk of req) input+=chunk;
    try {
      const body=JSON.parse(input);
      const output=context.t28ApiProcesarPost_(body);
      if(body.action==='sync.movimientos.crear') {
        requests++;
        if(dropNext&&JSON.parse(output.text).ok) {dropNext=false;req.socket.destroy();return;}
      }
      res.setHeader('Content-Type','application/json');res.end(output.text);
    } catch(error) {res.writeHead(500);res.end('Synthetic test error');}
    return;
  }
  const routes={'/':'tests/sync-browser.html','/js/local-store.js':'js/local-store.js','/js/api-client.js':'js/api-client.js'};
  const file=routes[url.pathname];
  if(!file){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html':'text/javascript');
  res.end(fs.readFileSync(path.join(root,file)));
});
server.listen(4174,'127.0.0.1',()=>console.log('Isolated sync QA http://127.0.0.1:4174'));
