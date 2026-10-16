
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),preview=path.dirname(here),repo=path.resolve(preview,'../..'),landing=path.join(repo,'landing');
const require=createRequire(path.join(landing,'package.json'));
const {createServer,build}=await import(pathToFileURL(require.resolve('vite')).href);
const {default:react}=await import(pathToFileURL(require.resolve('@vitejs/plugin-react')).href);
const {default:tailwind}=await import(pathToFileURL(require.resolve('@tailwindcss/vite')).href);
const normalize=s=>s.replaceAll('\\','/');
const overrides={'components/Footer':path.join(here,'Footer.tsx'),'services/landingAnalytics':path.join(here,'analytics.ts')};
const plugin={
 name:'isolated-redesign',enforce:'pre',
 resolveId(id,importer){
   for(const [suffix,target] of Object.entries(overrides))if(id.replace(/\.tsx?$/,'').endsWith(suffix))return target;
   if(id==='./App'&&normalize(importer||'').endsWith('/landing/src/main.tsx'))return path.join(here,'Home.tsx');
 },
 transform(code,id){
   id=normalize(id);
   if(id.endsWith('/landing/src/index.css'))code='@source '+JSON.stringify(normalize(path.join(landing,'src')))+';\n'+code;
   if(id.endsWith('/landing/src/main.tsx'))code=code.replace('<LandingAnalyticsTracker />','');
   if(id.endsWith('/components/Header.tsx'))code=code.replace('fixed top-0 left-0 right-0 z-50','preview-header fixed top-0 left-0 right-0 z-50');
   if(/\/pages\/(PricingPage|PrivacyPage|TermsPage)\.tsx$/.test(id)){
     code="import {Header as PreviewHeader} from '@/components/Header';\nimport {Footer as PreviewFooter} from '@/components/Footer';\n"+code;
     code=code.replace(/<header\b[\s\S]*?<\/header>/,'<PreviewHeader />').replace(/<footer\b[\s\S]*?<\/footer>/,'<PreviewFooter />');
   }
   if(id.endsWith('/seo/SeoMarketingPage.tsx')){
     code=code.replace('<article className="','<article className="editorial-page ');
     code=code.replace('className="mt-16"','className="related-section"')
       .replace('className="text-xl font-bold text-white mb-4"','className="related-heading"')
       .replace('className="grid sm:grid-cols-2 gap-3"','className="related-links"')
       .replace('className="p-4 rounded-xl border border-[#1f1f23] bg-[#141416] hover:border-white/15 transition-colors"','className="related-link"')
       .replace('<div className="text-white font-medium mb-1">{item.title.split(\'|\')[0].trim()}</div>','<span className="related-kind">{item.type === "pillar" ? "Product" : item.type === "authority" ? "Read more" : item.type}</span><div className="related-title">{item.title.split(\'|\')[0].trim()}<span aria-hidden="true">↗</span></div>')
       .replace('className="text-sm text-zinc-500 line-clamp-2"','className="related-description"');
   }
   return code;
 },
 configureServer(server){
   server.middlewares.use((req,res,next)=>{
     const url=new URL(req.url,'http://localhost'),p=url.pathname;
     if(p==='/'||p==='/isometric.html'){
       res.setHeader('Content-Type','text/html');res.setHeader('Cache-Control','no-store');
       res.end(fs.readFileSync(path.join(preview,'isometric.html'),'utf8'));return;
     }
     if(p.startsWith('/prototype/')){
       const file=path.resolve(preview,'.'+p.slice('/prototype'.length));
       if(!file.startsWith(preview+path.sep)){res.writeHead(403).end();return;}
       if(!fs.existsSync(file)||!fs.statSync(file).isFile()){next();return;}
       const mime={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/jpeg','.jpg':'image/jpeg','.ttf':'font/ttf','.json':'application/json'};
       res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');res.setHeader('Cache-Control','no-store');
       fs.createReadStream(file).pipe(res);return;
     }
     next();
   });
 }
};
const config={
 configFile:false,root:here,publicDir:path.join(landing,'public'),
 plugins:[plugin,react(),tailwind()],
 resolve:{alias:{'@':path.join(landing,'src'),'@clippster/app-tour':path.join(repo,'packages/app-tour/src/index.ts')},dedupe:['react','react-dom']},
 css:{devSourcemap:true},
 server:{host:'127.0.0.1',port:4186,strictPort:true,fs:{allow:[repo]},proxy:{'/api':{target:'https://api.clippster.app',changeOrigin:true}}},
 optimizeDeps:{include:['react','react-dom/client','react-router-dom'],exclude:[]},
 build:{outDir:path.join(preview,'site-build'),emptyOutDir:true},
};
if(process.argv.includes('--build')){await build(config);const dest=path.join(preview,'site-build');for(const name of ['assets','captures','workflow.js','workflow.css','landing-source.js','landing-content.js','landing-content.css','header.js','downloads.js','shared-shell.js','shell.css','content-coverage.json','page-parity.json','evidence.md']){fs.cpSync(path.join(preview,name),path.join(dest,'prototype',name),{recursive:true});}fs.copyFileSync(path.join(preview,'isometric.html'),path.join(dest,'isometric.html'));}
else {const server=await createServer(config);await server.listen();server.printUrls();}
