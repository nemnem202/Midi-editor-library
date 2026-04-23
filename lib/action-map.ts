import { Action } from "../types/actions";

export const NOTE_ACTIONS = [
	Action.ADD_NOTE,
	Action.ADD_NOTES,
	Action.MOVE_NOTE,
	Action.MOVE_SELECTED_NOTES,
	Action.REMOVE_NOTE,
	Action.REMOVE_SELECTED_NOTES,
	Action.RESIZE_NOTE,
	Action.RESIZE_SELECTED_NOTES,
	Action.SELECT_NOTE,
	Action.SELECT_NOTES,
	Action.CHANGE_CURRENT_TRACK,
	Action.UNSELECT_ALL_NOTES,
];

export const MIDI_EVENT_CHANGE_ACTIONS = [
	Action.ADD_NOTE,
	Action.ADD_NOTES,
	Action.MOVE_NOTE,
	Action.MOVE_SELECTED_NOTES,
	Action.REMOVE_NOTE,
	Action.REMOVE_SELECTED_NOTES,
	Action.RESIZE_NOTE,
	Action.RESIZE_SELECTED_NOTES,
];

export const LOOP_ACTIONS = [Action.SET_LOOP];

export const LAYOUT_ACTIONS = [
	Action.SET_BPM,
	Action.SET_SIGNATURE,
	Action.SET_SUBDIVISION,
];

export const PIANO_KEYBOARD_ACTIONS = [Action.ADD_NOTE, Action.MOVE_NOTE];

export const GRID_ACTIONS = [
	Action.SET_BPM,
	Action.SET_SIGNATURE,
	Action.SET_SUBDIVISION,
];

export const TACKLIST_ACTIONS = [Action.SET_TRANSPORT_START];
