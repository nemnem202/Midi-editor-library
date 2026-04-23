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
