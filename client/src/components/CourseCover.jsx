import { useId } from 'react'
import './CourseCover.css'
import { coverPalettes, coverLayouts } from './coverOptions'
import { coverFonts } from './coverFonts'

export default function CourseCover({ course }) {
 const patternId = useId()
 const text = course.cover_text || course.title?.slice(0,32) || 'ASL'
 const palette = coverPalettes.find(([key])=>key===course.cover_tone) || coverPalettes[0]
 const layout = coverLayouts.some(([key])=>key===course.cover_style) ? course.cover_style : 'plain'
 const font = coverFonts.find(font => font.value === course.cover_font) || coverFonts[0]
 const weight = ['400','600','700'].includes(course.cover_weight) ? course.cover_weight : '600'
 const wordWidth = Math.max(40, text.length * 23)
 const size = Math.min(180,Math.max(60,Number(course.cover_size) || 100))
 const angle = Number.isFinite(course.cover_angle) ? Math.min(45,Math.max(-45,course.cover_angle)) : -18
 const density = Math.min(5,Math.max(1,Number(course.cover_density) || 5))
 const zoom = 1 + (5-density)*.5
 const tileWidth = wordWidth + 12
 const rowHeight = 44
 // Scale the entire tightly packed tile: fewer words zooms in, more zooms out.
 const offsets = [.08, .57, .26, .79]
 return <div className={`course-cover cover-layout-${layout}`} aria-hidden="true" style={{"--cover-font":font.family,"--cover-weight":weight,"--cover-size":size,"--cover-bg":palette[2],"--cover-fg":palette[3]}}>
  {course.cover_style === 'pattern' && <svg className="course-cover-pattern" width="100%" height="100%"><defs><pattern id={patternId} width={tileWidth} height={rowHeight*4} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle}) scale(${zoom})`}>
   {offsets.map((offset,row) => [-1,0,1].map(copy => <text key={`${row}:${copy}`} x={(offset+copy)*tileWidth} y={row*rowHeight+35} fill="currentColor" fontFamily={font.family} fontSize="42" fontWeight={weight} textLength={wordWidth} lengthAdjust="spacingAndGlyphs">{text}</text>))}
  </pattern></defs><rect width="100%" height="100%" fill={`url(#${patternId})`}/></svg>}
  {layout==='corner' && <span className="course-cover-echo">{text}</span>}
  <strong>{text}</strong>
 </div>
}
