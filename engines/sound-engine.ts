import {
  getTransport,
  Midi,
  Part,
  PolySynth,
  type Sampler,
  start,
  type Synth,
  type PolySynthOptions,
  type SynthOptions,
} from "tone";
import type { State, Track } from "../types/instance";
import { logger } from "../lib/logger";

interface TrackInstruments {
  piano: PolySynth;
  guitar: PolySynth;
  bass: PolySynth;
  drums: PolySynth;
}

const placeholderParams: Partial<PolySynthOptions<Synth<SynthOptions>>> = {
  volume: -5,
  options: {
    envelope: {
      attack: 0.05,
      decay: 0.1,
      sustain: 0.3,
      release: 1,
    },
  },
};

export default class SoundEngine {
  private static engine: SoundEngine | null = null;
  public static initialized = false;
  private trackInstruments: TrackInstruments = SoundEngine.initTrackInstruments();
  private animationFrameId: number | null = null;
  private parts: Part[] = [];
  private startingTick = 0;
  private constructor(
    private state: State,
    private onTickUpdate: (tick: number) => void
  ) {}

  private static initTrackInstruments(): TrackInstruments {
    return {
      piano: new PolySynth(placeholderParams).toDestination(),
      guitar: new PolySynth(placeholderParams).toDestination(),
      bass: new PolySynth(placeholderParams).toDestination(),
      drums: new PolySynth(placeholderParams).toDestination(),
    };
  }

  public static async init(state: State, onTickUpdate: (tick: number) => void) {
    if (SoundEngine.initialized) return;
    await start();

    if (!SoundEngine.engine) {
      SoundEngine.engine = new SoundEngine(state, onTickUpdate);
      SoundEngine.engine.setupTransport();
      SoundEngine.engine.updateMidiEvents();
    } else {
      SoundEngine.engine.state = state;
      SoundEngine.engine.onTickUpdate = onTickUpdate;

      SoundEngine.engine.updateMidiEvents();
    }

    SoundEngine.initialized = true;
  }
  public static get(): SoundEngine {
    if (!SoundEngine.engine || !SoundEngine.initialized) {
      throw new Error("SoundEngine not initialized. Call SoundEngine.init(...) first.");
    }
    return SoundEngine.engine;
  }

  private get transport() {
    return getTransport();
  }

  private setupTransport() {
    this.transport.bpm.value = this.state.config.bpm;
    this.transport.PPQ = this.state.config.ppq;
    this.transport.scheduleRepeat(() => {
      this.onTickUpdate(this.transport.ticks);
    }, "16i");
  }

  public updateMidiEvents() {
    this.transport.cancel();
    this.parts.forEach((p) => {
      p.dispose();
    });
    this.parts = [];

    this.state.tracks.forEach((track, index) => {
      const synth = this.getInstrumentForTrack(index);
      if (synth) this.scheduleMidiEvents(track, synth);
    });
  }

  public get currentTicks(): number {
    return this.transport.ticks;
  }

  private getInstrumentForTrack(index: number): PolySynth | Sampler | null {
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

  private scheduleMidiEvents(track: Track, synth: PolySynth | Sampler) {
    const part = new Part((time, note) => {
      synth.triggerAttackRelease(
        Midi(note.midi).toNote(),
        `${note.durationTicks}i`,
        time,
        note.velocity / 100
      );
      logger.info(
        `[MIDI NoteOn] Tick: ${this.transport.ticks} | Note: ${note.midi} | Velocity: ${note.velocity} `
      );
    }, this.createNotesFromTrack(track));

    part.start(0);
    this.parts.push(part);
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
        durationTicks,
        velocity,
        midi,
      });
    }
    return array;
  }

  public play() {
    start().then(() => {
      this.transport.ticks = this.startingTick;
      this.transport.start();
      this.startTickLoop();
    });
  }

  public pause() {
    this.transport.pause();
    this.releaseAllInstruments();
    this.stopTickLoop();
  }

  public reset() {
    this.transport.stop();
    this.transport.position = "0:0:0";
    this.startingTick = 0;
    this.releaseAllInstruments();
    this.stopTickLoop();
    this.onTickUpdate(0);
  }

  private startTickLoop() {
    const loop = () => {
      this.onTickUpdate(this.transport.ticks);
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
    Object.values(this.trackInstruments).forEach((synth) => {
      if (synth instanceof PolySynth) {
        synth.releaseAll();
      }
    });
  }

  public stopAll() {
    this.pause();
    this.transport.cancel();
    this.onTickUpdate = () => {};
  }
}
