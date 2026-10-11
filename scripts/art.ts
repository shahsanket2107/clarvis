// clarvis: the original art, drawn as SVG in a chibi sticker style (bold
// dark outlines, flat cel shading: base, shadow, deep shadow, highlight).
// scripts/bake.ts rasterises each at the size the terminal draws it and
// downsamples it, anti-aliased, into hooks/baked.ts. `k` thickens the
// outline for small sizes so it stays about one subpixel wide.

export const INK = '#140709'
const RED = { hi: '#FF7A66', base: '#DA2830', shade: '#A3151E', deep: '#6A0A12' }
const GOLD = { hi: '#FFE28A', base: '#F4B53C', shade: '#C9861E', deep: '#8A5510' }
const ARC = { glow: '#2FD3FF', base: '#8AF6FF', core: '#FFFFFF', dim: '#1D6F88' }
const GREEN = { hi: '#A8EC70', base: '#62C23C', shade: '#3F9027', deep: '#255A18', ink: '#0C1A07' }
const STEEL = { hi: '#E4EAF5', base: '#A3ADC0', shade: '#717B90', deep: '#434A5A' }
const LEATHER = { hi: '#C08A58', base: '#8B5A2E', shade: '#5C3618' }
const SPRED = { hi: '#FF6474', base: '#D81F35', shade: '#9C1224' }
const SKIN = { hi: '#B98258', base: '#8E5C3B', shade: '#60391F' }

export type Art = { vb: [number, number]; svg: (k: number) => string }
const svg = (vb: [number, number], body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb[0]} ${vb[1]}">${body}</svg>`

// ── Iron Man's helmet ───────────────────────────────────────────────────────
const HELM_PATH = 'M60 6 C95 6 114 29 114 61 C114 85 106 101 93 111 L79 121 L41 121 L27 111 C14 101 6 85 6 61 C6 29 25 6 60 6 Z'
const FACE_PATH = 'M60 40 C78 40 90 42 95 50 L96 73 C96 91 86 104 72 113 L48 113 C34 104 24 91 24 73 L25 50 C30 42 42 40 60 40 Z'
const EYES = 'M29 63 L54 69 L52 78 L30 73 Z M91 63 L66 69 L68 78 L90 73 Z'
const EYE_CORE = 'M35 67 L51 71 L50 74 L36 71 Z M85 67 L69 71 L70 74 L84 71 Z'
// The helmet as a group (no eyes lit); `eyes` adds the lit eyes.
function helmetG(k: number, eyes: 'lit' | 'dark' | 'none') {
  return `
  <defs>
    <clipPath id="hc"><path d="${HELM_PATH}"/></clipPath>
    <clipPath id="fc"><path d="${FACE_PATH}"/></clipPath>
  </defs>
  <g clip-path="url(#hc)">
    <rect x="-10" y="-10" width="140" height="150" fill="${RED.deep}"/>
    <path d="${HELM_PATH}" transform="translate(-4 -4)" fill="${RED.shade}"/>
    <path d="${HELM_PATH}" transform="translate(-11 -9)" fill="${RED.base}"/>
    <path d="M24 40 C30 22 44 13 62 12" stroke="${RED.hi}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M60 6 L60 40" stroke="${RED.deep}" stroke-width="${2.5 * k}"/>
  </g>
  <path d="${HELM_PATH}" fill="none" stroke="${INK}" stroke-width="${6 * k}" stroke-linejoin="round"/>
  <g clip-path="url(#fc)">
    <rect x="0" y="30" width="120" height="100" fill="${GOLD.deep}"/>
    <path d="${FACE_PATH}" transform="translate(-3 -3)" fill="${GOLD.shade}"/>
    <path d="${FACE_PATH}" transform="translate(-8 -7)" fill="${GOLD.base}"/>
    <path d="M36 50 C46 45 70 45 82 49" stroke="${GOLD.hi}" stroke-width="6" fill="none" stroke-linecap="round"/>
  </g>
  <path d="${FACE_PATH}" fill="none" stroke="${INK}" stroke-width="${5 * k}" stroke-linejoin="round"/>
  <path d="M46 99 L74 99" stroke="${INK}" stroke-width="${4 * k}" stroke-linecap="round"/>
  <path d="M25 76 L9 80 M95 76 L111 80" stroke="${INK}" stroke-width="${3.5 * k}" stroke-linecap="round"/>
  ${eyes === 'none' ? '' : `<path d="${EYES}" fill="${eyes === 'lit' ? ARC.base : ARC.dim}" stroke="${INK}" stroke-width="${4 * k}" stroke-linejoin="round"/>`}
  ${eyes === 'lit' ? `<path d="${EYE_CORE}" fill="${ARC.core}"/>` : ''}`
}
export const helmet: Art = { vb: [120, 127], svg: k => svg([120, 127], helmetG(k, 'dark')) }
// The eyes' light alone, blurred into a glow (drawn over the helmet, faded in and out).
export const helmetEyes: Art = { vb: [120, 127], svg: () => svg([120, 127], `
  <defs><filter id="g" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter></defs>
  <path d="${EYES}" fill="${ARC.glow}" filter="url(#g)" opacity="0.9"/>
  <path d="${EYES}" fill="${ARC.base}"/><path d="${EYE_CORE}" fill="${ARC.core}"/>`) }

// ── Iron Man, full body, chibi: hovering, and firing with his right arm out ─
function body(k: number, fire: boolean) {
  const arm = fire
    ? `<path d="M74 82 C88 78 110 78 128 80 L130 92 C112 95 90 96 76 96 Z" fill="${RED.base}" stroke="${INK}" stroke-width="${4.5 * k}" stroke-linejoin="round"/>
       <path d="M78 84 C92 81 108 81 124 82" stroke="${RED.hi}" stroke-width="3" fill="none" stroke-linecap="round"/>
       <rect x="126" y="76" width="12" height="20" rx="4" fill="${GOLD.base}" stroke="${INK}" stroke-width="${4 * k}"/>
       <circle cx="140" cy="86" r="5" fill="${ARC.core}" stroke="${ARC.glow}" stroke-width="2"/>`
    : `<path d="M76 80 C86 84 92 98 94 114 L82 118 C80 104 76 94 70 88 Z" fill="${RED.base}" stroke="${INK}" stroke-width="${4.5 * k}" stroke-linejoin="round"/>
       <rect x="80" y="112" width="16" height="12" rx="4" fill="${GOLD.base}" stroke="${INK}" stroke-width="${4 * k}"/>
       <ellipse cx="88" cy="127" rx="5" ry="3" fill="${ARC.base}"/>`
  return `
  <!-- legs -->
  <path d="M38 118 L36 146 L48 146 L50 120 Z M62 118 L52 120 L54 146 L66 146 Z" fill="${RED.shade}" stroke="${INK}" stroke-width="${4.5 * k}" stroke-linejoin="round"/>
  <path d="M37 130 L49 130 M53 130 L65 130" stroke="${GOLD.base}" stroke-width="5"/>
  <path d="M34 144 L50 144 L50 152 L32 152 Z M52 144 L68 144 L70 152 L52 152 Z" fill="${RED.deep}" stroke="${INK}" stroke-width="${4 * k}" stroke-linejoin="round"/>
  <!-- left arm (his right in a mirror: the one at rest) -->
  <path d="M24 80 C14 84 8 98 6 114 L18 118 C20 104 24 94 30 88 Z" fill="${RED.base}" stroke="${INK}" stroke-width="${4.5 * k}" stroke-linejoin="round"/>
  <rect x="4" y="112" width="16" height="12" rx="4" fill="${GOLD.base}" stroke="${INK}" stroke-width="${4 * k}"/>
  <ellipse cx="12" cy="127" rx="5" ry="3" fill="${ARC.base}"/>
  ${arm}
  <!-- torso -->
  <path d="M22 76 C30 70 70 70 78 76 L72 112 C64 122 36 122 28 112 Z" fill="${RED.base}" stroke="${INK}" stroke-width="${5 * k}" stroke-linejoin="round"/>
  <path d="M60 74 C70 76 76 80 74 92 L70 112 C66 116 62 118 58 118 Z" fill="${RED.shade}"/>
  <path d="M36 98 L64 98 L60 114 L40 114 Z" fill="${GOLD.base}" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M26 80 C32 76 44 75 50 76" stroke="${RED.hi}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <!-- the arc reactor -->
  <circle cx="50" cy="86" r="9" fill="${STEEL.deep}" stroke="${INK}" stroke-width="${3 * k}"/>
  <circle cx="50" cy="86" r="6" fill="${ARC.base}"/><circle cx="50" cy="86" r="3" fill="${ARC.core}"/>
  <!-- the head -->
  <g transform="translate(10 0) scale(0.667)">${helmetG(k * 1.5, 'lit')}</g>`
}
export const ironman: Art = { vb: [100, 156], svg: k => svg([100, 156], body(k, false)) }
export const ironmanFire: Art = { vb: [146, 156], svg: k => svg([146, 156], body(k, true)) }

// ── Hulk's fist, knuckles down, forearm up ──────────────────────────────────
export const hulkFist: Art = { vb: [110, 130], svg: k => svg([110, 130], `
  <defs><clipPath id="f"><path id="fp" d="M30 0 L80 0 L84 40 C98 46 104 58 104 72 L104 104 C104 118 94 126 82 126 L28 126 C14 126 6 118 6 104 L6 70 C6 56 14 46 26 42 Z"/></clipPath></defs>
  <g clip-path="url(#f)">
    <rect width="110" height="130" fill="${GREEN.deep}"/>
    <path d="M30 0 L80 0 L84 40 C98 46 104 58 104 72 L104 104 C104 118 94 126 82 126 L28 126 C14 126 6 118 6 104 L6 70 C6 56 14 46 26 42 Z" transform="translate(-5 -4)" fill="${GREEN.shade}"/>
    <path d="M30 0 L80 0 L84 40 C98 46 104 58 104 72 L104 104 C104 118 94 126 82 126 L28 126 C14 126 6 118 6 104 L6 70 C6 56 14 46 26 42 Z" transform="translate(-12 -8)" fill="${GREEN.base}"/>
    <path d="M36 4 L34 36 M48 8 C46 20 50 28 46 38" stroke="${GREEN.deep}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M18 54 C24 48 34 46 40 46" stroke="${GREEN.hi}" stroke-width="6" fill="none" stroke-linecap="round"/>
  </g>
  <path d="M30 0 L80 0 L84 40 C98 46 104 58 104 72 L104 104 C104 118 94 126 82 126 L28 126 C14 126 6 118 6 104 L6 70 C6 56 14 46 26 42 Z" fill="none" stroke="${GREEN.ink}" stroke-width="${5 * k}" stroke-linejoin="round"/>
  <!-- the thumb, wrapped across -->
  <path d="M10 66 C30 60 66 60 82 66 C88 70 88 78 82 80 C66 76 30 76 12 80 Z" fill="${GREEN.base}" stroke="${GREEN.ink}" stroke-width="${4 * k}" stroke-linejoin="round"/>
  <path d="M20 66 C36 63 60 63 74 66" stroke="${GREEN.hi}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <!-- four fingers, rolled under: the knuckles at the bottom -->
  ${[0, 1, 2, 3].map(i => {
    const x = 8 + i * 24
    return `<rect x="${x}" y="84" width="22" height="40" rx="10" fill="${GREEN.base}" stroke="${GREEN.ink}" stroke-width="${4 * k}"/>
      <rect x="${x + 13}" y="88" width="7" height="32" rx="3.5" fill="${GREEN.shade}"/>
      <path d="M${x + 6} 92 L${x + 6} 112" stroke="${GREEN.hi}" stroke-width="4" stroke-linecap="round"/>`
  }).join('')}`) }

// ── Mjölnir ─────────────────────────────────────────────────────────────────
export const mjolnir: Art = { vb: [100, 124], svg: k => svg([100, 124], `
  <rect x="44" y="50" width="12" height="54" fill="${LEATHER.base}" stroke="${INK}" stroke-width="${4 * k}"/>
  ${[0, 1, 2, 3, 4, 5].map(i => `<path d="M44 ${56 + i * 8} L56 ${52 + i * 8}" stroke="${LEATHER.shade}" stroke-width="3"/>`).join('')}
  <path d="M47 54 L47 102" stroke="${LEATHER.hi}" stroke-width="2.5"/>
  <rect x="40" y="102" width="20" height="10" rx="3" fill="${STEEL.base}" stroke="${INK}" stroke-width="${4 * k}"/>
  <path d="M46 112 C40 124 60 124 54 112" fill="none" stroke="${LEATHER.base}" stroke-width="4"/>
  <!-- the head: top face, front face, bevelled edges -->
  <rect x="6" y="6" width="88" height="48" rx="7" fill="${STEEL.deep}"/>
  <rect x="6" y="6" width="84" height="44" rx="7" fill="${STEEL.shade}"/>
  <rect x="6" y="6" width="80" height="18" rx="7" fill="${STEEL.hi}"/>
  <rect x="10" y="20" width="76" height="26" rx="3" fill="${STEEL.base}"/>
  <path d="M30 26 C38 40 62 40 70 26 M30 40 C38 28 62 28 70 40" stroke="${STEEL.shade}" stroke-width="3" fill="none"/>
  <path d="M12 12 L56 12" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
  <rect x="6" y="6" width="88" height="48" rx="7" fill="none" stroke="${INK}" stroke-width="${5 * k}"/>`) }

// ── Captain America's shield (squashed across for the spin) ─────────────────
export const shieldArt = (sx: number): Art => ({ vb: [100, 100], svg: k => svg([100, 100], `
  <defs>
    <clipPath id="c"><circle cx="50" cy="50" r="47"/></clipPath>
    <radialGradient id="l" cx="0.32" cy="0.28" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></radialGradient>
  </defs>
  <g transform="translate(50 50) scale(${sx} 1) translate(-50 -50)">
    <circle cx="50" cy="50" r="47" fill="#D3222E"/>
    <circle cx="50" cy="50" r="37" fill="#EEF1F7"/>
    <circle cx="50" cy="50" r="27.5" fill="#D3222E"/>
    <circle cx="50" cy="50" r="19" fill="#1F4BC0"/>
    <path d="M50 33 L54.2 45.6 L67.5 45.6 L56.8 53.4 L60.9 66 L50 58.2 L39.1 66 L43.2 53.4 L32.5 45.6 L45.8 45.6 Z" fill="#FFFFFF" stroke="${INK}" stroke-width="${1.5 * k}" stroke-linejoin="round"/>
    <circle cx="50" cy="50" r="47" fill="url(#l)"/>
    <circle cx="50" cy="50" r="37" fill="none" stroke="${INK}" stroke-width="${1.6 * k}" opacity="0.6"/>
    <circle cx="50" cy="50" r="27.5" fill="none" stroke="${INK}" stroke-width="${1.6 * k}" opacity="0.6"/>
    <path d="M18 34 C24 20 36 12 50 10" stroke="#FFFFFF" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7"/>
    <circle cx="50" cy="50" r="47" fill="none" stroke="${INK}" stroke-width="${5 * k}"/>
  </g>`) })

// ── Spider-Man's mask ───────────────────────────────────────────────────────
const SP_HEAD = 'M50 4 C78 4 94 24 94 52 C94 78 78 102 50 106 C22 102 6 78 6 52 C6 24 22 4 50 4 Z'
export const spidey: Art = { vb: [100, 110], svg: k => svg([100, 110], `
  <defs><clipPath id="h"><path d="${SP_HEAD}"/></clipPath></defs>
  <g clip-path="url(#h)">
    <rect width="100" height="110" fill="${SPRED.shade}"/>
    <path d="${SP_HEAD}" transform="translate(-6 -5)" fill="${SPRED.base}"/>
    <g stroke="${INK}" stroke-width="${1.6 * k}" fill="none" opacity="0.85">
      ${[-75, -45, -15, 15, 45, 75, 105, 135, 165, 195, 225, 255].map(a => { const r = (a * Math.PI) / 180; return `<path d="M50 50 L${50 + Math.cos(r) * 70} ${50 + Math.sin(r) * 70}"/>` }).join('')}
      <circle cx="50" cy="50" r="16"/><circle cx="50" cy="50" r="32"/><circle cx="50" cy="50" r="48"/>
    </g>
    <path d="M22 26 C30 14 42 9 54 9" stroke="${SPRED.hi}" stroke-width="6" fill="none" stroke-linecap="round"/>
  </g>
  <path d="${SP_HEAD}" fill="none" stroke="${INK}" stroke-width="${5 * k}"/>
  <!-- the lenses: big white teardrops, thick black rims -->
  <path d="M14 44 C24 36 40 40 46 56 C46 66 38 72 30 70 C20 68 12 56 14 44 Z" fill="#F4F7FF" stroke="${INK}" stroke-width="${6 * k}" stroke-linejoin="round"/>
  <path d="M86 44 C76 36 60 40 54 56 C54 66 62 72 70 70 C80 68 88 56 86 44 Z" fill="#F4F7FF" stroke="${INK}" stroke-width="${6 * k}" stroke-linejoin="round"/>
  <path d="M22 48 C28 44 34 45 38 50" stroke="#FFFFFF" stroke-width="3" fill="none"/>`) }

// ── the Infinity Gauntlet, fingers up; the stones' sockets ──────────────────
export const STONE_XY: [number, number][] = [[26, 40], [43, 30], [60, 32], [76, 44], [92, 74], [50, 82]] // in the viewBox
export const gauntlet: Art = { vb: [110, 138], svg: k => svg([110, 138], `
  ${[[18, 22, 34], [35, 12, 30], [52, 14, 30], [69, 26, 34]].map(([x, y]) => `<rect x="${x}" y="${y}" width="16" height="50" rx="8" fill="${GOLD.base}" stroke="${INK}" stroke-width="${4 * k}"/><rect x="${x! + 10}" y="${y! + 6}" width="4" height="40" rx="2" fill="${GOLD.shade}"/><path d="M${x! + 4} ${y! + 8} L${x! + 4} ${y! + 30}" stroke="${GOLD.hi}" stroke-width="3" stroke-linecap="round"/>`).join('')}
  <path d="M84 64 C96 60 104 66 102 76 L94 92 L80 90 Z" fill="${GOLD.base}" stroke="${INK}" stroke-width="${4 * k}" stroke-linejoin="round"/>
  <path d="M14 56 L88 56 L92 100 C92 114 80 122 66 122 L36 122 C22 122 12 114 12 100 Z" fill="${GOLD.base}" stroke="${INK}" stroke-width="${5 * k}" stroke-linejoin="round"/>
  <path d="M70 58 L88 58 L90 100 C90 110 82 118 70 120 Z" fill="${GOLD.shade}"/>
  <path d="M20 64 C34 60 52 60 64 62" stroke="${GOLD.hi}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <rect x="16" y="118" width="74" height="18" rx="5" fill="${GOLD.shade}" stroke="${INK}" stroke-width="${4.5 * k}"/>
  ${STONE_XY.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#3A2408" stroke="${INK}" stroke-width="${2.5 * k}"/>`).join('')}`) }

// ── Nick Fury, bust ─────────────────────────────────────────────────────────
export const fury: Art = { vb: [100, 112], svg: k => svg([100, 112], `
  <path d="M8 112 C10 90 26 80 50 80 C74 80 90 90 92 112 Z" fill="#23252E" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M30 84 L50 104 L70 84" fill="none" stroke="#3B3E4C" stroke-width="5"/>
  <path d="M50 6 C74 6 86 22 86 46 C86 70 72 88 50 88 C28 88 14 70 14 46 C14 22 26 6 50 6 Z" fill="${SKIN.base}" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M62 10 C80 16 86 32 84 52 C82 72 70 84 54 86 C70 72 74 40 62 10 Z" fill="${SKIN.shade}"/>
  <path d="M26 20 C32 12 42 9 50 9" stroke="${SKIN.hi}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <!-- the brow, the eye, the patch and its strap -->
  <path d="M22 40 L42 44 M58 44 L78 40" stroke="${INK}" stroke-width="${4 * k}" stroke-linecap="round"/>
  <ellipse cx="33" cy="50" rx="6" ry="4" fill="#F1F1F4" stroke="${INK}" stroke-width="${2.5 * k}"/><circle cx="34" cy="50" r="2.4" fill="${INK}"/>
  <path d="M14 30 L86 58" stroke="#0B0B0F" stroke-width="${3 * k}"/>
  <path d="M56 44 C60 40 76 40 78 46 L76 58 C70 62 60 60 56 56 Z" fill="#0B0B0F" stroke="${INK}" stroke-width="${2 * k}"/>
  <!-- the goatee -->
  <path d="M38 68 C44 64 56 64 62 68 L60 80 C56 86 44 86 40 80 Z" fill="#2A1A12" stroke="${INK}" stroke-width="${2 * k}"/>
  <path d="M44 72 L56 72" stroke="${SKIN.shade}" stroke-width="3" stroke-linecap="round"/>`) }

// ── the Clarvis emblem: a gold C around an arc-reactor core (an original mark) ──
export const logo: Art = { vb: [110, 100], svg: k => svg([110, 100], `
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD.hi}"/><stop offset="0.55" stop-color="${GOLD.base}"/><stop offset="1" stop-color="${GOLD.shade}"/></linearGradient>
  <radialGradient id="c" cx="0.4" cy="0.38" r="0.7"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.35" stop-color="#9BF0FF"/><stop offset="1" stop-color="#2F8FC8"/></radialGradient></defs>
  <path d="M80 18 A40 40 0 1 0 80 82" fill="none" stroke="${INK}" stroke-width="${26 * Math.min(1.3, k)}"/>
  <path d="M80 18 A40 40 0 1 0 80 82" fill="none" stroke="url(#g)" stroke-width="18"/>
  <path d="M80 18 A40 40 0 1 0 80 82" fill="none" stroke="${RED.base}" stroke-width="3" stroke-dasharray="6 9" opacity="0.85"/>
  <circle cx="52" cy="50" r="17" fill="url(#c)" stroke="${INK}" stroke-width="${4.5 * k}"/>
  <circle cx="52" cy="50" r="6" fill="#FFFFFF" stroke="#9BF0FF" stroke-width="2"/>
  <path d="M52 37 L52 42 M52 58 L52 63 M39 50 L44 50 M60 50 L65 50" stroke="${INK}" stroke-width="${2.5 * k}" stroke-linecap="round"/>`) }

// ── Black Widow's hourglass (the roll call) ─────────────────────────────────
export const widow: Art = { vb: [100, 100], svg: k => svg([100, 100], `
  <circle cx="50" cy="50" r="44" fill="#1A1A22" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M28 22 L72 22 L52 50 L72 78 L28 78 L48 50 Z" fill="#E0233A" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>`) }

// ── Black Panther: the vibranium cowl, cat ears, white eye slits, the necklace
export const panther: Art = { vb: [100, 110], svg: k => svg([100, 110], `
  <path d="M6 110 C8 92 24 84 50 84 C76 84 92 92 94 110 Z" fill="#34304E" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M22 88 C30 100 40 104 50 104 C60 104 70 100 78 88 L70 86 C64 94 56 96 50 96 C44 96 36 94 30 86 Z" fill="#D5D0F2" stroke="${INK}" stroke-width="${2.5 * k}" stroke-linejoin="round"/>
  <path d="M36 98 L40 92 M50 102 L50 95 M64 98 L60 92" stroke="#8E6CFF" stroke-width="${3 * k}" stroke-linecap="round"/>
  <path d="M14 46 L10 4 L38 20 C44 18 56 18 62 20 L90 4 L86 46 C88 70 72 90 50 90 C28 90 12 70 14 46 Z" fill="#3A3558" stroke="${INK}" stroke-width="${5 * k}" stroke-linejoin="round"/>
  <path d="M62 22 L88 8 L84 46 C86 68 74 84 56 88 C70 70 72 44 62 22 Z" fill="#201C34"/>
  <path d="M14 14 L18 28 M86 14 L82 28" stroke="#8E6CFF" stroke-width="${3 * k}" stroke-linecap="round"/>
  <path d="M18 8 L22 22 M82 8 L78 22" stroke="#6E50D0" stroke-width="${2 * k}"/>
  <path d="M30 28 C36 22 46 22 50 24" stroke="#5A4A96" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M20 52 C28 42 42 46 46 58 C38 62 26 60 20 52 Z" fill="#FFFFFF" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M80 52 C72 42 58 46 54 58 C62 62 74 60 80 52 Z" fill="#FFFFFF" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M26 70 L38 78 M74 70 L62 78 M44 66 L50 72 L56 66" stroke="#B9A6FF" stroke-width="${2.5 * k}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`) }

// ── Vision: red-magenta face, green and gold cape, the Mind Stone ───────────
export const vision: Art = { vb: [100, 112], svg: k => svg([100, 112], `
  <path d="M0 112 C2 88 20 78 50 78 C80 78 98 88 100 112 Z" fill="#2E9B4A" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M60 80 C86 84 98 94 100 112 L78 112 C78 98 72 88 60 80 Z" fill="#1E6E34"/>
  <path d="M24 82 L50 108 L76 82 L66 78 L50 92 L34 78 Z" fill="#F4B53C" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M50 4 C76 4 90 24 88 50 C86 72 70 86 50 86 C30 86 14 72 12 50 C10 24 24 4 50 4 Z" fill="#E0306A" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M62 8 C84 16 88 38 86 54 C84 74 70 84 54 86 C70 70 74 34 62 8 Z" fill="#A81C50"/>
  <path d="M26 20 C32 12 42 8 50 8" stroke="#FF7FA0" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M12 44 C12 28 30 20 50 20 C70 20 88 28 88 44 C80 36 66 34 50 34 C34 34 20 36 12 44 Z" fill="#2E9B4A" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M50 22 L50 34" stroke="#F4B53C" stroke-width="${3 * k}"/>
  <path d="M42 66 L58 66 L56 82 L44 82 Z" fill="#F4B53C"/>
  <path d="M20 54 C26 48 36 48 42 54 C36 60 26 60 20 54 Z M80 54 C74 48 64 48 58 54 C64 60 74 60 80 54 Z" fill="#FFF6B0" stroke="${INK}" stroke-width="${3 * k}"/>
  <path d="M36 70 C44 74 56 74 64 70" stroke="${INK}" stroke-width="${3 * k}" fill="none" stroke-linecap="round"/>
  <circle cx="50" cy="30" r="9" fill="#FFE33A" stroke="${INK}" stroke-width="${3 * k}"/>
  <circle cx="47" cy="27" r="3" fill="#FFFFFF"/>`) }

// ── Loki: the golden horned helmet, green cape, the sceptre ─────────────────
export const loki: Art = { vb: [110, 120], svg: k => svg([110, 120], `
  <path d="M10 120 C12 96 28 86 54 86 C80 86 96 96 98 120 Z" fill="#1F7A3C" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M30 90 L54 118 L78 90 L66 86 L54 100 L42 86 Z" fill="#14141A" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M40 94 L54 108 L68 94" stroke="#F4B53C" stroke-width="${3 * k}" fill="none" stroke-linejoin="round"/>
  <path d="M54 22 C72 22 82 38 80 56 C78 76 66 90 54 90 C42 90 30 76 28 56 C26 38 36 22 54 22 Z" fill="#E8D3BE" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M66 26 C80 36 80 58 76 70 C72 82 64 88 56 90 C68 72 72 44 66 26 Z" fill="#C8A98E"/>
  <path d="M26 56 C22 30 40 14 54 14 C68 14 86 30 82 56 C80 44 72 32 54 32 C36 32 28 44 26 56 Z" fill="#14141A" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M26 56 L22 82 M82 56 L80 82" stroke="#14141A" stroke-width="${7 * k}" stroke-linecap="round"/>
  <path d="M30 34 C14 28 6 14 10 2 C18 14 30 18 38 22 Z M78 34 C94 28 102 14 98 2 C90 14 78 18 70 22 Z" fill="#F4B53C" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M30 34 C42 26 66 26 78 34 L76 42 C64 34 44 34 32 42 Z" fill="#F4B53C" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M54 26 L50 40 L54 46 L58 40 Z" fill="#FFE28A" stroke="${INK}" stroke-width="${2 * k}" stroke-linejoin="round"/>
  <path d="M34 56 C38 52 44 52 48 56 M60 56 C64 52 70 52 74 56" stroke="${INK}" stroke-width="${3 * k}" fill="none" stroke-linecap="round"/>
  <circle cx="41" cy="58" r="3" fill="#3FBF5A"/><circle cx="67" cy="58" r="3" fill="#3FBF5A"/>
  <path d="M44 76 C50 80 58 80 64 76" stroke="${INK}" stroke-width="${3 * k}" fill="none" stroke-linecap="round"/>
  <path d="M96 118 L102 40" stroke="#F4B53C" stroke-width="${4 * k}" stroke-linecap="round"/>
  <path d="M98 40 C90 36 92 24 102 20 C112 24 112 36 104 40 Z" fill="#F4B53C" stroke="${INK}" stroke-width="${2.5 * k}"/>
  <circle cx="102" cy="29" r="6" fill="#4FC3FF" stroke="${INK}" stroke-width="${2 * k}"/><circle cx="100" cy="27" r="2" fill="#FFFFFF"/>`) }

// ── Ultron: the chrome head, red eyes, the jagged grille ────────────────────
export const ultron: Art = { vb: [100, 112], svg: k => svg([100, 112], `
  <path d="M10 112 C12 94 28 86 50 86 C72 86 88 94 90 112 Z" fill="#59606F" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M38 84 L38 96 M62 84 L62 96" stroke="#2A2E38" stroke-width="${5 * k}"/>
  <path d="M50 4 C76 4 90 20 90 44 C90 68 78 86 50 86 C22 86 10 68 10 44 C10 20 24 4 50 4 Z" fill="#B9C2D2" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M62 8 C84 14 90 34 88 52 C86 72 72 84 54 86 C72 70 76 34 62 8 Z" fill="#7F8898"/>
  <path d="M24 18 C32 10 42 7 52 7" stroke="#F2F6FF" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M50 4 L50 24" stroke="#7F8898" stroke-width="${3 * k}"/>
  <path d="M16 38 L45 43 L43 60 L19 56 Z M84 38 L55 43 L57 60 L81 56 Z" fill="#3A0A10" stroke="${INK}" stroke-width="${3.5 * k}" stroke-linejoin="round"/>
  <path d="M20 43 L43 47 L42 56 L22 53 Z M80 43 L57 47 L58 56 L78 53 Z" fill="#FF2A2A"/>
  <path d="M26 47 L36 49" stroke="#FFD0C0" stroke-width="2.5" stroke-linecap="round"/><path d="M74 47 L64 49" stroke="#FFD0C0" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M28 68 L34 64 L38 72 L44 64 L50 72 L56 64 L62 72 L66 64 L72 68 L68 80 L32 80 Z" fill="#2A2E38" stroke="${INK}" stroke-width="${3.5 * k}" stroke-linejoin="round"/>
  <path d="M36 74 L64 74" stroke="#9AA3B4" stroke-width="2.5"/>`) }

// ── Hawkeye's arrow (flies right) and his target ────────────────────────────
export const arrow: Art = { vb: [140, 24], svg: k => svg([140, 24], `
  <path d="M6 4 L26 12 L6 20 L14 12 Z" fill="#A47BE0" stroke="${INK}" stroke-width="${2.5 * k}" stroke-linejoin="round"/>
  <rect x="14" y="9.5" width="104" height="5" fill="#C7A266" stroke="${INK}" stroke-width="${2 * k}"/>
  <path d="M116 4 L138 12 L116 20 Z" fill="${STEEL.hi}" stroke="${INK}" stroke-width="${2.5 * k}" stroke-linejoin="round"/>`) }

// ── the wordmarks ───────────────────────────────────────────────────────────
export type Word = { text: string; top: string; mid: string; bot: string; ink: string }
export const WORDS: Record<string, Word> = {
  assembleLine: { text: 'CLAUVENGERS, ASSEMBLE!', top: '#FFF3B8', mid: '#F5C542', bot: '#D0242C', ink: '#2A0508' },
  assemble: { text: 'ASSEMBLE!', top: '#FFF3B8', mid: '#F5C542', bot: '#D0242C', ink: '#2A0508' },
  smash: { text: 'SMASH!', top: '#D9FFB0', mid: '#7CD650', bot: '#2E7A1E', ink: '#0C1A07' },
  bullseye: { text: 'BULLSEYE', top: '#F2E6FF', mid: '#B48AF0', bot: '#5B2E9A', ink: '#140A22' },
}

// ── the cameos ──────────────────────────────────────────────────────────────
const MASK = 'M50 4 C78 4 94 24 94 52 C94 80 76 104 50 106 C24 104 6 80 6 52 C6 24 22 4 50 4 Z'
// Deadpool: red mask, black eye patches, white slits.
export const deadpool: Art = { vb: [100, 110], svg: k => svg([100, 110], `
  <defs><clipPath id="m"><path d="${MASK}"/></clipPath></defs>
  <g clip-path="url(#m)"><rect width="100" height="110" fill="#8E1020"/><path d="${MASK}" transform="translate(-6 -5)" fill="#D21F2E"/>
    <path d="M22 26 C30 14 42 9 54 9" stroke="#FF6A6A" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M50 4 L50 106" stroke="#5A0812" stroke-width="${2 * k}"/></g>
  <path d="${MASK}" fill="none" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M8 40 C20 30 40 34 46 52 C44 70 26 74 14 66 C6 60 4 50 8 40 Z" fill="#14141A" stroke="${INK}" stroke-width="${3 * k}"/>
  <path d="M92 40 C80 30 60 34 54 52 C56 70 74 74 86 66 C94 60 96 50 92 40 Z" fill="#14141A" stroke="${INK}" stroke-width="${3 * k}"/>
  <path d="M16 50 C24 46 34 48 40 54 C32 58 22 58 16 50 Z" fill="#FFFFFF"/>
  <path d="M84 50 C76 46 66 48 60 54 C68 58 78 58 84 50 Z" fill="#FFFFFF"/>`) }
// Wolverine: the yellow cowl, black fins sweeping up from the eyes.
export const wolverine: Art = { vb: [110, 110], svg: k => svg([110, 110], `
  <path d="M55 20 C80 20 94 36 94 60 C94 84 78 104 55 106 C32 104 16 84 16 60 C16 36 30 20 55 20 Z" fill="#F2C11E" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M70 24 C84 30 92 44 92 62 C92 82 80 98 62 104 C78 86 82 50 70 24 Z" fill="#C9961A"/>
  <path d="M18 64 C20 40 8 16 4 2 C20 14 30 30 34 44 L46 58 C38 70 26 72 18 64 Z" fill="#16161C" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M92 64 C90 40 102 16 106 2 C90 14 80 30 76 44 L64 58 C72 70 84 72 92 64 Z" fill="#16161C" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M28 58 C34 54 40 55 44 60 C38 63 32 63 28 58 Z M82 58 C76 54 70 55 66 60 C72 63 78 63 82 58 Z" fill="#FFFFFF"/>
  <path d="M38 84 C46 90 64 90 72 84 L70 104 C62 108 48 108 40 104 Z" fill="#B98258" stroke="${INK}" stroke-width="${3 * k}"/>
  <path d="M44 92 L66 92" stroke="#5E3A24" stroke-width="3" stroke-linecap="round"/>`) }
// Ant-Man: a round steel helmet, red faceplate, two big lenses, the antenna.
export const antman: Art = { vb: [110, 104], svg: k => svg([110, 104], `
  <circle cx="55" cy="54" r="46" fill="#9AA4B8" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M30 18 C40 10 60 8 74 12" stroke="#E4EAF5" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M20 46 C24 30 86 30 90 46 L92 70 C86 92 24 92 18 70 Z" fill="#C8202C" stroke="${INK}" stroke-width="${4 * k}" stroke-linejoin="round"/>
  <path d="M60 36 C76 38 86 44 88 56 L88 72 C84 84 70 88 60 88 Z" fill="#8E1020"/>
  <circle cx="38" cy="56" r="11" fill="#2A1A40" stroke="${INK}" stroke-width="${3.5 * k}"/><circle cx="72" cy="56" r="11" fill="#2A1A40" stroke="${INK}" stroke-width="${3.5 * k}"/>
  <circle cx="35" cy="52" r="3.5" fill="#B48AF0"/><circle cx="69" cy="52" r="3.5" fill="#B48AF0"/>
  <path d="M40 80 L70 80" stroke="${INK}" stroke-width="${3 * k}" stroke-linecap="round"/>
  <path d="M96 34 L106 6" stroke="#717B90" stroke-width="${4 * k}" stroke-linecap="round"/><circle cx="106" cy="6" r="4" fill="#C8202C"/>`) }
// Scarlet Witch's crown.
export const witch: Art = { vb: [120, 60], svg: k => svg([120, 60], `
  <path d="M8 56 C30 44 46 30 52 6 L60 30 L68 6 C74 30 90 44 112 56 C90 52 74 50 60 50 C46 50 30 52 8 56 Z" fill="#C8123A" stroke="${INK}" stroke-width="${4 * k}" stroke-linejoin="round"/>
  <path d="M54 14 L60 34 L66 14" stroke="#FF5C7A" stroke-width="3" fill="none"/>`) }

// ── Guardians of the Galaxy ─────────────────────────────────────────────────
// Star-Lord: the red-eyed mask, Walkman headphones, the red-brown coat
export const starlord: Art = { vb: [110, 112], svg: k => svg([110, 112], `
  <path d="M4 112 C6 92 24 84 55 84 C86 84 104 92 106 112 Z" fill="#B5422E" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M22 88 L34 112 L46 86 Z M88 88 L76 112 L64 86 Z" fill="#D8603E" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M46 96 L55 112 L64 96 L55 90 Z" fill="#2A2A36" stroke="${INK}" stroke-width="${2.5 * k}" stroke-linejoin="round"/>
  <path d="M55 8 C78 8 90 26 88 50 C86 72 72 86 55 86 C38 86 24 72 22 50 C20 26 32 8 55 8 Z" fill="#8A92A6" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M68 12 C86 22 88 46 84 62 C80 76 70 84 58 86 C72 70 76 36 68 12 Z" fill="#5C6478"/>
  <path d="M30 22 C36 14 46 10 54 10" stroke="#B4BBCB" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M26 40 C26 30 40 28 55 28 C70 28 84 30 84 40 L82 56 C70 60 62 56 55 54 C48 56 40 60 28 56 Z" fill="#524C60" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M30 40 L50 46 L47 54 L31 51 Z M80 40 L60 46 L63 54 L79 51 Z" fill="#FF2A2A" stroke="${INK}" stroke-width="${2.5 * k}" stroke-linejoin="round"/>
  <path d="M36 44 L47 47 M74 44 L63 47" stroke="#FFC2B0" stroke-width="${2 * k}" stroke-linecap="round"/>
  <path d="M42 70 L68 70 M44 75 L66 75 M47 80 L63 80" stroke="${INK}" stroke-width="${2.5 * k}" stroke-linecap="round"/>
  <path d="M22 42 C20 14 38 2 55 2 C72 2 90 14 88 42" stroke="#FF8A1E" stroke-width="${5 * k}" fill="none" stroke-linecap="round"/>
  <rect x="6" y="36" width="20" height="30" rx="8" fill="#FF8A1E" stroke="${INK}" stroke-width="${4 * k}"/>
  <rect x="84" y="36" width="20" height="30" rx="8" fill="#FF8A1E" stroke="${INK}" stroke-width="${4 * k}"/>
  <rect x="10" y="42" width="6" height="18" rx="3" fill="#FFC47A"/><rect x="94" y="42" width="6" height="18" rx="3" fill="#FFC47A"/>`) }

// Gamora: green skin, dark hair with a red tint, the assassin's collar
export const gamora: Art = { vb: [100, 112], svg: k => svg([100, 112], `
  <path d="M2 112 C4 90 22 82 50 82 C78 82 96 90 98 112 Z" fill="#554450" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M26 86 L50 112 L74 86 L64 82 L50 96 L36 82 Z" fill="#5A1A24" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M14 56 C6 24 26 2 50 2 C74 2 94 24 86 56 L90 100 L72 92 L72 60 L28 60 L28 92 L10 100 Z" fill="#5A2A3A" stroke="${INK}" stroke-width="${5 * k}" stroke-linejoin="round"/>
  <path d="M20 40 C26 16 44 8 56 8" stroke="#8A2236" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M78 36 L84 80 M16 50 L14 86" stroke="#6A1A2C" stroke-width="${3 * k}" stroke-linecap="round"/>
  <path d="M50 18 C70 18 78 34 76 54 C74 72 62 84 50 84 C38 84 26 72 24 54 C22 34 30 18 50 18 Z" fill="#82D95C" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M62 24 C76 32 78 50 74 62 C70 76 60 82 52 84 C64 68 68 44 62 24 Z" fill="#3F9027"/>
  <path d="M28 34 C34 24 50 26 60 28 C70 30 74 34 76 40 C60 32 44 32 28 40 Z" fill="#5A2A3A"/>
  <path d="M30 56 C34 50 42 50 46 56 C42 60 34 60 30 56 Z M70 56 C66 50 58 50 54 56 C58 60 66 60 70 56 Z" fill="#F4F0E4" stroke="${INK}" stroke-width="${2.5 * k}"/>
  <circle cx="38" cy="56" r="3.5" fill="#1A1218"/><circle cx="62" cy="56" r="3.5" fill="#1A1218"/>
  <path d="M28 48 C34 44 42 44 46 48 M72 48 C66 44 58 44 54 48" stroke="${INK}" stroke-width="${3 * k}" fill="none" stroke-linecap="round"/>
  <path d="M50 58 L48 68 L52 68" stroke="#3F9027" stroke-width="${2 * k}" fill="none" stroke-linecap="round"/>
  <path d="M42 74 C46 77 54 77 58 74" stroke="#A8283C" stroke-width="${3.5 * k}" fill="none" stroke-linecap="round"/>
  <path d="M92 108 L98 66" stroke="#B6BDCC" stroke-width="${4 * k}" stroke-linecap="round"/><path d="M88 106 L96 110" stroke="${INK}" stroke-width="${4 * k}" stroke-linecap="round"/>`) }

// Drax: grey-green skin, red scarification, shirtless, the knife harness
export const drax: Art = { vb: [110, 112], svg: k => svg([110, 112], `
  <path d="M0 112 C2 90 20 80 55 80 C90 80 108 90 110 112 Z" fill="#7C9A82" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M70 82 C94 84 106 94 110 112 L90 112 C90 98 82 88 70 82 Z" fill="#587A64"/>
  <path d="M16 90 C26 94 30 100 30 108 M94 90 C84 94 80 100 80 108 M48 90 C52 96 52 102 50 108 M62 90 C58 96 58 102 60 108" stroke="#C0242C" stroke-width="${3 * k}" fill="none" stroke-linecap="round"/>
  <path d="M10 86 L84 112 L98 112 L22 84 Z" fill="#6B4A2C" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M100 86 L26 112 L12 112 L88 84 Z" fill="#8B5A2E" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <circle cx="55" cy="98" r="5" fill="#C9861E" stroke="${INK}" stroke-width="${2.5 * k}"/>
  <path d="M55 6 C80 6 94 26 92 50 C90 72 76 84 55 84 C34 84 20 72 18 50 C16 26 30 6 55 6 Z" fill="#7C9A82" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M72 10 C90 22 92 46 88 62 C84 76 72 82 60 84 C74 68 80 34 72 10 Z" fill="#587A64"/>
  <path d="M28 22 C34 14 44 10 54 10" stroke="#A9C4AE" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M36 14 L36 32 M46 10 L46 28 M64 10 L64 28 M74 14 L74 32 M30 44 L22 40 M80 44 L88 40 M28 60 L22 66 M82 60 L88 66" stroke="#C0242C" stroke-width="${3 * k}" stroke-linecap="round"/>
  <path d="M24 44 C34 38 46 42 50 48 M86 44 C76 38 64 42 60 48" stroke="${INK}" stroke-width="${5 * k}" fill="none" stroke-linecap="round"/>
  <circle cx="38" cy="52" r="4" fill="#F0D03A" stroke="${INK}" stroke-width="${2 * k}"/><circle cx="72" cy="52" r="4" fill="#F0D03A" stroke="${INK}" stroke-width="${2 * k}"/>
  <circle cx="38" cy="52" r="1.6" fill="${INK}"/><circle cx="72" cy="52" r="1.6" fill="${INK}"/>
  <path d="M55 52 L52 66 L58 66" stroke="#587A64" stroke-width="${2.5 * k}" fill="none" stroke-linecap="round"/>
  <path d="M40 74 L70 74" stroke="${INK}" stroke-width="${3.5 * k}" stroke-linecap="round"/>`) }

// Rocket: a big-headed raccoon, orange flight suit, the gun held across
export const rocket: Art = { vb: [120, 110], svg: k => svg([120, 110], `
  <path d="M10 110 C12 88 30 80 56 80 C82 80 100 88 102 110 Z" fill="#FF8A2A" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M68 82 C90 86 100 94 102 110 L84 110 C84 98 78 88 68 82 Z" fill="#D8601A"/>
  <path d="M26 86 L56 108 L86 86" stroke="#FFD08A" stroke-width="${4 * k}" fill="none" stroke-linejoin="round"/>
  <path d="M10 44 L6 2 L36 20 C46 16 66 16 76 20 L106 2 L102 44 C106 72 86 88 56 88 C26 88 6 72 10 44 Z" fill="#C9BFB0" stroke="${INK}" stroke-width="${5 * k}" stroke-linejoin="round"/>
  <path d="M12 8 L14 28 L28 20 Z M100 8 L98 28 L84 20 Z" fill="#F29AA0" stroke="${INK}" stroke-width="${2 * k}" stroke-linejoin="round"/>
  <path d="M76 22 L104 6 L100 44 C104 70 88 84 66 88 C80 68 82 42 76 22 Z" fill="#9A8E80"/>
  <path d="M56 18 C62 32 60 42 56 48 C52 42 50 32 56 18 Z" fill="#3A2E34"/>
  <path d="M10 50 C16 38 40 38 52 56 C44 70 20 70 10 50 Z M102 50 C96 38 72 38 60 56 C68 70 92 70 102 50 Z" fill="#3A2E34" stroke="${INK}" stroke-width="${2.5 * k}"/>
  <ellipse cx="33" cy="54" rx="9" ry="8" fill="#FFFFFF"/><ellipse cx="79" cy="54" rx="9" ry="8" fill="#FFFFFF"/>
  <circle cx="36" cy="55" r="4.5" fill="${INK}"/><circle cx="76" cy="55" r="4.5" fill="${INK}"/><circle cx="37.5" cy="53" r="1.6" fill="#FFFFFF"/><circle cx="77.5" cy="53" r="1.6" fill="#FFFFFF"/>
  <path d="M30 66 C30 84 82 84 82 66 C76 58 64 62 56 62 C48 62 36 58 30 66 Z" fill="#FFF8EC" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M47 63 C47 58 65 58 65 63 C65 68 47 68 47 63 Z" fill="${INK}"/>
  <path d="M46 75 C52 80 60 80 66 75" stroke="${INK}" stroke-width="${2.5 * k}" fill="none" stroke-linecap="round"/>
  <path d="M4 104 L112 70" stroke="${INK}" stroke-width="${22 * k}" stroke-linecap="round"/>
  <path d="M4 104 L112 70" stroke="#6A7290" stroke-width="16" stroke-linecap="round"/>
  <path d="M8 98 L110 66" stroke="#B4BDD8" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M30 98 L40 94" stroke="#FF8A2A" stroke-width="6" stroke-linecap="round"/>
  <circle cx="68" cy="88" r="8" fill="#C9BFB0" stroke="${INK}" stroke-width="${3 * k}"/>
  <circle cx="112" cy="70" r="7" fill="#6FD8FF" stroke="${INK}" stroke-width="${2.5 * k}"/><circle cx="110" cy="68" r="2.5" fill="#FFFFFF"/>`) }

// Rocket's face portrait for the stage: the whole box is raccoon
export const rocketFace: Art = { vb: [110, 100], svg: k => svg([110, 100], `
  <path d="M0 100 C4 90 24 86 55 86 C86 86 106 90 110 100 Z" fill="#FF8A2A" stroke="${INK}" stroke-width="${4 * k}"/>
  <path d="M30 88 L55 100 L80 88" stroke="#FFD08A" stroke-width="${3 * k}" fill="none"/>
  <path d="M4 56 L2 -4 L38 20 C46 17 64 17 72 20 L108 -4 L106 56 C108 78 86 92 55 92 C24 92 2 78 4 56 Z" fill="#B8A894" stroke="${INK}" stroke-width="${5 * k}" stroke-linejoin="round"/>
  <path d="M8 4 L10 30 L28 22 Z M102 4 L100 30 L82 22 Z" fill="#F29AA0"/>
  <path d="M74 22 L106 -2 L104 56 C106 76 90 88 66 92 C82 72 84 44 74 22 Z" fill="#8A7A68"/>
  <path d="M55 16 C62 30 60 42 55 50 C50 42 48 30 55 16 Z" fill="#3A2E34"/>
  <path d="M6 52 C12 38 42 38 54 58 C44 74 14 74 6 52 Z M104 52 C98 38 68 38 56 58 C66 74 96 74 104 52 Z" fill="#3A2E34" stroke="${INK}" stroke-width="${2.5 * k}"/>
  <ellipse cx="30" cy="56" rx="12" ry="10" fill="#FFFFFF"/><ellipse cx="80" cy="56" rx="12" ry="10" fill="#FFFFFF"/>
  <circle cx="33" cy="57" r="6" fill="${INK}"/><circle cx="77" cy="57" r="6" fill="${INK}"/><circle cx="35" cy="54" r="2.2" fill="#FFFFFF"/><circle cx="79" cy="54" r="2.2" fill="#FFFFFF"/>
  <path d="M26 70 C26 94 84 94 84 70 C76 62 64 66 55 66 C46 66 34 62 26 70 Z" fill="#FFF8EC" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M43 67 C43 60 67 60 67 67 C67 74 43 74 43 67 Z" fill="${INK}"/><circle cx="50" cy="65" r="2" fill="#8A91A6"/>
  <path d="M42 80 C50 86 60 86 68 80" stroke="${INK}" stroke-width="${3 * k}" fill="none" stroke-linecap="round"/>`) }

// Groot: bark-brown, leaves on top, black eyes
export const groot: Art = { vb: [100, 112], svg: k => svg([100, 112], `
  <path d="M4 112 C6 92 22 84 50 84 C78 84 94 92 96 112 Z" fill="#946236" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M20 90 C26 98 26 106 22 112 M78 90 C72 98 72 106 78 112 M50 90 L50 112" stroke="#4E3018" stroke-width="${3 * k}" fill="none" stroke-linecap="round"/>
  <path d="M8 98 C-2 90 -2 80 6 72 M92 98 C102 90 102 80 94 72" stroke="#946236" stroke-width="${7 * k}" fill="none" stroke-linecap="round"/>
  <path d="M50 14 C72 14 84 30 82 52 C80 74 68 86 50 86 C32 86 20 74 18 52 C16 30 28 14 50 14 Z" fill="#B5804A" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M62 18 C80 28 82 50 78 64 C74 78 64 84 54 86 C68 70 70 40 62 18 Z" fill="#6A4424"/>
  <path d="M26 30 C32 22 42 18 50 18" stroke="#C8925A" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M30 34 L36 44 L30 52 M70 30 L64 40 L70 48 M44 22 L48 32 M26 66 L36 70 M74 66 L64 72" stroke="#4E3018" stroke-width="${2.5 * k}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <ellipse cx="36" cy="54" rx="6" ry="8" fill="${INK}"/><ellipse cx="64" cy="54" rx="6" ry="8" fill="${INK}"/>
  <circle cx="34" cy="51" r="2.4" fill="#FFFFFF"/><circle cx="62" cy="51" r="2.4" fill="#FFFFFF"/>
  <path d="M42 72 C46 76 54 76 58 72" stroke="${INK}" stroke-width="${3 * k}" fill="none" stroke-linecap="round"/>
  <path d="M34 18 C20 14 16 4 20 -2 C32 0 38 8 40 18 Z" fill="#62C23C" stroke="${INK}" stroke-width="${2.5 * k}" stroke-linejoin="round"/>
  <path d="M56 16 C60 4 72 -2 82 2 C80 14 70 20 60 20 Z" fill="#3F9027" stroke="${INK}" stroke-width="${2.5 * k}" stroke-linejoin="round"/>
  <path d="M46 16 C40 6 44 0 50 -4 C56 0 58 8 54 16 Z" fill="#A8EC70" stroke="${INK}" stroke-width="${2.5 * k}" stroke-linejoin="round"/>
  <path d="M6 76 C-2 72 -2 66 4 62 C10 64 12 70 10 76 Z M94 76 C102 72 102 66 96 62 C90 64 88 70 90 76 Z" fill="#62C23C" stroke="${INK}" stroke-width="${2 * k}"/>`) }

// Mantis: the antennae, black eyes, the green dress
export const mantis: Art = { vb: [100, 116], svg: k => svg([100, 116], `
  <path d="M6 116 C8 94 24 86 50 86 C76 86 92 94 94 116 Z" fill="#3FA85A" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M60 88 C82 92 92 100 94 116 L74 116 C74 104 68 94 60 88 Z" fill="#26783C"/>
  <path d="M28 90 C36 100 42 104 50 104 C58 104 64 100 72 90 L66 88 C62 94 56 96 50 96 C44 96 38 94 34 88 Z" fill="#8EE0A0" stroke="${INK}" stroke-width="${2.5 * k}" stroke-linejoin="round"/>
  <path d="M16 62 C8 30 26 12 50 12 C74 12 92 30 84 62 L88 94 L72 86 L72 62 L28 62 L28 86 L12 94 Z" fill="#4A3828" stroke="${INK}" stroke-width="${5 * k}" stroke-linejoin="round"/>
  <path d="M24 34 C30 24 42 18 54 18" stroke="#5A4630" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M50 22 C70 22 78 38 76 56 C74 74 62 86 50 86 C38 86 26 74 24 56 C22 38 30 22 50 22 Z" fill="#EAD8BC" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M62 28 C76 36 78 54 74 66 C70 78 60 84 52 86 C64 70 68 46 62 28 Z" fill="#C9AE8A"/>
  <path d="M28 38 C34 30 66 30 72 38 C64 36 36 36 28 38 Z" fill="#4A3828"/>
  <ellipse cx="38" cy="58" rx="9" ry="12" fill="${INK}" transform="rotate(14 38 58)"/><ellipse cx="62" cy="58" rx="9" ry="12" fill="${INK}" transform="rotate(-14 62 58)"/>
  <circle cx="35" cy="53" r="2.8" fill="#FFFFFF"/><circle cx="59" cy="53" r="2.8" fill="#FFFFFF"/>
  <path d="M43 76 C47 79 53 79 57 76" stroke="#B0504E" stroke-width="${3 * k}" fill="none" stroke-linecap="round"/>
  <path d="M40 22 C34 10 28 6 24 2 M60 22 C66 10 72 6 76 2" stroke="${INK}" stroke-width="${5 * k}" fill="none" stroke-linecap="round"/>
  <path d="M40 22 C34 10 28 6 24 2 M60 22 C66 10 72 6 76 2" stroke="#6FE08A" stroke-width="${2 * k}" fill="none" stroke-linecap="round"/>
  <circle cx="23" cy="4" r="5.5" fill="#B6FFC4" stroke="${INK}" stroke-width="${2.5 * k}"/><circle cx="77" cy="4" r="5.5" fill="#B6FFC4" stroke="${INK}" stroke-width="${2.5 * k}"/>`) }

// Nebula: blue cyborg, the bald metal plate, a red eye
export const nebula: Art = { vb: [100, 112], svg: k => svg([100, 112], `
  <path d="M2 112 C4 90 22 82 50 82 C78 82 96 90 98 112 Z" fill="#505068" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M10 94 L30 88 M90 94 L70 88" stroke="#8A91A6" stroke-width="${4 * k}" stroke-linecap="round"/>
  <path d="M26 86 L50 112 L74 86 L64 82 L50 96 L36 82 Z" fill="#A3ADC0" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M50 6 C76 6 90 26 88 50 C86 72 70 86 50 86 C30 86 14 72 12 50 C10 26 24 6 50 6 Z" fill="#3C7BE0" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M66 10 C86 22 88 46 84 62 C80 76 68 84 54 86 C70 68 76 34 66 10 Z" fill="#2554A8"/>
  <path d="M14 46 C12 24 26 8 46 6 L50 40 L40 62 C32 74 24 72 16 62 Z" fill="#B8C0D2" stroke="${INK}" stroke-width="${4 * k}" stroke-linejoin="round"/>
  <path d="M22 18 C28 12 36 9 42 8" stroke="#F0F4FC" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M20 30 L40 28 M18 42 L36 44 M24 54 L38 54" stroke="#717B90" stroke-width="${2.5 * k}" stroke-linecap="round"/>
  <circle cx="28" cy="38" r="2" fill="#434A5A"/><circle cx="26" cy="52" r="2" fill="#434A5A"/>
  <path d="M30 56 C34 50 42 50 46 56 C42 62 34 62 30 56 Z" fill="#FF3A3A" stroke="${INK}" stroke-width="${2.5 * k}"/><circle cx="38" cy="56" r="2" fill="#FFD0C0"/>
  <path d="M54 56 C58 50 68 50 72 56 C68 62 58 62 54 56 Z" fill="#F4F0E4" stroke="${INK}" stroke-width="${2.5 * k}"/><circle cx="63" cy="56" r="3.2" fill="${INK}"/>
  <path d="M52 46 C58 42 68 42 74 46" stroke="${INK}" stroke-width="${3 * k}" fill="none" stroke-linecap="round"/>
  <path d="M60 40 L66 30 M70 44 L78 36 M64 70 L72 66" stroke="#1E4890" stroke-width="${2 * k}" stroke-linecap="round"/>
  <path d="M50 58 L48 68 L53 68" stroke="#2554A8" stroke-width="${2 * k}" fill="none" stroke-linecap="round"/>
  <path d="M42 74 C46 72 56 72 60 76" stroke="${INK}" stroke-width="${3 * k}" fill="none" stroke-linecap="round"/>`) }

// Yondu: blue skin, red eyes, the red fin crest, the brown coat, the yaka arrow
export const yondu: Art = { vb: [116, 116], svg: k => svg([116, 116], `
  <path d="M2 116 C4 94 22 86 52 86 C82 86 100 94 102 116 Z" fill="#8A5630" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M72 88 C92 92 100 100 102 116 L82 116 C82 104 78 94 72 88 Z" fill="#5E3A1C"/>
  <path d="M18 90 L32 116 L46 88 Z M86 90 L72 116 L58 88 Z" fill="#B07442" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M46 96 L52 116 L58 96 Z" fill="#F4B53C" stroke="${INK}" stroke-width="${2 * k}" stroke-linejoin="round"/>
  <path d="M44 38 C38 24 36 8 46 -4 L52 10 L58 -6 L64 10 L70 -2 C74 14 70 30 62 40 Z" fill="#F0383F" stroke="${INK}" stroke-width="${3.5 * k}" stroke-linejoin="round"/>
  <path d="M50 12 L52 34 M58 8 L58 34 M66 10 L64 34" stroke="#FF8A7A" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M52 22 C76 22 86 40 84 58 C82 74 74 84 66 90 L52 94 L38 90 C30 84 22 74 20 58 C18 40 28 22 52 22 Z" fill="#3A7BD5" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M66 28 C82 38 84 56 80 68 C76 80 70 86 62 90 C72 72 74 46 66 28 Z" fill="#2E62C0"/>
  <path d="M26 38 C32 30 42 26 52 26" stroke="#A8CCFF" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M26 50 L46 54 L44 62 L28 58 Z M78 50 L58 54 L60 62 L76 58 Z" fill="#FF2A2A" stroke="${INK}" stroke-width="${2.5 * k}" stroke-linejoin="round"/>
  <path d="M24 44 L48 50 M80 44 L56 50" stroke="${INK}" stroke-width="${4 * k}" stroke-linecap="round"/>
  <path d="M52 56 L48 70 L56 70" stroke="#2E62C0" stroke-width="${2.5 * k}" fill="none" stroke-linecap="round"/>
  <path d="M34 80 C40 90 64 90 70 80 L66 70 C60 74 44 74 38 70 Z" fill="#3A2412" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M42 74 C48 76 56 76 62 74" stroke="#F0E8C8" stroke-width="${2 * k}" fill="none" stroke-linecap="round"/>
  <path d="M104 112 L110 48" stroke="#B6BDCC" stroke-width="${3 * k}" stroke-linecap="round"/>
  <path d="M110 48 L104 36 L110 26 L116 36 Z" fill="#FF2A2A" stroke="${INK}" stroke-width="${2.5 * k}" stroke-linejoin="round"/>`) }

// Yondu's face portrait for the stage: vivid blue skin fills the box
export const yonduFace: Art = { vb: [110, 100], svg: k => svg([110, 100], `
  <path d="M0 100 C4 90 24 86 55 86 C86 86 106 90 110 100 Z" fill="#8A5630" stroke="${INK}" stroke-width="${4 * k}"/>
  <path d="M26 88 L55 100 L84 88" stroke="#B07442" stroke-width="${5 * k}" fill="none"/>
  <path d="M46 2 C48 -4 62 -4 64 2 L68 34 L42 34 Z" fill="#C42030" stroke="${INK}" stroke-width="${3.5 * k}" stroke-linejoin="round"/>
  <path d="M52 4 L51 30 M58 4 L59 30" stroke="#FF6A5A" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M55 8 C86 8 104 30 102 56 C100 76 86 90 55 94 C24 90 10 76 8 56 C6 30 24 8 55 8 Z" fill="#3A7BD5" stroke="${INK}" stroke-width="${5 * k}"/>
  <path d="M74 14 C98 26 102 50 98 64 C94 80 82 90 62 94 C84 74 88 40 74 14 Z" fill="#2458A8"/>
  <path d="M20 34 C28 20 44 14 56 14" stroke="#8FC0FF" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M14 50 L46 56 L44 68 L18 62 Z M96 50 L64 56 L66 68 L92 62 Z" fill="#FF2A2A" stroke="${INK}" stroke-width="${2.5 * k}" stroke-linejoin="round"/>
  <circle cx="32" cy="60" r="3" fill="#FFC8B0"/><circle cx="78" cy="60" r="3" fill="#FFC8B0"/>
  <path d="M12 46 L48 52 M98 46 L62 52" stroke="${INK}" stroke-width="${4.5 * k}" stroke-linecap="round"/>
  <path d="M55 58 L50 76 L60 76" stroke="#2458A8" stroke-width="${3 * k}" fill="none" stroke-linecap="round"/>
  <path d="M36 82 C42 94 68 94 74 82 L70 76 C62 80 48 80 40 76 Z" fill="#2A180C" stroke="${INK}" stroke-width="${3 * k}" stroke-linejoin="round"/>
  <path d="M44 78 C50 80 60 80 66 78" stroke="#F0E8C8" stroke-width="${2 * k}" fill="none" stroke-linecap="round"/>`) }
