import { expect } from 'claude-code/testing'
import { test } from './timed'
import { CLEAR, HOLE, Surface } from '../hooks/pixel'
import { ROSTER, STAGE, STAGE_ROWS, WORK_ROWS, drawWorking } from '../hooks/scenes'
import { guardianLane, guardianStage, GUARDIANS } from '../hooks/guardians'

const who = { name: 'x', model: 'opus' }
const usage = { percent: 40, tokens: 1000, cost: 1 }

test('every ROSTER hero: nothing but text and background right of the stage over 6 s, at several widths', { timeoutMs: 60000 }, () => {
  for (const cols of [60, 120, 180]) for (const act of ROSTER) {
    const s = new Surface(cols, WORK_ROWS)
    for (let t = 0; t <= 6; t += 0.1) {
      s.cv.clear()
      drawWorking(s.cv, { who, usage, calm: false, act, actAt: 0, tool: 'Bash', detail: 'x', line: 'y', lineAt: 0, elapsed: '1s', tools: 1, log: [], lane: true }, t)
      for (let y = 0; y < STAGE_ROWS * 2; y++) for (let x = STAGE * 2; x < s.cv.W; x++) {
        const c = s.cv.px[y * s.cv.W + x]!
        if (c !== CLEAR && c !== HOLE) throw new Error(`${act} paints content cell x=${x} y=${y} at t=${t.toFixed(1)} w=${cols}`)
      }
    }
  }
})

test('Guardian lane and stage effects stay in their own boxes before the fence', () => {
  for (const act of GUARDIANS) {
    const s = new Surface(120, WORK_ROWS)
    let esc = 0
    for (let t = 0; t <= 8; t += 0.05) {
      s.cv.clear()
      guardianLane(s.cv, STAGE_ROWS * 2, 8, 120, act, t, false)
      for (let y = 0; y < STAGE_ROWS * 2; y++) for (let x = STAGE * 2; x < s.cv.W; x++) if (s.cv.px[y * s.cv.W + x] !== CLEAR) esc++
    }
    expect(esc).toBe(0)
    for (let t = 0; t <= 8; t += 0.05) {
      s.cv.clear()
      guardianStage(s.cv, act, t, false, STAGE, STAGE_ROWS * 2)
      for (let y = 0; y < s.cv.h; y++) for (let x = STAGE * 2 + 2; x < s.cv.W; x++) if (s.cv.px[y * s.cv.W + x] !== CLEAR) esc++
    }
    expect(esc).toBe(0)
  }
})
