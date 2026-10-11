// clarvis: hand-drawn pixel art for the stage and the lane.
// Each hero's art is drawn at the band's own grid: subpixels (2 across, 2 down per
// cell), each about 2.4x taller than wide, so a portrait is authored stretched
// across. `pixmap` turns rows of palette letters into a sprite once, at load; a
// hero's StageArt animates it (frames, blinks, glows) with no per-frame allocation.
// The artists' files register here; scenes.ts asks for a hero's art before its own.
import * as A1 from './pix/avengers1'
import * as A2 from './pix/avengers2'
import * as A3 from './pix/avengers3'
import * as A4 from './pix/avengers4'
import * as G from './pix/guardians'

import type { LaneArt, StageArt } from './pix/pixmap'
export { pixmap, type LaneArt, type StageArt } from './pix/pixmap'

export const STAGE_ART: Partial<Record<string, StageArt>> = { ...A1.STAGES, ...A2.STAGES, ...A3.STAGES, ...A4.STAGES, ...G.STAGES }
export const LANE_ART: Partial<Record<string, LaneArt>> = { ...A1.LANES, ...A2.LANES, ...A3.LANES, ...A4.LANES, ...G.LANES }
