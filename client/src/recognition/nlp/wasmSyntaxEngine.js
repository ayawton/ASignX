import initWasm, { initSync, SpellingSyntaxEngine } from './wasm/nlp_wasm.js'

/**
 * Initialize the Rust/WASM spelling syntaxing engine from unigram and bigram dictionaries.
 * Pass `wasmBytes` when running outside a browser fetch context (e.g., Node tests).
 */
export async function createWasmSyntaxEngine({ unigrams, bigrams, wasmBytes } = {}) {
 if (wasmBytes) {
  initSync({ module: wasmBytes })
 } else {
  await initWasm()
 }
 const engine = new SpellingSyntaxEngine(unigrams, bigrams)
 return {
  suggestWord(text, previous = [], letters = null) {
   if (Array.isArray(letters) && typeof engine.suggest_word_with_signals === 'function') {
    return JSON.parse(engine.suggest_word_with_signals(text, JSON.stringify(previous), JSON.stringify(letters)))
   }
   return JSON.parse(engine.suggest_word(text, JSON.stringify(previous)))
  },
  syntaxSentence(text, fallback = text, groups = null) {
   if (Array.isArray(groups) && typeof engine.syntax_sentence_groups === 'function') {
    return JSON.parse(engine.syntax_sentence_groups(JSON.stringify(groups), fallback))
   }
   return JSON.parse(engine.syntax_sentence(text, fallback))
  },
  dispose() {
   engine.free()
  },
 }
}
