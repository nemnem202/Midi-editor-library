import { useEffect, useRef, useState } from "react";
import { EditorEngine, type PianoRollEngine, PlayerEngine } from "../engines/piano-roll-engine";
import { useMidiStore } from "../stores/use-midi-store";
import type { PianoRollConfig } from "../types/general";

export default function PianoRoll() {
  const state = useMidiStore((s) => s.state);

  // useShortcuts();

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };

    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  if (!state) return null;

  return <Content />;
}

function Content() {
  const rootDiv = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PianoRollEngine | null>(null);

  const dispatch = useMidiStore((s) => s.dispatch);
  const currentTrackId = useMidiStore((s) => s.state.currentTrackId);
  const tracks = useMidiStore((s) => s.state.tracks);

  const [playerStrategy, setPlayerStrategy] = useState(true);

  useEffect(() => {
    if (!rootDiv.current) return;

    const rootStyle = getComputedStyle(document.documentElement);
    const getVar = (name: string) => rootStyle.getPropertyValue(name).trim();

    const config: PianoRollConfig = {
      root_div: rootDiv.current,
      pianoKeyboardSize: 100,
      strategy: "Player",
      colors: {
        primary: getVar("--primary"),
        secondary: getVar("--secondary"),
        foreground: getVar("--foreground"),
        muted: getVar("--border"),
        background: getVar("--background"),
        popover: getVar("--popover"),
      },
    };

    const engine = playerStrategy ? new PlayerEngine(config) : new EditorEngine(config);

    engineRef.current = engine;
    engine.init();

    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [playerStrategy]);

  return (
    <div className="flex flex-col size-full gap-2">
      {/* Zone de rendu Pixi */}
      <div
        ref={rootDiv}
        className="flex-1 w-full h-full min-h-0 bg-black rounded-lg"
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        tabIndex={-1}
      />
    </div>
  );
}
