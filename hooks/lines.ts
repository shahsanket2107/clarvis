// clarvis: who says what. Each hero has real lines from the films and
// quips of their own about the work in hand, in their voice: the band
// alternates between them, and the hero speaks under their own name.
import type { Activity } from './scenes'
import { EXTRA, WOLVERINE } from './quips'

export type Line = { by: string; text: string }
const q = (s: string) => `"${s}"`

// Captions for the CLAUVENGERS, ASSEMBLE! moment (a turn is done): real film lines and cheers.
export const DONE: string[] = [
  "\"Avengers... assemble.\"",
  "\"Whatever it takes.\"",
  "\"I can do this all day.\"",
  "\"Part of the journey is the end.\"",
  "\"We're in the endgame now.\"",
  "\"I love you 3000.\"",
  "\"Wakanda forever!\"",
  "\"On your left.\"",
  "\"We have a Hulk.\"",
  "\"Hulk, smash!\"",
  "\"Higher, further, faster, baby.\"",
  "\"There was an idea.\"",
  "\"Mission complete. Shawarma, anyone?\"",
  "\"Tests green, work done. Shawarma is on the team.\"",
  "\"Another one for the win column. Go team.\"",
  "\"That's the job. Everybody take five.\"",
  "\"Ship it. Then nap. Then ship it again.\"",
]

// Real lines from the films.
export const QUOTES: Partial<Record<Activity, string[]>> = {
  thinking: ["At your service, sir.", "Working on a secret project, are we, sir?", "Sir, take a deep breath.", "I do anything and everything that Mr. Stark requires."],
  jarvis: ["Welcome home, sir."],
  ironman: ["I am Iron Man.", "Sometimes you gotta run before you can walk.", "Genius, billionaire, playboy, philanthropist.", "We have a Hulk.", "I told you, I don't want to join your super-secret boy band.", "Doth mother know you weareth her drapes?", "I love you 3000.", "And I... am... Iron Man."],
  cap: ["I can do this all day.", "On your left.", "Language!", "I understood that reference.", "I'm with you till the end of the line.", "Compromise where you can. Where you can't, don't.", "Avengers, assemble.", "There's only one God, ma'am, and I'm pretty sure he doesn't dress like that."],
  thor: ["Bring me Thanos!", "Another!", "I'm still worthy!", "I knew it!", "You people are so petty... and tiny.", "Hulk! Friend from work!", "Asgard is not a place. It's a people."],
  hulk: ["HULK SMASH!", "That's my secret, Cap. I'm always angry.", "Puny god.", "Hulk, smash!", "We're not a team. We're a time bomb.", "Puny god!"],
  assemble: ["Avengers... assemble.", "Whatever it takes.", "Part of the journey is the end."],
  widow: ["I'm always picking up after you boys.", "I've got red in my ledger. I'd like to wipe it out."],
  hawkeye: ["The city is flying. We're fighting an army of robots. And I have a bow and arrow.", "You and I remember Budapest very differently.", "I see better from a distance."],
  spidey: ["Hey, everyone.", "Mr. Stark, I don't feel so good.", "Your friendly neighborhood Spider-Man."],
  fury: ["I'm here to talk to you about the Avengers Initiative.", "Last time I trusted someone, I lost an eye.", "There was an idea, Mr. Stark... to bring together a group of remarkable people."],
  strange: ["Dormammu, I've come to bargain.", "We're in the endgame now.", "I went forward in time to view alternate futures."],
  witch: ["You took everything from me.", "I can't control their fear, only my own."],
  antman: ["Is it too late to change the name?", "I do some dumb things, and the people I love the most pay the price."],
  deadpool: ["Maximum effort!", "Time to make the chimichangas."],
  snap: ["I am inevitable.", "Perfectly balanced, as all things should be.", "Dread it. Run from it. Destiny arrives all the same.", "The hardest choices require the strongest wills.", "You should have gone for the head.", "Reality is often disappointing.", "I know what it's like to lose."],
  panther: ["Wakanda forever!", "In my culture, death is not the end.", "The wise build bridges, while the foolish build barriers."],
  vision: ["I am... I am.", "A thing isn't beautiful because it lasts.", "What is grief, if not love persevering?", "I am on the side of life."],
  loki: ["I am burdened with glorious purpose.", "Is not this simpler?", "Kneel before me.", "I am a god, you dull creature.", "I have an army."],
  ultron: ["There are no strings on me.", "I'm going to show you something beautiful.", "Everyone creaking and screaming, 'Peace in our time.'", "When the dust settles, the only thing living in this world will be metal."],
  starlord: ["I'm Star-Lord, man. Legendary outlaw?", "We're the Guardians of the Galaxy!", "Dance-off, bro. Me and you."],
  gamora: ["I'm going to die surrounded by the biggest idiots in the galaxy."],
  drax: ["Nothing goes over my head. My reflexes are too fast, I would catch it.", "I'm just going to stand here really still.", "Why is Gamora?"],
  rocket: ["Ain't nothing like me, except me!", "I'm gonna need that guy's leg."],
  groot: ["I am Groot.", "We are Groot.", "I am Steve Rogers."],
  mantis: ["I am Mantis.", "Sleep!"],
  nebula: ["I just wanted a sister."],
  yondu: ["I'm Mary Poppins, y'all!", "He may have been your father, boy, but he wasn't your daddy."],
  falcon: ["I do what he does, just slower."], // "On your left." is Cap's line here; Falcon's quips carry it
  warmachine: ["War Machine, rollin' out.", "Next time, baby."],
  cmarvel: ["Higher, further, faster, baby.", "I have nothing to prove to you."],
  bucky: ["I'm with you till the end of the line, pal.", "Who the hell is Bucky?", "Don't do anything stupid until I get back.", "Your mom's name was Sarah. You used to wear newspapers in your shoes."],
  responding: ["Shall I render using proposed specifications?", "Commencing automated assembly.", "As always, sir, a great pleasure watching you work."],
}

type Quip = (d: string) => Line | string
// (hand-written quips now live in quips.ts, with the rest of each hero's pool)
export const QUIPS: Partial<Record<Activity, Quip[]>> = {}

export const SPEAKER: Partial<Record<Activity, string>> = {
  thinking: 'JARVIS', responding: 'JARVIS', jarvis: 'JARVIS', ironman: 'IRON MAN', hulk: 'HULK', thor: 'THOR', cap: 'CAP', hawkeye: 'HAWKEYE',
  spidey: 'SPIDER-MAN', strange: 'DR STRANGE', witch: 'WANDA', widow: 'NATASHA', ultron: 'ULTRON', panther: "T'CHALLA", vision: 'VISION', loki: 'LOKI', antman: 'ANT-MAN', deadpool: 'DEADPOOL', starlord: 'STAR-LORD', gamora: 'GAMORA', drax: 'DRAX', rocket: 'ROCKET', groot: 'GROOT', mantis: 'MANTIS', nebula: 'NEBULA', yondu: 'YONDU', falcon: 'FALCON', warmachine: 'WAR MACHINE', cmarvel: 'CAPTAIN MARVEL', bucky: 'BUCKY', fury: 'NICK FURY', snap: 'THANOS', assemble: 'CAP',
}

// The n-th line for a hero: a real quote and a quip of their own, in turn.
export function lineFor(a: Activity, n: number, d = 'it'): Line {
  n = Number.isFinite(n) ? Math.abs(Math.floor(n)) : 0 // a clock that steps back never makes a negative index
  const by = SPEAKER[a] ?? 'JARVIS'
  const quotes = QUOTES[a] ?? QUOTES.jarvis!, quips = quipPool(a)
  if (a === 'deadpool' || n % 2 === 1 || !quotes.length) {
    const r = quips[(a === 'deadpool' ? n : Math.floor(n / 2)) % quips.length]!(clipD(d))
    if (typeof r !== 'string') return { by: r.by, text: q(r.text) }
    return { by: a === 'deadpool' && WOLVERINE.has(r) ? 'WOLVERINE' : by, text: q(r) }
  }
  return { by, text: q(quotes[(Math.floor(n / 2) + quoteStart(a)) % quotes.length]!) }
}
// Each session shuffles every hero's lines its own way: a new session never opens on the same lines.
let seed = (Math.random() * 0x100000000) >>> 0
// (tests pin the order)
export function setLineSeed(s: number) { seed = s >>> 0; pools.clear() }
function quoteStart(a: Activity) { let h = seed; for (const c of a) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }
// Hand-written quips plus the big extra pool, shuffled once per hero (seeded by name) so none repeats until all are used.
const pools = new Map<string, Quip[]>()
export function quipPool(a: Activity): Quip[] {
  let p = pools.get(a)
  if (p) return p
  const all: Quip[] = [...(QUIPS[a] ?? []), ...(EXTRA[a] ?? (a === 'responding' ? EXTRA.thinking! : [])).map((s): Quip => () => s)]
  let h = 2166136261 ^ seed // a fresh order every session, the same all through one
  for (const c of a) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const rnd = () => { h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j]!, all[i]!] }
  pools.set(a, p = all)
  return p
}
const clipD = (d: string) => { const a = [...(d || 'it')]; return a.length > 40 ? a.slice(0, 39).join('') + '…' : a.join('') }
