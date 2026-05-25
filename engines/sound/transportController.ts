import { logger } from "@/lib/logger";
import { useMidiStore } from "@/midi-editor/stores/use-midi-store";
import { Action } from "@/midi-editor/types/actions";
import { AudioCore } from "./audioCore";
import { StoreConnector } from "./storeConnector";
import SoundEngine from "./sound-engine";

export class TransportController {
  private countInController: AbortController | null = null;
  private _currentMeasure: number = 0;
  private _seekPending: boolean = false;
  private _loopJumping: boolean = false;
  private _currentLoopIndex: number = 0;

  constructor(
    private readonly audio: AudioCore,
    private readonly store: StoreConnector,
    private readonly context: AudioContext,
    private readonly onMeasureChange: null | ((measure: number) => void)
  ) {
    this.audio.onMeasureUpdate = (m) => {
      if (this._seekPending) return;
      this._currentMeasure = m;
      SoundEngine.onMeasureChange?.(m);
    };
  }

  get currentMeasure() {
    return this._currentMeasure;
  }

  get isLoopJumping() {
    return this._loopJumping;
  }

  public loadNewMidi() {
    const state = useMidiStore.getState().state;
    if (!state) return;

    const { rawMidiBuffer, config, transport } = state;
    this._currentLoopIndex = 0;
    this.audio.sequencer.pause();
    this.audio.sequencer.playbackRate = 1;

    const cleanBuffer = rawMidiBuffer.buffer.slice(
      rawMidiBuffer.byteOffset,
      rawMidiBuffer.byteOffset + rawMidiBuffer.byteLength
    );

    this.audio.sequencer.loadNewSongList([
      { binary: cleanBuffer as ArrayBuffer, fileName: "exercise.mid" },
    ]);

    this.audio.captureBaseTempo(cleanBuffer as any);

    const targetBpm = useMidiStore.getState().state?.config.bpm;
    if (targetBpm) {
      this.audio.sequencer.playbackRate = targetBpm / this.audio.baseTempo;
    }

    if (config.loop) {
      this.audio.sequencer.loopCount = state.config.repeats;
    }

    if (transport && transport.start > 0) {
      this.audio.seekTo(transport.start, config.ppq);
    }

    this.audio.onLoopEnd = () => {
      const state = this.store.midiState;
      if (!state || !state.config.loop) return;
      this._loopJumping = true;
      this._currentLoopIndex++;
      if (this._currentLoopIndex >= state.config.repeats) this._loopJumping = false;
      this.audio.setPlaybackRate(
        state.config.bpm + state.config.bpmPractice * this._currentLoopIndex
      );
      this.transposeAllChannels(state.config.transpositionPractice * this._currentLoopIndex);
      this.audio.seekTo(state.config.loop.start, state.config.ppq);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          this._loopJumping = false;
        })
      );
    };
  }

  private transposeAllChannels(semitones: number) {
    const state = this.store.midiState;
    if (!state || semitones <= 0) return;
    for (const track of state.tracks) {
      this.audio.synth.transposeChannel(track.channel, semitones, false);
    }
  }

  private async play() {
    if (!this.audio.sequencer) return logger.warn("Séquenceur non prêt");
    const state = useMidiStore.getState().state;
    if (!state) return;
    this.audio.setPlaybackRate(
      state.config.bpm + state.config.bpmPractice * this._currentLoopIndex
    );
    this.countInController?.abort();
    this.countInController = new AbortController();
    const { signal } = this.countInController;

    if (this.context.state === "suspended") this.context.resume();
    if (state.config.countIn) {
      try {
        const bpm = this.store.midiState?.config.bpm ?? this.audio.sequencer.currentTempo;
        const msPerBeat = (60 / bpm) * 1000;

        for (let i = 0; i < 4; i++) {
          this.audio.synth.noteOn(9, 76, 100);
          await this.delay(msPerBeat, signal);
        }
        this.audio.sequencer.play();
      } catch (e) {
        if (e instanceof Error && e.message !== "aborted") {
          logger.error("Erreur pendant le décompte:", e);
        }
      } finally {
        this.countInController = null;
      }
    } else {
      this.audio.sequencer.play();
    }
  }

  private pause() {
    if (!this.audio.sequencer) return logger.warn("Séquenceur non prêt");

    if (this.countInController) {
      this.countInController.abort();
      this.countInController = null;
    }

    this.audio.sequencer.pause();
    const state = this.store.midiState;
    if (state) {
      const { config, transport } = state;
      this.audio.seekTo(transport.start, config.ppq);
    }
  }

  resume() {
    if (!this.audio.sequencer) return logger.warn("Séquenceur non prêt");
    this.audio.sequencer.currentTime = 0;
    this.audio.sequencer.pause();
    this._currentMeasure = 0;
    this._currentLoopIndex = 0;
    this._loopJumping = !!this.store.midiState?.config.repeats;
  }

  resetState(): void {
    this.countInController?.abort();
    this.countInController = null;

    this._currentMeasure = 0;
    this._seekPending = false;
  }

  processActions(flags: Set<Action>) {
    if (flags.size === 0 || !this.store.midiState) return;

    if (flags.has(Action.RESET_STATE)) {
      this.loadNewMidi();
    }

    if (flags.has(Action.SET_BPM)) {
      const targetBpm = this.store.midiState.config.bpm;
      this.audio.sequencer.playbackRate = targetBpm / this.audio.baseTempo;
    }
    if (
      flags.has(Action.SET_TRANSPORT_START) ||
      flags.has(Action.SET_TRANSPORT_START_FROM_MEASURE_INDEX)
    ) {
      const { config, transport, measuresStarts } = this.store.midiState;

      this._seekPending = true;
      this.audio.seekTo(transport.start, config.ppq);
      let closestMeasure = 0;

      let minDiff = Number.MAX_VALUE;

      for (const [mIndex, mTick] of measuresStarts.entries()) {
        const diff = Math.abs(mTick[0] - transport.start);

        if (diff < minDiff) {
          minDiff = diff;
          closestMeasure = mIndex;
        }

        if (minDiff === 0) break;
      }

      this._currentMeasure = closestMeasure;

      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            this._seekPending = false;
          })
        )
      );
    }

    if (flags.has(Action.SET_TRANSPORT_STATUS)) {
      const handlers: Record<string, () => void> = {
        playing: () => this.play(),
        paused: () => this.pause(),
        reset: () => this.resume(),
      };
      handlers[this.store.midiState.transport.status]?.();
    }
    if (flags.has(Action.SET_LOOP) || flags.has(Action.SET_REPEATS)) {
      this.audio.sequencer.loopCount = this.store.midiState.config.repeats;
    }
  }

  setCurrentMeasure(value: number) {
    this._currentMeasure = value;
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new Error("aborted"));
      });
    });
  }
}
