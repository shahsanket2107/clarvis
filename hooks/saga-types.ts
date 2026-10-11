// clarvis AVENGERS THEATER: the script format of the comic movies.
// A movie is plain data: scenes of beats over the shared sprites and FX. No
// art lives here, so a movie costs only its text. saga.ts resolves a movie
// into timed panels (per viewing: pools, branches and rematches are picked
// with a seed) and draws them; theater-engine.ts plays them in the pane.

// Everyone who can stand in a panel. Fighters have arcade sheets (11 poses);
// the rest are baked band sprites, tinted fighter silhouettes or effects.
export const CHAR_IDS = [
  // arcade fighters
  'CAP', 'IRONMAN', 'THOR', 'HULK', 'HULKBUSTER', 'THANOS', 'BUCKY', 'FALCON', 'ANTMAN', 'HAWKEYE', 'WANDA', 'WARMACHINE', 'WIDOW', 'PANTHER', 'SPIDEY', 'VISION',
  // band heroes and villains without a sheet
  'LOKI', 'ULTRON', 'STRANGE', 'JARVIS', 'FURY', 'DEADPOOL', 'WOLVERINE',
  // the Guardians
  'STARLORD', 'GAMORA', 'DRAX', 'ROCKET', 'GROOT', 'MANTIS', 'NEBULA', 'YONDU',
  // extras (tinted silhouettes, cameo scale)
  'DRONE', 'CHITAURI', 'GIANTMAN', 'WONG', 'SHURI', 'OKOYE', 'DORA', 'MBAKU', 'KILLMONGER', 'VALKYRIE', 'KORG', 'HELA', 'GRANDMASTER',
  'DRAUGR', 'REBEL', 'CULTIST', 'RESCUE', 'CMARVEL', 'MAW', 'DORMAMMU', 'SYLVIE', 'KIDLOKI', 'CROCLOKI', 'HOWARD', 'PEPPER', 'COULSON', 'MARIA',
  // a voice: the whole team (narration of ensemble moments)
  'TEAM',
] as const
export type CharId = (typeof CHAR_IDS)[number]

// Backdrops: flat comic colour, Ben-Day dots and a silhouette.
export const BGS = ['city', 'tower', 'forest', 'heli', 'lab', 'street', 'sokovia', 'airport', 'bunker', 'arena', 'space', 'knowhere', 'ship', 'jungle', 'falls', 'titan', 'ruins', 'dark', 'mirror', 'void', 'sanctum', 'asgard', 'snow', 'night', 'farm', 'shield'] as const
export type Bg = (typeof BGS)[number]

// What a special or super throws. Each has its look, sound and burst.
export const FX_KINDS = [
  'bolt', 'repulsor', 'unibeam', 'shield', 'hammer', 'web', 'arrow', 'blast', 'hex', 'mind', 'claws', 'kinetic', 'smash', 'portal', 'illusion',
  'missile', 'gun', 'yaka', 'vines', 'bite', 'laser', 'gauntlet', 'sleep', 'teleport', 'katana', 'wings', 'shrink', 'photon', 'dagger', 'spear', 'sword',
] as const
export type FxKind = (typeof FX_KINDS)[number]

export const BEAT_KINDS = ['est', 'enter', 'say', 'talk', 'trade', 'special', 'super', 'clash', 'ko', 'stand', 'exit', 'arrive', 'crowd', 'charge', 'snap', 'card', 'group', 'battle', 'teamup'] as const
export type BeatKind = (typeof BEAT_KINDS)[number]
export type Side = 'l' | 'r'
// Team-up set pieces (teamup beats): who[0] and who[1] act together on the rw side.
//   bounce     who[0] throws a shield at who[1]'s repulsor palm; it ricochets through every rw, then back
//   fastball   who[0] hurls who[1] at rw[0]
//   thorcap    who[1] holds a shield; who[0] charges it and the shockwave floors rw
//   formation  all of who in a wedge fire at once at the horde rw
export const TEAM_MOVES = ['bounce', 'fastball', 'thorcap', 'formation'] as const
export type TeamMove = (typeof TEAM_MOVES)[number]
export type Pool<T> = T | readonly T[]

// One beat: one comic panel.
//   est      the scene's opening panel: backdrop, caption box (the scene's cap or this cap), l/r standing if given; `say` = narration in the caption
//   enter    l walks in from the left, r leaps in from the right
//   say      `by` speaks `say` in a balloon ("!..." a jagged shout, "~..." a thought bubble); by may be a char off-panel (a radio voice)
//   talk     `lines`: a back-and-forth, one balloon each ([side or char, text or pool])
//   trade    n exchanges of blows (moves, blocks and who attacks picked per viewing)
//   special  `by` throws `fx` at the other; big sound effect (`sfx`, else the fx's own)
//   super    `by` charges and unleashes `fx`: the big one (fires a screen FX burst)
//   clash    both hit at once in the middle: CLANG (fires a burst)
//   ko       `win` ('l', 'r' or '?' = picked per viewing) knocks the other down
//   stand    a stand-off: neither wins
//   exit     both leave
//   arrive   `who` step out of `fx` ('portal' default, or 'teleport', 'wings'...); earlier arrivals of the scene stay on stage
//   crowd    `who` (and `rw`, a second side facing them) fill the panel, the camera pans across all of them
//   charge   `who` (and `rw`) charge each other
//   snap     `by` snaps: `who` (or the other side) turn to comic dust. PG: they drift away, nobody hurts
//   group    `who` (3-8) stand together; `lines` [CharId, text] spoken by any of them, the rest listen and react
//   battle   `who` against `rw`: one duel per pair, all at once across the frame; the camera tracks between them (a GIANTMAN stomps behind)
//   teamup   `move` (see TeamMove): a combined move of `who` against `rw`
//   ext      (any beat) the bystanders: they stand behind l and r, react, and stay until the next `ext` ([] clears); `brawl: true` has them fight in pairs behind the action
//   card     a full-panel title card: `say` big, `cap` small (THE END? / THE AVENGERS WILL RETURN)
export type Beat = {
  k: BeatKind
  l?: Pool<CharId> | ''
  r?: Pool<CharId> | ''
  by?: Side | CharId
  say?: Pool<string>
  lines?: readonly (readonly [Side | CharId, Pool<string>])[]
  sfx?: Pool<string>
  fx?: FxKind
  win?: Side | '?'
  n?: number
  who?: readonly CharId[]
  rw?: readonly CharId[]
  cap?: string
  ext?: readonly CharId[]
  brawl?: boolean // with ext: the bystanders are fighting in pairs ([A1, B1, A2, B2...]) behind the action; sticky like ext
  move?: TeamMove
  d?: number
  alt?: readonly (readonly Beat[])[] // one branch picked per viewing (k is then ignored: use k: 'say')
}
export type Scene = { cap: string; bg: Bg; ext?: readonly CharId[]; brawl?: boolean; beats: readonly Beat[] }
export type Movie = {
  id: string; n: number; title: string; color: string // the cover's colour (#RRGGBB)
  hero: CharId // the cover star
  blurb: string // one line on the cover
  shuffle?: boolean // WHAT IF: the middle scenes play in a new order every viewing
  scenes: readonly Scene[]
}

// How long a beat holds the panel, in seconds (talk: each line).
export const SAY_S = (s: string) => Math.max(3.2, Math.min(8, 2.4 + [...s].length * 0.06))
export const BEAT_S: Record<BeatKind, number> = {
  est: 4, enter: 3, say: 0, talk: 0, trade: 1.4, special: 3.5, super: 4.5, clash: 3.5, ko: 4, stand: 3, exit: 2.5, arrive: 4, crowd: 8, charge: 5, snap: 6, card: 6, group: 0, battle: 18, teamup: 7,
}
export const COVER_S = 6 // the movie's cover card
