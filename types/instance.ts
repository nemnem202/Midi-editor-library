import type { InstrumentJSON } from "@tonejs/midi/dist/Instrument";
import type { Action } from "./actions";
import type { TrackJSON } from "@tonejs/midi";
import { MidiInstrumentFamily, MidiInstrumentNumber } from "./instruments";

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
}

export interface Loop {
  start: Tick;
  end: Tick;
}

export type TransportStatus = "playing" | "paused" | "reset";

export interface Transport {
  start: Tick;
  playbackPosition: Tick;
  currentMeasureIndex: number;
  loop: Loop | null;
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

export interface State {
  tracks: Track[];
  currentTrackId: MidiInstrumentNumber;
  config: Config;
  transport: Transport;
  queuedActions: Set<Action>;
  rawMidiBuffer: Uint8Array;
  measuresStarts: Map<number, Tick>;
}

export interface TrackedHistoryState {
  tracks: Track[];
  currentTrackId: MidiInstrumentNumber;
  config: Config;
  queuedActions: Set<Action>;
}
