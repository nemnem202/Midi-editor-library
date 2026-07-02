import { logger } from "@/lib/logger";
import { convertTickToSeconds } from "@/midi-editor/lib/utils";
import { State } from "@/midi-editor/types/instance";
import { Sequencer, WorkerSynthesizer } from "spessasynth_lib";

export class SequencerUnit {
  private _baseTempo = 120;

  constructor(
    public readonly synth: WorkerSynthesizer,
    public readonly sequencer: Sequencer
  ) {}

  captureBaseTempo(midiBuffer: ArrayBuffer) {
    const data = new Uint8Array(midiBuffer);
    for (let i = 0; i < data.length - 6; i++) {
      if (data[i] === 0xff && data[i + 1] === 0x51 && data[i + 2] === 0x03) {
        const microsecondsPerBeat = (data[i + 3] << 16) | (data[i + 4] << 8) | data[i + 5];
        this._baseTempo = 60_000_000 / microsecondsPerBeat;
        return;
      }
    }
  }

  get baseTempo() {
    return this._baseTempo;
  }

  setPlaybackRate(bpm: number) {
    this.sequencer.playbackRate = bpm / this._baseTempo;
  }

  async transposeAllChannels(state: State, forceCurrentRepeat?: number) {
    let semitones = state.config.transposition;

    if (state.config.loop) {
      const currentRepeat: number = forceCurrentRepeat
        ? forceCurrentRepeat
        : state.config.loop.currentRepeatIndex;
      semitones += state.config.transpositionPractice * currentRepeat;
    }
    // for (const track of state.tracks) {
    //   // this.synth.transposeChannel(track.channel, semitones, false);
    //   this.synth.controllerChange(track.channel, )
    // }

    const snapshot = await this.synth.getSnapshot();
    snapshot.systemParameters.fineTune = semitones;
  }

  seek(tick: number, ppq: number) {
    this.sequencer.currentTime = convertTickToSeconds(tick, this._baseTempo, ppq);
  }
}
