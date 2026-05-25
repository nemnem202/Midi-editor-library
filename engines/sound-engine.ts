import { Sequencer, WorkerSynthesizer } from "spessasynth_lib";
import { Action, type MidiAction } from "../types/actions";
import { logger } from "../lib/logger";
// @ts-ignore
import soundfont from "@/assets/soundfonts/GeneralUserGS.sf3";
import type { State } from "../types/instance";
import { useMidiStore } from "../stores/use-midi-store";
import { convertTickToSeconds } from "../lib/utils";

export class AudioCore {
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

  setPlaybackRate(bpm: number) {
    this.sequencer.playbackRate = bpm / this.sequencer.currentTempo;
  }

  seekTo(tick: number, bpm: number, ppq: number) {
    this.sequencer.currentTime = convertTickToSeconds(tick, bpm, ppq);
  }

  allNotesOff() {
    for (let channel = 0; channel < 16; channel++) {
      this.synth.controllerChange(channel, 123, 0);
    }
  }
}

export type NoteOnCallback = { midiNote: number; channel: number; velocity: number };
export type NoteOffCallback = { midiNote: number; channel: number };
export enum NoteEventKind {
  On,
  Off,
}

export type NoteEvent = (NoteOnCallback | NoteOffCallback) & { type: NoteEventKind };

export class NoteTracker {
  private readonly _notesEvents: NoteEvent[] = [];
  private activeMidiNotes = new Set<string>();

  private noteKey(midiNote: number, channel: number) {
    return `${channel}:${midiNote}`;
  }
  constructor(private synth: WorkerSynthesizer) {
    synth.eventHandler.addEvent("noteOn", "Id note on", (note: NoteOnCallback) => {
      this._notesEvents.push({ ...note, type: NoteEventKind.On });
      this.activeMidiNotes.add(this.noteKey(note.midiNote, note.channel));
    });

    synth.eventHandler.addEvent("noteOff", "Id note off", (note: NoteOffCallback) => {
      const key = this.noteKey(note.midiNote, note.channel);
      if (this.activeMidiNotes.has(key)) {
        this._notesEvents.push({ ...note, type: NoteEventKind.Off });
        this.activeMidiNotes.delete(key);
      }
    });
  }

  get notesEvents() {
    return this._notesEvents;
  }

  clearNotesEvents() {
    this._notesEvents.length = 0;
  }

  resetNotesEvents() {
    this._notesEvents.length = 0;
    this.activeMidiNotes.clear();
  }
}

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

export class TransportController {
  private countInController: AbortController | null = null;
  private _currentMeasure: number = 0;
  private _seekPending: boolean = false;
  private _loopJumping: boolean = false;

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
    if (!state?.rawMidiBuffer) return;

    const { rawMidiBuffer, config } = state;

    this.audio.sequencer.pause();

    const cleanBuffer = rawMidiBuffer.buffer.slice(
      rawMidiBuffer.byteOffset,
      rawMidiBuffer.byteOffset + rawMidiBuffer.byteLength
    );

    this.audio.sequencer.loadNewSongList([
      { binary: cleanBuffer as ArrayBuffer, fileName: "exercise.mid" },
    ]);

    if (config.loop) {
      this.audio.sequencer.loopCount = Infinity;
    }

    this.audio.onLoopEnd = () => {
      if (!config.loop) return;
      this._loopJumping = true;
      this.audio.seekTo(config.loop.start, config.bpm, config.ppq);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          this._loopJumping = false;
        })
      );
    };
  }

  private async play() {
    if (!this.audio.sequencer) return logger.warn("Séquenceur non prêt");

    this.countInController?.abort();
    this.countInController = new AbortController();
    const { signal } = this.countInController;

    if (this.context.state === "suspended") this.context.resume();

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
      this.audio.seekTo(transport.start, config.bpm, config.ppq);
    }
  }

  resume() {
    if (!this.audio.sequencer) return logger.warn("Séquenceur non prêt");
    this.audio.sequencer.currentTime = 0;
    this.audio.sequencer.pause();
    this._currentMeasure = 0;
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
      this.audio.sequencer.playbackRate = targetBpm / this.audio.sequencer.currentTempo;
    }
    if (
      flags.has(Action.SET_TRANSPORT_START) ||
      flags.has(Action.SET_TRANSPORT_START_FROM_MEASURE_INDEX)
    ) {
      const { config, transport, measuresStarts } = this.store.midiState;

      this._seekPending = true;
      this.audio.seekTo(transport.start, config.bpm, config.ppq);
      let closestMeasure = 0;

      let minDiff = Number.MAX_VALUE;

      for (const [mIndex, mTick] of measuresStarts.entries()) {
        const diff = Math.abs(mTick - transport.start);

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

export default class SoundEngine {
  private static instance: SoundEngine | null = null;
  private static context: AudioContext | null = null;

  private readonly audio: AudioCore;
  private readonly notes: NoteTracker;
  private readonly store: StoreConnector;
  private readonly transport: TransportController;

  private processFrameId: number | null = null;

  public static onMeasureChange: ((measure: number) => void) | null = null;

  private constructor(
    audio: AudioCore,
    notes: NoteTracker,
    store: StoreConnector,
    transport: TransportController
  ) {
    this.audio = audio;
    this.notes = notes;
    this.store = store;
    this.transport = transport;
    this.startProcessLoop();
  }

  static async initAudio(): Promise<SoundEngine> {
    if (SoundEngine.instance) return SoundEngine.instance;

    SoundEngine.context = new AudioContext();
    const audio = await AudioCore.init(SoundEngine.context);
    const notes = new NoteTracker(audio.synth);

    let instance: SoundEngine;

    const store = new StoreConnector((flags) => {
      instance?.transport.processActions(store.consumeFlags());
    });

    const transport = new TransportController(
      audio,
      store,
      SoundEngine.context,
      this.onMeasureChange
    );

    audio.sequencer.eventHandler.addEvent("songEnded", "Id sequencer", () => {
      if (transport.isLoopJumping) {
        logger.info("songEnded ignoré (loop en cours)");
        return;
      }
      transport.resume();
      store.dispatch({ type: Action.SET_TRANSPORT_STATUS, status: "reset" });
    });

    instance = new SoundEngine(audio, notes, store, transport);

    const currentState = useMidiStore.getState().state;
    if (currentState?.rawMidiBuffer) {
      transport.loadNewMidi();
    }

    SoundEngine.instance = instance;
    return instance;
  }

  static get(): SoundEngine | null {
    return SoundEngine.instance;
  }

  get currentMeasure() {
    return this.transport.currentMeasure;
  }

  get currentTime() {
    return this.audio.currentTime;
  }
  get currentTempo() {
    return this.audio.currentTempo;
  }
  get isPlaying() {
    return this.audio.isPlaying;
  }

  get notesEvents() {
    return this.notes.notesEvents;
  }

  clearNotesEvents() {
    return this.notes.clearNotesEvents();
  }

  public changeChannelVolume(channel: number, volume: number) {
    this.audio.synth.controllerChange(channel, 7, volume);
  }

  updateMidiEvents() {}

  private stopAndCleanup() {
    if (!this.audio.sequencer) return;

    this.audio.sequencer.pause();
    this.audio.sequencer.currentTime = 0;
    this.notes.resetNotesEvents();
  }

  private startProcessLoop() {
    const loop = () => {
      this.transport.processActions(this.store.consumeFlags());
      this.processFrameId = requestAnimationFrame(loop);
    };
    this.processFrameId = requestAnimationFrame(loop);
  }

  private stopProcessLoop() {
    if (this.processFrameId) cancelAnimationFrame(this.processFrameId);
  }

  static reset(): void {
    SoundEngine.instance?.reset();
  }

  reset(): void {
    this.audio.sequencer.pause();
    this.audio.sequencer.currentTime = 0;

    this.notes.resetNotesEvents();

    this.transport.resetState();

    this.store.consumeFlags();

    const state = useMidiStore.getState().state;
    if (state?.rawMidiBuffer) {
      this.transport.loadNewMidi();
    }
  }
}
