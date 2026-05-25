import { Sequencer, WorkerSynthesizer } from "spessasynth_lib";
import { Action, type MidiAction } from "../../types/actions";
import { logger } from "../../lib/logger";
// @ts-ignore
import soundfont from "@/assets/soundfonts/GeneralUserGS.sf3";
import type { State } from "../../types/instance";
import { useMidiStore } from "../../stores/use-midi-store";
import { convertTickToSeconds } from "../../lib/utils";
import { AudioCore } from "./audioCore";

export class StoreConnector {
  midiState: State | null = null;
  dispatch: (action: MidiAction) => void = () => {};

  private readonly dirtyFlags = new Set<Action>();
  private readonly unsubscribe: () => void;

  constructor(onActionsQueued: (flags: Set<Action>) => void) {
    this.unsubscribe = useMidiStore.subscribe((store) => {
      this.midiState = store.state;
      this.dispatch = store.dispatch;
      if (store.state) store.state.queuedActions.forEach((action) => this.dirtyFlags.add(action));
      onActionsQueued(this.dirtyFlags);
    });
  }

  consumeFlags(): Set<Action> {
    const snapshot = new Set(this.dirtyFlags);
    this.dirtyFlags.clear();
    return snapshot;
  }

  destroy() {
    this.unsubscribe();
  }
}
