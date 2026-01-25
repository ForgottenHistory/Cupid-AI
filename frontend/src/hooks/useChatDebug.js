import { useEffect } from 'react';
import { getImageUrl } from '../services/api';

/**
 * Hook to attach debug functions to the window object for testing.
 * Attaches: debugUnmatch, debugGenerateImage, debugChatBackground, debugMood
 * Cleans up on unmount.
 */
export const useChatDebug = ({
  character,
  characterId,
  conversation,
  setUnmatchData,
  setMoodEffect,
  clearMoodEffect,
}) => {
  useEffect(() => {
    if (character) {
      // Expose conversation ID for debug functions
      window.__currentConversationId = conversation?.id || null;

      // Debug function for testing unmatch modal
      window.debugUnmatch = () => {
        console.log('[Debug] Triggering unmatch modal');
        setUnmatchData({
          characterId: character.id,
          characterName: character.name,
          reason: 'Debug test unmatch'
        });
      };

      // Debug function for generating character image
      window.debugGenerateImage = async (contextTags = 'smiling, casual clothes, outdoors, daytime') => {
        console.log('[Debug] Generating image for', character.name);
        console.log('[Debug] Context tags:', contextTags);

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(getImageUrl(`/api/debug/generate-image/${character.id}`), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ contextTags })
          });

          if (!response.ok) {
            const error = await response.json();
            console.error('[Debug] Image generation failed:', error);
            alert(`Failed to generate image: ${error.error}`);
            return;
          }

          const result = await response.json();
          console.log('[Debug] Image generated!');
          console.log('[Debug] Full prompt:', result.prompt);

          // Download image
          try {
            const link = document.createElement('a');
            link.href = result.image;
            link.download = `${character.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('[Debug] Image downloaded!');
            alert(`Image generated and downloaded!\n\nPrompt: ${result.prompt}`);
          } catch (downloadError) {
            console.error('Download failed, showing image in console instead:', downloadError);
            console.log('[Debug] Image data:', result.image);

            // Try to open in new window as fallback
            try {
              const newWindow = window.open('', '_blank');
              if (newWindow) {
                newWindow.document.write(`
                  <html>
                    <head><title>${character.name} - Generated Image</title></head>
                    <body style="margin: 0; background: #000; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh;">
                      <img src="${result.image}" style="max-width: 90vw; max-height: 80vh; object-fit: contain;" />
                      <div style="color: white; text-align: center; padding: 20px; font-family: monospace; font-size: 12px; max-width: 90vw; word-wrap: break-word;">
                        <p><strong>Prompt:</strong> ${result.prompt}</p>
                        <p style="margin-top: 10px;"><em>Right-click image to save</em></p>
                      </div>
                    </body>
                  </html>
                `);
                newWindow.document.close();
              } else {
                alert('Image generated! Check console for image data (copy the data URI to browser to view)');
              }
            } catch (windowError) {
              alert('Image generated! Check console - copy the image data URI to your browser to view it.');
            }
          }
        } catch (error) {
          console.error('[Debug] Image generation error:', error);
          alert(`Error: ${error.message}`);
        }
      };

      // Debug function for testing chat background effects (frontend only)
      window.debugChatBackground = (effect = 'hearts') => {
        const validEffects = ['none', 'hearts', 'stars', 'laugh', 'sparkles', 'fire', 'roses'];
        if (!validEffects.includes(effect)) {
          console.log(`[Debug] Invalid effect. Valid options: ${validEffects.join(', ')}`);
          return;
        }
        console.log(`[Debug] Setting chat background effect: ${effect} for character ${characterId}`);

        if (effect !== 'none') {
          // Pass auto-clear timeout to context (30 minutes)
          setMoodEffect(characterId, effect, character?.name || 'Character', 30 * 60 * 1000);
        } else {
          clearMoodEffect(characterId);
        }
      };

      // Debug function for full mood system (backend + frontend)
      window.debugMood = async (mood = 'hearts') => {
        const validMoods = ['hearts', 'stars', 'laugh', 'sparkles', 'fire', 'roses'];
        if (!validMoods.includes(mood)) {
          console.log(`[Debug] Invalid mood. Valid options: ${validMoods.join(', ')}`);
          return;
        }

        console.log(`[Debug] Triggering full mood system: ${mood} for character ${characterId}`);

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(getImageUrl(`/api/chat/conversations/${characterId}/debug-mood`), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ mood, characterName: character?.name })
          });

          if (!response.ok) {
            const error = await response.json();
            console.error('[Debug] Mood trigger failed:', error);
            return;
          }

          const result = await response.json();
          console.log('[Debug] Mood triggered successfully!');
          console.log('[Debug] System message:', result.systemMessage);
        } catch (error) {
          console.error('[Debug] Mood error:', error);
        }
      };
    }

    return () => {
      delete window.debugUnmatch;
      delete window.debugGenerateImage;
      delete window.debugChatBackground;
      delete window.debugMood;
      delete window.__currentConversationId;
    };
  }, [character, characterId, conversation, setUnmatchData, setMoodEffect, clearMoodEffect]);
};
