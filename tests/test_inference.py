import pytest
import sys
from unittest.mock import MagicMock

sys.modules['torch'] = MagicMock()
sys.modules['transformers'] = MagicMock()
sys.path.insert(0, 'src')
from aero.model.inference import InferenceModel

def test_inference_model_generate_mock():
    model = InferenceModel(model_id="mock-model", device="cpu")
    # model.model is None by default
    result = model.generate("Hello")
    assert "Hello" in result
    assert result == "Mock response from AERO: Hello"

def test_inference_model_generate_stream_mock():
    model = InferenceModel(model_id="mock-model", device="cpu")
    chunks = list(model.generate_stream("Hello"))
    assert len(chunks) > 1
    assert "Hello " in chunks
    assert "Mock " in chunks
