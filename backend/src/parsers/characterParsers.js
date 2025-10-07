/**
 * Parsers for AI-generated character data
 */

/**
 * Parse dating profile from plaintext AI response
 */
export function parseDatingProfileResponse(content) {
  const profileData = {
    bio: null,
    interests: [],
    funFacts: [],
    age: null,
    occupation: null,
    lookingFor: null,
    height: null,
    bodyType: null,
    measurements: null
  };

  try {
    const lines = content.split('\n');
    let currentSection = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('Bio:')) {
        profileData.bio = line.substring('Bio:'.length).trim();
      } else if (line.startsWith('Interests:')) {
        const interestsStr = line.substring('Interests:'.length).trim();
        profileData.interests = interestsStr.split(',').map(i => i.trim()).filter(i => i.length > 0);
      } else if (line.startsWith('Fun Facts:')) {
        currentSection = 'funFacts';
      } else if (line.startsWith('Age:')) {
        const ageStr = line.substring('Age:'.length).trim();
        profileData.age = parseInt(ageStr) || null;
        currentSection = null;
      } else if (line.startsWith('Occupation:')) {
        const value = line.substring('Occupation:'.length).trim();
        profileData.occupation = (value && value.toLowerCase() !== 'none') ? value : null;
        currentSection = null;
      } else if (line.startsWith('Looking For:')) {
        const value = line.substring('Looking For:'.length).trim();
        profileData.lookingFor = (value && value.toLowerCase() !== 'none') ? value : null;
        currentSection = null;
      } else if (line.startsWith('Height:')) {
        profileData.height = line.substring('Height:'.length).trim();
        currentSection = null;
      } else if (line.startsWith('Body Type:')) {
        profileData.bodyType = line.substring('Body Type:'.length).trim();
        currentSection = null;
      } else if (line.startsWith('Measurements:')) {
        const value = line.substring('Measurements:'.length).trim();
        profileData.measurements = (value && value.toLowerCase() !== 'none') ? value : null;
        currentSection = null;
      } else if (currentSection === 'funFacts' && line.startsWith('-')) {
        const fact = line.substring(1).trim();
        if (fact) profileData.funFacts.push(fact);
      }
    }

    return profileData;
  } catch (parseError) {
    console.error('Failed to parse dating profile:', parseError, 'Content:', content);
    throw new Error('AI returned invalid format');
  }
}

/**
 * Parse schedule from plaintext AI response
 */
export function parseScheduleFromPlaintext(text) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const schedule = {};

  // Split by day headers
  const dayRegex = /(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)/gi;
  const sections = text.split(dayRegex).filter(s => s.trim());

  for (let i = 0; i < sections.length; i += 2) {
    const dayName = sections[i].toLowerCase();
    const dayContent = sections[i + 1];

    if (!days.includes(dayName) || !dayContent) continue;

    const blocks = [];
    const lines = dayContent.trim().split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Parse format: "HH:MM-HH:MM STATUS Activity (optional)"
      const match = trimmedLine.match(/(\d{2}:\d{2})-(\d{2}:\d{2})\s+(ONLINE|AWAY|BUSY|OFFLINE)(?:\s+(.+))?/i);
      if (match) {
        const [, start, end, status, activity] = match;
        const block = {
          start,
          end,
          status: status.toLowerCase()
        };
        if (activity) {
          block.activity = activity.trim();
        }
        blocks.push(block);
      }
    }

    if (blocks.length > 0) {
      schedule[dayName] = blocks;
    }
  }

  return {
    schedule,
    responseDelays: {
      online: [30, 120],
      away: [300, 1200],
      busy: [900, 3600],
      offline: null
    }
  };
}
