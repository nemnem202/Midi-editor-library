import { Container, Graphics } from "pixi.js";
import { logger } from "../lib/logger";
import Renderer, { type RendererDeps } from "./renderer";
import { PIANO_KEYBOARD_SIZE } from "../config/layout";
import type { State, Subdivision } from "../types/instance";
import { BINARY_SUBDIVISIONS } from "../config/bpm";
import { getSubdivisionTickInterval, grayFromScale } from "../lib/utils";

const MIN_PIXEL_STEP = 50;

export interface GridRendererDeps extends RendererDeps {
	state: State;
}

export default abstract class GridRenderer extends Renderer<GridRendererDeps> {
	protected graphic = new Graphics();
	constructor(deps: GridRendererDeps) {
		super(deps);
		this.container = new Container({ label: "Grid" });
		this.container.addChild(this.graphic);
	}

	public abstract draw(): void;
}

export class PlayerGridRenderer extends GridRenderer {
	public draw(): void {}
	// public draw(): void {
	//   const start = Date.now();

	//   const { width, ppq, subdivisionsToAdd, viewportContainer, gridHeight } =
	//     this.extractVariables();

	//   this.graphic.clear();

	//   const totalDuration = this.state.transport.totalDuration;
	//   const scaleY = viewportContainer.scale.y;
	//   const viewY = viewportContainer.y;

	//   for (let i = 0; i < subdivisionsToAdd.length; i++) {
	//     const tickStep = getSubdivisionTickInterval(ppq, subdivisionsToAdd[i]);
	//     const pixelStep = tickStep * scaleY;
	//     const colorFactor = Math.max(500 * (i + 1), 2000);

	//     if (pixelStep < MIN_PIXEL_STEP) continue;

	//     this.drawLines(
	//       totalDuration,
	//       tickStep,
	//       viewY,
	//       scaleY,
	//       gridHeight,
	//       width,
	//       grayFromScale(colorFactor * Math.max(Math.min(viewportContainer.scale.x, 1), 0.5)),
	//     );
	//   }

	//   logger.draw("Grid", Date.now() - start);
	// }

	// protected extractVariables() {
	//   const { width, height } = this.deps.app.screen;
	//   const { container: viewportContainer } = this.deps.engine._viewport;
	//   const { ppq, subdivision, signature } = this.state.config;

	//   const calculatedSubdivision = subdivision[0] / subdivision[1];
	//   const subdivisionsToAdd = BINARY_SUBDIVISIONS.filter(
	//     (sub) => sub[0] / sub[1] >= calculatedSubdivision,
	//   );
	//   subdivisionsToAdd.push(signature as Subdivision);
	//   subdivisionsToAdd.sort((a, b) => a[0] / a[1] - b[0] / b[1]);

	//   const gridHeight = height - PIANO_KEYBOARD_SIZE;

	//   return {
	//     width,
	//     viewportContainer,
	//     ppq,
	//     gridHeight,
	//     subdivisionsToAdd,
	//   };
	// }

	// protected drawLines(
	//   totalDuration: number,
	//   tickStep: number,
	//   viewY: number,
	//   scaleY: number,
	//   gridHeight: number,
	//   width: number,
	//   color: string,
	// ): void {
	//   const topTick = totalDuration + viewY / scaleY;

	//   const bottomTick = totalDuration + (viewY - gridHeight) / scaleY;

	//   const firstTick = Math.ceil(bottomTick / tickStep) * tickStep;

	//   for (let t = firstTick; t <= topTick + tickStep; t += tickStep) {
	//     const y = viewY + (totalDuration - t) * scaleY;

	//     if (y >= 0 && y <= gridHeight) {
	//       this.graphic.moveTo(0, y).lineTo(width, y);
	//     }
	//   }
	//   this.graphic.stroke({ color, pixelLine: true });
	// }
}

export class EditorGridRenderer extends GridRenderer {
	constructor(deps: GridRendererDeps) {
		super(deps);
		this.graphic.x = PIANO_KEYBOARD_SIZE;
		this.container = new Container({ label: "Grid" });
		this.container.addChild(this.graphic);
	}
	public draw(): void {
		const start = Date.now();

		const {
			height,
			ppq,
			subdivisionsToAdd,
			viewportContainer,
			gridWidth,
			leftTick,
		} = this.extractVariables();

		this.graphic.clear();

		for (let i = 0; i < subdivisionsToAdd.length; i++) {
			const tickStep = getSubdivisionTickInterval(ppq, subdivisionsToAdd[i]);
			const pixelStep = tickStep * viewportContainer.scale._x;
			const colorFactor = Math.max(500 * (i + 1), 2000);
			if (pixelStep < MIN_PIXEL_STEP) continue;
			this.drawLines(
				leftTick,
				pixelStep,
				gridWidth,
				height,
				grayFromScale(
					colorFactor * Math.max(Math.min(viewportContainer.scale.x, 1), 0.5),
				),
			);
		}

		logger.draw("Grid", Date.now() - start);
	}

	protected extractVariables() {
		const { width, height } = this.deps.app.screen;
		const { container: viewportContainer } = this.deps.engine._viewport;
		const { ppq, subdivision, signature } = this.state.config;
		const calculatedSubdivision = subdivision[0] / subdivision[1];
		const subdivisionsToAdd = BINARY_SUBDIVISIONS.filter(
			(sub) => sub[0] / sub[1] >= calculatedSubdivision,
		);
		subdivisionsToAdd.push(signature as Subdivision);

		subdivisionsToAdd.sort((a, b) => a[0] / a[1] - b[0] / b[1]);

		const gridWidth = width - PIANO_KEYBOARD_SIZE;
		const leftTick = Math.max(-viewportContainer.x + PIANO_KEYBOARD_SIZE, 0);

		return {
			height,
			viewportContainer,
			ppq,
			gridWidth,
			leftTick,
			subdivisionsToAdd,
		};
	}

	protected drawLines(
		leftTick: number,
		pixelStep: number,
		gridWidth: number,
		height: number,
		color: string,
	): void {
		const firstLine = Math.floor(leftTick / pixelStep) * pixelStep;

		for (
			let i = firstLine;
			i <= gridWidth + firstLine + pixelStep;
			i += pixelStep
		) {
			this.graphic.moveTo(i - leftTick, 0).lineTo(i - leftTick, height);
		}
		this.graphic.stroke({ color, pixelLine: true });
	}
}
