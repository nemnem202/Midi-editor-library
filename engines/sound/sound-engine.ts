import { Sequencer, WorkerSynthesizer } from "spessasynth_lib";
import { Action } from "../../types/actions";
// @ts-ignore
import soundfont from "@/assets/soundfonts/GeneralUserGS.sf3";
import type { State } from "../../types/instance";
import { useMidiStore } from "../../stores/use-midi-store";
import { SequencerUnit } from "./sequencerUnit";
import { PracticeLogic } from "./practiceLogic";
import { NoteEvent, NoteTracker } from "./noteTracker";
import { logger } from "@/lib/logger";
import { Chord } from "@/types/music";

export default class SoundEngine {
  private static instance: SoundEngine | null = null;
  private static context: AudioContext | null = null;

  private unit!: SequencerUnit;
  private practice = new PracticeLogic();
  private countInController: AbortController | null = null;
  private noteTracker: NoteTracker | null = null;

  // public currentMeasure = 0;
  private _seekPending = false;

  private _metaBuffer = new Map<string, string>();
  private _batchFrame: number | null = null;

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
    sequencer.loopCount = Infinity;

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

      // Extraction du type et de la donnée
      let type = "";
      let data = "";

      if (text.includes("Bar_")) {
        type = "Bar";
        data = text.split("_")[1];
      } else if (text === "LoopEnd") {
        type = "LoopEnd";
        data = "true";
      } else if (text.includes("Chords_")) {
        type = "Chords";
        data = text.split("_")[1];
      }

      if (type) {
        // On écrase la valeur précédente pour ce type : "Latest wins"
        this._metaBuffer.set(type, data);

        // On planifie le traitement pour la fin de la frame JS
        if (this._batchFrame === null) {
          this._batchFrame = requestAnimationFrame(() => this.flushMetaEvents());
        }
      }
    });
  }

  private flushMetaEvents() {
    this._batchFrame = null;

    // Si on est en train de chercher (seek), on ignore souvent les marqueurs intermédiaires
    // car handleSeek calcule déjà la position finale.
    if (this._seekPending) {
      this._metaBuffer.clear();
      return;
    }

    this._metaBuffer.forEach((data, type) => {
      if (type === "Bar") {
        const currentMeasure = parseInt(data, 10);
        useMidiStore.getState().dispatch({
          type: Action.SET_CURRENT_MEASURE,
          index: currentMeasure,
        });
      } else if (type === "Chords") {
        try {
          const chords = JSON.parse(data);
          useMidiStore.getState().dispatch({
            type: Action.SET_CURRENT_CHORDS,
            chords: chords as Chord[],
          });
        } catch (e) {
          logger.error("JSON Chord parsing error");
        }
      } else if (type === "LoopEnd") {
        logger.info("Sound engine loop end (batched)");
        this.handleLoopIteration();
      }
    });

    this._metaBuffer.clear();
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
        case Action.SET_LOOP:
          break;
        case Action.CHANGE_TRACK_VOLUME:
          this.changeTracksVolume(state);
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
    this.unit.sequencer.loopCount = Infinity;

    this.unit.captureBaseTempo(cleanBuffer as any);
    this.unit.setPlaybackRate(config.bpm);

    if (transport.start > 0) {
      this.unit.seek(transport.start, config.ppq);
    }
  }

  private async syncTransport(state: State) {
    const { status } = state.transport;

    if (status === "playing") {
      this.play(state);
    } else if (status === "paused") {
      this.pause(state);
    } else if (status === "reset") {
      this.reset();
    }
  }

  private async play(state: State) {
    logger.info("Play, is it last? ", this.practice.isLastIteration(state));
    this.stopCountIn();

    if (state.config.countIn) {
      this.countInController = new AbortController();
      const { signal } = this.countInController;
      const msPerBeat = (60 / state.config.bpm) * 1000;

      try {
        for (let i = 0; i < 4; i++) {
          this.unit.synth.noteOn(9, 76, 100);
          await new Promise<void>((res, rej) => {
            const t = setTimeout(res, msPerBeat);
            signal.addEventListener("abort", () => {
              clearTimeout(t);
              rej();
            });
          });
        }
        this.unit.sequencer.play();
      } catch {}
    } else {
      this.unit.sequencer.play();
    }
  }

  private pause(state: State) {
    this.stopCountIn();
    this.unit.sequencer.pause();

    state.config.loop &&
      useMidiStore.getState().dispatch({
        type: Action.SET_LOOP,
        loop: { ...state.config.loop, currentRepeatIndex: 0 },
      });
    this.handleSeek(state);
  }

  private handleLoopIteration() {
    const state = useMidiStore.getState().state;
    if (!state || !state.config.loop) return;

    const next = this.practice.getNextIterationParams(state);

    if (!next) {
      logger.info("All repeats done, stopping.");
      this.unit.sequencer.pause();
      this.unit.sequencer.currentTime = 0;

      useMidiStore.getState().dispatch({ type: Action.SET_CURRENT_MEASURE, index: 0 });

      useMidiStore.getState().dispatch({
        type: Action.SET_LOOP,
        loop: { ...state.config.loop, currentRepeatIndex: 0 },
      });
      useMidiStore.getState().dispatch({
        type: Action.SET_TRANSPORT_STATUS,
        status: "reset",
      });
      return;
    }

    logger.info("Next iteration, repeatIndex:", next.repeatIndex);

    this.unit.setPlaybackRate(next.targetBpm);
    this.unit.transposeAllChannels(state, next.targetTranspose);
    this.unit.seek(next.startTick, state.config.ppq);

    useMidiStore.getState().dispatch({
      type: Action.SET_LOOP,
      loop: { ...state.config.loop, currentRepeatIndex: next.repeatIndex },
    });
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

    useMidiStore.getState().dispatch({ type: Action.SET_CURRENT_MEASURE, index: closestMeasure });

    setTimeout(() => {
      this._seekPending = false;
    }, 20);
  }

  private stopCountIn() {
    this.countInController?.abort();
    this.countInController = null;
  }

  public reset() {
    this.stopCountIn();

    this.unit.sequencer.pause();
    this.unit.sequencer.currentTime = 0;
    useMidiStore.getState().dispatch({ type: Action.SET_CURRENT_MEASURE, index: 0 });
    // SoundEngine.onMeasureChange?.(this.currentMeasure);
  }

  private changeTracksVolume(state: State) {
    for (const track of state.tracks) {
      this.unit.synth.muteChannel(track.channel, track.muted);
      this.unit.synth.controllerChange(track.channel, 7, track.volume);
    }
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
  // public setCurrentMeasure(m: number) {
  //   this.currentMeasure = m;

  // }
}
