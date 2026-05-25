import { Sequencer, WorkerSynthesizer } from "spessasynth_lib";
import { Action, type MidiAction } from "../../types/actions";
import { logger } from "../../lib/logger";
// @ts-ignore
import soundfont from "@/assets/soundfonts/GeneralUserGS.sf3";
import type { State } from "../../types/instance";
import { useMidiStore } from "../../stores/use-midi-store";
import { convertTickToSeconds } from "../../lib/utils";

export class AudioCore {
  private _baseTempo: number | null = null;
  public onMeasureUpdate: (measure: number) => void = () => {};

  private constructor(
    readonly synth: WorkerSynthesizer,
    readonly sequencer: Sequencer,
    public onLoopEnd: () => void
  ) {
    sequencer.eventHandler.addEvent("metaEvent", "eventId", (e) => {
      const { event: midiMsg } = e;
      if (midiMsg.statusByte === 0x06) {
        const markerText = new TextDecoder().decode(midiMsg.data);
        const bar_match = markerText.match(/Bar_(\d+)/);
        if (bar_match) {
          const measureIndex = parseInt(bar_match[1], 10);
          return this.onMeasureUpdate(measureIndex);
        } else if (markerText === "LoopEnd") {
          return this.onLoopEnd();
        } else if (markerText === "LoopStart") {
        }
      }
    });
  }

  static async init(context: AudioContext): Promise<AudioCore> {
    const response = await fetch(soundfont);
    const sFbuffer = await response.arrayBuffer();

    await WorkerSynthesizer.registerPlaybackWorklet(context);

    const worker = new Worker(new URL("./worker_synth_worker.js", import.meta.url), {
      type: "module",
    });

    const synth = new WorkerSynthesizer(context, worker.postMessage.bind(worker));

    worker.addEventListener("message", (event) => synth.handleWorkerMessage(event.data));

    await synth.isReady;
    await synth.soundBankManager.addSoundBank(sFbuffer, "main");
    synth.connect(context.destination);

    const sequencer = new Sequencer(synth);

    return new AudioCore(synth, sequencer, () => {});
  }

  get currentTime() {
    return this.sequencer.currentHighResolutionTime;
  }

  get currentTempo() {
    return this.sequencer.currentTempo;
  }

  get isPlaying() {
    return !this.sequencer.paused;
  }

  private static parseBaseTempo(midiBuffer: ArrayBuffer): number {
    const data = new Uint8Array(midiBuffer);
    for (let i = 0; i < data.length - 6; i++) {
      if (data[i] === 0xff && data[i + 1] === 0x51 && data[i + 2] === 0x03) {
        const microsecondsPerBeat = (data[i + 3] << 16) | (data[i + 4] << 8) | data[i + 5];
        return 60_000_000 / microsecondsPerBeat;
      }
    }
    return 120;
  }

  captureBaseTempo(midiBuffer: ArrayBuffer) {
    this._baseTempo = AudioCore.parseBaseTempo(midiBuffer);
  }

  get baseTempo(): number {
    return this._baseTempo ?? this.sequencer.currentTempo;
  }

  setPlaybackRate(bpm: number) {
    this.sequencer.playbackRate = bpm / this.sequencer.currentTempo;
  }

  seekTo(tick: number, ppq: number) {
    const nativeTempo = this._baseTempo ?? 0;
    this.sequencer.currentTime = convertTickToSeconds(tick, nativeTempo, ppq);
  }

  allNotesOff() {
    for (let channel = 0; channel < 16; channel++) {
      this.synth.controllerChange(channel, 123, 0);
    }
  }
}
