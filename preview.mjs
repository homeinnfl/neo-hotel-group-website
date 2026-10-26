import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import handler from './netlify/functions/events.mjs';
const root=path.resolve('public');
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:4174');
    if(url.pathname==='/.netlify/functions/events'){
      const response=await handler(new Request(url,{method:req.method}));
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
    const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(4174,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4174/events.html'));
