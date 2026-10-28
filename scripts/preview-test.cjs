// Isolated browser QA with synthetic data. Never forwards to Apps Script.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.T28_QA_PORT || 4173);
const receipts = new Map();
const user = { id: 'demo-user', usuario: 'demo', nombre: 'Operador de prueba', rol: 'Administrador' };
const catalog = { visitantes: [], personal: [{ id: 'p1', nombre: 'Operador de prueba' }], encargadoDia: { id: 'p1', nombre: 'Operador de prueba' }, responsableId: 'p1' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4173');
  if (url.pathname === '/api') {
    let input = ''; for await (const chunk of req) input += chunk;
    const { action, payload = {} } = JSON.parse(input || '{}');
    let body;
    if (action === 'sync.capabilities') body = {ok:true,data:{protocol:1,methods:['movimientos.crear']}};
    else if (action === 'sync.movimientos.crear') {
      const prior = receipts.get(payload.operationId);
      const saved = prior || {success:true,operationId:payload.operationId,id:require('node:crypto').randomUUID()};
      receipts.set(payload.operationId,saved);
      body={ok:true,data:{...saved,replay:Boolean(prior)}};
    }
    else if (action === 'auth.login') body = { ok: true, token: 'synthetic-local-session', usuario: user };
    else if (action === 'auth.validar') body = { ok: true, usuario: user };
    else if (action === 'auth.logout') body = { ok: true };
    else if (action === 'inicio.estacionamientos') body = { ok: true, data: [{ est: '18', empresa: 'EMPRESA DEMO', ubicacion: 'Sotano 1', ocupantes: [{ usuario: 'LIBRE', placa: '---', esVirtual: true }] }] };
    else if (action === 'inicio.catalogosIngreso' || payload.method === 'obtenerCatalogosIngresoWeb') body = { ok: true, data: catalog };
    else if (action === 'inicio.empresas') body = { ok: true, data: [{ filaIndex: 2, empresa: 'EMPRESA DEMO' }] };
    else if (payload.method === 'validarEstacionamientoDisponibleHoyWeb') body = { ok: true, data: { ocupado: false } };
    else if (action === 'rpc' && !/^obtener/.test(payload.method || '')) body = { ok: false, code: 'TEST_ERROR', error: 'Fallo simulado. Datos conservados para la prueba de recuperación.' };
    else body = { ok: true, data: [] };
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); return;
  }
  const filename = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || fs.statSync(filename).isDirectory()) { res.writeHead(404); res.end(); return; }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(filename)] || 'text/plain';
  let content = fs.readFileSync(filename);
  if (filename.endsWith('index.html')) {
    content = content.toString().replace(/<script src="\.\/js\/config\.js[^>]*><\/script>/,
      `<script>window.T28_WEB_CONFIG={apiUrl:"http://127.0.0.1:${port}/api",environment:"prueba local",backendReady:true,syncMovimientos:true};</script>`);
  }
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(content);
});
server.listen(port, '127.0.0.1', () => console.log('Synthetic preview ready on http://127.0.0.1:'+port));
