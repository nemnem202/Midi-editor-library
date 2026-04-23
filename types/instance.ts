import type { Action } from "./actions";

export type Bpm = number;
export type Signature = [number, number];
export type Subdivision = [number, number];
export type PPQ = number;
export type Tick = number;

export type MidiValues = Uint8Array;
export type StartTicks = Uint32Array;
export type DurationsInTicks = Uint32Array;
export type SelectedNotes = Uint8Array;
export type Velocities = Uint8Array;

export type NoteIndex = number;

export interface Config {
  bpm: Bpm;
  signature: Signature;
  subdivision: Subdivision;
  ppq: PPQ;
  isPlaying: boolean;
}

export interface Loop {
  start: Tick;
  end: Tick;
}

export interface Tansport {
  start: Tick;
  tracklisPosition: Tick;
  loop: Loop | null;
  totalDuration: Tick;
}

export type TrackId = number;

export interface Track {
  id: TrackId;
  data: MidiData;
}

export interface MidiData {
  noteCount: number;
  capacity: number;

  midiValues: Uint8Array;
  startTicks: Uint32Array;
  durationInTicks: Uint32Array;
  velocities: Uint8Array;
  selectedNotes: Uint8Array;
}

export interface State {
  tracks: Track[];
  currentTrackId: TrackId;
  config: Config;
  transport: Tansport;
  queuedActions: Set<Action>;
}

export interface TrackedHistoryState {
  tracks: Track[];
  currentTrackId: TrackId;
  config: Config;
  queuedActions: Set<Action>;
}
