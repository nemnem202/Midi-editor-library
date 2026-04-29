import type { MidiData } from "../types/instance";

type TypedArray =
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Float32Array
  | Float64Array;

export function resize<T extends TypedArray>(arr: T, newCapacity: number): T {
  const next = new (arr.constructor as any)(newCapacity);
  next.set(arr);
  return next;
}

export function grow(m: MidiData) {
  const newCapacity = m.capacity * 2;

  m.pitches = resize(m.pitches, newCapacity);
  m.startTicks = resize(m.startTicks, newCapacity);
  m.durations = resize(m.durations, newCapacity);
  m.velocities = resize(m.velocities, newCapacity);
  m.selectedNotes = resize(m.selectedNotes, newCapacity);

  m.capacity = newCapacity;
}
