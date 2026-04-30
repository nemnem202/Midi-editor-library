import { Sequencer, WorkerSynthesizer } from "spessasynth_lib";
import { Action } from "../types/actions";
import { logger } from "../lib/logger";
// @ts-expect-error
import soundfont from "@/assets/soundfonts/GeneralUserGS.sf3";
import type { State } from "../types/instance";
import { useMidiStore } from "../stores/use-midi-store";

export type NoteOnCallback = {
  midiNote: number;
  channel: number;
  velocity: number;
};

export type NoteOffCallback = {
  midiNote: number;
  channel: number;
};

export default class SoundEngine {
  private static instance: SoundEngine | null = null;
  private static context: AudioContext | null = null;
  private isInitializing = false;
  private synth!: WorkerSynthesizer;
  private sequencer!: Sequencer;
  private tickUpdateCallback!: (tick: number) => void;

  private animationFrameId: number | null = null;
  private startingTick = 0;

  private midiState: State | null = null;

  private actionsDirtyFlags = new Set<Action>();
  private processFrameId: number | null = null;
  private tickFrameId: number | null = null;

  private unsubscribeMidiStore!: () => void;

  private notesOnSet = new Set<NoteOnCallback>();
  private notesOffSet = new Set<NoteOffCallback>();

  private constructor() {
    this.subscribeToMidiStore();
  }

  public loadNewMidi() {
    if (!this.sequencer) return;
    if (!this.midiState) {
      this.midiState = useMidiStore.getState().state;
    }

    if (!this.midiState?.rawMidiBuffer) {
      return logger.warn("loadNewMidi: Buffer MIDI manquant dans le store");
    }

    this.stopProcessLoop();
    const { rawMidiBuffer } = this.midiState;

    const cleanArrayBuffer = rawMidiBuffer.buffer.slice(
      rawMidiBuffer.byteOffset,
      rawMidiBuffer.byteOffset + rawMidiBuffer.byteLength
    );

    this.sequencer.pause();
    this.sequencer.songListData = [];
    this.sequencer.loadNewSongList([
      {
        binary: cleanArrayBuffer as ArrayBuffer,
        fileName: "exercise.mid",
      },
    ]);

    this.startProcessLoop();
    logger.success("Nouveau MIDI chargé dans le séquenceur");
  }

  private startProcessLoop() {
    const loop = () => {
      this.processActions();
      this.processFrameId = requestAnimationFrame(loop);
    };
    this.processFrameId = requestAnimationFrame(loop);
  }

  private stopProcessLoop() {
    this.processFrameId && cancelAnimationFrame(this.processFrameId);
  }

  public static async initAudio(): Promise<SoundEngine> {
    if (SoundEngine.instance) return SoundEngine.instance;

    SoundEngine.instance = new SoundEngine();
    SoundEngine.context = new AudioContext();

    const response = await fetch(soundfont);
    const sFbuffer = await response.arrayBuffer();

    await WorkerSynthesizer.registerPlaybackWorklet(SoundEngine.context);
    const worker = new Worker(new URL("./worker_synth_worker.js", import.meta.url), {
      type: "module",
    });

    SoundEngine.instance.synth = new WorkerSynthesizer(
      SoundEngine.context,
      worker.postMessage.bind(worker)
    );

    worker.addEventListener("message", (event) =>
      SoundEngine.instance?.synth.handleWorkerMessage(event.data)
    );

    await SoundEngine.instance.synth.isReady;
    await SoundEngine.instance.synth.soundBankManager.addSoundBank(sFbuffer, "main");

    SoundEngine.instance.synth.connect(SoundEngine.context.destination);

    SoundEngine.instance.synth.eventHandler.addEvent("noteOn", "Id note on", (note) => {
      SoundEngine.instance?.notesOn.add(note);
    });

    SoundEngine.instance.synth.eventHandler.addEvent("noteOff", "Id note off", (note) => {
      SoundEngine.instance?.notesOff.add(note);
    });

    SoundEngine.instance.sequencer = new Sequencer(SoundEngine.instance.synth);
    SoundEngine.instance.loadNewMidi();

    return SoundEngine.instance;
  }

  public static get(): SoundEngine | null {
    return SoundEngine.instance;
  }

  private subscribeToMidiStore() {
    this.unsubscribeMidiStore = useMidiStore.subscribe((store) => {
      if (!SoundEngine.instance) return;
      SoundEngine.instance.midiState = store.state;
      if (SoundEngine.instance.midiState.queuedActions.size > 0) {
        SoundEngine.instance.midiState.queuedActions.forEach((a) => {
          if (!SoundEngine.instance) return;
          SoundEngine.instance.actionsDirtyFlags.add(a);
        });
      }
    });
  }

  get currentTime() {
    return this.sequencer.currentHighResolutionTime;
  }

  get currentTempo() {
    return this.sequencer.currentTempo;
  }

  get notesOff() {
    return this.notesOffSet;
  }

  get notesOn() {
    return this.notesOnSet;
  }

  get isPlaying() {
    return !this.sequencer.paused;
  }

  public clearNotesOn() {
    this.notesOnSet.clear();
  }

  public clearNotesOff() {
    this.notesOffSet.clear();
  }

  public updateMidiEvents() {}

  private processActions() {
    if (!this.midiState) return;
    const actions = this.actionsDirtyFlags;

    if (this.actionsDirtyFlags.size === 0) return;

    if (actions.has(Action.SET_BPM)) {
    }

    if (actions.has(Action.SET_TRANSPORT_START)) {
      this.startingTick = this.midiState.transport.start;

      if (this.midiState.transport.isPlaying) {
        this.pause();
      }
    }

    if (actions.has(Action.TOGGLE_PLAY)) {
      if (this.midiState.transport.isPlaying) {
        this.play();
      } else {
        this.pause();
      }
    }

    this.actionsDirtyFlags.clear();
  }

  private play() {
    if (!this.sequencer) return logger.warn("Séquenceur non prêt");
    if (SoundEngine.context?.state === "suspended") {
      SoundEngine.context.resume();
    }

    this.sequencer.play();
  }

  private pause() {
    if (!this.sequencer) return logger.warn("Séquenceur non prêt");
    this.sequencer.pause();
  }

  private resume() {
    if (!this.sequencer) return logger.warn("Séquenceur non prêt");
    this.sequencer.pause();
    this.sequencer.currentTime = 0;
  }

  public changeChannelVolume(channel: number, volume: number) {
    this.synth.controllerChange(channel, 7, Math.min(100, Math.max(0, volume)));
  }

  public stopAndCleanup() {
    if (!this.sequencer) return;

    this.sequencer.pause();
    this.sequencer.currentTime = 0;

    this.notesOnSet.clear();
    this.notesOffSet.clear();
    logger.info("Musique stoppée - Moteur maintenu en veille");
  }
}
