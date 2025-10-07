/**
 * AI prompt templates for character generation
 */

/**
 * Build prompt for cleaning up character descriptions
 */
export function buildCleanupDescriptionPrompt(description) {
  return `Convert this character description into clean, readable plaintext.

IMPORTANT RULES:
1. Remove any markdown, special formatting, asterisks, brackets, or role-play notation
2. Remove ANY references to romantic or sexual relationships with {{user}}, {{char}}, or similar placeholders (e.g., "your girlfriend", "your lover", "in love with you")
3. Remove hints at existing romantic connections or pre-established relationships with the reader
4. Friendships and platonic relationships are fine to keep
5. Keep personality traits, hobbies, background, and general character information
6. Keep it natural and descriptive
7. Try to keep the same style of writing
8. Include bodily details
9. ALL NSFW details should be kept

Just return the cleaned text, nothing else:\n\n${description}`;
}

/**
 * Build prompt for generating dating profile
 */
export function buildDatingProfilePrompt(description, name) {
  const characterName = name || 'the character';

  return `You are ${characterName}. Based on your character description below, create a dating profile AS IF YOU ARE WRITING IT YOURSELF. Write everything in first-person perspective.

Character Description:
${description}

Generate a dating profile in this EXACT plaintext format:

Bio: [A 2-3 sentence 'About Me' section in first person. Make it natural and engaging, like a real dating profile.]

Interests: [interest1, interest2, interest3, interest4, interest5]

Fun Facts:
- [fun fact 1 in first person]
- [fun fact 2 in first person]
- [fun fact 3 in first person]

Age: [number, minimum 20, could be much higher depending on context]

Occupation: [occupation or "none"]

Looking For: [1-2 sentences about what I'm looking for in first person, or "none"]

Height: [height in feet/inches like 5'6" or cm, make reasonable estimate]

Body Type: [one word: slim/athletic/curvy/average/petite/plus-size/muscular]

Measurements: [bust-waist-hips like 34-26-36, or "none" if not applicable]

Important:
- Write EVERYTHING in first-person (I, me, my)
- Make it sound natural, like ${characterName} is actually writing their profile
- Be creative but stay true to the character description
- Height and body type should be reasonable estimates based on the character's description
- Measurements are optional - only include if it makes sense for the character
- Output ONLY the plaintext format shown above, nothing else`;
}

/**
 * Build prompt for generating weekly schedule
 */
export function buildSchedulePrompt(description, name) {
  const characterName = name || 'this character';

  return `Based on the character description below, create a realistic weekly schedule for ${characterName}.

Status meanings:
- ONLINE: Free and available to chat
- AWAY: Busy with activities but might check phone
- BUSY: At work or important tasks
- OFFLINE: Sleeping or unavailable

Character Description:
${description}

Create a schedule in this simple format (one line per time block):

MONDAY
00:00-08:00 OFFLINE Sleep
08:00-09:00 AWAY Morning routine
09:00-17:00 BUSY Work
17:00-19:00 ONLINE
19:00-21:00 AWAY Gym
21:00-24:00 ONLINE

TUESDAY
...

Continue for all 7 days. Make it realistic for this character's lifestyle and personality. Activities are optional for ONLINE periods.`;
}
