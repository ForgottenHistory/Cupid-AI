import { useState, useRef, useEffect } from 'react';

/**
 * Audio player component for voice messages with phone-quality effect
 */
const AudioPlayer = ({ audioUrl, showTranscript = false, transcript = '', role = 'assistant' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showText, setShowText] = useState(false);
  const progressBarRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const gainNodeRef = useRef(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch (e) {
          // Already stopped
        }
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const togglePlay = async () => {
    if (isPlaying) {
      // Stop Web Audio API playback
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current = null;
      }
      setIsPlaying(false);
    } else {
      try {
        // Create audio context for effects
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const audioContext = audioContextRef.current;

        // Fetch and decode audio
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Set duration
        setDuration(audioBuffer.duration);

        // Create source
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        sourceRef.current = source;

        // Create filter for muffled, pillow-like effect
        const lowpass = audioContext.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 2200; // Very muffled, pillow-like
        lowpass.Q.value = 0.2;

        const highpass = audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 180; // Remove deep rumble
        highpass.Q.value = 0.2;

        // Soft, intimate volume
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.45;
        gainNodeRef.current = gainNode;

        // Connect nodes (no distortion, just soft filtering)
        source.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Update progress during playback
        const startTime = audioContext.currentTime;
        const updateProgress = () => {
          if (isPlaying && sourceRef.current) {
            const elapsed = audioContext.currentTime - startTime;
            setCurrentTime(Math.min(elapsed, audioBuffer.duration));
            if (elapsed < audioBuffer.duration) {
              requestAnimationFrame(updateProgress);
            } else {
              setIsPlaying(false);
              setCurrentTime(0);
              sourceRef.current = null;
            }
          }
        };

        // Handle ended
        source.onended = () => {
          setIsPlaying(false);
          setCurrentTime(0);
          sourceRef.current = null;
        };

        // Play
        source.start(0);
        setIsPlaying(true);
        requestAnimationFrame(updateProgress);
      } catch (err) {
        console.error('Failed to play audio:', err);
        setIsPlaying(false);
      }
    }
  };

  // Helper function to create distortion curve
  const makeDistortionCurve = (amount) => {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }

    return curve;
  };

  const handleProgressClick = (e) => {
    // Seeking not supported with Web Audio API BufferSource
    // Would require stopping and restarting playback at new position
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${
            role === 'user'
              ? 'bg-white/20 hover:bg-white/30 text-white'
              : 'bg-purple-100/80 dark:bg-purple-900/60 hover:bg-purple-200/80 dark:hover:bg-purple-800/80 text-purple-600 dark:text-purple-300'
          }`}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Progress Bar */}
        <div className="flex-1 space-y-1">
          <div
            ref={progressBarRef}
            onClick={handleProgressClick}
            className={`h-2 rounded-full cursor-pointer relative overflow-hidden ${
              role === 'user'
                ? 'bg-white/20'
                : 'bg-gray-200/80 dark:bg-gray-600/60'
            }`}
          >
            <div
              className={`h-full rounded-full transition-all ${
                role === 'user'
                  ? 'bg-white'
                  : 'bg-gradient-to-r from-pink-500 to-purple-600'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Time Display */}
          <div className={`flex justify-between text-xs ${
            role === 'user'
              ? 'text-white/70'
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Transcript Toggle */}
      {showTranscript && transcript && (
        <div className="space-y-1">
          <button
            onClick={() => setShowText(!showText)}
            className={`text-xs flex items-center gap-1 hover:underline transition-all ${
              role === 'user'
                ? 'text-white/80 hover:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <svg className={`w-3 h-3 transition-transform ${showText ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showText ? 'Hide' : 'Show'} transcript
          </button>

          {showText && (
            <p className={`text-sm leading-relaxed pt-1 ${
              role === 'user'
                ? 'text-white/90'
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              {transcript}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
