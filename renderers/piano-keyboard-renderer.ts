import { Container, Graphics, Sprite, Texture } from "pixi.js";
import Renderer, { type RendererDeps } from "./renderer";
import { logger } from "../lib/logger";

export interface PianoKeyboardRendererDeps extends RendererDeps {}

export default abstract class PianoKeyboardRenderer extends Renderer<PianoKeyboardRendererDeps> {
  protected keysContainer = new Container({ label: "Keys" });
  protected bgGraphics = new Graphics({ label: "Piano keyboard bg" });
  constructor(deps: PianoKeyboardRendererDeps) {
    super(deps);
    this.init();
  }

  protected abstract init(): void;

  public abstract draw(): void;

  protected abstract drawKeys(keyHeight: number): void;
}

export class HorizontalPianoKeyboardRenderer extends PianoKeyboardRenderer {
  protected init(): void {
    const { width } = this.deps.app.screen;
    const { pianoKeyboardSize } = this.deps.engine;
    this.container = new Container({
      label: "Keyboard",
      width: width,
      height: pianoKeyboardSize,
      eventMode: "dynamic",
    });

    // const bg = new Graphics({
    //   x: 0,
    //   y: height - pianoKeyboardSize,
    //   width: width,
    //   height: pianoKeyboardSize,
    // })
    // this.bgGraphics
    //   .rect(0, 0, width, pianoKeyboardSize)
    //   .fill("#ffffff")
    //   .stroke({ color: "#000000", pixelLine: true });

    // this.container.addChild(bg);
    // this.container.addChild(this.keysContainer);
    this.container.addChild(this.bgGraphics);
    this.container.addChild(this.keysContainer);
    this.container.eventMode = "dynamic";
  }

  public draw(): void {
    const start = Date.now();
    const { width, height } = this.deps.app.screen;
    const { pianoKeyboardSize, colors } = this.deps.engine;
    this.bgGraphics
      .clear()
      .rect(0, height - pianoKeyboardSize, width, pianoKeyboardSize)
      .fill(colors.foreground)
      .stroke({ color: colors.background, pixelLine: true });

    while (this.keysContainer.children[0]) {
      this.keysContainer.children[0].destroy({ children: true });
    }

    const keywidth = width / 75;
    this.drawKeys(keywidth);
    logger.draw("Piano", Date.now() - start);
  }

  protected drawKeys(keywidth: number): void {
    const { height } = this.deps.app.screen;
    const { pianoKeyboardSize, colors } = this.deps.engine;
    const whiteKey = new Graphics({ label: "White key" });
    this.keysContainer.addChild(whiteKey);

    for (let i = 0; i < 75; i++) {
      whiteKey.moveTo(i * keywidth, height - pianoKeyboardSize).lineTo(i * keywidth, height);
      if ([2, 6].includes(i % 7)) continue;
      const blackKey = new Sprite({
        x: i * keywidth + keywidth * 0.75,
        y: height - pianoKeyboardSize,
        width: keywidth / 2,
        height: (pianoKeyboardSize * 2) / 3,
        texture: Texture.WHITE,
        alpha: 1,
      });
      blackKey.tint = colors.background;
      this.keysContainer.addChild(blackKey);
    }

    whiteKey.stroke({ color: colors.background, pixelLine: true });
  }
}

export class VerticalPianoKeyboardRenderer extends PianoKeyboardRenderer {
  protected init(): void {
    const { height } = this.deps.app.screen;
    const { pianoKeyboardSize, colors } = this.deps.engine;
    this.container = new Container({
      label: "Keyboard",
      width: pianoKeyboardSize,
      height: height,
      eventMode: "dynamic",
    });

    const bg = new Graphics({ x: 0, y: 0, width: pianoKeyboardSize, height })
      .rect(0, 0, pianoKeyboardSize, height)
      .fill(colors.foreground)
      .stroke({ color: colors.background, pixelLine: true });

    this.container.addChild(bg);
    this.container.addChild(this.keysContainer);
  }

  public draw(): void {
    const start = Date.now();
    const { height } = this.deps.app.screen;
    while (this.keysContainer.children[0]) {
      this.container.children[0].destroy();
    }
    const keyHeight = height / 75;

    this.drawKeys(keyHeight);

    logger.draw("Piano", Date.now() - start);
  }

  protected drawKeys(keyHeight: number): void {
    const whiteKey = new Graphics({ label: "White key" });
    this.keysContainer.addChild(whiteKey);
    const { pianoKeyboardSize, colors } = this.deps.engine;
    for (let i = 0; i < 75; i++) {
      whiteKey.moveTo(0, i * keyHeight).lineTo(pianoKeyboardSize, i * keyHeight);
      if ([2, 6].includes(i % 7)) continue;
      const blackKey = new Sprite({
        x: 0,
        y: (75 - i) * keyHeight - keyHeight * 1.25,
        width: (pianoKeyboardSize * 2) / 3,
        height: keyHeight / 2,
        texture: Texture.WHITE,
        alpha: 1,
      });
      blackKey.tint = colors.background;
      this.container.addChild(blackKey);
    }

    whiteKey.stroke({ color: colors.background, pixelLine: true });
  }
}
