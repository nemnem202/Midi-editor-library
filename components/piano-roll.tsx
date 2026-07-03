import { useEffect, useRef } from "react";
import { type PianoRollEngine, PlayerEngine } from "../engines/piano-roll-engine";
import { useMidiStore } from "../stores/use-midi-store";
import type { PianoRollConfig } from "../types/general";
import useScreen from "@/hooks/use-screen";
import { TrackSelect } from "@/components/features/game/game-assets";
import { ZoomInButton, ZoomOutButton } from "@/components/ui/custom-buttons";
import { Action } from "../types/actions";

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
  const { size, orientation } = useScreen();
  const screen = useScreen();
  const { dispatch, state } = useMidiStore();
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

    const engine = new PlayerEngine(config);

    engineRef.current = engine;
    engine.init();

    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setIsMobile(size === "sm");
  }, [size]);

  return (
    <div className="flex flex-col size-full gap-2 justify-end">
      {screen.size === "sm" && screen.orientation === "vertical" && (
        <div className="w-full flex justify-between">
          <div className="flex gap-2">
            <ZoomInButton
              onClick={(e) => {
                e.stopPropagation();
                dispatch({
                  type: Action.ZoomY,
                  zoomY: Math.min(100, (state?.display.zoomY ?? 0) + 10),
                });
              }}
            />
            <ZoomOutButton
              onClick={(e) => {
                e.stopPropagation();
                dispatch({
                  type: Action.ZoomY,
                  zoomY: Math.max(0, (state?.display.zoomY ?? 0) - 10),
                });
              }}
            />
          </div>
          <div className="w-1/2">
            <TrackSelect />
          </div>
        </div>
      )}
      <div
        ref={rootDiv}
        className={`h-full flex flex-col justify-end rounded-lg focus:border-none focus-visible:ring-offset-0 `}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        tabIndex={-1}
      />
    </div>
  );
}
