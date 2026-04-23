import { logger } from "../lib/logger";
import Renderer, { type RendererDeps } from "./renderer";

export interface LoopRendererDeps extends RendererDeps {}

export default class LoopRenderer extends Renderer<LoopRendererDeps> {
  public draw(): void {
    logger.draw("Loop");
  }
}
