import { Sequencer, WorkerSynthesizer } from "spessasynth_lib";
import { Action } from "../../types/actions";
// @ts-ignore
import soundfont from "@/assets/soundfonts/GeneralUserGS.sf3";
import type { State } from "../../types/instance";
import { useMidiStore } from "../../stores/use-midi-store";
import { SequencerUnit } from "./sequencerUnit";
import { PracticeLogic } from "./practiceLogic";
import { NoteEvent, NoteTracker } from "./noteTracker";

export default class SoundEngine {
  private static instance: SoundEngine | null = null;
  private static context: AudioContext | null = null;

  private unit!: SequencerUnit;
  private practice = new PracticeLogic();
  private countInController: AbortController | null = null;
  private noteTracker: NoteTracker | null = null;

  public currentMeasure = 0;
  private _loopJumping = false;
  private _seekPending = false;

  public static onMeasureChange: ((m: number) => void) | null = null;

  private constructor() {
    this.setupStoreSubscription();
  }

  static async initAudio(): Promise<SoundEngine> {
    if (this.instance) return this.instance;

    this.context = new AudioContext();

    const response = await fetch(soundfont);
    const sFbuffer = await response.arrayBuffer();
    await WorkerSynthesizer.registerPlaybackWorklet(this.context);

    const worker = new Worker(new URL("./worker_synth_worker.js", import.meta.url), {
      type: "module",
    });
    const synth = new WorkerSynthesizer(this.context, worker.postMessage.bind(worker));
    worker.onmessage = (event) => synth.handleWorkerMessage(event.data);

    await synth.isReady;
    await synth.soundBankManager.addSoundBank(sFbuffer, "main");
    synth.connect(this.context.destination);

    const sequencer = new Sequencer(synth);

    this.instance = new SoundEngine();
    this.instance.unit = new SequencerUnit(synth, sequencer);
    this.instance.setupMidiListeners();
    this.instance.noteTracker = new NoteTracker(synth);

    const state = useMidiStore.getState().state;
    if (state?.rawMidiBuffer) this.instance.loadNewMidi(state);

    return this.instance;
  }

  private setupMidiListeners() {
    this.unit.sequencer.eventHandler.addEvent("metaEvent", "engine", (e) => {
      const { event: midiMsg } = e;
      if (midiMsg.statusByte !== 0x06) return;

      const text = new TextDecoder().decode(midiMsg.data);
      if (text.includes("Bar_")) {
        if (this._seekPending) return;
        this.currentMeasure = parseInt(text.split("_")[1], 10);
        SoundEngine.onMeasureChange?.(this.currentMeasure);
      } else if (text === "LoopEnd") {
        this.handleLoopIteration();
      }
    });

    this.unit.sequencer.eventHandler.addEvent("songEnded", "engine", () => {
      if (this._loopJumping) return;
      this.reset();
      useMidiStore.getState().dispatch({ type: Action.SET_TRANSPORT_STATUS, status: "reset" });
    });
  }

  private setupStoreSubscription() {
    useMidiStore.subscribe((store) => {
      if (store.state && store.state.queuedActions.size > 0) {
        this.processActions(store.state, Array.from(store.state.queuedActions));
      }
    });
  }

  private processActions(state: State, actions: Action[]) {
    for (const action of actions) {
      switch (action) {
        case Action.SET_TRANSPORT_STATUS:
          this.syncTransport(state);
          break;
        case Action.SET_BPM:
          this.unit.setPlaybackRate(state.config.bpm);
          break;
        case Action.RESET_STATE:
          this.loadNewMidi(state);
          break;
        case Action.SET_TRANSPORT_START:
        case Action.SET_TRANSPORT_START_FROM_MEASURE_INDEX:
          this.handleSeek(state);
          break;
        case Action.SET_REPEATS:
          this.unit.sequencer.loopCount = state.config.repeats;
          break;
      }
    }
  }

  private loadNewMidi(state: State) {
    this.unit.sequencer.pause();
    const { rawMidiBuffer, config, transport } = state;

    const cleanBuffer = rawMidiBuffer.buffer.slice(
      rawMidiBuffer.byteOffset,
      rawMidiBuffer.byteOffset + rawMidiBuffer.byteLength
    );

    this.unit.sequencer.loadNewSongList([
      { binary: cleanBuffer as ArrayBuffer, fileName: "exercise.mid" },
    ]);
    this.unit.captureBaseTempo(cleanBuffer as any);
    this.unit.setPlaybackRate(config.bpm);
    this.unit.sequencer.loopCount = config.repeats;

    if (transport.start > 0) {
      this.unit.seek(transport.start, config.ppq);
    }
  }

  private async syncTransport(state: State) {
    const status = state.transport.status;

    if (status === "playing") {
      if (SoundEngine.context?.state === "suspended") await SoundEngine.context.resume();
      this.playWithCountIn(state);
    } else if (status === "paused") {
      this.stopCountIn();
      this.unit.sequencer.pause();
    } else if (status === "reset") {
      this.reset();
    }
  }

  private async playWithCountIn(state: State) {
    this.stopCountIn();

    if (state.config.countIn) {
      this.countInController = new AbortController();
      const { signal } = this.countInController;
      const msPerBeat = (60 / state.config.bpm) * 1000;

      try {
        for (let i = 0; i < 4; i++) {
          this.unit.synth.noteOn(9, 76, 100);
          await new Promise((res, rej) => {
            const t = setTimeout(res, msPerBeat);
            signal.addEventListener("abort", () => {
              clearTimeout(t);
              rej();
            });
          });
        }
        this.unit.sequencer.play();
      } catch (e) {
        /* Aborted */
      }
    } else {
      this.unit.sequencer.play();
    }
  }

  private handleLoopIteration() {
    const state = useMidiStore.getState().state;
    if (!state || !state.config.loop) return;

    const next = this.practice.getNextIterationParams(state);

    if (!next) {
      this._loopJumping = false;
      return; // Le sequencer s'arrêtera via songEnded
    }

    this._loopJumping = true;

    // Update Store
    useMidiStore.getState().dispatch({
      type: Action.SET_LOOP,
      loop: { ...state.config.loop, currentRepeatIndex: next.repeatIndex },
    });

    // Apply Hardware
    this.unit.setPlaybackRate(next.targetBpm);
    this.unit.transposeAllChannels(state, next.targetTranspose);
    this.unit.seek(next.startTick, state.config.ppq);

    // Reset loop jumping flag après un court délai
    setTimeout(() => {
      this._loopJumping = false;
    }, 100);
  }

  private handleSeek(state: State) {
    this._seekPending = true;
    this.unit.seek(state.transport.start, state.config.ppq);

    let closestMeasure = 0;
    let minDiff = Number.MAX_VALUE;
    for (const [mIndex, mTick] of state.measuresStarts.entries()) {
      const diff = Math.abs(mTick[0] - state.transport.start);
      if (diff < minDiff) {
        minDiff = diff;
        closestMeasure = mIndex;
      }
    }
    this.currentMeasure = closestMeasure;

    requestAnimationFrame(() => {
      this._seekPending = false;
    });
  }

  private stopCountIn() {
    this.countInController?.abort();
    this.countInController = null;
  }

  public reset() {
    this.stopCountIn();
    this.unit.sequencer.pause();
    this.unit.sequencer.currentTime = 0;
    this.currentMeasure = 0;
    this._loopJumping = false;
  }

  public static get() {
    return this.instance;
  }
  public get currentTime() {
    return this.unit.sequencer.currentHighResolutionTime;
  }
  public get currentTempo() {
    return this.unit.sequencer.currentTempo;
  }
  public get isPlaying() {
    return !this.unit.sequencer.paused;
  }
  public get notesEvents(): NoteEvent[] {
    return this.noteTracker?.notesEvents ?? [];
  }
  public clearNotesEvents() {
    this.noteTracker?.clearNotesEvents();
  }
  public changeChannelVolume(ch: number, vol: number) {
    this.unit.synth.controllerChange(ch, 7, vol);
  }
  public setCurrentMeasure(m: number) {
    this.currentMeasure = m;
  }
}
