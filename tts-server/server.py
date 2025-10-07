#!/usr/bin/env python3
"""
ChatterBox TTS API Server
Simple FastAPI server for voice cloning and TTS generation
"""

import os
import tempfile
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import soundfile as sf
import uvicorn

try:
    import torchaudio as ta
    from chatterbox.tts import ChatterboxTTS
    CHATTERBOX_AVAILABLE = True
except ImportError:
    CHATTERBOX_AVAILABLE = False
    print("ERROR: Chatterbox TTS not available. Install with: pip install chatterbox-tts")

try:
    from scipy import signal
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    print("WARNING: SciPy not available - audio resampling will be limited")


app = FastAPI(title="ChatterBox TTS API", version="1.0.0")

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global TTS model instance
tts_model = None
VOICES_DIR = Path("./voices")
VOICES_DIR.mkdir(exist_ok=True)


def convert_to_voice_format(audio_data, original_sr, target_sample_rate=24000):
    """
    Convert audio to proper format for ChatterBox voice cloning
    - Mono audio
    - 24kHz sample rate
    - Normalized amplitude
    """
    # Convert to mono if stereo
    if len(audio_data.shape) > 1:
        audio_data = np.mean(audio_data, axis=1)

    # Resample if needed
    if original_sr != target_sample_rate and SCIPY_AVAILABLE:
        ratio = target_sample_rate / original_sr
        num_samples = int(len(audio_data) * ratio)
        audio_data = signal.resample(audio_data, num_samples)

    # Normalize audio (0.85 peak to avoid clipping)
    peak = np.max(np.abs(audio_data))
    if peak > 0:
        audio_data = audio_data * (0.85 / peak)

    return audio_data


@app.on_event("startup")
async def startup_event():
    """Initialize ChatterBox TTS model on startup"""
    global tts_model

    if not CHATTERBOX_AVAILABLE:
        print("ERROR: ChatterBox TTS not available!")
        return

    print("Loading ChatterBox TTS model...")
    try:
        tts_model = ChatterboxTTS.from_pretrained(device="cuda")
        print("✓ ChatterBox TTS model loaded successfully")
    except Exception as e:
        print(f"✗ Failed to load ChatterBox TTS model: {e}")
        print("  Trying CPU fallback...")
        try:
            tts_model = ChatterboxTTS.from_pretrained(device="cpu")
            print("✓ ChatterBox TTS model loaded on CPU")
        except Exception as e2:
            print(f"✗ Failed to load on CPU: {e2}")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "model_loaded": tts_model is not None,
        "chatterbox_available": CHATTERBOX_AVAILABLE
    }


@app.post("/upload-voice")
async def upload_voice(
    file: UploadFile = File(...),
    voice_name: str = Form(...)
):
    """
    Upload and convert a voice sample for cloning
    Accepts: WAV, MP3, OGG, FLAC
    Returns: Processed voice file path
    """
    if not tts_model:
        raise HTTPException(status_code=503, detail="TTS model not loaded")

    # Save uploaded file temporarily
    temp_input = tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix)
    try:
        content = await file.read()
        temp_input.write(content)
        temp_input.close()

        # Read and convert audio
        audio_data, original_sr = sf.read(temp_input.name)
        converted_audio = convert_to_voice_format(audio_data, original_sr, target_sample_rate=24000)

        # Save converted voice
        output_path = VOICES_DIR / f"{voice_name}.wav"
        sf.write(output_path, converted_audio, 24000)

        duration = len(converted_audio) / 24000

        return {
            "success": True,
            "voice_name": voice_name,
            "path": str(output_path),
            "duration_seconds": round(duration, 2),
            "sample_rate": 24000
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process voice: {str(e)}")

    finally:
        # Clean up temp file
        if os.path.exists(temp_input.name):
            os.unlink(temp_input.name)


@app.post("/generate")
async def generate_tts(
    text: str = Form(...),
    voice_name: str = Form(None),
    exaggeration: float = Form(0.2),
    cfg_weight: float = Form(0.8)
):
    """
    Generate TTS audio with optional voice cloning

    Parameters:
    - text: Text to synthesize
    - voice_name: Optional voice to clone (must be uploaded first)
    - exaggeration: Emotion exaggeration (0.0 to 1.0)
    - cfg_weight: Classifier-free guidance weight (0.0 to 1.0)
    """
    if not tts_model:
        raise HTTPException(status_code=503, detail="TTS model not loaded")

    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        # Get voice reference if specified
        reference_voice = None
        if voice_name:
            voice_path = VOICES_DIR / f"{voice_name}.wav"
            if not voice_path.exists():
                raise HTTPException(status_code=404, detail=f"Voice '{voice_name}' not found")
            reference_voice = str(voice_path)

        # Generate TTS
        if reference_voice:
            wav = tts_model.generate(
                text,
                audio_prompt_path=reference_voice,
                exaggeration=exaggeration,
                cfg_weight=cfg_weight
            )
        else:
            wav = tts_model.generate(
                text,
                exaggeration=exaggeration,
                cfg_weight=cfg_weight
            )

        # Save output
        output_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        ta.save(output_file.name, wav, tts_model.sr)
        output_file.close()

        return FileResponse(
            output_file.name,
            media_type="audio/wav",
            filename="generated_audio.wav",
            background=None  # Keep file until response is sent
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate TTS: {str(e)}")


@app.get("/voices")
async def list_voices():
    """List all available voices"""
    voices = []
    for voice_file in VOICES_DIR.glob("*.wav"):
        try:
            audio_data, sr = sf.read(voice_file)
            duration = len(audio_data) / sr
            voices.append({
                "name": voice_file.stem,
                "duration_seconds": round(duration, 2),
                "sample_rate": sr
            })
        except:
            pass

    return {"voices": voices}


@app.delete("/voices/{voice_name}")
async def delete_voice(voice_name: str):
    """Delete a voice sample"""
    voice_path = VOICES_DIR / f"{voice_name}.wav"

    if not voice_path.exists():
        raise HTTPException(status_code=404, detail=f"Voice '{voice_name}' not found")

    try:
        voice_path.unlink()
        return {"success": True, "message": f"Voice '{voice_name}' deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete voice: {str(e)}")


if __name__ == "__main__":
    print("Starting ChatterBox TTS API Server...")
    print("=" * 50)

    if not CHATTERBOX_AVAILABLE:
        print("ERROR: ChatterBox TTS not installed!")
        print("Install with: pip install chatterbox-tts")
        exit(1)

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=5000,
        log_level="info"
    )
