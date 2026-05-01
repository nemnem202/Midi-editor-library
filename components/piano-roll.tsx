import { useEffect, useRef, useState } from "react";
import { EditorEngine, type PianoRollEngine, PlayerEngine } from "../engines/piano-roll-engine";
import { useMidiStore } from "../stores/use-midi-store";
import type { PianoRollConfig } from "../types/general";
import useScreen from "@/hooks/use-screen";

export default function PianoRoll() {
  const state = useMidiStore((s) => s.state);

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
  const { size } = useScreen();
  const [playerStrategy, setPlayerStrategy] = useState(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!rootDiv.current) return;

    const rootStyle = getComputedStyle(document.documentElement);
    const getVar = (name: string) => rootStyle.getPropertyValue(name).trim();

    const config: PianoRollConfig = {
      root_div: rootDiv.current,
      pianoKeyboardSize: 100,
      strategy: "Player",
      isMobile: size === "sm",
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

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setIsMobile(size === "sm");
  }, [size]);

  return (
    <div className="flex flex-col size-full gap-2">
      <div
        ref={rootDiv}
        className="flex-1 w-full h-full min-h-0 bg-black rounded-lg focus:border-none focus-visible:ring-offset-0"
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        tabIndex={-1}
      />
    </div>
  );
}
