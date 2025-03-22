export { getEncouragementMessage };

const messages = {
  kAsteroid: [
    "Killed by your own inability to fly straight",
    "Killed by fate. Nah, you are just bad",
    "You were between a rock and a hard place and decided to crash into the rock",
    "If this was rock-paper-scissors you'd be scissors",
    "Death by space geology",
    "Your ship insurance rate just went up",
  ],
  kShipWeapon: [
    "Killed by a wimpy ship",
    "The AI in this game is not particularly good. Just sayin'",
    "Maybe try shooting back next time?",
  ],
  kShipSecondaryWeapon: [
    "Next time try to avoid that {PLACEHOLDER}",
    "The pilot of that ship is now a hero somewhere",
    "Did you see those fireworks!? Oh, sorry…",
    "You saw the {PLACEHOLDER} and thought, ‘How bad can it be?’",
    "That's what you get for standing still",
    "That {PLACEHOLDER} had your name on it",
  ],
};

const genericMessages = [
  "Game over!",
  "Well, you can try again",
  "Luckily this is not real life and you can try as many things as you want",
  "I should add micropayments. I'd be rich with so many retries",
  "Git gud",
  "Have you heard of PEBKAC? Look it up",
  "Maybe take a look into Settings, you can customise your controls",
  "Don't worry, everyone dies eventually. In this game, it's just very quickly",
  "Your skills need some... polishing",
];

const getEncouragementMessage = (player) => {
  const options = [...genericMessages];
  const generics = options.sort(() => Math.random() - 0.5).slice(0, 3);
  if (player.killedBy) {
    const options = [...messages[player.killedBy.id]].concat(generics);
    options.sort(() => Math.random() - 0.5);
    return options[0].replace(
      "{PLACEHOLDER}",
      player.killedBy.replacement ?? "",
    );
  }
  return generics[0];
};
