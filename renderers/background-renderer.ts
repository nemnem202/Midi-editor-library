import { Container, Sprite, Texture } from "pixi.js";
import Renderer, { type RendererDeps } from "./renderer";
import { logger } from "../lib/logger";
import { PIANO_KEYBOARD_SIZE } from "../config/layout";

export interface BackgroundRendererDeps extends RendererDeps {}

export default abstract class BackgroundRenderer extends Renderer<BackgroundRendererDeps> {
	constructor(deps: BackgroundRendererDeps) {
		super(deps);
		this.container = new Container({ label: "Backgroud" });
	}
	public abstract draw(): void;
}

export class PlayerBackgroundRenderer extends BackgroundRenderer {
	public draw(): void {
		const start = Date.now();
		const { height, width } = this.deps.app.screen;
		const rowWidth = width / 128.5;
		for (let i = 0; i <= 128.5; i++) {
			if ([1, 3, 6, 8, 10].includes(i % 12)) continue;
			const line = new Sprite({
				label: "Background line",
				x: rowWidth * i,
				y: 0,
				height: height - PIANO_KEYBOARD_SIZE,
				width: rowWidth,
				texture: Texture.WHITE,
			});
			line.tint = 0x292929;
			this.container.addChild(line);
		}
		logger.draw("Background", Date.now() - start);
	}
}

export class EditorBackgroundRenderer extends BackgroundRenderer {
	public draw(): void {
		const start = Date.now();
		const { height, width } = this.deps.app.screen;
		const rowHeight = height / 128;
		for (let i = 0; i <= 128; i++) {
			if ([1, 3, 6, 8, 10].includes(i % 12)) continue;
			const line = new Sprite({
				label: "Background line",
				x: PIANO_KEYBOARD_SIZE,
				y: rowHeight * (128 - i) - rowHeight,
				width: width - PIANO_KEYBOARD_SIZE,
				height: rowHeight,
				texture: Texture.WHITE,
			});
			line.tint = 0x292929;
			this.container.addChild(line);
		}
		logger.draw("Background", Date.now() - start);
	}
}
