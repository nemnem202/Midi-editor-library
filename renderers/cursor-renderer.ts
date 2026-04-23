import type { CSSProperties } from "react";
import Renderer, { type RendererDeps } from "./renderer";
import { Event } from "../types/events";
export interface CursorRendererDeps extends RendererDeps {}
export default class CursorRenderer extends Renderer<CursorRendererDeps> {
  private currentCursor: CSSProperties["cursor"] = "default";
  private lockKey: string | null = null;

  public draw() {
    document.body.style.cursor = this.currentCursor as string;
  }
  public setCursor(cursor: CSSProperties["cursor"], lockKey?: string) {
    if ((!this.lockKey || lockKey === this.lockKey) && cursor !== this.currentCursor) {
      this.deps.engine.markEventDirtyFlag(Event.Cursor);
      this.currentCursor = cursor;
    }
    return this;
  }

  public lock(lockKey: string) {
    if (!this.lockKey) this.lockKey = lockKey;
  }

  public unlock(lockKey: string) {
    if (lockKey === this.lockKey) {
      this.lockKey = null;
    }
    return this;
  }
}
