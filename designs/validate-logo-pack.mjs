import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const sharp=require('../.preview/logo-tools/node_modules/sharp')
const canvas=require('../.preview/logo-tools/node_modules/@napi-rs/canvas')
globalThis.DOMMatrix=canvas.DOMMatrix;globalThis.Path2D=canvas.Path2D;globalThis.ImageData=canvas.ImageData
const pdfjs=await import('../.preview/logo-tools/node_modules/pdfjs-dist/legacy/build/pdf.mjs')
const base=path.resolve('designs/asignx-logo-pack')
const manifest=JSON.parse(await fs.readFile(path.join(base,'manifest.json'),'utf8'))
const images=[]
let pdfs=0,svgs=0,pngs=0
for(const item of manifest.layouts){
 const stem=`asignx-${item.layout}-${item.variant}`,dir=path.join(base,item.folder)
 const svg=await fs.readFile(path.join(dir,stem+'.svg'),'utf8')
 if(/<(?:image|text)\b/.test(svg))throw Error('SVG contains raster or font dependencies')
 if(!svg.includes('<path'))throw Error('No vector paths')
 svgs++
 const bytes=new Uint8Array(await fs.readFile(path.join(dir,stem+'.pdf')))
 const doc=await pdfjs.getDocument({data:bytes,useSystemFonts:true,isEvalSupported:false}).promise
 if(doc.numPages!==1)throw Error('Expected single page PDF')
 const page=await doc.getPage(1);const viewport=page.getViewport({scale:Math.min(640/item.width,360/item.height)})
 const surf=canvas.createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),ctx=surf.getContext('2d')
 const bg=['white','reverse'].includes(item.variant)?'#18294C':'#FFFFFF'
 await page.render({canvasContext:ctx,viewport,background:bg}).promise
 const png=surf.toBuffer('image/png')
 const proof=path.join(base,'previews',`pdf-${item.layout}-${item.variant}.png`);await fs.writeFile(proof,png)
 const thumb=await sharp(png).resize({width:640,height:360,fit:'contain',background:bg}).png().toBuffer()
 const caption=`<svg width="680" height="420"><rect width="680" height="420" fill="${bg}"/><text x="20" y="30" font-family="Arial" font-size="16" fill="${bg==='#FFFFFF'?'#60708B':'#B4C5E2'}">PDF / ${item.layout} / ${item.variant}</text></svg>`
 images.push(await sharp(Buffer.from(caption)).composite([{input:thumb,left:20,top:50}]).png().toBuffer())
 const op=await page.getOperatorList();if(!op.fnArray.length)throw Error('Empty PDF')
 for(const f of await fs.readdir(dir)){if(f.endsWith('.png')){const m=await sharp(path.join(dir,f)).metadata();if(!m.hasAlpha)throw Error('PNG is missing transparency');pngs++}}
 await doc.cleanup?.();pdfs++
}
await sharp({create:{width:680*6,height:420*4,channels:4,background:'#E0E7F2'}}).composite(images.map((input,i)=>({input,left:i%6*680,top:Math.floor(i/6)*420}))).png().toFile(path.join(base,'previews/pdf-proof-sheet.png'))
for(const name of ['light','dark','blue']){const ico=await fs.readFile(path.join(base,'app-icons',`favicon-${name}.ico`));if(ico.readUInt16LE(2)!==1||ico.readUInt16LE(4)!==6)throw Error('Invalid ICO');const icns=await fs.readFile(path.join(base,'app-icons',`app-icon-${name}.icns`));if(icns.toString('ascii',0,4)!=='icns'||icns.readUInt32BE(4)!==icns.length)throw Error('Invalid ICNS')}
const report={svgs,pdfs,transparentPngs:pngs,icoFiles:3,icnsFiles:3,result:'PASS',checks:['SVGs contain true vector paths and no raster or font dependencies','All PDFs opened and rendered with PDF.js','All raster logo PNGs have alpha channels','ICO and ICNS structures are valid']}
await fs.writeFile(path.join(base,'VALIDATION.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))

