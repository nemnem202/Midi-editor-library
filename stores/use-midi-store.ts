import { create } from "zustand";
import { produce, enableMapSet } from "immer";
import { midiReducer } from "../lib/immer-reducer";
import type { State } from "../types/instance";
import { Action, type MidiAction } from "../types/actions";

enableMapSet();

interface MidiStore {
  state: State;
  undoStack: State[];
  redoStack: State[];
  dispatch: (action: MidiAction) => void;
  undo: () => void;
  redo: () => void;
}

function deepCloneState(state: State): State {
  return {
    ...state,
    tracks: state.tracks.map((t) => ({
      ...t,
      data: {
        ...t.data,
        pitches: new Uint8Array(t.data.pitches),
        startTicks: new Uint32Array(t.data.startTicks),
        durations: new Uint32Array(t.data.durations),
        selectedNotes: new Uint8Array(t.data.selectedNotes),
        velocities: new Uint8Array(t.data.velocities),
      },
    })),
    queuedActions: new Set(state.queuedActions),
  };
}

export const useMidiStore = create<MidiStore>((set, get) => ({
  state: null as any,
  undoStack: [],
  redoStack: [],

  dispatch: (action) => {
    const { state, undoStack } = get();

    const isHistoryAction = !action.skipHistory;

    let newUndoStack = undoStack;
    if (isHistoryAction) {
      newUndoStack = [...undoStack, deepCloneState(state)].slice(-50);
    }

    const nextState = produce(state, (draft) => {
      draft.queuedActions.clear();

      midiReducer(draft, action);

      draft.queuedActions.add(action.type);
    });

    set({
      state: nextState,
      undoStack: newUndoStack,
      redoStack: isHistoryAction ? [] : get().redoStack,
    });
  },

  undo: () => {
    const { undoStack, state, redoStack } = get();
    if (undoStack.length === 0) return;

    const prevState = produce(undoStack[undoStack.length - 1], (draft) => {
      draft.queuedActions.add(Action.RENDER_ALL);
    });

    const newUndoStack = undoStack.slice(0, -1);
    set({
      state: prevState,
      undoStack: newUndoStack,
      redoStack: [deepCloneState(state), ...redoStack],
    });
  },

  redo: () => {
    const { redoStack, state, undoStack } = get();
    if (redoStack.length === 0) return;

    const nextState = produce(redoStack[0], (draft) => {
      draft.queuedActions.add(Action.RENDER_ALL);
    });

    const newRedoStack = redoStack.slice(1);
    set({
      state: nextState,
      undoStack: [...undoStack, deepCloneState(state)],
      redoStack: newRedoStack,
    });
  },
}));
