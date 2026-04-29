import type { Loop, Transport, Tick } from "../types/instance";

export function setTransportStart(transport: Transport, start: Tick) {
  transport.start = start;
}

export function setLoop(transport: Transport, loop: Loop | null) {
  transport.loop = loop;
}

export function setTotalDuration(transport: Transport, total: Tick) {
  transport.totalDuration = total;
}

export function togglePlay(transport: Transport) {
  transport.isPlaying = !transport.isPlaying;
}

export function setTracklistPosition(transport: Transport, position: Tick) {
  transport.playbackPosition = position;
}
