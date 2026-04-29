import type { InstrumentJSON } from "@tonejs/midi/dist/Instrument";
import type { State, Track } from "../types/instance";
import { logger } from "./logger";
import type { Midi } from "@tonejs/midi";
import type { Note } from "@tonejs/midi/dist/Note";

export async function getMidiFile(url: string): Promise<Midi> {
  const { Midi } = await import("@tonejs/midi");
  const midi = await Midi.fromUrl(url);
  logger.info("Converted");
  return midi;
}

export async function getMidiFileFromBuffer(data: any): Promise<Midi> {
  const { Midi } = await import("@tonejs/midi");

  let finalBuffer: Uint8Array;

  if (data instanceof Uint8Array) {
    finalBuffer = data;
  } else if (data instanceof ArrayBuffer) {
    finalBuffer = new Uint8Array(data);
  } else {
    const values = Object.values(data) as number[];
    finalBuffer = new Uint8Array(values);
  }

  try {
    const midi = new Midi(finalBuffer);
    logger.info("Converted from Buffer");
    return midi;
  } catch (e) {
    logger.error("Failed to parse MIDI binary data", e);
    throw e;
  }
}
export function convertMidiFileToState(file: Midi): State {
  const ts = file.header.timeSignatures[0].timeSignature;

  const tracks = getTracks(file);
  return {
    config: {
      bpm: file.header.tempos[0].bpm,
      ppq: file.header.ppq,
      signature: [ts[0], ts[1]],
      subdivision: [1, 128],
    },
    transport: {
      loop: null,
      start: 0,
      totalDuration: file.durationTicks,
      isPlaying: false,
      tracklistPosition: 0,
      currentMeasureIndex: 0,
    },
    currentTrackId: 2,
    queuedActions: new Set(),
    tracks: tracks.map((track, index) => ({
      ...track,
      id: index,
    })),
    rawMidiBuffer: file.toArray(),
  };
}

function getTracks(file: Midi): Track[] {
  const allInstrumentsFamilies = new Set<InstrumentJSON["family"]>();

  file.tracks.forEach((track) => {
    allInstrumentsFamilies.add(track.instrument.family);
  });

  const tracks: Track[] = [];

  allInstrumentsFamilies.forEach((family) => {
    let trackNotes = file.tracks.flatMap((track) => {
      if (track.instrument.family === family) return track.notes;
      return [];
    });

    const finalNotes = filterNotes(trackNotes);

    trackNotes = finalNotes;

    tracks.push({
      instrumentFamily: family,
      id: 0,
      data: {
        capacity: trackNotes.length * 2,
        noteCount: trackNotes.length,
        midiValues: new Uint8Array(trackNotes.map((n) => n.midi)),
        selectedNotes: new Uint8Array(trackNotes.length),
        velocities: new Uint8Array(trackNotes.map((n) => Math.round(n.velocity * 100))),
        startTicks: new Uint32Array(trackNotes.map((n) => n.ticks)),
        durationInTicks: new Uint32Array(trackNotes.map((n) => n.durationTicks)),
      },
    });
  });

  return tracks;
}

function filterNotes(trackNotes: Note[]) {
  const notesByPitch: Record<number, typeof trackNotes> = {};
  trackNotes.forEach((n) => {
    if (!notesByPitch[n.midi]) notesByPitch[n.midi] = [];
    notesByPitch[n.midi].push(n);
  });

  const finalNotes: typeof trackNotes = [];

  Object.values(notesByPitch).forEach((notes) => {
    notes.sort((a, b) => a.ticks - b.ticks || b.durationTicks - a.durationTicks);

    if (notes.length === 0) return;

    let current = notes[0];

    for (let i = 1; i < notes.length; i++) {
      const next = notes[i];
      const currentEnd = current.ticks + current.durationTicks;
      const nextEnd = next.ticks + next.durationTicks;

      if (current.ticks === next.ticks) {
        continue;
      }

      if (currentEnd >= nextEnd) {
        continue;
      }

      if (currentEnd >= next.ticks) {
        const newDuration = next.ticks - current.ticks - 1;
        current.durationTicks = Math.max(0, newDuration);
      }

      finalNotes.push(current);
      current = next;
    }

    finalNotes.push(current);
  });

  return finalNotes;
}
