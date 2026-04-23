import { Container, Sprite, Texture, type SpriteOptions } from "pixi.js";
import Renderer, { type RendererDeps } from "./renderer";
import { logger } from "../lib/logger";
import type ViewportRenderer from "./viewport-renderer";
import { Event } from "../types/events";
import type { MidiData, Track } from "../types/instance";

export class GrayedNoteSprite extends Sprite {
	constructor(
		public readonly index: number,
		options?: SpriteOptions,
	) {
		super({ ...options, label: "GrayedNote" });
	}
}
export interface GrayedNotesRendererDeps extends RendererDeps {
	viewportRenderer: ViewportRenderer;
	eventsDirtyFlags: Set<Event>;
}
export default abstract class GrayedNotesRenderer extends Renderer<GrayedNotesRendererDeps> {
	protected pool: GrayedNoteSprite[] = [];
	protected dragState: {
		noteIndex: number;
		offset: { x: number; y: number };
		delta: { x: number; y: number };
		pending: { x: number; y: number };
		lastGlobalX: number;
		lastGlobalY: number;
		selectedPool: GrayedNoteSprite[];
	} | null = null;

	public abstract draw(): void;

	protected getMergedTracksData(): MidiData {
		const { tracks, currentTrackId } = this.state;

		const otherTracks = tracks.filter((t) => t.id !== currentTrackId);
		const totalNotes = otherTracks.reduce(
			(sum: number, t: Track) => sum + t.data.noteCount,
			0,
		);

		const mergedData: MidiData = {
			noteCount: totalNotes,
			capacity: totalNotes,
			startTicks: new Uint32Array(totalNotes),
			durationInTicks: new Uint32Array(totalNotes),
			midiValues: new Uint8Array(totalNotes),
			velocities: new Uint8Array(totalNotes),
			selectedNotes: new Uint8Array(totalNotes),
		};

		let offset = 0;
		for (const track of otherTracks) {
			const { data } = track;
			mergedData.startTicks.set(
				data.startTicks.subarray(0, data.noteCount),
				offset,
			);
			mergedData.durationInTicks.set(
				data.durationInTicks.subarray(0, data.noteCount),
				offset,
			);
			mergedData.midiValues.set(
				data.midiValues.subarray(0, data.noteCount),
				offset,
			);
			mergedData.velocities.set(
				data.velocities.subarray(0, data.noteCount),
				offset,
			);
			mergedData.selectedNotes.set(
				data.selectedNotes.subarray(0, data.noteCount),
				offset,
			);

			offset += data.noteCount;
		}
		return mergedData;
	}
}

export class PlayerGrayedNotesRenderer extends GrayedNotesRenderer {
	constructor(deps: GrayedNotesRendererDeps) {
		super(deps);
		this.container = new Container({
			label: "GrayedNotes",
			x: 0,
			y: 0,
			width: this.deps.app.screen.height,
			height: this.state.transport.totalDuration,
		});
	}

	public draw(): void {
		if (!this.state?.tracks) return;

		const start = Date.now();

		const { totalDuration } = this.state.transport;

		const { noteCount, startTicks, durationInTicks, midiValues } =
			this.getMergedTracksData();

		const { width } = this.deps.app.screen;
		const noteWidth = width / 128.5;

		for (let i = 0; i < noteCount; i++) {
			let sprite = this.pool[i];

			if (!sprite) {
				sprite = new GrayedNoteSprite(i, {
					texture: Texture.WHITE,
					eventMode: "dynamic",
				});
				this.pool[i] = sprite;
				this.container.addChild(sprite);
			}
			sprite.visible = true;
			sprite.y = totalDuration - startTicks[i] - durationInTicks[i];
			sprite.x = noteWidth * (128 - midiValues[i]);
			sprite.width = noteWidth;
			sprite.height = durationInTicks[i];
			sprite.tint = 0x454545;
		}

		for (let i = noteCount; i < this.pool.length; i++) {
			this.pool[i].visible = false;
		}

		logger.draw("GrayedNotes", Date.now() - start);
	}
}

export class EditorGrayedNotesRenderer extends GrayedNotesRenderer {
	constructor(deps: GrayedNotesRendererDeps) {
		super(deps);
		this.container = new Container({
			label: "GrayedNotes",
			x: 0,
			y: 0,
			width: this.state.transport.totalDuration,
			height: this.deps.app.screen.height,
		});
	}
	public draw(): void {
		if (!this.state?.tracks) return;

		const start = Date.now();

		const { noteCount, startTicks, durationInTicks, midiValues } =
			this.getMergedTracksData();

		const noteHeight = this.deps.app.screen.height / 128;

		for (let i = 0; i < noteCount; i++) {
			let sprite = this.pool[i];

			if (!sprite) {
				sprite = new GrayedNoteSprite(i, {
					texture: Texture.WHITE,
					eventMode: "dynamic",
				});
				this.pool[i] = sprite;
				this.container.addChild(sprite);
			}
			sprite.visible = true;
			sprite.x = startTicks[i];
			sprite.y = noteHeight * (128 - midiValues[i]);
			sprite.width = durationInTicks[i];
			sprite.height = noteHeight;
			sprite.tint = 0x454545;
		}

		for (let i = noteCount; i < this.pool.length; i++) {
			this.pool[i].visible = false;
		}

		logger.draw("GrayedNotes", Date.now() - start);
	}
}
