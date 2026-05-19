import { Sequencer, WorkerSynthesizer } from "spessasynth_lib";
import { Action, type MidiAction } from "../types/actions";
import { logger } from "../lib/logger";
// @ts-expect-error
import soundfont from "@/assets/soundfonts/GeneralUserGS.sf3";
import type { State } from "../types/instance";
import { useMidiStore } from "../stores/use-midi-store";
import { convertTickToSeconds, getCurrentMeasureFirstTick } from "../lib/utils";

export class AudioCore {
  initTempo: number = 120;
  private currentMeasure: number = 0;

  private constructor(
    readonly synth: WorkerSynthesizer,
    readonly sequencer: Sequencer
  ) {
    sequencer.eventHandler.addEvent("metaEvent", "eventId", (e) => {
      const { event: midiMsg } = e;
      if (midiMsg.statusByte === 0x06) {
        const markerText = new TextDecoder().decode(midiMsg.data);
        const match = markerText.match(/Bar_(\d+)/);
        if (match) {
          logger.info("Current measure update", match[1]);
          this.currentMeasure = parseInt(match[1], 10);
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

    return new AudioCore(synth, sequencer);
  }

  get _currentMeasure() {
    return this.currentMeasure;
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
}

export type NoteOnCallback = { midiNote: number; channel: number; velocity: number };
export type NoteOffCallback = { midiNote: number; channel: number };

export class NoteTracker {
  private readonly notesOnSet = new Set<NoteOnCallback>();
  private readonly notesOffSet = new Set<NoteOffCallback>();

  constructor(synth: WorkerSynthesizer) {
    synth.eventHandler.addEvent("noteOn", "Id note on", (note: NoteOnCallback) =>
      this.notesOnSet.add(note)
    );
    synth.eventHandler.addEvent("noteOff", "Id note off", (note: NoteOffCallback) =>
      this.notesOffSet.add(note)
    );
  }

  get notesOn() {
    return this.notesOnSet;
  }
  get notesOff() {
    return this.notesOffSet;
  }

  clearNotesOn() {
    this.notesOnSet.clear();
  }
  clearNotesOff() {
    this.notesOffSet.clear();
  }
  clearAll() {
    this.notesOnSet.clear();
    this.notesOffSet.clear();
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
  constructor(
    private readonly audio: AudioCore,
    private readonly store: StoreConnector,
    private readonly context: AudioContext
  ) {}

  loadNewMidi() {
    if (!this.audio.sequencer) return;

    const state = this.store.midiState ?? useMidiStore.getState().state;
    if (!state?.rawMidiBuffer) {
      return logger.warn("loadNewMidi: Buffer MIDI manquant dans le store");
    }

    const { rawMidiBuffer } = state;
    const cleanBuffer = rawMidiBuffer.buffer.slice(
      rawMidiBuffer.byteOffset,
      rawMidiBuffer.byteOffset + rawMidiBuffer.byteLength
    );

    this.audio.sequencer.pause();
    this.audio.sequencer.songListData = [];
    this.audio.sequencer.loadNewSongList([
      { binary: cleanBuffer as ArrayBuffer, fileName: "exercise.mid" },
    ]);

    this.audio.initTempo = this.audio.sequencer.currentTempo.valueOf();
    logger.success("Nouveau MIDI chargé dans le séquenceur");
  }

  async play() {
    if (!this.audio.sequencer) return logger.warn("Séquenceur non prêt");

    if (this.context.state === "suspended") this.context.resume();
    this.audio.sequencer.play();
  }

  pause() {
    if (!this.audio.sequencer) return logger.warn("Séquenceur non prêt");

    const state = this.store.midiState;
    if (state) {
      const { config, transport } = state;
      const startTick = getCurrentMeasureFirstTick(config.ppq, transport.start, {
        top: config.signature[0],
        bottom: config.signature[1],
      });
      this.audio.seekTo(startTick, config.bpm, config.ppq);
    }

    requestAnimationFrame(() => this.audio.sequencer.pause());
  }

  resume() {
    if (!this.audio.sequencer) return logger.warn("Séquenceur non prêt");
    this.audio.sequencer.currentTime = 0;
    this.audio.sequencer.pause();
  }

  processActions(flags: Set<Action>) {
    if (flags.size === 0 || !this.store.midiState) return;

    if (flags.has(Action.RESET_STATE)) {
      this.loadNewMidi();
    }

    if (flags.has(Action.SET_BPM)) {
      this.audio.setPlaybackRate(this.store.midiState.config.bpm);
      logger.info("new playback rate:", this.audio.sequencer.playbackRate);
    }

    if (flags.has(Action.SET_TRANSPORT_START)) {
      const { config, transport } = this.store.midiState;
      this.audio.seekTo(transport.start, config.bpm, config.ppq);
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
}

export default class SoundEngine {
  private static instance: SoundEngine | null = null;
  private static context: AudioContext | null = null;

  private readonly audio: AudioCore;
  private readonly notes: NoteTracker;
  private readonly store: StoreConnector;
  private readonly transport: TransportController;

  private processFrameId: number | null = null;

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

    const transport = new TransportController(audio, store, SoundEngine.context);

    audio.sequencer.eventHandler.addEvent("songEnded", "Id sequencer", () => {
      transport.resume();
      store.dispatch({ type: Action.SET_TRANSPORT_STATUS, status: "reset" });
    });

    instance = new SoundEngine(audio, notes, store, transport);
    SoundEngine.instance = instance;
    return instance;
  }

  static get(): SoundEngine | null {
    return SoundEngine.instance;
  }

  get currentMeasure() {
    return this.audio._currentMeasure;
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

  get notesOn() {
    return this.notes.notesOn;
  }
  get notesOff() {
    return this.notes.notesOff;
  }

  clearNotesOn() {
    this.notes.clearNotesOn();
  }
  clearNotesOff() {
    this.notes.clearNotesOff();
  }

  updateMidiEvents() {}

  private stopAndCleanup() {
    if (!this.audio.sequencer) return;

    this.audio.sequencer.pause();
    this.audio.sequencer.currentTime = 0;
    this.notes.clearAll();
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
}
