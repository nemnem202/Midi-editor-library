import { Sequencer, WorkerSynthesizer } from "spessasynth_lib";
import { Action, type MidiAction } from "../../types/actions";
import { logger } from "../../lib/logger";
// @ts-ignore
import soundfont from "@/assets/soundfonts/GeneralUserGS.sf3";
import type { State } from "../../types/instance";
import { useMidiStore } from "../../stores/use-midi-store";
import { convertTickToSeconds } from "../../lib/utils";
import { AudioCore } from "./audioCore";
import { NoteTracker } from "./noteTracker";
import { StoreConnector } from "./storeConnector";
import { TransportController } from "./transportController";

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

  setCurrentMeasure(measure: number) {
    this.transport.setCurrentMeasure(measure);
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
