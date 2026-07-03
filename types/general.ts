import type { Strategy } from "../engines/piano-roll-engine";

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PianoRollConfig = {
  root_div: HTMLDivElement;
  pianoKeyboardSize: number;
  strategy: Strategy;
  isMobile: boolean;
  colors: {
    primary: string;
    primary_muted: string;
    secondary: string;
    background: string;
    popover: string;
    foreground: string;
    muted: string;
  };
};
