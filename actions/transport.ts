import type { Loop, Transport, Tick, Config } from "../types/instance";

export function setTransportStart(transport: Transport, start: Tick) {
  transport.start = start;
}

export function setLoop(config: Config, loop: Loop | null) {
  config.loop = loop;
}

export function setTotalDuration(transport: Transport, total: Tick) {
  transport.totalDuration = total;
}

export function setTracklistPosition(transport: Transport, position: Tick) {
  transport.playbackPosition = position;
}
