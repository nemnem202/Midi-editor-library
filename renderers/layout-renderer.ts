import { Container } from "pixi.js";
import type GridRenderer from "./grid-renderer";
import type LoopRenderer from "./loop-renderer";
import type NotesRenderer from "./notes-renderer";
import type PianoKeyboardRenderer from "./piano-keyboard-renderer";
import Renderer, { type RendererDeps } from "./renderer";
import type SelectionRenderer from "./selection-renderer";
import type PlayheadRenderer from "./playhead-renderer";
import type ViewportRenderer from "./viewport-renderer";
import type BackgroundRenderer from "./background-renderer";
import type MenuRenderer from "./menu-renderer";
import type GrayedNotesRenderer from "./grayed-notes-renderer";

export interface LayoutRendererDeps extends RendererDeps {
	gridRenderer: GridRenderer;
	backgroundRenderer: BackgroundRenderer;
	notesRenderer: NotesRenderer;
	grayedNotesRenderer: GrayedNotesRenderer;
	playheadRenderer: PlayheadRenderer;
	selectionRenderer: SelectionRenderer;
	loopRenderer: LoopRenderer;
	viewportRenderer: ViewportRenderer;
	pianoKeyboardRenderer: PianoKeyboardRenderer;
	menuRenderer: MenuRenderer;
}

export default class LayoutRenderer extends Renderer<LayoutRendererDeps> {
	constructor(deps: LayoutRendererDeps) {
		super(deps);
		this.init();
	}

	private init() {
		const {
			gridRenderer,
			backgroundRenderer,
			notesRenderer,
			playheadRenderer,
			loopRenderer,
			pianoKeyboardRenderer,
			selectionRenderer,
			viewportRenderer,
			menuRenderer,
			grayedNotesRenderer,
			app,
		} = this.deps;

		const { width, height, x, y } = app.screen;

		this.container = new Container({
			x,
			y,
			width,
			height,
			label: "Layout",
		});

		viewportRenderer.container.addChild(
			grayedNotesRenderer.container,
			notesRenderer.container,
			playheadRenderer.container,
			loopRenderer.container,
		);

		this.container.addChild(
			backgroundRenderer.container,
			gridRenderer.container,
			viewportRenderer.container,

			selectionRenderer.container,
			pianoKeyboardRenderer.container,
			menuRenderer.container,
		);
	}
}
