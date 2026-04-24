import {
  Container,
  type FederatedPointerEvent,
  Point,
  Sprite,
  Texture,
  type SpriteOptions,
} from "pixi.js";
import Renderer, { type RendererDeps } from "./renderer";
import { logger } from "../lib/logger";
import type ViewportRenderer from "./viewport-renderer";
import { Action } from "../types/actions";
import { Event } from "../types/events";

export class NoteSprite extends Sprite {
  constructor(
    public readonly index: number,
    options?: SpriteOptions
  ) {
    super({ ...options, label: "Note" });
  }
}
export interface NotesRendererDeps extends RendererDeps {
  viewportRenderer: ViewportRenderer;
  eventsDirtyFlags: Set<Event>;
}
export default abstract class NotesRenderer extends Renderer<NotesRendererDeps> {
  protected pool: NoteSprite[] = [];
  protected dragState: {
    noteIndex: number;
    offset: { x: number; y: number };
    delta: { x: number; y: number };
    pending: { x: number; y: number };
    lastGlobalX: number;
    lastGlobalY: number;
    selectedPool: NoteSprite[];
  } | null = null;

  public abstract draw(): void;

  public abstract updateDrag(): void;

  public abstract handleNoteDrag(e: FederatedPointerEvent): void;

  public abstract startNoteDrag(e: FederatedPointerEvent): void;

  public abstract endNoteDrag(): void;

  public abstract deleteNote(e: FederatedPointerEvent): void;

  public abstract addNote(e: FederatedPointerEvent): void;
}

export class PlayerNotesRenderer extends NotesRenderer {
  constructor(deps: NotesRendererDeps) {
    super(deps);
    this.container = new Container({
      label: "Notes",
      x: 0,
      y: 0,
      width: this.deps.app.screen.height,
      height: this.state.transport.totalDuration,
    });
  }

  public draw(): void {
    if (!this.state?.tracks) return;

    const start = Date.now();

    const { tracks, currentTrackId } = this.state;
    const { totalDuration } = this.state.transport;
    const currentTrack = tracks.find((t) => t.id === currentTrackId);
    if (!currentTrack) return;
    const { noteCount, startTicks, durationInTicks, midiValues } = currentTrack.data;
    const { colors } = this.deps.engine;
    const { width } = this.deps.app.screen;
    const noteWidth = width / 128.5;

    for (let i = 0; i < noteCount; i++) {
      let sprite = this.pool[i];

      if (!sprite) {
        sprite = new NoteSprite(i, {
          texture: Texture.WHITE,
          eventMode: "dynamic",
        });
        this.pool[i] = sprite;
        this.container.addChild(sprite);
      }
      sprite.visible = true;
      sprite.y = totalDuration - startTicks[i] - durationInTicks[i];
      sprite.x = noteWidth * midiValues[i];
      sprite.width = noteWidth;
      sprite.height = durationInTicks[i];
      sprite.tint = colors.primary;
    }

    for (let i = noteCount; i < this.pool.length; i++) {
      this.pool[i].visible = false;
    }

    logger.draw("Notes", Date.now() - start);
  }

  public updateDrag() {}

  public handleNoteDrag(_: FederatedPointerEvent): void {}

  public startNoteDrag(_: FederatedPointerEvent): void {}

  public endNoteDrag(): void {}

  public deleteNote(_: FederatedPointerEvent) {}

  public addNote(_: FederatedPointerEvent) {}
}

export class EditorNotesRenderer extends NotesRenderer {
  constructor(deps: NotesRendererDeps) {
    super(deps);
    this.container = new Container({
      label: "Notes",
      x: 0,
      y: 0,
      width: this.state.transport.totalDuration,
      height: this.deps.app.screen.height,
    });
  }
  public draw(): void {
    if (!this.state?.tracks) return;

    const start = Date.now();

    const { tracks, currentTrackId } = this.state;
    const currentTrack = tracks.find((t) => t.id === currentTrackId);
    logger.info("Current track", currentTrack?.data);
    if (!currentTrack) return;
    const { noteCount, startTicks, durationInTicks, midiValues, selectedNotes } = currentTrack.data;
    const { colors } = this.deps.engine;
    const noteHeight = this.deps.app.screen.height / 128;

    for (let i = 0; i < noteCount; i++) {
      let sprite = this.pool[i];

      if (!sprite) {
        sprite = new NoteSprite(i, {
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
      sprite.tint = selectedNotes[i] === 1 ? colors.secondary : colors.primary;
    }

    for (let i = noteCount; i < this.pool.length; i++) {
      this.pool[i].visible = false;
    }

    logger.draw("Notes", Date.now() - start);
  }

  public updateDrag() {
    if (!this.dragState) return;
    const { selectedPool } = this.dragState;
    for (let i = 0; i < selectedPool.length; i++) {
      selectedPool[i].x += this.dragState.pending.x;
      selectedPool[i].y += this.dragState.pending.y;
    }

    this.dragState.pending = { x: 0, y: 0 };
  }

  public handleNoteDrag(e: FederatedPointerEvent): void {
    if (!this.dragState) return;

    const noteHeight = this.deps.app.screen.height / 128;

    const lastLocal = this.container.toLocal(
      new Point(this.dragState.lastGlobalX, this.dragState.lastGlobalY)
    );

    const currLocal = this.container.toLocal(new Point(e.globalX, e.globalY));

    lastLocal.y = Math.round(lastLocal.y / noteHeight) * noteHeight;
    currLocal.y = Math.round(currLocal.y / noteHeight) * noteHeight;

    const dx = currLocal.x - lastLocal.x;
    const dy = currLocal.y - lastLocal.y;

    this.deps.eventsDirtyFlags.add(Event.NotesDrag);

    this.dragState.delta.x += dx;
    this.dragState.delta.y += dy;

    this.dragState.pending.x += dx;
    this.dragState.pending.y += dy;

    this.dragState.lastGlobalX = e.globalX;
    this.dragState.lastGlobalY = e.globalY;
  }

  public startNoteDrag(e: FederatedPointerEvent): void {
    const target = e.target as NoteSprite;

    if (!(target instanceof NoteSprite) || Number.isNaN(target.index)) return;

    const { tracks, currentTrackId } = this.state;
    const { selectedNotes } = tracks[currentTrackId].data;

    const localOffset = target.toLocal(e.global);
    const selectedPool: NoteSprite[] = [];

    const hasSelection = selectedNotes.some((v) => v === 1);

    if (!hasSelection || selectedNotes[target.index] !== 1) {
      this.dispatch({
        type: Action.SELECT_NOTE,
        index: target.index,
        trackId: currentTrackId,
      });
      selectedPool.push(target);
    } else {
      for (let i = 0; i < selectedNotes.length; i++) {
        if (selectedNotes[i] === 1) selectedPool.push(this.pool[i]);
      }
    }

    this.dragState = {
      noteIndex: target.index,
      offset: { x: localOffset.x, y: localOffset.y },
      delta: { x: 0, y: 0 },
      pending: { x: 0, y: 0 },
      lastGlobalX: e.globalX,
      lastGlobalY: e.globalY,
      selectedPool,
    };
    logger.info("Note drag start");
  }

  public endNoteDrag(): void {
    if (!this.dragState) return;

    const { currentTrackId } = this.state;
    const noteHeight = this.deps.app.screen.height / 128;

    const tickOffset = Math.round(this.dragState.delta.x);
    const midiOffset = -Math.round(this.dragState.delta.y / noteHeight);
    this.dispatch({
      type: Action.MOVE_SELECTED_NOTES,
      midiOffset,
      tickOffset,
      trackId: currentTrackId,
    });

    this.dragState = null;
    logger.info("Note drag end");
  }

  public deleteNote(_: FederatedPointerEvent) {}

  public addNote(_: FederatedPointerEvent) {}
}
