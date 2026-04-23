import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { useMidiStore } from "../stores/use-midi-store";
import SoundEngine from "../engines/sound-engine";
import type { State } from "../types/instance";
import { logger } from "@/lib/logger";
import { Action } from "../types/actions";

const MidiContext = createContext<{
  startAudio: () => Promise<void>;
  togglePlay: () => void;
} | null>(null);

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
    try {
      if (!SoundEngine.isInitialized) {
        logger.info("Initializing SoundEngine for the first time...");

        await SoundEngine.init(state, (tick) => {});

        const engine = SoundEngine.get();
        engine.updateMidiEvents();
      }
    } catch (error) {
      logger.error("CRITICAL: startAudio failed", error);
    }
  }, [state]);

  const togglePlay = () => dispatch({ type: Action.TOGGLE_PLAY });

  return <MidiContext.Provider value={{ startAudio, togglePlay }}>{children}</MidiContext.Provider>;
};
