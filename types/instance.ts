import type { InstrumentJSON } from "@tonejs/midi/dist/Instrument";
import type { Action } from "./actions";
import type { TrackJSON } from "@tonejs/midi";
import { MidiInstrumentFamily, MidiInstrumentNumber } from "./instruments";
import { Chord } from "@/types/music";
import { MMAGrooveName } from "@/types/mma";
import { MMAGrooveTitle } from "@/lib/generated/prisma/enums";

export type Bpm = number;
export type Signature = [number, number];
export type Subdivision = [number, number];
export type PPQ = number;

export type MidiValues = Uint8Array;
export type StartTicks = Uint32Array;
export type DurationsInTicks = Uint32Array;
export type SelectedNotes = Uint8Array;
export type Velocities = Uint8Array;

export type NoteIndex = number;

export type Pitch = number;
export type Tick = number;
export type Velocity = number;

export interface Config {
  bpm: Bpm;
  signature: Signature;
  subdivision: Subdivision;
  ppq: PPQ;
  countIn: boolean;
  transposition: number;
  repeats: number;
  bpmPractice: number;
  transpositionPractice: number;
  currentMeasureOverline: boolean;
  loop: Loop | null;
  displayPianoDiagrams: boolean;
  displayGuitarDiagrams: boolean;
  groove: MMAGrooveTitle;
  userInputChannel: number;
}

export interface Loop {
  start: Tick;
  end: Tick;
  currentRepeatIndex: number;
}

export type TransportStatus = "playing" | "paused" | "reset";

export interface Transport {
  start: Tick;
  playbackPosition: Tick;
  currentMeasureIndex: number;
  totalDuration: Tick;
  status: TransportStatus;
}

export type TrackId = number;

export interface Track {
  id: MidiInstrumentNumber;
  data: MidiData;
  family: MidiInstrumentFamily;
  channel: TrackJSON["channel"];
  volume: number;
  muted: boolean;
}

export interface MidiData {
  noteCount: number;
  capacity: number;
  pitches: Uint8Array;
  startTicks: Uint32Array;
  durations: Uint32Array;
  velocities: Uint8Array;
  selectedNotes: Uint8Array;
}

export interface Display {
  zoomY: number;
}

export interface State {
  tracks: Track[];
  currentTrackId: MidiInstrumentNumber;
  config: Config;
  transport: Transport;
  display: Display;
  queuedActions: Set<Action>;
  rawMidiBuffer: Uint8Array;
  measuresStarts: Map<number, Tick[]>;
}

export interface TrackedHistoryState {
  tracks: Track[];
  currentTrackId: MidiInstrumentNumber;
  config: Config;
  queuedActions: Set<Action>;
}
