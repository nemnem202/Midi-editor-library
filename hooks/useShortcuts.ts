import { useEffect } from "react";
import { getShortcuts, type Shortcut } from "../config/shortcuts";

const matchesShortcut = (e: KeyboardEvent, s: Shortcut): boolean =>
	e.key.toLowerCase() === s.key &&
	!!e.ctrlKey === !!s.ctrl &&
	!!e.shiftKey === !!s.shift &&
	!!e.metaKey === !!s.meta;

export const useShortcuts = () => {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const shortcuts = getShortcuts();
			const match = shortcuts.find((s) => matchesShortcut(e, s));
			if (match) {
				e.preventDefault();
				match.action();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);
};
