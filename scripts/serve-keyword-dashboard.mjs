import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
const root=path.resolve("docs/prototypes/wp-ops-dashboard");
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8"};
createServer(async(req,res)=>{try{const pathname=new URL(req.url,"http://localhost").pathname;const target=path.resolve(root,`.${pathname==="/"?"/index.html":pathname}`);if(!target.startsWith(root))throw new Error("forbidden");await stat(target);res.writeHead(200,{"Content-Type":types[path.extname(target)]??"application/octet-stream","Cache-Control":"no-store"});createReadStream(target).pipe(res)}catch{res.writeHead(404);res.end("Not found")}}).listen(4173,"127.0.0.1",()=>console.log("Keyword dashboard: http://127.0.0.1:4173"));
