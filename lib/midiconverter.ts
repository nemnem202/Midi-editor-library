import { ExerciseSchema } from "@/types/entities";
import { Action } from "../types/actions";
import type { State, Track } from "../types/instance";
import { logger } from "./logger";
import type { Midi } from "@tonejs/midi";
import type { Note } from "@tonejs/midi/dist/Note";

export async function getMidiFile(url: string): Promise<Midi> {
  const { Midi } = await import("@tonejs/midi");
  const midi = await Midi.fromUrl(url);
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
    return midi;
  } catch (e) {
    logger.error("Failed to parse MIDI binary data", e);
    throw e;
  }
}
export function convertMidiFileToState(file: Midi, exercise: ExerciseSchema): State {
  const ts = file.header.timeSignatures[0].timeSignature;

  const tracks = getTracks(file);
  return {
    config: {
      bpm: exercise.defaultConfig.bpm,
      ppq: file.header.ppq,
      signature: [
        exercise.defaultConfig.timeSignatureTop,
        exercise.defaultConfig.timeSignatureBottom,
      ],
      subdivision: [1, 128],
    },
    transport: {
      loop: null,
      start: 0,
      totalDuration: file.durationTicks,
      status: "paused",
      playbackPosition: 0,
      currentMeasureIndex: 0,
    },
    currentTrackId: 0,
    queuedActions: new Set([Action.RESET_STATE]),
    tracks: tracks.map((track, index) => ({
      ...track,
      id: index,
    })),
    rawMidiBuffer: file.toArray(),
    measuresStarts: extractBarTickMap(file),
  };
}

function getTracks(file: Midi): Track[] {
  const tracksByChannel = new Map<number, { instrument: string; notes: Note[] }>();

  for (const track of file.tracks) {
    const channel = track.channel;

    if (tracksByChannel.has(channel)) {
      tracksByChannel.get(channel)!.notes.push(...track.notes);
    } else {
      tracksByChannel.set(channel, {
        instrument: track.instrument.name,
        notes: [...track.notes],
      });
    }
  }

  return Array.from(tracksByChannel.entries()).map(([channel, { instrument, notes }], index) => {
    const filtered = filterNotes(notes);
    filtered.sort((a, b) => a.ticks - b.ticks);

    return {
      channel,
      instrument,
      id: index,
      muted: false,
      volume: 100,
      data: {
        capacity: filtered.length * 2,
        noteCount: filtered.length,
        pitches: new Uint8Array(filtered.map((n) => n.midi)),
        selectedNotes: new Uint8Array(filtered.length),
        velocities: new Uint8Array(filtered.map((n) => Math.round(n.velocity * 100))),
        startTicks: new Uint32Array(filtered.map((n) => n.ticks)),
        durations: new Uint32Array(filtered.map((n) => n.durationTicks)),
      },
    };
  });
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

    let current = { ...notes[0] };

    for (let i = 1; i < notes.length; i++) {
      const next = { ...notes[i] };
      const currentEnd = current.ticks + current.durationTicks;
      const nextEnd = next.ticks + next.durationTicks;

      if (current.ticks === next.ticks) {
        continue;
      }

      if (currentEnd >= nextEnd) {
        continue;
      }

      if (currentEnd >= next.ticks) {
        current.durationTicks = next.ticks - current.ticks - 1;
        next.durationTicks = nextEnd - next.ticks;
      }

      finalNotes.push(current as any);
      current = next;
    }

    finalNotes.push(current as any);
  });

  return finalNotes;
}

function extractBarTickMap(midi: Midi): Map<number, number> {
  const map = new Map<number, number>();
  for (const event of midi.header.meta) {
    const match = event.text.match(/Bar_(\d+)/);
    if (match) {
      map.set(parseInt(match[1], 10), event.ticks);
    }
  }
  return map;
}
