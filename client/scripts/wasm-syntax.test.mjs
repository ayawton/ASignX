import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createWasmSyntaxEngine } from '../src/recognition/nlp/wasmSyntaxEngine.js'

const unigrams = readFileSync(new URL('../public/dictionary/english-frequency.txt', import.meta.url), 'utf8')
const bigrams = readFileSync(new URL('../public/dictionary/english-bigrams.txt', import.meta.url), 'utf8')
const wasmBytes = readFileSync(new URL('../src/recognition/nlp/wasm/nlp_wasm_bg.wasm', import.meta.url))

const engine = await createWasmSyntaxEngine({ unigrams, bigrams, wasmBytes })

try {
 // Word-stage handshape + transposition + fragment joining
 assert.equal(engine.suggestWord('HXLLO').suggestions[0].text, 'HELLO')
 assert.equal(engine.suggestWord('HLELO').suggestions[0].text, 'HELLO')
 assert.equal(engine.suggestWord('RECOGNITN').suggestions[0].text, 'RECOGNITION')
 assert.equal(engine.suggestWord('WOORRLLDD').suggestions[0].text, 'WORLD')
 assert.equal(engine.suggestWord('LO', [{ detected: 'HEL', text: 'HEL' }]).suggestions[0].joinPrevious, 1)
 assert.equal(engine.suggestWord('QZXQ').suggestions.length, 0)

 // Sentence-stage spelling syntaxing: joint word separation + letter fixing + grammar context
 for (const [raw, prov, expected] of [
  ['HE L LO T HE R E', 'HE L LO T HE R E', 'HELLO THERE'],
  ['HELLOWROLD', 'HELLOWROLD', 'HELLO WORLD'],
  ['IAMGOIGN', 'IAMGOIGN', 'I AM GOING'],
  ['HOWAREYOU', 'HOWAREYOU', 'HOW ARE YOU'],
  ['HXLLO FORM WORK', 'HELLO FORM WORK', 'HELLO FROM WORK'],
  ['HELLO W OORRLLDD', 'HELLO W OORRLLDD', 'HELLO WORLD'],
  ['HELLOWOORRLLDD', 'HELLOWOORRLLDD', 'HELLO WORLD'],
  ['HHEELLLLOO', 'HHEELLLLOO', 'HELLO'],
  ['THE ME', 'THE ME', 'THE ME'],
  ['THE RAPIST', 'THE RAPIST', 'THE RAPIST'],
  ['IN SIDE', 'IN SIDE', 'IN SIDE'],
  ['GOOD BYE', 'GOOD BYE', 'GOOD BYE'],
  ['A WAY', 'A WAY', 'A WAY'],
  ['QZXQ', 'QZXQ', 'QZXQ'],
 ]) {
  const result = engine.syntaxSentence(raw, prov)
  assert.equal(result.engine, 'symspell-wasm')
  assert.equal(result.suggestions[0].text, expected, `Expected "${raw}" -> "${expected}", got "${result.suggestions[0]?.text}"`)
 }

 // Structured group metadata: whole signs remain atomic and block backward letter joining
 assert.equal(
  engine.suggestWord('LO', [
   { detected: 'HEL', text: 'HEL' },
   { detected: 'HELP', text: 'HELP', wholeSign: true, confidence: 0.95 },
  ]).suggestions.every(item => item.joinPrevious == null),
  true,
 )
 const mixed = engine.syntaxSentence('HXLLO THANK YOU FRMO WORK', 'HELLO THANK YOU FROM WORK', [
  { detected: 'HXLLO', text: 'HELLO' },
  { detected: 'THANK YOU', text: 'THANK YOU', wholeSign: true, confidence: 0.96 },
  { detected: 'FRMO', text: 'FROM' },
  { detected: 'WORK', text: 'WORK' },
 ])
 assert.equal(mixed.suggestions[0].text, 'HELLO THANK YOU FROM WORK')
 const unbridged = engine.syntaxSentence('HEL THANK YOU', 'HEL THANK YOU', [
  { detected: 'HEL', text: 'HEL' },
  { detected: 'THANK YOU', text: 'THANK YOU', wholeSign: true, confidence: 0.97 },
 ])
 assert.equal(unbridged.suggestions[0].text, 'HEL THANK YOU')

 // Part 3: Bridge split fingerspelling fragments across suspect whole signs without dropping intentional signs
 const summerSplit = engine.syntaxSentence('SUM THANK YOU ME R', 'SUM THANK YOU ME R', [
  { detected: 'SUM', text: 'SUM' },
  { detected: 'THANK YOU', text: 'THANK YOU', wholeSign: true, confidence: 0.95 },
  { detected: 'ME', text: 'ME' },
  { detected: 'R', text: 'R' },
 ])
 assert.equal(summerSplit.suggestions[0].text, 'SUMMER')
 const summerMer = engine.syntaxSentence('SUM THANK YOU MER', 'SUM THANK YOU MER', [
  { detected: 'SUM', text: 'SUM' },
  { detected: 'THANK YOU', text: 'THANK YOU', wholeSign: true, confidence: 0.95 },
  { detected: 'MER', text: 'MER' },
 ])
 assert.equal(summerMer.suggestions[0].text, 'SUMMER')
 const keepIntentional = engine.syntaxSentence('THE HELP ME', 'THE HELP ME', [
  { detected: 'THE', text: 'THE' },
  { detected: 'HELP', text: 'HELP', wholeSign: true, confidence: 0.97 },
  { detected: 'ME', text: 'ME' },
 ])
 assert.equal(keepIntentional.suggestions[0].text, 'THE HELP ME')
 const keepInside = engine.syntaxSentence('IN HELP SIDE', 'IN HELP SIDE', [
  { detected: 'IN', text: 'IN' },
  { detected: 'HELP', text: 'HELP', wholeSign: true, confidence: 0.97 },
  { detected: 'SIDE', text: 'SIDE' },
 ])
 assert.equal(keepInside.suggestions[0].text, 'IN HELP SIDE')

 // Recognition-process signals: runner-up alternatives guide word and sentence choice
 const altWord = engine.suggestWord('XOLD', [], [
  { label: 'X', confidence: 0.52, alternatives: [{ label: 'B', confidence: 0.44 }], fromMotion: false },
  { label: 'O', confidence: 0.98, fromMotion: false },
  { label: 'L', confidence: 0.98, fromMotion: false },
  { label: 'D', confidence: 0.98, fromMotion: false },
 ])
 assert.equal(altWord.suggestions[0].text, 'BOLD')

 // Motion J/Z blip adjacent to a whole sign is dropped automatically, while static Z and JAZZ stay intact
 const motionBlip = engine.syntaxSentence('Z HELLO WORLD', 'Z HELLO WORLD', [
  { detected: 'Z', text: 'Z', letters: [{ label: 'Z', confidence: 0.78, fromMotion: true }] },
  { detected: 'HELLO', text: 'HELLO', wholeSign: true, confidence: 0.96 },
  { detected: 'WORLD', text: 'WORLD' },
 ])
 assert.equal(motionBlip.suggestions[0].text, 'HELLO WORLD')
 const staticZ = engine.syntaxSentence('Z HELLO WORLD', 'Z HELLO WORLD', [
  { detected: 'Z', text: 'Z', letters: [{ label: 'Z', confidence: 0.96, fromMotion: false }] },
  { detected: 'HELLO', text: 'HELLO', wholeSign: true, confidence: 0.96 },
  { detected: 'WORLD', text: 'WORLD' },
 ])
 assert.equal(staticZ.suggestions[0].text, 'Z HELLO WORLD')
 const keepJazz = engine.syntaxSentence('JAZZ', 'JAZZ', [
  {
   detected: 'JAZZ',
   text: 'JAZZ',
   letters: [
    { label: 'J', confidence: 0.94, fromMotion: true },
    { label: 'A', confidence: 0.98, fromMotion: false },
    { label: 'Z', confidence: 0.92, fromMotion: true },
    { label: 'Z', confidence: 0.92, fromMotion: true },
   ],
  },
 ])
 assert.equal(keepJazz.suggestions[0].text, 'JAZZ')
 const keepHelloAfterStray = engine.syntaxSentence('I WANT TO SAY HELLO C TO YOUR HELP', 'I WANT TO SAY HELLO C TO YOUR HELP', [
  { detected: 'I', text: 'I' },
  { detected: 'WANT', text: 'WANT' },
  { detected: 'TO', text: 'TO' },
  { detected: 'SAY', text: 'SAY' },
  { detected: 'HELLO', text: 'HELLO', wholeSign: true, confidence: 0.96 },
  { detected: 'C', text: 'C' },
  { detected: 'TO', text: 'TO' },
  { detected: 'YOUR', text: 'YOUR' },
  { detected: 'HELP', text: 'HELP', wholeSign: true, confidence: 0.96 },
 ])
 assert.ok(keepHelloAfterStray.suggestions[0].text.includes('HELLO'))
 const atNoonSplit = engine.syntaxSentence('I NEED HELLO A TN O ON', 'I NEED HELLO A TN O ON', [
  { detected: 'I', text: 'I' },
  { detected: 'NEED', text: 'NEED' },
  { detected: 'HELLO', text: 'HELLO', wholeSign: true, confidence: 0.96 },
  { detected: 'A', text: 'A' },
  { detected: 'TN', text: 'TN' },
  { detected: 'O', text: 'O' },
  { detected: 'ON', text: 'ON' },
 ])
 assert.equal(atNoonSplit.suggestions[0].text, 'I NEED HELLO AT NOON')
 assert.equal(atNoonSplit.suggestions[0].uncertain, false)
 console.log('PASS WASM spelling syntaxing (word separation, letter arrangement, grammar context, and invariants)')
} finally {
 engine.dispose()
}
