import { type WorkletSynthesizer, Sequencer, WorkerSynthesizer } from "spessasynth_lib";
import type { State } from "../types/instance";
import { useMidiStore } from "../stores/use-midi-store";
import { Action } from "../types/actions";
import { logger } from "../lib/logger";
import soundfont from "@/assets/soundfonts/GeneralUserGS.sf3?raw";

export default class SoundEngine {
  public static initialized = false;
  private static engine: SoundEngine | null;
  private static context = new AudioContext();
  private synth!: WorkletSynthesizer;
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
  public async init(midiState: State, tickUpdateCallback: (tick: number) => void) {
    if (SoundEngine.initialized) return;
    const font = await fetch(soundfont);
    const sFbuffer = await font.arrayBuffer();

    await WorkerSynthesizer.registerPlaybackWorklet(SoundEngine.context);
    const worker = new Worker(new URL("worker_synth_worker.js", import.meta.url));
    const synth = new WorkerSynthesizer(SoundEngine.context, worker.postMessage.bind(worker));
    worker.addEventListener("message", (event) => synth.handleWorkerMessage(event.data));

    await synth.soundBankManager.addSoundBank(sFbuffer, "main");

    this.sequencer = new Sequencer(this.synth);
    this.sequencer.loopCount = Infinity;

    SoundEngine.engine = new SoundEngine(midiState, tickUpdateCallback);
    SoundEngine.initialized = true;
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
