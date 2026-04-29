import type { Loop, Tansport, Tick } from "../types/instance";

export function setTransportStart(transport: Tansport, start: Tick) {
  transport.start = start;
}

export function setLoop(transport: Tansport, loop: Loop | null) {
  transport.loop = loop;
}

export function setTotalDuration(transport: Tansport, total: Tick) {
  transport.totalDuration = total;
}

export function togglePlay(transport: Tansport) {
  transport.isPlaying = !transport.isPlaying;
}

export function setTracklistPosition(transport: Tansport, position: Tick) {
  transport.tracklistPosition = position;
}
