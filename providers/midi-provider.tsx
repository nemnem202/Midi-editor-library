import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { useMidiStore } from "../stores/use-midi-store";
import SoundEngine from "../engines/sound-engine";
import { Action } from "../types/actions";
import type { State } from "../types/instance";
import { logger } from "@/lib/logger";

const MidiContext = createContext<{ startAudio: () => Promise<void> } | null>(null);

export const useMidiActions = () => {
  const context = useContext(MidiContext);
  if (!context) throw new Error("useMidiActions must be used within MidiProvider");
  return context;
};

export const MidiProvider = ({
  children,
  initialMidiData,
}: {
  children: React.ReactNode;
  initialMidiData: State | null;
}) => {
  const isStoreSet = useRef(false);

  useEffect(() => {
    if (!isStoreSet.current && initialMidiData) {
      useMidiStore.setState({ state: initialMidiData });
      isStoreSet.current = true;
    }
    logger.info("Midi data", initialMidiData);
  }, [initialMidiData]);

  const dispatch = useMidiStore((s) => s.dispatch);
  const state = useMidiStore((s) => s.state);

  const startAudio = useCallback(async () => {
    if (!SoundEngine.initialized) {
      await SoundEngine.init(state, (tick) => {});

      SoundEngine.get().updateMidiEvents();
    }

    dispatch({ type: Action.TOGGLE_PLAY });
  }, [state, dispatch]);

  return <MidiContext.Provider value={{ startAudio }}>{children}</MidiContext.Provider>;
};
