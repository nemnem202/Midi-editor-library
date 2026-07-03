import { Container, Graphics, Sprite, Texture } from "pixi.js";
import Renderer, { type RendererDeps } from "./renderer";
import { logger } from "../lib/logger";

export interface BackgroundRendererDeps extends RendererDeps {}

export default abstract class BackgroundRenderer extends Renderer<BackgroundRendererDeps> {
  constructor(deps: BackgroundRendererDeps) {
    super(deps);
    this.container = new Container({ label: "Backgroud" });
  }
  public abstract draw(): void;
}

export class PlayerBackgroundRenderer extends BackgroundRenderer {
  protected graphic = new Graphics();
  constructor(deps: BackgroundRendererDeps) {
    super(deps);
    this.container.addChild(this.graphic);
  }
  public draw(): void {
    const start = Date.now();

    const { pianoKeyboardSize, colors } = this.deps.engine;
    const { height, width } = this.deps.app.screen;
    const rowWidth = width / 128.5;
    this.graphic.clear();
    for (let i = 0; i <= 128.5; i += 12) {
      this.graphic.moveTo(rowWidth * i, 0);
      this.graphic.lineTo(rowWidth * i, height - pianoKeyboardSize);
    }
    this.graphic.stroke({ color: "#4b4b4b", pixelLine: true, alpha: 0.5 });
    logger.draw("Background", Date.now() - start);
  }
}

export class EditorBackgroundRenderer extends BackgroundRenderer {
  public draw(): void {
    const start = Date.now();
    this.clearContainer();
    const { height, width } = this.deps.app.screen;
    const { pianoKeyboardSize, colors } = this.deps.engine;
    const rowHeight = height / 128;
    for (let i = 0; i <= 128; i++) {
      if ([1, 3, 6, 8, 10].includes(i % 12)) continue;
      const line = new Sprite({
        label: "Background line",
        x: pianoKeyboardSize,
        y: rowHeight * (128 - i) - rowHeight,
        width: width - pianoKeyboardSize,
        height: rowHeight,
        texture: Texture.WHITE,
      });
      line.tint = colors.popover;
      this.container.addChild(line);
    }
    logger.draw("Background", Date.now() - start);
  }
}
