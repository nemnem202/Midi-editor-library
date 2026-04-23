import { type Draft } from "immer";
import type { State } from "../types/instance";
import { Action, type MidiAction } from "../types/actions";
import {
  addNote,
  moveNote,
  removeNote,
  addNotes,
  moveSelectedNotes,
  removeSelectedNotes,
  resizeNote,
  resizeSelectedNotes,
  selectNote,
  selectNotes,
  unSelectAllNotes,
} from "../actions/note";
import { setBpm, setSignature, setSubdivision, togglePlay } from "../actions/config";
import { setLoop, setTotalDuration, setTransportStart } from "../actions/transport";
import { addTrack, changeCurrentTrack, removeTrack } from "../actions/track";

export const midiReducer = (draft: Draft<State>, action: MidiAction) => {
  let track: Draft<State["tracks"][number]> | undefined;
  if ("trackId" in action) {
    track = draft.tracks.find((t) => t.id === action.trackId);
    if (!track) return;
  }

  switch (action.type) {
    case Action.SELECT_NOTE:
      selectNote(track!.data, action.index);
      break;
    case Action.SELECT_NOTES:
      selectNotes(track!.data, action.indexes);
      break;
    case Action.UNSELECT_ALL_NOTES:
      unSelectAllNotes(track!.data);
      break;
    case Action.ADD_NOTE:
      addNote(track!.data, action.midi, action.start, action.duration, action.velocity);
      break;

    case Action.REMOVE_NOTE:
      removeNote(track!.data, action.index);
      break;

    case Action.MOVE_NOTE:
      moveNote(track!.data, action.index, action.midi, action.start);
      break;

    case Action.RESIZE_NOTE:
      resizeNote(track!.data, action.index, action.duration);
      break;

    case Action.MOVE_SELECTED_NOTES:
      moveSelectedNotes(track!.data, action.midiOffset, action.tickOffset);
      break;

    case Action.RESIZE_SELECTED_NOTES:
      resizeSelectedNotes(track!.data, action.duration);
      break;

    case Action.REMOVE_SELECTED_NOTES:
      removeSelectedNotes(track!.data);
      break;

    case Action.ADD_NOTES:
      addNotes(track!.data, action.notes);
      break;

    case Action.SET_BPM:
      setBpm(draft.config, action.bpm);
      break;

    case Action.SET_SIGNATURE:
      setSignature(draft.config, action.signature);
      break;

    case Action.SET_SUBDIVISION:
      setSubdivision(draft.config, action.subdivision);
      break;

    case Action.TOGGLE_PLAY:
      togglePlay(draft.config);
      break;

    case Action.SET_TRANSPORT_START:
      setTransportStart(draft.transport, action.start);
      break;

    case Action.SET_LOOP:
      setLoop(draft.transport, action.loop);
      break;

    case Action.SET_TOTAL_DURATION:
      setTotalDuration(draft.transport, action.total);
      break;

    case Action.CHANGE_CURRENT_TRACK:
      changeCurrentTrack(draft, action.trackId);
      break;

    case Action.ADD_TRACK:
      addTrack(draft, action.track);
      break;

    case Action.REMOVE_TRACK:
      removeTrack(draft, action.trackId);
      break;
  }
};
