const cues = {
  countdown: [[0, 660, 660, .10, 'sine', .085]],
  launch: [[0, 520, 1000, .20, 'triangle', .07]],
  lock: [[0, 760, 1280, .075, 'sine', .075]],
  shot: [[0, 780, 240, .12, 'triangle', .065]],
  clear: [[0, 155, 38, .26, 'sawtooth', .07]],
  powerup: [[0, 587, 880, .14, 'sine', .075], [.1, 880, 1175, .20, 'triangle', .07]],
  emp: [[0, 980, 180, .38, 'sawtooth', .075], [.06, 440, 220, .32, 'sine', .065]],
  warn: [[0, 880, 660, .14, 'sawtooth', .06], [.18, 880, 660, .14, 'sawtooth', .06], [.36, 980, 740, .16, 'sawtooth', .07]],
  bossLaser: [[0, 210, 52, .45, 'sawtooth', .11], [.02, 620, 140, .38, 'square', .06]],
  impact: [[0, 120, 33, .29, 'triangle', .13]],
  end: [[0, 520, 520, .14, 'sine', .075], [.15, 390, 260, .30, 'triangle', .068]],
}

// Pentatonic semitone steps so each consecutive letter in a word climbs cleanly.
const stepSemitones = [0, 2, 4, 7, 9, 12, 14, 16]
const semitoneRatio = n => 2 ** (n / 12)

function scheduleTone(context, at, from, to, duration, type, volume) {
  const oscillator = context.createOscillator()
  const envelope = context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(from, at)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + duration)
  envelope.gain.setValueAtTime(.001, at)
  envelope.gain.linearRampToValueAtTime(volume, at + .012)
  envelope.gain.exponentialRampToValueAtTime(.001, at + duration)
  oscillator.connect(envelope).connect(context.destination)
  oscillator.start(at)
  oscillator.stop(at + duration)
}

export function playArcadeCues(context, names, meta = {}) {
  const start = context.currentTime + .015
  const step = Math.max(0, Number(meta.step) || 0)
  const combo = Math.max(1, Math.min(Number(meta.combo) || 1, 5))
  const carrier = Boolean(meta.carrier)

  names.forEach((name, index) => {
    const baseAt = start + index * .075

    if (name === 'shot') {
      const ratio = semitoneRatio(stepSemitones[Math.min(step, stepSemitones.length - 1)])
      scheduleTone(context, baseAt, 760 * ratio, 260 * ratio, .12, 'triangle', .065)
      scheduleTone(context, baseAt, 520 * ratio, 680 * ratio, .08, 'sine', .04)
      return
    }

    if (name === 'clear') {
      // Low hull pop + crisp major triad chord scaled subtly by combo.
      const chordLift = semitoneRatio((combo - 1) * 2)
      const root = 523.25 * chordLift // C5 upward
      scheduleTone(context, baseAt, carrier ? 120 : 155, 34, carrier ? .34 : .25, 'sawtooth', carrier ? .085 : .07)
      const chord = carrier ? [root, root * 1.25, root * 1.5, root * 2] : [root, root * 1.25, root * 1.5]
      chord.forEach((freq, i) => {
        scheduleTone(context, baseAt + .05 + i * .035, freq, freq * 1.01, carrier ? .28 : .20, 'triangle', .052)
      })
      return
    }

    for (const [delay, from, to, duration, type, volume] of cues[name] ?? []) {
      scheduleTone(context, baseAt + delay, from, to, duration, type, volume)
    }
  })
}
