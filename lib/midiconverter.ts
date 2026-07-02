import { ExerciseSchema } from "@/types/entities";
import { Action } from "../types/actions";
import type { Loop, State, Tick, Track } from "../types/instance";
import { logger } from "./logger";
import type { Midi } from "@tonejs/midi";
import type { Note } from "@tonejs/midi/dist/Note";
import {
  getFamilyFromInstrumentNumber,
  MidiInstrumentFamily,
  MidiInstrumentNumber,
} from "../types/instruments";
import { MMAGrooveTitle } from "@/lib/generated/prisma/enums";

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

export function addLoopsToMidi(midi: Midi, state: State) {
  const durationTicks = midi.durationTicks.valueOf();
  for (let loopIdx = 0; loopIdx <= state.config.repeats; loopIdx++) {
    for (const track of midi.tracks) {
      const notesNumber = track.notes.length.valueOf();
      for (let noteIdx = 0; noteIdx <= notesNumber; noteIdx++) {
        const refferedNote = track.notes[noteIdx];
        track.addNote({ ...refferedNote, ticks: refferedNote.ticks + durationTicks * loopIdx });
      }
    }
  }
}

// Hiérarchie des familles : index plus bas = priorité plus haute
export const FAMILY_HIERARCHY: MidiInstrumentFamily[] = [
  MidiInstrumentFamily.Piano,
  MidiInstrumentFamily.Guitar,
  MidiInstrumentFamily.SynthLead,
  MidiInstrumentFamily.Organ,
  MidiInstrumentFamily.Bass,
  MidiInstrumentFamily.Strings,
  MidiInstrumentFamily.Ensemble,
  MidiInstrumentFamily.Brass,
  MidiInstrumentFamily.Reed,
  MidiInstrumentFamily.Pipe,
  MidiInstrumentFamily.ChromaticPercussion,
  MidiInstrumentFamily.SynthPad,
  MidiInstrumentFamily.SynthEffects,
  MidiInstrumentFamily.Ethnic,
  MidiInstrumentFamily.Percussive,
  MidiInstrumentFamily.SoundEffects,
];

export function getFamilyPriority(family: MidiInstrumentFamily): number {
  const idx = FAMILY_HIERARCHY.indexOf(family);
  return idx === -1 ? FAMILY_HIERARCHY.length : idx;
}

export function resolveCurrentTrackId(tracks: Track[]): MidiInstrumentNumber {
  if (tracks.length === 0) return 0 as MidiInstrumentNumber;

  return tracks.reduce((best, track) => {
    const bestPriority = getFamilyPriority(best.family);
    const trackPriority = getFamilyPriority(track.family);

    if (trackPriority < bestPriority) return track;
    if (trackPriority === bestPriority && track.data.noteCount > best.data.noteCount) return track;
    return best;
  }).id;
}

export function convertMidiFileToState(
  file: Midi,
  exercise: ExerciseSchema,
  previousState?: State,
  groove?: MMAGrooveTitle
): State {
  file.header.setTempo(exercise.defaultConfig.bpm);

  const tracks = getTracks(file);
  remapMidiFileChannels(file, tracks);
  const userChannel = getUserChannel(tracks);

  const currentTrackId = resolveCurrentTrackId(tracks);

  return {
    config: {
      bpm: previousState?.config.bpm ?? exercise.defaultConfig.bpm,
      ppq: file.header.ppq,
      signature: [
        exercise.defaultConfig.timeSignatureTop,
        exercise.defaultConfig.timeSignatureBottom,
      ],
      subdivision: [1, 128],
      loop: previousState?.config.loop ?? extractLoop(file),
      bpmPractice: previousState?.config.bpmPractice ?? 0,
      countIn: previousState?.config ? previousState?.config.countIn : true,
      currentMeasureOverline: previousState?.config.currentMeasureOverline
        ? previousState?.config.currentMeasureOverline
        : true,
      repeats: previousState?.config.repeats ?? 0,
      transposition: previousState?.config.transposition ?? 0,
      transpositionPractice: previousState?.config.transpositionPractice ?? 0,
      displayGuitarDiagrams: previousState?.config.displayGuitarDiagrams ?? false,
      displayPianoDiagrams: previousState ? previousState.config.displayPianoDiagrams : true,
      groove: groove ?? exercise.defaultConfig.groove,
      userInputChannel: userChannel,
    },
    transport: previousState?.transport ?? {
      start: 0,
      totalDuration: file.durationTicks,
      status: "paused",
      playbackPosition: 0,
      currentMeasureIndex: 0,
    },
    display: previousState?.display ?? {
      zoomY: 50,
    },
    currentTrackId,
    queuedActions: new Set([Action.INITIALIZE_STATE]),
    tracks,
    rawMidiBuffer: file.toArray(),
    measuresStarts: extractBarTickMap(file),
  };
}

function getTracks(file: Midi): Track[] {
  const tracksByInstrument = new Map<
    number,
    {
      instrumentNumber: MidiInstrumentNumber;
      family: MidiInstrumentFamily;
      notes: Note[];
      channel: number;
    }
  >();
  const DRUM_CHANNEL = 9;

  for (const track of file.tracks) {
    const isDrum = track.channel === DRUM_CHANNEL;

    const instrumentNumber = isDrum
      ? MidiInstrumentNumber.Percussions
      : (track.instrument.number as MidiInstrumentNumber);
    const family = isDrum
      ? MidiInstrumentFamily.Percussive
      : getFamilyFromInstrumentNumber(instrumentNumber);

    if (tracksByInstrument.has(instrumentNumber)) {
      tracksByInstrument.get(instrumentNumber)!.notes.push(...track.notes);
    } else {
      tracksByInstrument.set(instrumentNumber, {
        instrumentNumber,
        family,
        notes: [...track.notes],
        channel: track.channel,
      });
    }
  }

  return Array.from(tracksByInstrument.values()).flatMap(
    ({ instrumentNumber, family, notes, channel }) => {
      const filtered = filterNotes(notes);
      filtered.sort((a, b) => a.ticks - b.ticks);

      if (filtered.length <= 0) return [];
      return {
        id: instrumentNumber,
        family,
        channel,
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
      } satisfies Track;
    }
  );
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

function extractBarTickMap(midi: Midi): Map<number, Tick[]> {
  const map = new Map<number, Tick[]>();

  for (const event of midi.header.meta) {
    const match = event.text.match(/Bar_(\d+)/);
    if (match) {
      const barNumber = parseInt(match[1], 10);
      const existing = map.get(barNumber);
      map.set(barNumber, existing ? [...existing, event.ticks] : [event.ticks]);
    }
  }
  return map;
}

function extractLoop(midi: Midi): Loop | null {
  const loopStart = midi.header.meta.find((event) => event.text === "LoopStart");
  const loopEnd = midi.header.meta.find((event) => event.text === "LoopEnd");

  if (loopStart && loopEnd) {
    const loop = {
      currentRepeatIndex: 0,
      start: loopStart.ticks,
      end: loopEnd.ticks,
    };
    logger.info("Loop found: ", loop);
    return loop;
  } else {
    return null;
  }
}

function remapMidiFileChannels(file: Midi, tracks: Track[]): void {
  // Map instrumentNumber → channel décidé
  const channelByInstrument = new Map<number, number>(tracks.map((t) => [t.id, t.channel]));

  const DRUM_CHANNEL = 9;

  for (const midiTrack of file.tracks) {
    const isDrum = midiTrack.channel === DRUM_CHANNEL;
    const instrumentNumber = isDrum
      ? MidiInstrumentNumber.Percussions
      : (midiTrack.instrument.number as MidiInstrumentNumber);

    const targetChannel = channelByInstrument.get(instrumentNumber);
    if (targetChannel === undefined) continue;

    // Mute les notes de cette track vers le bon channel
    for (const note of midiTrack.notes) {
      (note as any).channel = targetChannel;
    }

    // Idem pour les autres events (controlChange, pitchBend, etc.)
    midiTrack.channel = targetChannel;
  }
}

function getUserChannel(tracks: Track[]) {
  let channel = 0;
  let allChannels = tracks.map((t) => t.channel);
  while (allChannels.includes(channel)) {
    channel++;
  }
  return channel;
}
