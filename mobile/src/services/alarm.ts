/**
 * Loud in-app alarm for selfie challenges.
 *
 * A backgrounded push already rings via the MAX-importance "attendance"
 * channel. But when the employee is actively working IN the app, the selfie
 * modal is opened by the data poll with no OS sound — so we raise our own
 * alarm: a looping loud tone + a repeating vibration that keeps going until
 * the selfie is taken or the window expires. This ensures a busy employee
 * notices even with the phone in hand.
 */
import { Audio } from "expo-av";
import { Vibration, Platform } from "react-native";

// Buzz roughly every 1.2s: 600ms on, 600ms off, repeating.
const VIBRATION_PATTERN = [0, 600, 600];

let sound: Audio.Sound | null = null;
let running = false;

export async function startAlarm(): Promise<void> {
  if (running) return;
  running = true;
  // Repeating vibration (second arg = repeat).
  try {
    Vibration.vibrate(VIBRATION_PATTERN, true);
  } catch {
    /* ignore */
  }
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
    });
    const { sound: s } = await Audio.Sound.createAsync(
      require("../../assets/selfie_alert.wav"),
      { shouldPlay: true, isLooping: true, volume: 1.0 },
    );
    sound = s;
    // If startAlarm was cancelled while the sound was loading, stop immediately.
    if (!running) {
      await sound.stopAsync().catch(() => undefined);
      await sound.unloadAsync().catch(() => undefined);
      sound = null;
    }
  } catch {
    /* audio best-effort — vibration still fires */
  }
}

export async function stopAlarm(): Promise<void> {
  running = false;
  try {
    Vibration.cancel();
  } catch {
    /* ignore */
  }
  if (sound) {
    const s = sound;
    sound = null;
    try {
      await s.stopAsync();
    } catch {
      /* ignore */
    }
    try {
      await s.unloadAsync();
    } catch {
      /* ignore */
    }
  }
}
