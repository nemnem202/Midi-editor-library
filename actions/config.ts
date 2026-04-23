import type { Config } from "../types/instance";

export function setBpm(config: Config, bpm: number) {
  config.bpm = bpm;
}

export function setSignature(config: Config, signature: [number, number]) {
  config.signature = signature;
}

export function setSubdivision(config: Config, subdivision: [number, number]) {
  config.subdivision = subdivision;
}

export function togglePlay(config: Config) {
  config.isPlaying = !config.isPlaying;
}
