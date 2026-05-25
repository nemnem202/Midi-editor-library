import { Sequencer, WorkerSynthesizer } from "spessasynth_lib";
import { Action, type MidiAction } from "../../types/actions";
import { logger } from "../../lib/logger";
// @ts-ignore
import soundfont from "@/assets/soundfonts/GeneralUserGS.sf3";
import type { State } from "../../types/instance";
import { useMidiStore } from "../../stores/use-midi-store";
import { convertTickToSeconds } from "../../lib/utils";
import { AudioCore } from "./audioCore";

export type NoteOnCallback = { midiNote: number; channel: number; velocity: number };
export type NoteOffCallback = { midiNote: number; channel: number };
export enum NoteEventKind {
  On,
  Off,
}

export type NoteEvent = (NoteOnCallback | NoteOffCallback) & { type: NoteEventKind };

export class NoteTracker {
  private readonly _notesEvents: NoteEvent[] = [];
  private activeMidiNotes = new Set<string>();

  private noteKey(midiNote: number, channel: number) {
    return `${channel}:${midiNote}`;
  }
  constructor(private synth: WorkerSynthesizer) {
    synth.eventHandler.addEvent("noteOn", "Id note on", (note: NoteOnCallback) => {
      this._notesEvents.push({ ...note, type: NoteEventKind.On });
      this.activeMidiNotes.add(this.noteKey(note.midiNote, note.channel));
    });

    synth.eventHandler.addEvent("noteOff", "Id note off", (note: NoteOffCallback) => {
      const key = this.noteKey(note.midiNote, note.channel);
      if (this.activeMidiNotes.has(key)) {
        this._notesEvents.push({ ...note, type: NoteEventKind.Off });
        this.activeMidiNotes.delete(key);
      }
    });
  }

  get notesEvents() {
    return this._notesEvents;
  }

  clearNotesEvents() {
    this._notesEvents.length = 0;
  }

  resetNotesEvents() {
    this._notesEvents.length = 0;
    this.activeMidiNotes.clear();
  }
}
