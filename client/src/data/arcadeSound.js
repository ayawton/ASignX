const cues = {
  countdown: [[0, 660, 660, .10, 'sine', .085]],
  launch: [[0, 520, 1000, .20, 'triangle', .07]],
  lock: [[0, 800, 1350, .08, 'sine', .08]],
  shot: [[0, 920, 210, .13, 'triangle', .065]],
  clear: [[0, 155, 35, .28, 'sawtooth', .075], [.13, 650, 650, .12, 'sine', .055], [.23, 980, 980, .18, 'sine', .06]],
  impact: [[0, 120, 33, .29, 'triangle', .13]],
  end: [[0, 520, 520, .14, 'sine', .075], [.15, 390, 260, .30, 'triangle', .068]],
}

export function playArcadeCues(context, names) {
  const start = context.currentTime + .015
  names.forEach((name, index) => {
    for (const [delay, from, to, duration, type, volume] of cues[name]) {
      const at = start + delay + index * .09
      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      oscillator.type = type
      oscillator.frequency.setValueAtTime(from, at)
      oscillator.frequency.exponentialRampToValueAtTime(to, at + duration)
      envelope.gain.setValueAtTime(.001, at)
      envelope.gain.linearRampToValueAtTime(volume, at + .012)
      envelope.gain.exponentialRampToValueAtTime(.001, at + duration)
      oscillator.connect(envelope).connect(context.destination)
      oscillator.start(at)
      oscillator.stop(at + duration)
    }
  })
}
