// =============================================================================
// BRAIN MASTER CONTROLLER (src/brain.js)
// Master Controller: Switcher & Router Mode 1 (Heuristik) & Mode 2 (0 Kode)
// Menggunakan rule.js sebagai aturan center
// =============================================================================

import rule from './rule.js';
import brainMode1 from './brainMode1.js';
import brainMode2 from './brainMode2.js';

let activeMode = 1;

// Mode default adalah mode 1
if (typeof localStorage !== "undefined") {
  try {
    const saved = localStorage.getItem("factory_brain_mode");
    if (saved === "2" || saved === 2) {
      activeMode = 2;
    } else {
      activeMode = 1;
    }
  } catch (e) {
    activeMode = 1;
  }
}

export const BrainController = {
  // Mode selection: 1 (BrainMode1 - Heuristik, DEFAULT) | 2 (BrainMode2 - 0 Kode)
  getMode() {
    return activeMode || 1;
  },

  setMode(mode) {
    if (mode === 2 || mode === "2" || String(mode).toLowerCase() === "mode2") {
      activeMode = 2;
    } else {
      activeMode = 1; // Default selalu Mode 1
    }
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("factory_brain_mode", String(activeMode));
      } catch (e) {}
    }
    return activeMode;
  },

  getActiveEngine() {
    return activeMode === 2 ? brainMode2 : brainMode1;
  },

  // Main planning entry point:
  // Jika konfigurasi memakai mode 1 (atau default), maka:
  // brain.js -> brainMode1.js -> output
  generatePlan(machines, cqis, config = {}, mapData = {}) {
    // Tentukan mode: Default adalah mode 1
    let targetMode = 1;
    if (
      config.brainMode === 2 ||
      config.brainMode === "2" ||
      config.mode === "mode2" ||
      (!config.brainMode && activeMode === 2)
    ) {
      targetMode = 2;
    } else {
      // Default pasti Mode 1
      targetMode = 1;
    }

    if (targetMode === 1) {
      // Pipeline: brain.js -> brainMode1.js -> output
      console.info("[BrainController] Eksekusi plan menggunakan brain.js -> brainMode1.js -> output (Mode 1)");
      const output = brainMode1.generatePlan(machines, cqis, config, mapData);
      return output;
    } else {
      // Pipeline: brain.js -> brainMode2.js -> output
      console.info("[BrainController] Eksekusi plan menggunakan brain.js -> brainMode2.js -> output (Mode 2)");
      const output = brainMode2.generatePlan(machines, cqis, config, mapData);
      return output;
    }
  },

  // Validasi & Formatter
  validate(slots, machines = [], mode = null) {
    return rule.validate(slots, machines);
  },

  formatText(slots, config = {}) {
    return rule.formatText(slots, config);
  },

  formatMachineList(machines, allRunning = null, labels = []) {
    return rule.formatMachineList(machines, allRunning, labels);
  },

  // Export ke Excel
  exportToExcel(slots, config = {}) {
    return rule.exportToExcel(slots, config);
  },

  exportExcel(slots, config = {}) {
    return rule.exportExcel(slots, config);
  },

  // Scoring Utilities (Skala Terstandarisasi 1-10)
  calculateGlobalFitness(slots, engine, labels) {
    return rule.calculateGlobalFitness(slots, engine, labels);
  },

  getSlotProximityScore(m, slot, engine, labels) {
    return rule.getSlotProximityScore(m, slot, engine, labels);
  },

  // Riwayat & Pembelajaran
  savePlanHistory(slots, config) {
    return rule.savePlanHistory(slots, config);
  },

  // References & Forwarding
  rule,
  validator: rule,
  manpower: rule,
  scorer: rule,
  excel: rule,
  brainMode1,
  brainMode2,
  modes: {
    mode1: brainMode1,
    mode2: brainMode2,
  },

  ...rule,
};

// Global / Window binding
if (typeof window !== "undefined") {
  window.BrainAI = BrainController;
  window.brain = BrainController;
  window.brainMode1 = brainMode1;
  window.brainMode2 = brainMode2;
  window.rule = rule;
}

if (typeof globalThis !== "undefined") {
  globalThis.BrainAI = BrainController;
  globalThis.brain = BrainController;
  globalThis.brainMode1 = brainMode1;
  globalThis.brainMode2 = brainMode2;
  globalThis.rule = rule;
}

export {
  rule,
  brainMode1,
  brainMode2,
};

export default BrainController;
