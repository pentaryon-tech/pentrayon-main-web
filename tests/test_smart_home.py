"""
Unit tests for the Smart Home Skills module.
"""
import pytest
from aero.skills.smart_home import SmartHomeManager


def test_device_initial_state_and_toggle():
    manager = SmartHomeManager()
    devices = manager.get_devices()
    assert "living_room_light" in devices
    assert devices["living_room_light"]["state"] == "off"

    # Toggle on
    updated = manager.toggle_device("living_room_light")
    assert updated["state"] == "on"

    # Toggle off explicitly
    updated2 = manager.toggle_device("living_room_light", state="off")
    assert updated2["state"] == "off"


def test_timer_lifecycle():
    manager = SmartHomeManager()
    # Add timer
    t = manager.add_timer("Oven", 120)
    assert t.label == "Oven"
    assert t.duration_seconds == 120
    assert t.is_active

    active = manager.get_active_timers()
    assert len(active) == 1
    assert active[0]["id"] == t.id

    # Cancel timer
    assert manager.cancel_timer(t.id) is True
    assert len(manager.get_active_timers()) == 0


def test_shopping_list_lifecycle():
    manager = SmartHomeManager()
    manager.clear_shopping_list()
    assert len(manager.get_shopping_list()) == 0

    manager.add_shopping_item("apples")
    manager.add_shopping_item("bananas")
    assert manager.get_shopping_list() == ["apples", "bananas"]

    assert manager.remove_shopping_item("apples") is True
    assert manager.get_shopping_list() == ["bananas"]

    # Removing non-existent item returns False
    assert manager.remove_shopping_item("oranges") is False


def test_dispatch_intents():
    manager = SmartHomeManager()

    # Lights
    resp = manager.dispatch_intent("turn on living room light")
    assert resp == "I've turned on the living room light for you."
    assert manager.devices["living_room_light"].state == "on"

    resp = manager.dispatch_intent("turn off living room light")
    assert resp == "I've turned off the living room light."
    assert manager.devices["living_room_light"].state == "off"

    # Fan
    resp = manager.dispatch_intent("turn on the bedroom fan")
    assert resp == "I've turned on the bedroom fan."
    assert manager.devices["bedroom_fan"].state == "on"

    # AC
    resp = manager.dispatch_intent("turn on the air conditioner")
    assert resp == "I've turned on the air conditioner."
    assert manager.devices["air_conditioner"].state == "on"

    # Desk lamp
    resp = manager.dispatch_intent("turn on desk lamp")
    assert resp == "I've turned on the desk lamp for you."
    assert manager.devices["desk_lamp"].state == "on"

    # Smart plug
    resp = manager.dispatch_intent("turn on smart plug")
    assert resp == "I've turned on the smart plug."
    assert manager.devices["smart_plug"].state == "on"

    # Temperature
    resp = manager.dispatch_intent("what's the temperature?")
    assert "23.5 degrees Celsius" in resp

    # Humidity
    resp = manager.dispatch_intent("what is the humidity?")
    assert "46 percent" in resp

    # Motion
    resp = manager.dispatch_intent("is there any motion?")
    assert "clear" in resp

    # Timers with word numbers
    resp = manager.dispatch_intent("set a timer for five minutes")
    assert "Timer set for 5 minutes" in resp

    # Compound timer
    resp = manager.dispatch_intent("set a timer for 1 minute and 30 seconds")
    assert "Timer set for 1 minute and 30 seconds" in resp

    # Alarm intent
    resp = manager.dispatch_intent("set an alarm for 7 am")
    assert "Alarm set for 7 am" in resp

    # Check timers
    resp = manager.dispatch_intent("how much time is left on my timer")
    assert "left on your timer" in resp

    # Cancel timer
    resp = manager.dispatch_intent("cancel timer")
    assert "cancelled your timer" in resp

    # Shopping list
    resp = manager.dispatch_intent("add blueberries to my shopping list")
    assert "added blueberries" in resp
    assert "blueberries" in manager.get_shopping_list()

    resp = manager.dispatch_intent("what's on my shopping list")
    assert "blueberries" in resp

    # Alternative list query
    resp = manager.dispatch_intent("what is on my todo list")
    assert "blueberries" in resp

    resp = manager.dispatch_intent("clear my shopping list")
    assert "cleared your shopping list" in resp
    assert len(manager.get_shopping_list()) == 0

    # Device property controls
    resp = manager.dispatch_intent("set ac to 24")
    assert "set the air conditioner to 24 degrees" in resp
    assert manager.devices["air_conditioner"].temp_target == 24
    assert manager.devices["air_conditioner"].state == "on"

    resp = manager.dispatch_intent("set fan speed to 3")
    assert "set the bedroom fan speed to 3" in resp
    assert manager.devices["bedroom_fan"].speed == 3
    assert manager.devices["bedroom_fan"].state == "on"

    resp = manager.dispatch_intent("dim desk lamp to 40 percent")
    assert "Desk Lamp brightness to 40 percent" in resp
    assert manager.devices["desk_lamp"].brightness == 40
    assert manager.devices["desk_lamp"].state == "on"

    # All lights on/off
    resp = manager.dispatch_intent("turn on all lights")
    assert resp == "I've turned on the lights."
    assert manager.devices["living_room_light"].state == "on"
    assert manager.devices["desk_lamp"].state == "on"

    resp = manager.dispatch_intent("turn off the lights")
    assert resp == "I've turned off the lights."
    assert manager.devices["living_room_light"].state == "off"
    assert manager.devices["desk_lamp"].state == "off"

    # Unhandled general question returns None to pass through to LLM
    resp = manager.dispatch_intent("What is the capital of France?")
    assert resp is None
