// clarvis arcade: VERSUS. Four fights off the title menu:
//   CIVIL WAR   the airport: pick a side, draft 3, tag-team the AI's 3 (Z tags)
//   ARENA I     Iron Man vs Thor by default; any fighter vs any fighter
//   ARENA II    Hulkbuster vs Hulk by default; any fighter vs any fighter
//   ENDGAME     your Avenger (with assists) against Thanos and his snap
// 16 fighters, each with a film-true special (C) and super (X). Taps, not
// holds (a terminal sends no key-up): a tap is a step, a double tap runs, ↓
// raises guard for 0.6 s and its first 0.2 s PARRY. SPACE x3 is a chain that
// cancels into C, then X; → then SPACE up close throws (it beats guard). Hit-
// stop, shake, KO splashes, lines from the films, a ranked results screen.
// It borrows the siege's screen, effects and HUD (the host Game) and keeps
// every pool fixed. Sprites scale with the pane: a fighter is about half the
// arena at any size, so an 11-row inline pane still shows the whole fight.
import * as FT from './arcade-fighters'
import { C, Game, addc, ease, mix, scaleSpr, sprites, unb64, type Run, type Spr, type SubGame } from './arcade-engine'

export type HeroId = 'CAP' | 'IRONMAN' | 'THOR' | 'HULK' | 'HULKBUSTER' | 'THANOS' | 'BUCKY' | 'FALCON' | 'ANTMAN' | 'HAWKEYE' | 'WANDA' | 'WARMACHINE' | 'WIDOW' | 'PANTHER' | 'SPIDEY' | 'VISION'
type ShotKind = 'shield' | 'repulsor' | 'bigrep' | 'hammer' | 'blast' | 'rocket' | 'redwing' | 'arrow' | 'xarrow' | 'hex' | 'bullet' | 'web'
type MoveKind = 'shot' | 'dash' | 'flurry' | 'beam' | 'sky' | 'quake' | 'grab' | 'giant' | 'snap' | 'blink' | 'dive' | 'phase' | 'burst'
type Move = { k: MoveKind; name: string; dmg: number; at: number; dur: number; shot?: ShotKind; spd?: number; n?: number; c?: number; gb?: boolean; unbl?: boolean; stun?: number; heal?: number; range?: number }
type Stats = { name: string; short: string; hp: number; speed: number; punch: number; reach: number; color: number; win: string; enter: string; who: string; cd: number; sp: Move; su: Move; bars: [number, number, number]; bias: 'zone' | 'rush' | 'throw' | 'wait' | 'none'; lines: string[] }

// Every fighter: numbers, colours, words and moves. bars = POWER, SPEED, RANGE (1-5) on the select screen.
export const STATS: Record<HeroId, Stats> = {
  CAP: { name: 'CAPTAIN AMERICA', short: 'CAP', who: 'CAP', hp: 100, speed: 34, punch: 6, reach: 11, color: 0x4a7cf0, win: 'I CAN DO THIS ALL DAY', enter: 'I could do this all day.', cd: 1.6, bars: [3, 4, 3], bias: 'none', lines: ['Language!', "I'm with you till the end of the line."],
    sp: { k: 'shot', name: 'SHIELD THROW', shot: 'shield', dmg: 8, at: 0.12, dur: 0.38, spd: 120 }, su: { k: 'dash', name: 'ON YOUR LEFT', dmg: 15, at: 0.05, dur: 0.6, spd: 150, heal: 8, gb: true } },
  IRONMAN: { name: 'IRON MAN', short: 'IRON MAN', who: 'TONY', hp: 100, speed: 32, punch: 5, reach: 10, color: 0xe63a2e, win: 'I AM IRON MAN', enter: 'Genius, billionaire, playboy, philanthropist.', cd: 1.1, bars: [3, 3, 5], bias: 'zone', lines: ['I am Iron Man.', 'Underoos!'],
    sp: { k: 'shot', name: 'REPULSOR', shot: 'repulsor', dmg: 6, at: 0.12, dur: 0.38, spd: 170 }, su: { k: 'beam', name: 'UNIBEAM', dmg: 16, at: 0.25, dur: 1.0, c: 0x7fe9ff } },
  THOR: { name: 'THOR', short: 'THOR', who: 'THOR', hp: 110, speed: 30, punch: 6.5, reach: 12, color: 0x9db8ff, win: 'ANOTHER!', enter: 'You have no idea what you are dealing with.', cd: 1.8, bars: [4, 3, 4], bias: 'zone', lines: ['Bring me Thanos!', "I'm still worthy!"],
    sp: { k: 'shot', name: 'MJOLNIR THROW', shot: 'hammer', dmg: 9, at: 0.12, dur: 0.38, spd: 130 }, su: { k: 'sky', name: 'GOD OF THUNDER', dmg: 16, at: 0.6, dur: 0.9 } },
  HULK: { name: 'HULK', short: 'HULK', who: 'HULK', hp: 115, speed: 30, punch: 7.5, reach: 14, color: 0x72c44c, win: 'HULK SMASH!', enter: "That's my secret: I'm always angry.", cd: 2, bars: [5, 3, 2], bias: 'rush', lines: ['Puny god.', 'HULK SMASH!'],
    sp: { k: 'dash', name: 'SHOULDER CHARGE', dmg: 11, at: 0.08, dur: 0.42, spd: 150 }, su: { k: 'quake', name: 'WORLD BREAKER', dmg: 17, at: 0.3, dur: 1.1 } },
  HULKBUSTER: { name: 'HULKBUSTER', short: 'BUSTER', who: 'TONY', hp: 145, speed: 24, punch: 8, reach: 14, color: 0xf04838, win: 'GO TO SLEEP', enter: 'Veronica.', cd: 1.4, bars: [5, 2, 3], bias: 'none', lines: ['Go to sleep, go to sleep, go to sleep!', 'Veronica.'],
    sp: { k: 'shot', name: 'ROCKET FIST', shot: 'rocket', dmg: 9, at: 0.14, dur: 0.4, spd: 140 }, su: { k: 'flurry', name: 'GO TO SLEEP', dmg: 2.4, n: 8, at: 0.05, dur: 1.2, spd: 60 } },
  THANOS: { name: 'THANOS', short: 'THANOS', who: 'THANOS', hp: 150, speed: 24, punch: 9, reach: 15, color: 0xb084e0, win: 'I AM INEVITABLE', enter: 'I am inevitable.', cd: 2.2, bars: [5, 2, 4], bias: 'wait', lines: ['Dread it. Run from it. Destiny arrives all the same.', 'You should have gone for the head.'],
    sp: { k: 'blink', name: 'POWER / SPACE STONE', shot: 'blast', dmg: 9, at: 0.12, dur: 0.4, spd: 110 }, su: { k: 'snap', name: 'THE SNAP', dmg: 0, at: 2.0, dur: 2.3 } },
  BUCKY: { name: 'WINTER SOLDIER', short: 'BUCKY', who: 'BUCKY', hp: 100, speed: 33, punch: 7, reach: 11, color: 0x9aa8c0, win: 'READY TO COMPLY', enter: 'Who the hell is Bucky?', cd: 1.5, bars: [4, 4, 2], bias: 'rush', lines: ['Ready to comply.', 'Who the hell is that?'],
    sp: { k: 'grab', name: 'METAL GRAB', dmg: 10, at: 0.2, dur: 0.45, range: 15, unbl: true }, su: { k: 'flurry', name: 'WINTER SOLDIER', dmg: 3.2, n: 5, at: 0.05, dur: 0.75, spd: 90 } },
  FALCON: { name: 'FALCON', short: 'FALCON', who: 'SAM', hp: 95, speed: 36, punch: 5, reach: 10, color: 0xd8dce6, win: 'ON YOUR LEFT', enter: 'On your left.', cd: 1.5, bars: [3, 5, 4], bias: 'zone', lines: ['On your left.', 'I do what he does, just slower.'],
    sp: { k: 'shot', name: 'REDWING', shot: 'redwing', dmg: 7, at: 0.12, dur: 0.38, spd: 90 }, su: { k: 'dive', name: 'DIVE STRAFE', dmg: 15, at: 0.45, dur: 1.0 } },
  ANTMAN: { name: 'ANT-MAN', short: 'ANT-MAN', who: 'SCOTT', hp: 95, speed: 34, punch: 5, reach: 10, color: 0xe42a36, win: 'GIANT-MAN!', enter: 'Hey, Cap!', cd: 1.4, bars: [3, 4, 2], bias: 'none', lines: ['I got something kinda big, but I do not know how long I can hold it.', 'Is this legal?'],
    sp: { k: 'dash', name: 'SHRINK', dmg: 8, at: 0.05, dur: 0.35, spd: 160 }, su: { k: 'giant', name: 'GIANT-MAN', dmg: 0, at: 0.1, dur: 0.7 } },
  HAWKEYE: { name: 'HAWKEYE', short: 'HAWKEYE', who: 'CLINT', hp: 95, speed: 32, punch: 5, reach: 10, color: 0x9a6ad8, win: 'NEVER MISS', enter: 'We are fighting an army of robots, and I have a bow and arrow.', cd: 0.9, bars: [3, 3, 5], bias: 'zone', lines: ['We are still friends, right?', 'Nothing personal.'],
    sp: { k: 'shot', name: 'TRICK ARROW', shot: 'arrow', dmg: 6, at: 0.1, dur: 0.32, spd: 200 }, su: { k: 'shot', name: 'EXPLOSIVE VOLLEY', shot: 'xarrow', dmg: 6, n: 3, at: 0.15, dur: 0.6, spd: 110 } },
  WANDA: { name: 'SCARLET WITCH', short: 'WANDA', who: 'WANDA', hp: 90, speed: 30, punch: 5, reach: 10, color: 0xff3a5a, win: 'IT IS NOT YOUR FAULT', enter: 'I cannot control their fear, only my own.', cd: 1.5, bars: [4, 3, 5], bias: 'zone', lines: ['It is not your fault.', 'Stop!'],
    sp: { k: 'shot', name: 'HEX BOLT', shot: 'hex', dmg: 9, at: 0.14, dur: 0.4, spd: 80, stun: 0.4 }, su: { k: 'grab', name: 'HEX LIFT', dmg: 16, at: 0.3, dur: 1.0, range: 70, unbl: true } },
  WARMACHINE: { name: 'WAR MACHINE', short: 'RHODEY', who: 'RHODEY', hp: 115, speed: 26, punch: 7, reach: 11, color: 0x8a92a2, win: 'NEXT TIME, BABY', enter: "War Machine, rollin' out.", cd: 1.3, bars: [4, 2, 4], bias: 'zone', lines: ['Next time, baby.', 'Lock and load.'],
    sp: { k: 'shot', name: 'SHOULDER BURST', shot: 'bullet', dmg: 1.8, n: 6, at: 0.1, dur: 0.5, spd: 220 }, su: { k: 'shot', name: 'FULL ARSENAL', shot: 'rocket', dmg: 7, n: 3, at: 0.2, dur: 0.8, spd: 130 } },
  WIDOW: { name: 'BLACK WIDOW', short: 'WIDOW', who: 'NAT', hp: 90, speed: 37, punch: 5, reach: 10, color: 0x6ad0ff, win: 'DEPENDS HOW HARD YOU HIT', enter: 'I am always picking up after you boys.', cd: 1.3, bars: [3, 5, 2], bias: 'throw', lines: ['Depends on how hard you hit me.', 'We are still friends, right?'],
    sp: { k: 'dash', name: "WIDOW'S BITE", dmg: 7, at: 0.05, dur: 0.25, spd: 140, stun: 0.6 }, su: { k: 'grab', name: 'SCISSOR TAKEDOWN', dmg: 14, at: 0.15, dur: 0.7, range: 16, unbl: true } },
  PANTHER: { name: 'BLACK PANTHER', short: 'PANTHER', who: "T'CHALLA", hp: 105, speed: 36, punch: 6, reach: 11, color: 0xa47cf0, win: 'WAKANDA FOREVER', enter: 'In my culture, death is not the end.', cd: 1.2, bars: [4, 5, 2], bias: 'rush', lines: ['Wakanda forever!', 'In my culture, death is not the end.'],
    sp: { k: 'dash', name: 'CLAW POUNCE', dmg: 9, at: 0.05, dur: 0.3, spd: 170 }, su: { k: 'burst', name: 'KINETIC BURST', dmg: 10, at: 0.25, dur: 0.7, range: 34 } },
  SPIDEY: { name: 'SPIDER-MAN', short: 'SPIDEY', who: 'PETER', hp: 90, speed: 38, punch: 5, reach: 10, color: 0xe42a36, win: 'HEY EVERYONE', enter: 'Hey, everyone.', cd: 1.1, bars: [2, 5, 4], bias: 'none', lines: ['You have a metal arm? That is awesome, dude!', 'Hey, everyone.'],
    sp: { k: 'shot', name: 'WEB SHOT', shot: 'web', dmg: 4, at: 0.1, dur: 0.32, spd: 150, stun: 1 }, su: { k: 'grab', name: 'WEB-UP', dmg: 14, at: 0.25, dur: 0.8, range: 80, unbl: true } },
  VISION: { name: 'VISION', short: 'VISION', who: 'VISION', hp: 105, speed: 30, punch: 6, reach: 11, color: 0xf4cc40, win: "I'M ON THE SIDE OF LIFE", enter: 'Our very strength invites challenge.', cd: 1.6, bars: [4, 3, 5], bias: 'zone', lines: ["I'm on the side of life.", 'Our very strength invites challenge.'],
    sp: { k: 'beam', name: 'MIND BEAM', dmg: 8, at: 0.12, dur: 0.5, c: 0xffe066 }, su: { k: 'phase', name: 'DENSITY', dmg: 16, at: 1.0, dur: 1.4, unbl: true } },
}
export const ROSTER = Object.keys(STATS) as HeroId[]
export const TEAM_CAP: HeroId[] = ['CAP', 'BUCKY', 'FALCON', 'ANTMAN', 'HAWKEYE', 'WANDA']
export const TEAM_IRON: HeroId[] = ['IRONMAN', 'WARMACHINE', 'WIDOW', 'PANTHER', 'SPIDEY', 'VISION']
const MOVIE: Record<'cap' | 'iron', HeroId[]> = { cap: ['CAP', 'BUCKY', 'ANTMAN'], iron: ['IRONMAN', 'SPIDEY', 'PANTHER'] }

// AI tiers (picked with ↑↓ on the select screen): reaction s, guard, parry, chain, anti-air, special use
export const TIERS = [
  { name: 'RECRUIT', react: 0.45, guard: 0.15, parry: 0, chain: 0.25, air: 0.1, spec: 0.08 },
  { name: 'AVENGER', react: 0.3, guard: 0.35, parry: 0.08, chain: 0.5, air: 0.4, spec: 0.35 },
  { name: "EARTH'S MIGHTIEST", react: 0.2, guard: 0.55, parry: 0.2, chain: 0.75, air: 0.7, spec: 0.5 },
  { name: 'INEVITABLE', react: 0.14, guard: 0.7, parry: 0.35, chain: 0.9, air: 0.9, spec: 0.6 },
] as const

type Arena = { title: string; sky: [number, number][]; ground: [number, number]; scroll: number; p: HeroId; ai: HeroId; color: number }
const ARENAS: Record<number, Arena> = {
  1: { title: 'CIVIL WAR', color: 0x2a5cc4, scroll: 40, ground: [0x5a5e66, 0x34363e], sky: [[0, 0x3a4658], [0.5, 0x6a7688], [0.85, 0x8a96a8], [1, 0xa4aebe]], p: 'CAP', ai: 'IRONMAN' },
  2: { title: 'IRON MAN VS THOR', color: 0x6a48d0, scroll: 300, ground: [0x1e2a22, 0x0e1610], sky: [[0, 0x050a08], [0.5, 0x0e1a14], [0.85, 0x1a2a22], [1, 0x283a30]], p: 'IRONMAN', ai: 'THOR' },
  3: { title: 'HULKBUSTER VS HULK', color: 0x2f8a38, scroll: 600, ground: [0x5a4a3a, 0x3a2a1e], sky: [[0, 0x3a2418], [0.45, 0x7a4a2a], [0.8, 0xc08040], [1, 0xe0a060]], p: 'HULKBUSTER', ai: 'HULK' },
  4: { title: 'ENDGAME', color: 0x8a3cb8, scroll: 900, ground: [0x3a2a24, 0x1e1410], sky: [[0, 0x140a08], [0.4, 0x3a1a10], [0.75, 0x8a4020], [1, 0xa0502a]], p: 'IRONMAN', ai: 'THANOS' },
}
// Lines from the films for a matchup; else each fighter's own entry line.
const BANTER: Record<string, [HeroId, string][]> = {
  'CAP|IRONMAN': [['CAP', 'I could do this all day.'], ['IRONMAN', 'Yeah, I know. I know you could.']],
  'IRONMAN|CAP': [['IRONMAN', 'You are not the only one cursed with knowledge.'], ['CAP', "I'm sorry, Tony. You know I wouldn't do this if I had any other choice."]],
  'IRONMAN|THOR': [['THOR', 'You have no idea what you are dealing with.'], ['IRONMAN', 'Uh, Shakespeare in the park? Doth mother know you weareth her drapes?']],
  'HULKBUSTER|HULK': [['IRONMAN', 'Bruce, if you can hear me... go to sleep.'], ['HULK', 'RAAAGH!']],
  'SPIDEY|CAP': [['CAP', 'Where are you from, kid?'], ['SPIDEY', 'Queens.']],
  'CAP|SPIDEY': [['SPIDEY', 'Cap... Captain. Big fan. I am Spider-Man.'], ['CAP', 'Queens. Nice.']],
  'WIDOW|HAWKEYE': [['WIDOW', 'We are still friends, right?'], ['HAWKEYE', 'That depends on how hard you hit me.']],
  'HAWKEYE|WIDOW': [['WIDOW', 'We are still friends, right?'], ['HAWKEYE', 'That depends on how hard you hit me.']],
  'PANTHER|BUCKY': [['PANTHER', 'Captain Rogers, I am going to kill him.'], ['BUCKY', 'Who the hell is that?']],
  'BUCKY|PANTHER': [['BUCKY', 'Who the hell is that?'], ['PANTHER', 'You killed my father.']],
  'BUCKY|SPIDEY': [['SPIDEY', 'You have a metal arm? That is awesome, dude!'], ['BUCKY', '...']],
  'VISION|WANDA': [['VISION', 'I am sorry, Wanda.'], ['WANDA', 'I cannot control their fear, only my own.']],
  'WANDA|VISION': [['WANDA', 'I cannot control their fear, only my own.'], ['VISION', 'Then let me help you.']],
  'FALCON|SPIDEY': [['SPIDEY', 'You have got wings! Okay. That is cool.'], ['FALCON', 'Redwing. Go.']],
  'ANTMAN|IRONMAN': [['ANTMAN', 'Hey, Captain America! I am shaking your hand too long.'], ['IRONMAN', 'Okay, who is the new guy?']],
  'WARMACHINE|FALCON': [['WARMACHINE', 'I got the bird.'], ['FALCON', 'Bring it, Rhodey.']],
}

// frames of every fighter sheet (see arcade-fighters.ts)
const F_IDLE = 0, F_WALK = 2, F_PUNCH = 4, F_SPECIAL = 5, F_BLOCK = 6, F_HURT = 7, F_JUMP = 8, F_SUPER = 9, F_KO = 10
type Base = Spr & { ax: number; ay: number; hand: number[] }
let BASES: Record<HeroId, Base> | undefined
function bases() {
  return (BASES ??= Object.fromEntries(ROSTER.map(id => {
    const f = FT[id], b = unb64(f.data), N = f.w * f.h * f.n, px = new Int32Array(N), a = new Uint8Array(N)
    for (let i = 0; i < N; i++) { const k = b[i]!; if (k) { px[i] = f.pal[k - 1]!; a[i] = 255 } }
    return [id, { w: f.w, h: f.h, n: f.n, px, a, ax: f.ax, ay: f.ay, hand: f.hand }]
  })) as Record<HeroId, Base>)
}
type Sheet = Spr & { ax: number; ay: number; k: number; base: Base }
function sheetOf(id: HeroId, k: number): Sheet {
  const b = bases()[id], s = scaleSpr(b, k), kk = s.w / b.w
  return { ...s, ax: b.ax * kk, ay: b.ay * kk, k: kk, base: b }
}

type St = 'idle' | 'walk' | 'run' | 'jump' | 'punch' | 'special' | 'super' | 'block' | 'hurt' | 'ko'
export type Fighter = {
  id: HeroId; s: Stats; ai: boolean; x: number; y: number; vx: number; vy: number; face: 1 | -1
  hp: number; shown: number; trail: number; trailT: number; red: number; meter: number; st: St; t: number; cd: number
  blockT: number; guardAt: number; blockAt: number; parried: boolean
  stepT: number; stepDir: number; lastTap: number; lastTapDir: number; fwdAt: number
  chain: number; buffer: boolean; landed: boolean; hitDone: boolean; fired: number; flash: number
  wins: number; stones: number; combo: number; comboT: number; maxChain: number; parries: number; tookSuper: boolean; superHit: boolean
  armed: boolean; think: number; stun: number; giant: number; phase: number; absorb: number; out: boolean; mv: Move | undefined
  hits: number; mark: number; tagCd: number; react: number; last: string[]; punish: boolean; whiff: boolean; woke: boolean; lag: number; launched: boolean; shy: number
}
type Shot = { on: boolean; owner: number; kind: ShotKind; x: number; y: number; vx: number; vy: number; t: number; dmg: number; back: boolean; stun: number; unbl: boolean; hitAt: number }
type Phase = 'select' | 'vs' | 'charge' | 'intro' | 'fight' | 'swap' | 'ko' | 'match' | 'finisher'
const NSHOT = 16
const STEP_T = 0.12, GUARD_T = 0.6, PARRY_T = 0.2, CHAIN_T = 0.28

export class Versus implements SubGame {
  phase: Phase = 'select'
  pt = 0
  gi = 1 // which game: 1 civil war, 2 arena I, 3 arena II, 4 endgame
  round = 1; clock = 60; paused = false; quitArmed = false; tier = 1; tierNow = 1
  // the select screens
  step = 0; cur = 0; side: 'cap' | 'iron' = 'cap'; squad: HeroId[] = []; pick: HeroId = 'IRONMAN'; foe: HeroId = 'IRONMAN'
  T: Fighter[][] = [[], []]; act = [0, 0]
  S: Shot[] = []
  splash = ''; splashC = 0xffffff; splashT = -9; sub = ''; splashLen = 2.2
  koWinner = -1; matchWon = false; snapPend = false; snapUsed = false; snapFlash = -9
  bolt = { on: false, t: 0, x: 0 }
  wipe = { on: false, t: 0, left: true }
  assistUsed = [false, false, false]; assistFx = { kind: -1, t: 0, x: 0 }; assistIds: HeroId[] = ['CAP', 'THOR', 'HULK']
  unlocked = 4 // every fight open from the start: the title menu offers them all
  beam = { on: false, t: 0, owner: 0, c: 0x7fe9ff, th: 3 }
  quake = { on: false, t: 0, x: 0 }
  dust = { on: false, t: 0 }
  portals = { done: false, t: -1 }
  power400 = 0
  continueT = -1
  spideyIn = false; giantSaid = false
  later: { at: number; who: string; c: number; line: string } | undefined
  k = 1; lastH = 0
  rank = 'C'
  // each fighter's last drawn box (px): text never sits on it (and the tests check)
  boxes: { x0: number; y0: number; x1: number; y1: number }[] = [{ x0: 0, y0: 0, x1: 0, y1: 0 }, { x0: 0, y0: 0, x1: 0, y1: 0 }]
  stats = { rounds: 0, playerWins: 0 }
  constructor(readonly g: Game) {
    for (let i = 0; i < NSHOT; i++) this.S.push({ on: false, owner: 0, kind: 'repulsor', x: 0, y: 0, vx: 0, vy: 0, t: 0, dmg: 0, back: false, stun: 0, unbl: false, hitAt: -9 })
    this.T = [[this.fighter('CAP', false)], [this.fighter('IRONMAN', true)]]
  }
  get P(): [Fighter, Fighter] { return [this.T[0]![this.act[0]!]!, this.T[1]![this.act[1]!]!] }
  get team() { return this.gi === 1 }
  get A() { return this.g.H }
  get gy() { return this.g.H - Math.max(2, Math.round(3 * this.k)) }
  get T0() { return TIERS[this.tierNow]! }
  private fighter(id: HeroId, ai: boolean): Fighter {
    const s = STATS[id]
    return { id, s, ai, x: 0, y: 0, vx: 0, vy: 0, face: 1, hp: s.hp, shown: s.hp, trail: s.hp, trailT: 0, red: s.hp, meter: 0, st: 'idle', t: 0, cd: 0, blockT: 0, guardAt: -9, blockAt: -9, parried: false, stepT: 0, stepDir: 0, lastTap: -9, lastTapDir: 0, fwdAt: -9, chain: 0, buffer: false, landed: false, hitDone: false, fired: 0, flash: 0, wins: 0, stones: 0, combo: 0, comboT: 0, maxChain: 0, parries: 0, tookSuper: false, superHit: false, armed: true, think: 0.6, stun: 0, giant: 0, phase: 0, absorb: 0, out: false, mv: undefined, hits: 0, mark: 0, tagCd: 0, react: -1, last: [], punish: false, whiff: false, woke: false, lag: 0, launched: false, shy: 0 }
  }
  private rescale() {
    // a fighter is about half the arena's height at any size (mini on 11 rows, 2x on 60)
    this.lastH = this.g.H
    this.k = Math.max(0.26, Math.min(2, this.g.H / 64))
  }
  private sheet(f: Fighter) { return sheetOf(f.id, this.k * (f.giant > 0 ? 2 : 1)) }

  // ── flow ─────────────────────────────────────────────────────────────────
  enter() { this.start(this.gi) }
  // From the menu: the select screen of game gi (HOW TO PLAY comes after the picks).
  start(gi: number) {
    this.gi = Math.max(1, Math.min(4, gi)); this.rescale()
    const a = ARENAS[this.gi]!
    this.g.setSky(a.sky); this.g.scroll = a.scroll
    this.phase = 'select'; this.pt = 0; this.paused = false; this.quitArmed = false; this.continueT = -1
    this.step = 0; this.squad = []
    if (this.gi === 1) this.cur = this.side === 'cap' ? 0 : 1
    else { if (this.gi !== 4 || this.pick === 'THANOS') this.pick = a.p; this.foe = a.ai; this.cur = ROSTER.indexOf(this.pick) }
    this.g.talk('JARVIS', C.arc, this.gi === 1 ? 'The airport, sir. Choose a side.' : this.gi === 4 ? 'Thanos. Choose who faces him, sir.' : 'Choose your fighter, sir.')
  }
  private list(): (HeroId | 'RANDOM')[] {
    if (this.gi === 1) return this.side === 'cap' ? TEAM_CAP : TEAM_IRON
    if (this.gi === 4) return [...ROSTER.filter(h => h !== 'THANOS'), 'RANDOM']
    return [...ROSTER, 'RANDOM']
  }
  private rnd<T>(xs: readonly T[]): T { return xs[Math.floor(this.g.rnd() * xs.length)]! }
  private confirm() {
    const L = this.list(), at = L[this.cur]!
    if (this.gi === 1) {
      if (this.step === 0) { this.side = this.cur === 0 ? 'cap' : 'iron'; this.step = 1; this.cur = 0; this.squad = []; this.g.talk('JARVIS', C.arc, 'Draft three. The order is the tag order. A picks the movie trio.'); return }
      const id = at as HeroId, i = this.squad.indexOf(id)
      if (i >= 0) this.squad.splice(i, 1)
      else if (this.squad.length < 3) {
        this.squad.push(id)
        // on to the next one not yet drafted, so SPACE, SPACE, SPACE fills the team
        for (let k = 1; k <= L.length; k++) { const j = (this.cur + k) % L.length; if (!this.squad.includes(L[j] as HeroId)) { this.cur = j; break } }
      }
      if (this.squad.length === 3) this.ready()
      return
    }
    const id = at === 'RANDOM' ? this.rnd(this.gi === 4 ? ROSTER.filter(h => h !== 'THANOS') : ROSTER) : at
    if (at === 'RANDOM') this.g.talk(STATS[id].who, STATS[id].color, STATS[id].enter)
    if (this.step === 0) {
      this.pick = id
      if (this.gi === 4) { this.foe = 'THANOS'; this.ready(); return }
      this.step = 1; this.cur = ROSTER.indexOf(this.foe === id ? (id === 'THOR' ? 'IRONMAN' : 'THOR') : this.foe)
      this.g.talk('JARVIS', C.arc, 'And who are we fighting, sir?')
      return
    }
    this.foe = id; this.ready()
  }
  private autoPick() {
    if (this.gi === 1 && this.step === 1) { this.squad = [...MOVIE[this.side]]; this.ready(); return }
    if (this.gi === 1) { this.cur = this.g.rnd() < 0.5 ? 0 : 1; this.confirm(); return }
    this.cur = this.list().length - 1; this.confirm()
  }
  // the picks are in: HOW TO PLAY (every time), then the fight
  private ready() { this.paused = false; this.quitArmed = false; this.g.howtoThen(this.gi) }
  // Fills both teams and starts: the VS screen (duels) or THE CHARGE (Civil War).
  begin() {
    this.paused = false; this.quitArmed = false
    const a = ARENAS[this.gi]!
    let mine: HeroId[], theirs: HeroId[]
    if (this.gi === 1) { mine = this.squad.length === 3 ? [...this.squad] : [...MOVIE[this.side]]; theirs = [...MOVIE[this.side === 'cap' ? 'iron' : 'cap']] }
    else { mine = [this.pick]; theirs = [this.foe] }
    this.T = [mine.map(h => this.fighter(h, false)), theirs.map(h => this.fighter(h, true))]
    this.act = [0, 0]; this.round = 1; this.spideyIn = false; this.giantSaid = false; this.snapUsed = false; this.portals = { done: false, t: -1 }; this.tierNow = this.tier
    this.assistIds = ['CAP', 'THOR', 'HULK'].map(h => (h === this.pick ? 'IRONMAN' : h)) as HeroId[]
    this.g.setSky(a.sky); this.g.scroll = a.scroll
    this.startRound()
    this.phase = this.team ? 'charge' : 'vs'; this.pt = 0
  }
  private startRound() {
    const W = this.g.W
    for (const [side, team] of this.T.entries()) for (const f of team) {
      Object.assign(f, { hp: f.s.hp, shown: f.s.hp, trail: f.s.hp, red: f.s.hp, meter: Math.min(f.meter, 50), st: 'idle', t: 0, cd: 0, blockT: 0, stepT: 0, vx: 0, vy: 0, flash: 0, combo: 0, armed: true, think: 0.8, stun: 0, giant: 0, phase: 0, out: false, mv: undefined, tagCd: 0, chain: 0, buffer: false, react: -1 })
      f.x = side === 0 ? W * 0.25 : W * 0.75; f.y = this.gy; f.face = side === 0 ? 1 : -1
    }
    this.act = [0, 0]
    for (const s of this.S) s.on = false
    this.clock = this.team ? 99 : 60; this.phase = 'intro'; this.pt = 0; this.snapPend = false; this.beam.on = false; this.quake.on = false; this.bolt.on = false; this.wipe.on = false; this.dust.on = false; this.assistFx.kind = -1; this.assistUsed = [false, false, false]; this.power400 = 0
    this.banter()
  }
  private banter() {
    const [a, b] = this.P
    const lines = BANTER[a.id + '|' + b.id] ?? [[a.id, a.s.enter], [b.id, b.s.enter]] as [HeroId, string][]
    const [who, line] = lines[(this.round - 1) % lines.length]!
    this.g.talk(STATS[who].who, STATS[who].color, line)
    const nx = lines[this.round % lines.length]!
    if (nx[0] !== who) this.later = { at: this.g.t + 1.8, who: STATS[nx[0]].who, c: STATS[nx[0]].color, line: nx[1] }
  }
  private endRound(winner: number, why: 'ko' | 'time') {
    if (this.phase !== 'fight' && this.phase !== 'swap') return
    const [a, b] = this.P, w = winner === 0 ? a : b, l = winner === 0 ? b : a
    this.stats.rounds++; if (winner === 0) this.stats.playerWins++
    // rubber band: a lopsided AI round 1 drops it a tier
    if (!this.team && this.round === 1 && winner === 1 && w.hp / w.s.hp > 0.6 && this.tierNow > 0) this.tierNow--
    this.phase = 'ko'; this.pt = 0; this.koWinner = winner
    w.wins++
    l.st = 'ko'; l.t = 0; l.vx = w.face * 40 * this.k; l.vy = -60 * this.k
    this.kick(18, 10, 0.6, 0xffffff)
    this.g.slow = 0.6
    const winSide = winner === 0 ? this.side : this.side === 'cap' ? 'iron' : 'cap'
    this.say(why === 'time' ? 'TIME' : 'K.O.', why === 'time' ? C.gold2 : 0xff5a4a, this.team ? (winSide === 'cap' ? 'TEAM CAP WINS' : 'TEAM IRON MAN WINS') : w.s.win, 1.8)
    if (this.gi === 4 && winner === 0 && w.wins >= 2) { l.st = 'hurt'; l.vx = 0; l.vy = 0; this.phase = 'finisher'; this.pt = 0; this.splash = ''; this.g.talk('TONY', 0xe63a2e, 'And I... am... Iron Man.'); return }
    if (this.gi === 4 && winner === 1 && l.id === 'SPIDEY') { this.g.talk('PETER', l.s.color, "Mr. Stark, I don't feel so good."); return }
    this.g.talk(w.s.who, w.s.color, w.s.lines[0]!)
  }
  private finishMatch() {
    const won = this.koWinner === 0
    this.phase = 'match'; this.pt = 0; this.matchWon = won; this.continueT = won ? -1 : 9.99
    // rank: life left, time left, best chain, parries, no super taken
    const me = this.T[0]!, hp = me.reduce((n, f) => n + (f.out ? 0 : Math.max(0, f.hp)), 0) / me.reduce((n, f) => n + f.s.hp, 0)
    const pts = 200 * hp + (this.clock / (this.team ? 99 : 60)) * 100 + Math.max(...me.map(f => f.maxChain)) * 20 + me.reduce((n, f) => n + f.parries, 0) * 50 + (me.some(f => f.tookSuper) ? 0 : 60)
    this.rank = !won ? 'C' : pts >= 330 ? 'S' : pts >= 240 ? 'A' : pts >= 150 ? 'B' : 'C'
    this.g.talk('JARVIS', C.arc, won ? (this.gi === 1 ? 'The airport is ours, sir.' : this.gi === 4 ? 'Avengers assembled. It has been an honour, sir.' : 'Victory, sir.') : 'A loss, sir. Continue?')
  }

  // ── input ────────────────────────────────────────────────────────────────
  // Q in a fight pauses with QUIT armed; a second Q quits: one press never loses a match.
  // Q (or Esc): on the select and results screens it goes back to the menu; anywhere in a
  // match it pauses with QUIT armed, and only a second Q closes the arcade.
  quit(): boolean {
    if (this.phase === 'select' || this.phase === 'match') { this.toMenu(); return true }
    if (this.paused && this.quitArmed) return false
    this.paused = true; this.quitArmed = true; return true
  }
  key(key: string) {
    const fire = key === ' ' || key === 'space' || key === 'return' || key === 'enter'
    const back = key === 'b' || key === 'backspace' || key === 'escape'
    if (this.phase === 'select') {
      const L = this.list(), draft = this.gi === 1 && this.step === 1
      if (back) { if (this.step > 0) { this.step--; this.cur = this.gi === 1 ? (this.side === 'cap' ? 0 : 1) : ROSTER.indexOf(this.pick); this.squad = [] } else this.toMenu(); return }
      const n = this.gi === 1 && this.step === 0 ? 2 : L.length
      if (key === 'left' || (key === 'a' && !draft)) this.cur = (this.cur + n - 1) % n
      else if (key === 'right' || key === 'd') this.cur = (this.cur + 1) % n
      else if (key === 'up' || key === 'w') { if (draft) this.cur = (this.cur + 3) % n; else this.tier = Math.min(3, this.tier + 1) }
      else if (key === 'down' || key === 's') { if (draft) this.cur = (this.cur + 3) % n; else this.tier = Math.max(0, this.tier - 1) }
      else if (key === 'r' || (key === 'a' && draft)) this.autoPick()
      else if (fire) this.confirm()
      return
    }
    if (this.phase === 'match') {
      if (this.continueT > 0 && fire) { this.continue1(); return }
      if (key === 'r' || (fire && this.continueT <= 0)) { this.ready(); return } // rematch, same picks (HOW TO PLAY first)
      if (key === 's') { this.start(this.gi); return }
      if (key === 'm' || back) { this.toMenu(); return }
      if (key === 'n' && this.gi < 4) this.start(this.gi + 1)
      return
    }
    if (this.phase === 'vs' || this.phase === 'charge') { if (fire || back) this.toFight(); return }
    if (key === 'p') { this.paused = !this.paused; this.quitArmed = false; if (this.paused) this.g.talk('JARVIS', C.arc, 'Holding the timeline, sir.'); return }
    if (this.paused) { if (back || key === 'm') this.toMenu(); else if (key === 'r') this.ready(); else if (key === 's') this.start(this.gi); return }
    if (this.phase === 'intro' && fire) { this.phase = 'fight'; this.pt = 0; return }
    if (this.phase !== 'fight' && this.phase !== 'intro') return
    this.input(this.P[0], key)
  }
  // One fighter's key, the same for the player and the AI (the AI presses keys too).
  input(f: Fighter, key: string) {
    const fire = key === ' ' || key === 'space' || key === 'return' || key === 'enter' || key === 'f'
    const t = this.g.t, o = this.other(f)
    const horiz = key === 'left' || key === 'right' || key === 'a' || key === 'd'
    if (!horiz && f.st === 'run') f.st = 'idle' // any other key ends a run
    if (horiz) {
      const dir = key === 'left' || key === 'a' ? -1 : 1, gap = t - f.lastTap
      if (dir === Math.sign(o.x - f.x)) f.fwdAt = t
      // two taps 0.09-0.25 s apart run; faster presses are key-repeat and just re-arm the step
      if (f.st === 'run' && dir !== f.stepDir) f.st = 'idle'
      if (dir === f.lastTapDir && gap >= 0.09 && gap <= 0.25 && f.stun <= 0 && (f.st === 'idle' || f.st === 'walk')) { f.st = 'run'; f.stepDir = dir; f.t = 0 }
      else if (f.st !== 'run') { f.stepDir = dir; f.stepT = STEP_T }
      f.lastTap = t; f.lastTapDir = dir
      return
    }
    if (key === 'up' || key === 'w' || key === 'k') { this.jump(f); return }
    if (key === 'down' || key === 's' || key === 'j') { this.guard(f); return }
    if (fire) { this.attack(f); return }
    if (key === 'c') { this.act1(f, 'special'); return }
    if (key === 'x' || key === 'v') { this.act1(f, 'super'); return }
    if (key === 'z' && this.team) { this.tagNext(this.idx(f)); return }
    if ((key === '1' || key === '2' || key === '3') && this.gi === 4 && !f.ai) this.assist(Number(key) - 1)
  }
  private toFight() { this.phase = 'intro'; this.pt = 0 }
  private continue1() {
    // CONTINUE: the same round again, wins kept, your side refilled
    this.continueT = -1; this.koWinner = -1
    for (const f of this.T[0]!) f.out = false
    if (this.P[1]!.wins >= 2) this.P[1]!.wins = 1
    this.startRound()
  }
  private toMenu() { this.g.mode = 'title'; this.g.setSky([[0, 0x07061a], [0.35, 0x140d33], [0.62, 0x2b1446], [0.8, 0x5a1e4e], [1, 0x8a3a3a]]); this.g.say('start', 0) }
  pointer(type: string, x: number, _y: number, button?: string) {
    if (type !== 'down') return
    const W = this.g.W
    if (this.paused) return // a click never acts behind the pause
    // Civil War's first step: the side under the click is the side picked
    if (this.phase === 'select' && this.gi === 1 && this.step === 0) { this.cur = x < W / 2 ? 0 : 1; this.key(' '); return }
    if (this.phase === 'select') { if (x < W / 3) this.key('left'); else if (x > (W * 2) / 3) this.key('right'); else this.key(' '); return }
    if (this.phase === 'match' || this.phase === 'intro' || this.phase === 'vs' || this.phase === 'charge') { this.key(' '); return }
    const f = this.P[0]
    if (button === 'right') this.act1(f, 'special')
    else if (Math.abs(x - f.x) < 8) this.attack(f)
    else this.input(f, x > f.x ? 'right' : 'left')
  }

  // ── moves ────────────────────────────────────────────────────────────────
  private free(f: Fighter) { return f.stun <= 0 && (f.st === 'idle' || f.st === 'walk' || f.st === 'run' || f.st === 'block' || f.st === 'jump') }
  private jump(f: Fighter) { if (f.y >= this.gy - 0.5 && this.free(f) && f.st !== 'jump') { f.vx = f.st === 'run' ? f.stepDir * 60 * this.k : f.stepT > 0 ? f.stepDir * 30 * this.k : 0; f.vy = -95 * this.k * (f.id === 'SPIDEY' ? 1.25 : 1); f.st = 'jump'; f.t = 0 } }
  // ↓ raises guard for 0.6 s; every press refreshes it (held ↓ never drops); a fresh guard's first 0.2 s parries
  private guard(f: Fighter) {
    if (f.stun > 0) return
    f.blockAt = this.g.t
    this.note(f, 'guard')
    if (f.st === 'block') { f.blockT = GUARD_T; return }
    if (f.st === 'idle' || f.st === 'walk' || f.st === 'run') { f.st = 'block'; f.t = 0; f.blockT = GUARD_T; f.guardAt = this.g.t; f.parried = false }
  }
  private attack(f: Fighter) {
    const o = this.other(f), k = this.k
    // a chain hit buffers while the last one plays
    if (f.st === 'punch' && f.chain < 2 && !f.buffer) { f.buffer = true; return }
    if (!this.free(f)) return
    // → then SPACE up close: a throw (beats guard)
    const close = Math.abs(o.x - f.x) < this.body(o).hw + this.body(f).hw + 3 * k && Math.abs(o.y - f.y) < 4 * k // a throw is a grab: body to body
    if (this.g.t - f.fwdAt < 0.2 && close && f.y >= this.gy - 0.5 && o.y >= this.gy - 0.5) { this.throwIt(f, o); return }
    f.chain = 0; this.punch(f)
  }
  private punch(f: Fighter) {
    if (f.chain > 0) f.vx = f.face * 45 * this.k // each chain hit steps in
    f.st = 'punch'; f.t = 0; f.hitDone = false; f.landed = false; f.buffer = false; f.mv = undefined
    if (f.y < this.gy - 0.5) { f.vy = Math.max(f.vy, 60 * this.k); f.vx = f.face * 40 * this.k } // in the air: a dive attack
    this.note(f, 'punch')
  }
  private throwIt(f: Fighter, o: Fighter) {
    f.st = 'punch'; f.t = 0; f.hitDone = true; f.landed = true; f.chain = 0; f.mv = undefined
    this.note(f, 'throw')
    if (o.phase > 0 || o.out) return
    o.x = f.x + f.face * 4 * this.k
    this.hit(f, o, 9, o.x, o.y - this.body(o).h * 0.6, 120, { unbl: true, throw: true }); o.vy = -80 * this.k
    this.word(o, 'THROW', 0xffd27a)
  }
  private note(f: Fighter, what: string) { f.last.push(what); if (f.last.length > 3) f.last.shift() }
  private act1(f: Fighter, what: 'special' | 'super') {
    // cancels: a landed chain hit into C, a special into X
    const cancel = (what === 'special' && f.st === 'punch' && f.landed) || (what === 'super' && f.st === 'special' && f.mv !== undefined && f.t >= f.mv.at)
    if (!cancel && !this.free(f)) return
    if (f.y < this.gy - 0.5) return
    if (what === 'special' && f.cd > 0) return
    if (what === 'special' && (f.id === 'CAP' || f.id === 'THOR') && !f.armed) return
    if (what === 'super') {
      if (f.id === 'THANOS' ? f.stones < 6 || this.snapUsed : f.meter < 100) return
      if (f.id !== 'THANOS') f.meter = 0
    }
    if (f.st === 'special' && f.mv?.k === 'beam') this.beam.on = false
    f.mv = what === 'special' ? f.s.sp : f.s.su
    if (what === 'special') f.cd = f.s.cd
    f.st = what; f.t = 0; f.hitDone = false; f.fired = 0; f.hits = 0; f.vx = 0; f.superHit = false; f.chain = 0; f.buffer = false
    this.note(f, what)
    if (cancel) this.word(f, 'CANCEL', C.gold2)
    if (what === 'super') this.superStart(f)
    else this.kick(0, 0, 0.15, f.s.color)
  }
  private superStart(f: Fighter) {
    const g = this.g, o = this.other(f)
    this.kick(6, 4, 0.3, f.s.color)
    this.say(f.s.su.name, f.s.color, '', 0.9)
    const lines: Partial<Record<HeroId, [string, string]>> = {
      CAP: ['CAP', 'On your left!'], IRONMAN: ['JARVIS', 'Unibeam charged, sir.'], THOR: ['THOR', 'I am the God of Thunder!'],
      HULK: ['HULK', 'HULK... SMASH!'], HULKBUSTER: ['TONY', 'Go to sleep, go to sleep, go to sleep!'], THANOS: ['THANOS', 'Dread it. Run from it. Destiny arrives all the same.'],
      BUCKY: ['BUCKY', 'Ready to comply.'], FALCON: ['SAM', 'On your left!'], HAWKEYE: ['CLINT', 'Let us go, Wanda!'], WANDA: ['WANDA', 'Stop!'],
      WARMACHINE: ['RHODEY', 'Lock and load.'], WIDOW: ['NAT', 'I am not holding back.'], PANTHER: ["T'CHALLA", 'Wakanda forever!'],
      SPIDEY: ['PETER', 'Web-up! Sorry! Sorry!'], VISION: ['VISION', "I'm on the side of life."],
    }
    if (f.id === 'ANTMAN') {
      g.talk('SCOTT', f.s.color, f.s.lines[0]!)
      this.later = o.id === 'SPIDEY' ? { at: g.t + 2.6, who: 'PETER', c: STATS.SPIDEY.color, line: 'You know that really old movie, The Empire Strikes Back?' } : { at: g.t + 2.6, who: 'TONY', c: 0xe63a2e, line: 'Anybody on our side hiding any shocking and fantastic abilities they would like to disclose?' }
    } else { const l = lines[f.id]; if (l) g.talk(l[0], f.s.color, l[1]) }
    if (f.id === 'THANOS') { this.snapPend = true; this.snapUsed = true; this.snapFlash = g.t + f.s.su.at }
  }
  other(f: Fighter) { return this.P[0] === f ? this.P[1] : this.P[0] }
  private idx(f: Fighter) { return this.P[0] === f ? 0 : 1 }
  private shot(owner: number, kind: ShotKind, x: number, y: number, vx: number, vy: number, dmg: number, stun = 0, unbl = false) {
    const s = this.S.find(s => !s.on) ?? this.S[0]!
    Object.assign(s, { on: true, owner, kind, x, y, vx, vy, t: 0, dmg, back: false, stun, unbl, hitAt: -9 })
  }
  // Z: the next teammate standing comes in with a strike (1.5 s cooldown)
  tagNext(side: number) {
    const team = this.T[side]!, cur = this.act[side]!, f = team[cur]!
    if (team.length < 2 || f.tagCd > 0 || !this.free(f) || f.y < this.gy - 0.5) return
    let slot = -1
    for (let d = 1; d < team.length; d++) { const j = (cur + d) % team.length; if (!team[j]!.out) { slot = j; break } }
    if (slot < 0) return
    const nx = team[slot]!, o = this.other(f)
    f.red = Math.min(f.s.hp, f.hp + (f.s.hp - f.hp) * 0.5) // the bench recovers up to here
    nx.x = Math.max(6, Math.min(this.g.W - 6, f.x)); nx.y = this.gy - 12 * this.k; nx.vy = -50 * this.k; nx.st = 'punch'; nx.t = 0; nx.hitDone = false; nx.landed = false; nx.chain = 2; nx.buffer = false; nx.face = f.face; nx.tagCd = 1.5; nx.think = 0.5; nx.mv = undefined
    f.x = -100; f.st = 'idle'; f.stepT = 0
    this.g.burst(nx.x, nx.y, 16, nx.s.color, 1.6, 0, 0.4)
    this.act[side] = slot
    this.word(nx, 'TAG', nx.s.color)
    this.entryLine(nx, o)
  }
  private entryLine(f: Fighter, o: Fighter) {
    if (f.id === 'SPIDEY' && !this.spideyIn) {
      this.spideyIn = true; this.g.talk('TONY', 0xe63a2e, 'Underoos!'); this.say('UNDEROOS!', 0xe42a36, '', 1.0)
      this.kick(20, 0, 0, 0)
      if (o.id === 'CAP' && o.armed) { o.armed = false; o.cd = Math.max(o.cd, 4); this.word(o, 'SHIELD STOLEN', 0xffffff) }
      this.later = { at: this.g.t + 1.3, who: 'PETER', c: STATS.SPIDEY.color, line: 'Hey, everyone.' }
      return
    }
    this.g.talk(f.s.who, f.s.color, f.s.enter)
  }
  private assist(k: number) {
    if (this.assistUsed[k] || this.assistFx.kind >= 0) return
    const id = this.assistIds[k]!, th = this.P[1]
    this.assistUsed[k] = true; this.assistFx = { kind: k, t: 0, x: th.x }
    const q: Partial<Record<HeroId, string>> = { CAP: 'I knew it!', THOR: 'BRING ME THANOS!', HULK: 'Hulk... SMASH.', IRONMAN: 'Repulsors, full power.' }
    this.g.talk(STATS[id].who, STATS[id].color, q[id] ?? 'Avengers!')
    if (id === 'IRONMAN') this.shot(0, 'bigrep', -6, this.gy - 16 * this.k, 170, 0, 10)
  }

  // where a fighter's front hand is in its current frame, in world px
  private hand(f: Fighter, frame: number): [number, number] {
    const sh = this.sheet(f), b = sh.base, hx = b.hand[frame * 2]! * sh.k, hy = b.hand[frame * 2 + 1]! * sh.k
    const left = f.face > 0 ? f.x - sh.ax : f.x - (sh.w - 1 - sh.ax)
    return [left + (f.face > 0 ? hx : sh.w - 1 - hx), f.y - sh.ay + hy]
  }
  body(f: Fighter) { const sh = this.sheet(f); return { hw: Math.max(2, sh.w * 0.17), top: f.y - sh.h * 0.92, h: sh.h * 0.92 } }

  private kick(hitstop: number, shake: number, flash: number, color: number) {
    const g = this.g, small = this.A < 30
    g.hitstop = Math.max(g.hitstop, hitstop)
    g.shake = Math.max(g.shake, small ? Math.min(shake, this.A / 20) : shake * Math.min(1.5, this.k + 0.2))
    if (flash > 0) { g.flashA = Math.max(g.flashA, small ? Math.min(0.3, flash) : flash); g.flashC = color }
  }
  private say(text: string, color: number, sub: string, len: number) { this.splash = text; this.splashC = color; this.sub = sub; this.splashT = this.g.t; this.splashLen = len }
  // a 1-row word above a fighter's head (PARRY, COUNTER, THROW, TAG...)
  private word(f: Fighter, s: string, c: number) { this.g.pop(f.x - s.length / 2, f.y - this.body(f).h - 3, s, c) }

  hit(att: Fighter, def: Fighter, dmg: number, hx: number, hy: number, kb: number, o: { unbl?: boolean; gb?: boolean; stun?: number; throw?: boolean; big?: boolean } = {}) {
    const g = this.g, k = this.k
    if (def.st === 'ko' || def.out || (this.phase !== 'fight' && this.phase !== 'finisher')) return
    if (def.phase > 0) { this.word(def, 'PHASED', 0xffe066); return }
    if (def.launched && att.st === 'punch' && !o.throw) dmg *= 0.5 // punch juggles after a launcher are worth half
    const facing = Math.sign(att.x - def.x) === def.face
    const blocked = !o.unbl && def.st === 'block' && facing
    if (def.giant > 0) dmg *= 0.75
    if (att.ai && !def.ai && this.tierNow === 0) dmg *= att.id === 'THANOS' ? 0.4 : 0.55 // RECRUIT pulls its punches
    if (att.id === 'HULK') dmg *= 1 + 0.35 * Math.max(0, Math.min(1, (0.75 - att.hp / att.s.hp) / 0.5)) // RAGE builds as he hurts
    if (att.st === 'super') att.superHit = true
    if (blocked && !o.gb) {
      // a fresh guard parries: no chip, a long stop, the attacker staggers
      if (g.t - def.guardAt < PARRY_T && !def.parried) {
        def.parried = true; def.parries++; def.meter = Math.min(100, def.meter + 15)
        if (Math.abs(att.x - def.x) < 40 * k) { att.st = 'hurt'; att.t = 0; att.stun = 0.8; att.mv = undefined }
        att.shy = this.g.t + 2.5 // a parried AI stops reading guards for a while
        this.kick(12, 2, 0, 0); this.ring(def, 0x7fe9ff)
        this.word(def, 'PARRY', 0x7fe9ff)
        if (def.ai) def.punish = true
        return
      }
      const cap = def.id === 'CAP' && def.armed, chip = cap ? 0 : def.id === 'PANTHER' ? 0.07 : 0.15
      def.hp -= dmg * chip; def.vx = -def.face * kb * 0.6 * k; def.blockT = Math.max(def.blockT, 0.2)
      if (def.id === 'PANTHER') def.absorb = Math.min(30, def.absorb + dmg)
      g.burst(hx, hy, 8, 0x9db8ff, 1.4 * k, 0, 0.3); this.kick(2, 1, 0, 0)
      def.meter = Math.min(100, def.meter + 4)
      if (def.ai && (this.tierNow > 0 || this.g.rnd() < 0.3)) def.punish = true
      if (att.st === 'punch') att.lag = 0.22 // a blocked hit leaves you open
      this.word(def, 'BLOCK', 0x9db8ff)
    } else {
      // Hulk's armour: a light hit while he swings doesn't stop the swing (a masher trades badly)
      if ((def.id === 'HULK' || def.giant > 0) && (def.st === 'punch' || def.st === 'special') && att.st === 'punch' && !o.big && !o.throw) {
        def.hp -= dmg * 0.8; def.trailT = 0.4; def.flash = 1; this.word(def, 'ARMOR', 0x76cf57); att.landed = true
        if (def.hp <= 0) { def.hp = 0; this.down(def) }
        return
      }
      const counter = !blocked && !o.throw && (def.st === 'punch' || def.st === 'special' || def.st === 'super') && def.t < 0.3
      if (counter) dmg *= 1.25
      def.hp -= dmg; def.trailT = 0.4; def.st = 'hurt'; def.t = 0; def.vx = Math.sign(def.x - att.x || att.face) * kb * k; def.flash = 1; def.mv = undefined
      def.stun = Math.max(def.stun, o.stun ?? 0)
      if (att.st === 'super') def.tookSuper = true
      if (def.y < this.gy - 1) def.vy = -40 * k
      if (o.big) { def.vy = -90 * k; def.launched = true }
      if (def.id === 'THANOS' && this.snapPend) { this.snapPend = false; this.say('SNAP BROKEN', 0x7fe9ff, '', 1); g.talk('JARVIS', C.arc, 'You broke his concentration, sir!') }
      att.combo = att.comboT > 0 ? att.combo + 1 : 1; att.comboT = 0.9; att.maxChain = Math.max(att.maxChain, att.combo)
      const heavy = dmg >= 11 || o.big
      g.burst(hx, hy, heavy ? 12 : 6, att.s.color, 1.8 * k, 0, 0.45)
      if (heavy) g.boom(hx, hy, (5 + dmg * 0.4) * k, 0xffa040)
      if (att.st === 'super') this.kick(10, 8, 0.4, 0xffffff); else this.kick(heavy ? 5 : 2, heavy ? 3 : 1, heavy ? 0.3 : 0, 0xffffff)
      att.meter = Math.min(100, att.meter + 6); def.meter = Math.min(100, def.meter + 4)
      g.pop(def.x + 2, def.y - this.body(def).h - 2, '-' + Math.round(dmg), 0xffffff)
      if (counter) this.word(def, 'COUNTER', 0xff9a3a)
      // (the combo counter is drawn on the attacker's side, up top: see drawMeters)
      att.landed = true
    }
    if (def.hp <= 0) { def.hp = 0; this.down(def) }
    // ENDGAME PORTALS: the first time Thanos drops under half, the cast arrives
    if (def.id === 'THANOS' && this.gi === 4 && !this.portals.done && def.hp < def.s.hp * 0.5 && def.hp > 0) { this.portals = { done: true, t: 0 }; this.say('AVENGERS ASSEMBLE', C.gold2, '', 2.5); g.talk('CAP', STATS.CAP.color, 'Avengers... assemble.'); this.kick(30, 4, 0.3, 0xffa040) }
  }
  // 400%: Iron Man parrying Thor's lightning drinks it
  private drink(def: Fighter) { def.meter = 100; this.power400 = 5; this.say('POWER AT 400%', 0x7fe9ff, '', 1.4); this.g.talk('TONY', def.s.color, 'Power at 400%.') }
  private rings: { on: boolean; t: number; x: number; y: number; c: number }[] = [{ on: false, t: 0, x: 0, y: 0, c: 0 }, { on: false, t: 0, x: 0, y: 0, c: 0 }]
  private ring(f: Fighter, c: number) { const r = this.rings.find(r => !r.on) ?? this.rings[0]!; Object.assign(r, { on: true, t: 0, x: f.x, y: f.y - this.body(f).h * 0.5, c }) }
  // A fighter is down: the next teammate comes in, or the round is over.
  private down(def: Fighter) {
    const side = this.idx(def), team = this.T[side]!
    def.out = true
    const next = team.findIndex(f => !f.out)
    if (next < 0) { this.endRound(1 - side, 'ko'); return }
    def.st = 'ko'; def.t = 0; def.vy = -60 * this.k; def.vx = -def.face * 40 * this.k
    this.phase = 'swap'; this.pt = 0
    this.kick(12, 6, 0.4, 0xffffff)
    this.say('K.O.', 0xff5a4a, '', 1.0)
    this.swapTo = { side, next }
  }
  swapTo = { side: 0, next: 0 }

  // ── simulation ───────────────────────────────────────────────────────────
  tick(dt: number) {
    const g = this.g
    if (this.g.H !== this.lastH) this.rescale()
    if (this.later && g.t >= this.later.at) { g.talk(this.later.who, this.later.c, this.later.line); this.later = undefined }
    if (this.paused) return
    this.pt += dt
    for (const team of this.T) for (const f of team) {
      f.shown += (f.hp - f.shown) * 0.25
      if ((f.trailT -= dt) <= 0) f.trail += (f.hp - f.trail) * 0.2
      if (f.trail < f.hp) f.trail = f.hp
      f.flash = Math.max(0, f.flash - dt * 8)
    }
    for (const r of this.rings) if (r.on && (r.t += dt) > 0.4) r.on = false
    if (this.phase === 'select') return
    if (this.phase === 'match') { if (this.continueT > 0 && (this.continueT -= dt) <= 0) this.continueT = 0; return }
    if (this.phase === 'vs') { if (this.pt > 1.2) this.toFight(); return }
    if (this.phase === 'charge') { if (this.pt > 1.6) this.toFight(); return }
    if (this.phase === 'intro') { this.physics(dt); if (this.pt > 0.9) { this.phase = 'fight'; this.pt = 0 } return }
    if (this.phase === 'swap') {
      this.physics(dt)
      if (this.pt > 1.0) {
        const { side, next } = this.swapTo, old = this.T[side]![this.act[side]!]!, nx = this.T[side]![next]!
        nx.x = side === 0 ? g.W * 0.2 : g.W * 0.8; nx.y = this.gy - 12 * this.k; nx.vy = -40 * this.k; nx.st = 'jump'; nx.face = side === 0 ? 1 : -1; nx.think = 0.8
        old.x = -100
        this.act[side] = next; this.phase = 'fight'; this.pt = 0
        this.entryLine(nx, this.P[1 - side]!)
      }
      return
    }
    if (this.phase === 'ko') { this.physics(dt); if (this.pt > 1.8) { const w = this.P[this.koWinner]!; if (this.team || w.wins >= 2) this.finishMatch(); else { this.round++; this.startRound() } } return }
    if (this.phase === 'finisher') { this.finisher(dt); return }
    // the fight
    this.clock -= dt
    if (this.clock <= 0) {
      this.clock = 0
      const pct = (s: number) => this.T[s]!.reduce((n, f) => n + (f.out ? 0 : f.hp / f.s.hp), 0)
      this.endRound(pct(0) >= pct(1) ? 0 : 1, 'time'); return
    }
    this.power400 = Math.max(0, this.power400 - dt)
    for (const [side, team] of this.T.entries()) for (const f of team) {
      f.tagCd = Math.max(0, f.tagCd - dt)
      if (team[this.act[side]!] !== f && !f.out && f.hp < f.red) f.hp = Math.min(f.red, f.hp + dt * 0.5) // the bench gets its breath back
    }
    for (const f of this.P) {
      f.cd = Math.max(0, f.cd - dt); f.stun = Math.max(0, f.stun - dt)
      if ((f.comboT -= dt) <= 0) f.combo = 0
      if (f.giant > 0 && (f.giant -= dt) <= 0) { f.giant = 0; this.g.burst(f.x, f.y - 10 * this.k, 24, 0xff6a6a, 1.6, 0, 0.4) }
      f.phase = Math.max(0, f.phase - dt)
    }
    // Thanos earns a stone every 18 s (and one for each super you whiff)
    const th = this.P.find(f => f.id === 'THANOS')
    if (th && !this.snapPend) th.stones = Math.min(6, th.stones + dt / 18)
    if (this.portals.done && th && Math.floor(this.clock / 4) !== Math.floor((this.clock + dt) / 4)) { th.hp = Math.max(1, th.hp - 1); this.g.burst(th.x, th.y - 10 * this.k, 6, 0xffa040, 1, 0, 0.3) }
    for (const [i, f] of this.P.entries()) if (f.ai) this.brain(f, this.P[1 - i]!, dt, i)
    this.physics(dt)
    this.moves(dt)
    this.shots(dt)
    this.assistTick(dt)
    this.clamp()
    if (this.bolt.on && (this.bolt.t += dt) > 0.5) this.bolt.on = false
    if (this.quake.on && (this.quake.t += dt) > 0.7) this.quake.on = false
    if (this.wipe.on && (this.wipe.t += dt) > 1.6) this.wipe.on = false
  }

  private physics(dt: number) {
    const W = this.g.W, [a, b] = this.P, k = this.k
    for (const f of this.P) {
      const o = f === a ? b : a
      f.t += dt
      if (f.st !== 'ko' && f.st !== 'hurt' && f.st !== 'punch' && f.st !== 'special' && f.st !== 'super') f.face = o.x >= f.x ? 1 : -1
      // a tap is a 7 px step with an ease-out; key-repeat re-arms it, so a held key walks smoothly
      const spd = (f.s.speed / 32) * k * (f.giant > 0 ? 0.7 : 1)
      if (f.st === 'run') {
        f.x += f.stepDir * 95 * spd * dt
        if (f.x <= 5 || f.x >= W - 5 || f.stun > 0) f.st = 'idle'
        if (Math.floor(f.t * 10) % 3 === 0) this.g.burst(f.x - f.stepDir * 3 * k, f.y - 1, 1, 0x8a7a6a, 0.6 * k, 1, 0.25)
      } else if (f.stepT > 0 && f.stun <= 0 && (f.st === 'idle' || f.st === 'walk' || f.st === 'jump')) {
        const e = f.stepT / STEP_T
        f.x += f.stepDir * 58 * spd * (0.45 + 0.75 * e) * (f.st === 'jump' ? 0.6 : 1) * dt
        f.stepT -= dt
        if (f.st !== 'jump') f.st = 'walk'
      } else if (f.st === 'walk') { f.st = 'idle'; f.stepT = 0 }
      if (f.st === 'block' && (f.blockT -= dt) <= 0) f.st = 'idle'
      if (f.st === 'hurt' && f.t > 0.32 + f.stun) { f.st = f.y < this.gy - 1 ? 'jump' : 'idle'; f.stun = 0; f.woke = true }
      if (!(f.mv?.k === 'phase' && f.st === 'super')) f.vy += 260 * k * dt
      f.y += f.vy * dt; f.x += f.vx * dt; f.vx *= 0.86
      if (f.y >= this.gy) { f.y = this.gy; f.vy = 0; f.launched = false; if (f.st === 'jump') f.st = 'idle' }
      // the whole fighter stays on screen: sides and top
      if (f.st !== 'ko') { const sh = this.sheet(f), m = Math.max(4, sh.ax, sh.w - sh.ax) + 1; f.x = Math.max(m, Math.min(W - m, f.x)); if (f.y - sh.h < 0) { f.y = sh.h; f.vy = Math.max(0, f.vy) } }
    }
    const ba = this.body(a), bb = this.body(b), min = (ba.hw + bb.hw) * 0.9, d = b.x - a.x
    if (a.st !== 'ko' && b.st !== 'ko' && a.phase <= 0 && b.phase <= 0 && Math.abs(d) < min && Math.abs(a.y - b.y) < Math.min(ba.h, bb.h) * 0.7) {
      const push = ((min - Math.abs(d)) / 2) * (d >= 0 ? 1 : -1)
      a.x -= push; b.x += push
    }
  }

  // the whole fighter stays on screen, whatever moved it (a throw, a tag, a blink)
  private clamp() {
    for (const f of this.P) { if (f.st === 'ko') continue; const sh = this.sheet(f), m = Math.max(4, sh.ax, sh.w - sh.ax) + 1; f.x = Math.max(m, Math.min(this.g.W - m, f.x)); if (f.y - sh.h < 0) { f.y = sh.h; f.vy = Math.max(0, f.vy) } }
  }
  private moves(dt: number) {
    const k = this.k
    for (const f of this.P) {
      const o = this.other(f), i = this.idx(f)
      if (f.st === 'punch') {
        const big = f.id === 'HULK' || f.id === 'HULKBUSTER' || f.id === 'THANOS' || f.giant > 0
        const dur = (big ? 0.36 : 0.26) + (f.chain === 2 ? 0.08 : 0)
        if (!f.hitDone && f.t > dur * 0.35) {
          f.hitDone = true
          const [hx, hy] = this.hand(f, F_PUNCH), ob = this.body(o), reach = f.s.reach * k * (f.giant > 0 ? 2 : 1)
          const near = Math.abs(o.x - f.x) < reach + ob.hw && Math.sign(o.x - f.x || f.face) === f.face && hy > ob.top - 3 * k && hy < o.y + 2
          const third = f.chain === 2
          const dmg = f.s.punch * (f.giant > 0 ? 2 : 1) * [1, 0.85, 1.3][f.chain]!
          f.whiff = !near
          if (near) this.hit(f, o, dmg, hx, hy, third ? 150 : 14, { big: third }) // the first two hold them close, the third sends them
          else this.g.burst(hx, hy, 3, 0xffffff, 0.8 * k, 0, 0.15)
        }
        if (f.t > dur + (f.whiff ? 0.12 : 0) + f.lag) {
          f.lag = 0
          if (f.buffer && f.chain < 2 && f.landed) { f.chain++; this.punch(f) }
          else { f.st = f.y < this.gy - 1 ? 'jump' : 'idle'; f.chain = 0 }
        }
      } else if ((f.st === 'special' || f.st === 'super') && f.mv) {
        this.runMove(f, o, i, f.mv, dt)
        if ((f.st === 'super' || f.st === 'special') && f.mv && f.t > f.mv.dur) this.endMove(f)
      }
    }
    void CHAIN_T
  }
  private endMove(f: Fighter) {
    if (f.mv?.k === 'beam') this.beam.on = false
    // a whiffed super feeds Thanos a stone
    if (f.st === 'super' && !f.superHit && f.id !== 'THANOS' && f.mv?.k !== 'giant' && this.gi === 4 && this.tierNow > 0) { const th = this.other(f); if (th.id === 'THANOS' && !this.snapUsed) { th.stones = Math.min(6, Math.floor(th.stones) + 1); this.word(th, '+STONE', 0xa855f7) } }
    f.st = f.y < this.gy - 1 ? 'jump' : 'idle'; f.mv = undefined
  }
  private runMove(f: Fighter, o: Fighter, i: number, m: Move, dt: number) {
    const g = this.g, k = this.k, t = f.t, ob = this.body(o)
    const go = t >= m.at && !f.hitDone
    switch (m.k) {
      case 'shot': {
        const triple = this.power400 > 0 && f.id === 'IRONMAN' && f.st === 'special'
        const n = (m.n ?? 1) * (triple ? 3 : 1), gap = m.shot === 'bullet' || triple ? 0.06 : 0.14
        while (f.fired < n && t >= m.at + f.fired * gap) {
          const [hx, hy] = this.hand(f, F_SPECIAL)
          const yy = f.id === 'WARMACHINE' && f.st === 'super' ? f.y - this.body(f).h * 0.9 : hy
          const vy = m.shot === 'xarrow' ? -70 * k + f.fired * 18 * k : m.shot === 'bullet' ? (g.rnd() - 0.5) * 12 * k : triple ? ((f.fired % 3) - 1) * 20 * k : 0
          this.shot(i, m.shot!, hx, yy, f.face * (m.spd ?? 120) * k, vy, m.dmg, m.stun ?? 0, m.unbl)
          f.fired++
          if (m.shot === 'shield' || m.shot === 'hammer') f.armed = false
        }
        if (f.fired >= n) f.hitDone = true
        break
      }
      case 'dash': case 'flurry': {
        if (t >= m.at && t < m.at + m.dur * 0.85) {
          f.x += f.face * (m.spd ?? 140) * k * dt
          if (!(f.id === 'ANTMAN' && f.st === 'special')) g.burst(f.x - f.face * 6 * k, f.y - 4 * k, 1, 0x8a7a6a, 0.8 * k, 1, 0.3)
          const touch = Math.abs(o.x - f.x) < ob.hw + 6 * k && Math.abs(o.y - f.y) < ob.h * 0.8
          if (touch && m.k === 'dash' && !f.hitDone) { f.hitDone = true; this.hit(f, o, m.dmg, (f.x + o.x) / 2, f.y - ob.h * 0.5, 110, { gb: m.gb, stun: m.stun }); if (m.heal) f.hp = Math.min(f.s.hp, f.hp + m.heal); f.t = Math.max(f.t, m.at + m.dur * 0.85) }
          if (touch && m.k === 'flurry' && f.hits < (m.n ?? 5) && t - f.mark > 0.11) { f.hits++; f.mark = t; const last = f.hits === (m.n ?? 5); this.hit(f, o, m.dmg * (last ? 2 : 1), (f.x + o.x) / 2, f.y - ob.h * (0.3 + 0.1 * (f.hits % 3)), last ? 160 : 20, { gb: true, big: last }) }
        }
        break
      }
      case 'beam': {
        if (t >= m.at && t < m.dur) {
          const by = f.y - this.body(f).h * (f.id === 'VISION' ? 0.82 : 0.62)
          this.beam = { on: true, t, owner: i, c: m.c ?? 0x7fe9ff, th: f.st === 'super' ? Math.max(1, Math.round(3 * k)) : 1 }
          const ticks = Math.round((m.dur - m.at) * 10)
          if (Math.sign(o.x - f.x) === f.face && by > ob.top - 2 && by < o.y + 2 && t - f.mark > 0.1) { f.mark = t; this.hit(f, o, m.dmg / ticks, o.x - f.face * ob.hw, by, 30) }
        }
        break
      }
      case 'sky': {
        if (t < 0.05) f.mark = o.x // the strike lands where you stood when he raised the hammer
        if (go) {
          f.hitDone = true; this.bolt = { on: true, t: 0, x: f.mark }; this.kick(6, 5, 0.5, 0xc8d8ff)
          if (Math.abs(o.x - f.mark) < ob.hw + 6 * k) {
            const parry = o.st === 'block' && g.t - o.guardAt < PARRY_T + 0.1
            if (parry && o.id === 'IRONMAN') { o.parries++; this.ring(o, 0x7fe9ff); this.word(o, 'PARRY', 0x7fe9ff); this.drink(o) }
            else this.hit(f, o, m.dmg, o.x, o.y - ob.h * 0.5, 60)
          }
        }
        break
      }
      case 'quake': {
        if (t < 0.05) f.vy = -120 * k
        if (!f.hitDone && t > m.at && f.y >= this.gy - 0.5) {
          f.hitDone = true; this.quake = { on: true, t: 0, x: f.x }
          this.kick(10, 10, 0.3, 0x76cf57); g.burst(f.x, this.gy, 40, 0x8a7a6a, 2.6 * k, 1, 1.2); g.boom(f.x, this.gy - 2, 18 * k, 0x76cf57)
          if (o.y >= this.gy - 3) this.hit(f, o, m.dmg, o.x, o.y - 6 * k, 90, { unbl: Math.abs(o.x - f.x) < 20 * k }); else this.word(o, 'DODGED', C.gold2)
        }
        break
      }
      case 'grab': {
        if (go) {
          f.hitDone = true
          const range = (m.range ?? 20) * k
          if (Math.abs(o.x - f.x) <= range + ob.hw && Math.sign(o.x - f.x || f.face) === f.face && o.phase <= 0 && Math.abs(o.y - f.y) < ob.h) {
            if (f.id === 'SPIDEY') o.x = f.x + f.face * 10 * k
            if (f.id === 'WANDA') o.vy = -110 * k
            if (f.id === 'WIDOW' || f.id === 'BUCKY') o.x = f.x + f.face * 6 * k
            this.hit(f, o, m.dmg, o.x, o.y - ob.h * 0.5, 100, { unbl: true, stun: 0.3, throw: true })
            if (f.id === 'SPIDEY' || f.id === 'WANDA') this.webLine(f, o)
          } else this.word(f, 'MISS', 0x9a9ab0)
        }
        break
      }
      case 'giant': {
        if (go) { f.hitDone = true; f.giant = 6; this.kick(8, 8, 0.4, 0xff6a6a); g.burst(f.x, f.y - 10 * k, 40, 0xff6a6a, 2.2 * k, 0, 0.8); if (!this.giantSaid) { this.giantSaid = true; this.say('GIANT-MAN', 0xff4a4a, '', 1.2) } }
        break
      }
      case 'snap': {
        if (go && this.snapPend) {
          f.hitDone = true; this.snapPend = false
          // parry: ↓ within 0.25 s of the gold flash (there is no key-up to hold)
          const parried = Math.abs(o.blockAt - this.snapFlash) < 0.25
          this.kick(12, 12, 1, parried ? 0x7fe9ff : 0xffffff)
          f.stones = 0
          if (parried) { f.st = 'hurt'; f.t = 0; f.stun = 1.5; f.mv = undefined; this.say('NOT TODAY', 0x7fe9ff, '', 1.4); g.talk('CAP', STATS.CAP.color, 'Not today.'); o.parries++; return }
          this.wipe = { on: true, t: 0, left: o.x < g.W / 2 }
          this.say('SNAPPED', 0xa855f7, '', 1.4)
          this.hit(f, o, Math.max(1, o.hp * 0.5), o.x, o.y - ob.h * 0.5, 60, { unbl: true })
        }
        break
      }
      case 'blink': {
        if (go) {
          f.hitDone = true
          if (Math.abs(o.x - f.x) > g.W * 0.45 && g.rnd() < 0.5) {
            g.burst(f.x, f.y - 14 * k, 24, 0x3b82f6, 2 * k, 0, 0.5)
            f.x = Math.max(8, Math.min(g.W - 8, o.x - o.face * 14 * k)); f.face = o.x >= f.x ? 1 : -1
            g.burst(f.x, f.y - 14 * k, 24, 0x3b82f6, 2 * k, 0, 0.5)
          } else { const [hx, hy] = this.hand(f, F_SPECIAL); this.shot(i, 'blast', hx, hy, f.face * (m.spd ?? 110) * k, 0, m.dmg) }
        }
        break
      }
      case 'dive': {
        if (t < 0.05) f.vy = -150 * k
        if (t >= m.at && !f.hitDone) {
          const dx = o.x - f.x, dy = o.y - ob.h * 0.5 - f.y
          f.vx = Math.sign(dx) * 200 * k; f.vy = Math.max(f.vy, 160 * k); f.face = dx >= 0 ? 1 : -1
          if (Math.abs(dx) < ob.hw + 6 * k && Math.abs(dy) < ob.h) { f.hitDone = true; this.hit(f, o, m.dmg, o.x, o.y - ob.h * 0.5, 120); f.vy = -60 * k }
          if (f.y >= this.gy - 0.5 && t > m.at + 0.1) f.hitDone = true
        }
        break
      }
      case 'phase': {
        if (t < 0.05) { f.phase = m.at; f.vy = -80 * k }
        if (t < m.at) { f.vy *= 0.9; f.x += (o.x - f.x) * 3 * dt }
        if (t >= m.at && !f.hitDone) {
          f.vy = 260 * k
          if (f.y >= this.gy - 0.5) { f.hitDone = true; this.kick(8, 8, 0.3, 0xffe066); g.boom(f.x, this.gy - 2, 14 * k, 0xffe066); if (Math.abs(o.x - f.x) < ob.hw + 10 * k) this.hit(f, o, m.dmg, o.x, o.y - ob.h * 0.4, 90, { unbl: true }) }
        }
        break
      }
      case 'burst': {
        if (go) {
          f.hitDone = true
          const dmg = m.dmg * (1 + f.absorb / 50); f.absorb = 0
          this.kick(8, 7, 0.4, 0xa855f7); g.boom(f.x, f.y - this.body(f).h * 0.5, (m.range ?? 30) * k, 0xa47cf0)
          this.quake = { on: true, t: 0, x: f.x }
          if (Math.abs(o.x - f.x) < (m.range ?? 30) * k) this.hit(f, o, dmg, o.x, o.y - ob.h * 0.5, 130)
        }
        break
      }
    }
  }
  private webs: { on: boolean; t: number; ax: number; ay: number; bx: number; by: number; c: number }[] = [{ on: false, t: 0, ax: 0, ay: 0, bx: 0, by: 0, c: 0 }]
  private webLine(f: Fighter, o: Fighter) { const [hx, hy] = this.hand(f, F_SPECIAL); Object.assign(this.webs[0]!, { on: true, t: 0, ax: hx, ay: hy, bx: o.x, by: o.y - this.body(o).h * 0.5, c: f.id === 'WANDA' ? 0xff4a6a : 0xffffff }) }

  private shots(dt: number) {
    const g = this.g, W = g.W, k = this.k
    for (const s of this.S) {
      if (!s.on) continue
      s.t += dt
      const owner = this.P[s.owner]!, tgt = this.P[1 - s.owner]!
      if ((s.kind === 'shield' || s.kind === 'hammer') && (s.back || s.t > 0.75)) {
        s.back = true
        const [hx, hy] = this.hand(owner, F_IDLE), a = Math.atan2(hy - s.y, hx - s.x)
        s.vx = Math.cos(a) * 160 * k; s.vy = Math.sin(a) * 160 * k
        if (Math.hypot(hx - s.x, hy - s.y) < 5 * k + 2) { s.on = false; owner.armed = true; continue }
      }
      if (s.kind === 'redwing' || s.kind === 'hex') { const ty = tgt.y - this.body(tgt).h * 0.6; s.vy += Math.sign(ty - s.y) * 120 * k * dt; s.vy *= 0.95 }
      if (s.kind === 'xarrow') s.vy += 160 * k * dt
      s.x += s.vx * dt; s.y += s.vy * dt
      if (s.kind === 'xarrow' && s.y >= this.gy) { this.explode(s, owner, tgt); continue }
      const loose = s.kind !== 'shield' && s.kind !== 'hammer'
      if (loose && (s.x < -10 || s.x > W + 10 || s.t > 3)) { s.on = false; continue }
      if (!loose && (s.x < -6 || s.x > W + 6)) s.back = true
      const tb = this.body(tgt)
      if (tgt.phase <= 0 && !tgt.out && Math.abs(s.x - tgt.x) < tb.hw + 2 && s.y > tb.top && s.y < tgt.y + 1 && !(tgt.id === 'ANTMAN' && tgt.st === 'special') && s.t - s.hitAt > 0.3) {
        if (s.back && s.kind === 'shield') continue // the shield flies home clean; Mjolnir hits again on the way back
        if (tgt.id === 'CAP' && tgt.st === 'block' && tgt.armed && (s.kind === 'repulsor' || s.kind === 'blast' || s.kind === 'bigrep' || s.kind === 'hex')) { s.owner = 1 - s.owner; s.vx = -s.vx * 1.1; g.burst(s.x, s.y, 10, 0xffffff, 1.6 * k, 0, 0.3); this.word(tgt, 'REFLECT', 0xffffff); continue }
        if (s.kind === 'xarrow' || s.kind === 'rocket') { this.explode(s, owner, tgt); continue }
        this.hit(owner, tgt, s.dmg, s.x, s.y, s.kind === 'bullet' ? 15 : 60, { stun: s.stun, unbl: s.unbl })
        s.hitAt = s.t
        if (s.kind === 'web') this.webLine(owner, tgt)
        if (!loose) s.back = true; else { s.on = false; g.boom(s.x, s.y, (s.kind === 'bullet' ? 3 : 7) * k, s.kind === 'blast' ? 0xa855f7 : s.kind === 'hex' ? 0xff4a6a : 0x7fe9ff) }
      }
    }
    const w = this.webs[0]!
    if (w.on && (w.t += dt) > 0.35) w.on = false
  }
  private explode(s: Shot, owner: Fighter, tgt: Fighter) {
    const g = this.g, k = this.k
    s.on = false
    g.boom(s.x, s.y, 12 * k, 0xff8a3a); g.burst(s.x, s.y, 16, 0, 1.6 * k, 0, 0.5); this.kick(2, 3, 0, 0)
    if (Math.hypot(tgt.x - s.x, tgt.y - this.body(tgt).h * 0.5 - s.y) < 14 * k + this.body(tgt).hw) this.hit(owner, tgt, s.dmg, s.x, s.y, 90)
  }
  private assistTick(dt: number) {
    const a = this.assistFx, th = this.P[1], me = this.P[0]
    if (a.kind < 0) return
    a.t += dt
    const id = this.assistIds[a.kind]!
    if ((id === 'THOR' || id === 'CAP') && a.t > 0.45 && a.t - dt <= 0.45) { this.bolt = { on: true, t: 0, x: a.x }; this.kick(6, 5, 0.5, 0xc8d8ff); if (Math.abs(th.x - a.x) < this.body(th).hw + 6 * this.k) this.hit(me, th, 12, th.x, th.y - 12 * this.k, 50) }
    if (id === 'HULK' && a.t > 0.5 && a.t - dt <= 0.5) { this.kick(5, 10, 0, 0); this.g.burst(a.x, this.gy, 40, 0x8a7a6a, 2.6 * this.k, 1, 1.2); this.g.boom(a.x, this.gy - 4, 20 * this.k, 0x76cf57); if (Math.abs(th.x - a.x) < this.body(th).hw + 10 * this.k) { this.hit(me, th, 10, th.x, th.y - 8, 80); if (th.stones >= 1) { th.stones -= 1; this.word(th, '-STONE', 0x76cf57) } } }
    if (a.t > 1.2) a.kind = -1
  }

  // ── the AI: presses the same keys a player does, at its tier's speed ─────
  private poke(f: Fighter) { f.fwdAt = -9; this.input(f, 'space') }
  private brain(f: Fighter, o: Fighter, dt: number, side: number) {
    const T = this.T0, rnd = this.g.rnd, k = this.k, bias = f.s.bias
    f.think -= dt
    const incoming = this.S.some(s => s.on && s.owner !== side && !s.back && Math.sign(f.x - s.x) === Math.sign(s.vx) && Math.abs(f.x - s.x) < 45 * k)
    const dist = Math.abs(o.x - f.x), reach = f.s.reach * k * (f.giant > 0 ? 2 : 1), close = dist < reach + this.body(o).hw + 2 * k
    const threat = (o.st === 'punch' && close && o.t < 0.1) || (o.st === 'special' && o.t < 0.15) || (o.st === 'super' && o.t < 0.2) || incoming
    // react once per threat, after the tier's reaction time
    if (threat && f.react === -1) f.react = this.g.t + T.react
    if (!threat) f.react = -1
    if (f.react > 0 && this.g.t >= f.react && this.free(f)) {
      f.react = -2
      const r = rnd(), rage = bias === 'rush' && f.hp < f.s.hp * 0.25
      if (r < T.parry) this.input(f, 'down') // a fresh guard: a parry if it lands in time
      else if (r < T.parry + T.guard * (rage ? 0 : 1)) { this.input(f, 'down'); f.guardAt -= PARRY_T } // a plain guard
      else if (incoming && rnd() < 0.3) this.input(f, 'up')
    }
    if (f.st === 'block' && threat) f.blockT = Math.max(f.blockT, 0.25)
    // anti-air: the opponent jumping in
    if (o.y < this.gy - 6 * k && dist < reach * 2.2 && this.free(f) && f.y >= this.gy - 0.5 && rnd() < T.air * dt * 6) { this.poke(f); return }
    // a landed hit continues the chain, and cancels at the higher tiers
    if (f.st === 'punch' && f.landed && f.chain < 2 && !f.buffer && f.t > 0.05 && f.mark !== f.t) { f.mark = f.t; if (rnd() < T.chain) f.buffer = true }
    if (f.st === 'punch' && f.landed && f.chain === 2 && f.t > 0.12 && f.cd <= 0 && rnd() < T.chain * 0.1) { this.act1(f, 'special'); return }
    // waking from a hit with the attacker on top of you: guard (it reads a masher's next string)
    if (f.woke) { f.woke = false; if (close && this.free(f) && this.g.t > f.shy && rnd() < T.guard + 0.25) { this.input(f, 'down'); f.guardAt -= PARRY_T } }
    const aggro = o.last.filter(a => a === 'punch').length >= 2
    if (close && aggro && this.free(f) && f.st !== 'block' && rnd() < T.guard * dt * (2 + 10 * Math.min(1, this.tierNow))) { this.input(f, 'down'); f.guardAt -= PARRY_T }
    if (f.punish && this.free(f) && close && o.st !== 'block') { f.punish = false; f.st = f.st === 'block' ? 'idle' : f.st; this.poke(f); return }
    // a full meter (or six stones) gets used
    if ((f.id === 'THANOS' ? f.stones >= 6 && !this.snapUsed : f.meter >= 100) && this.free(f) && f.y >= this.gy - 0.5 && f.st !== 'block' && rnd() < (0.4 + 0.1 * this.tierNow) * dt * 3) { this.input(f, 'x'); if (f.st === 'super') return }
    // up close the AI doesn't stand around: it hits into recovery, and presses its turn
    if (close && this.free(f) && f.st !== 'block' && f.y >= this.gy - 0.5) {
      const opening = (o.st === 'punch' && (o.whiff || o.lag > 0 || o.t > 0.2)) || o.st === 'hurt' || (o.st === 'idle' && o.t > 0.15) || o.st === 'walk'
      if (opening && rnd() < (0.03 + 0.27 * Math.min(1, this.tierNow) + 0.2 * Math.max(0, this.tierNow - 1)) * dt * 30 * (f.s.bias === 'rush' ? 1.3 : 1)) { this.poke(f); return }
    }
    if (f.think > 0 || !this.free(f) || f.st === 'block') return
    const low = f.hp < f.s.hp * 0.35
    f.think = (0.42 - this.tierNow * 0.06) * (low ? 0.75 : 1) * (bias === 'wait' ? 1.25 : 1) + rnd() * 0.15
    // tag out when hurt and a fresher teammate waits
    if (this.team && low && rnd() < 0.5) { const team = this.T[side]!, fresh = team.some((x, n) => n !== this.act[side] && !x.out && x.hp > f.hp + 25); if (fresh) { this.input(f, 'z'); return } }
    const canSuper = f.id === 'THANOS' ? f.stones >= 6 && !this.snapUsed : f.meter >= 100
    const su = f.s.su, ranged = (m: Move) => m.k === 'shot' || m.k === 'beam' || m.k === 'sky' || m.k === 'blink' || (m.k === 'grab' && (m.range ?? 0) > 40)
    if (canSuper && rnd() < 0.4 + 0.1 * this.tierNow && (ranged(su) || dist < 50 * k || su.k === 'giant' || su.k === 'phase' || su.k === 'snap')) { this.input(f, 'x'); return }
    const twiceGuard = o.last.length >= 2 && o.last[o.last.length - 1] === 'guard' && o.last[o.last.length - 2] === 'guard'
    if (close) {
      // throw a turtle (it reads your last guards); Widow loves a throw
      if ((o.st === 'block' || (twiceGuard && this.tierNow >= 2)) && this.g.t > f.shy && rnd() < 0.12 + 0.12 * this.tierNow + (bias === 'throw' ? 0.25 : 0)) { f.fwdAt = this.g.t; this.input(f, 'space'); return }
      const r = rnd()
      if (r < 0.55 + 0.08 * this.tierNow + (bias === 'rush' ? 0.1 : 0)) this.poke(f)
      else if (r < 0.72 && bias !== 'rush') this.input(f, 'down')
      else if (f.cd <= 0 && !ranged(f.s.sp)) this.input(f, 'c')
      else this.input(f, o.x > f.x ? 'left' : 'right')
      return
    }
    if (f.cd <= 0 && rnd() < (ranged(f.s.sp) ? T.spec + (bias === 'zone' ? 0.1 + T.spec * 0.3 : 0) : T.spec * 0.6) && (ranged(f.s.sp) || dist < 60 * k)) { this.input(f, 'c'); return }
    if (bias === 'wait' && dist < 50 * k && rnd() < 0.1 + 0.3 * Math.min(1, this.tierNow)) { this.input(f, 'down'); return } // Thanos waits for a mistake
    const dir = o.x > f.x ? 'right' : 'left'
    // close in: a run (double tap) when far, steps when near
    if (dist > 40 * k && rnd() < 0.3 + 0.1 * this.tierNow + (bias === 'rush' ? 0.3 : 0)) { f.lastTap = this.g.t - 0.12; f.lastTapDir = dir === 'right' ? 1 : -1; this.input(f, dir) }
    else { this.input(f, dir); if (rnd() < 0.05) this.input(f, 'up') }
  }

  // ── the finisher: the stones, the snap, and Thanos turning to dust ───────
  private finisher(dt: number) {
    const g = this.g, th = this.P[1], me = this.P[0]
    me.st = 'super'; me.mv = undefined; me.t = Math.min(me.t + dt, 0.5); me.face = th.x >= me.x ? 1 : -1
    th.st = 'hurt'; th.t = 0; th.vx = 0; th.y += (this.gy - th.y) * 0.2; th.vy = 0
    if (this.pt > 2 && !this.dust.on) { this.dust = { on: true, t: 0 }; this.kick(6, 10, 1, 0xffffff) }
    if (this.dust.on) {
      this.dust.t += dt
      const sh = this.sheet(th), kf = F_HURT, left = th.face > 0 ? th.x - sh.ax : th.x - (sh.w - 1 - sh.ax)
      for (let n = 0; n < 10; n++) {
        const px = Math.floor(g.rnd() * sh.w), py = Math.floor(g.rnd() * sh.h), o = kf * sh.w * sh.h + py * sh.w + px
        if (sh.a[o]! < 100) continue
        const i = g.pN; g.pN = (g.pN + 1) % g.pX.length
        g.pX[i] = left + (th.face > 0 ? px : sh.w - 1 - px); g.pY[i] = th.y - sh.ay + py
        g.pVX[i] = (0.6 + g.rnd() * 0.8) * this.k; g.pVY[i] = (-0.3 - g.rnd() * 0.4) * this.k; g.pM[i] = g.pL[i] = 1.2; g.pC[i] = mix(sh.px[o]!, 0x6a5040, 0.5); g.pK[i] = 3
      }
    }
    if (this.pt > 5.2) { this.koWinner = 0; this.finishMatch() }
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  draw() {
    const g = this.g, fb = g.fb, W = g.W, H = g.H, A = this.A
    if (this.g.H !== this.lastH) this.rescale()
    const shk = A < 30 ? Math.min(g.shake, A / 20) : g.shake
    const sx = shk ? Math.round((g.rnd() - 0.5) * shk) : 0, sy = shk ? Math.round((g.rnd() - 0.5) * shk * 0.6) : 0
    if (A >= 30) g.drawWorld(sx, sy); else for (let y = 0; y < H; y++) fb.px.fill(g.sky[y]!, y * W, y * W + W) // a small pane: just the sky, no skyline
    const a = ARENAS[this.gi]!
    for (let y = Math.max(0, this.gy + sy); y < H; y++) for (let x = 0; x < W; x++) fb.px[y * W + x] = mix(a.ground[0], a.ground[1], (y - this.gy) / 4)
    for (let x = 0; x < W; x++) { fb.set(x, this.gy + sy, mix(a.ground[0], 0xffffff, 0.18)); if ((x >> 2) % 3 === 0 && this.gy + 2 < H) fb.set(x + sx, this.gy + 2 + sy, mix(a.ground[1], 0xf5c542, 0.4)) }
    this.boxes[0] = this.boxes[1] = { x0: -99, y0: -99, x1: -99, y1: -99 }
    if (this.phase === 'select') { this.drawSelect(); return }
    if (this.phase === 'charge') { this.drawCharge(); return }
    if (this.wipe.on) {
      const kk = Math.sin(Math.min(1, this.wipe.t / 1.6) * Math.PI), x0 = this.wipe.left ? 0 : W >> 1
      fb.darken(x0, 0, W >> 1, H, 0.6 * kk)
      for (let n = 0; n < 6; n++) { const i = g.pN; g.pN = (g.pN + 1) % g.pX.length; g.pX[i] = x0 + g.rnd() * (W >> 1); g.pY[i] = g.rnd() * H; g.pVX[i] = 0.4 + g.rnd(); g.pVY[i] = -0.2; g.pM[i] = g.pL[i] = 1; g.pC[i] = 0x8a7060; g.pK[i] = 3 }
    }
    if (this.portals.done) this.drawPortals(sx)
    // headlines go under the fighters (and stay in the top band): the action is never hidden
    this.drawSplash()
    for (const f of this.P) for (let i = -6; i <= 6; i++) fb.blend(f.x + i * this.k + sx, this.gy + 1 + sy, 0x000000, 0.35 * (1 - Math.abs(i) / 7) * Math.max(0.3, 1 - (this.gy - f.y) / 40))
    const order = this.P[0].st === 'punch' || this.P[0].st === 'super' ? [1, 0] : [0, 1]
    if (this.phase === 'finisher' && this.P[0].id !== 'IRONMAN') this.drawTony(sx, sy)
    for (const i of order) this.drawFighter(this.P[i]!, sx, sy, i)
    this.drawShots(sx, sy)
    this.drawFx(sx, sy)
    g.drawParticles(sx, sy)
    for (const b of g.BM) if (b.on) { const f = b.t / (0.5 + b.r / 60); fb.glow(b.x + sx, b.y + sy, b.r * (0.5 + ease(f) * 0.7), b.c, (1 - f) * 1.1); fb.ring(b.x + sx, b.y + sy, b.r * ease(f) * 1.4, 1.4, b.c, (1 - f) * 0.8) }
    for (const r of this.rings) if (r.on) fb.ring(r.x + sx, r.y + sy, 3 + r.t * 30 * this.k, 1.4, r.c, 1 - r.t / 0.4)
    const fl = A < 30 ? Math.min(g.flashA, 0.3) : g.flashA
    if (fl > 0) for (let i = 0; i < fb.px.length; i++) fb.px[i] = addc(fb.px[i]!, g.flashC, fl * 0.6)
    this.drawMeters()
    for (const p of g.POP) if (p.on) fb.text(Math.round(p.x), Math.max(0, Math.round((p.y - p.t * 4) / 2)), p.s, p.t > 0.6 ? mix(p.c, 0x404060, (p.t - 0.6) * 2.5) : p.c)
    // SNAP: a 1-row bar pinned to the top, pulsing; the gold flash is the moment to tap ↓
    if (this.snapPend) { const now = Math.abs(g.t - this.snapFlash) < 0.25, soon = this.snapFlash - g.t < 0.6; fb.textC(0, now ? ' ▼▼ TAP ↓ NOW ▼▼ ' : soon ? ' ▼ GET READY: ↓ ON THE FLASH ▼ ' : ' THE STONES ARE CHARGED ', now ? 0x1a0a00 : 0xffd0ff, now ? 0xffd040 : Math.floor(g.t * 6) % 2 ? 0x5a1a7a : 0x2a0a3a) }
    if (this.phase === 'intro' && this.pt > 0.2 && fb.rows > 8) fb.textC(fb.rows - 1, ' SPACE skip ', C.dim, 0x0b0d18)
    if (this.phase === 'vs') this.drawVs()
    this.maskText()
    if (this.phase === 'match') this.drawMatch()
    if (this.paused) this.drawPause()
  }
  // No text cell sits on a fighter: any that would is cleared (words float above heads anyway).
  private maskText() {
    const fb = this.g.fb, W = this.g.W
    if (this.phase === 'vs') return
    for (const b of this.boxes) {
      if (b.x1 < 0) continue
      const r0 = Math.max(0, Math.floor(b.y0 / 2)), r1 = Math.min(fb.rows - 1, Math.floor(b.y1 / 2))
      for (let r = r0; r <= r1; r++) for (let x = Math.max(0, Math.floor(b.x0)); x <= Math.min(W - 1, Math.ceil(b.x1)); x++) { fb.och[r * W + x] = 0; fb.obg[r * W + x] = -1 }
    }
  }
  private drawPause() {
    const g = this.g, fb = g.fb, W = g.W, H = g.H
    fb.darken(0, 0, W, H, 0.45)
    const r = Math.max(0, (fb.rows >> 1) - 1)
    fb.textC(r, this.quitArmed ? ' PAUSED · Q again to QUIT ' : ' PAUSED ', 0xffffff, this.quitArmed ? 0x8e1a26 : 0x1a3a5a)
    fb.textC(Math.min(fb.rows - 1, r + 1), W >= 60 ? ' P resume · R restart · B menu · Q quit ' : ' P · R · B · Q ', 0xe6e8f5, 0x0b0d18)
  }
  private drawTony(sx: number, sy: number) {
    const fb = this.g.fb, sh = sheetOf('IRONMAN', this.k), me = this.P[0], x = me.x - 14 * this.k * me.face
    fb.spr(sh, F_SUPER, (me.face > 0 ? x - sh.ax : x - (sh.w - 1 - sh.ax)) + sx, this.gy - sh.ay + sy, 0, 1, -1, 0, me.face < 0)
  }
  private drawPortals(sx: number) {
    // orange sparkle rings in the back, the cast stepping through
    const g = this.g, fb = g.fb, W = g.W, k = this.k
    for (let j = 0; j < 3; j++) {
      const x = W * (0.2 + j * 0.3) + sx, y = this.gy - 18 * k, r = (6 + 2 * Math.sin(g.t * 3 + j)) * k + 2
      fb.ring(x, y, r, 1, 0xffa040, 0.55)
      for (let n = 0; n < 2; n++) { const a = g.t * 4 + n * 3 + j; fb.add(x + Math.cos(a) * r, y + Math.sin(a) * r, 0xffe0a0, 0.9) }
      const who = (['CAP', 'THOR', 'PANTHER'] as HeroId[])[j]!, ss = sheetOf(who, k * 0.6)
      fb.spr(ss, F_IDLE, x - ss.ax, y + r - ss.ay, 0, 0.35, 0x201010, 0.6)
    }
  }
  private drawShots(sx: number, sy: number) {
    const fb = this.g.fb, S = sprites(), k = this.k
    const shield = scaleSpr(S.shield, Math.max(0.4, k)), hammer = scaleSpr(S.hammer, Math.max(0.4, k))
    for (const s of this.S) if (s.on) {
      const x = s.x + sx, y = s.y + sy, dir = Math.sign(s.vx) || 1
      switch (s.kind) {
        case 'shield': fb.glow(x, y, 6 * k, 0x3f74f0, 0.4); fb.spr(shield, Math.floor(s.t * 30), x - shield.w / 2, y - shield.h / 2); break
        case 'hammer': fb.glow(x, y, 6 * k, 0x9db8ff, 0.5); fb.spr(hammer, Math.floor(s.t * 30), x - hammer.w / 2, y - hammer.h / 2); break
        case 'rocket': fb.glow(x, y, 6 * k, 0xff8a3a, 0.6); fb.rect(x - 2, y - 1, 4, 2, 0xc61f28); fb.set(x + dir * 2, y, 0xbac4d4); for (let i = 1; i < 8; i++) fb.add(x - dir * (i + 2), y, 0xff9a3a, 1 - i / 8); break
        case 'redwing': fb.glow(x, y, 4, 0xff3a3a, 0.5); fb.set(x, y, 0xffffff); for (const d of [-2, -1, 1, 2]) fb.set(x + d, y - 1, Math.abs(d) === 1 ? 0xc8323a : 0x8a92a2); break
        case 'arrow': case 'xarrow': { const ang = Math.atan2(s.vy, s.vx), cx = Math.cos(ang), cy = Math.sin(ang); for (let i = 0; i < 6; i++) fb.blend(x - cx * i, y - cy * i, i === 0 ? 0xffffff : i > 4 ? 0xb07ae8 : 0xd4b070, 1); if (s.kind === 'xarrow') fb.glow(x, y, 3, 0xff8a3a, 0.6); break }
        case 'bullet': fb.add(x, y, 0xfff0a0, 1); fb.add(x - dir, y, 0xffb040, 0.7); break
        case 'web': fb.blend(x, y, 0xffffff, 1); for (const [dx, dy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) fb.blend(x + dx, y + dy, 0xe0e0e8, 0.8); for (let i = 1; i < 10; i++) fb.blend(x - dir * i, y, 0xd0d0d8, 0.5); break
        case 'hex': fb.glow(x, y, 6 * k + 1, 0xff2a5a, 0.8); fb.ring(x, y, 2 + Math.sin(s.t * 20), 1, 0xff8aa0, 0.8); break
        default: { const c = s.kind === 'blast' ? 0xa855f7 : 0x7fe9ff, big = s.kind === 'bigrep' || s.kind === 'blast'; fb.glow(x, y, (big ? 6 : 4) * k + 1, c, 0.7); for (let i = 0; i < 8; i++) fb.add(x - dir * i, y, i < 2 ? 0xffffff : c, 1 - i / 8); if (big) for (let i = 0; i < 6; i++) { fb.add(x - dir * i, y - 1, c, 0.6 - i / 10); fb.add(x - dir * i, y + 1, c, 0.6 - i / 10) } }
      }
    }
  }
  private drawFx(sx: number, sy: number) {
    const g = this.g, fb = g.fb, W = g.W, S = sprites()
    if (this.beam.on) {
      const f = this.P[this.beam.owner]!, by = f.y - this.body(f).h * (f.id === 'VISION' ? 0.82 : 0.62) + sy, x0 = f.x + f.face * 3 * this.k + sx
      const x1 = f.face > 0 ? W : 0, th = this.beam.th, w = th * 0.4 + Math.sin(this.beam.t * 40) * 0.5
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let dy = -th; dy <= th; dy++) fb.add(x, by + dy, Math.abs(dy) <= w ? 0xffffff : this.beam.c, 1 - Math.abs(dy) / (th + 1))
      fb.glow(x0, by, 4 + th * 2, this.beam.c, 0.9)
      if (f.id === 'VISION') for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 2) fb.add(x, this.gy - 1, 0xffa040, 0.5) // a burning line on the tarmac
    }
    if (this.bolt.on) {
      const a = 1 - this.bolt.t / 0.5
      let x = this.bolt.x + sx, y = 0
      while (y < this.gy) { const nx = x + (g.rnd() - 0.5) * 6, ny = y + 3 + g.rnd() * 4; fb.line(x, y, nx, ny, 0xffffff, a); fb.line(x + 1, y, nx + 1, ny, 0x5c6cff, a * 0.7); x = nx; y = ny }
      fb.glow(this.bolt.x + sx, this.gy, 12 * this.k + 2, 0x9db8ff, a)
    }
    // telegraphs: where Thor's lightning lands; the cloud flashes white just before (the parry cue)
    for (const f of this.P) if (f.st === 'super' && f.mv?.k === 'sky' && f.t < f.mv.at) {
      const m = f.mark + sx, late = f.mv.at - f.t < 0.2
      for (let i = -3; i <= 3; i++) fb.add(m + i, this.gy - 1, 0x9db8ff, Math.floor(g.t * 12) % 2 ? 0.9 : 0.3)
      for (let i = -6; i <= 6; i++) fb.blend(m + i, 1, late ? 0xffffff : 0x5a6a8a, 0.9)
    }
    if (this.quake.on) { const f = this.quake.t / 0.7; fb.ring(this.quake.x + sx, this.gy + sy, ease(f) * W * 0.6, 2, 0x76cf57, 1 - f) }
    const w = this.webs[0]!
    if (w.on) fb.line(w.ax + sx, w.ay + sy, w.bx + sx, w.by + sy, w.c, 1 - w.t / 0.35, false)
    if (this.assistFx.kind >= 0 && this.assistIds[this.assistFx.kind] === 'HULK') {
      const t = this.assistFx.t, fist = scaleSpr(S.fist, Math.max(0.4, this.k))
      const fall = t < 0.5 ? (t / 0.5) ** 3 : t < 0.9 ? 1 : 1 - ease((t - 0.9) / 0.3)
      const fy = Math.floor(-fist.h + fall * (this.gy - 2)) + sy, fx = this.assistFx.x - (fist.w >> 1) + sx
      for (let y = fy - 1; y >= 0; y--) for (let i = 0; i < fist.w; i++) { const o = 2 * fist.w + i; if (fist.a[o]! > 25) fb.blend(fx + i, y, fist.px[o]!, 1) }
      fb.spr(fist, 0, fx, fy)
    }
  }

  private frameOf(f: Fighter) {
    const t = this.g.t
    switch (f.st) {
      case 'walk': case 'run': return F_WALK + (Math.floor(t * (f.st === 'run' ? 12 : 8)) & 1)
      case 'jump': return F_JUMP
      case 'punch': return f.y < this.gy - 1 ? F_JUMP : F_PUNCH
      case 'special': return f.mv?.k === 'dash' ? F_PUNCH : F_SPECIAL
      case 'super': return f.mv?.k === 'dash' || f.mv?.k === 'flurry' ? (Math.floor(t * 12) & 1 ? F_PUNCH : F_SPECIAL) : f.mv?.k === 'dive' ? F_JUMP : f.mv?.k === 'beam' || f.mv?.k === 'shot' || f.mv?.k === 'grab' ? F_SPECIAL : F_SUPER
      case 'block': return F_BLOCK
      case 'hurt': return F_HURT
      case 'ko': return f.y < this.gy - 1 ? F_HURT : F_KO
      default: return F_IDLE + (Math.floor(t * 2.5 + (f.ai ? 1 : 0)) & 1)
    }
  }
  private drawFighter(f: Fighter, sx: number, sy: number, i: number) {
    const g = this.g, fb = g.fb, shrunk = f.id === 'ANTMAN' && f.st === 'special' && f.mv?.k === 'dash'
    const sh = shrunk ? sheetOf('ANTMAN', Math.max(0.15, this.k * 0.3)) : this.sheet(f), kf = this.frameOf(f), flip = f.face < 0
    const left = flip ? f.x - (sh.w - 1 - sh.ax) : f.x - sh.ax, top = f.y - sh.ay
    this.boxes[i] = { x0: left, y0: top, x1: left + sh.w - 1, y1: top + sh.h - 1 } // where it stands (shake aside)
    if (this.dust.on && f.id === 'THANOS') { const a = Math.max(0, 1 - this.dust.t / 2.5); if (a > 0) fb.spr(sh, F_HURT, left + sx, top + sy, 0, a, 0x6a5040, 1 - a, flip); return }
    if (f.st === 'super') fb.glow(f.x + sx, top + sh.h * 0.5 + sy, sh.h * 0.6, f.s.color, 0.35 + 0.15 * Math.sin(g.t * 20))
    if (f.id === 'HULK' && f.hp < f.s.hp * 0.5) fb.glow(f.x + sx, top + sh.h * 0.5 + sy, sh.h * 0.5, 0x76cf57, 0.2 * (1 - f.hp / f.s.hp))
    const alpha = f.phase > 0 ? 0.35 + 0.15 * Math.sin(g.t * 30) : f.st === 'ko' && Math.floor(g.t * 15) % 2 ? 0.6 : 1
    // a hurt flash lights the outline only: the hero keeps their colours
    fb.spr(sh, kf, left + sx, top + sy, f.flash * 0.9, alpha, f.stun > 0 && f.st === 'hurt' ? 0x8ad0ff : -1, 0.25, flip, true)
    if (f.id === 'THANOS' || (this.phase === 'finisher' && f.id === 'IRONMAN')) {
      const [hx, hy] = this.hand(f, kf), n = f.id === 'THANOS' ? Math.floor(f.stones) : 6
      const gold = this.snapPend && Math.abs(g.t - this.snapFlash) < 0.12
      if (n > 0) fb.glow(hx + sx, hy + sy, 2 + n * this.k, gold ? 0xffe040 : [0x3b82f6, 0xfacc15, 0xef4444, 0xa855f7, 0x22c55e, 0xf97316][Math.floor(g.t * 6) % Math.max(1, n)]!, gold ? 1 : 0.25 + n * 0.08)
    }
    if (f.id === 'IRONMAN' || f.id === 'HULKBUSTER' || f.id === 'WARMACHINE') fb.glow(f.x + f.face + sx, top + sh.h * 0.36 + sy, 2.5 * this.k + 0.5, 0x7fe9ff, this.power400 > 0 && f.id === 'IRONMAN' ? 0.9 : 0.5)
    if (f.id === 'WANDA' && (f.st === 'special' || f.st === 'super' || f.st === 'idle')) { const [hx, hy] = this.hand(f, kf); fb.glow(hx + sx, hy + sy, 3 * this.k + 1, 0xff2a5a, 0.45) }
  }

  private drawMeters() {
    const fb = this.g.fb, W = this.g.W, len = Math.min(30, Math.floor(W * 0.3))
    // a live combo: one counter per side, under the meters, on the attacker's side
    for (const [i, f] of this.P.entries()) if (f.combo >= 2 && f.comboT > 0) { const s = ` ${f.combo} HIT `; fb.text(i === 0 ? 1 : W - s.length - 1, 2, s, f.combo >= 5 ? 0x1a0a00 : C.gold2, f.combo >= 5 ? C.gold2 : 0x1a1408) }
    for (const [i, f] of this.P.entries()) {
      const x0 = i === 0 ? 1 : W - 1 - len
      if (f.id === 'THANOS') {
        const cols = [0x3b82f6, 0xfacc15, 0xef4444, 0xa855f7, 0x22c55e, 0xf97316]
        for (let k = 0; k < 6; k++) { const on = k < Math.floor(f.stones), x = i === 0 ? 1 + k * 3 : W - 2 - (5 - k) * 3; for (const dx of [0, 1]) { fb.set(x + dx, 0, on ? cols[k]! : 0x2a2030); fb.set(x + dx, 1, on ? mix(cols[k]!, 0, 0.3) : 0x1a1420) } }
        continue
      }
      // the super meter (gold, flashing when ready)
      const full = f.meter >= 100, n = Math.round((f.meter / 100) * len)
      for (let k = 0; k < len; k++) { const on = i === 0 ? k < n : k >= len - n; fb.set(x0 + k, 0, on ? (full ? (Math.floor(this.g.t * 8) % 2 ? 0xffffff : C.gold2) : C.gold) : 0x2a2a3a) }
    }
  }
  private drawSplash() {
    const g = this.g, fb = g.fb, A = this.A
    if (this.phase === 'intro') {
      const t = this.pt
      if (t < 0.5) this.head(this.team ? ARENAS[1]!.title : `ROUND ${this.round}`, 0xffffff, C.gold, 1)
      else this.head('FIGHT!', 0xffe0c0, 0xff4a2a, Math.min(1, (0.9 - t) * 5 + 0.3))
      return
    }
    const dt = g.t - this.splashT
    if (dt >= 0 && dt < this.splashLen && this.splash) {
      const fade = this.splashLen <= 1 ? (dt > 0.4 ? 0.35 : 1) : Math.min(1, (this.splashLen - dt) * 3)
      const h = this.head(this.splash, mix(this.splashC, 0xffffff, 0.55), this.splashC, fade)
      if (this.sub && dt > 0.35 && A >= 40) fb.headline(this.sub, 2 + h + 1, 0xffffff, C.gold, fade, 1)
    }
    if (this.phase === 'finisher') {
      const t = this.pt
      if (t > 0.3 && t < 2) this.head('I AM...', 0xffffff, C.gold, Math.min(1, (t - 0.3) * 3))
      if (t > 2.8) this.head('IRON MAN', 0xffd0b0, 0xe02a20, 1) // after the snap frame shows, with nothing over it
    }
  }
  // a headline in the top band; at most a quarter of the arena tall (1 row on small panes)
  private head(s: string, top: number, bot: number, alpha: number) { return this.g.fb.headline(s, 2, top, bot, alpha) }

  // ── VS screen and THE CHARGE ─────────────────────────────────────────────
  private drawVs() {
    const g = this.g, fb = g.fb, W = g.W, R = fb.rows
    fb.darken(0, 0, W, g.H, 0.35)
    const [a, b] = this.P, e1 = ease(Math.min(1, this.pt / 0.3))
    const sa = sheetOf(a.id, Math.min(1.6, (g.H - 8) / bases()[a.id].h)), sb = sheetOf(b.id, Math.min(1.6, (g.H - 8) / bases()[b.id].h))
    fb.spr(sa, F_IDLE, Math.floor(W * 0.25 - sa.ax - (1 - e1) * W * 0.3), this.gy - sa.ay)
    fb.spr(sb, F_IDLE, Math.floor(W * 0.75 - (sb.w - 1 - sb.ax) + (1 - e1) * W * 0.3), this.gy - sb.ay, 0, 1, -1, 0, true)
    fb.headline('VS', 2, 0xffffff, C.gold, 1)
    fb.text(1, R - 1, ' ' + a.s.name + ' ', 0xffffff, mix(a.s.color, 0, 0.45))
    fb.text(W - b.s.name.length - 3, R - 1, ' ' + b.s.name + ' ', 0xffffff, mix(b.s.color, 0, 0.45))
  }
  private drawCharge() {
    // both trios sprint at each other, freeze mid-air, and the title lands
    const g = this.g, fb = g.fb, W = g.W, t = this.pt, k = this.k * 0.8
    const run = Math.min(1, t / 1.0), frozen = t > 1.0
    for (const [side, team] of this.T.entries()) team.forEach((f, j) => {
      const sh = sheetOf(f.id, k * (1 - j * 0.12)), dir = side === 0 ? 1 : -1
      const x = W * (side === 0 ? 0.05 + run * 0.32 : 0.95 - run * 0.32) - dir * j * 9 * k
      const y = this.gy - (frozen ? 10 * this.k : Math.abs(Math.sin(t * 9 + j)) * 3 * this.k)
      fb.spr(sh, frozen ? F_JUMP : F_WALK + (Math.floor(t * 12 + j) & 1), dir > 0 ? x - sh.ax : x - (sh.w - 1 - sh.ax), y - sh.ay, 0, 1 - j * 0.15, -1, 0, dir < 0)
    })
    if (frozen) fb.headline('CIVIL WAR', 2, 0xffffff, 0x4a7cf0, 1)
    if (fb.rows > 8) fb.textC(fb.rows - 1, ' SPACE skip ', C.dim, 0x0b0d18)
  }

  // ── the select screens: carousel (any pane), draft grid, tiers ───────────
  private drawSelect() {
    const g = this.g, fb = g.fb, W = g.W, H = g.H, R = fb.rows, t = g.t
    fb.darken(0, 0, W, H, 0.3)
    const L = this.list()
    if (this.gi === 1 && this.step === 0) {
      fb.textC(0, ' CIVIL WAR · PICK A SIDE ', 0xffffff, 0x1b3f8a)
      for (const [j, lead] of (['CAP', 'IRONMAN'] as HeroId[]).entries()) {
        const on = this.cur === j, cx = Math.floor(W * (j ? 0.72 : 0.28)), sh = sheetOf(lead, Math.min(1.4, (H - 10) / bases()[lead].h) * (on ? 1 : 0.85))
        fb.spr(sh, F_IDLE + (Math.floor(t * 2.5) & 1), cx - sh.ax, this.gy - sh.ay, 0, on ? 1 : 0.45, -1, 0, j === 1)
        const label = j ? ' TEAM IRON MAN ' : ' TEAM CAP '
        fb.text(cx - (label.length >> 1), R - 2, label, 0xffffff, on ? (j ? 0xc41f28 : 0x2a5cc4) : 0x2a2a3a)
      }
      fb.textC(R - 1, W >= 60 ? ' ←→ choose · SPACE pick · R random · B back ' : ' ←→ · SPACE · R · B ', C.dim, 0x0b0d18)
      return
    }
    // the Civil War draft: a 3 x 2 grid of the team when the pane has room, else the carousel
    if (this.gi === 1 && R >= 12 && W >= 60) { this.drawDraft(); return }
    const at = L[this.cur]!, rnd = at === 'RANDOM', id: HeroId = rnd ? 'CAP' : at
    const title = this.gi === 1 ? `DRAFT ${this.squad.length}/3` : this.step === 0 ? (this.gi === 4 ? 'WHO FACES THANOS?' : 'CHOOSE YOUR FIGHTER') : 'CHOOSE THE OPPONENT'
    fb.textC(0, ` ${title} `, 0xffffff, this.step === 1 && this.gi !== 1 ? 0x8e1a26 : 0x1b3f8a)
    const room = H - 8, s = rnd ? undefined : sheetOf(id, Math.min(1.2, room / bases()[id].h))
    const cx = W >= 70 ? Math.floor(W * 0.36) : W >> 1
    if (W >= 50) for (const d of [-1, 1]) {
      const nb = L[(this.cur + d + L.length) % L.length]!
      if (nb === 'RANDOM') continue
      const ns = sheetOf(nb, Math.min(0.9, (room * 0.6) / bases()[nb].h)), nx = cx + d * Math.floor(W * (W >= 70 ? 0.2 : 0.3))
      fb.spr(ns, F_IDLE, nx - ns.ax, this.gy - ns.ay, 0, 0.3, -1, 0, d < 0)
    }
    if (s) { fb.glow(cx, this.gy - s.h * 0.5, s.h * 0.7, STATS[id].color, 0.25); fb.spr(s, F_IDLE + (Math.floor(t * 2.5) & 1), cx - s.ax, this.gy - s.ay) }
    else { const shuffle = ROSTER[Math.floor(t * 12) % ROSTER.length]!, ss = sheetOf(shuffle, Math.min(1.4, room / bases()[shuffle].h)); fb.spr(ss, F_IDLE, cx - ss.ax, this.gy - ss.ay, 0, 0.5, 0x000000, 0.6) }
    const st = rnd ? undefined : STATS[id]
    const picked = this.gi === 1 ? this.squad.indexOf(id) : -1
    const plate = `◀ ${rnd ? '? RANDOM' : st!.name}${picked >= 0 ? '  ✓' + (picked + 1) : ''} ▶`
    fb.text(cx - (plate.length >> 1), 1, plate, 0xffffff, rnd ? 0x3a3a50 : mix(st!.color, 0x000000, 0.45))
    const bar = (v: number) => '▰'.repeat(v) + '▱'.repeat(5 - v)
    if (st && W >= 70 && R >= 10) {
      const x0 = Math.floor(W * 0.62), lines: [string, number][] = [
        [`POWER ${bar(st.bars[0])}`, 0xff8a6a], [`SPEED ${bar(st.bars[1])}`, 0x7fe9ff], [`RANGE ${bar(st.bars[2])}`, 0xffe08a],
        ['', 0], [`C  ${st.sp.name}`, 0xe6e8f5], [`X  ${st.su.name}`, st.color],
      ]
      lines.forEach(([l, c], j) => { if (l && 3 + j < R - 2) fb.text(x0, 3 + j, ' ' + l + ' ', c, 0x0b0d18) })
    } else if (st && R >= 7) fb.textC(R - 3, ` C ${st.sp.name} · X ${st.su.name} `, 0xe6e8f5, 0x0b0d18)
    if (this.gi === 1) fb.textC(R - 2, ` ${this.squad.map((h, j) => `${j + 1} ${STATS[h].short}`).join(' · ') || 'draft 3 · A = movie trio'} `, C.gold2, 0x0b0d18)
    else fb.textC(R - 2, ` AI ↑↓ ◆ ${TIERS[this.tier]!.name} ◆${this.step === 1 ? ` · you: ${STATS[this.pick].short}` : ''} `, C.gold2, 0x0b0d18)
    fb.textC(R - 1, W >= 64 ? ` ←→ browse · SPACE ${this.gi === 1 ? 'draft / drop' : 'pick'} · ${this.gi === 1 ? 'A auto' : 'R random'} · B back ` : ` ←→ · SPACE · ${this.gi === 1 ? 'A' : 'R'} · B `, C.dim, 0x0b0d18)
  }
  private drawDraft() {
    const g = this.g, fb = g.fb, W = g.W, R = fb.rows, t = g.t, L = this.list() as HeroId[]
    fb.textC(0, ` ${this.side === 'cap' ? 'TEAM CAP' : 'TEAM IRON MAN'} · DRAFT ${this.squad.length}/3 `, 0xffffff, this.side === 'cap' ? 0x1b3f8a : 0x8e1a26)
    const cw = Math.floor(W / 3), chH = Math.floor((R - 4) / 2) * 2 // px per grid row
    L.forEach((id, j) => {
      const col = j % 3, row = Math.floor(j / 3), on = j === this.cur, picked = this.squad.indexOf(id)
      const cx = col * cw + (cw >> 1), base = 2 + (row + 1) * chH
      const sh = sheetOf(id, Math.min(1.2, (chH - 4) / bases()[id].h))
      if (on) fb.glow(cx, base - sh.h * 0.5, sh.h * 0.6, STATS[id].color, 0.3)
      fb.spr(sh, F_IDLE + (on ? Math.floor(t * 2.5) & 1 : 0), cx - sh.ax, base - sh.ay, 0, picked >= 0 || on ? 1 : 0.8)
      const label = `${picked >= 0 ? picked + 1 + ' ' : ''}${STATS[id].short}`
      fb.text(cx - (label.length >> 1) - 1, base >> 1, ` ${label} `, 0xffffff, on ? (Math.floor(t * 4) % 2 ? STATS[id].color : mix(STATS[id].color, 0, 0.3)) : picked >= 0 ? 0x2a6a3a : 0x1a1a2a)
    })
    const st = STATS[L[this.cur]!]
    fb.textC(R - 2, ` ${st.name}: C ${st.sp.name} · X ${st.su.name} `, 0xe6e8f5, 0x0b0d18)
    fb.textC(R - 1, ' ←→↑↓ browse · SPACE draft / drop · A movie trio · B back ', C.dim, 0x0b0d18)
  }
  private drawMatch() {
    const g = this.g, fb = g.fb, W = g.W, H = g.H, R = fb.rows
    fb.darken(0, 0, W, H, Math.min(0.5, this.pt))
    const won = this.matchWon
    const word = won ? (this.gi === 4 ? 'AVENGERS ASSEMBLED' : this.gi === 1 ? (this.side === 'cap' ? 'TEAM CAP WINS' : 'TEAM IRON MAN WINS') : 'VICTORY') : 'DEFEAT'
    const h = fb.headline(word, 2, won ? 0xffffff : 0xffd0c8, won ? C.gold : 0xc41f28)
    let row = Math.min(R - 4, (2 + h + 2) >> 1)
    if (won && R >= 8) { fb.textC(row, `  RANK ${this.rank}  `, this.rank === 'S' ? 0x1a0a00 : 0xffffff, this.rank === 'S' ? C.gold2 : ARENAS[this.gi]!.color); row++ }
    const me = this.T[0]!, chain = Math.max(...me.map(f => f.maxChain)), parries = me.reduce((n, f) => n + f.parries, 0)
    const score = this.team ? `${me.filter(f => !f.out).length} of 3 standing` : `${this.P[0].wins} - ${this.P[1].wins}`
    if (R >= 7) fb.textC(row, ` ${score} · chain ${chain} · parries ${parries} · ${Math.round(this.clock)} s left `, C.text, 0x0b0d18)
    if (this.continueT > 0) fb.textC(Math.min(R - 2, row + 1), ` CONTINUE? ${Math.ceil(this.continueT)} · SPACE `, Math.floor(g.t * 3) % 2 ? 0xffffff : C.gold2, 0x8e1a26)
    if (this.pt > 0.5) fb.textC(R - 1, W >= 56 ? ` R rematch · S select · M menu${this.gi < 4 ? ' · N next' : ''} · Q quit ` : ' R · S · M · Q ', 0xffffff, 0x2a0d14)
  }

  // ── HUD: names, hero-colour health, red damage trail, clock, pips / team dots ─
  hud(): Run[] {
    const W = this.g.W, bg = C.hudbg, runs: Run[] = []
    const put = (s: string, fg: number, b = false, bgc = bg) => runs.push({ s, fg, bg: bgc, b })
    if (this.phase === 'select' || this.phase === 'charge' || this.phase === 'vs') { put(' ◆ ', C.gold, true); put(ARENAS[this.gi]!.title, C.gold2, true); put(' '.repeat(Math.max(0, W - 3 - ARENAS[this.gi]!.title.length)), C.dim); return runs }
    const [a, b] = this.P, narrow = W < 90
    const clock = ' ' + String(Math.ceil(this.clock)).padStart(2, '0') + ' '
    const nm = (f: Fighter) => ' ' + (narrow ? f.s.short : f.s.name) + ' '
    const marks = (side: number) => this.team ? this.T[side]!.map((f, j) => (f.out ? '×' : j === this.act[side] ? '●' : '○')).join('') : (this.P[side]!.wins >= 1 ? '◆' : '◇') + (this.P[side]!.wins >= 2 ? '◆' : '◇')
    const barW = Math.max(4, Math.floor((W - clock.length - nm(a).length - nm(b).length - 10) / 2))
    const bar = (f: Fighter, rev: boolean) => {
      const kk = Math.max(0, f.hp / f.s.hp), kt = Math.max(0, f.trail / f.s.hp)
      const n = Math.round(kk * barW), nt = Math.max(n, Math.min(barW, Math.round(kt * barW)))
      const c = kk > 0.25 ? f.s.color : Math.floor(this.g.t * 4) % 2 ? f.s.color : 0xff4a3a
      const parts: Run[] = [{ s: '█'.repeat(n), fg: c, bg }, { s: '█'.repeat(nt - n), fg: 0xd02020, bg }, { s: '░'.repeat(barW - nt), fg: 0x3a3a55, bg }]
      return rev ? parts.reverse() : parts
    }
    put(nm(a), a.s.color, true); runs.push(...bar(a, false)); put(' ' + marks(0), C.gold, true)
    put(clock, this.clock < 10 ? 0xff5a4a : 0xffffff, true, 0x2a2a40)
    put(marks(1) + ' ', C.gold, true); runs.push(...bar(b, true)); put(nm(b), b.s.color, true)
    const used = runs.reduce((n, r) => n + r.s.length, 0)
    if (used < W) runs.push({ s: ' '.repeat(W - used), fg: C.dim, bg })
    return runs
  }
  right() {
    if (this.phase !== 'fight' && this.phase !== 'intro') return ''
    if (this.gi === 4) return this.assistIds.map((h, i) => (this.assistUsed[i] ? '' : `${i + 1} ${STATS[h].short}`)).filter(Boolean).join(' ') + ' '
    if (this.team) { const f = this.P[0]; return f.tagCd > 0 ? `Z tag ${f.tagCd.toFixed(1)} ` : 'Z tag ' }
    return this.g.W >= 90 ? 'C special · X super ' : ''
  }
}
