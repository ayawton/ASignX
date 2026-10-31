self.onmessage = async ({ data }) => {
 try {
  const sentence = data.mode === 'sentence'
  const response = await fetch(`/api/recognition/nlp/${sentence ? 'sentence' : 'word'}`, {
   method: 'POST', headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ text: data.text, ...(sentence ? { fallback: data.fallback } : {}) }), credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error('Word correction unavailable')
  self.postMessage({ id: data.id, result: await response.json() })
 }
 catch { self.postMessage({ id: data.id, error: 'Word suggestions are unavailable for this input.' }) }
}
