import { spotifyJson } from "../client.js";
import type { SpotifyDevice } from "../types.js";

export async function getDevices(): Promise<SpotifyDevice[]> {
  const data = await spotifyJson<{ devices: SpotifyDevice[] }>("/me/player/devices");
  return data.devices;
}

export class NoActiveDeviceError extends Error {
  constructor() {
    super("No Spotify device found. Open Spotify on your phone or connect to your car via Spotify Connect, then try again.");
    this.name = "NoActiveDeviceError";
  }
}

export class AmbiguousDeviceError extends Error {
  constructor(public deviceNames: string[]) {
    super(`Multiple Spotify devices found (${deviceNames.join(", ")}) and none is active. Specify which one to use.`);
    this.name = "AmbiguousDeviceError";
  }
}

export class DeviceNotFoundError extends Error {
  constructor(public requested: string, public available: string[]) {
    super(`No device matching "${requested}" found. Available devices: ${available.join(", ") || "none"}.`);
    this.name = "DeviceNotFoundError";
  }
}

/**
 * Resolves which device_id a playback-affecting call should target, per the
 * active-device discovery rules: prefer an explicitly requested device name,
 * then the currently active device, then the sole available device, and
 * otherwise ask the caller to disambiguate.
 */
export async function resolveTargetDeviceId(deviceName?: string): Promise<string | undefined> {
  const devices = await getDevices();

  if (deviceName) {
    const match = devices.find((d) => d.name.toLowerCase().includes(deviceName.toLowerCase()));
    if (!match) {
      throw new DeviceNotFoundError(deviceName, devices.map((d) => d.name));
    }
    return match.id ?? undefined;
  }

  if (devices.length === 0) {
    throw new NoActiveDeviceError();
  }

  const active = devices.find((d) => d.is_active);
  if (active) {
    return active.id ?? undefined;
  }

  if (devices.length === 1) {
    return devices[0].id ?? undefined;
  }

  throw new AmbiguousDeviceError(devices.map((d) => d.name));
}
