import { useMidiStore } from "../stores/use-midi-store";
import { Action } from "../types/actions";

export type Shortcut = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: () => void;
};

export const getShortcuts = (): Shortcut[] => {
  const { undo, redo, dispatch } = useMidiStore.getState();
  return [
    { key: "z", ctrl: true, action: undo },
    { key: "z", ctrl: true, shift: true, action: redo },
    { key: "y", ctrl: true, action: redo },
    {
      key: " ",
      action: () => {
        dispatch({ type: Action.TOGGLE_PLAY });
      },
    },
    {
      key: "enter",
      action: () => {
        dispatch({ type: Action.STOP });
      },
    },
  ];
};
