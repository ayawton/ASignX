import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const sharp = require('../.preview/logo-tools/node_modules/sharp')
const tracer = require('../.preview/logo-tools/node_modules/imagetracerjs')
const base = path.resolve('designs/asignx-logo-pack')
const { data, info } = await sharp(path.join(base,'source/generated-transparent-master.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const pal = [{r:0,g:0,b:0,a:0},{r:41,g:98,b:245,a:255},{r:255,g:230,b:109,a:255},{r:24,g:41,b:76,a:255}]
const indexed = new Uint8ClampedArray(info.width*info.height*4)
const bounds = { icon:[Infinity,Infinity,-Infinity,-Infinity], wordmark:[Infinity,Infinity,-Infinity,-Infinity] }
let opaque = 0, transparent = 0
for (let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
 const o=(y*info.width+x)*4; const [r,g,b,a]=data.subarray(o,o+4)
 let index=0
 if(a>150 && !(r>185 && g>185 && b>185)) {
  index=r>140 && g>120 && b<175 ? 2 : b>r*1.5 && b>135 ? 1 : 3
  const box = bounds[x<info.width*.375?'icon':'wordmark'];box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y);opaque++
 } else transparent++
 const c=pal[index];indexed.set([c.r,c.g,c.b,c.a],o)
}
const options=tracer.checkoptions({pal,colorsampling:0,numberofcolors:4,colorquantcycles:1,ltres:.05,qtres:3,rightangleenhance:false,pathomit:45,roundcoords:2,strokewidth:0,scale:1,viewbox:true,linefilter:false})
const td=tracer.imagedataToTracedata({width:info.width,height:info.height,data:indexed},options)
const shapes=[]
for(let layer=1;layer<td.layers.length;layer++) for(let i=0;i<td.layers[layer].length;i++) {
 const p=td.layers[layer][i]; if(p.isholepath) continue
 const svg=tracer.svgpathstring(td,layer,i,options)
 const d=svg.match(/ d="([^"]+)"/)?.[1]; if(!d) continue
 const part=layer===3?'wordmark':'icon'
 shapes.push({part,color:layer,d})
}
const master={width:info.width,height:info.height,bounds,shapes,colors:['transparent','#2962F5','#FFE66D','#18294C']}
await fs.writeFile(path.join(base,'source/vector-paths.json'),JSON.stringify(master,null,2))
const both=[Math.min(bounds.icon[0],bounds.wordmark[0]),Math.min(bounds.icon[1],bounds.wordmark[1]),Math.max(bounds.icon[2],bounds.wordmark[2]),Math.max(bounds.icon[3],bounds.wordmark[3])]
const w=both[2]-both[0]+80,h=both[3]-both[1]+80
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="white"/><g transform="translate(${40-both[0]} ${40-both[1]})">${shapes.map(s=>`<path fill="${master.colors[s.color]}" d="${s.d}"/>`).join('')}</g></svg>`
await sharp(Buffer.from(svg)).resize({width:1600}).png().toFile(path.join(base,'previews/vector-master-check.png'))
console.log(JSON.stringify({dimensions:info,bounds,shapes:shapes.length,opaque,transparent}))


