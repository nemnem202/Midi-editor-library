import * as Tone from "tone";
import type { State, Track } from "../types/instance";
import { logger } from "../lib/logger";
import { Action } from "../types/actions";
import { useMidiStore } from "../stores/use-midi-store";

interface TrackInstruments {
  piano: Tone.PolySynth;
  guitar: Tone.PolySynth;
  bass: Tone.PolySynth;
  drums: Tone.PolySynth;
}

export default class SoundEngine {
  private static engine: SoundEngine | null = null;
  public static isInitialized = false;

  private trackInstruments: TrackInstruments | null = null;
  private parts: Tone.Part[] = [];
  private animationFrameId: number | null = null;
  private startingTick = 0;

  private actionsDirtyFlags = new Set<Action>();
  private processFrameId: number | null = null;
  private tickFrameId: number | null = null;

  // private notesOn: number[] = [];
  // private notesOff: number[] = [];

  private notesEventsOfEachTrack: Map<number, { notesOn: number[]; notesOff: number[] }> =
    new Map();

  private constructor(
    private state: State,
    private onTickUpdate: (tick: number) => void
  ) {
    useMidiStore.subscribe((store) => {
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

  public get currentTicks(): number {
    return Tone.getTransport().ticks;
  }

  public get notesEvents(): typeof this.notesEventsOfEachTrack {
    return this.notesEventsOfEachTrack;
  }

  public clearNotesEvents() {
    for (const event of this.notesEventsOfEachTrack.values()) {
      event.notesOn.length = 0;
      event.notesOff.length = 0;
    }
  }
  public static async init(state: State, onTickUpdate: (tick: number) => void) {
    console.log("SoundEngine: static init() called");

    if (SoundEngine.isInitialized) return;

    try {
      await Tone.start();
      logger.success("Audio Context Started");

      if (!SoundEngine.engine) {
        SoundEngine.engine = new SoundEngine(state, onTickUpdate);

        SoundEngine.engine.trackInstruments = {
          piano: new Tone.PolySynth().toDestination(),
          guitar: new Tone.PolySynth().toDestination(),
          bass: new Tone.PolySynth().toDestination(),
          drums: new Tone.PolySynth().toDestination(),
        };

        SoundEngine.engine.setupTransport();
      }

      SoundEngine.isInitialized = true;
      logger.success("Sound Engine fully ready");
    } catch (e) {
      logger.error("Failed to initialize Sound Engine", e);
      throw e;
    }
  }

  public static get(): SoundEngine {
    if (!SoundEngine.engine) throw new Error("Engine not created");
    return SoundEngine.engine;
  }

  private setupTransport() {
    Tone.getTransport().bpm.value = this.state.config.bpm;
    Tone.getTransport().PPQ = this.state.config.ppq;
    Tone.getTransport().scheduleRepeat(() => {
      this.onTickUpdate(Tone.getTransport().ticks);
    }, "16i");
  }

  public updateMidiEvents() {
    Tone.getTransport().cancel();
    this.parts.forEach((p) => {
      p.dispose();
    });
    this.parts = [];
    this.notesEventsOfEachTrack.clear();
    this.state.tracks.forEach((track, index) => {
      this.notesEventsOfEachTrack.set(track.id, { notesOn: [], notesOff: [] });
      const synth = this.getInstrumentForTrack(index);
      if (synth) this.scheduleMidiEvents(track, synth);
    });
  }

  private getInstrumentForTrack(index: number): Tone.PolySynth | null {
    if (!this.trackInstruments) return null;
    switch (index) {
      case 0:
        return this.trackInstruments.piano;
      case 1:
        return this.trackInstruments.guitar;
      case 2:
        return this.trackInstruments.bass;
      case 3:
        return this.trackInstruments.drums;
      default:
        return null;
    }
  }

  private scheduleMidiEvents(track: Track, synth: Tone.PolySynth) {
    const notes = this.createNotesFromTrack(track);
    if (!this.notesEventsOfEachTrack.has(track.id)) {
      this.notesEventsOfEachTrack.set(track.id, { notesOn: [], notesOff: [] });
    }
    const trackEvents = this.notesEventsOfEachTrack.get(track.id);
    const attackPart = new Tone.Part(
      (time, note) => {
        synth.triggerAttack(Tone.Midi(note.midi).toNote(), time, note.velocity / 100);
        trackEvents?.notesOn.push(note.midi);
      },
      notes.map((note) => ({ ...note, time: note.time }))
    );

    const releasePart = new Tone.Part(
      (time, note) => {
        synth.triggerRelease(Tone.Midi(note.midi).toNote(), time);
        trackEvents?.notesOff.push(note.midi);
      },
      notes.map((note) => ({
        ...note,
        time: note.timeOff,
      }))
    );

    attackPart.start(0);
    releasePart.start(0);

    this.parts.push(attackPart, releasePart);
  }
  private createNotesFromTrack(track: Track) {
    const array: any[] = [];
    for (let i = 0; i <= track.data.noteCount; i++) {
      const start = track.data.startTicks[i];
      const durationTicks = track.data.durationInTicks[i];
      const velocity = track.data.velocities[i];
      const midi = track.data.midiValues[i];
      array.push({
        time: `${start}i`,
        timeOff: `${start + durationTicks}i`, // 👈 calculé ici, en ticks
        durationTicks,
        velocity,
        midi,
      });
    }
    return array;
  }
  private processActions() {
    const actions = this.actionsDirtyFlags;

    if (actions.has(Action.SET_BPM)) {
      Tone.getTransport().bpm.value = this.state.config.bpm;
    }

    if (actions.has(Action.SET_TRANSPORT_START)) {
      this.startingTick = this.state.transport.start;

      if (this.state.config.isPlaying) {
        Tone.getTransport().ticks = this.startingTick;
      }
    }

    if (actions.has(Action.TOGGLE_PLAY)) {
      logger.info("Play");
      if (this.state.config.isPlaying) {
        this.play();
      } else {
        this.pause();
      }
    }
  }

  private play() {
    logger.info("Play");
    Tone.getTransport().ticks = this.startingTick;
    Tone.getTransport().start();
    this.startTickLoop();
  }

  private pause() {
    Tone.getTransport().pause();
    this.releaseAllInstruments();
    this.stopTickLoop();
  }

  private reset() {
    Tone.getTransport().stop();
    Tone.getTransport().position = "0:0:0";
    this.startingTick = 0;
    this.releaseAllInstruments();
    this.stopTickLoop();
    this.onTickUpdate(0);
  }

  private startTickLoop() {
    const loop = () => {
      this.onTickUpdate(Tone.getTransport().ticks);
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  private stopTickLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public setStartingTick(tick: number) {
    this.startingTick = tick;
  }

  private releaseAllInstruments() {
    if (!this.trackInstruments) return;
    Object.values(this.trackInstruments).forEach((s) => {
      s.releaseAll();
    });
  }

  public stopAll() {
    this.pause();
    Tone.getTransport().cancel();
    this.onTickUpdate = () => {};
  }
}
