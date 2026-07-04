import { logger } from "@/lib/logger";
import { State } from "@/midi-editor/types/instance";

export type IterationParams = {
  repeatIndex: number;
  targetBpm: number;
  targetTranspose: number;
  startTick: number;
};

export class PracticeLogic {
  getNextIterationParams(state: State): IterationParams | null {
    const { config } = state;

    if (!config.loop || config.repeats <= config.loop.currentRepeatIndex) {
      return null;
    }

    const nextIndex = config.loop.currentRepeatIndex + 1;
    return {
      repeatIndex: nextIndex,
      targetBpm: config.bpm + config.bpmPractice * nextIndex,
      targetTranspose: config.transpositionPractice * nextIndex,
      startTick: config.loop.start,
    };
  }

  isLastIteration(state: State): boolean {
    const { config } = state;
    if (!config.loop || config.repeats === 0) return false;
    return config.loop.currentRepeatIndex >= config.repeats;
  }
}
