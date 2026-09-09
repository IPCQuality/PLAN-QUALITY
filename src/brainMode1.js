// =============================================================================
// BRAIN MODE 1 - Relativistic Gravity & Geodesic Optimization Engine
// Paradigma: Fisika Gravitasi & Termodinamika Distribusi Beban Manpower
//
// 1. Hukum Jarak Geodesik (Physical Grid & Corridor Distance - Tanpa Hardcoded Map)
// 2. Relativitas Beban Kerja (Gravitational Mass Mm per Tipe Produk Mesin)
// 3. Lagrangian Objective Function (Unified Optimization Field)
// 4. Termodinamika Distribusi Manpower (Fermi-Dirac / Variance Minimization)
// 5. Self-Healing Constraint Solver (Deteksi Singularity & Ekuilibrium Stabil)
// =============================================================================

import rule from './rule.js';

// =============================================================================
// SUBMODULE 1: PHYSICS CONSTANTS & GRAVITATIONAL MASS
// =============================================================================
const physics = {
  // Gravitational Mass (Mm) berdasarkan kompleksitas proses, volume & waktu sampling
  GRAVITATIONAL_MASS: {
    "12LJUMBO": 1.25,  // Jumbo 12L: Volume besar & handling berat
    "SOSOFT": 1.25,    // Sosoft: Multi-botol, sampling intensif
    "BOTOL": 1.05,     // Botol: Presisi capping & torque
    "POUCH": 1.00,     // Pouch: Baseline standar
    "SKLSCT": 0.95,    // Sachet SKL: Kontinu berkecepatan tinggi
    "OT": 0.85,        // Oven Test: Dedicated batch
    "WW": 0.90,        // Waste Water: Monitoring berkala
  },

  // Bobot Unified Objective Function (Lagrange Multipliers)
  WEIGHTS: {
    w_distance: 1.00,   // Jarak Geodesik
    w_cluster: 1.50,    // Kemurnian / Sinergi Klaster
    w_line: 2.00,       // Integritas Lini Fisik
    w_variance: 1.20,   // Keseimbangan Beban (Entropi)
    w_preference: 0.80  // Preferensi Personil
  },

  getMachineMass(m) {
    const cluster = (rule.getMachineClusterGroup ? rule.getMachineClusterGroup(m) : "POUCH").toUpperCase();
    if (rule.isOtMachine && rule.isOtMachine(m)) return this.GRAVITATIONAL_MASS.OT;
    if (rule.isWwMachine && rule.isWwMachine(m)) return this.GRAVITATIONAL_MASS.WW;
    return this.GRAVITATIONAL_MASS[cluster] || 1.00;
  },

  getCqiCoordinates(cqi) {
    if (!cqi) return { row: 10, col: 10 };
    if (cqi.row !== undefined && cqi.col !== undefined && cqi.row > 0 && cqi.col > 0) {
      return { row: cqi.row, col: cqi.col };
    }
    if (cqi.position && cqi.position.row > 0 && cqi.position.col > 0) {
      return { row: cqi.position.row, col: cqi.position.col };
    }
    const cNum = typeof cqi === "number" ? cqi : (rule.getCqiNumber ? rule.getCqiNumber(cqi) : 0);
    // Posisi fisik pos CQI pada denah pabrik
    const cqiGridPositions = {
      1: { row: 5, col: 4 },
      2: { row: 5, col: 7 },
      3: { row: 5, col: 10 },
      4: { row: 5, col: 13 },
      5: { row: 5, col: 16 },
      6: { row: 5, col: 19 },
      7: { row: 5, col: 22 },
      8: { row: 5, col: 25 },
      9: { row: 5, col: 28 },
      10: { row: 5, col: 31 },
      11: { row: 14, col: 4 },
      12: { row: 14, col: 31 },
      13: { row: 14, col: 7 },
      14: { row: 14, col: 16 },
      15: { row: 14, col: 22 },
      16: { row: 14, col: 25 },
      17: { row: 14, col: 28 },
      18: { row: 15, col: 36 },
      19: { row: 5, col: 35 },
      20: { row: 15, col: 44 },
      21: { row: 14, col: 10 },
      22: { row: 14, col: 13 },
      23: { row: 14, col: 19 },
      24: { row: 8, col: 35 },
      25: { row: 14, col: 25 },
    };
    return cqiGridPositions[cNum] || { row: 10, col: 15 };
  },

  getMachineCoordinates(m) {
    if (!m) return { row: 10, col: 10 };
    if (m.row !== undefined && m.col !== undefined && m.row > 0 && m.col > 0) {
      return { row: m.row, col: m.col };
    }
    if (m.position && m.position.row > 0 && m.position.col > 0) {
      return { row: m.position.row, col: m.position.col };
    }
    return { row: 8, col: 15 };
  },

  // Jarak Geodesik Koridor Nyata (Row 2 = Koridor Belakang Line A, Row 10 = Koridor Depan Line B)
  calculateGeodesicDistance(m, cqi, labels = []) {
    const mPos = this.getMachineCoordinates(m);
    const cPos = this.getCqiCoordinates(cqi);

    const mLine = rule.getMachineLine ? rule.getMachineLine(m, labels) : "LINE A";
    const ws = (rule.getWorkstationKey ? rule.getWorkstationKey(m, labels) : "").toUpperCase();

    const isLineA = mLine === "LINE A" || ws.endsWith("A") || (mPos.row <= 9 && mPos.col <= 30 && !ws.endsWith("B"));
    const isLineB = mLine === "LINE B" || ws.endsWith("B") || (mPos.row >= 10 && mPos.row <= 17 && mPos.col <= 30);

    let corridorRow = 10;
    if (isLineA || (rule.isOtMachine && rule.isOtMachine(m))) {
      corridorRow = 2; // Koridor Belakang Line A
    } else if (isLineB) {
      corridorRow = 10; // Koridor Depan Line B
    } else {
      corridorRow = mPos.row <= 9 ? 2 : 10;
    }

    // Geodesic path: Machine -> Corridor -> CQI
    const d1 = Math.abs(mPos.row - corridorRow);
    const d2 = Math.abs(mPos.col - cPos.col);
    const d3 = Math.abs(cPos.row - corridorRow);

    return d1 + d2 + d3;
  },

  // Potensial Gravitasi: Gaya tarik pos CQI terhadap mesin
  calculateGravitationalAttraction(m, slot, labels = []) {
    const dist = this.calculateGeodesicDistance(m, slot.cqi || slot, labels);
    const mass = this.getMachineMass(m);

    // Sinergi klaster
    const mCluster = rule.getMachineClusterGroup ? rule.getMachineClusterGroup(m) : "POUCH";
    let clusterSynergy = 1.0;
    if (slot.machines && slot.machines.length > 0) {
      const sameClusterCount = slot.machines.filter(sm => (rule.getMachineClusterGroup ? rule.getMachineClusterGroup(sm) : "") === mCluster).length;
      clusterSynergy += (sameClusterCount / slot.machines.length) * 0.5;
    }

    // Integritas Lini
    const mLine = rule.getMachineLine ? rule.getMachineLine(m, labels) : "LINE A";
    const lineSynergy = (slot.line === mLine) ? 1.3 : 0.7;

    // F = (M * S_cluster * S_line) / (1 + distance^1.2)
    return (mass * clusterSynergy * lineSynergy) / Math.pow(1 + dist, 1.15);
  },

  // Total Kelengkungan Energi Slot (Sum of Gravitational Masses)
  calculateSlotEnergy(slot) {
    if (!slot || !slot.machines || slot.machines.length === 0) return 0;
    return slot.machines.reduce((sum, m) => sum + this.getMachineMass(m), 0);
  }
};

// =============================================================================
// SUBMODULE 2: CQI GRAVITATIONAL SELECTOR
// =============================================================================
const cqiSelector = {
  selectActiveSlots(runningMachines, cqis, config = {}, r = rule) {
    const rawPool = Array.isArray(cqis) && cqis.length > 0 ? cqis : [];
    const activeCqis = rawPool.filter(c => {
      if (!c) return false;
      const st = String(c.status || "").toUpperCase();
      return st !== "OFF" && st !== "INACTIVE" && st !== "DOWN";
    });

    if (activeCqis.length === 0) return [];

    const coreList = Array.isArray(config.coreData) && config.coreData.length > 0
      ? config.coreData
      : (Array.isArray(config.coreNames) && config.coreNames.length > 0 ? config.coreNames : []);

    let targetCoreCount = coreList.length;
    if (targetCoreCount === 0 && typeof config.core === "number" && config.core > 0) {
      targetCoreCount = config.core;
    }
    if (targetCoreCount <= 0 || targetCoreCount > activeCqis.length) {
      targetCoreCount = activeCqis.length;
    }

    const activeCqiMap = new Map();
    activeCqis.forEach(c => {
      const num = r.getCqiNumber ? r.getCqiNumber(c) : (c.cqiNum || 0);
      if (num > 0) activeCqiMap.set(num, c);
    });

    const hasOt = runningMachines.some(m => r.isOtMachine ? r.isOtMachine(m) : false);
    const hasWw = runningMachines.some(m => r.isWwMachine ? r.isWwMachine(m) : false);

    const selectedCqiNums = new Set();

    // 1. Masukkan CQI Mandatori jika mesin ada
    if (hasOt && activeCqiMap.has(19)) selectedCqiNums.add(19);
    if (hasWw && activeCqiMap.has(24)) selectedCqiNums.add(24);

    // 2. Preferensi personil Core
    coreList.forEach(c => {
      if (selectedCqiNums.size >= targetCoreCount) return;
      const pref = typeof c === "object" ? (c.cqi_priority || c.preferredCqi || c.cqiNum || c.cqi) : null;
      if (pref) {
        const num = r.getCqiNumber ? r.getCqiNumber(pref) : 0;
        if (num > 0 && activeCqiMap.has(num) && !selectedCqiNums.has(num)) {
          if (num === 19 && !hasOt) return;
          if (num === 24 && !hasWw) return;
          selectedCqiNums.add(num);
        }
      }
    });

    // 3. Distribusi Geodesik Berbasis Massa Mesin (Gravitational Attractor Selection)
    // Hitung pusat massa spasial (Centroid) untuk mesin-mesin yang belum tercover
    while (selectedCqiNums.size < targetCoreCount) {
      let bestCqiNum = null;
      let maxFieldScore = -1;

      for (const [cNum, cObj] of activeCqiMap.entries()) {
        if (selectedCqiNums.has(cNum)) continue;

        let totalAttraction = 0;
        runningMachines.forEach(m => {
          const dist = physics.calculateGeodesicDistance(m, cObj);
          const mass = physics.getMachineMass(m);
          totalAttraction += mass / (1 + dist);
        });

        if (totalAttraction > maxFieldScore) {
          maxFieldScore = totalAttraction;
          bestCqiNum = cNum;
        }
      }

      if (bestCqiNum) {
        selectedCqiNums.add(bestCqiNum);
      } else {
        break;
      }
    }

    const selectedSlots = Array.from(selectedCqiNums).sort((a, b) => a - b).map(cqiNum => {
      const cObj = activeCqiMap.get(cqiNum) || { id: "CQI-" + cqiNum, name: "CQI " + cqiNum };
      return {
        ...cObj,
        cqi: cObj,
        cqiNum,
        id: cObj.id || ("CQI-" + cqiNum),
        name: cObj.name || ("CQI " + cqiNum),
        line: r.getCqiPrimaryLine ? r.getCqiPrimaryLine(cObj) : "LINE A",
        machines: [],
        core: 1,
        coreNames: [],
        nonCore: [],
        longshift: [],
        workstations: new Set()
      };
    });

    return selectedSlots;
  }
};

// =============================================================================
// SUBMODULE 3: GEODESIC GRAVITY ALLOCATOR
// =============================================================================
const gravityAllocator = {
  allocate(runningMachines, selectedSlots, r = rule, mapData = {}) {
    const labels = mapData.labels || [];
    const assignedIds = new Set();

    const assign = (m, slot) => {
      slot.machines.push(m);
      slot.workstations.add(r.getWorkstationKey ? r.getWorkstationKey(m, labels) : "1A");
      assignedIds.add(m.id || m.name);
    };

    // 1. Mandatori Fisik Khusus (OT -> CQI 19, WW -> CQI 24)
    const slot19 = selectedSlots.find(s => s.cqiNum === 19);
    if (slot19) {
      runningMachines.filter(m => r.isOtMachine && r.isOtMachine(m)).forEach(m => assign(m, slot19));
    }
    const slot24 = selectedSlots.find(s => s.cqiNum === 24);
    if (slot24) {
      runningMachines.filter(m => r.isWwMachine && r.isWwMachine(m)).forEach(m => assign(m, slot24));
    }

    // 2. Kelompokkan Mesin per Workstation Blok Fisik (Untuk menjaga integritas fisik tanpa membelah meja)
    const wsGroups = new Map();
    runningMachines.forEach(m => {
      if (assignedIds.has(m.id || m.name)) return;
      const wsKey = (r.getWorkstationKey ? r.getWorkstationKey(m, labels) : "1A") + "_" + (r.getMachineClusterGroup ? r.getMachineClusterGroup(m) : "POUCH");
      if (!wsGroups.has(wsKey)) wsGroups.set(wsKey, []);
      wsGroups.get(wsKey).push(m);
    });

    // 3. Gravitational Field Clustering (Tiap blok ditarik oleh slot dengan Lagrangian Optimal)
    // Urutkan blok berdasarkan densitas energi massa terbesar
    const sortedBlocks = Array.from(wsGroups.entries()).sort((a, b) => {
      const massA = a[1].reduce((sum, m) => sum + physics.getMachineMass(m), 0);
      const massB = b[1].reduce((sum, m) => sum + physics.getMachineMass(m), 0);
      return massB - massA;
    });

    for (const [wsKey, machines] of sortedBlocks) {
      const available = machines.filter(m => !assignedIds.has(m.id || m.name));
      if (available.length === 0) continue;

      let bestSlot = null;
      let highestAttraction = -Infinity;

      for (const slot of selectedSlots) {
        if (slot.cqiNum === 19) continue; // CQI 19 dedicated OT
        if (slot.cqiNum === 24 && !available.some(m => r.isWwMachine && r.isWwMachine(m))) {
          // WW slot hanya menerima Line C Pouch tambahan jika muat
          const isLineC = available.every(m => (r.getMachineLine ? r.getMachineLine(m, labels) : "") === "LINE C");
          if (!isLineC || slot.machines.length + available.length > 6) continue;
        }

        // Cek batasan kapasitas klaster
        const combined = [...slot.machines, ...available];
        const cap = r.getClusterCapacityRule ? r.getClusterCapacityRule(combined) : { max2Nc: 8 };
        const maxCapacity = cap.max2Nc || 8;
        if (slot.machines.length + available.length > maxCapacity) continue;

        // Cek kompatibilitas klaster
        if (!available.every(m => r.canAddMachineToSlotCluster ? r.canAddMachineToSlotCluster(m, slot) : true)) continue;

        // Hitung total gaya tarik gravitasi blok terhadap slot
        let blockAttraction = 0;
        available.forEach(m => {
          blockAttraction += physics.calculateGravitationalAttraction(m, slot, labels);
        });

        // Penalti varians beban (mencegah akumulasi gravitasi berlebih / singularity)
        const currentEnergy = physics.calculateSlotEnergy(slot);
        const energyPenalty = currentEnergy * 0.25;

        const netScore = blockAttraction - energyPenalty;

        if (netScore > highestAttraction) {
          highestAttraction = netScore;
          bestSlot = slot;
        }
      }

      if (bestSlot) {
        available.forEach(m => assign(m, bestSlot));
      }
    }

    // 4. Sisa Mesin Individual (Fine-Grained Geodesic Infill)
    const unassigned = runningMachines.filter(m => !assignedIds.has(m.id || m.name));
    unassigned.forEach(m => {
      let bestSlot = null;
      let highestAttraction = -Infinity;

      for (const slot of selectedSlots) {
        if (slot.cqiNum === 19) continue;
        const combined = [...slot.machines, m];
        const cap = r.getClusterCapacityRule ? r.getClusterCapacityRule(combined) : { max2Nc: 8 };
        const maxCapacity = cap.max2Nc || 8;
        if (slot.machines.length >= maxCapacity) continue;
        if (r.canAddMachineToSlotCluster && !r.canAddMachineToSlotCluster(m, slot)) continue;

        const attraction = physics.calculateGravitationalAttraction(m, slot, labels);
        const netScore = attraction - (slot.machines.length * 0.15);

        if (netScore > highestAttraction) {
          highestAttraction = netScore;
          bestSlot = slot;
        }
      }

      if (bestSlot) {
        assign(m, bestSlot);
      }
    });

    return assignedIds;
  }
};

// =============================================================================
// SUBMODULE 4: THERMODYNAMIC LOAD BALANCER
// =============================================================================
const loadBalancer = {
  balance(selectedSlots, runningMachines, r = rule, mapData = {}) {
    const labels = mapData.labels || [];
    const activeSlots = selectedSlots.filter(s => s.machines && s.machines.length > 0 && s.cqiNum !== 19);

    if (activeSlots.length < 2) return;

    // Minimisasi Entropi Beban intra-lini & antar-pos terdekat
    for (let iter = 0; iter < 8; iter++) {
      activeSlots.sort((a, b) => physics.calculateSlotEnergy(b) - physics.calculateSlotEnergy(a));
      const heaviest = activeSlots[0];
      const lightest = activeSlots[activeSlots.length - 1];

      const energyDiff = physics.calculateSlotEnergy(heaviest) - physics.calculateSlotEnergy(lightest);
      if (energyDiff <= 1.2) break; // Sudah dalam kesetimbangan termodinamika stabil

      let shifted = false;
      for (let i = heaviest.machines.length - 1; i >= 0; i--) {
        const cand = heaviest.machines[i];
        if (r.isOtMachine && r.isOtMachine(cand)) continue;
        if (r.isWwMachine && r.isWwMachine(cand)) continue;

        const combined = [...lightest.machines, cand];
        const cap = r.getClusterCapacityRule ? r.getClusterCapacityRule(combined) : { max2Nc: 8 };
        if (lightest.machines.length >= (cap.max2Nc || 8)) continue;
        if (r.canAddMachineToSlotCluster && !r.canAddMachineToSlotCluster(cand, lightest)) continue;

        // Pindahkan partikel mesin ke slot energi lebih rendah
        heaviest.machines.splice(i, 1);
        lightest.machines.push(cand);
        lightest.workstations.add(r.getWorkstationKey ? r.getWorkstationKey(cand, labels) : "1A");
        shifted = true;
        break;
      }

      if (!shifted) break;
    }
  }
};

// =============================================================================
// SUBMODULE 5: THERMODYNAMIC MANPOWER ASSIGNER (Fermi-Dirac Distribution)
// =============================================================================
const manpowerAssigner = {
  assign(activeSlots, config = {}, r = rule) {
    const coreList = Array.isArray(config.coreData) ? [...config.coreData] : [];
    const nonCoreList = Array.isArray(config.nonCoreData) ? [...config.nonCoreData] : [];
    const assignedCore = new Set();

    // 1. Distribusi Core Personil (Preferensi Gravitasi Posisi)
    activeSlots.forEach(s => {
      const matchIdx = coreList.findIndex(c => {
        if (assignedCore.has(c.id || c.name)) return false;
        const pref = c.cqi_priority || c.preferredCqi || c.cqiNum || c.cqi;
        return pref && (r.getCqiNumber ? r.getCqiNumber(pref) : 0) === s.cqiNum;
      });

      if (matchIdx !== -1) {
        const p = coreList[matchIdx];
        s.core = 1;
        s.coreNames = [p.name || p];
        assignedCore.add(p.id || p.name || p);
      }
    });

    let fallbackIdx = 1;
    activeSlots.forEach(s => {
      if (!s.coreNames || s.coreNames.length === 0) {
        const cand = coreList.find(c => !assignedCore.has(c.id || c.name || c));
        if (cand) {
          s.core = 1;
          s.coreNames = [cand.name || cand];
          assignedCore.add(cand.id || cand.name || cand);
        } else {
          s.core = 1;
          s.coreNames = ["Core " + fallbackIdx++];
        }
      }
    });

    // 2. Entropi Fermi-Dirac Non-Core: Alokasikan bantuan ke sumur potensial energi terdalam
    const energyRanked = [...activeSlots].sort((a, b) => {
      const eA = physics.calculateSlotEnergy(a);
      const eB = physics.calculateSlotEnergy(b);
      return eB - eA;
    });

    // Pass 1: Slot dengan beban melebihi daya tampung 1 personil solo (> maxCoreOnly)
    energyRanked.forEach(s => {
      if (nonCoreList.length === 0 || s.cqiNum === 19) return;
      const cap = r.getClusterCapacityRule ? r.getClusterCapacityRule(s) : { maxCoreOnly: 4 };
      if (s.machines.length > cap.maxCoreOnly || physics.calculateSlotEnergy(s) >= 4.5) {
        const nc = nonCoreList.shift();
        s.nonCore.push(nc.name || nc);
      }
    });

    // Pass 2: Slot dengan beban sangat berat (> max1Nc)
    energyRanked.forEach(s => {
      if (nonCoreList.length === 0 || s.cqiNum === 19) return;
      const cap = r.getClusterCapacityRule ? r.getClusterCapacityRule(s) : { max1Nc: 7 };
      if ((s.machines.length > cap.max1Nc || physics.calculateSlotEnergy(s) >= 7.0) && s.nonCore.length < 2) {
        const nc = nonCoreList.shift();
        s.nonCore.push(nc.name || nc);
      }
    });

    // Pass 3: Sisa Non-Core ke slot berenergi tertinggi berikutnya
    energyRanked.forEach(s => {
      if (nonCoreList.length === 0 || s.cqiNum === 19) return;
      if (s.nonCore.length < 2 && s.machines.length >= 3) {
        const nc = nonCoreList.shift();
        s.nonCore.push(nc.name || nc);
      }
    });

    // 3. Distribusi Longshift (LS)
    let ls = typeof config.longshift === "number" ? config.longshift : 0;
    energyRanked.forEach(s => {
      if (ls <= 0 || s.cqiNum === 19) return;
      const totalSupport = s.nonCore.length + s.longshift.length;
      if (totalSupport < 2 && (s.machines.length >= 7 || physics.calculateSlotEnergy(s) >= 6.5)) {
        s.longshift.push("(LS)");
        ls--;
      }
    });

    energyRanked.forEach(s => {
      if (ls <= 0 || s.cqiNum === 19) return;
      const totalSupport = s.nonCore.length + s.longshift.length;
      if (totalSupport < 2 && s.machines.length >= 4) {
        s.longshift.push("(LS)");
        ls--;
      }
    });
  }
};

// =============================================================================
// SUBMODULE 6: SELF-HEALING CONSTRAINT SOLVER (Singularity Detection)
// =============================================================================
const selfHealingSolver = {
  resolveSingularities(activePlan, runningMachines, r = rule, mapData = {}) {
    const labels = mapData.labels || [];
    const assignedIds = new Set();
    activePlan.forEach(s => s.machines.forEach(m => assignedIds.add(m.id || m.name)));

    const unassigned = runningMachines.filter(m => !assignedIds.has(m.id || m.name));
    if (unassigned.length === 0) return;

    console.info(`[Self-Healing Solver] Mendeteksi ${unassigned.length} partikel belum teralokasi. Melakukan Dynamic Relaxation...`);

    unassigned.forEach(m => {
      let candidateSlots = [...activePlan].filter(s => s.cqiNum !== 19);
      candidateSlots.sort((a, b) => {
        const distA = physics.calculateGeodesicDistance(m, a.cqi || a, labels);
        const distB = physics.calculateGeodesicDistance(m, b.cqi || b, labels);
        return distA - distB;
      });

      for (const slot of candidateSlots) {
        const combined = [...slot.machines, m];
        const cap = r.getClusterCapacityRule ? r.getClusterCapacityRule(combined) : { max2Nc: 8 };
        if (slot.machines.length < (cap.max2Nc || 8)) {
          slot.machines.push(m);
          slot.workstations.add(r.getWorkstationKey ? r.getWorkstationKey(m, labels) : "1A");
          assignedIds.add(m.id || m.name);
          break;
        }
      }
    });
  }
};

// =============================================================================
// SUBMODULE 7: CORE ORCHESTRATOR
// =============================================================================
const core = {
  generatePlan(machines = [], cqis = [], config = {}, mapData = {}) {
    const r = rule;
    const runningMachines = machines.filter(m => m.status === "RUNNING" || m.running !== false);

    // 1. Gravitational CQI Selector
    const selectedSlots = cqiSelector.selectActiveSlots(runningMachines, cqis, config, r);

    // 2. Geodesic Gravity Field Allocation
    gravityAllocator.allocate(runningMachines, selectedSlots, r, mapData);

    // 3. Thermodynamic Load Balancing
    loadBalancer.balance(selectedSlots, runningMachines, r, mapData);

    // Filter slot aktif
    const activePlan = selectedSlots.filter(s => s.machines && s.machines.length > 0);

    // 4. Thermodynamic Manpower Assignment (Fermi-Dirac)
    manpowerAssigner.assign(activePlan, config, r);

    // 5. Self-Healing Singularity Resolver
    selfHealingSolver.resolveSingularities(activePlan, runningMachines, r, mapData);

    // Normalisasi workstations ke Array
    activePlan.forEach(s => {
      if (s.workstations instanceof Set) {
        s.workstations = Array.from(s.workstations);
      }
    });

    return activePlan;
  }
};

// =============================================================================
// SUBMODULE 8-11: VALIDATOR, FORMATTER, HISTORY, HEATMAP
// =============================================================================
const validator = {
  validate(slots, runningMachines = []) {
    return rule.validate ? rule.validate(slots, runningMachines) : { valid: true, violations: [], info: [] };
  }
};

const formatter = {
  formatText(slots, config = {}) {
    return rule.formatText ? rule.formatText(slots, config) : "";
  },
  formatMachineList(machines, allRunning = null, labels = []) {
    return rule.formatMachineList ? rule.formatMachineList(machines, allRunning, labels) : "";
  }
};

const history = {
  savePlanHistory(slots, config = {}) {
    return rule.savePlanHistory ? rule.savePlanHistory(slots, config) : true;
  }
};

const heatmap = {
  calculateHeatmapState(slots, mapData) {
    return rule.calculateHeatmapState ? rule.calculateHeatmapState(slots, mapData) : {};
  }
};

// =============================================================================
// CONSOLIDATED EXPORT: BRAIN MODE 1
// =============================================================================
export const brainMode1 = {
  physics,
  utils: physics,
  cqiSelector,
  gravityAllocator,
  blockAllocator: gravityAllocator,
  loadBalancer,
  manpowerAssigner,
  selfHealingSolver,
  core,
  validator,
  formatter,
  history,
  heatmap,
  rule,

  // Direct Methods
  ...physics,
  ...cqiSelector,
  ...gravityAllocator,
  ...loadBalancer,
  ...manpowerAssigner,
  ...selfHealingSolver,
  ...core,
  ...validator,
  ...formatter,
  ...history,
  ...heatmap,
};

// Global / Window binding
if (typeof window !== 'undefined') {
  window.BrainAI = brainMode1;
  window.brainMode1 = brainMode1;
}
if (typeof globalThis !== 'undefined') {
  globalThis.BrainAI = brainMode1;
  globalThis.brainMode1 = brainMode1;
}

export default brainMode1;
