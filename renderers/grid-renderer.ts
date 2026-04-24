import { Container, Graphics } from "pixi.js";
import { logger } from "../lib/logger";
import Renderer, { type RendererDeps } from "./renderer";
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
}

export class EditorGridRenderer extends GridRenderer {
  constructor(deps: GridRendererDeps) {
    super(deps);
    const { pianoKeyboardSize } = this.deps.engine;
    this.graphic.x = pianoKeyboardSize;
    this.container = new Container({ label: "Grid" });
    this.container.addChild(this.graphic);
  }
  public draw(): void {
    const start = Date.now();

    const { height, ppq, subdivisionsToAdd, viewportContainer, gridWidth, leftTick } =
      this.extractVariables();

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
        grayFromScale(colorFactor * Math.max(Math.min(viewportContainer.scale.x, 1), 0.5))
      );
    }

    logger.draw("Grid", Date.now() - start);
  }

  protected extractVariables() {
    const { pianoKeyboardSize } = this.deps.engine;
    const { width, height } = this.deps.app.screen;
    const { container: viewportContainer } = this.deps.engine._viewport;
    const { ppq, subdivision, signature } = this.state.config;
    const calculatedSubdivision = subdivision[0] / subdivision[1];
    const subdivisionsToAdd = BINARY_SUBDIVISIONS.filter(
      (sub) => sub[0] / sub[1] >= calculatedSubdivision
    );
    subdivisionsToAdd.push(signature as Subdivision);

    subdivisionsToAdd.sort((a, b) => a[0] / a[1] - b[0] / b[1]);

    const gridWidth = width - pianoKeyboardSize;
    const leftTick = Math.max(-viewportContainer.x + pianoKeyboardSize, 0);

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
    color: string
  ): void {
    const firstLine = Math.floor(leftTick / pixelStep) * pixelStep;

    for (let i = firstLine; i <= gridWidth + firstLine + pixelStep; i += pixelStep) {
      this.graphic.moveTo(i - leftTick, 0).lineTo(i - leftTick, height);
    }
    this.graphic.stroke({ color, pixelLine: true });
  }
}
