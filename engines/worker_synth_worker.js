// This code is called in the worker

import { WorkerSynthesizerCore } from "spessasynth_lib";

/**
 * @type {WorkerSynthesizerCore}
 */
let workerSynthCore;

// biome-ignore lint/suspicious/noGlobalAssign: this still works fine
onmessage = (event) => {
  if (event.ports[0]) {
    workerSynthCore = new WorkerSynthesizerCore(event.data, event.ports[0], postMessage.bind(this));
  } else {
    void workerSynthCore.handleMessage(event.data);
  }
};
