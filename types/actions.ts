import { Chord } from "@/types/music";
import type { Loop, NoteIndex, State, TrackId, TransportStatus } from "./instance";

export enum Action {
  RENDER_ALL,

  RESET_STATE,
  INITIALIZE_STATE,

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

  SET_SIGNATURE,
  SET_SUBDIVISION,

  SET_BPM,
  SET_BPM_PRACTICE,
  SET_TRANSPOSITION,
  SET_TRANSPOSITION_PRACTICE,
  SET_REPEATS,
  SET_COUNT_INT,

  SET_TRANSPORT_START,
  SET_TRANSPORT_START_FROM_MEASURE_INDEX,
  SET_LOOP,
  SET_TOTAL_DURATION,
  SET_TRACKLIST_POSITION,
  SET_TRANSPORT_STATUS,
  SET_CURRENT_MEASURE,

  DISPLAY_CURRENT_MEASURE,

  SHOW_PIANO_DIAGRAMS,
  SHOW_GUITAR_DIAGRAMS,

  CHANGE_CURRENT_TRACK,
  ADD_TRACK,
  REMOVE_TRACK,

  CHANGE_TRACK_VOLUME,
  MUTE_TRACK,
  UNMUTE_TRACK,

  ZoomY,
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
  | { type: Action.SET_SIGNATURE; signature: [number, number] }
  | { type: Action.SET_SUBDIVISION; subdivision: [number, number] }
  | { type: Action.SET_TRANSPORT_STATUS; status: TransportStatus }
  | { type: Action.SET_TRANSPORT_START; start: number }
  | { type: Action.SET_LOOP; loop: Loop | null }
  | { type: Action.SET_TOTAL_DURATION; total: number }
  | { type: Action.CHANGE_CURRENT_TRACK; trackId: TrackId }
  | { type: Action.ADD_TRACK; track: State["tracks"][number] }
  | { type: Action.REMOVE_TRACK; trackId: TrackId }
  | { type: Action.SET_TRACKLIST_POSITION; position: number }
  | { type: Action.RESET_STATE }
  | { type: Action.CHANGE_TRACK_VOLUME; volume: number; trackId: TrackId }
  | { type: Action.MUTE_TRACK; trackId: TrackId }
  | { type: Action.UNMUTE_TRACK; trackId: TrackId }
  | { type: Action.SET_TRANSPORT_START_FROM_MEASURE_INDEX; measureIndex: number }
  | { type: Action.ZoomY; zoomY: number }
  | { type: Action.SET_BPM; bpm: number }
  | { type: Action.SET_BPM_PRACTICE; bpm: number }
  | { type: Action.SET_TRANSPOSITION; transposition: number }
  | { type: Action.SET_TRANSPOSITION_PRACTICE; transposition: number }
  | { type: Action.SET_REPEATS; repeats: number }
  | { type: Action.SET_COUNT_INT; countin: boolean }
  | { type: Action.SET_CURRENT_MEASURE; index: number }
  | { type: Action.DISPLAY_CURRENT_MEASURE; display: boolean }
  | { type: Action.SHOW_GUITAR_DIAGRAMS; display: boolean }
  | { type: Action.SHOW_PIANO_DIAGRAMS; display: boolean }
) & { useHistory?: boolean };
