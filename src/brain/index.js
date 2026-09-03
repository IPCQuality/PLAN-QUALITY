import utils from './utils.js';
import core from './core.js';
import validator from './validator.js';
import formatter from './formatter.js';
import history from './history.js';
import heatmap from './heatmap.js';

const BrainAI = {
  ...utils,
  ...core,
  ...validator,
  ...formatter,
  ...history,
  ...heatmap
};

// Dukungan Export Window / Global / Module Node
if (typeof window !== "undefined") {
  window.BrainAI = BrainAI;
}
if (typeof globalThis !== "undefined") {
  globalThis.BrainAI = BrainAI;
}

export default BrainAI;
