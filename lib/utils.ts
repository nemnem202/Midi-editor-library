import type { State } from "../types/instance";

export function areUint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}

export function cloneState(state: State): State {
  return {
    ...state,
    config: { ...state.config },
    transport: { ...state.transport },
    tracks: state.tracks.map((track) => ({
      ...track,
      data: {
        ...track.data,
        midiValues: new Uint8Array(track.data.midiValues),
        selectedNotes: new Uint8Array(track.data.selectedNotes),
        velocities: new Uint8Array(track.data.velocities),
        startTicks: new Uint32Array(track.data.startTicks),
        durationInTicks: new Uint32Array(track.data.durationInTicks),
      },
    })),
  };
}

export function getSubdivisionTickInterval(ppq: number, resolution: [number, number]) {
  return (resolution[0] / resolution[1]) * ppq * 4;
}

export function getNearestSubdivisionRoundedTick(
  ppq: number,
  resolution: [number, number],
  tick: number,
  magnetism = true,
): number {
  if (!magnetism) {
    return tick;
  }
  const interval = getSubdivisionTickInterval(ppq, resolution);
  return Math.round(tick / interval) * interval;
}

export function grayFromScale(value: number): string {
  value = Math.min(10000, Math.max(0, value));

  const gray = Math.round((value / 10000) * 255);

  const hexGray = gray.toString(16).padStart(2, "0");
  return `#${hexGray}${hexGray}${hexGray}`;
}

export function colorFromValue(value: number, whitenPercent: number = 0): string {
  value = Math.max(0, value);

  let hue = (value * 137.508) % 360;

  const saturation = 95;
  const baseLightness = 55;

  // --- Exclusion du rouge (zone 340°–360° et 0°–20°) ---
  const RED_MIN = 340;
  const RED_MAX = 20;

  if (hue >= RED_MIN || hue <= RED_MAX) {
    // On pousse vers la limite la plus proche
    hue = hue <= 180 ? RED_MAX : RED_MIN;
  }

  // Clamp whiten
  const whiten = Math.min(Math.max(whitenPercent, 0), 100);

  // Interpolation vers blanc
  const lightness = baseLightness + (100 - baseLightness) * (whiten / 100);

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
