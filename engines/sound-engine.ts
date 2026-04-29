import { Sequencer, WorkerSynthesizer } from "spessasynth_lib";
import type { State } from "../types/instance";
import { useMidiStore } from "../stores/use-midi-store";
import { Action, type MidiAction } from "../types/actions";
import { logger } from "../lib/logger";
// @ts-expect-error
import soundfont from "@/assets/soundfonts/GeneralUserGS.sf3";

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
  public static initialized = false;
  private static engine: SoundEngine | null;
  private static context: AudioContext;
  private synth!: WorkerSynthesizer;
  private sequencer!: Sequencer;
  private tickUpdateCallback!: (tick: number) => void;

  private animationFrameId: number | null = null;
  private startingTick = 0;

  private actionsDirtyFlags = new Set<Action>();
  private processFrameId: number | null = null;
  private tickFrameId: number | null = null;

  private unsubscribeMidiStore: () => void;

  private notesOnSet = new Set<NoteOnCallback>();
  private notesOffSet = new Set<NoteOffCallback>();

  private constructor(
    private state: State,
    private onTickUpdate: (tick: number) => void,
    private dispatch: (action: MidiAction) => void
  ) {
    this.unsubscribeMidiStore = useMidiStore.subscribe((store) => {
      this.state = store.state;
      if (this.state.queuedActions.size > 0) {
        this.state.queuedActions.forEach((a) => {
          this.actionsDirtyFlags.add(a);
        });
      }
    });

    this.startProcessLoop();
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

  public clearNotesOn() {
    this.notesOnSet.clear();
  }

  public clearNotesOff() {
    this.notesOffSet.clear();
  }

  private startProcessLoop() {
    const loop = () => {
      this.processActions();
      // this.updateTime();
      this.processFrameId = requestAnimationFrame(loop);
    };
    this.processFrameId = requestAnimationFrame(loop);
  }
  public static async init(
    midiState: State,
    tickUpdateCallback: (tick: number) => void,
    dispatch: (action: MidiAction) => void
  ): Promise<SoundEngine> {
    if (SoundEngine.initialized) return SoundEngine.engine!;
    if (!window.AudioContext || !("audioWorklet" in AudioContext.prototype)) {
      throw new Error(
        "AudioWorklet non supporté. Vérifiez que vous êtes en HTTPS ou sur localhost."
      );
    }

    logger.info("Sound engine init...");
    SoundEngine.context = new AudioContext();
    const response = await fetch(soundfont);
    const sFbuffer = await response.arrayBuffer();
    logger.success("Soundfont chargé");
    await WorkerSynthesizer.registerPlaybackWorklet(SoundEngine.context);
    const worker = new Worker(new URL("./worker_synth_worker.js", import.meta.url), {
      type: "module",
    });
    const synth = new WorkerSynthesizer(SoundEngine.context, worker.postMessage.bind(worker));
    worker.addEventListener("message", (event) => synth.handleWorkerMessage(event.data));
    await synth.isReady;
    await synth.soundBankManager.addSoundBank(sFbuffer, "main");
    const instance = new SoundEngine(midiState, tickUpdateCallback, dispatch);
    instance.synth = synth;
    instance.synth.connect(SoundEngine.context.destination);
    instance.sequencer = new Sequencer(instance.synth);
    SoundEngine.engine = instance;
    SoundEngine.initialized = true;

    const raw = midiState.rawMidiBuffer;
    const cleanArrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);

    instance.sequencer.loadNewSongList([
      {
        binary: cleanArrayBuffer as ArrayBuffer,
        fileName: "exercise.mid",
      },
    ]);

    instance.synth.eventHandler.addEvent("noteOn", "Id note on", (note) => {
      logger.info("Note on", note);
      instance.notesOn.add(note);
    });

    instance.synth.eventHandler.addEvent("noteOff", "Id note off", (note) => {
      instance.notesOff.add(note);
    });

    return instance;
  }
  public static get(): SoundEngine {
    if (!SoundEngine.engine) throw new Error("Sound engine not initialized");
    return SoundEngine.engine;
  }
  public updateMidiEvents() {}

  private processActions() {
    const actions = this.actionsDirtyFlags;

    if (this.actionsDirtyFlags.size === 0) return;

    if (actions.has(Action.SET_BPM)) {
    }

    if (actions.has(Action.SET_TRANSPORT_START)) {
      this.startingTick = this.state.transport.start;

      if (this.state.transport.isPlaying) {
        this.pause();
      }
    }

    if (actions.has(Action.TOGGLE_PLAY)) {
      if (this.state.transport.isPlaying) {
        this.play();
      } else {
        this.pause();
      }
    }

    this.actionsDirtyFlags.clear();
  }

  private play() {
    logger.info("Play");
    this.sequencer.play();
  }

  private pause() {
    logger.info("Pause");
    this.sequencer.pause();
  }

  private stop() {
    logger.info("Stop");
    this.sequencer.pause();
    this.sequencer.currentTime = 0;
  }

  public destroy() {
    this.unsubscribeMidiStore();
    this.processFrameId && cancelAnimationFrame(this.processFrameId);
  }
}
