import type { NoteIndex, State, TrackId } from "./instance";

export enum Action {
  RENDER_ALL,

  ADD_NOTE,
  REMOVE_NOTE,
  MOVE_NOTE,
  RESIZE_NOTE,

  SELECT_NOTE,
  SELECT_NOTES,
  UNSELECT_ALL_NOTES,

  MOVE_SELECTED_NOTES,
  RESIZE_SELECTED_NOTES,
  REMOVE_SELECTED_NOTES,
  ADD_NOTES,

  SET_BPM,
  SET_SIGNATURE,
  SET_SUBDIVISION,
  TOGGLE_PLAY,

  SET_TRANSPORT_START,
  SET_LOOP,
  SET_TOTAL_DURATION,
  SET_TRACKLIST_POSITION,

  CHANGE_CURRENT_TRACK,
  ADD_TRACK,
  REMOVE_TRACK,
}

export type MidiAction = (
  | {
      type: Action.ADD_NOTE;
      trackId: TrackId;
      pitch: number;
      start: number;
      duration: number;
      velocity?: number;
    }
  | { type: Action.REMOVE_NOTE; trackId: TrackId; index: NoteIndex }
  | { type: Action.MOVE_NOTE; trackId: TrackId; index: NoteIndex; pitch: number; start: number }
  | { type: Action.RESIZE_NOTE; trackId: TrackId; index: NoteIndex; duration: number }
  | { type: Action.MOVE_SELECTED_NOTES; trackId: TrackId; pitchOffset: number; tickOffset: number }
  | { type: Action.RESIZE_SELECTED_NOTES; trackId: TrackId; duration: number }
  | { type: Action.REMOVE_SELECTED_NOTES; trackId: TrackId }
  | {
      type: Action.ADD_NOTES;
      trackId: TrackId;
      notes: Array<{ pitch: number; start: number; duration: number; velocity?: number }>;
    }
  | { type: Action.SELECT_NOTE; trackId: TrackId; index: NoteIndex }
  | { type: Action.SELECT_NOTES; trackId: TrackId; indexes: NoteIndex[] }
  | { type: Action.UNSELECT_ALL_NOTES; trackId: TrackId }
  | { type: Action.SET_BPM; bpm: number }
  | { type: Action.SET_SIGNATURE; signature: [number, number] }
  | { type: Action.SET_SUBDIVISION; subdivision: [number, number] }
  | { type: Action.TOGGLE_PLAY }
  | { type: Action.SET_TRANSPORT_START; start: number }
  | { type: Action.SET_LOOP; loop: { start: number; end: number } | null }
  | { type: Action.SET_TOTAL_DURATION; total: number }
  | { type: Action.CHANGE_CURRENT_TRACK; trackId: TrackId }
  | { type: Action.ADD_TRACK; track: State["tracks"][number] }
  | { type: Action.REMOVE_TRACK; trackId: TrackId }
  | { type: Action.SET_TRACKLIST_POSITION; position: number }
) & { skipHistory?: boolean };
