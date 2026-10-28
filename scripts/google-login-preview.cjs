// Serves local test UI only. Authentication goes directly from browser to
// the explicitly configured Google staging API, never through this server.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const routes={'/':'tests/google-sync-login.html','/js/local-store.js':'js/local-store.js','/js/api-client.js':'js/api-client.js'};
http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://127.0.0.1:4175').pathname;
 const file=routes[pathname]||(pathname==='/panel'?'index.html':'.'+pathname);
 const target=path.resolve(root,file);
 if(req.method!=='GET'||!target.startsWith(root+path.sep)||!fs.existsSync(target)||fs.statSync(target).isDirectory()){res.writeHead(404);res.end();return;}
 let content=fs.readFileSync(target);
 if(pathname==='/panel')content=content.toString().replace(/<script src="\.\/js\/config\.js[^>]*><\/script>/,'<script src="/tests/panel-google-config.js"></script>');
 const type={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'}[path.extname(target)]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});
 res.end(content);
}).listen(4175,'127.0.0.1',()=>console.log('Google staging login http://127.0.0.1:4175'));
