import type { MidiData, NoteIndex } from "../types/instance";
import { grow } from "../lib/array-helpers";

export function selectNote(midiData: MidiData, index: NoteIndex) {
  const { selectedNotes } = midiData;
  unSelectAllNotes(midiData);
  selectedNotes[index] = 1;
}

export function unSelectAllNotes(midiData: MidiData) {
  const { noteCount, selectedNotes } = midiData;
  for (let i = 0; i < noteCount; i++) {
    selectedNotes[i] = 0;
  }
}

export function selectNotes(midiData: MidiData, indexes: NoteIndex[]) {
  const { noteCount, selectedNotes } = midiData;
  unSelectAllNotes(midiData);
  for (const idx of indexes) {
    if (idx >= 0 && idx < noteCount) {
      selectedNotes[idx] = 1;
    }
  }
}

export function addNote(
  midiData: MidiData,
  midi: number,
  start: number,
  duration: number,
  velocity = 100,
): NoteIndex {
  if (midiData.noteCount >= midiData.capacity) {
    grow(midiData);
  }
  const index = midiData.noteCount++;
  midiData.midiValues[index] = midi;
  midiData.startTicks[index] = start;
  midiData.durationInTicks[index] = duration;
  midiData.velocities[index] = velocity;
  midiData.selectedNotes[index] = 0;
  return index;
}
export function removeNote(midiData: MidiData, index: NoteIndex) {
  const last = midiData.noteCount - 1;
  if (index !== last) {
    midiData.midiValues[index] = midiData.midiValues[last];
    midiData.startTicks[index] = midiData.startTicks[last];
    midiData.durationInTicks[index] = midiData.durationInTicks[last];
    midiData.velocities[index] = midiData.velocities[last];
    midiData.selectedNotes[index] = midiData.selectedNotes[last];
  }
  midiData.noteCount--;
}

export function moveNote(midiData: MidiData, index: NoteIndex, midi: number, start: number) {
  midiData.midiValues[index] = midi;
  midiData.startTicks[index] = start;
}

export function resizeNote(midiData: MidiData, index: NoteIndex, duration: number) {
  midiData.durationInTicks[index] = duration;
}

export function moveSelectedNotes(midiData: MidiData, midiOffset: number, tickOffset: number) {
  const { noteCount, selectedNotes } = midiData;
  for (let i = 0; i < noteCount; i++) {
    if (selectedNotes[i]) {
      midiData.midiValues[i] += midiOffset;
      midiData.startTicks[i] += tickOffset;
    }
  }
}

export function resizeSelectedNotes(midiData: MidiData, duration: number) {
  const { noteCount, selectedNotes } = midiData;
  for (let i = 0; i < noteCount; i++) {
    if (selectedNotes[i]) {
      midiData.durationInTicks[i] = duration;
    }
  }
}

export function removeSelectedNotes(midiData: MidiData) {
  const { noteCount, selectedNotes } = midiData;
  for (let i = noteCount - 1; i >= 0; i--) {
    if (selectedNotes[i]) {
      removeNote(midiData, i);
    }
  }
}

export function addNotes(
  midiData: MidiData,
  notes: Array<{ midi: number; start: number; duration: number; velocity?: number }>,
) {
  for (const note of notes) {
    addNote(midiData, note.midi, note.start, note.duration, note.velocity);
  }
}
