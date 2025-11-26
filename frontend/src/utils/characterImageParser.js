class CharacterImageParser {

  async extractFromPNG(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const dataView = new DataView(arrayBuffer);

      // Check PNG signature
      if (!this.isPNG(dataView)) {
        throw new Error('File is not a valid PNG');
      }

      // Parse PNG chunks to find text data
      const textData = this.extractTextChunks(dataView);

      // Look for character data in text chunks
      for (const text of textData) {
        const characterData = this.parseCharacterData(text);
        if (characterData) {
          return characterData;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to extract character data from PNG:', error);
      throw error;
    }
  }

  isPNG(dataView) {
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < signature.length; i++) {
      if (dataView.getUint8(i) !== signature[i]) {
        return false;
      }
    }
    return true;
  }

  extractTextChunks(dataView) {
    const textChunks = [];
    let offset = 8; // Skip PNG signature

    try {
      while (offset < dataView.byteLength - 8) {
        // Read chunk length (4 bytes, big-endian)
        const length = dataView.getUint32(offset);
        offset += 4;

        // Read chunk type (4 bytes)
        const type = this.readString(dataView, offset, 4);
        offset += 4;

        // If this is a text chunk, extract the data
        if (['tEXt', 'zTXt', 'iTXt'].includes(type)) {
          const chunkData = this.extractChunkText(dataView, offset, length, type);
          if (chunkData) {
            textChunks.push(chunkData);
          }
        }

        // Skip chunk data and CRC
        offset += length + 4;

        // Stop at IEND
        if (type === 'IEND') {
          break;
        }
      }
    } catch (error) {
      console.warn('Error parsing PNG chunks:', error);
    }

    return textChunks;
  }

  extractChunkText(dataView, offset, length, type) {
    try {
      if (type === 'tEXt') {
        // tEXt: keyword\0text
        const data = new Uint8Array(dataView.buffer, dataView.byteOffset + offset, length);
        const nullIndex = data.indexOf(0);

        if (nullIndex !== -1) {
          // Extract keyword
          const keywordBytes = data.slice(0, nullIndex);
          const keyword = this.decodeText(keywordBytes);

          // Extract text after null separator
          const textBytes = data.slice(nullIndex + 1);
          const text = this.decodeText(textBytes);

          console.log(`Found tEXt chunk - keyword: "${keyword}", text length: ${text.length}`);

          // Common keywords for character data
          if (['chara', 'character', 'char', 'ccv2', 'json'].includes(keyword.toLowerCase())) {
            return text;
          }

          // Sometimes the entire chunk is just JSON without a keyword
          if (this.looksLikeJSON(text)) {
            return text;
          }
        } else {
          // No null separator, treat entire chunk as text
          const text = this.decodeText(data);
          if (this.looksLikeJSON(text)) {
            return text;
          }
        }
      }
    } catch (error) {
      console.warn('Error extracting chunk text:', error);
    }

    return null;
  }

  looksLikeJSON(text) {
    const trimmed = text.trim();
    return trimmed.startsWith('{') || trimmed.includes('"spec"') || trimmed.includes('chara_card_v2');
  }

  decodeText(bytes) {
    // Try UTF-8 first
    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (this.isReasonableText(decoded)) {
        return decoded;
      }
    } catch (e) {
      // Fall back to Windows-1252
    }

    // Fallback: Windows-1252 decoding
    return this.decodeWindows1252(bytes);
  }

  decodeWindows1252(bytes) {
    // Windows-1252 to Unicode mapping for characters 128-255
    const windows1252 = [
      0x20AC, 0x81, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021,
      0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8D, 0x017D, 0x8F,
      0x90, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
      0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x9D, 0x017E, 0x0178
    ];

    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte < 0x80) {
        result += String.fromCharCode(byte);
      } else if (byte >= 0x80 && byte <= 0x9F) {
        result += String.fromCharCode(windows1252[byte - 0x80]);
      } else {
        result += String.fromCharCode(byte);
      }
    }
    return result;
  }

  isReasonableText(text) {
    let controlChars = 0;
    let replacementChars = 0;
    
    for (let i = 0; i < Math.min(text.length, 1000); i++) {
      const code = text.charCodeAt(i);
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
        controlChars++;
      }
      if (code === 0xFFFD) {
        replacementChars++;
      }
    }
    
    const sampleSize = Math.min(text.length, 1000);
    return (controlChars / sampleSize) < 0.1 && (replacementChars / sampleSize) < 0.1;
  }

  readString(dataView, offset, length) {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(dataView.getUint8(offset + i));
    }
    return result;
  }

  parseCharacterData(text) {
    try {
      let jsonText = text.trim();
      
      // Check if the text is base64 encoded
      if (this.isBase64(jsonText)) {
        console.log('Detected base64 encoded data, decoding...');
        try {
          const decoded = atob(jsonText);
          const bytes = new Uint8Array(decoded.length);
          for (let i = 0; i < decoded.length; i++) {
            bytes[i] = decoded.charCodeAt(i);
          }
          jsonText = new TextDecoder('utf-8').decode(bytes);
          console.log('Successfully decoded base64 data');
        } catch (e) {
          console.warn('Failed to decode base64:', e);
          return null;
        }
      }
      
      // Find the start of JSON
      const jsonStart = jsonText.indexOf('{');
      if (jsonStart > 0) {
        jsonText = jsonText.substring(jsonStart);
      }

      // Find the end of JSON by counting braces
      let braceCount = 0;
      let jsonEnd = -1;
      let inString = false;
      let escapeNext = false;
      
      for (let i = 0; i < jsonText.length; i++) {
        const char = jsonText[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !inString) {
          inString = true;
        } else if (char === '"' && inString) {
          inString = false;
        }
        
        if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i;
              break;
            }
          }
        }
      }
      
      if (jsonEnd !== -1) {
        jsonText = jsonText.substring(0, jsonEnd + 1);
      }

      console.log('Attempting to parse JSON:', jsonText.substring(0, 200) + '...');

      const parsed = JSON.parse(jsonText);

      if (this.isValidCharacterCard(parsed)) {
        // Check if it's V1 format and convert to V2
        if (!parsed.spec && parsed.name) {
          console.log('V1 character card found, converting to V2:', parsed.name);
          return this.convertV1ToV2(parsed);
        }

        console.log('Valid character card found:', parsed.data.name);
        return parsed;
      }
    } catch (error) {
      console.warn('Failed to parse JSON from text:', error);
    }

    return null;
  }

  isBase64(str) {
    if (str.length % 4 !== 0) return false;
    if (str.startsWith('eyJ')) return true;
    const base64Regex = /^[A-Za-z0-9+/]+=*$/;
    return base64Regex.test(str);
  }

  isValidCharacterCard(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check for V2 format
    const isV2 = data.spec === 'chara_card_v2' &&
      data.data &&
      typeof data.data.name === 'string';

    // Check for V1 format (flat structure)
    const isV1 = !data.spec &&
      typeof data.name === 'string';

    console.log('Character card validation:', {
      hasData: !!data,
      isV2,
      isV1,
      hasName: typeof (data.data?.name || data.name) === 'string',
      isValid: isV2 || isV1
    });

    return isV2 || isV1;
  }

  convertV1ToV2(v1Data) {
    // Convert V1 format to V2 format
    return {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: v1Data.name || '',
        description: v1Data.description || '',
        personality: v1Data.personality || '',
        scenario: v1Data.scenario || '',
        first_mes: v1Data.first_mes || '',
        mes_example: v1Data.mes_example || '',
        creator_notes: v1Data.creator_notes || '',
        system_prompt: v1Data.system_prompt || '',
        post_history_instructions: v1Data.post_history_instructions || '',
        tags: v1Data.tags || [],
        creator: v1Data.creator || '',
        character_version: v1Data.character_version || '',
        alternate_greetings: v1Data.alternate_greetings || [],
        extensions: v1Data.extensions || {}
      }
    };
  }
}

export const characterImageParser = new CharacterImageParser();