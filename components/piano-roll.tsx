import { useEffect, useRef, useState } from "react";
import { EditorEngine, type PianoRollEngine, PlayerEngine } from "../engines/piano-roll-engine";
import { useMidiStore } from "../stores/use-midi-store";
import { useShortcuts } from "../hooks/useShortcuts";

export default function PianoRoll() {
  const state = useMidiStore((s) => s.state);

  useShortcuts();

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

    const engine = playerStrategy
      ? new PlayerEngine(rootDiv.current)
      : new EditorEngine(rootDiv.current);

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

      {/* Barre d'outils locale au Piano Roll */}
      {/* <div className="flex items-center gap-4 p-2 bg-card/50 rounded-b-lg border-t">
        <button
          type="button"
          className="p-2 hover:bg-accent rounded-full transition"
          onClick={() => setPlayerStrategy((prev) => !prev)}
        >
          <svg
            xmlns="http:
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Intervertir Mode Joueur/Editeur</title>
            <path d="m16 3 4 4-4 4" />
            <path d="M20 7H4" />
            <path d="m8 21-4-4 4-4" />
            <path d="M4 17h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground" >Piste :</label>
          <select
            className="bg-background border rounded px-2 py-1 text-sm outline-none"
            value={currentTrackId}
            onChange={(e) =>
              dispatch({
                type: Action.CHANGE_CURRENT_TRACK,
                trackId: parseInt(e.target.value, 10),
              })
            }
          >
            {tracks.map((t) => (
              <option value={t.id} key={t.id}>
                Track {t.id}
              </option>
            ))}
          </select>
        </div>
      </div> */}
    </div>
  );
}
