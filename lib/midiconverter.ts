import type { State } from "../types/instance";
import { logger } from "./logger";
import type { Midi } from "@tonejs/midi";

export async function getMidiFile(url: string): Promise<Midi> {
  const { Midi } = await import("@tonejs/midi");
  const midi = await Midi.fromUrl(url);
  logger.info("Converted");
  return midi;
}

export function convertMidiFileToState(file: Midi): State {
  const ts = file.header.timeSignatures[0].timeSignature;
  return {
    config: {
      bpm: file.header.tempos[0].bpm,
      isPlaying: false,
      ppq: file.header.ppq,
      signature: [ts[0], ts[1]],
      subdivision: [1, 128],
    },
    transport: {
      loop: null,
      start: 0,
      totalDuration: file.durationTicks,
      tracklisPosition: 0,
    },
    currentTrackId: 11,
    queuedActions: new Set(),
    tracks: file.tracks.map((track, index) => ({
      id: index,
      data: {
        capacity: track.notes.length * 2,
        noteCount: track.notes.length,
        midiValues: new Uint8Array(track.notes.map((n) => n.midi)),
        selectedNotes: new Uint8Array(track.notes.length),

        velocities: new Uint8Array(track.notes.map((n) => Math.round(n.velocity * 100))),
        startTicks: new Uint32Array(track.notes.map((n) => n.ticks)),
        durationInTicks: new Uint32Array(track.notes.map((n) => n.durationTicks)),
      },
    })),
  };
}
