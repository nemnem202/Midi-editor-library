import { Container, type FederatedPointerEvent, type FederatedWheelEvent } from "pixi.js";
import Renderer, { type RendererDeps } from "./renderer";
import { ZOOM_FACTOR } from "../config/viewport";
import type PianoKeyboardRenderer from "./piano-keyboard-renderer";
import type BackgroundRenderer from "./background-renderer";
import type NotesRenderer from "./notes-renderer";
import { Event } from "../types/events";
import { logger } from "../lib/logger";
import type GridRenderer from "./grid-renderer";

export interface ViewportRendererDeps extends RendererDeps {
  pianoKeyboardRenderer: PianoKeyboardRenderer;
  backgroundRenderer: BackgroundRenderer;
  notesRenderer: NotesRenderer;
  eventsDirtyFlags: Set<Event>;
  gridRenderer: GridRenderer;
}

export default abstract class ViewportRenderer extends Renderer<ViewportRendererDeps> {
  protected pendingDx = 0;
  protected pendingDy = 0;
  protected pendingZoomDeltaY: number | null = null;
  protected pendingZoomCtrlKey = false;
  protected pendingZoomGlobalX = 0;
  protected pendingZoomGlobalY = 0;
  protected pendingCenterTick: number | null = null;

  public abstract draw(): void;

  public handleZoom(e: FederatedWheelEvent) {
    this.pendingZoomDeltaY = e.deltaY;
    this.pendingZoomCtrlKey = e.ctrlKey;
    this.pendingZoomGlobalX = e.globalX;
    this.pendingZoomGlobalY = e.globalY;
    this.deps.eventsDirtyFlags.add(Event.Viewport);
  }

  public tryPan(e: FederatedPointerEvent, lastPos: { x: number; y: number }) {
    this.pendingDx += e.global.x - lastPos.x;
    this.pendingDy += e.global.y - lastPos.y;
    this.deps.eventsDirtyFlags.add(Event.Viewport);
  }

  public centerOnTick(tick: number) {
    this.pendingCenterTick = tick;
    this.deps.eventsDirtyFlags.add(Event.Viewport);
  }

  public abstract scrollToTick(tick: number): void;

  protected abstract constrain(): void;
}

export class EditorViewportRenderer extends ViewportRenderer {
  constructor(deps: ViewportRendererDeps) {
    super(deps);
    const { pianoKeyboardSize } = this.deps.engine;
    this.container = new Container({
      label: "Viewport",
      x: pianoKeyboardSize,
      y: 0,
    });
  }

  protected constrain(): void {
    const { app } = this.deps;
    const { width, height } = app.screen;
    const { pianoKeyboardSize } = this.deps.engine;
    const contentWidth = this.state.transport.totalDuration * this.container.scale.x;
    const minX = width - contentWidth;
    this.container.x = Math.max(this.container.x, minX);
    this.container.x = Math.min(this.container.x, pianoKeyboardSize);

    const contentHeight = height * this.container.scale.y;
    const minY = height - contentHeight;
    this.container.y = Math.max(this.container.y, minY);
    this.container.y = Math.min(this.container.y, 0);
  }

  public draw(): void {
    const start = Date.now();
    const { pianoKeyboardSize } = this.deps.engine;
    if (this.pendingZoomDeltaY !== null) {
      const { width } = this.deps.app.screen;
      const { transport } = this.state;
      const availableWidth = width - pianoKeyboardSize;

      const worldPointerPos = {
        x: this.pendingZoomGlobalX,
        y: this.pendingZoomGlobalY,
      };
      const localPointerPos = this.container.toLocal(worldPointerPos);

      const isZoomIn = this.pendingZoomDeltaY < 0;
      const factor = isZoomIn ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;

      if (this.pendingZoomCtrlKey) {
        const minScaleY = 1;
        this.container.scale.y = Math.max(this.container.scale.y * factor, minScaleY);
      } else {
        const minScaleX = availableWidth / transport.totalDuration;
        this.container.scale.x = Math.max(this.container.scale.x * factor, minScaleX);
      }

      const newWorldPointerPosition = this.container.toGlobal(localPointerPos);
      this.container.x -= newWorldPointerPosition.x - worldPointerPos.x;
      this.container.y -= newWorldPointerPosition.y - worldPointerPos.y;

      if (!this.pendingZoomCtrlKey) this.deps.gridRenderer.draw();

      this.pendingZoomDeltaY = null;
      this.pendingZoomCtrlKey = false;
    }

    if (this.pendingDx !== 0 || this.pendingDy !== 0) {
      this.container.x += this.pendingDx;
      this.container.y += this.pendingDy;
      this.pendingDx = 0;
      this.pendingDy = 0;

      if (!this.pendingZoomCtrlKey) this.deps.gridRenderer.draw();
    }

    if (this.pendingCenterTick !== null) {
      const { width } = this.deps.app.screen;
      const targetX =
        pianoKeyboardSize + width / 2 - this.pendingCenterTick * this.container.scale.x;
      this.container.x = targetX;
      this.pendingCenterTick = null;
    }

    this.constrain();

    const keyboard = this.deps.pianoKeyboardRenderer.container;
    const background = this.deps.backgroundRenderer.container;
    keyboard.y = background.y = this.container.y;
    keyboard.scale.y = background.scale.y = this.container.scale.y;
    keyboard.x = 0;

    logger.draw("Viewport", Date.now() - start);
  }

  public scrollToTick(): void {}
}

export class PlayerViewportRenderer extends ViewportRenderer {
  constructor(deps: ViewportRendererDeps) {
    super(deps);
    this.container = new Container({
      label: "Viewport",
      x: 0,
      y: -this.state.transport.totalDuration,
    });
  }

  protected constrain(): void {
    const { app } = this.deps;
    const { width, height } = app.screen;
    const { pianoKeyboardSize } = this.deps.engine;
    const scaleY = this.container.scale.y;
    const scaleX = this.container.scale.x;

    const visibleHeight = height - pianoKeyboardSize;
    const contentHeight = this.state.transport.totalDuration * scaleY;

    const minY = visibleHeight - contentHeight;

    const maxY = height - pianoKeyboardSize;

    this.container.y = Math.max(this.container.y, minY);
    this.container.y = Math.min(this.container.y, maxY);

    const contentWidth = width * scaleX;
    const minX = width - contentWidth;
    this.container.x = Math.max(this.container.x, minX);
    this.container.x = Math.min(this.container.x, 0);
  }

  public draw(): void {
    const start = Date.now();
    let needsGridUpdate = false;
    const { pianoKeyboardSize } = this.deps.engine;
    if (this.pendingZoomDeltaY !== null) {
      const { height } = this.deps.app.screen;
      const { transport } = this.state;
      const availableHeight = height - pianoKeyboardSize;

      const worldPointerPos = {
        x: this.pendingZoomGlobalX,
        y: this.pendingZoomGlobalY,
      };
      const localPointerPos = this.container.toLocal(worldPointerPos);

      const isZoomIn = this.pendingZoomDeltaY < 0;
      const factor = isZoomIn ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;

      if (this.pendingZoomCtrlKey) {
        const minScaleX = 1;
        this.container.scale.x = Math.max(this.container.scale.x * factor, minScaleX);
      } else {
        const minScaleY = availableHeight / transport.totalDuration;
        this.container.scale.y = Math.max(this.container.scale.y * factor, minScaleY);
        needsGridUpdate = true;
      }

      const newWorldPointerPosition = this.container.toGlobal(localPointerPos);
      this.container.x -= newWorldPointerPosition.x - worldPointerPos.x;
      this.container.y -= newWorldPointerPosition.y - worldPointerPos.y;

      this.pendingZoomDeltaY = null;
    }

    if (this.pendingDx !== 0 || this.pendingDy !== 0) {
      this.container.x += this.pendingDx;
      this.container.y += this.pendingDy;
      this.pendingDx = 0;
      this.pendingDy = 0;
      needsGridUpdate = true;
    }

    if (this.pendingCenterTick !== null) {
      const { height } = this.deps.app.screen;
      const targetY =
        pianoKeyboardSize +
        (height - pianoKeyboardSize) / 2 -
        this.pendingCenterTick * this.container.scale.y;
      this.container.y = targetY;
      this.pendingCenterTick = null;
      needsGridUpdate = true;
    }

    this.constrain();

    if (needsGridUpdate) {
      this.deps.gridRenderer.draw();
    }

    const keyboard = this.deps.pianoKeyboardRenderer.container;
    const background = this.deps.backgroundRenderer.container;

    keyboard.x = background.x = this.container.x;
    keyboard.scale.x = background.scale.x = this.container.scale.x;
    keyboard.y = 0;

    logger.draw("Viewport", Date.now() - start);
  }

  public scrollToTick(tick: number): void {
    const { totalDuration } = this.state.transport;
    const { height } = this.deps.app.screen;
    const { pianoKeyboardSize } = this.deps.engine;
    const scaleY = this.container.scale.y;

    const localY = totalDuration - tick;
    const targetWorldY = height - pianoKeyboardSize;

    this.container.y = targetWorldY - localY * scaleY;
    this.constrain();
    this.deps.eventsDirtyFlags.add(Event.Viewport);
  }
}
