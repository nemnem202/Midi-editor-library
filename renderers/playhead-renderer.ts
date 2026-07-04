import { Container, type FederatedPointerEvent, Graphics } from "pixi.js";
import Renderer, { type RendererDeps } from "./renderer";
import { Action } from "../types/actions";
import type ViewportRenderer from "./viewport-renderer";
import { logger } from "@/lib/logger";
export interface PlayheadRendererDeps extends RendererDeps {
  viewportRenderer: ViewportRenderer;
}
export default abstract class PlayheadRenderer extends Renderer<PlayheadRendererDeps> {
  public abstract updatePlayhead(playheadPosition: number): void;
  public abstract draw(): void;
  public abstract setStart(e: FederatedPointerEvent): void;

  public abstract hidePlayhead(): void;
}

export class PlayerTacklistRenderer extends PlayheadRenderer {
  private tracklist = new Graphics({ label: "Tracklist" });
  private playhead = new Graphics({ label: "Playhead" });
  constructor(deps: PlayheadRendererDeps) {
    super(deps);
    this.container = new Container({
      label: "Playhead",
      eventMode: "none",
    });
    this.container.addChild(this.tracklist);
    this.container.addChild(this.playhead);
    this.playhead.clear();
    const { width } = this.deps.app.screen;
    this.playhead
      .moveTo(0, 0)
      .lineTo(width, 0)
      .stroke({ color: this.deps.engine.colors.secondary, pixelLine: true });
    this.playhead.visible = false;
  }

  public draw(): void {
    const { width } = this.deps.app.screen;
    const currentMeasureIndex = this.state.transport.currentMeasureIndex;
    const transportStart = this.state.transport.start;
    const totalDuration = this.state.transport.totalDuration;
    this.tracklist.clear();
    this.tracklist.moveTo(0, totalDuration - transportStart - 1);
    this.tracklist.lineTo(width, totalDuration - transportStart - 1);
    this.tracklist.stroke({ color: this.deps.engine.colors.primary, pixelLine: true });
  }

  public setStart(e: FederatedPointerEvent): void {
    const viewport = this.deps.viewportRenderer.container;
    const local = viewport.toLocal(e.global);
    const { totalDuration } = this.state.transport;
    this.dispatch({
      type: Action.SET_TRANSPORT_START,
      start: Math.min(Math.max(totalDuration - local.y, 0), totalDuration),
    });
  }

  public hidePlayhead(): void {
    this.playhead.visible = false;
  }

  public updatePlayhead(playheadPosition: number): void {
    const { totalDuration } = this.state.transport;
    if (!this.playhead.visible) {
      this.playhead.visible = true;
    }
    this.playhead.y = totalDuration - playheadPosition + 1;
  }
}

export class EditorPlayheadRenderer extends PlayheadRenderer {
  private playhead = new Graphics({ label: "Playhead" });
  private tracklist = new Graphics({ label: "Tracklist" });

  constructor(deps: PlayheadRendererDeps) {
    super(deps);
    const { height } = this.deps.app.screen;
    const totalDuration = this.state.transport.totalDuration;
    this.container = new Container({
      label: "Playhead",
      eventMode: "none",
      x: 0,
      y: 0,
      height,
      width: totalDuration,
    });
    this.container.addChild(this.playhead);
    this.container.addChild(this.tracklist);
    this.initGraphics();
  }
  private initGraphics(): void {
    const { height } = this.deps.app.screen;

    this.playhead.clear();
    this.playhead.moveTo(0, 0).lineTo(0, height).stroke({ color: "#d3d3d3", pixelLine: true });

    this.tracklist.clear();
    this.tracklist.moveTo(0, 0).lineTo(0, height).stroke({ color: "#00ff40", pixelLine: true });
  }

  public updatePlayhead(playheadPosition: number): void {
    if (!this.playhead.visible) {
      this.playhead.visible = true;
    }
    this.playhead.x = playheadPosition;
  }

  public draw(): void {
    const { start } = this.state.transport;

    this.tracklist.x = start;
  }

  public hidePlayhead(): void {
    this.playhead.visible = false;
  }

  public setStart(e: FederatedPointerEvent) {
    const viewport = this.deps.viewportRenderer.container;
    const local = viewport.toLocal(e.global);
    this.dispatch({
      type: Action.SET_TRANSPORT_START,
      start: Math.min(Math.max(local.x, 0), this.state.transport.totalDuration),
    });
  }
}
