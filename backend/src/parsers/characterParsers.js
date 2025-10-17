/**
 * Parsers for AI-generated character data
 */

/**
 * Strip markdown formatting from text to be more forgiving of LLM output
 */
function stripMarkdown(text) {
  let cleaned = text;
  // Remove bold (**text** or __text__)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  // Remove italic (*text* or _text_)
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');
  // Remove any remaining stray asterisks/underscores
  cleaned = cleaned.replace(/[*_]+/g, '');
  return cleaned;
}

/**
 * Parse dating profile from plaintext AI response
 * Forgiving parser that handles markdown formatting and common LLM variations
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
    // Strip markdown from entire content first
    const cleanedContent = stripMarkdown(content);
    const lines = cleanedContent.split('\n');
    let currentSection = 'bio'; // Start capturing bio from the beginning
    let bioLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('Bio:')) {
        currentSection = 'bio';
        const bioContent = line.substring('Bio:'.length).trim();
        if (bioContent) bioLines.push(bioContent);
      } else if (line.startsWith('Interests:')) {
        if (currentSection === 'bio' && bioLines.length > 0) {
          profileData.bio = bioLines.join(' ');
        }
        currentSection = null;
        bioLines = [];
        const interestsStr = line.substring('Interests:'.length).trim();
        profileData.interests = interestsStr.split(',').map(i => i.trim()).filter(i => i.length > 0);
      } else if (line.startsWith('Fun Facts:')) {
        if (currentSection === 'bio' && bioLines.length > 0) {
          profileData.bio = bioLines.join(' ');
        }
        bioLines = [];
        currentSection = 'funFacts';
      } else if (line.startsWith('Age:')) {
        if (currentSection === 'bio' && bioLines.length > 0) {
          profileData.bio = bioLines.join(' ');
        }
        bioLines = [];
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
      } else if (currentSection === 'bio') {
        // Multi-line bio content
        bioLines.push(line);
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
 * Forgiving parser that handles markdown formatting and common LLM variations
 */
export function parseScheduleFromPlaintext(text) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const schedule = {};

  // Strip markdown formatting to be more forgiving
  const cleanedText = stripMarkdown(text);

  // Split by day headers
  const dayRegex = /(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)/gi;
  const sections = cleanedText.split(dayRegex).filter(s => s.trim());

  for (let i = 0; i < sections.length; i += 2) {
    const dayName = sections[i].toLowerCase();
    const dayContent = sections[i + 1];

    if (!days.includes(dayName) || !dayContent) continue;

    const blocks = [];
    const lines = dayContent.trim().split('\n');

    for (const line of lines) {
      let trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Normalize whitespace: replace all Unicode spaces with regular spaces
      // This handles non-breaking spaces, em spaces, en spaces, etc.
      trimmedLine = trimmedLine.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ');

      // Fix common LLM typos/abbreviations in status codes
      trimmedLine = trimmedLine.replace(/\b(AWY|AWLY|AW|OFLINE|OFFLIN|BUSYY|ONLIN)\b/gi, (match) => {
        const upper = match.toUpperCase();
        if (upper === 'AWY' || upper === 'AWLY' || upper === 'AW') return 'AWAY';
        if (upper === 'OFLINE' || upper === 'OFFLIN') return 'OFFLINE';
        if (upper === 'BUSYY') return 'BUSY';
        if (upper === 'ONLIN') return 'ONLINE';
        return match;
      });

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
          // Clean up activity text (remove trailing periods, extra markdown)
          let cleanActivity = activity.trim();
          cleanActivity = cleanActivity.replace(/\.$/, ''); // Remove trailing period
          block.activity = cleanActivity;
        }
        blocks.push(block);
      } else {
        // If this line doesn't match the time block format, it might be a continuation of the previous block's activity
        if (blocks.length > 0) {
          const lastBlock = blocks[blocks.length - 1];
          // Append to previous block's activity (handling case where activity was empty)
          if (lastBlock.activity) {
            lastBlock.activity += ' ' + trimmedLine;
          } else {
            lastBlock.activity = trimmedLine;
          }
          console.log(`📎 Appended continuation line to previous block: "${trimmedLine}"`);
        } else {
          // Log lines that failed to parse with hex dump for debugging
          const hexDump = Array.from(trimmedLine).map(c =>
            `${c}(${c.charCodeAt(0).toString(16)})`
          ).join(' ');
          console.log(`⚠️  Failed to parse schedule line: "${trimmedLine}"`);
          console.log(`   Hex dump: ${hexDump.substring(0, 200)}...`);
        }
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
