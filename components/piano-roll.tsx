import { useEffect, useRef, useState } from "react";
import {
	EditorEngine,
	PianoRollEngine,
	PlayerEngine,
} from "../engines/piano-roll-engine";
import { useMidiStore } from "../stores/use-midi-store";
import { Action } from "../types/actions";
import { useShortcuts } from "../hooks/useShortcuts";
import { convertMidiFileToState, getMidiFile } from "../lib/midiconverter";

export default function PianoRoll() {
	const initialized = useRef(false);
	const state = useMidiStore((s) => s.state);

	useShortcuts();

	useEffect(() => {
		if (!initialized.current) {
			getMidiFile("assets/FlyMeToTheMoon.mid")
				.then(convertMidiFileToState)
				.then((midiState) => {
					useMidiStore.setState({ state: midiState });
					initialized.current = true;
				});
		}
		window.addEventListener(
			"wheel",
			(e) => {
				if (e.ctrlKey) e.preventDefault();
			},
			{ passive: false },
		);
	}, []);

	return <>{state && <Content />}</>;
}

function Content() {
	const rootDiv = useRef<HTMLDivElement>(null);
	const engineRef = useRef<PianoRollEngine | null>(null);
	const { dispatch, state } = useMidiStore.getState();
	const [playerStrategy, setPlayerStrategy] = useState(true);
	const [allowToStart, setAllowToStart] = useState(false);

	useEffect(() => {
		if (!rootDiv.current || !allowToStart) return;

		const engine = playerStrategy
			? new PlayerEngine(rootDiv.current)
			: new EditorEngine(rootDiv.current);

		engineRef.current = engine;

		const startEngine = async () => {
			await engine.init();
		};

		startEngine();

		return () => {
			engineRef.current?.destroy();
			engineRef.current = null;
		};
	}, [playerStrategy, allowToStart]);

	return (
		<>
			<div
				ref={rootDiv}
				style={{
					width: "80vw",
					height: "80vh",
					overflow: "hidden",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
				}}
				onContextMenu={(e) => e.preventDefault()}
				role="application"
				tabIndex={-1}
			>
				{!allowToStart && (
					<button type="button" onClick={() => setAllowToStart(true)}>
						Start ?
					</button>
				)}
			</div>
			<button type="button" onClick={() => setPlayerStrategy((prev) => !prev)}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					className="lucide lucide-arrow-right-left-icon lucide-arrow-right-left"
				>
					<title>Intervert</title>
					<path d="m16 3 4 4-4 4" />
					<path d="M20 7H4" />
					<path d="m8 21-4-4 4-4" />
					<path d="M4 17h16" />
				</svg>
			</button>
			<select
				value={state.currentTrackId}
				name="choix"
				onChange={(e) =>
					dispatch({
						type: Action.CHANGE_CURRENT_TRACK,
						trackId: parseInt(e.target.value, 10),
					})
				}
			>
				{state.tracks.map((t) => (
					<option value={t.id} key={t.id}>
						Track {t.id}
					</option>
				))}
			</select>
		</>
	);
}
