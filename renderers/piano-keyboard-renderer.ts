import { Container, Graphics } from "pixi.js";
import Renderer, { type RendererDeps } from "./renderer";
import { logger } from "../lib/logger";
import { isBlackKey } from "../lib/utils";
import type { NoteOffCallback, NoteOnCallback } from "../engines/sound-engine";

export interface PianoKeyboardRendererDeps extends RendererDeps {}

export default abstract class PianoKeyboardRenderer extends Renderer<PianoKeyboardRendererDeps> {
  protected whiteKeysContainer = new Container<Graphics>({ label: "White Keys" });
  protected blackKeysContainer = new Container<Graphics>({ label: "Black Keys" });
  protected keyGraphics = new Map<number, Graphics>();
  protected bgGraphics = new Graphics({ label: "Piano keyboard bg" });
  constructor(deps: PianoKeyboardRendererDeps) {
    super(deps);
    this.init();
  }

  protected abstract init(): void;

  public abstract draw(): void;

  protected abstract drawKeys(keyHeight: number): void;

  public abstract colorNotes(notesOn: NoteOnCallback[], notesOff: NoteOffCallback[]): void;
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
    this.container.addChild(this.bgGraphics);
    this.container.addChild(this.whiteKeysContainer);
    this.container.addChild(this.blackKeysContainer);
    this.container.eventMode = "dynamic";
    for (let i = 0; i < 128; i++) {
      const g = new Graphics({ label: `key-${i}` });
      this.keyGraphics.set(i, g);
      if (isBlackKey(i)) {
        this.blackKeysContainer.addChild(g);
      } else {
        this.whiteKeysContainer.addChild(g);
      }
    }
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

    const keywidth = width / 75;
    this.drawKeys(keywidth);
    logger.draw("Piano", Date.now() - start);
  }

  protected drawKeys(keywidth: number): void {
    for (let midi = 0; midi < 128; midi++) {
      this.redrawKey(midi, false);
    }
  }

  private redrawKey(midi: number, noteOn: boolean): void {
    const { height } = this.deps.app.screen;
    const { pianoKeyboardSize, colors } = this.deps.engine;
    const keywidth = this.deps.app.screen.width / 75;
    const graphic = this.keyGraphics.get(midi)!;
    graphic.clear();

    logger.info("Redraw");
    if (isBlackKey(midi)) {
      const whitesBefore = this.countWhiteKeysBefore(midi);
      graphic
        .rect(
          whitesBefore * keywidth - keywidth * 0.25,
          height - pianoKeyboardSize,
          keywidth / 2,
          (pianoKeyboardSize * 2) / 3
        )
        .fill(noteOn ? colors.primary : colors.background);
    } else {
      const whitesBefore = this.countWhiteKeysBefore(midi);
      graphic
        .rect(whitesBefore * keywidth, height - pianoKeyboardSize, keywidth, height)
        .fill(noteOn ? colors.primary : colors.foreground)
        .stroke({ color: colors.background, pixelLine: true });
    }
  }

  colorNotes(notesOn: NoteOnCallback[], notesOff: NoteOffCallback[]): void {
    for (const { midiNote } of notesOff) this.redrawKey(midiNote, false);
    for (const { midiNote } of notesOn) this.redrawKey(midiNote, true);
  }

  private countWhiteKeysBefore(midi: number): number {
    let count = 0;
    for (let i = 0; i < midi; i++) {
      if (![1, 3, 6, 8, 10].includes(i % 12)) count++;
    }
    return count;
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
  }

  public draw(): void {
    const start = Date.now();
    const { height } = this.deps.app.screen;

    const keyHeight = height / 75;

    this.drawKeys(keyHeight);

    logger.draw("Piano", Date.now() - start);
  }

  protected drawKeys(keyHeight: number): void {
    const { pianoKeyboardSize, colors } = this.deps.engine;
  }

  colorNotes(notesOn: NoteOnCallback[], notesOff: NoteOffCallback[]): void {}
}
