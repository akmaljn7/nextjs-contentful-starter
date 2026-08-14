/**
 * Connectivity-triggered sync. Registers a NetInfo listener and, the moment
 * the device transitions from offline → online, drains BOTH offline queues
 * (geofence events + live-location fixes). This makes buffered offline data
 * push automatically as soon as the network returns — without the employee
 * having to open the app — for as long as the app process is alive (the
 * location foreground service keeps it alive in the background).
 */
import NetInfo from "@react-native-community/netinfo";
import { drainQueue } from "@/services/syncWorker";
import { drainLocationQueue } from "@/services/liveLocation";
import { drainSelfieDrafts } from "@/services/offlineSelfie";

let unsubscribe: (() => void) | null = null;
let wasConnected = true;

export function startConnectivityWatcher(): void {
  if (unsubscribe) return;
  unsubscribe = NetInfo.addEventListener((state) => {
    const connected = !!state.isConnected && state.isInternetReachable !== false;
    // Fire only on the offline → online edge.
    if (connected && !wasConnected) {
      console.info("[connectivity] network back — draining offline queues");
      drainLocationQueue().catch(() => undefined);
      drainQueue().catch(() => undefined);
      drainSelfieDrafts().catch(() => undefined);
    }
    wasConnected = connected;
  });
}

export function stopConnectivityWatcher(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  wasConnected = true;
}
