# ChatterBox TTS Server

Simple FastAPI server for voice cloning and text-to-speech using ChatterBox

**NOT CURRENTLY IN USE. WILL PROBABLY BE DELETED**

## Setup

1. **Install Python 3.11+**
2. **Install dependencies:**
   ```bash
   cd tts-server
   pip install -r requirements.txt
   ```

3. **Run the server:**
   ```bash
   python server.py
   ```

Server will start on `http://localhost:5000`

## API Endpoints

### `POST /upload-voice`
Upload a voice sample for cloning.

**Form Data:**
- `file`: Audio file (WAV, MP3, OGG, FLAC)
- `voice_name`: Name for this voice

**Example:**
```bash
curl -X POST http://localhost:5000/upload-voice \
  -F "file=@voice_sample.wav" \
  -F "voice_name=character_1"
```

### `POST /generate`
Generate TTS audio.

**Form Data:**
- `text`: Text to synthesize (required)
- `voice_name`: Voice to clone (optional)
- `exaggeration`: Emotion exaggeration 0.0-1.0 (default: 0.2)
- `cfg_weight`: Guidance weight 0.0-1.0 (default: 0.8)

**Example:**
```bash
curl -X POST http://localhost:5000/generate \
  -F "text=Hello, this is a test message" \
  -F "voice_name=character_1" \
  --output output.wav
```

### `GET /voices`
List all uploaded voices.

### `DELETE /voices/{voice_name}`
Delete a voice sample.

## Integration with Node.js Backend

Your Node.js backend should proxy requests to this server:

```javascript
// In your Node.js backend
app.post('/api/tts/generate', async (req, res) => {
  const { text, characterId } = req.body;

  const formData = new FormData();
  formData.append('text', text);
  formData.append('voice_name', characterId);

  const response = await fetch('http://localhost:5000/generate', {
    method: 'POST',
    body: formData
  });

  const audioBuffer = await response.arrayBuffer();
  res.set('Content-Type', 'audio/wav');
  res.send(Buffer.from(audioBuffer));
});
```

## Voice File Requirements

- **Format**: Automatically converted to 24kHz mono WAV
- **Duration**: Longer samples (10+ seconds) work best
- **Quality**: Clear audio with minimal background noise
