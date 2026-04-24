import { type Application, Container } from "pixi.js";
import type { PianoRollEngine } from "../engines/piano-roll-engine";
import type { State } from "../types/instance";
import { useMidiStore } from "../stores/use-midi-store";
import type { MidiAction } from "../types/actions";

export interface RendererDeps {
  app: Application;
  engine: PianoRollEngine;
}

export default abstract class Renderer<TDeps extends RendererDeps> {
  public container: Container;
  constructor(protected deps: TDeps) {
    this.container = new Container();
  }

  protected get state(): State {
    return useMidiStore.getState().state;
  }

  protected dispatch(action: MidiAction) {
    useMidiStore.getState().dispatch(action);
  }

  public clearContainer() {
    while (this.container.children[0]) {
      this.container.children[0].destroy();
    }
  }
}
