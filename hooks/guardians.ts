// clarvis: the Guardians of the Galaxy. Their stage and lane animations,
// kept out of scenes.ts: `guardianStage` and `guardianLane` draw the hero and
// return true, or return false when `act` is not a Guardian. Pure functions of
// time `t`; nothing is allocated per frame.
import type { Canvas } from './pixel'
import { CLEAR, HOLE, clamp01, easeIn, easeInOut, easeOut, hash, rgb } from './pixel'
import * as B from './baked'

const TAU = Math.PI * 2, PX = 0.83 // a column is 0.83 of a sub-row tall
const ORANGE = rgb('#FF8A1E'), PINK = rgb('#FF6FB0'), BLUE = rgb('#6FD8FF'), WHITE = 0xffffff
const GREEN = rgb('#62C23C'), GREEN_HI = rgb('#A8EC70'), BARK = rgb('#7A5230'), BARK_HI = rgb('#B98A56')
const STEEL = rgb('#B6BDCC'), STEEL_DK = rgb('#717B90'), RED = rgb('#FF2A2A'), RED_DK = rgb('#B81E26')
const SKIN = rgb('#EAD8BC'), INK = rgb('#140709'), PURPLE = rgb('#B9A6FF'), SLEEP = rgb('#8E8CFF')
const FLAME = rgb('#FFB347'), FLAME_HI = rgb('#FFF0B0'), SLASH = rgb('#D5FFD0')

export const GUARDIANS = ['starlord', 'gamora', 'drax', 'rocket', 'groot', 'mantis', 'nebula', 'yondu']

// ── shared bits ─────────────────────────────────────────────────────────────
function burst(cv: Canvas, cx: number, cy: number, r: number, n: number, seed: number, c1: number, c2: number, f: number) {
  if (f <= 0 || f >= 1) return
  for (let i = 0; i < n; i++) {
    const a = hash(i, seed) * TAU, d = r * (0.35 + 0.65 * hash(i, seed + 1)) * f
    cv.glow(cx + (Math.cos(a) * d) / PX, cy + Math.sin(a) * d, i % 2 ? c1 : c2, 1 - f)
  }
}
function ringOut(cv: Canvas, cx: number, cy: number, r: number, f: number, c: number) {
  if (f <= 0 || f >= 1) return
  for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; cv.glow(cx + (Math.cos(a) * r * f) / PX, cy + Math.sin(a) * r * f, c, 1 - f) }
}
// a bright head with a fading tail along (x0,y0)->(x1,y1); p is the head's progress
function streak(cv: Canvas, x0: number, y0: number, x1: number, y1: number, p: number, tail: number, c1: number, c2: number) {
  for (let i = 0; i <= 14; i++) {
    const u = p - tail + (tail * i) / 14
    if (u < 0 || u > 1) continue
    cv.glow(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, i > 11 ? c2 : c1, 0.15 + (0.85 * i) / 14)
    if (i === 14) cv.radial(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 2.2, c2, 0.7)
  }
}
// an explosion: white core, yellow and orange fire, solid sparks
function blast(cv: Canvas, cx: number, cy: number, f: number, seed: number) {
  const r = 2.5 + f * 5
  if (f < 0.85) for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let xs = Math.floor((cx - r / PX) * 2); xs <= Math.ceil((cx + r / PX) * 2); xs++) {
    const d = Math.hypot(((xs + 0.5) / 2 - cx) * PX, y + 0.5 - cy) / r
    if (d < 1) cv.setSub(xs, y, d < 0.35 ? WHITE : d < 0.65 ? FLAME_HI : d < 0.85 ? ORANGE : rgb('#E8402A'))
  }
  ringOut(cv, cx, cy, 10, f, FLAME_HI)
  for (let i = 0; i < 16; i++) {
    const an = hash(i, seed) * TAU, d = r + 1 + 6 * f * (0.4 + 0.6 * hash(i, seed + 1))
    if (f < 0.9) cv.set(cx + (Math.cos(an) * d) / PX, cy + Math.sin(an) * d, i % 3 === 0 ? WHITE : i % 3 === 1 ? FLAME_HI : ORANGE)
  }
}
function note(cv: Canvas, x: number, y: number, c: number, a: number) { cv.glow(x, y, c, a); cv.glow(x + 0.5, y - 1, c, a * 0.7); cv.glow(x + 1, y - 2, c, a * 0.5) }
function zed(cv: Canvas, x: number, y: number, s: number, c: number, a: number) {
  cv.line(x, y, x + s, y, c, a); cv.line(x + s, y, x, y + s * 1.4, c, a); cv.line(x, y + s * 1.4, x + s, y + s * 1.4, c, a)
}
// a throwing knife spinning about (cx,cy)
function knife(cv: Canvas, cx: number, cy: number, ang: number, len: number) {
  const dx = (Math.cos(ang) * len) / PX, dy = Math.sin(ang) * len
  cv.line(cx - dx, cy - dy, cx + dx, cy + dy, STEEL)
  cv.glow(cx + dx, cy + dy, WHITE, 0.9)
  cv.glow(cx - dx, cy - dy, BARK, 0.9)
}
function arrow(cv: Canvas, x: number, y: number, dx: number, dy: number, alpha: number) {
  const m = Math.hypot(dx, dy) || 1, ux = dx / m, uy = dy / m
  for (let i = 1; i < 12; i++) cv.glow(x - (ux * i * 1.1) / PX * 0.83, y - uy * i * 0.9, i % 2 ? RED : rgb('#FF7A66'), alpha * (1 - i / 12))
  cv.line(x - (ux * 3) / PX, y - uy * 3, x, y, RED_DK, alpha)
  cv.glow(x, y, WHITE, alpha); cv.radial(x, y, 2.6, RED, 0.7 * alpha)
}

// ── the stage (STAGE columns wide, H sub-rows tall) ─────────────────────────
// Effects stay in their own box: the stage's never spill past its columns, the lane's never rise into the rows above it.
let keep = new Int32Array(0)
export function guardianStage(cv: Canvas, act: string, t: number, calm: boolean, W: number, H: number): boolean {
  const ok = stageDraw(cv, act, t, calm, W, H)
  if (ok) for (let y = 0; y < cv.h; y++) for (let x = W * 2 + 2; x < cv.W; x++) { const i = y * cv.W + x; if (cv.px[i] !== HOLE) cv.px[i] = CLEAR }
  return ok
}
export function guardianLane(cv: Canvas, y0: number, H: number, W: number, act: string, t: number, calm: boolean): boolean {
  const n = y0 * cv.W
  if (keep.length < n) keep = new Int32Array(n)
  for (let i = 0; i < n; i++) keep[i] = cv.px[i]!
  const ok = laneDraw(cv, y0, H, W, act, t, calm)
  if (ok) for (let i = 0; i < n; i++) cv.px[i] = keep[i]!
  return ok
}
function stageDraw(cv: Canvas, act: string, t: number, calm: boolean, W: number, H: number): boolean {
  const cx = W / 2, tl = calm ? 0 : t
  switch (act) {
    case 'starlord': { // dancing with the Walkman, then a jet-boot dash with blasters
      const s = B.starlordStage, per = 5.2, u = calm ? 0.2 : (t % per) / per
      if (u < 0.62) {
        const beat = tl * 7.5, sway = Math.sin(beat) * 0.14, bob = calm ? 0 : Math.abs(Math.sin(beat)) * 1.6
        if (!calm) cv.radial(cx, H / 2, 8, ORANGE, 0.1 + 0.1 * Math.abs(Math.sin(beat)))
        cv.drawRot(s, cx, H - s.h / 2 - bob, sway)
        cv.rect(cx + 4.5, H - 3, 3, 3, STEEL_DK); cv.rect(cx + 5, H - 3, 2, 1, ORANGE) // the Walkman
        cv.line(cx + 5, H - 3, cx + s.w / 4 * 0.85, H - s.h * 0.45, INK)
        if (!calm) for (let i = 0; i < 4; i++) { const k = (t * 0.9 + i / 4) % 1; note(cv, cx + 6 + Math.sin(k * 9 + i) * 2.5 + k * 3, H - 4 - k * (H - 4), i % 2 ? PINK : ORANGE, 1 - k) }
      } else {
        const k = (u - 0.62) / 0.38, px = cx - 4 + 8 * easeInOut(k), lift = 2.5 + Math.sin(k * Math.PI) * 1.2
        cv.drawRot(s, px, H - s.h / 2 - lift, 0.14)
        for (let i = 0; i < 9; i++) for (const d of [-2, 2.2]) cv.glow(px + d - i * 0.5, H - lift + i * 0.35, i < 3 ? FLAME_HI : FLAME, 1 - i / 9) // jet boots
        const mx = px + s.w / 4 * 0.8 + 1, my = H - s.h * 0.4 - lift
        cv.radial(mx, my, 2.4, BLUE, 0.6 + 0.3 * Math.sin(k * 40))
        for (let j = 0; j < 2; j++) { const bx = mx + 2 + ((k * 46 + j * 12) % 24); if (bx < W) { cv.set(bx, my - 1 + j * 2, WHITE); cv.set(bx + 1, my - 1 + j * 2, BLUE); cv.glow(bx - 1, my - 1 + j * 2, BLUE, 0.6) } } // blaster bolts
      }
      return true
    }
    case 'gamora': { // sword slashes cutting across
      const s = B.gamoraStage, per = 1.3, k = calm ? 0.7 : (t % per) / per, n = Math.floor(tl / per), dir = n % 2 ? -1 : 1
      const hit = k > 0.2 && k < 0.5 ? 1 : 0
      cv.drawRot(s, cx + dir * hit * 0.8, H - s.h / 2, dir * hit * 0.07, { sx: 1 + 0.04 * hit })
      const x0 = cx - dir * 8, x1 = cx + dir * 8
      if (k < 0.6) streak(cv, x0, 0.5, x1, H - 0.5, easeOut(k / 0.45), 0.5, GREEN_HI, SLASH)
      if (k > 0.35 && k < 0.65) { burst(cv, cx, H / 2, 6, 12, n, SLASH, WHITE, (k - 0.35) / 0.3); cv.radial(cx, H / 2, 4, SLASH, 0.5 * (1 - (k - 0.35) / 0.3)) }
      if (calm) streak(cv, cx - 8, 0.5, cx + 8, H - 0.5, 0.6, 0.5, GREEN_HI, SLASH)
      return true
    }
    case 'drax': { // knives, then standing perfectly still: "invisible"
      const s = B.draxStage, per = 7, u = calm ? 0.1 : (t % per) / per
      const inv = u < 0.45 ? 0 : u < 0.55 ? (u - 0.45) / 0.1 : u < 0.9 ? 1 : 1 - (u - 0.9) / 0.1
      cv.hi(s, cx - s.w / 4, H - s.h, { alpha: 1 - 0.78 * inv })
      if (inv < 0.5 && !calm) for (let j = 0; j < 2; j++) {
        const a = tl * 9 + j * Math.PI, r = 8
        knife(cv, cx + (Math.cos(a) * r) / PX, H * 0.5 + Math.sin(a) * r * 0.55, a * 2.2, 1.7)
        if (hash(Math.floor(tl * 9), j) > 0.97) cv.glow(cx, H / 2, WHITE, 0.3)
      }
      if (inv > 0.9) { // a faint shimmer, nothing more
        const y = (tl * 3) % H
        for (let x = 0; x < W; x += 2) cv.glow(x, y, rgb('#587A64'), 0.12)
        cv.glow(cx, 0.5, rgb('#587A64'), 0.25) // a single patient pixel
      }
      return true
    }
    case 'rocket': { // a face full of attitude: the gun barks off-stage, he flinches, the blasts light up the box
      const s = B.rocketStage, per = 2.4, u = calm ? 0.5 : (t % per) / per, n = Math.floor(tl / per)
      const rec = u < 0.12 ? 0 : u < 0.42 ? easeOut(1 - (u - 0.12) / 0.3) : 0
      cv.drawRot(s, cx - rec * 1.2, H - s.h / 2, -rec * 0.08, { sx: 1 + rec * 0.04, sy: 1 - rec * 0.04 })
      const ex = cx + 4 + hash(n, 1) * 3, ey = 2 + hash(n, 2) * (H - 6)
      if (calm) { blast(cv, ex, ey, 0.4, n) }
      else if (u > 0.12 && u < 0.3) cv.radial(cx + s.w / 4, H * 0.5, 7, FLAME_HI, 0.5 * (1 - (u - 0.12) / 0.18))
      else if (u > 0.3 && u < 0.85) blast(cv, ex, ey, (u - 0.3) / 0.55, n)
      return true
    }
    case 'groot': { // vines and branches climbing the stage, then baby Groot dancing
      const s = B.grootStage, per = 6.4, u = calm ? 0.3 : (t % per) / per
      if (u < 0.62) {
        const g = calm ? 0.8 : easeOut(u / 0.55)
        for (let v = 0; v < 6; v++) {
          const side = v % 2 ? 1 : -1, sx = cx + side * (5 + (v >> 1) * 2.2), len = g * (H - 1) * (0.55 + 0.15 * (v >> 1))
          for (let i = 0; i < len; i++) {
            const x = sx + Math.sin(i * 0.55 + v * 1.7 + tl) * 1.1 - side * i * 0.12, y = H - i
            cv.glow(x, y, i % 3 ? BARK : BARK_HI, 0.95)
            if (i % 4 === 3) { const lx = x + side * 1.2; cv.glow(lx, y - 0.5, GREEN, 0.95); cv.glow(lx + side * 0.5, y, GREEN_HI, 0.8) } // leaves
          }
          if (len > 3) cv.radial(sx + Math.sin(len * 0.55 + v * 1.7 + tl) * 1.1, H - len, 1.6, GREEN_HI, 0.5)
        }
        cv.hi(s, cx - s.w / 4, H - s.h)
      } else {
        const beat = tl * 6, k = (u - 0.62) / 0.38, fade = k > 0.85 ? 1 - (k - 0.85) / 0.15 : k < 0.12 ? k / 0.12 : 1
        cv.drawRot(s, cx + Math.sin(beat * 0.5) * 2.5, H - s.h * 0.2 - Math.abs(Math.sin(beat)) * 1.8, Math.sin(beat) * 0.22, { sx: 0.62, sy: 0.62 })
        for (let i = 0; i < 3; i++) { const q = (tl * 0.9 + i / 3) % 1; note(cv, cx + 4 + i * 1.5 + Math.sin(q * 8) * 1.4, H - 3 - q * 8, i % 2 ? GREEN_HI : PINK, fade * (1 - q)) }
        cv.rect(cx - 6, H - 1, 12, 1, BARK)
      }
      return true
    }
    case 'mantis': { // hands to the temples, then sleep
      const s = B.mantisStage, per = 6, u = calm ? 0.3 : (t % per) / per
      const hands = u < 0.15 ? easeOut(u / 0.15) : u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2
      const slp = u < 0.4 ? 0 : u < 0.5 ? (u - 0.4) / 0.1 : u < 0.8 ? 1 : 0
      const y = H - s.h, hx = s.w / 4 * 0.97, hy = y + s.h * 0.5
      cv.hi(s, cx - s.w / 4, y, { alpha: 1 - 0.25 * slp })
      for (const d of [-1, 1]) { // the hands
        const px = cx + d * (hx + 3.5 * (1 - hands)), py = hy + (1 - hands) * 4
        cv.rect(px - 0.5, py - 1, 1, 3, SKIN); cv.glow(px, py - 1, INK, 0.5)
      }
      const pulse = calm ? 0.4 : 0.35 + 0.35 * Math.sin(tl * 6)
      for (const d of [-1, 1]) cv.radial(cx + d * s.w / 4 * 0.78, y + 0.5, 2.6, GREEN_HI, (0.2 + 0.5 * hands) * pulse + 0.1)
      if (slp > 0) {
        if (!calm) for (let i = 0; i < 3; i++) { const q = (tl * 0.5 + i / 3) % 1; zed(cv, cx + 3 + i * 2.2 + Math.sin(q * 5) * 1, y + 2 - q * 2 + i * 0.5, 1.6 + i * 0.5, SLEEP, slp * (1 - q)) }
        else zed(cv, cx + 5, y + 1, 2, SLEEP, 0.8)
        cv.radial(cx, H / 2, 8, SLEEP, 0.12 * slp)
      }
      return true
    }
    case 'nebula': { // the cyborg arm swings
      const s = B.nebulaStage, per = 2.2, u = calm ? 0.2 : (t % per) / per
      cv.hi(s, cx - s.w / 4, H - s.h)
      const sx = cx + s.w / 4 * 0.85, sy = H - s.h * 0.32
      const a = u < 0.45 ? -1.9 + 0.25 * easeInOut(u / 0.45) : u < 0.6 ? -1.65 + 3.5 * easeIn((u - 0.45) / 0.15) : 1.85 - 0.3 * easeOut((u - 0.6) / 0.4)
      const e0 = Math.cos(a) * 4.5, e1 = Math.sin(a) * 4.5, a2 = a + 0.5, f0 = e0 + Math.cos(a2) * 4.5, f1 = e1 + Math.sin(a2) * 4.5
      if (u > 0.45 && u < 0.78) for (let i = 1; i < 14; i++) { const ta = a - i * 0.09; cv.glow(sx + (Math.cos(ta) * 9) / PX, sy + Math.sin(ta) * 9, i < 4 ? WHITE : BLUE, (1 - i / 14) * 0.7) } // the arc
      cv.line(sx, sy, sx + e0 / PX, sy + e1, STEEL); cv.line(sx + e0 / PX, sy + e1, sx + f0 / PX, sy + f1, STEEL_DK)
      cv.glow(sx + e0 / PX, sy + e1, WHITE, 0.9); cv.radial(sx + f0 / PX, sy + f1, 1.8, RED, 0.8)
      if (u > 0.55 && u < 0.7) cv.radial(sx + f0 / PX, sy + f1, 5, WHITE, 0.4)
      return true
    }
    case 'yondu': { // the whistle, then the yaka arrow
      const s = B.yonduStage, per = 5, u = calm ? 0.2 : (t % per) / per
      const x = cx - s.w / 4 - 3
      cv.hi(s, x, H - s.h)
      const mx = x + s.w / 4, my = H - s.h * 0.3
      if (u < 0.3) { for (let r = 0; r < 3; r++) ringOut(cv, mx + 6, my, 7, ((u * 6 + r * 0.33) % 1), PURPLE); note(cv, mx + 4, my - 3 - (u * 20) % 3, BLUE, 0.9) } // whistling
      else {
        const k = clamp01((u - 0.3) / 0.6), fx = mx + 3 + k * (W - mx - 4), a = k * 22
        const ax = fx + Math.sin(a * 0.6) * 4, ay = H * 0.5 + Math.sin(a) * (H * 0.38)
        arrow(cv, ax, ay, 1, Math.cos(a) * 1.6, 1 - (k > 0.9 ? (k - 0.9) * 10 : 0))
      }
      if (calm) arrow(cv, cx + 6, H / 2, 1, 0, 1)
      return true
    }
  }
  return false
}

// ── the lane (y0: top sub-row, H: its height in sub-rows, W: columns) ───────
function laneDraw(cv: Canvas, y0: number, H: number, W: number, act: string, t: number, calm: boolean): boolean {
  const tl = calm ? 1.2 : t, mid = y0 + H / 2
  switch (act) {
    case 'starlord': { // dancing along, then the jet-boot dash with blasters
      const s = B.laneStarlord, per = 6, u = (tl % per) / per
      const dance = u < 0.55, k = dance ? u / 0.55 : (u - 0.55) / 0.45
      const x = dance ? -8 + k * (W * 0.4) : -8 + W * 0.4 + easeIn(k) * (W * 0.6 + 20), lift = dance ? Math.abs(Math.sin(tl * 7.5)) * 1.2 : 0
      if (dance) {
        cv.drawRot(s, x + s.w / 4, y0 + s.h / 2 - lift, Math.sin(tl * 7.5) * 0.14)
        for (let i = 0; i < 3; i++) { const q = (tl * 1.1 + i / 3) % 1; note(cv, x + s.w / 2 + q * 7, mid - Math.sin(q * 5 + i) * 2, i % 2 ? PINK : ORANGE, 1 - q) }
      } else {
        cv.hi(s, x, y0)
        for (let i = 1; i < 22; i++) cv.glow(x - i * 0.7, y0 + s.h - 1 + (hash(i, Math.floor(tl * 20)) - 0.5) * 1.4, i < 6 ? FLAME_HI : FLAME, (1 - i / 22) * 0.9)
        const mx = x + s.w / 2
        for (let j = 0; j < 3; j++) { const bx = mx + 1 + ((tl * 60 + j * 14) % 42); cv.set(bx, mid - 1 + (j % 2), WHITE); cv.set(bx + 1, mid - 1 + (j % 2), BLUE); cv.glow(bx - 2, mid - 1 + (j % 2), BLUE, 0.6) }
        cv.radial(mx, mid, 2, BLUE, 0.7)
      }
      return true
    }
    case 'gamora': { // running through, her sword cutting arcs ahead
      const s = B.laneGamora, per = 3.4, k = (tl % per) / per, x = -8 + k * (W + 16), n = Math.floor(tl * 2.4)
      cv.hi(s, x, y0 - Math.abs(Math.sin(tl * 8)) * 0.8)
      const sk = (tl * 2.4) % 1, sx = x + s.w / 2 + 4
      if (sk < 0.6) streak(cv, sx - 3 + (n % 2) * 2, y0 + 0.5, sx + 4, y0 + H - 0.5, easeOut(sk / 0.5), 0.5, GREEN_HI, SLASH)
      if (sk > 0.3 && sk < 0.6) burst(cv, sx + 1, mid, 4, 8, n, SLASH, WHITE, (sk - 0.3) / 0.3)
      return true
    }
    case 'drax': { // knives flung ahead, then standing perfectly still
      const s = B.laneDrax, per = 7, u = (tl % per) / per, x = W * 0.18
      const inv = u < 0.5 ? 0 : u < 0.58 ? (u - 0.5) / 0.08 : u < 0.92 ? 1 : 1 - (u - 0.92) / 0.08
      cv.hi(s, x, y0, { alpha: 1 - 0.78 * inv })
      if (u < 0.5) for (let j = 0; j < 2; j++) {
        const p = (u * 4 + j * 0.5) % 1, kx = x + s.w / 2 + 2 + p * (W * 0.7)
        knife(cv, kx, mid - 1.5 + j * 3 + Math.sin(p * 6) * 0.5, tl * 18 + j, 1.4)
        for (let i = 1; i < 5; i++) cv.glow(kx - i * 1.4, mid - 1.5 + j * 3, STEEL_DK, 0.4 * (1 - i / 5))
      }
      if (inv > 0.9) for (let i = 0; i < 6; i++) cv.glow(x + s.w / 4 + (hash(i, 3) - 0.5) * 6, mid + (hash(i, 4) - 0.5) * 6, rgb('#587A64'), 0.1) // nothing moves
      return true
    }
    case 'rocket': { // the gun barks, explosions pop down the lane
      const s = B.laneRocket, per = 1.3, u = (tl % per) / per, n = Math.floor(tl / per)
      const rec = u < 0.4 ? easeOut(1 - u / 0.4) : 0, x = 2 - rec * 1.6
      cv.hi(s, x, y0)
      const mx = x + s.w / 2, my = y0 + s.h * 0.6
      if (u < 0.15) cv.radial(mx, my, 3.2, FLAME_HI, 1 - u / 0.15)
      const ex = mx + 14 + hash(n, 1) * (W - mx - 30), ey = y0 + 1.5 + hash(n, 2) * (H - 3)
      if (u < 0.25) { const p = u / 0.25; cv.glow(mx + (ex - mx) * p, my + (ey - my) * p, WHITE, 1); cv.glow(mx + (ex - mx) * p * 0.9, my + (ey - my) * p * 0.9, ORANGE, 0.6) }
      else if (u < 0.8) { const f = (u - 0.25) / 0.55; blast(cv, ex, ey, f, n) }
      return true
    }
    case 'groot': { // a branch growing across the whole lane, then baby Groot dancing
      const s = B.laneGroot, per = 7, u = (tl % per) / per
      if (u < 0.6) {
        const g = easeOut(u / 0.5), tip = g * (W + 6) - 3
        for (let x = 0; x < tip && x < W; x++) {
          const y = mid + Math.sin(x * 0.28 + tl * 1.5) * 1.6
          cv.glow(x, y, x % 3 ? BARK : BARK_HI, 0.95); cv.glow(x, y + 1, BARK, 0.7)
          if (x % 5 === 2) { const side = (x / 5) % 2 < 1 ? -1 : 1; cv.glow(x + 0.5, y + side * 1.6, BARK, 0.9); cv.glow(x + 1, y + side * 2.6, GREEN, 0.95); cv.glow(x + 1.7, y + side * 2.6, GREEN_HI, 0.8) }
        }
        cv.hi(s, Math.min(tip, W) - s.w / 2 - 1, y0)
      } else {
        const beat = tl * 6, fade = u > 0.92 ? 1 - (u - 0.92) / 0.08 : 1, x = W * 0.5
        for (let xx = 0; xx < W; xx++) { const y = mid + Math.sin(xx * 0.28 + tl * 1.5) * 1.6; cv.glow(xx, y, BARK, 0.9 * fade); if (xx % 5 === 2) cv.glow(xx + 1, y - 2.6, GREEN, 0.9 * fade) }
        cv.drawRot(s, x + Math.sin(beat * 0.5) * 3, mid + 0.5 - Math.abs(Math.sin(beat)) * 1.6, Math.sin(beat) * 0.22, { sx: 0.7, sy: 0.7 })
        for (let i = 0; i < 3; i++) { const q = (tl * 0.9 + i / 3) % 1; note(cv, x + 4 + i * 2 + q * 3, mid - q * 3, i % 2 ? GREEN_HI : PINK, fade * (1 - q)) }
      }
      return true
    }
    case 'mantis': { // floating across, hands to her temples, a wave of sleep ahead
      const s = B.laneMantis, per = 8, k = (tl % per) / per, x = -8 + k * (W + 16), by = Math.sin(tl * 2) * 0.7
      cv.hi(s, x, y0 + by)
      const ph = (tl * 0.6) % 1, hands = ph < 0.2 ? ph / 0.2 : ph < 0.7 ? 1 : 0
      for (const d of [-1, 1]) {
        const px = x + s.w / 4 + d * (s.w / 4 * 0.98 + 2.5 * (1 - hands)), py = y0 + by + s.h * 0.5 + (1 - hands) * 2
        cv.rect(px - 0.5, py - 1, 1, 2, SKIN)
        cv.radial(x + s.w / 4 + d * s.w / 4 * 0.78, y0 + by + 0.5, 1.6, GREEN_HI, 0.3 + 0.4 * hands)
      }
      if (ph > 0.55) for (let i = 0; i < 3; i++) { const q = (ph - 0.55) / 0.45; zed(cv, x + s.w / 2 + 3 + i * 4 + q * 6, mid - 1 - i * 0.6 - q * 1.5, 1.5, SLEEP, 1 - q * 0.8) }
      for (let i = 0; i < 12; i++) cv.glow(x + s.w / 2 + 6 + i * 2.2, mid + Math.sin(i + tl * 3) * 2.4, SLEEP, 0.4 * (1 - i / 12) * hands)
      return true
    }
    case 'nebula': { // stalking across, the cyborg arm sweeping
      const s = B.laneNebula, per = 3.6, k = (tl % per) / per, x = -8 + k * (W + 16), u = (tl * 0.9) % 1
      cv.hi(s, x, y0)
      const sx = x + s.w / 2 - 0.5, sy = mid + 0.5
      const a = u < 0.45 ? -1.7 : u < 0.62 ? -1.7 + 2.9 * easeIn((u - 0.45) / 0.17) : 1.2 - 0.2 * easeOut((u - 0.62) / 0.38)
      const ex = sx + (Math.cos(a) * 6) / PX, ey = sy + Math.sin(a) * 4.5
      if (u > 0.45 && u < 0.8) for (let i = 1; i < 12; i++) { const ta = a - i * 0.1; cv.glow(sx + (Math.cos(ta) * 6) / PX, sy + Math.sin(ta) * 4.5, i < 4 ? WHITE : BLUE, (1 - i / 12) * 0.7) }
      cv.line(sx, sy, ex, ey, STEEL); cv.glow(ex, ey, WHITE, 0.9); cv.radial(ex, ey, 1.6, RED, 0.8)
      return true
    }
    case 'yondu': { // the whistle, then the red arrow zips back and forth
      const s = B.laneYondu, per = 4.4, u = (tl % per) / per, x = 3
      cv.hi(s, x, y0)
      const mx = x + s.w / 4, my = y0 + s.h * 0.62
      if (u < 0.22) { for (let r = 0; r < 3; r++) ringOut(cv, mx, my, 6, (u * 8 + r * 0.33) % 1, PURPLE); note(cv, mx + 3, my - 2, BLUE, 0.9) }
      else {
        const k = clamp01((u - 0.22) / 0.7), leg = k < 0.5 ? easeInOut(k * 2) : 1 - easeInOut((k - 0.5) * 2), ax = mx + 3 + leg * (W - mx - 6), a = k * 30
        arrow(cv, ax, mid + Math.sin(a) * (H * 0.36), k < 0.5 ? 1 : -1, Math.cos(a) * 1.4, 1)
      }
      if (calm) arrow(cv, W * 0.4, mid, 1, 0, 1)
      return true
    }
  }
  return false
}
