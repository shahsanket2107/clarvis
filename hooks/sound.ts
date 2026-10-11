// clarvis sound: a few original chiptune clips synthesized in code, nothing
// recorded and nothing from any film. Square, triangle and noise voices are
// mixed into 16-bit mono PCM at 22.05 kHz and wrapped in a WAV header; each
// clip is built once and cached. Opt-in (`/clarvis sound on`, the `sound` option).
// Pure: playing is register.tsx's job, gated by `soundGate`.

export const RATE = 22_050
export type Wave = 'square' | 'triangle' | 'noise'
// at/ms in milliseconds from the clip's start; f (Hz) glides to `to` over the note; vol 0..1
export type Note = { wave: Wave; f: number; to?: number; at: number; ms: number; vol?: number }
export type ClipName = 'assemble' | 'whomp' | 'coin' | 'levelup' | 'boot'

// Note frequencies (Hz).
const C4 = 261.63, E4 = 329.63, G4 = 392, C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, A5 = 880, B5 = 987.77
export const CLIPS: Record<ClipName, Note[]> = {
  // a rising fanfare: five notes, ~0.6 s, a triangle under the square lead
  assemble: [
    { wave: 'square', f: C4, at: 0, ms: 90 }, { wave: 'square', f: E4, at: 100, ms: 90 }, { wave: 'square', f: G4, at: 200, ms: 90 },
    { wave: 'square', f: C5, at: 300, ms: 100 }, { wave: 'square', f: G5, at: 410, ms: 190 },
    { wave: 'triangle', f: C4 / 2, at: 0, ms: 300, vol: 0.9 }, { wave: 'triangle', f: C5, at: 410, ms: 190, vol: 0.8 },
  ],
  // the womp-womp: a square sliding down with a burst of noise, ~0.4 s
  whomp: [
    { wave: 'square', f: 330, to: 110, at: 0, ms: 400, vol: 0.9 }, { wave: 'noise', f: 4000, at: 0, ms: 160, vol: 0.35 },
    { wave: 'triangle', f: 110, to: 55, at: 120, ms: 280, vol: 0.8 },
  ],
  // a coin: two quick high notes, ~0.15 s
  coin: [{ wave: 'square', f: B5, at: 0, ms: 50 }, { wave: 'square', f: C6, at: 50, ms: 100 }],
  // a level-up: a short run of arpeggio, ~0.4 s
  levelup: [
    { wave: 'square', f: C5, at: 0, ms: 70 }, { wave: 'square', f: E5, at: 70, ms: 70 }, { wave: 'square', f: G5, at: 140, ms: 70 }, { wave: 'square', f: A5, at: 210, ms: 70 },
    { wave: 'square', f: C6, at: 280, ms: 120 }, { wave: 'triangle', f: C5, at: 280, ms: 120, vol: 0.7 },
  ],
  // a very short boot hum
  boot: [{ wave: 'triangle', f: 110, to: 220, at: 0, ms: 220, vol: 0.9 }, { wave: 'square', f: 440, at: 150, ms: 70, vol: 0.4 }],
}

/** Mixes notes into 16-bit samples. Deterministic: the noise voice is a fixed-seed LFSR. */
export function synth(notes: readonly Note[]): Int16Array {
  const end = Math.max(1, ...notes.map(n => n.at + n.ms))
  const total = Math.ceil((end / 1000) * RATE)
  const mix = new Float64Array(total)
  let lfsr = 0xace1
  for (const n of notes) {
    const start = Math.floor((n.at / 1000) * RATE), count = Math.floor((n.ms / 1000) * RATE)
    const vol = (n.vol ?? 1) * 0.5
    let phase = 0, held = 0
    for (let i = 0; i < count && start + i < total; i++) {
      const k = count > 1 ? i / (count - 1) : 0
      const f = n.to === undefined ? n.f : n.f + (n.to - n.f) * k
      phase += f / RATE; phase -= Math.floor(phase)
      let s: number
      if (n.wave === 'square') s = phase < 0.5 ? 1 : -1
      else if (n.wave === 'triangle') s = 4 * Math.abs(phase - 0.5) - 1
      else { // noise: the register steps at a rate set by f
        if (i % Math.max(1, Math.round(RATE / Math.max(200, f))) === 0) { const bit = (lfsr ^ (lfsr >> 1)) & 1; lfsr = (lfsr >> 1) | (bit << 14); held = lfsr & 1 ? 1 : -1 }
        s = held
      }
      const env = Math.min(1, i / 66) * (1 - k) ** 0.7 // a 3 ms attack, a decay to silence
      mix[start + i] = mix[start + i]! + s * vol * env
    }
  }
  const out = new Int16Array(total)
  for (let i = 0; i < total; i++) { const v = Math.max(-1, Math.min(1, mix[i]!)); out[i] = Math.round(v * 32000) }
  return out
}

/** A canonical 44-byte RIFF/WAVE header and the samples, little-endian, mono, 16-bit. */
export function wavBytes(samples: Int16Array): Uint8Array {
  const data = samples.length * 2
  const buf = new ArrayBuffer(44 + data), v = new DataView(buf)
  const tag = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  tag(0, 'RIFF'); v.setUint32(4, 36 + data, true); tag(8, 'WAVE'); tag(12, 'fmt '); v.setUint32(16, 16, true)
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  tag(36, 'data'); v.setUint32(40, data, true)
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, samples[i]!, true)
  return new Uint8Array(buf)
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
export function toBase64(b: Uint8Array): string {
  let out = ''
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < b.length ? B64[(n >> 6) & 63]! : '=') + (i + 2 < b.length ? B64[n & 63]! : '=')
  }
  return out
}
const cache = new Map<ClipName, { base64: string; mime: string }>()
/** The `$.audio.play` clip for a name: base64 bytes and their MIME type, built once. */
export function clipOf(name: ClipName): { base64: string; mime: 'audio/wav' } {
  let c = cache.get(name)
  if (!c) { c = { base64: toBase64(wavBytes(synth(CLIPS[name]))), mime: 'audio/wav' }; cache.set(name, c) }
  return c as { base64: string; mime: 'audio/wav' }
}

// ── when sound may play ─────────────────────────────────────────────────────
export const SOUND_GAP_MS = 2000 // at most one clip in this long
export const BURST_QUIET_MS = 3000 // and none just after a theater burst
export const SOUND_GAIN = 0.4
/** Which clips may cut into the gap after another: the end-of-turn clips outrank the boot hum, which outranks a coin. */
export const CLIP_PRIORITY: Record<ClipName, number> = { assemble: 3, levelup: 3, whomp: 3, boot: 2, coin: 1 }
export const COIN_DEFER_MS = 900 // a trophy coin earned around a turn's end waits this long after the end-of-turn clip
/** A clip may play inside the gap only when it outranks the one that just played; a lower or equal one never does. */
export function soundGate(o: { on: boolean; mode: string; now: number; lastAt: number; burstAt: number; name?: ClipName; lastName?: ClipName }): boolean {
  if (!o.on || o.mode !== 'full') return false // calm, lite and off are silent
  if (!Number.isFinite(o.now)) return false
  if (o.now - o.lastAt < SOUND_GAP_MS) {
    if (!o.name || !o.lastName || CLIP_PRIORITY[o.name] <= CLIP_PRIORITY[o.lastName]) return false
  }
  if (o.now - o.burstAt < BURST_QUIET_MS) return false
  return true
}
/** When a deferred coin may play: not before it was due, and never inside the gap after the last clip. */
export function coinReady(o: { now: number; dueAt: number; lastAt: number }): boolean {
  return o.dueAt > 0 && o.now >= o.dueAt && o.now - o.lastAt >= SOUND_GAP_MS
}
/** Which choice stands: the `/clarvis sound` one stored, else the `sound` option, else ON (a fresh install has sound on). */
export function soundChoice(stored: unknown, cfg: unknown): boolean {
  if (stored === 'on') return true
  if (stored === 'off') return false
  return cfg !== false
}
export const SOUND_NOTE = 'Sound plays on macOS (Linux and Windows terminals have no player and stay silent), in full mode only.'
