import { Container, type FederatedPointerEvent, Graphics } from "pixi.js";
import Renderer, { type RendererDeps } from "./renderer";
import { Action } from "../types/actions";
import type ViewportRenderer from "./viewport-renderer";
export interface PlayheadRendererDeps extends RendererDeps {
  viewportRenderer: ViewportRenderer;
}
export default abstract class PlayheadRenderer extends Renderer<PlayheadRendererDeps> {
  public abstract updatePlayhead(playheadPosition: number): void;
  public abstract drawTracklist(): void;
  public abstract setStart(e: FederatedPointerEvent): void;

  public abstract hidePlayhead(): void;
}

export class PlayerTacklistRenderer extends PlayheadRenderer {
  private tracklist = new Graphics({ label: "Tracklist" });
  constructor(deps: PlayheadRendererDeps) {
    super(deps);
    this.container = new Container({
      label: "Playhead",
      eventMode: "none",
    });
    this.container.addChild(this.tracklist);
    this.initGraphics();
  }

  private initGraphics(): void {
    const { width } = this.deps.app.screen;

    this.tracklist.clear();
    this.tracklist.moveTo(0, 0).lineTo(width, 0).stroke({ color: "#00ff40", pixelLine: true });
  }

  public updatePlayhead(playheadPosition: number): void {
    this.deps.viewportRenderer.scrollToTick(playheadPosition);
  }

  public drawTracklist(): void {
    const { start, totalDuration } = this.state.transport;

    const { width } = this.deps.app.screen;

    this.tracklist.clear();
    this.tracklist
      .moveTo(0, totalDuration - start)
      .lineTo(width, totalDuration - start)
      .stroke({ color: "#00ff40", pixelLine: true });
  }
  public hidePlayhead(): void {}

  public setStart(e: FederatedPointerEvent) {
    const viewport = this.deps.viewportRenderer.container;
    const { totalDuration } = this.state.transport;

    const local = viewport.toLocal(e.global);

    this.dispatch({
      type: Action.SET_TRANSPORT_START,
      start: Math.min(Math.max(0, totalDuration - local.y), totalDuration),
      skipHistory: true,
    });
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

  public drawTracklist(): void {
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
      skipHistory: true,
    });
  }
}
