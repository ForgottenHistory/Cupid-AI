import { useState, useEffect } from 'react';
import api from '../services/api';

const VoiceLibrary = () => {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [voiceName, setVoiceName] = useState('');
  const [testingVoice, setTestingVoice] = useState(null);

  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tts/voices');
      setVoices(response.data.voices || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load voices:', err);
      setError('Failed to load voices. Make sure the TTS server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Auto-fill voice name from filename (without extension)
      if (!voiceName) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setVoiceName(nameWithoutExt);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !voiceName.trim()) {
      setError('Please select a file and enter a voice name');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('voice_name', voiceName.trim());

      await api.post('/tts/upload-voice', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Reset form
      setSelectedFile(null);
      setVoiceName('');
      document.getElementById('voice-file-input').value = '';

      // Reload voices
      await loadVoices();
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.error || 'Failed to upload voice');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (voiceName) => {
    if (!confirm(`Delete voice "${voiceName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/tts/voices/${voiceName}`);
      await loadVoices();
    } catch (err) {
      console.error('Delete failed:', err);
      setError(err.response?.data?.error || 'Failed to delete voice');
    }
  };

  const handleTestVoice = async (voiceName) => {
    try {
      setTestingVoice(voiceName);
      setError(null);

      // Generic test text
      const testText = "Hey there! This is a test of my voice. How does it sound? I'm excited to chat with you!";

      // Generate TTS
      const response = await api.post('/tts/generate', {
        text: testText,
        voice_name: voiceName,
        exaggeration: 0.2,
        cfg_weight: 0.8
      });

      // Get audio URL from response
      const audioPath = response.data.audio_url;
      if (!audioPath) {
        throw new Error('No audio URL returned');
      }

      // Build full URL
      const fullUrl = `http://localhost:3000${audioPath}`;

      // Create audio context for effects
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Fetch and decode audio
      const audioBuffer = await fetch(fullUrl)
        .then(res => res.arrayBuffer())
        .then(buffer => audioContext.decodeAudioData(buffer));

      // Create source
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

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

      // Connect nodes (no distortion, just soft filtering)
      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Play
      source.start(0);
    } catch (err) {
      console.error('Failed to test voice:', err);
      setError(err.response?.data?.error || 'Failed to test voice');
    } finally {
      setTestingVoice(null);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-purple-100/50 dark:border-gray-700/50">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            Voice Library
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Upload and manage voice samples for character voice messaging
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Upload Form */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-purple-100/50 dark:border-gray-700/50 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Upload Voice Sample</h2>

          <div className="space-y-4">
            {/* Voice Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Voice Name
              </label>
              <input
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder="e.g., character_name"
                className="w-full px-4 py-2 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
              />
            </div>

            {/* File Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Audio File (WAV, MP3, OGG, FLAC)
              </label>
              <input
                id="voice-file-input"
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="w-full px-4 py-2 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-pink-500 file:to-purple-600 file:text-white file:cursor-pointer hover:file:from-pink-600 hover:file:to-purple-700"
              />
              {selectedFile && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !voiceName.trim()}
              className="w-full px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl disabled:hover:shadow-lg"
            >
              {uploading ? 'Uploading...' : 'Upload Voice'}
            </button>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
            <p>💡 <strong>Tips:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Use clear audio with minimal background noise</li>
              <li>10+ seconds recommended for best quality</li>
              <li>Audio will be automatically converted to 24kHz mono WAV</li>
            </ul>
          </div>
        </div>

        {/* Voice List */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-purple-100/50 dark:border-gray-700/50">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Available Voices</h2>

          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading voices...
            </div>
          ) : voices.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No voices uploaded yet. Upload your first voice sample above!
            </div>
          ) : (
            <div className="space-y-3">
              {voices.map((voice) => (
                <div
                  key={voice.name}
                  className="flex items-center justify-between p-4 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm rounded-xl border border-purple-100/50 dark:border-gray-600/50 hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{voice.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {voice.duration_seconds}s • {voice.sample_rate}Hz
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Test Button */}
                    <button
                      onClick={() => handleTestVoice(voice.name)}
                      disabled={testingVoice === voice.name}
                      className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-medium hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg text-sm"
                      title="Test voice"
                    >
                      {testingVoice === voice.name ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Testing...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                          Test
                        </span>
                      )}
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(voice.name)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg transition-all"
                      title="Delete voice"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceLibrary;
