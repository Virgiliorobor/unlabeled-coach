// 40 Oblique Strategies cards for builders, R1–R40.
// Displayed one per day, same card for all users, keyed to UTC day number.

export const OBLIQUE_CARDS: string[] = [
  "The work is already the answer",
  "What would the version of you who already did this have done first?",
  "Remove the approval step",
  "What is the smallest honest version?",
  "Your background is not a liability. Name one thing it gives you that others don't have.",
  "Publish the draft. The comments will write the next version.",
  "Use an old idea",
  "What would you remove?",
  "The most important thing is the thing you are not doing",
  "Who said you need permission?",
  "State the problem in words of one syllable",
  "Honor thy error as a hidden intention",
  "Ask your body",
  "What would your 10-year-ago self think of this?",
  "Destroy nothing — build anyway",
  "Speak to the person, not the audience",
  "Do the thing you think is too simple",
  "Finish something. Anything.",
  "What label are you protecting yourself from?",
  "Share one true thing",
  "Remove a limitation and see what happens",
  "What would you do if you weren't afraid of looking like a beginner?",
  "The audience you're afraid of is imaginary. The audience that needs you is real.",
  "What are you building toward — not building?",
  "Change the input, not the output",
  "Work at a different speed",
  "What does this want to be?",
  "Will it work?",
  "What would the person on the other side actually feel?",
  "You already know what to do",
  "Do something you've never done before, with something you know very well",
  "Make a list of everything that's stopping you. Cross out the ones you control.",
  "Give the work a deadline it doesn't deserve",
  "What would you make if your previous career had never existed?",
  "The version you're embarrassed to show is the version someone is waiting for",
  "Stop improving. Start sending.",
  "What question are you not asking because you're afraid of the answer?",
  "You're not starting over. You're translating.",
  "The goal is not to be ready. The goal is to ship while not ready.",
  "One true sentence",
]

export function getDailyCard(): { index: number; text: string } {
  const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  const index = daysSinceEpoch % OBLIQUE_CARDS.length
  return { index: index + 1, text: OBLIQUE_CARDS[index] }
}
