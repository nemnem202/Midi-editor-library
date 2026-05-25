import { State } from "@/midi-editor/types/instance";

export class PracticeLogic {
  getNextIterationParams(state: State) {
    const { config } = state;
    if (!config.loop) return null;

    const nextIndex = config.loop.currentRepeatIndex + 1;

    // Si on a atteint le nombre de répétitions (0 = infini)
    if (config.repeats > 0 && nextIndex >= config.repeats) {
      return null;
    }

    return {
      repeatIndex: nextIndex,
      targetBpm: config.bpm + config.bpmPractice * nextIndex,
      targetTranspose: config.transpositionPractice * nextIndex,
      startTick: config.loop.start,
    };
  }
}
