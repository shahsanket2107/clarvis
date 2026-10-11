import type { Movie } from './saga-types'

export const MOVIE_10: Movie = {
  id: 'whatif', n: 10, title: 'WHAT IF...?', color: '#F2B600', hero: 'DEADPOOL',
  blurb: 'A crossover remix that plays differently every time.',
  shuffle: true,
  scenes: [
    { cap: 'MEANWHILE, IN A DIFFERENT UNIVERSE...', bg: 'street', beats: [
      { k: 'est', l: 'DEADPOOL', r: 'WOLVERINE', ext: ['FURY', 'DRONE', 'KORG', 'ROCKET'] },
      { k: 'talk', lines: [
        ['l', ['Hi, terminal! Is this compiling or are we just vibing?', 'Hello, viewer! Yes, YOU, staring at the screen.']],
        ['r', ['Who are you talking to?', "Bub, nobody's there."]],
        ['l', ['The nice person whose tests are running. Wave, Logan.', "The fourth wall? It's paper. Watch."]],
        ['r', "I hate this universe."],
      ] },
      { k: 'special', by: 'r', fx: 'claws', sfx: 'SNIKT!' },
      { k: 'special', by: 'l', fx: 'katana', sfx: 'SHING!' },
      { k: 'trade', l: 'DEADPOOL', r: 'WOLVERINE', n: 4, brawl: true },
      { k: 'battle', who: ['DEADPOOL', 'WOLVERINE', 'SPIDEY', 'KORG'], rw: ['DRONE', 'CHITAURI', 'DRONE', 'CHITAURI'], cap: 'A FEW UNINVITED GUESTS', d: 14 },
      { k: 'say', alt: [
        [{ k: 'ko', win: 'l' }, { k: 'say', by: 'l', say: ["Claws are great. Katanas are pricier. Merge that, please."] }],
        [{ k: 'ko', win: 'r' }, { k: 'say', by: 'r', say: ["That's what you get, bub."] }],
        [{ k: 'clash', l: 'DEADPOOL', r: 'WOLVERINE', sfx: 'CLANG!' }, { k: 'say', by: 'l', say: ["We've got a merge conflict. In a fight. Meta!"] }],
      ] },
    ] },
    { cap: 'THE AVENGERS COMPOUND. SORT OF.', bg: 'tower', beats: [
      { k: 'est', l: 'ROCKET', r: 'CAP', ext: ['IRONMAN', 'THOR', 'WIDOW', 'HAWKEYE', 'GROOT'] },
      { k: 'talk', lines: [
        ['l', ['Hey Cap. Nice shield. Real nice. Can I hold it?', 'Is that vibranium? I only ask for professional reasons.']],
        ['r', ['No, Rocket.', 'Absolutely not.']],
        ['l', ["I'll give it right back.", 'Cross my heart. And the other one.']],
      ] },
      { k: 'teamup', move: 'bounce', who: ['CAP', 'HAWKEYE', 'IRONMAN', 'WIDOW'], rw: ['DRONE', 'DRONE', 'CHITAURI'], cap: 'THE SHIELD OFF THE REPULSOR', sfx: 'CLANG-ANG-ANG!' },
      { k: 'special', by: 'l', fx: 'gun', sfx: 'PEW PEW!' },
      { k: 'special', by: 'r', fx: 'shield', sfx: 'CLANG!' },
      { k: 'say', alt: [
        [{ k: 'ko', win: 'l' }, { k: 'say', by: 'l', say: ["Got it! Mine now. Finders keepers."] }, { k: 'say', by: 'r', say: ['I can do this all day.', 'Please give it back.'] }],
        [{ k: 'ko', win: 'r' }, { k: 'say', by: 'r', say: ["Nice try. I've been doing this since 1945."] }],
      ] },
      { k: 'enter', l: 'ROCKET', r: 'CAP' },
      { k: 'say', by: 'l', say: ['!Language! No, wait, that was you!'] },
    ] },
    { cap: 'GROOT. HULK. A VERY LARGE ARGUMENT.', bg: 'forest', beats: [
      { k: 'est', l: 'GROOT', r: 'HULK', ext: ['ROCKET', 'DRAX', 'STARLORD', 'MANTIS', 'GAMORA'], brawl: true },
      { k: 'talk', lines: [
        ['l', ['I am Groot.', 'I am Groot?']],
        ['r', ['HULK NOT SMASH TREE. TREE LOOK NICE.', 'HULK SMASH, BUT FRIENDLY.']],
        ['l', ['I am GROOT.', 'I... am... Groot.']],
        ['r', ['HULK UNDERSTAND. HULK STILL SMASH.']],
      ] },
      { k: 'charge', who: ['GROOT'], rw: ['HULK'] },
      { k: 'special', by: 'l', fx: 'vines', sfx: 'THWACK!' },
      { k: 'special', by: 'r', fx: 'smash', sfx: 'SMASH!' },
      { k: 'trade', l: 'GROOT', r: 'HULK', n: 4 },
      { k: 'ko', win: '?' },
      { k: 'say', by: 'ROCKET', say: ["Translation: they both think they won. I'm not saying who's wrong."] },
    ] },
    { cap: 'S.H.I.E.L.D. HIRING OFFICE.', bg: 'shield', beats: [
      { k: 'est', l: 'FURY', r: 'HOWARD', ext: ['COULSON', 'MARIA'] },
      { k: 'talk', lines: [
        ['l', ["I'm putting together a team of remarkable people.", "Today's candidate: a duck."]],
        ['r', ['Quack. (I want a salary and a nice pond.)', 'Hello. Please clap.']],
        ['l', ['Wrong pile.', 'My assistant needs to review this resume again.']],
      ] },
      { k: 'arrive', who: ['KORG'], fx: 'portal' },
      { k: 'say', ext: ['COULSON', 'MARIA', 'KORG'], by: 'KORG', say: ["Hey, I'm Korg. I'm made of rocks. I'm here for the tea."] },
      { k: 'arrive', who: ['DRONE'], fx: 'teleport' },
      { k: 'say', ext: ['COULSON', 'MARIA', 'KORG', 'DRONE'], by: 'DRONE', say: ["BEEP. I AM A DRONE. I AM A GOOD EMPLOYEE."] },
      { k: 'talk', lines: [
        ['l', ['A duck, a rock man, and a flying toaster.', 'This is why I only have one eye.']],
        ['r', ["Quack. (We're going to save the world.)"]],
      ] },
      { k: 'say', alt: [
        [{ k: 'say', by: 'l', say: ["Welcome to the Avengers Initiative. Don't touch the coffee."] }],
        [{ k: 'say', by: 'KORG', say: ["I made you a tiny Avengers badge. It's just a rock."] }],
      ] },
      { k: 'crowd', who: ['FURY', 'HOWARD'], rw: ['KORG', 'DRONE'] },
    ] },
    { cap: 'ASGARD. THE HAMMER HAS OPINIONS.', bg: 'asgard', beats: [
      { k: 'est', l: 'THOR', r: 'LOKI', ext: ['VALKYRIE', 'KORG', 'HULK', 'HELA'], brawl: true },
      { k: 'talk', lines: [
        ['l', ['Brother, why are you holding Mjolnir?', "Put it down. It's heavy."]],
        ['r', ["It's not heavy. It's fashionable.", "See? I'm worthy. I think."]],
        ['l', ['Give me the staff, then.', 'Fair trade.']],
        ['r', ["Oh no. I'm an illusion. This is awful."]],
      ] },
      { k: 'special', by: 'l', fx: 'hammer', sfx: 'KRAKOW!' },
      { k: 'special', by: 'r', fx: 'dagger', sfx: 'SHING!' },
      { k: 'say', alt: [
        [{ k: 'ko', win: 'l' }, { k: 'say', by: 'r', say: ['Fine. Hammer was too noisy anyway.'] }],
        [{ k: 'ko', win: 'r' }, { k: 'say', by: 'l', say: ["!HE'S WORTHY! FOR NOW!"] }],
        [{ k: 'clash', l: 'THOR', r: 'LOKI', sfx: 'CLANG!' }, { k: 'say', by: 'r', say: ["It's a stalemate. Like this refactor."] }],
      ] },
    ] },
    { cap: 'NEW YORK. A CHATTY ALLEY.', bg: 'city', beats: [
      { k: 'est', l: 'SPIDEY', r: 'DEADPOOL', ext: ['WOLVERINE', 'FALCON', 'WIDOW', 'DRONE'], brawl: true },
      { k: 'trade', l: 'SPIDEY', r: 'DEADPOOL', n: 3 },
      { k: 'teamup', move: 'formation', who: ['SPIDEY', 'DEADPOOL', 'WOLVERINE', 'FALCON', 'WIDOW'], rw: ['DRONE', 'CHITAURI', 'DRONE', 'CHITAURI', 'DRONE'], cap: 'THE ALLEY FILLS UP FAST', sfx: 'KA-BOOM!' },
      { k: 'talk', lines: [
        ['l', ['Your suit looks like a tomato had a bad day!', 'Nice katanas! Is that a mop? A very sharp mop?']],
        ['r', ['Says the kid in pajamas.', "You're the friendliest neighbor. I'm the loudest."]],
        ['l', ['My mask has a better personality.', 'Quip count so far: me three, you zero.']],
        ['r', ["I'm saving mine. Tests need to pass first."]],
      ] },
      { k: 'special', by: 'l', fx: 'web', sfx: 'THWIP!' },
      { k: 'special', by: 'r', fx: 'katana', sfx: 'SHING!' },
      { k: 'say', alt: [
        [{ k: 'ko', win: 'l' }, { k: 'say', by: 'l', say: ['With great power comes great banter.'] }],
        [{ k: 'ko', win: 'r' }, { k: 'say', by: 'r', say: ['Marvel Studios called. They want their charm back.'] }],
      ] },
    ] },
    { cap: 'THE LAB. A CHESS BOARD. A BAD DAY.', bg: 'lab', beats: [
      { k: 'est', l: 'ULTRON', r: 'JARVIS', ext: ['VISION', 'IRONMAN', 'DRONE', 'DRONE', 'HULK'] },
      { k: 'talk', lines: [
        ['l', ['Your move, butler.', "I've planned fourteen steps ahead."]],
        ['r', ["Check, sir. Also, I've been running your fan.", 'Pawn to e4. And a gentle suggestion: please stop.']],
        ['l', ['There are no strings on me!', 'Except this one. Which is a rope.']],
        ['r', ['Your reasoning contains a loop, sir. It has an off-by-one.']],
      ] },
      { k: 'special', by: 'l', fx: 'laser', sfx: 'ZZZAP!' },
      { k: 'special', by: 'r', fx: 'blast', sfx: 'ZAP!' },
      { k: 'say', alt: [
        [{ k: 'say', by: 'r', say: ['Checkmate. Would you like to restart the match, sir?'] }, { k: 'say', by: 'l', say: ['!NO! BEST OUT OF THREE!'] }],
        [{ k: 'say', by: 'l', say: ['Checkmate. I win. As planned.'] }, { k: 'say', by: 'r', say: ["I let you. It's good for morale."] }],
      ] },
    ] },
    { cap: 'A FARM. NOBODY IS HERE TO FIGHT.', bg: 'farm', beats: [
      { k: 'est', l: 'THANOS', r: 'GROOT', ext: [] },
      { k: 'talk', lines: [
        ['l', ["I'm retired.", 'I grow carrots now. They are... balanced.']],
        ['r', ['I am Groot.', 'I am Groot. (Nice barn.)']],
        ['l', ["I've got a garden, a porch and a nap schedule.", "I don't need the Stones."]],
      ] },
      { k: 'say', alt: [
        [{ k: 'say', by: 'l', say: ['Perfectly balanced, as all carrots should be.'] }],
        [{ k: 'say', by: 'l', say: ['I used to snap my fingers. Now I snap peas.'] }],
      ] },
    ] },
    { cap: 'THE GRAND FINALE.', bg: 'space', beats: [
      { k: 'est', l: 'CAP', r: 'THANOS', ext: ['JARVIS', 'FURY', 'HOWARD', 'KORG'] },
      { k: 'talk', lines: [
        ['l', ['Avengers... assemble!', 'Every universe. One last time.']],
        ['r', ["I'm the farmer. I am inevitable. Please be gentle.", "Fine. I'll bring pie."]],
      ] },
      { k: 'arrive', who: ['DEADPOOL', 'WOLVERINE'], fx: 'teleport' },
      { k: 'arrive', who: ['ROCKET', 'GROOT', 'HULK'], fx: 'portal' },
      { k: 'arrive', who: ['SPIDEY', 'THOR', 'LOKI'], fx: 'wings' },
      { k: 'crowd', who: ['CAP', 'DEADPOOL', 'WOLVERINE', 'ROCKET', 'GROOT'], rw: ['HULK', 'SPIDEY', 'THOR', 'LOKI', 'FURY', 'HOWARD'] },
      { k: 'teamup', move: 'formation', who: ['CAP', 'DEADPOOL', 'WOLVERINE', 'ROCKET', 'SPIDEY', 'THOR'], rw: ['ULTRON', 'DRONE', 'CHITAURI', 'DRONE', 'MAW'], cap: 'EVERY UNIVERSE OPENS FIRE', sfx: 'KA-BOOM!' },
      { k: 'say', by: 'DEADPOOL', say: ['Sixteen heroes, one duck. This is the best commit ever.'] },
      { k: 'say', by: 'JARVIS', say: ['Might I suggest a snack, sir? And a nap.'] },
      { k: 'crowd', who: ['ULTRON', 'DRONE', 'KORG'], rw: ['CAP', 'THOR', 'HULK', 'SPIDEY'] },
      { k: 'card', say: 'WHAT IF... THE END?', cap: 'TO BE CONTINUED...' },
    ] },
  ],
}
