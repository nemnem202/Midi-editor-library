import { logger } from "@/lib/logger";
import SoundEngine from "../engines/sound-engine";
import type { State, Track, TrackId } from "../types/instance";

export function changeCurrentTrack(state: State, trackId: TrackId) {
  state.currentTrackId = trackId;
}

export function addTrack(state: State, track: Track) {
  state.tracks.push(track);
}

export function removeTrack(state: State, trackId: TrackId) {
  state.tracks = state.tracks.filter((t) => t.id !== trackId);
  if (state.currentTrackId === trackId && state.tracks.length > 0) {
    state.currentTrackId = state.tracks[0].id;
  }
}

export function changeTrackVolume(state: State, trackId: TrackId, volume: number) {
  const index = state.tracks.findIndex((track) => track.id === trackId);
  if (index >= 0) {
    state.tracks[index].volume = Math.min(100, Math.max(0, volume));
    SoundEngine.get()?.changeChannelVolume(state.tracks[index].channel, state.tracks[index].volume);
  }
}

export function muteTrack(state: State, trackId: TrackId) {
  const index = state.tracks.findIndex((track) => track.id === trackId);
  if (index >= 0) {
    state.tracks[index].muted = true;
  }
}

export function unmuteTrack(state: State, trackId: TrackId) {
  const index = state.tracks.findIndex((track) => track.id === trackId);
  if (index >= 0) {
    state.tracks[index].muted = false;
  }
}
