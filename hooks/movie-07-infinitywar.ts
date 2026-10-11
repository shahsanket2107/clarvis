// AVENGERS THEATER #7: INFINITY WAR. Pure data: see saga-types.ts.
import type { Movie } from './saga-types'

export const MOVIE_07: Movie = {
  id: 'infinitywar', n: 7, title: 'INFINITY WAR', color: '#6B2FA0', hero: 'THANOS',
  blurb: 'The Mad Titan comes for the stones. Nobody is ready.',
  scenes: [
    {
      cap: 'NEW YORK. A QUIET AFTERNOON.', bg: 'city', beats: [
        { k: 'est', l: 'STRANGE', r: 'WONG', cap: 'NEW YORK. A QUIET AFTERNOON.', ext: [] },
        { k: 'talk', d: 3.5, lines: [
          ['l', "Wong, the Time Stone's been humming all morning."],
          ['r', ["Then close the tab. Nothing good ever hums.", "It hums when something big's on the way."]],
        ] },
        { k: 'enter', l: 'STRANGE', r: 'MAW', sfx: 'KRAKA-BOOM!', cap: 'EBONY MAW. UNINVITED.', ext: ['WONG'] },
        { k: 'talk', d: 3.5, lines: [
          ['r', '!Surrender the Time Stone and your world may be spared!'],
          ['l', ["I've got a counter-offer. It involves a very large portal.", "Hard pass. I just finished dusting."]],
        ] },
        { k: 'special', by: 'l', fx: 'portal', sfx: 'WHOOSH!' },
        { k: 'special', by: 'r', fx: 'blast', sfx: 'SKREEEE!' },
        { k: 'enter', l: 'IRONMAN', r: 'MAW', cap: 'TONY STARK, FASHIONABLY LATE.', ext: ['STRANGE', 'WONG'], brawl: true },
        { k: 'talk', d: 3.5, lines: [
          ['l', "Strange, quick question. Is the squid your fault?"],
          ['r', "Stark. Not the time for your comedy routine."],
          ['l', ["Everything's a comedy routine. Hold my repulsor.", "Meet my nano-suit. Nano-suit, don't embarrass me."]],
        ] },
        { k: 'special', by: 'l', fx: 'repulsor', sfx: 'ZZZAP!' },
        { k: 'enter', l: 'SPIDEY', r: 'MAW', cap: 'THE SCHOOL BUS ARRIVES. SO DOES SPIDEY.', ext: ['IRONMAN', 'STRANGE', 'WONG'], brawl: true },
        { k: 'talk', d: 3.5, lines: [
          ['l', ["Hi! Mr. Stark! I snuck on the bus. Don't be mad!", "Mr. Stark! I'm on the field trip. Sort of. Kind of."]],
          ['r', '!Boy, return to your parents!'],
          ['l', "He's gonna be like that, huh. Okay. THWIP!"],
        ] },
        { k: 'special', by: 'l', fx: 'web', sfx: 'THWIP!' },
        { k: 'say', d: 3.5, by: 'WONG', say: "The Sanctum's seen better afternoons. Defend the Stone." },
        { k: 'exit', sfx: 'WHOOSH!' },
      ],
    },
    {
      cap: 'SPACE. A WRECKED SHIP DRIFTS.', bg: 'space', beats: [
        { k: 'est', l: 'THOR', cap: 'SPACE. A WRECKED SHIP DRIFTS.' },
        { k: 'say', d: 3.5, by: 'l', say: "~Anyone had it worse? I lost a hammer and an eye." },
        { k: 'arrive', who: ['STARLORD', 'GAMORA', 'ROCKET', 'DRAX', 'GROOT'], fx: 'teleport', cap: 'THE GUARDIANS OF THE GALAXY', ext: ['GAMORA', 'ROCKET', 'DRAX', 'GROOT', 'MANTIS'] },
        { k: 'talk', d: 3.5, l: 'STARLORD', r: 'THOR', ext: ['GAMORA', 'ROCKET', 'DRAX', 'GROOT', 'MANTIS'], lines: [
          ['l', ["!Hey! Pal! You alive over there?", "Is that a floating guy in pajamas? Check the manifest."]],
          ['r', "Thor, son of Odin. I need a ship. And a large axe."],
          ['l', ["I'm Star-Lord. Legendary Outlaw. Maybe you've heard?", "Star-Lord, Legendary Outlaw. My crew. Don't touch the plant."]],
        ] },
        { k: 'talk', d: 3.5, l: 'GAMORA', r: 'ROCKET', ext: ['STARLORD', 'THOR', 'DRAX', 'GROOT', 'MANTIS'], lines: [
          ['l', "He's taller than I expected. And no shirt."],
          ['STARLORD', '!Why is Gamora?'],
          ['r', ["Don't look at me. I just fly the ship and build the bombs.", "She's Gamora because she's Gamora, Quill. Move."]],
        ] },
        { k: 'talk', d: 3.5, l: 'DRAX', r: 'GROOT', ext: ['STARLORD', 'THOR', 'GAMORA', 'ROCKET', 'MANTIS'], lines: [
          ['l', "I am Drax the Destroyer. I don't understand your hammer."],
          ['r', 'I am Groot.'],
          ['l', "I agree. He is a large man. I am larger on the inside."],
        ] },
        { k: 'exit' },
      ],
    },
    {
      cap: 'TITAN. WHAT IS LEFT OF IT.', bg: 'titan', beats: [
        { k: 'est', l: 'IRONMAN', r: 'STARLORD', cap: 'TITAN. WHAT IS LEFT OF IT.', ext: ['STRANGE', 'SPIDEY', 'DRAX', 'MANTIS', 'GAMORA'] },
        { k: 'talk', d: 3.5, lines: [
          ['l', "Nice jacket, kid. Pleather? Won it at a fair?"],
          ['r', ["!Back off. I'm the leader here. Listen to this voice.", "It's real leather! And I have a GREAT voice. Watch."]],
          ['l', "Oh no. He's doing the voice. Strange, he's doing the voice."],
          ['r', ["The voice is my brand! You're literally wearing a toaster!", "I'll do the voice if I want. The eighties are on my side."]],
        ] },
        { k: 'talk', d: 3.5, l: 'MANTIS', r: 'DRAX', ext: ['STARLORD', 'IRONMAN', 'STRANGE', 'SPIDEY', 'GAMORA'], lines: [
          ['l', "I sense you're all very scared. And a little hungry."],
          ['r', "I am not scared. I am a wall. A fast wall."],
        ] },
        { k: 'say', d: 3.5, by: 'STRANGE', ext: ['IRONMAN', 'STARLORD', 'SPIDEY', 'DRAX', 'MANTIS'], say: "I've seen 14,000,605 futures. This argument's in none of the good ones." },
        { k: 'say', d: 3.5, by: 'SPIDEY', say: "Mr. Stark, tests still pass, right? Build's green? Okay. Sorry." },
        { k: 'enter', l: 'THANOS', r: 'IRONMAN', sfx: 'THOOM!', cap: 'THANOS. HE HAS ARRIVED.', ext: ['STRANGE', 'SPIDEY', 'STARLORD', 'DRAX', 'MANTIS', 'GAMORA'] },
        { k: 'talk', d: 3.5, lines: [
          ['l', 'I am inevitable.'],
          ['r', ["!We've got a plan, a wizard, and a spider. You're not inevitable. You're on time.", "!Hey, big guy. We've got a plan and a wizard. You're going down."]],
        ] },
        { k: 'special', by: 'r', fx: 'repulsor', sfx: 'ZZZAP!' },
        { k: 'special', by: 'l', fx: 'gauntlet', sfx: 'KRAKOW!' },
        { k: 'clash', fx: 'gauntlet', sfx: 'KRAKA-THOOM!' },
        { k: 'exit' },
      ],
    },
    {
      cap: 'TITAN. THE BIG FIGHT.', bg: 'titan', beats: [
        { k: 'est', l: 'MANTIS', r: 'THANOS', cap: 'TITAN. THE BIG FIGHT.', ext: ['STRANGE', 'SPIDEY', 'IRONMAN', 'DRAX', 'STARLORD', 'NEBULA'] },
        { k: 'teamup', move: 'formation', who: ['IRONMAN', 'STRANGE', 'SPIDEY', 'DRAX', 'STARLORD', 'NEBULA'], rw: ['THANOS'], cap: 'EVERYONE AT ONCE', sfx: 'KA-BOOM!' },
        { k: 'say', d: 3.5, by: 'l', say: ['!Sleep!', '!Be sleepy! Be sleepy!'] },
        { k: 'special', by: 'l', fx: 'sleep', sfx: 'ZZZZZ...' },
        { k: 'talk', d: 3.5, lines: [
          ['l', "He's... tired. We're winning! I think."],
          ['r', "The touch of a child, empath. A breeze on my shoulder."],
        ] },
        { k: 'special', l: 'STRANGE', r: 'THANOS', by: 'l', fx: 'portal', sfx: 'ZWOOP!' },
        { k: 'special', l: 'SPIDEY', r: 'THANOS', by: 'l', fx: 'web', sfx: 'THWIP!' },
        { k: 'trade', n: 3 },
        { k: 'talk', d: 3.5, l: 'STARLORD', r: 'THANOS', ext: ['IRONMAN', 'DRAX', 'NEBULA', 'MANTIS', 'SPIDEY', 'STRANGE'], lines: [
          ['l', ["!Pull! PULL! I said pull!", "!Take the gauntlet! He's not getting it!"]],
          ['IRONMAN', "Nice moves, kid. Almost there. Keep pulling."],
          ['DRAX', "I am pulling! I am a puller!"],
          ['NEBULA', "You're all idiots. Keep pulling."],
        ] },
        { k: 'talk', d: 3.5, l: 'GAMORA', r: 'STARLORD', ext: ['THANOS', 'DRAX', 'MANTIS', 'NEBULA', 'IRONMAN'], lines: [
          ['STARLORD', "It's over. We've got the gauntlet. We win."],
          ['l', "It was never about winning, Peter. I knew you were in there."],
          ['r', '!NO! NO! NO! Gamora!'],
        ] },
        { k: 'special', l: 'THANOS', r: 'STARLORD', by: 'l', fx: 'gauntlet', sfx: 'KRAKA-THOOM!', ext: ['DRAX', 'MANTIS', 'NEBULA', 'IRONMAN', 'SPIDEY'] },
        { k: 'ko', win: 'l', sfx: 'THOOM.' },
        { k: 'exit' },
      ],
    },
    {
      cap: 'THE LONG VIEW.', bg: 'mirror', beats: [
        { k: 'est', l: 'STRANGE', r: 'IRONMAN', cap: 'THE LONG VIEW.', ext: ['SPIDEY', 'NEBULA', 'DRAX', 'MANTIS'] },
        { k: 'talk', d: 3.5, lines: [
          ['r', 'How many futures did you look at, Merlin?'],
          ['l', 'Fourteen million, six hundred and five.'],
          ['r', ["And how many do we win?", "And how many of those does the CI go green?"]],
          ['l', ['One.', "Exactly one. And I'm afraid it's not on main."]],
        ] },
        { k: 'special', by: 'l', fx: 'portal', sfx: 'ZWOOOP!' },
        { k: 'talk', d: 3.5, lines: [
          ['l', ["I gave him the Stone, Tony. You'll understand later.", "I gave up the Stone to save you. Don't ask why."]],
          ['r', ["!You WHAT?! I'm retiring. Today. Right now.", "!You gave up the Stone?! Who approved this refactor?"]],
        ] },
        { k: 'exit' },
      ],
    },
    {
      cap: 'WAKANDA. THE BORDER.', bg: 'jungle', beats: [
        { k: 'est', l: 'PANTHER', r: 'CHITAURI', cap: 'WAKANDA. THE BORDER.', ext: ['OKOYE', 'DORA', 'MBAKU', 'SHURI'] },
        { k: 'arrive', who: ['CAP', 'WIDOW'], fx: 'shield', cap: 'CAP AND WIDOW. REUNITED.' },
        { k: 'arrive', who: ['BUCKY', 'FALCON', 'OKOYE'], fx: 'wings', cap: 'BUCKY, SAM AND OKOYE.' },
        { k: 'arrive', who: ['WANDA', 'VISION', 'HULK'], fx: 'hex', cap: 'WANDA, VISION AND BRUCE.' },
        { k: 'talk', d: 3.5, l: 'CAP', r: 'WIDOW', ext: ['BUCKY', 'FALCON', 'OKOYE', 'PANTHER', 'WANDA', 'VISION'], lines: [
          ['l', "Wakanda won't fall today. Not on my watch."],
          ['r', ["Nice beard, Steve. Very dangerous. Very hiker.", "Nice outfit, Cap. Is the shield new?"]],
        ] },
        { k: 'say', d: 3.5, by: 'HULK', ext: ['HULK', 'BUCKY', 'FALCON', 'OKOYE', 'CAP', 'WIDOW'], say: "Bruce: Big guy? Come on, buddy. We need you." },
        { k: 'say', d: 3.5, by: 'HULK', say: "!...No. Hulk is hiding. Hulk is... washing hands." },
        { k: 'crowd', who: ['PANTHER', 'OKOYE', 'CAP', 'WIDOW', 'BUCKY', 'FALCON', 'WANDA', 'VISION', 'HULK', 'WARMACHINE', 'ROCKET', 'GROOT'], rw: ['CHITAURI', 'DRONE', 'CHITAURI', 'DRONE'], cap: 'WAKANDA STANDS.' },
        { k: 'teamup', move: 'formation', who: ['WARMACHINE', 'ROCKET', 'FALCON', 'HULK', 'WIDOW', 'OKOYE'], rw: ['CHITAURI', 'DRONE', 'CHITAURI', 'DRONE', 'CHITAURI', 'DRONE'], cap: 'THE LINE FIRES', sfx: 'KA-BOOM!' },
        { k: 'charge', who: ['PANTHER', 'OKOYE', 'CAP', 'BUCKY', 'WANDA'], rw: ['CHITAURI', 'CHITAURI', 'DRONE'], cap: 'THE BATTLE OF WAKANDA.' },
        { k: 'battle', who: ['PANTHER', 'OKOYE', 'CAP', 'BUCKY', 'WIDOW', 'GROOT'], rw: ['CHITAURI', 'DRONE', 'CHITAURI', 'DRONE', 'CHITAURI', 'DRONE'], cap: 'THE BATTLE OF WAKANDA', d: 16 },
        { k: 'special', l: 'PANTHER', r: 'CHITAURI', by: 'l', fx: 'kinetic', sfx: 'KRAKOOM!', ext: ['CAP', 'OKOYE', 'BUCKY', 'ROCKET', 'GROOT'], brawl: false },
        { k: 'special', l: 'CAP', r: 'CHITAURI', by: 'l', fx: 'shield', sfx: 'CLANG!' },
        { k: 'special', l: 'ROCKET', r: 'DRONE', by: 'l', fx: 'gun', sfx: 'PEW-PEW!' },
        { k: 'special', l: 'GROOT', r: 'DRONE', by: 'l', fx: 'vines', sfx: 'THWACK!' },
        { k: 'talk', d: 3.5, l: 'VISION', r: 'WANDA', ext: ['CAP', 'WIDOW', 'OKOYE', 'CHITAURI', 'DRONE'], brawl: true, lines: [
          ['l', ["Wanda. You have to do it. Destroy the Stone.", "I'm sorry, Wanda. Please. Destroy it."]],
          ['r', "!I can't. I can't!"],
        ] },
        { k: 'special', l: 'WANDA', r: 'THANOS', by: 'l', fx: 'hex', sfx: 'ZZZWAP!' },
      ],
    },
    {
      cap: 'WAKANDA. THE THUNDER.', bg: 'falls', beats: [
        { k: 'est', l: 'THOR', r: 'THANOS', cap: 'WAKANDA. THE THUNDER.', ext: ['ROCKET', 'GROOT', 'CAP', 'PANTHER', 'OKOYE'], brawl: false },
        { k: 'arrive', who: ['THOR'], fx: 'bolt', cap: 'THOR. WITH A NEW AXE.' },
        { k: 'say', d: 3.5, by: 'ROCKET', say: "Okay, pal. It's called Stormbreaker. Please don't ask." },
        { k: 'say', d: 3.5, by: 'THOR', say: '!Bring me Thanos!' },
        { k: 'teamup', move: 'thorcap', who: ['THOR', 'CAP', 'ROCKET', 'GROOT'], rw: ['CHITAURI', 'DRONE', 'CHITAURI'], cap: 'THOR AND CAP, TOGETHER', sfx: 'KRA-KOOM!' },
        { k: 'charge', who: ['THOR', 'ROCKET', 'GROOT'], rw: ['THANOS'], cap: 'THOR VS THANOS.' },
        { k: 'super', l: 'THOR', r: 'THANOS', by: 'l', fx: 'hammer', sfx: 'KRAKA-THOOM!' },
        { k: 'talk', d: 3.5, lines: [
          ['r', ["Thor, son of Odin. You should've gone for the head.", "Asgardian. Close. You should've gone for the head."]],
          ['l', ["!...I'm going for the head.", '!Noted. Next time.']],
        ] },
        { k: 'special', by: 'r', fx: 'gauntlet', sfx: 'SNAP.' },
      ],
    },
    {
      cap: 'WAKANDA. A HOLE IN THE LINE.', bg: 'jungle', beats: [
        { k: 'est', l: 'BUCKY', r: 'PANTHER', cap: 'WAKANDA. A HOLE IN THE LINE.', ext: ['GROOT', 'FALCON', 'WANDA', 'OKOYE', 'ROCKET', 'CAP'] },
        { k: 'say', d: 3.5, by: 'l', say: "Steve? Steve, I don't feel so... Steve?" },
        { k: 'snap', by: 'THANOS', who: ['BUCKY', 'PANTHER', 'GROOT', 'FALCON', 'WANDA', 'OKOYE'], cap: 'DUST ON THE WIND. NO ONE IS HURT.' },
        { k: 'say', d: 3.5, by: 'GROOT', say: 'I... am... Groot.' },
        { k: 'say', d: 3.5, by: 'ROCKET', say: '!Groot? Groot, buddy? Where are you?' },
        { k: 'stand', l: 'CAP', r: 'WIDOW', say: 'Steve and Natasha stand in a field gone silent.', ext: ['ROCKET', 'HULK', 'WARMACHINE'] },
        { k: 'exit' },
      ],
    },
    {
      cap: 'TITAN. THE ENDING.', bg: 'titan', beats: [
        { k: 'est', l: 'SPIDEY', r: 'IRONMAN', cap: 'TITAN. THE ENDING.', ext: [] },
        { k: 'say', d: 3.5, by: 'l', say: ["Mr. Stark? I don't feel so good.", "Mr. Stark... I don't feel so good."] },
        { k: 'say', d: 3.5, by: 'r', say: ["You're fine. Hey. Look at me. You're fine.", '!Peter, stay with me. Okay? Stay right here.'] },
        { k: 'say', d: 3.5, by: 'l', ext: ['STRANGE', 'STARLORD', 'DRAX', 'MANTIS', 'GAMORA', 'NEBULA'], say: "~I don't want to go. Please, Mr. Stark." },
        { k: 'snap', by: 'THANOS', who: ['SPIDEY', 'STRANGE', 'STARLORD', 'DRAX', 'MANTIS', 'GAMORA'], cap: 'IN A BREATH, THEY DRIFT AWAY.' },
        { k: 'talk', d: 3.5, l: 'IRONMAN', r: 'NEBULA', ext: [], lines: [
          ['r', "Stark. We tried. We lost. Now we sit."],
          ['l', "Yeah. We lost. Give me a minute to count how many."],
        ] },
        { k: 'card', say: 'THE AVENGERS WILL RETURN', cap: 'INFINITY WAR' },
      ],
    },
  ],
}
