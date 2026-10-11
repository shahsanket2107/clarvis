// clarvis AVENGERS THEATER: the library, in issue order.
import type { Movie } from './saga-types'
import { MOVIE_01 } from './movie-01-assemble'
import { MOVIE_02 } from './movie-02-ultron'
import { MOVIE_03 } from './movie-03-civilwar'
import { MOVIE_04 } from './movie-04-ragnarok'
import { MOVIE_05 } from './movie-05-awesomemix'
import { MOVIE_06 } from './movie-06-wakanda'
import { MOVIE_07 } from './movie-07-infinitywar'
import { MOVIE_08 } from './movie-08-endgame'
import { MOVIE_09 } from './movie-09-multiverse'
import { MOVIE_10 } from './movie-10-whatif'

export const MOVIES: readonly Movie[] = [MOVIE_01, MOVIE_02, MOVIE_03, MOVIE_04, MOVIE_05, MOVIE_06, MOVIE_07, MOVIE_08, MOVIE_09, MOVIE_10]
// A movie by number (1–10), id or title words; undefined when nothing matches.
export function findMovie(q: string): Movie | undefined {
  const s = q.trim().toLowerCase()
  if (!s) return undefined
  const n = Number(s)
  if (Number.isInteger(n)) return MOVIES.find(m => m.n === (n === 0 ? 10 : n)) // key 0 is #10, as in the theater
  const flat = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!flat(s)) return undefined // punctuation alone matches every title
  return MOVIES.find(m => m.id === s || flat(m.title) === flat(s)) ?? MOVIES.find(m => flat(m.title).includes(flat(s)) || flat(m.id).includes(flat(s)))
}
