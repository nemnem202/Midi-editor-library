import { Sequencer, WorkerSynthesizer } from "spessasynth_lib";
import type { State } from "../types/instance";
import { useMidiStore } from "../stores/use-midi-store";
import { Action } from "../types/actions";
import { logger } from "../lib/logger";
// @ts-expect-error
import soundfont from "@/assets/soundfonts/GeneralUserGS.sf3";

export default class SoundEngine {
  public static initialized = false;
  private static engine: SoundEngine | null;
  private static context: AudioContext;
  private synth!: WorkerSynthesizer;
  private sequencer!: Sequencer;
  private midiState!: State;
  private tickUpdateCallback!: (tick: number) => void;

  private animationFrameId: number | null = null;
  private startingTick = 0;

  private actionsDirtyFlags = new Set<Action>();
  private processFrameId: number | null = null;
  private tickFrameId: number | null = null;

  private unsubscribeMidiStore: () => void;

  private constructor(
    private state: State,
    private onTickUpdate: (tick: number) => void
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
  private startProcessLoop() {
    const loop = () => {
      if (this.actionsDirtyFlags.size > 0) {
        this.processActions();
        this.actionsDirtyFlags.clear();
      }
      this.processFrameId = requestAnimationFrame(loop);
    };
    this.processFrameId = requestAnimationFrame(loop);
  }
  public static async init(
    midiState: State,
    tickUpdateCallback: (tick: number) => void
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
    const instance = new SoundEngine(midiState, tickUpdateCallback);
    instance.synth = synth;
    instance.synth.connect(SoundEngine.context.destination);
    instance.sequencer = new Sequencer(instance.synth);
    SoundEngine.engine = instance;
    SoundEngine.initialized = true;
    return instance;
  }
  public static get(): SoundEngine {
    if (!SoundEngine.engine) throw new Error("Sound engine not initialized");
    return SoundEngine.engine;
  }
  public updateMidiEvents() {}

  private processActions() {
    const actions = this.actionsDirtyFlags;

    if (actions.has(Action.SET_BPM)) {
    }

    if (actions.has(Action.SET_TRANSPORT_START)) {
      this.startingTick = this.state.transport.start;

      if (this.state.transport.isPlaying) {
      }
    }

    if (actions.has(Action.TOGGLE_PLAY)) {
      if (this.state.transport.isPlaying) {
        this.play();
      } else {
        this.pause();
      }
    }
  }

  private play() {
    logger.info("Play");
  }

  private pause() {
    logger.info("Pause");
  }

  public destroy() {
    this.unsubscribeMidiStore();
    this.processFrameId && cancelAnimationFrame(this.processFrameId);
  }
}
