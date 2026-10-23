import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const sharp=require('../.preview/logo-tools/node_modules/sharp')
const PDFDocument=require('../.preview/logo-tools/node_modules/pdfkit/js/pdfkit.js')
const SVGtoPDF=require('../.preview/logo-tools/node_modules/svg-to-pdfkit')
const base=path.resolve('designs/asignx-logo-pack')
const master=JSON.parse(await fs.readFile(path.join(base,'source/vector-paths.json'),'utf8'))
const {shapes,bounds}=master
const width=b=>b[2]-b[0]+1,height=b=>b[3]-b[1]+1
const iw=width(bounds.icon),ih=height(bounds.icon),ww=width(bounds.wordmark),wh=height(bounds.wordmark)
const colors={color:['','#2962F5','#FFE66D','#18294C'],reverse:['','#2962F5','#FFE66D','#FFFFFF'],navy:['','#18294C','#18294C','#18294C'],cobalt:['','#2962F5','#2962F5','#2962F5'],black:['','#000000','#000000','#000000'],white:['','#FFFFFF','#FFFFFF','#FFFFFF']}
function group(part,scale,x,y){return{part,scale,tx:x-bounds[part][0]*scale,ty:y-bounds[part][1]*scale}}
const top=Math.min(bounds.icon[1],bounds.wordmark[1]),bottom=Math.max(bounds.icon[3],bounds.wordmark[3])
const layouts={
 horizontal:{w:bounds.wordmark[2]-bounds.icon[0]+161,h:bottom-top+161,groups:[group('icon',1,80,bounds.icon[1]-top+80),group('wordmark',1,bounds.wordmark[0]-bounds.icon[0]+80,bounds.wordmark[1]-top+80)]},
 stacked:{w:1200,h:1000,groups:[group('icon',720/iw,240,70),group('wordmark',1000/ww,100,630)]},
 symbol:{w:iw+160,h:ih+160,groups:[group('icon',1,80,80)]},
 wordmark:{w:ww+140,h:wh+140,groups:[group('wordmark',1,70,70)]},
}
function svgFor(layout,variant,bg){return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.w}" height="${layout.h}" viewBox="0 0 ${layout.w} ${layout.h}" role="img" aria-label="ASignX logo"><title>ASignX AX monogram logo</title>${bg?`<rect width="${layout.w}" height="${layout.h}" fill="${bg}"/>`:''}${layout.groups.map(g=>`<g transform="translate(${g.tx} ${g.ty}) scale(${g.scale})">${shapes.filter(s=>s.part===g.part).map(s=>`<path fill="${colors[variant][s.color]}" fill-rule="evenodd" d="${s.d}"/>`).join('')}</g>`).join('')}</svg>`}
function epsPath(d){const t=d.match(/[MLQZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);let i=0,x=0,y=0,out='';while(i<t.length){let c=t[i++].toUpperCase();if(c==='M'||c==='L'){x=+t[i++];y=+t[i++];out+=`${x} ${y} ${c==='M'?'moveto':'lineto'}\n`}else if(c==='Q'){let qx=+t[i++],qy=+t[i++],ex=+t[i++],ey=+t[i++];out+=`${x+2/3*(qx-x)} ${y+2/3*(qy-y)} ${ex+2/3*(qx-ex)} ${ey+2/3*(qy-ey)} ${ex} ${ey} curveto\n`;x=ex;y=ey}else if(c==='Z')out+='closepath\n';else throw new Error(`Unexpected path command ${c}`)}return out}
function epsFor(layout,variant){let o=`%!PS-Adobe-3.0 EPSF-3.0\n%%Title: ASignX ${variant}\n%%Creator: ASignX vector export\n%%BoundingBox: 0 0 ${Math.ceil(layout.w)} ${Math.ceil(layout.h)}\n%%HiResBoundingBox: 0 0 ${layout.w} ${layout.h}\n%%LanguageLevel: 2\n%%EndComments\ngsave\n0 ${layout.h} translate\n1 -1 scale\n`;for(const g of layout.groups){o+=`gsave\n${g.tx} ${g.ty} translate\n${g.scale} ${g.scale} scale\n`;for(const s of shapes.filter(s=>s.part===g.part)){const c=colors[variant][s.color];const rgb=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255);o+=`${rgb.join(' ')} setrgbcolor\nnewpath\n${epsPath(s.d)}eofill\n`}o+='grestore\n'}return o+'grestore\nshowpage\n%%EOF\n'}
async function pdfFor(svg,file,w,h){const doc=new PDFDocument({size:[w,h],margin:0,info:{Title:'ASignX AX logo',Author:'ASignX',Subject:'Scalable logo artwork; outlined paths; RGB colors'}});const chunks=[];doc.on('data',b=>chunks.push(b));const end=new Promise((resolve,reject)=>{doc.on('end',resolve);doc.on('error',reject)});SVGtoPDF(doc,svg,0,0,{width:w,height:h,assumePt:true});doc.end();await end;await fs.writeFile(file,Buffer.concat(chunks))}
const manifest=[]
for(const [name,layout] of Object.entries(layouts))for(const variant of Object.keys(colors)){
 const dir=path.join(base,'exports',name,variant);await fs.mkdir(dir,{recursive:true})
 const stem=`asignx-${name}-${variant}`,svg=svgFor(layout,variant),bg=['white','reverse'].includes(variant)?'#18294C':'#FFFFFF'
 await fs.writeFile(path.join(dir,stem+'.svg'),svg)
 await fs.writeFile(path.join(dir,stem+'.eps'),epsFor(layout,variant))
 await pdfFor(svg,path.join(dir,stem+'.pdf'),layout.w,layout.h)
 const sizes=name==='symbol'?[256,512,1024,2048]:[512,1024,2048,4096]
 for(const size of sizes)await sharp(Buffer.from(svg)).resize({width:size}).withMetadata({density:300}).png().toFile(path.join(dir,`${stem}-${size}.png`))
 await sharp(Buffer.from(svg)).resize({width:2048}).webp({lossless:true}).toFile(path.join(dir,stem+'.webp'))
 await sharp(Buffer.from(svgFor(layout,variant,bg))).resize({width:2048}).jpeg({quality:98,chromaSubsampling:'4:4:4'}).toFile(path.join(dir,stem+'.jpg'))
 await sharp(Buffer.from(svg)).resize({width:4096}).withMetadata({density:300}).tiff({compression:'lzw'}).toFile(path.join(dir,stem+'.tiff'))
 manifest.push({layout:name,variant,width:layout.w,height:layout.h,folder:`exports/${name}/${variant}`,formats:['svg','eps','pdf','png','webp','jpg','tiff']})
 console.log(`Exported ${name}/${variant}`)
}
const appLayout={w:1024,h:1024,groups:[group('icon',820/iw,102,(1024-ih*820/iw)/2)]}
const apps=[['light','color','#FFFFFF'],['dark','reverse','#18294C'],['blue','white','#2962F5']]
const appdir=path.join(base,'app-icons');await fs.mkdir(appdir,{recursive:true})
for(const [name,variant,bg] of apps){const svg=svgFor(appLayout,variant,bg);await fs.writeFile(path.join(appdir,`app-icon-${name}.svg`),svg);for(const n of [16,32,48,64,128,180,192,256,512,1024])await sharp(Buffer.from(svg)).resize(n,n).png().toFile(path.join(appdir,`app-icon-${name}-${n}.png`))}
function ico(pngs,sizes){const head=Buffer.alloc(6);head.writeUInt16LE(1,2);head.writeUInt16LE(pngs.length,4);let offset=6+16*pngs.length;const entries=pngs.map((p,i)=>{const e=Buffer.alloc(16);e[0]=sizes[i]===256?0:sizes[i];e[1]=e[0];e.writeUInt16LE(1,4);e.writeUInt16LE(32,6);e.writeUInt32LE(p.length,8);e.writeUInt32LE(offset,12);offset+=p.length;return e});return Buffer.concat([head,...entries,...pngs])}
for(const [name]of apps){const sizes=[16,32,48,64,128,256],pngs=await Promise.all(sizes.map(n=>fs.readFile(path.join(appdir,`app-icon-${name}-${n}.png`))));await fs.writeFile(path.join(appdir,`favicon-${name}.ico`),ico(pngs,sizes));const types=[['ic07',128],['ic08',256],['ic09',512],['ic10',1024]];const chunks=[];for(const[type,n]of types){const p=await fs.readFile(path.join(appdir,`app-icon-${name}-${n}.png`));const h=Buffer.alloc(8);h.write(type);h.writeUInt32BE(p.length+8,4);chunks.push(h,p)}const h=Buffer.alloc(8);h.write('icns');h.writeUInt32BE(8+chunks.reduce((s,b)=>s+b.length,0),4);await fs.writeFile(path.join(appdir,`app-icon-${name}.icns`),Buffer.concat([h,...chunks]))}
await fs.copyFile(path.join(appdir,'app-icon-light-180.png'),path.join(appdir,'apple-touch-icon.png'))
await fs.writeFile(path.join(appdir,'site.webmanifest'),JSON.stringify({name:'ASignX',short_name:'ASignX',start_url:'/',display:'standalone',theme_color:'#2962F5',background_color:'#FFFFFF',icons:[192,512].map(n=>({src:`app-icon-light-${n}.png`,sizes:`${n}x${n}`,type:'image/png',purpose:'any'}))},null,2))
const maskLayout={w:1024,h:1024,groups:[group('icon',620/iw,202,(1024-ih*620/iw)/2)]}
for(const n of [192,512])await sharp(Buffer.from(svgFor(maskLayout,'color','#FFFFFF'))).resize(n,n).png().toFile(path.join(appdir,`app-icon-maskable-${n}.png`))
const tiles=[];const tileW=720,tileH=420
for(const name of ['horizontal','stacked','symbol','wordmark'])for(const variant of ['color','reverse','black','white']){const l=layouts[name],bg=['reverse','white'].includes(variant)?'#18294C':'#FFFFFF';const art=await sharp(Buffer.from(svgFor(l,variant,bg))).resize({width:620,height:300,fit:'contain',background:bg}).png().toBuffer();const label=`<svg width="720" height="420"><rect width="720" height="420" fill="${bg}"/><text x="30" y="34" font-family="Arial,sans-serif" font-size="17" fill="${bg==='#FFFFFF'?'#60708B':'#B4C5E2'}">${name} / ${variant}</text></svg>`;const tile=await sharp(Buffer.from(label)).composite([{input:art,left:50,top:70}]).png().toBuffer();tiles.push(tile)}
await sharp({create:{width:tileW*4,height:tileH*4,channels:4,background:'#E8EDF5'}}).composite(tiles.map((input,i)=>({input,left:i%4*tileW,top:Math.floor(i/4)*tileH}))).png().toFile(path.join(base,'previews/logo-pack-overview.png'))
await fs.writeFile(path.join(base,'manifest.json'),JSON.stringify({generated:'2026-10-19',source:'Selected option 2, AX monogram',layouts:manifest,colors:master.colors.slice(1)},null,2))
console.log('Logo exports and app icons complete.')

