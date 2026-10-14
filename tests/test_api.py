import pytest
import sys
from unittest.mock import MagicMock

sys.modules['torch'] = MagicMock()
sys.modules['transformers'] = MagicMock()
sys.modules['whisper'] = MagicMock()
sys.modules['soundfile'] = MagicMock()
sys.modules['TTS'] = MagicMock()
sys.modules['TTS.api'] = MagicMock()
sys.path.insert(0, 'src')
from fastapi.testclient import TestClient
from aero.model.config import config
config.model.load_on_startup = False
from aero.server import app

def test_chat_non_streaming():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/chat",
            json={"message": "Hello", "stream": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "Mock response from AERO: User: Hello" in data["response"]

def test_chat_streaming():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/chat",
            json={"message": "Hello stream", "stream": True}
        )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        content = response.content.decode("utf-8")
        assert "Mock" in content
        assert "stream" in content

def test_session_persistence():
    with TestClient(app) as client:
        session_id = "test-session-123"
        
        # First message
        res1 = client.post(
            "/api/v1/chat",
            json={"message": "First message", "session_id": session_id, "stream": False}
        )
        assert res1.status_code == 200
        
        # Second message
        res2 = client.post(
            "/api/v1/chat",
            json={"message": "Second message", "session_id": session_id, "stream": False}
        )
        assert res2.status_code == 200
        
        # Check context is maintained
        data2 = res2.json()
        # The prompt will contain both "First message" and "Second message"
        assert "First message" in data2["response"]
        assert "Second message" in data2["response"]

def test_get_root():
    with TestClient(app) as client:
        response = client.get("/")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "<html" in response.text
        assert "AERO Assistant" in response.text

def test_get_favicon():
    with TestClient(app) as client:
        response = client.get("/favicon.ico")
        assert response.status_code == 204

def test_get_devices():
    with TestClient(app) as client:
        response = client.get("/api/v1/devices")
        assert response.status_code == 200
        data = response.json()
        assert "devices" in data
        assert "sensors" in data
        devices = data["devices"]
        for key in ["living_room_light", "bedroom_fan", "air_conditioner", "desk_lamp", "smart_plug"]:
            assert key in devices
            assert "state" in devices[key]
        sensors = data["sensors"]
        assert "temperature" in sensors
        assert "humidity" in sensors
        assert "motion" in sensors
        assert sensors["temperature"] == 23.5
        assert sensors["humidity"] == 46

def test_toggle_device():
    with TestClient(app) as client:
        # Toggle living room light to on
        res1 = client.post("/api/v1/devices/toggle", json={"device_id": "living_room_light", "state": "on"})
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["status"] == "success"
        assert data1["device"]["state"] == "on"

        # Toggle living room light to off
        res2 = client.post("/api/v1/devices/toggle", json={"device_id": "living_room_light", "state": "off"})
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["device"]["state"] == "off"

        # Non-existent device
        res3 = client.post("/api/v1/devices/toggle", json={"device_id": "non_existent_gadget"})
        assert res3.status_code == 404

def test_timers_endpoints():
    with TestClient(app) as client:
        # Create timer
        create_res = client.post("/api/v1/timers", json={"label": "Pasta timer", "duration_seconds": 600})
        assert create_res.status_code == 200
        timer = create_res.json()["timer"]
        assert timer["label"] == "Pasta timer"
        assert timer["duration_seconds"] == 600
        timer_id = timer["id"]

        # List active timers
        list_res = client.get("/api/v1/timers")
        assert list_res.status_code == 200
        timers = list_res.json()["timers"]
        assert any(t["id"] == timer_id for t in timers)

        # Delete timer
        del_res = client.delete(f"/api/v1/timers/{timer_id}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "success"

def test_shopping_list_endpoints():
    with TestClient(app) as client:
        # Clear list
        client.delete("/api/v1/lists")
        
        # Add item
        add_res = client.post("/api/v1/lists", json={"item": "organic eggs"})
        assert add_res.status_code == 200
        assert "organic eggs" in add_res.json()["items"]

        # Get list
        get_res = client.get("/api/v1/lists")
        assert get_res.status_code == 200
        assert "organic eggs" in get_res.json()["items"]

def test_smart_home_chat_intents():
    with TestClient(app) as client:
        # 1. Device control intent
        res = client.post("/api/v1/chat", json={"message": "Turn on the living room light", "stream": False})
        assert res.status_code == 200
        assert "turned on the living room light" in res.json()["response"]

        # Check device actually turned on
        dev_res = client.get("/api/v1/devices")
        assert dev_res.json()["devices"]["living_room_light"]["state"] == "on"

        # 2. Temperature intent
        res_temp = client.post("/api/v1/chat", json={"message": "What is the room temperature?", "stream": False})
        assert res_temp.status_code == 200
        assert "23.5 degrees Celsius" in res_temp.json()["response"]

        # 3. Timer intent
        res_timer = client.post("/api/v1/chat", json={"message": "Set a timer for 5 minutes", "stream": False})
        assert res_timer.status_code == 200
        assert "Timer set for 5 minutes" in res_timer.json()["response"]

        # 4. Shopping list intent
        res_list = client.post("/api/v1/chat", json={"message": "Add milk to my shopping list", "stream": False})
        assert res_list.status_code == 200
        assert "added milk to your shopping list" in res_list.json()["response"]

        # 5. Fan control intent
        res_fan = client.post("/api/v1/chat", json={"message": "Turn off the bedroom fan", "stream": False})
        assert res_fan.status_code == 200
        assert "turned off the bedroom fan" in res_fan.json()["response"]

def test_smart_home_chat_streaming():
    with TestClient(app) as client:
        res = client.post("/api/v1/chat", json={"message": "What is the humidity?", "stream": True})
        assert res.status_code == 200
        assert "text/event-stream" in res.headers["content-type"]
        content = res.content.decode("utf-8")
        assert "46 percent" in content


def test_room_scanner_endpoints():
    with TestClient(app) as client:
        # 1. Geometry
        res = client.get("/api/v1/room/geometry")
        assert res.status_code == 200
        data = res.json()
        assert "metrics" in data
        assert data["metrics"]["area"] == 20.0
        assert data["metrics"]["perimeter"] == 18.0
        assert len(data["corners"]) == 4

        # 2. Wi-Fi Heatmap
        res_wifi = client.get("/api/v1/room/wifi_map")
        assert res_wifi.status_code == 200
        wifi_data = res_wifi.json()
        assert "samples" in wifi_data
        assert len(wifi_data["samples"]) > 0
        assert "current_rssi" in wifi_data

        # 3. Drone Waypoints
        res_path = client.get("/api/v1/room/drone_path")
        assert res_path.status_code == 200
        assert "waypoints" in res_path.json()

        # 4. Update Drone Pose
        res_pose = client.post("/api/v1/room/drone_pose", json={"x": 2.0, "y": 1.5, "z": 1.0})
        assert res_pose.status_code == 200
        assert res_pose.json()["drone_pose"]["x"] == 2.0


def test_drone_hardware_endpoints():
    with TestClient(app) as client:
        # Status
        res = client.get("/api/v1/drone/status")
        assert res.status_code == 200
        assert res.json()["ultrasonic_altitude_cm"] == 42.5

        # Motor Test
        res_m = client.post("/api/v1/drone/motor", json={"motor": "1", "throttle_us": 1360})
        assert res_m.status_code == 200
        assert res_m.json()["status"] == "active"

        # Emergency Stop
        res_stop = client.post("/api/v1/drone/stop")
        assert res_stop.status_code == 200
        assert res_stop.json()["all_motors_us"] == 1000


def test_spatial_and_routine_chat_intents():
    with TestClient(app) as client:
        # Room dimensions intent
        res_room = client.post("/api/v1/chat", json={"message": "What is the room size?", "stream": False})
        assert res_room.status_code == 200
        assert "20.0 square meters" in res_room.json()["response"]

        # Wi-Fi intent
        res_wifi = client.post("/api/v1/chat", json={"message": "What is the wifi signal?", "stream": False})
        assert res_wifi.status_code == 200
        assert "dBm" in res_wifi.json()["response"]

        # Routine intent
        res_morning = client.post("/api/v1/chat", json={"message": "Good morning AERO", "stream": False})
        assert res_morning.status_code == 200
        assert "Good morning!" in res_morning.json()["response"]


def test_tts_endpoint():
    with TestClient(app) as client:
        # Check voices list
        res_v = client.get("/api/v1/tts/voices")
        assert res_v.status_code == 200
        assert "voices" in res_v.json()

        # Check synthesis
        res = client.post("/api/v1/tts", json={"text": "Hello, I am AERO."})
        assert res.status_code == 200
        assert "audio/" in res.headers["content-type"]
        assert len(res.content) > 0


def test_vision_endpoints():
    with TestClient(app) as client:
        # 1. Family list
        res = client.get("/api/v1/vision/family")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["total_enrolled"] >= 1
        assert any("Joshua" in m["name"] for m in data["family"])

        # 2. Test sample face
        res_sample = client.post("/api/v1/vision/test_sample", json={"sample_id": "family_1"})
        assert res_sample.status_code == 200
        sample_data = res_sample.json()
        assert sample_data["status"] == "success"
        assert len(sample_data["detections"]) > 0
        first_det = sample_data["detections"][0]
        assert "Joshua" in first_det["name"]
        assert first_det["is_family"] is True
        assert first_det["similarity_score"] > 0.8

        # 3. Vision scan base64 endpoint
        import base64
        # Send empty frame test
        res_empty = client.post("/api/v1/vision/scan", json={"image_base64": ""})
        assert res_empty.status_code == 200
        assert res_empty.json()["status"] == "empty"


def test_vision_chat_intents():
    with TestClient(app) as client:
        # Family list intent
        res = client.post("/api/v1/chat", json={"message": "Who are the family members?", "stream": False})
        assert res.status_code == 200
        assert "Joshua" in res.json()["response"]

        # Camera status intent
        res_cam = client.post("/api/v1/chat", json={"message": "Check camera", "stream": False})
        assert res_cam.status_code == 200
        assert "Camera and biometric vision are active" in res_cam.json()["response"]



