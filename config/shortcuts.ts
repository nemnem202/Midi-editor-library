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
  const { undo, redo, dispatch, state } = useMidiStore.getState();
  return [
    { key: "z", ctrl: true, action: undo },
    { key: "z", ctrl: true, shift: true, action: redo },
    { key: "y", ctrl: true, action: redo },
    {
      key: " ",
      action: () => {
        dispatch({
          type: Action.SET_TRANSPORT_STATUS,
          status: state?.transport.status === "playing" ? "paused" : "playing",
        });
      },
    },
    {
      key: "escape",
      action: () => {
        dispatch({ type: Action.SET_TRANSPORT_STATUS, status: "reset" });
      },
    },
  ];
};
