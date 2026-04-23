import {
	Container,
	Sprite,
	Texture,
	type FederatedPointerEvent,
} from "pixi.js";
import Renderer, { type RendererDeps } from "./renderer";
import type ViewportRenderer from "./viewport-renderer";
import { Action } from "../types/actions";
import type { PointerActionEvent } from "../controllers/pointerActionHandler";
import type { Bounds } from "../types/general";
import { Event } from "../types/events";

export interface SelectionRendererDeps extends RendererDeps {
	viewportRenderer: ViewportRenderer;
	eventsDirtyFlags: Set<Event>;
}
export default class SelectionRenderer extends Renderer<SelectionRendererDeps> {
	private rectangle: Sprite | null = null;
	private selecting: boolean = false;
	private bounds: Bounds = { x: 0, y: 0, width: 0, height: 0 };
	constructor(deps: SelectionRendererDeps) {
		super(deps);
		const { app } = this.deps;
		const { x, y, width, height } = app.screen;

		this.container = new Container({
			label: "Selection",
			x: x,
			y,
			width,
			height,
		});
	}

	public draw() {
		if (!this.selecting) return this.container.removeChildren();
		if (!this.rectangle) {
			this.rectangle = new Sprite({
				texture: Texture.WHITE,
				alpha: 0.5,
				label: "Selection",
			});
			this.container.addChild(this.rectangle);
		}
		this.rectangle.x = this.bounds.x;
		this.rectangle.y = this.bounds.y;
		this.rectangle.width = this.bounds.width;
		this.rectangle.height = this.bounds.height;
	}

	public handleDragEnd(
		e: FederatedPointerEvent,
		origin: PointerActionEvent["dragOrigin"],
	) {
		const square = this.extractSquareArea(e, origin);
		if (square) this.selectNotes(square);
		this.container.removeChildren();
		this.selecting = false;
	}

	public handleDrag(
		e: FederatedPointerEvent,
		origin: PointerActionEvent["dragOrigin"],
	) {
		this.bounds = this.extractSquareArea(e, origin);
		this.selecting = true;
		this.deps.eventsDirtyFlags.add(Event.Selection);
	}

	public unselectAll() {
		if (
			this.state.tracks[this.state.currentTrackId].data.selectedNotes.indexOf(
				1,
			) === -1
		)
			return;
		this.dispatch({
			type: Action.UNSELECT_ALL_NOTES,
			trackId: this.state.currentTrackId,
		});
	}

	private extractSquareArea(
		e: FederatedPointerEvent,
		origin: PointerActionEvent["dragOrigin"],
	) {
		const width = Math.abs(e.globalX - origin.x);
		const height = Math.abs(e.globalY - origin.y);

		const x = Math.min(origin.x, e.globalX);
		const y = Math.min(origin.y, e.globalY);

		return { x, y, width, height };
	}

	private selectNotes(square: {
		width: number;
		height: number;
		x: number;
		y: number;
	}) {
		const { currentTrackId, tracks } = this.state;
		const track = tracks[currentTrackId];
		if (!track) return;

		const data = track.data;
		const noteHeight = this.deps.app.screen.height / 128;
		const nextSelected = new Uint8Array(data.noteCount);
		let changed = false;

		const localTopLeft = this.deps.viewportRenderer.container.toLocal({
			x: square.x,
			y: square.y,
		});
		const localBottomRight = this.deps.viewportRenderer.container.toLocal({
			x: square.x + square.width,
			y: square.y + square.height,
		});

		for (let i = 0; i < data.noteCount; i++) {
			const noteStart = data.startTicks[i];
			const noteEnd = noteStart + data.durationInTicks[i];
			const noteTop = (128 - data.midiValues[i]) * noteHeight;
			const noteBottom = noteTop + noteHeight;

			const isInside =
				noteStart <= localBottomRight.x &&
				noteEnd >= localTopLeft.x &&
				noteTop <= localBottomRight.y &&
				noteBottom >= localTopLeft.y;

			nextSelected[i] = isInside ? 1 : 0;
			if (nextSelected[i] !== data.selectedNotes[i]) changed = true;
		}

		if (changed) {
			const indexes = [];
			for (let i = 0; i < nextSelected.length; i++) {
				if (nextSelected[i]) indexes.push(i);
			}

			this.dispatch({
				type: Action.SELECT_NOTES,
				indexes,
				trackId: currentTrackId,
			});
		}
	}
}
