import { Container, Sprite, Texture, type SpriteOptions } from "pixi.js";
import Renderer, { type RendererDeps } from "./renderer";
import { logger } from "../lib/logger";
import type ViewportRenderer from "./viewport-renderer";
import type { Event } from "../types/events";
import type { MidiData, Track } from "../types/instance";
import { isBlackKey, trackIsDrums } from "../lib/utils";
import { MIN_NOTE_DISPLAYED_SIZE, NoteSprite } from "./notes-renderer";

export class GrayedNoteSprite extends Sprite {
  constructor(
    public readonly index: number,
    options?: SpriteOptions
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
    const otherTracks = tracks.filter((t) => t.id !== currentTrackId && !trackIsDrums(t.family));
    const totalNotes = otherTracks.reduce((sum: number, t: Track) => sum + t.data.noteCount, 0);

    const mergedData: MidiData = {
      noteCount: totalNotes,
      capacity: totalNotes,
      startTicks: new Uint32Array(totalNotes),
      durations: new Uint32Array(totalNotes),
      pitches: new Uint8Array(totalNotes),
      velocities: new Uint8Array(totalNotes),
      selectedNotes: new Uint8Array(totalNotes),
    };

    let offset = 0;
    for (const track of otherTracks) {
      const { data } = track;
      mergedData.startTicks.set(data.startTicks.subarray(0, data.noteCount), offset);
      mergedData.durations.set(data.durations.subarray(0, data.noteCount), offset);
      mergedData.pitches.set(data.pitches.subarray(0, data.noteCount), offset);
      mergedData.velocities.set(data.velocities.subarray(0, data.noteCount), offset);
      mergedData.selectedNotes.set(data.selectedNotes.subarray(0, data.noteCount), offset);

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
    const { colors } = this.deps.engine;
    const { noteCount, startTicks, durations, pitches } = this.getMergedTracksData();

    const { width } = this.deps.app.screen;
    const keyWidth = width / 75;

    const { repeats } = this.state.config;

    const shouldRepeat = repeats > 0;

    for (let i = 0; i < noteCount; i++) {
      this.drawNote(
        i,
        pitches[i],
        keyWidth,
        totalDuration - startTicks[i] - durations[i],
        durations[i]
      );
      shouldRepeat &&
        this.drawNote(
          i + noteCount,
          pitches[i],
          keyWidth,
          -startTicks[i] - durations[i],
          durations[i]
        );
    }
    const spritesIndexToHide = shouldRepeat ? noteCount * 2 : noteCount;
    for (let i = spritesIndexToHide; i < this.pool.length; i++) {
      this.pool[i].visible = false;
    }

    logger.draw("GrayedNotes", Date.now() - start);
  }

  private drawNote(i: number, pitch: number, keyWidth: number, y: number, duration: number) {
    const { colors } = this.deps.engine;
    let sprite = this.pool[i];
    const isBlack = isBlackKey(pitch);
    if (!sprite) {
      sprite = new NoteSprite(i, {
        texture: Texture.WHITE,
        eventMode: "dynamic",
        zIndex: 0,
      });
      this.pool[i] = sprite;
      this.container.addChild(sprite);
    }
    sprite.visible = true;

    if (isBlack) {
      this.setBoundsForBlackKey(sprite, pitch, keyWidth);
    } else {
      this.setBoundsForWhiteKey(sprite, pitch, keyWidth);
    }

    sprite.y = y - 1; // i add +1 and -1 to avoid some visual artefacts
    sprite.height = duration + 1;

    if (duration < MIN_NOTE_DISPLAYED_SIZE) {
      sprite.height = MIN_NOTE_DISPLAYED_SIZE;
      sprite.y -= MIN_NOTE_DISPLAYED_SIZE - duration;
    }
    sprite.tint = colors.muted;
  }

  private setBoundsForWhiteKey(sprite: Sprite, pitch: number, keyWidth: number): void {
    const whitesBefore = this.countWhiteKeysBefore(pitch);
    sprite.x = whitesBefore * keyWidth + 1;
    sprite.width = keyWidth - 2;
  }

  private setBoundsForBlackKey(sprite: Sprite, pitch: number, keyWidth: number): void {
    const whitesBefore = this.countWhiteKeysBefore(pitch);

    sprite.x = whitesBefore * keyWidth - keyWidth * 0.25 + 1;
    sprite.width = keyWidth / 2 - 2;
  }

  private countWhiteKeysBefore(pitch: number): number {
    let count = 0;
    for (let i = 0; i < pitch; i++) {
      if (![1, 3, 6, 8, 10].includes(i % 12)) count++;
    }
    return count;
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

    const { noteCount, startTicks, durations, pitches } = this.getMergedTracksData();
    const { colors } = this.deps.engine;
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
      sprite.y = noteHeight * (128 - pitches[i]);
      sprite.width = durations[i];
      sprite.height = noteHeight;
      sprite.tint = colors.muted;
    }

    for (let i = noteCount; i < this.pool.length; i++) {
      this.pool[i].visible = false;
    }

    logger.draw("GrayedNotes", Date.now() - start);
  }
}
