import pytest
import sys
from unittest.mock import MagicMock

sys.modules['torch'] = MagicMock()
sys.modules['whisper'] = MagicMock()
sys.modules['soundfile'] = MagicMock()
sys.modules['TTS'] = MagicMock()
sys.modules['TTS.api'] = MagicMock()
sys.path.insert(0, 'src')
import numpy as np

from aero.voice.stt import STT
from aero.voice.tts import TTS
from aero.voice.audio_utils import bytes_to_array

def test_stt_mock():
    stt = STT(device="cpu")
    # model is None
    fake_audio = np.zeros(16000, dtype=np.float32)
    result = stt.transcribe(fake_audio)
    assert result == "Mock STT text"

def test_tts_mock():
    tts = TTS()
    # model is None
    result = tts.synthesize("Hello")
    assert result == b"mock_audio_bytes_from_tts"

def test_bytes_to_array():
    # Create a known int16 array
    arr = np.array([0, 16384, -16384, 32767], dtype=np.int16)
    b = arr.tobytes()
    
    result = bytes_to_array(b)
    
    assert result.dtype == np.float32
    # 0 -> 0.0
    # 16384 -> 0.5
    # -16384 -> -0.5
    # 32767 -> ~1.0 (32767/32768)
    assert np.isclose(result[0], 0.0)
    assert np.isclose(result[1], 0.5)
    assert np.isclose(result[2], -0.5)
    assert np.isclose(result[3], 32767.0/32768.0)
