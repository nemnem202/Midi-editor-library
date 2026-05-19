import { Sequencer, WorkerSynthesizer } from "spessasynth_lib";
import { Action, type MidiAction } from "../types/actions";
import { logger } from "../lib/logger";
// @ts-expect-error
import soundfont from "@/assets/soundfonts/GeneralUserGS.sf3";
import type { State } from "../types/instance";
import { useMidiStore } from "../stores/use-midi-store";
import { convertTickToSeconds, getCurrentMeasureFirstTick } from "../lib/utils";

// export type NoteOnCallback = {
//   midiNote: number;
//   channel: number;
//   velocity: number;
// };

// export type NoteOffCallback = {
//   midiNote: number;
//   channel: number;
// };

// export default class SoundEngine {
//   private static instance: SoundEngine | null = null;
//   private static context: AudioContext | null = null;
//   private isInitializing = false;
//   private synth!: WorkerSynthesizer;
//   private sequencer!: Sequencer;
//   private tickUpdateCallback!: (tick: number) => void;

//   private animationFrameId: number | null = null;

//   private midiState: State | null = null;

//   private actionsDirtyFlags = new Set<Action>();
//   private processFrameId: number | null = null;
//   private tickFrameId: number | null = null;

//   private unsubscribeMidiStore!: () => void;

//   private notesOnSet = new Set<NoteOnCallback>();
//   private notesOffSet = new Set<NoteOffCallback>();

//   private initTempo: number = 120;

//   private countInController: AbortController | null = null;

//   private dispatch: (action: MidiAction) => void = () => {};

//   private constructor() {
//     this.subscribeToMidiStore();
//   }

//   private loadNewMidi() {
//     if (!this.sequencer) return;
//     if (!this.midiState) {
//       this.midiState = useMidiStore.getState().state;
//     }

//     if (!this.midiState?.rawMidiBuffer) {
//       return logger.warn("loadNewMidi: Buffer MIDI manquant dans le store");
//     }

//     this.stopProcessLoop();
//     const { rawMidiBuffer } = this.midiState;

//     const cleanArrayBuffer = rawMidiBuffer.buffer.slice(
//       rawMidiBuffer.byteOffset,
//       rawMidiBuffer.byteOffset + rawMidiBuffer.byteLength
//     );

//     this.sequencer.pause();
//     this.sequencer.songListData = [];
//     this.sequencer.loadNewSongList([
//       {
//         binary: cleanArrayBuffer as ArrayBuffer,
//         fileName: "exercise.mid",
//       },
//     ]);

//     this.initTempo = this.sequencer.currentTempo.valueOf();

//     this.startProcessLoop();
//     logger.success("Nouveau MIDI chargé dans le séquenceur");
//   }

//   private startProcessLoop() {
//     const loop = () => {
//       this.processActions();
//       this.processFrameId = requestAnimationFrame(loop);
//     };
//     this.processFrameId = requestAnimationFrame(loop);
//   }

//   private stopProcessLoop() {
//     this.processFrameId && cancelAnimationFrame(this.processFrameId);
//   }

//   public static async initAudio(): Promise<SoundEngine> {
//     if (SoundEngine.instance) return SoundEngine.instance;

//     SoundEngine.instance = new SoundEngine();
//     SoundEngine.context = new AudioContext();

//     const response = await fetch(soundfont);
//     const sFbuffer = await response.arrayBuffer();

//     await WorkerSynthesizer.registerPlaybackWorklet(SoundEngine.context);
//     const worker = new Worker(new URL("./worker_synth_worker.js", import.meta.url), {
//       type: "module",
//     });

//     SoundEngine.instance.synth = new WorkerSynthesizer(
//       SoundEngine.context,
//       worker.postMessage.bind(worker)
//     );

//     worker.addEventListener("message", (event) =>
//       SoundEngine.instance?.synth.handleWorkerMessage(event.data)
//     );

//     await SoundEngine.instance.synth.isReady;
//     await SoundEngine.instance.synth.soundBankManager.addSoundBank(sFbuffer, "main");

//     SoundEngine.instance.synth.connect(SoundEngine.context.destination);

//     SoundEngine.instance.synth.eventHandler.addEvent("noteOn", "Id note on", (note) => {
//       SoundEngine.instance?.notesOn.add(note);
//     });

//     SoundEngine.instance.synth.eventHandler.addEvent("noteOff", "Id note off", (note) => {
//       SoundEngine.instance?.notesOff.add(note);
//     });

//     SoundEngine.instance.sequencer = new Sequencer(SoundEngine.instance.synth);

//     SoundEngine.instance.sequencer.eventHandler.addEvent("songEnded", "Id sequencer", () => {
//       if (SoundEngine.instance) {
//         SoundEngine.instance.resume();
//         SoundEngine.instance.dispatch({ type: Action.SET_TRANSPORT_STATUS, status: "reset" });
//       }
//     });

//     return SoundEngine.instance;
//   }

//   public static get(): SoundEngine | null {
//     return SoundEngine.instance;
//   }

//   private subscribeToMidiStore() {
//     this.unsubscribeMidiStore = useMidiStore.subscribe((store) => {
//       if (!SoundEngine.instance) return;
//       SoundEngine.instance.midiState = store.state;
//       SoundEngine.instance.dispatch = store.dispatch;
//       store.dispatch;
//       if (SoundEngine.instance.midiState.queuedActions.size > 0) {
//         SoundEngine.instance.midiState.queuedActions.forEach((a) => {
//           if (!SoundEngine.instance) return;
//           SoundEngine.instance.actionsDirtyFlags.add(a);
//         });
//       }
//     });
//   }

//   get currentTime() {
//     return this.sequencer.currentHighResolutionTime;
//   }

//   get currentTempo() {
//     return this.sequencer.currentTempo;
//   }

//   get notesOff() {
//     return this.notesOffSet;
//   }

//   get notesOn() {
//     return this.notesOnSet;
//   }

//   get isPlaying() {
//     return !this.sequencer.paused;
//   }

//   public clearNotesOn() {
//     this.notesOnSet.clear();
//   }

//   public clearNotesOff() {
//     this.notesOffSet.clear();
//   }

//   public updateMidiEvents() {}

//   private processActions() {
//     if (!this.midiState) return;
//     const actions = this.actionsDirtyFlags;

//     if (this.actionsDirtyFlags.size === 0) return;

//     if (actions.has(Action.RESET_STATE)) {
//       this.loadNewMidi();
//     }

//     if (actions.has(Action.SET_BPM)) {
//       this.sequencer.playbackRate = this.midiState.config.bpm / this.sequencer.currentTempo;
//       logger.info("new playback rate:", this.sequencer.playbackRate);
//     }

//     if (actions.has(Action.SET_TRANSPORT_START)) {
//       this.sequencer.currentTime = convertTickToSeconds(
//         this.midiState.transport.start,
//         this.midiState.config.bpm,
//         this.midiState.config.ppq
//       );
//     }

//     if (actions.has(Action.SET_TRANSPORT_STATUS)) {
//       if (this.midiState.transport.status === "playing") {
//         this.play();
//       } else if (this.midiState.transport.status === "paused") {
//         this.pause();
//       } else if (this.midiState.transport.status === "reset") {
//         this.resume();
//       }
//     }

//     this.actionsDirtyFlags.clear();
//   }

//   private async play() {
//     if (!this.sequencer) return logger.warn("Séquenceur non prêt");

//     this.countInController?.abort();
//     this.countInController = new AbortController();
//     const signal = this.countInController.signal;

//     if (SoundEngine.context?.state === "suspended") {
//       SoundEngine.context.resume();
//     }

//     try {
//       const msPerBeat = (60 / (this.midiState?.config.bpm ?? this.sequencer.currentTempo)) * 1000;

//       for (let i = 0; i < 4; i++) {
//         this.synth.noteOn(9, 76, 100);

//         await this.delay(msPerBeat, signal);
//       }
//       this.sequencer.play();
//     } catch (e) {
//       if (e instanceof Error && e.message !== "aborted") {
//         logger.error("Erreur pendant le décompte:", e);
//       }
//     } finally {
//       this.countInController = null;
//     }
//   }

//   private pause() {
//     if (!this.sequencer) return logger.warn("Séquenceur non prêt");

//     if (this.countInController) {
//       this.countInController.abort();
//       this.countInController = null;
//       logger.info("Décompte annulé");
//     }
//     if (this.midiState) {
//       const startTick = getCurrentMeasureFirstTick(
//         this.midiState.config.ppq,
//         this.midiState.transport.start,
//         {
//           top: this.midiState.config.signature[0],
//           bottom: this.midiState.config.signature[1],
//         }
//       );

//       this.sequencer.currentTime = convertTickToSeconds(
//         startTick,
//         this.midiState.config.bpm,
//         this.midiState.config.ppq
//       );
//     }
//     requestAnimationFrame(() => {
//       this.sequencer.pause();
//     });
//   }

//   private resume() {
//     if (!this.sequencer) return logger.warn("Séquenceur non prêt");
//     this.sequencer.currentTime = 0;
//     this.sequencer.pause();
//   }

//   private delay(ms: number, signal: AbortSignal) {
//     return new Promise((resolve, reject) => {
//       const timeout = setTimeout(resolve, ms);
//       signal.addEventListener("abort", () => {
//         clearTimeout(timeout);
//         reject(new Error("aborted"));
//       });
//     });
//   }

//   // public changeChannelVolume(channel: number, volume: number) {
//   //   this.synth.controllerChange(channel, 7, Math.min(100, Math.max(0, volume)));
//   // }

//   public stopAndCleanup() {
//     if (!this.sequencer) return;

//     this.sequencer.pause();
//     this.sequencer.currentTime = 0;

//     this.notesOnSet.clear();
//     this.notesOffSet.clear();
//     logger.info("Musique stoppée - Moteur maintenu en veille");
//   }
// }

export class AudioCore {
  //  synth: WorkerSynthesizer;
  //  sequencer: Sequencer;
  initTempo: number = 120;
  private currentMeasure: number = 0;

  private constructor(
    readonly synth: WorkerSynthesizer,
    readonly sequencer: Sequencer
  ) {
    // this.synth = synth;
    // this.sequencer = sequencer;

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
  private countInController: AbortController | null = null;

  constructor(
    private readonly audio: AudioCore,
    private readonly store: StoreConnector,
    private readonly context: AudioContext
  ) {}

  // ── MIDI loading ──────────────────────────────────────────────────────────

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

  // ── Transport ─────────────────────────────────────────────────────────────

  async play() {
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

  pause() {
    if (!this.audio.sequencer) return logger.warn("Séquenceur non prêt");

    if (this.countInController) {
      this.countInController.abort();
      this.countInController = null;
      logger.info("Décompte annulé");
    }

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

  // ── Action processing ─────────────────────────────────────────────────────

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

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  // ── API publique ──────────────────────────────────────────────────────────

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

  // ── Boucle de traitement ──────────────────────────────────────────────────

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
