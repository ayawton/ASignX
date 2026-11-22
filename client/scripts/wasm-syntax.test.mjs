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
 console.log('PASS WASM spelling syntaxing (word separation, letter arrangement, grammar context, and invariants)')
} finally {
 engine.dispose()
}
