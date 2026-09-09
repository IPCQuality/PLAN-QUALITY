// =============================================================================
// RULE CENTER: Aturan Center Bersama untuk BrainMode1 dan BrainMode2
// Mengonsolidasikan seluruh aturan denah, workstation, cluster, validasi,
// alokasi manpower, scoring (skala 1-10), dan ekspor excel ke dalam 1 file master
// =============================================================================

export const rule = {
  // ---------------------------------------------------------------------------
  // 1. Normalisasi & Konfigurasi Dasar
  // ---------------------------------------------------------------------------
  normalizeName(name) {
    if (!name) return "";
    return String(name)
      .trim()
      .toUpperCase()
      .replace(/[\s\-_]+/g, "");
  },

  CQI_PRIORITY_MAP: {
    // Line A
    "cqi 1": ["1A", "0A"],
    "cqi 2": ["2A", "1A"],
    "cqi 3": ["2A", "3A"],
    "cqi 4": ["3A", "4A"],
    "cqi 5": ["4A", "5A"],
    "cqi 6": ["5A", "6A"],
    "cqi 7": ["6A", "7A"],
    "cqi 8": ["7A", "8A"],
    "cqi 9": ["8A", "9A"],
    "cqi 10": ["9A", "10A"],

    // Line B
    "cqi 11": ["1B", "0B", "2B"],
    "cqi 13": ["2B", "3B", "1B"],
    "cqi 14": ["6B", "5B", "4B"],
    "cqi 15": ["5B", "7B", "8B", "9B"],
    "cqi 16": ["8B", "9B", "7B"],
    "cqi 17": ["10B", "11B", "9B"],
    "cqi 19": ["OT"],
    "cqi 21": ["0B", "4B"],
    "cqi 22": ["6B", "5B", "4B"],
    "cqi 23": ["6B", "7B", "5B"],
    "cqi 24": ["WW", "4C", "5C", "1C", "2C"],
    "cqi 25": ["9B", "10B", "11B", "8B"],

    // Line C
    "cqi 12": ["10B", "11B", "9B"],
    "cqi 18": ["1C", "2C", "3C", "4C"],
    "cqi 20": ["6C", "7C", "8C", "9C", "10C", "5C"],
  },

  CQI_CLUSTER_PRIORITY_MAP: {
    "cqi 1": ["Sosoft", "12Ljumbo"],
    "cqi 2": ["Sosoft", "SKLsct"],
    "cqi 3": ["SKLsct", "Sosoft"],
    "cqi 4": ["SKLsct"],
    "cqi 5": ["SKLsct"],
    "cqi 6": ["SKLsct"],
    "cqi 7": ["SKLsct"],
    "cqi 8": ["SKLsct"],
    "cqi 9": ["SKLsct"],
    "cqi 10": ["SKLsct", "12Ljumbo", "Pouch"],

    "cqi 11": ["Sosoft"],
    "cqi 12": ["Pouch", "Botol"],
    "cqi 13": ["Sosoft"],
    "cqi 14": ["Botol", "Pouch"],
    "cqi 15": ["12Ljumbo", "SKLsct", "Pouch"],
    "cqi 16": ["Pouch", "12Ljumbo"],
    "cqi 17": ["Botol", "Pouch"],
    "cqi 18": ["Pouch"],
    "cqi 19": ["OT"],
    "cqi 20": ["Botol", "Pouch"],
    "cqi 21": ["Pouch", "Botol"],
    "cqi 22": ["12Ljumbo"],
    "cqi 23": ["12Ljumbo"],
    "cqi 24": ["WW", "Pouch"],
    "cqi 25": ["12Ljumbo", "Pouch", "SKLsct"],
  },

  isFarWorkstationForCqi(wsKey, cqiNum) {
    return false;
  },

  getCqiPrimaryLine(cqi) {
    if (!cqi) return "OTHER";
    const cqiNum = this.getCqiNumber(cqi);
    if (cqiNum === "19") return "OT";
    if (cqiNum === "24") return "WW";
    const prioKey = "cqi " + cqiNum;
    const wsList = this.CQI_PRIORITY_MAP[prioKey] || [];
    if (wsList.length > 0) {
      const firstWs = String(wsList[0]).toUpperCase();
      if (firstWs.endsWith("A")) return "LINE A";
      if (firstWs.endsWith("B")) return "LINE B";
      if (firstWs.endsWith("C")) return "LINE C";
    }
    const num = parseInt(cqiNum, 10);
    if (num >= 1 && num <= 10) return "LINE A";
    if (
      (num >= 11 && num <= 16) ||
      num === 21 ||
      num === 22 ||
      num === 23 ||
      num === 25 ||
      num === 26
    )
      return "LINE B";
    if (num === 17 || num === 18 || num === 20) return "LINE C";
    return "OTHER";
  },

  getMachineLine(m, labels = []) {
    if (!m) return "OTHER";
    if (this.isOtMachine(m)) return "OT";
    if (this.isWwMachine(m)) return "WW";
    const ws = this.getWorkstationKey(m, labels).toUpperCase();
    if (ws.endsWith("A") || ws.includes("A")) return "LINE A";
    if (ws.endsWith("B") || ws.includes("B")) return "LINE B";
    if (ws.endsWith("C") || ws.includes("C")) return "LINE C";
    const line = String(m.line || "").toUpperCase();
    if (line.includes("LINE A") || line === "A") return "LINE A";
    if (line.includes("LINE B") || line === "B") return "LINE B";
    if (line.includes("LINE C") || line === "C") return "LINE C";
    if (line.includes("WW")) return "WW";
    if (line.includes("OT")) return "OT";
    return "OTHER";
  },

  getCqiNumber(cqi) {
    if (!cqi) return "";
    const str =
      typeof cqi === "object" ? cqi.name || cqi.id || "" : String(cqi);
    const match = str.match(/\d+/);
    return match ? match[0] : str.trim().toUpperCase();
  },

  getMachineClusterGroup(m) {
    if (!m) return "LAINNYA";
    if (this.isWwMachine(m)) return "WW";
    if (this.isOtMachine(m)) return "OT";

    const cluster = String(m.cluster || "")
      .toUpperCase()
      .trim();
    const ws = String(m.workstation || m.ws || "")
      .toUpperCase()
      .trim();
    const name = String(m.name || m.id || "")
      .toUpperCase()
      .trim();

    if (cluster.includes("SOSOFT")) return "SOSOFT";
    if (cluster.includes("SKLSCT") || cluster.includes("SKL")) return "SKLSCT";
    if (
      cluster.includes("12LJUMBO") ||
      cluster.includes("JUMBO") ||
      cluster.includes("12L")
    )
      return "12LJUMBO";
    if (cluster.includes("POUCH") || name.startsWith("APK")) return "POUCH";
    if (
      cluster.includes("BOTOL") ||
      name.startsWith("BTL") ||
      ws.includes("BTL")
    )
      return "BOTOL";

    return cluster || "LAINNYA";
  },

  getAllowedClustersForCqi(cqi) {
    if (!cqi) return [];
    const cqiNum = this.getCqiNumber(cqi);
    const key = "cqi " + cqiNum;
    const rawList = this.CQI_CLUSTER_PRIORITY_MAP[key] || [];
    const allowed = new Set();

    rawList.forEach((item) => {
      const norm = String(item).toUpperCase().trim();
      if (norm.includes("SOSOFT")) allowed.add("SOSOFT");
      else if (norm.includes("SKLSCT") || norm.includes("SKL"))
        allowed.add("SKLSCT");
      else if (
        norm.includes("12LJUMBO") ||
        norm.includes("JUMBO") ||
        norm.includes("12L")
      )
        allowed.add("12LJUMBO");
      else if (norm.includes("POUCH")) allowed.add("POUCH");
      else if (norm.includes("BOTOL")) allowed.add("BOTOL");
      else if (norm.includes("WW")) allowed.add("WW");
      else if (norm.includes("OT")) allowed.add("OT");
    });

    return Array.from(allowed);
  },

  isClusterMixingAllowed(clusterA, clusterB, cqiNum = null, mA = null, mB = null) {
    const cA = String(clusterA || "").toUpperCase();
    const cB = String(clusterB || "").toUpperCase();
    if (cA === cB) return true;

    if (cA === "OT" || cB === "OT") return false;

    if (cA === "WW" || cB === "WW") {
      const other = cA === "WW" ? cB : cA;
      const otherM = cA === "WW" ? mB : mA;
      if (cqiNum === "24") {
        if (other === "POUCH") return true;
        if (otherM && (this.isPouchMachine(otherM) || this.isMachineLineC(otherM))) return true;
      }
      return false;
    }

    if (
      (cA === "POUCH" && cB === "BOTOL") ||
      (cA === "BOTOL" && cB === "POUCH")
    ) {
      return true;
    }

    if (
      (cA === "12LJUMBO" && cB === "SKLSCT") ||
      (cA === "SKLSCT" && cB === "12LJUMBO")
    ) {
      return true;
    }

    if (
      (cA === "12LJUMBO" && cB === "POUCH") ||
      (cA === "POUCH" && cB === "12LJUMBO")
    ) {
      if (
        cqiNum === "10" ||
        cqiNum === "15" ||
        cqiNum === "16" ||
        cqiNum === "25"
      ) {
        return true;
      }
      return false;
    }

    return false;
  },

  isPouchMachine(m) {
    if (!m) return false;
    const name = String(m.name || m.id || "").toUpperCase();
    const cluster = String(m.cluster || "").toUpperCase();
    return name.startsWith("APK") || cluster.includes("POUCH");
  },

  isMachineLineC(m, labels = []) {
    if (!m) return false;
    const line = String(m.line || "").toUpperCase();
    if (line.includes("LINE C") || line === "C") return true;
    const ws = this.getWorkstationKey(m, labels).toUpperCase();
    return ws.endsWith("C") || ws.includes("LINE C");
  },

  isWwMachine(m) {
    if (!m) return false;
    const line = String(m.line || "").toUpperCase();
    const ws = String(m.workstation || m.ws || "").toUpperCase();
    const name = String(m.name || m.id || "").toUpperCase();
    return line.includes("WW") || ws.includes("WW") || name.startsWith("WW");
  },

  isOtMachine(m) {
    if (!m) return false;
    const line = String(m.line || "").toUpperCase();
    const ws = String(m.workstation || m.ws || "").toUpperCase();
    const name = String(m.name || m.id || "").toUpperCase();
    return line.includes("OT") || ws.includes("OT") || name.startsWith("OT");
  },

  getWorkstationKey(m, labels = []) {
    if (!m) return "LAINNYA";
    if (this.isWwMachine(m)) return "WW";
    if (this.isOtMachine(m)) return "OT";

    if (m.workstation) return String(m.workstation).toUpperCase().trim();
    if (m.ws) return String(m.ws).toUpperCase().trim();

    const mName = String(m.name || m.id || "").toUpperCase().trim();
    const nameMatch = mName.match(/^([0-9]+[ABC])/);
    if (nameMatch) return nameMatch[1];

    if (m.col !== undefined && m.row !== undefined) {
      const col = parseInt(m.col, 10);
      const row = parseInt(m.row, 10);
      if (labels && labels.length > 0) {
        let bestLabel = null;
        let minDist = 999;
        labels.forEach((l) => {
          const lCol = parseInt(l.col, 10);
          const lRow = parseInt(l.row, 10);
          const dist = Math.abs(col - lCol) + Math.abs(row - lRow);
          if (dist < minDist) {
            minDist = dist;
            bestLabel = l.text;
          }
        });
        if (bestLabel && minDist <= 6) {
          const cleanLabel = String(bestLabel).toUpperCase().trim();
          const match = cleanLabel.match(/([0-9]+[ABC])/);
          if (match) return match[1];
          return cleanLabel;
        }
      }
    }

    return "LAINNYA";
  },

  getWorkstationIndex(wsKey) {
    if (!wsKey) return -1;
    const match = String(wsKey).match(/\d+/);
    return match ? parseInt(match[0], 10) : -1;
  },

  getWorkstationDistance(wsKey1, wsKey2) {
    if (!wsKey1 || !wsKey2) return 99;
    const w1 = String(wsKey1).trim().toUpperCase();
    const w2 = String(wsKey2).trim().toUpperCase();
    if (w1 === w2) return 0;

    const line1 = w1.slice(-1);
    const line2 = w2.slice(-1);
    const idx1 = this.getWorkstationIndex(w1);
    const idx2 = this.getWorkstationIndex(w2);

    if (line1 === line2 && idx1 !== -1 && idx2 !== -1) {
      return Math.abs(idx1 - idx2);
    }

    if ((w1 === "10B" || w1 === "11B") && (w2 === "1C" || w2 === "2C")) return 1;
    if ((w2 === "10B" || w2 === "11B") && (w1 === "1C" || w1 === "2C")) return 1;
    if ((w1 === "8B" || w1 === "9B") && (w2 === "1C" || w2 === "2C")) return 2;
    if ((w2 === "8B" || w2 === "9B") && (w1 === "1C" || w1 === "2C")) return 2;

    return 99;
  },

  isNeighborWs(wsKey1, wsKey2) {
    const dist = this.getWorkstationDistance(wsKey1, wsKey2);
    return dist <= 2;
  },

  getClusterCapacityRule(machinesOrSlot) {
    let machines = [];
    if (Array.isArray(machinesOrSlot)) {
      machines = machinesOrSlot;
    } else if (machinesOrSlot && Array.isArray(machinesOrSlot.machines)) {
      machines = machinesOrSlot.machines;
    }

    let hasSosoft = false;
    let has12L = false;
    let hasSkl = false;
    let hasPouch = false;
    let hasBotol = false;
    let hasWw = false;
    let hasOt = false;

    machines.forEach((m) => {
      const g = this.getMachineClusterGroup(m);
      if (g === "SOSOFT") hasSosoft = true;
      else if (g === "12LJUMBO") has12L = true;
      else if (g === "SKLSCT") hasSkl = true;
      else if (g === "POUCH") hasPouch = true;
      else if (g === "BOTOL") hasBotol = true;
      else if (g === "WW") hasWw = true;
      else if (g === "OT") hasOt = true;
    });

    if (hasOt) {
      return {
        name: "OT",
        maxCoreOnly: 2,
        max1Nc: 2,
        max2Nc: 2,
        getNeededNc: () => 0,
      };
    }

    if (hasWw) {
      return {
        name: "WW",
        maxCoreOnly: 4,
        max1Nc: 7,
        max2Nc: 8,
        getNeededNc: (c) => (c <= 4 ? 0 : c <= 7 ? 1 : 2),
      };
    }

    if (has12L && hasPouch) {
      return {
        name: "12L Jumbo + Pouch",
        maxCoreOnly: 3,
        max1Nc: 7,
        max2Nc: 8,
        getNeededNc: (c) => (c <= 3 ? 0 : c <= 7 ? 1 : 2),
      };
    }

    if (has12L) {
      return {
        name: "12L Jumbo",
        maxCoreOnly: 3,
        max1Nc: 7,
        max2Nc: 8,
        getNeededNc: (c) => (c <= 3 ? 0 : c <= 7 ? 1 : 2),
      };
    }

    if (hasSosoft) {
      return {
        name: "Sosoft",
        maxCoreOnly: 4,
        max1Nc: 7,
        max2Nc: 8,
        getNeededNc: (c) => (c <= 4 ? 0 : c <= 7 ? 1 : 2),
      };
    }

    if (hasSkl) {
      return {
        name: "SKL Sachet",
        maxCoreOnly: 5,
        max1Nc: 8,
        max2Nc: 10,
        getNeededNc: (c) => (c <= 5 ? 0 : c <= 8 ? 1 : 2),
      };
    }

    if (hasPouch && hasBotol) {
      return {
        name: "Pouch + Botol",
        maxCoreOnly: 3,
        max1Nc: 7,
        max2Nc: 8,
        getNeededNc: (c) => (c <= 3 ? 0 : c <= 7 ? 1 : 2),
      };
    }

    if (hasPouch) {
      return {
        name: "Pouch",
        maxCoreOnly: 4,
        max1Nc: 7,
        max2Nc: 8,
        getNeededNc: (c) => (c <= 4 ? 0 : c <= 7 ? 1 : 2),
      };
    }

    if (hasBotol) {
      return {
        name: "Botol",
        maxCoreOnly: 4,
        max1Nc: 7,
        max2Nc: 8,
        getNeededNc: (c) => (c <= 4 ? 0 : c <= 7 ? 1 : 2),
      };
    }

    return {
      name: "Standard",
      maxCoreOnly: 4,
      max1Nc: 7,
      max2Nc: 8,
      getNeededNc: (c) => (c <= 4 ? 0 : c <= 7 ? 1 : 2),
    };
  },

  canAddMachineToSlotCluster(m, slot) {
    if (!slot) return false;
    const machines = slot.machines || [];
    if (machines.length === 0) {
      const allowed = this.getAllowedClustersForCqi(slot.cqi);
      if (!allowed || allowed.length === 0) return true;
      const mCluster = this.getMachineClusterGroup(m);
      return allowed.includes(mCluster);
    }

    const cqiNum = String(slot.cqiNum || this.getCqiNumber(slot.cqi));
    const mCluster = this.getMachineClusterGroup(m);

    for (const sm of machines) {
      const smCluster = this.getMachineClusterGroup(sm);
      if (!this.isClusterMixingAllowed(mCluster, smCluster, cqiNum, m, sm)) {
        return false;
      }
    }

    const capRule = this.getClusterCapacityRule([...machines, m]);
    if (machines.length >= (capRule.max2Nc || 10)) {
      return false;
    }

    return true;
  },

  canAddMachineToSlot(m, slot, runningMachines = [], allFactoryMachines = [], labels = []) {
    if (!slot || !m) return false;
    if (!this.canAddMachineToSlotCluster(m, slot)) return false;

    const cqiNum = String(slot.cqiNum || this.getCqiNumber(slot.cqi));
    const wsKey = this.getWorkstationKey(m, labels);

    // Special CQI 19 (strictly OT only, max 2)
    if (cqiNum === "19") {
      if (!this.isOtMachine(m) || (slot.machines || []).length >= 2) return false;
    }
    if (cqiNum !== "19" && this.isOtMachine(m)) {
      return false;
    }

    // Special CQI 24 (WW + Line C APK pouch only, max 4 Line C, max 2 WS)
    if (cqiNum === "24") {
      if (this.isWwMachine(m)) return true;
      if (!this.isMachineLineC(m, labels) || !this.isPouchMachine(m)) return false;
      const existingLineC = (slot.machines || []).filter((sm) => !this.isWwMachine(sm));
      if (existingLineC.length >= 4) return false;
      const wsSet = new Set(existingLineC.map((sm) => this.getWorkstationKey(sm, labels).toUpperCase()));
      wsSet.add(wsKey.toUpperCase());
      if (wsSet.size > 2) return false;
    }
    if (cqiNum !== "24" && this.isWwMachine(m)) {
      return false;
    }

    // Special CQI 15 (if Line C machine, only 1C and 2C allowed)
    if (cqiNum === "15" && this.isMachineLineC(m, labels)) {
      const wsUpper = wsKey.toUpperCase();
      if (wsUpper !== "1C" && wsUpper !== "2C") return false;
    }

    // Check far workstation
    if (typeof this.isFarWorkstationForCqi === "function" && this.isFarWorkstationForCqi(wsKey, cqiNum)) {
      return false;
    }

    // Cross-line rules
    if (!this.isCrossLineAllowed(m, slot.cqi, runningMachines, allFactoryMachines, labels)) {
      return false;
    }

    return true;
  },

  getDynamicSlotLimit(slot, totalNcPool = 0, slots = []) {
    if (!slot) return 10;
    const cqiNum = String(slot.cqiNum || this.getCqiNumber(slot.cqi));
    if (cqiNum === "19") return 2;
    if (cqiNum === "24") return 8;

    const cap = this.getClusterCapacityRule(slot);
    const maxNc = cap.max2Nc || 10;
    const maxCore = cap.maxCoreOnly || 4;

    if (!slots || slots.length === 0) return Math.min(slot.maxAllowedMachines || 10, maxNc);

    const activeSlotsCount = slots.filter((s) => (s.machines || []).length > 0).length || slots.length;
    const ncPerSlot = totalNcPool / Math.max(1, activeSlotsCount);

    let calculatedLimit = maxCore;
    if (ncPerSlot >= 1.5) {
      calculatedLimit = maxNc;
    } else if (ncPerSlot >= 0.5) {
      calculatedLimit = cap.max1Nc || Math.round((maxCore + maxNc) / 2);
    }

    return Math.min(slot.maxAllowedMachines || 10, Math.min(10, calculatedLimit));
  },

  isCrossLineAllowed(m, cqi, runningMachines = [], allMachines = [], labels = []) {
    const mLine = this.getMachineLine(m, labels);
    const cqiLine = this.getCqiPrimaryLine(cqi);

    if (mLine === cqiLine) return true;
    if (mLine === "OTHER" || cqiLine === "OTHER") return true;

    if (mLine === "OT") return cqiLine === "OT";
    if (cqiLine === "OT") return mLine === "OT";

    if (cqiLine === "WW") {
      return mLine === "WW" || (mLine === "LINE C" && this.isPouchMachine(m));
    }

    if (mLine === "LINE C" && cqiLine === "LINE B") return true;
    if (mLine === "LINE B" && cqiLine === "LINE C") return true;

    if (
      (mLine === "LINE A" && cqiLine === "LINE B") ||
      (mLine === "LINE B" && cqiLine === "LINE A")
    ) {
      const mRow = m.row || (m.position ? m.position.row : 0);
      const isBackRowA = mLine === "LINE A" && mRow <= 4;
      const isBackRowB = mLine === "LINE B" && mRow >= 11;

      if (isBackRowA || isBackRowB) {
        const frontRowRunning = runningMachines.some((rm) => {
          if (rm.id === m.id || rm.name === m.name) return false;
          const rLine = this.getMachineLine(rm, labels);
          const rRow = rm.row || (rm.position ? rm.position.row : 0);
          if (mLine === "LINE A") return rLine === "LINE A" && rRow > 4;
          if (mLine === "LINE B") return rLine === "LINE B" && rRow < 11;
          return false;
        });

        if (frontRowRunning) return false;
      }
      return true;
    }

    return false;
  },

  getAisleWaypoints(m, cqi, labels = [], customObstacles = null) {
    const mRow = m.row || (m.position ? m.position.row : 0);
    const mCol = m.col || (m.position ? m.position.col : 0);
    const cRow = cqi.row || (cqi.position ? cqi.position.row : 0);
    const cCol = cqi.col || (cqi.position ? cqi.position.col : 0);

    if (mRow <= 0 || mCol <= 0 || cRow <= 0 || cCol <= 0) return [];
    const sKey = `${mRow},${mCol}`;
    const gKey = `${cRow},${cCol}`;
    if (sKey === gKey) return [{ row: mRow, col: mCol }];

    const mLine = this.getMachineLine(m, labels);
    const ws = this.getWorkstationKey(m, labels).toUpperCase();
    const cqiNum = String(this.getCqiNumber(cqi));

    const isLineA =
      mLine === "LINE A" ||
      ws.endsWith("A") ||
      (mRow <= 9 && mCol <= 30 && !ws.endsWith("B") && mLine !== "OT" && mLine !== "WW");
    const isLineB =
      mLine === "LINE B" ||
      ws.endsWith("B") ||
      (mRow >= 10 && mRow <= 17 && mCol <= 30);
    const isLineC =
      mLine === "LINE C" ||
      ws.endsWith("C") ||
      (mCol >= 31 && mRow >= 12);
    const isOt = mLine === "OT" || this.isOtMachine(m);
    const isWw = mLine === "WW" || this.isWwMachine(m);

    let aisleRow = 10;
    if (isLineA || isOt) {
      // Line A & OT: WAJIB melewati belakang (Row 2)
      aisleRow = 2;
    } else if (isLineB) {
      // Line B: WAJIB melewati depan (Row 10)
      aisleRow = 10;
    } else if (isLineC) {
      if (cqiNum === "24" || cqiNum === "15" || cqiNum === "16" || cqiNum === "12") {
        aisleRow = 10;
      } else {
        aisleRow = 12; // Depan Line C
      }
    } else if (isWw) {
      aisleRow = 10;
    } else {
      aisleRow = mRow <= 9 ? 2 : 10;
    }

    const waypoints = [
      { row: mRow, col: mCol },
      { row: aisleRow, col: mCol },
      { row: aisleRow, col: cCol },
      { row: cRow, col: cCol },
    ];

    // Filter duplicate consecutive waypoints
    const cleanPoints = [];
    waypoints.forEach((pt) => {
      if (cleanPoints.length === 0) {
        cleanPoints.push(pt);
      } else {
        const last = cleanPoints[cleanPoints.length - 1];
        if (last.row !== pt.row || last.col !== pt.col) {
          cleanPoints.push(pt);
        }
      }
    });

    return cleanPoints;
  },

  calculateDistance(m, cqi, labels = []) {
    const pts = this.getAisleWaypoints(m, cqi, labels);
    if (!pts || pts.length <= 1) {
      const mRow = m.row || (m.position ? m.position.row : 0);
      const mCol = m.col || (m.position ? m.position.col : 0);
      const cRow = cqi.row || (cqi.position ? cqi.position.row : 0);
      const cCol = cqi.col || (cqi.position ? cqi.position.col : 0);
      return Math.abs(mRow - cRow) + Math.abs(mCol - cCol);
    }

    let totalDist = 0;
    for (let i = 1; i < pts.length; i++) {
      totalDist +=
        Math.abs(pts[i].row - pts[i - 1].row) +
        Math.abs(pts[i].col - pts[i - 1].col);
    }
    return totalDist;
  },

  // ---------------------------------------------------------------------------
  // 2. SISTEM SKORING TERSTANDARISASI 1 - 10 (1 = Buruk, 10 = Ideal)
  // ---------------------------------------------------------------------------
  calculateSlotWsDistance(mWs, slot, engine = null, labels = []) {
    const r = engine || this;
    if (!mWs || !slot) return 99;
    const cqiNum = String(slot.cqiNum || r.getCqiNumber(slot.cqi) || "");
    const prioKey = "cqi " + cqiNum;
    const wsPrioList = (r.CQI_PRIORITY_MAP[prioKey] || []).map((w) =>
      String(w).toUpperCase(),
    );

    if (slot.machines && slot.machines.length > 0) {
      const slotWsKeys = slot.machines.map((sm) =>
        r.getWorkstationKey(sm, labels).toUpperCase(),
      );
      if (slotWsKeys.includes(mWs)) return 0;

      let minSlotDist = 99;
      slotWsKeys.forEach((sws) => {
        const d = r.getWorkstationDistance(mWs, sws);
        if (d < minSlotDist) minSlotDist = d;
      });
      if (minSlotDist <= 2) return minSlotDist;
    }

    const prioIdx = wsPrioList.indexOf(mWs);
    if (prioIdx === 0) return 0;
    if (prioIdx === 1) return 1;
    if (prioIdx > 1) return prioIdx;

    if (wsPrioList.length > 0) {
      const anchorWs = wsPrioList[0];
      const d = r.getWorkstationDistance(mWs, anchorWs);
      if (d < 99) return d;
    }

    return 99;
  },

  evaluateBlockAffinity(
    block,
    slot,
    engine = null,
    mapData = {},
    generalSlots = [],
    sortedWsBlocks = [],
    runningMachines = [],
  ) {
    const r = engine || this;
    const labels = mapData.labels || [];
    const blockWs = block.ws.toUpperCase();
    const cqiNum = String(slot.cqiNum || r.getCqiNumber(slot.cqi));
    const prioKey = "cqi " + cqiNum;
    const wsPrioList = (r.CQI_PRIORITY_MAP[prioKey] || []).map((w) =>
      String(w).toUpperCase(),
    );

    if (typeof r.isFarWorkstationForCqi === "function" && r.isFarWorkstationForCqi(blockWs, cqiNum)) return 1.0;

    let score = 5.0;

    const slotPrimaryLine = r.getCqiPrimaryLine(slot.cqi);
    const blockLine = block.line;

    if (slotPrimaryLine === "LINE B") {
      if (blockLine === "LINE B") score += 2.0;
      else if (blockLine === "LINE C") score += 1.5;
      else score -= 2.5;
    } else if (slotPrimaryLine === "LINE A") {
      if (blockLine === "LINE A") score += 2.0;
      else score -= 2.5;
    } else if (slotPrimaryLine === "LINE C") {
      if (blockLine === "LINE C") score += 2.2;
      else if (blockLine === "LINE B") score += 1.0;
      else score -= 3.0;
    }

    const wsDist = this.calculateSlotWsDistance(blockWs, slot, r, labels);
    if (wsDist === 0) score += 3.0;
    else if (wsDist === 1) score += 1.8;
    else if (wsDist === 2) score -= 0.5;
    else if (wsDist >= 3) score -= 1.5 + (wsDist - 3) * 0.4;

    const slotClusters = new Set(
      (slot.machines || []).map((m) => r.getMachineClusterGroup(m)),
    );
    const blockClusters = new Set(
      block.machines.map((m) => r.getMachineClusterGroup(m)),
    );

    let hasSameCluster = false;
    blockClusters.forEach((bc) => {
      if (slotClusters.has(bc)) hasSameCluster = true;
    });

    if (slot.machines && slot.machines.length > 0) {
      if (hasSameCluster) score += 1.0;
      else score -= 0.8;
    }

    const prioIdx = wsPrioList.indexOf(blockWs);
    if (prioIdx === 0) score += 2.0;
    else if (prioIdx === 1) score += 1.2;
    else if (prioIdx === 2) score += 0.6;
    else if (prioIdx > 2) score += 0.2;
    else score -= 0.5;

    if (block.machines.length > 0) {
      const avgDist =
        block.machines.reduce(
          (sum, m) => sum + r.calculateDistance(m, slot.cqi, labels),
          0,
        ) / block.machines.length;
      score -= Math.min(avgDist, 30) * 0.05;
    }

    const testMachines = [...(slot.machines || []), ...block.machines];
    const capacityRule = r.getClusterCapacityRule(testMachines);
    const count = testMachines.length;
    if (count <= capacityRule.maxCoreOnly) score += 0.8;
    else if (count <= capacityRule.max1Nc) score += 0.2;
    else if (count <= capacityRule.max2Nc) score -= 0.5;
    else score -= 2.0;

    return Math.max(1.0, Math.min(10.0, Math.round(score * 10) / 10));
  },

  getSlotProximityScore(m, slot, engine = null, labels = []) {
    const r = engine || this;
    const wsKey = r.getWorkstationKey(m, labels).toUpperCase();
    const cqiNum = String(slot.cqiNum || r.getCqiNumber(slot.cqi));
    const mLine = r.getMachineLine(m, labels);
    const slotPrimaryLine = r.getCqiPrimaryLine(slot.cqi);

    if (typeof r.isFarWorkstationForCqi === "function" && r.isFarWorkstationForCqi(wsKey, cqiNum)) return 1.0;

    let score = 5.0;

    const wsDist = this.calculateSlotWsDistance(wsKey, slot, r, labels);
    if (wsDist === 0) score += 3.0;
    else if (wsDist === 1) score += 1.8;
    else if (wsDist === 2) score -= 0.5;
    else if (wsDist >= 3) score -= 1.5 + (wsDist - 3) * 0.4;

    if (slotPrimaryLine === "LINE B") {
      if (mLine === "LINE B") score += 2.0;
      else if (mLine === "LINE C") score += 1.5;
      else score -= 2.5;
    } else if (slotPrimaryLine === "LINE A") {
      if (mLine === "LINE A") score += 2.0;
      else score -= 2.5;
    } else if (slotPrimaryLine === "LINE C") {
      if (mLine === "LINE C") score += 2.2;
      else if (mLine === "LINE B") score += 1.0;
      else score -= 3.0;
    }

    if (mLine === "LINE B" && slotPrimaryLine !== "LINE B") {
      if (slotPrimaryLine === "LINE C") score += 0.5;
      else score -= 2.0;
    } else if (mLine === "LINE A" && slotPrimaryLine !== "LINE A") {
      score -= 2.5;
    } else if (mLine === "LINE C" && slotPrimaryLine !== "LINE C") {
      if (cqiNum === "24") score += 1.8;
      else if (cqiNum === "15" && (wsKey === "1C" || wsKey === "2C")) score += 0.5;
      else if (slotPrimaryLine === "LINE B") score += 1.2;
      else score -= 3.0;
    }

    const prioKey = "cqi " + cqiNum;
    const wsPrioList = (r.CQI_PRIORITY_MAP[prioKey] || []).map((w) =>
      String(w).toUpperCase(),
    );
    const prioIdx = wsPrioList.indexOf(wsKey);
    if (prioIdx === 0) score += 2.0;
    else if (prioIdx === 1) score += 1.2;
    else if (prioIdx === 2) score += 0.6;
    else if (prioIdx > 2) score += 0.2;
    else score -= 0.5;

    const mCluster = r.getMachineClusterGroup(m);
    if (slot.machines && slot.machines.length > 0) {
      const existingClusters = new Set(
        slot.machines.map((sm) => r.getMachineClusterGroup(sm)),
      );
      if (existingClusters.has(mCluster)) score += 0.8;
    }

    const currentCount = (slot.machines || []).length;
    const clusterRule = r.getClusterCapacityRule([...(slot.machines || []), m]);
    if (currentCount < clusterRule.maxCoreOnly) score += 1.0;
    else score -= 0.8;

    const dist = r.calculateDistance(m, slot.cqi, labels);
    score -= Math.min(dist, 30) * 0.05;
    score -= currentCount * 0.1;

    if (cqiNum === "24" && r.isMachineLineC(m, labels)) {
      const nonWw = (slot.machines || []).filter((sm) => !r.isWwMachine(sm));
      const existingWs = new Set(
        nonWw.map((sm) => r.getWorkstationKey(sm, labels).toUpperCase()),
      );
      if (existingWs.has(wsKey)) score += 2.5;
      else if (existingWs.size === 0) score += 1.5;
      else if (existingWs.size === 1) score += 0.5;
      else score -= 4.0;
    }

    return Math.max(1.0, Math.min(10.0, Math.round(score * 10) / 10));
  },

  calculateSlotQualityScore(slot, engine = null, labels = []) {
    const r = engine || this;
    if (!slot || !slot.machines || slot.machines.length === 0) return 5.0;

    let totalScore = 0;
    slot.machines.forEach((m) => {
      totalScore += this.getSlotProximityScore(m, slot, r, labels);
    });

    const avg = totalScore / slot.machines.length;
    return Number(Math.max(1, Math.min(10, avg)).toFixed(1));
  },

  calculateGlobalFitness(slots, engine = null, labels = []) {
    const r = engine || this;
    if (!Array.isArray(slots) || slots.length === 0) return 1.0;

    let totalScore = 0;
    let totalMachines = 0;

    slots.forEach((s) => {
      if (!s.machines || s.machines.length === 0) return;
      s.machines.forEach((m) => {
        totalScore += this.getSlotProximityScore(m, s, r, labels);
        totalMachines++;
      });
    });

    if (totalMachines === 0) return 5.0;
    const avg = totalScore / totalMachines;
    return Number(Math.max(1, Math.min(10, avg)).toFixed(2));
  },

  // ---------------------------------------------------------------------------
  // 3. ALOKASI MANPOWER (Core, Non-Core, Longshift)
  // ---------------------------------------------------------------------------
  getSlotDemand(slot, engine = null) {
    const r = engine || this;
    const count = slot.machines ? slot.machines.length : 0;
    const cqiNum = String(slot.cqiNum || r.getCqiNumber(slot.cqi));

    if (cqiNum === "24") {
      const hasApk =
        slot.machines && slot.machines.some((m) => !r.isWwMachine(m));
      if (hasApk) {
        return count > 6 ? 2 : 1;
      }
      return 0;
    }

    const clusterRule = r.getClusterCapacityRule(slot);
    if (count <= clusterRule.maxCoreOnly) return 0;
    return Math.min(clusterRule.getNeededNc(count), 2);
  },

  assignCorePersonnel(activeSlots, coreList = [], engine = null, config = {}) {
    const r = engine || this;
    if (!Array.isArray(activeSlots) || activeSlots.length === 0) return;

    activeSlots.sort((a, b) => {
      const numA = parseInt(a.cqiNum || r.getCqiNumber(a.cqi), 10) || 999;
      const numB = parseInt(b.cqiNum || r.getCqiNumber(b.cqi), 10) || 999;
      return numA - numB;
    });

    activeSlots.forEach((slot) => {
      slot.core = 0;
      slot.coreNames = [];
    });

    const availableCores = [...coreList];

    const pickCoreByQuery = (predicate) => {
      const idx = availableCores.findIndex(predicate);
      if (idx !== -1) {
        return availableCores.splice(idx, 1)[0];
      }
      return null;
    };

    // 1. Prioritas Khusus CQI 19 (OT): C14 (Farhan) -> C7 (Dini)
    const slot19Active = activeSlots.find((s) => String(s.cqiNum) === "19");
    if (slot19Active && slot19Active.core === 0) {
      let chosenCore = pickCoreByQuery((c) => {
        const id = String(c.id || "").toUpperCase();
        const name = r.normalizeName(c.name || "");
        return id === "C14" || name === "FARHAN";
      });

      if (!chosenCore) {
        chosenCore = pickCoreByQuery((c) => {
          const id = String(c.id || "").toUpperCase();
          const name = r.normalizeName(c.name || "");
          return id === "C7" || name === "DINI";
        });
      }

      if (!chosenCore) {
        chosenCore = pickCoreByQuery((c) => {
          const p = String(c.cqi_priority || "").trim();
          return p === "19" || r.getCqiNumber(p) === "19";
        });
      }

      if (chosenCore) {
        slot19Active.core = 1;
        slot19Active.coreNames = [chosenCore.name];
      }
    }

    // 2. Prioritas Khusus CQI 24 (WW): C9 (Jiddan) -> C8 (Mia)
    const slot24Active = activeSlots.find((s) => String(s.cqiNum) === "24");
    if (slot24Active && slot24Active.core === 0) {
      let chosenCore = pickCoreByQuery((c) => {
        const id = String(c.id || "").toUpperCase();
        const name = r.normalizeName(c.name || "");
        return id === "C9" || name === "JIDDAN";
      });

      if (!chosenCore) {
        chosenCore = pickCoreByQuery((c) => {
          const id = String(c.id || "").toUpperCase();
          const name = r.normalizeName(c.name || "");
          return id === "C8" || name === "MIA";
        });
      }

      if (!chosenCore) {
        chosenCore = pickCoreByQuery((c) => {
          const p = String(c.cqi_priority || "").trim();
          return p === "24" || r.getCqiNumber(p) === "24";
        });
      }

      if (chosenCore) {
        slot24Active.core = 1;
        slot24Active.coreNames = [chosenCore.name];
      }
    }

    // 3. Pasangkan Core berdasarkan cqi_priority
    activeSlots.forEach((slot) => {
      if (slot.core > 0) return;
      const matchedCore = pickCoreByQuery((c) => {
        if (!c || !c.cqi_priority) return false;
        const prioNum = String(c.cqi_priority).trim();
        return (
          prioNum === slot.cqiNum ||
          r.getCqiNumber(c.cqi_priority) === slot.cqiNum
        );
      });

      if (matchedCore) {
        slot.core = 1;
        slot.coreNames = [matchedCore.name];
      }
    });

    // 4. Pasangkan sisa Core secara sekuensial
    activeSlots.forEach((slot) => {
      if (slot.core === 0 && availableCores.length > 0) {
        const nextCore = availableCores.shift();
        slot.core = 1;
        slot.coreNames = [nextCore.name];
      }
    });

    // 5. Jika jumlah slot aktif melebihi Core (misal 15 slot vs 14 Core), berdayakan Non-Core sebagai Slot Lead
    if (config && (config.nonCoreData || config.nonCoreNames)) {
      const extractNames = (list) =>
        Array.isArray(list)
          ? list
              .map((item) => (typeof item === "object" ? item.name || "" : String(item || "")))
              .filter((n) => n.trim() !== "")
          : [];
      const ncList = extractNames(config.nonCoreData).concat(
        config.nonCoreData ? [] : extractNames(config.nonCoreNames),
      );
      activeSlots.forEach((slot) => {
        if (slot.core === 0 && ncList.length > 0) {
          const ncLead = ncList.shift();
          slot.core = 1;
          slot.coreNames = [ncLead + " (NC Lead)"];
          if (Array.isArray(config.nonCoreData)) {
            config.nonCoreData = config.nonCoreData.filter(
              (x) => (typeof x === "object" ? x.name : x) !== ncLead,
            );
          }
          if (Array.isArray(config.nonCoreNames)) {
            config.nonCoreNames = config.nonCoreNames.filter((x) => x !== ncLead);
          }
        }
      });
    }
  },

  assignNonCoreAndLongshift(activeSlots, config = {}, engine = null) {
    const r = engine || this;
    if (!Array.isArray(activeSlots) || activeSlots.length === 0) {
      return { remainingNonCore: [], remainingLs: parseInt(config.longshift || 0, 10) };
    }

    activeSlots.sort((a, b) => {
      const numA = parseInt(a.cqiNum || r.getCqiNumber(a.cqi), 10) || 999;
      const numB = parseInt(b.cqiNum || r.getCqiNumber(b.cqi), 10) || 999;
      return numA - numB;
    });

    const lsCount = parseInt(config.longshift || 0, 10);

    const extractNames = (list) =>
      Array.isArray(list)
        ? list
            .map((item) => (typeof item === "object" ? item.name || "" : String(item || "")))
            .filter((n) => n.trim() !== "")
        : [];

    const nonCorePool = extractNames(config.nonCoreData).concat(
      config.nonCoreData ? [] : extractNames(config.nonCoreNames),
    );
    const lsPool = Array.from({ length: lsCount }, () => "(LS)");

    activeSlots.forEach((s) => {
      s.nonCore = [];
      s.longshift = [];
    });

    // 1. Kasus CQI 24 (WW) dengan mesin tambahan APK Line C:
    const slot24 = activeSlots.find((s) => String(s.cqiNum) === "24");
    if (
      slot24 &&
      slot24.machines &&
      slot24.machines.some((m) => !r.isWwMachine(m))
    ) {
      if (nonCorePool.length > 0) {
        slot24.nonCore.push(nonCorePool.shift());
      } else if (lsPool.length > 0) {
        slot24.longshift.push(lsPool.shift());
      }
    }

    // 2. Tahap Prioritas 1: Berikan 1 asisten pertama ke semua slot yang bebannya melebihi kapasitas Core-Only
    activeSlots.forEach((slot) => {
      const cap = r.getClusterCapacityRule(slot);
      const curAssist = slot.nonCore.length + slot.longshift.length;
      if (slot.machines.length > cap.maxCoreOnly && curAssist === 0) {
        if (nonCorePool.length > 0) {
          slot.nonCore.push(nonCorePool.shift());
        } else if (lsPool.length > 0) {
          slot.longshift.push(lsPool.shift());
        }
      }
    });

    // 3. Tahap Prioritas 2: Berikan asisten kedua ke slot yang bebannya masih melebihi 1 Asisten
    activeSlots.forEach((slot) => {
      const cap = r.getClusterCapacityRule(slot);
      const curAssist = slot.nonCore.length + slot.longshift.length;
      if (slot.machines.length > cap.max1Nc && curAssist < 2) {
        if (nonCorePool.length > 0) {
          slot.nonCore.push(nonCorePool.shift());
        } else if (lsPool.length > 0) {
          slot.longshift.push(lsPool.shift());
        }
      }
    });

    // 4. Tahap Prioritas 3: Alokasikan sisa asisten (NC & LS) se-efisien mungkin ke slot dengan beban mesin terbesar
    const sortedByLoad = [...activeSlots].sort(
      (a, b) => (b.machines ? b.machines.length : 0) - (a.machines ? a.machines.length : 0),
    );
    sortedByLoad.forEach((slot) => {
      const curAssist = slot.nonCore.length + slot.longshift.length;
      if (curAssist < 2) {
        if (nonCorePool.length > 0) {
          slot.nonCore.push(nonCorePool.shift());
        } else if (lsPool.length > 0) {
          slot.longshift.push(lsPool.shift());
        }
      }
    });

    return { remainingNonCore: nonCorePool, remainingLs: lsPool.length };
  },

  // ---------------------------------------------------------------------------
  // 4. VALIDASI & FORMATTING OUTPUT
  // ---------------------------------------------------------------------------
  formatMachineList(slotMachines, allRunningMachines = null, labels = [], engine = null) {
    const r = engine || this;
    if (!Array.isArray(slotMachines) || slotMachines.length === 0) return "-";

    const allRunning =
      Array.isArray(allRunningMachines) && allRunningMachines.length > 0
        ? allRunningMachines
        : slotMachines;

    const totalRunningPerWs = {};
    allRunning.forEach((m) => {
      const ws = r.getWorkstationKey(m, labels);
      if (ws && ws !== "LAINNYA") {
        totalRunningPerWs[ws] = (totalRunningPerWs[ws] || 0) + 1;
      }
    });

    const slotWsGroups = {};
    slotMachines.forEach((m) => {
      const ws = r.getWorkstationKey(m, labels);
      if (!slotWsGroups[ws]) slotWsGroups[ws] = [];
      slotWsGroups[ws].push(m);
    });

    const resultParts = [];
    const processedWs = new Set();

    slotMachines.forEach((m) => {
      const ws = r.getWorkstationKey(m, labels);
      if (processedWs.has(m.id || m.name)) return;

      const group = slotWsGroups[ws] || [];
      const totalInShift = totalRunningPerWs[ws] || 0;

      if (
        ws &&
        ws !== "LAINNYA" &&
        group.length >= 2 &&
        group.length === totalInShift
      ) {
        if (!resultParts.includes(`${ws} (${group.length})`)) {
          resultParts.push(`${ws} (${group.length})`);
          group.forEach((gm) => processedWs.add(gm.id || gm.name));
        }
      } else {
        resultParts.push(m.name || m.id);
        processedWs.add(m.id || m.name);
      }
    });

    return resultParts.join(", ");
  },

  validate(slots, machines = [], engine = null) {
    const r = engine || this;
    const violations = [];
    const info = [];

    if (!Array.isArray(slots) || slots.length === 0) {
      violations.push("Tidak ada slot perencanaan yang tergenerasi.");
      return { valid: false, violations, info };
    }

    const maxNcPerCqi = 2;
    info.push(
      `INFO: Beroperasi pada mode standar pabrik (Maks ${maxNcPerCqi} Non-Core/LS per CQI, kapasitas hingga 10 mesin).`,
    );

    // 1. Verifikasi kelengkapan alokasi mesin
    const assignedMachineIds = new Set();
    slots.forEach((s) =>
      (s.machines || []).forEach((m) => assignedMachineIds.add(m.id || m.name)),
    );

    const unassigned = machines.filter(
      (m) => !assignedMachineIds.has(m.id || m.name),
    );
    if (unassigned.length > 0) {
      violations.push(
        `${unassigned.length} Mesin Running belum teralokasi: ${this.formatMachineList(unassigned, machines, [], r)}.`,
      );
    } else {
      info.push(
        `SUCCESS: 100% Mesin Running (${assignedMachineIds.size} Mesin) berhasil tercover.`,
      );
    }

    // 2. Verifikasi aturan cluster mixing di setiap CQI
    slots.forEach((s) => {
      const cqiNum = r.getCqiNumber(s.cqi);
      if (s.machines && s.machines.length > 1) {
        for (let i = 0; i < s.machines.length; i++) {
          for (let j = i + 1; j < s.machines.length; j++) {
            const mA = s.machines[i];
            const mB = s.machines[j];
            const clusterA = r.getMachineClusterGroup(mA);
            const clusterB = r.getMachineClusterGroup(mB);
            if (
              !r.isClusterMixingAllowed(clusterA, clusterB, cqiNum, mA, mB)
            ) {
              violations.push(
                `CQI ${cqiNum} melanggar aturan mixing cluster: mencampur [${clusterA} - ${mA.name || mA.id}] dengan [${clusterB} - ${mB.name || mB.id}].`,
              );
            }
          }
        }
      }
    });

    // 3. Verifikasi rasio Manpower vs Beban Mesin
    slots.forEach((s) => {
      const cqiNum = r.getCqiNumber(s.cqi);
      const mCount = s.machines ? s.machines.length : 0;
      const totalNc = (s.nonCore ? s.nonCore.length : 0) + (s.longshift ? s.longshift.length : 0);
      const capacityRule = r.getClusterCapacityRule(s);

      if (totalNc === 0 && mCount > capacityRule.maxCoreOnly) {
        violations.push(
          `CQI ${cqiNum} (Cluster: ${capacityRule.name}) memuat ${mCount} mesin dengan 0 Non-Core (Maksimal ${capacityRule.maxCoreOnly} mesin untuk 1 Core).`,
        );
      } else if (totalNc === 1 && mCount > capacityRule.max1Nc) {
        violations.push(
          `CQI ${cqiNum} (Cluster: ${capacityRule.name}) memuat ${mCount} mesin dengan 1 Non-Core (Maksimal ${capacityRule.max1Nc} mesin untuk 1 Core + 1 Non-Core).`,
        );
      } else if (totalNc >= 2 && mCount > capacityRule.max2Nc) {
        violations.push(
          `CQI ${cqiNum} (Cluster: ${capacityRule.name}) memuat ${mCount} mesin (Maksimal ${capacityRule.max2Nc} mesin untuk 1 Core + 2 Non-Core).`,
        );
      }
      if (totalNc > maxNcPerCqi) {
        violations.push(
          `CQI ${cqiNum} melebihi batas maksimal ${maxNcPerCqi} Non-Core/LS.`,
        );
      }
    });

    // 4. Verifikasi aturan khusus WW & CQI 24
    const slot24 = slots.find((s) => r.getCqiNumber(s.cqi) === "24");
    if (slot24) {
      const nonWwIn24 = (slot24.machines || []).filter((m) => !r.isWwMachine(m));
      if (nonWwIn24.length > 0) {
        const invalidIn24 = nonWwIn24.filter((m) => {
          const isLineC = r.isMachineLineC(m);
          const line = String(m.line || "").toUpperCase();
          const ws = String(m.workstation || m.ws || "").toUpperCase();
          const isLineAOrB =
            line.includes("LINE A") ||
            line.includes("LINE B") ||
            line === "A" ||
            line === "B" ||
            ws.endsWith("A") ||
            ws.endsWith("B");
          const isApk =
            r.isPouchMachine(m) ||
            String(m.name || m.id || "")
              .toUpperCase()
              .startsWith("APK");
          return isLineAOrB || !isLineC || !isApk;
        });

        if (invalidIn24.length > 0) {
          violations.push(
            `CQI 24 memuat mesin tidak diizinkan: ${this.formatMachineList(invalidIn24, machines, [], r)} (Mesin Line A dan Line B dilarang masuk CQI 24, hanya mesin WW & APK Line C saja yang diperbolehkan).`,
          );
        } else if (nonWwIn24.length > 4) {
          violations.push(
            `CQI 24 memuat lebih dari 4 mesin APK Line C (${nonWwIn24.length} mesin).`,
          );
        } else {
          const wsList = [
            ...new Set(
              nonWwIn24.map((m) =>
                r.getWorkstationKey(m).toUpperCase(),
              ),
            ),
          ];
          if (wsList.length > 2) {
            violations.push(
              `CQI 24 memuat mesin Line C dari ${wsList.length} workstation berbeda (${wsList.join(", ")}). Dilarang keras lebih dari 2 workstation.`,
            );
          }

          const totalManpower =
            slot24.core + (slot24.nonCore ? slot24.nonCore.length : 0) + (slot24.longshift ? slot24.longshift.length : 0);
          if (totalManpower < 2) {
            violations.push(
              `CQI 24 mendapat tambahan mesin APK Line C tetapi belum memiliki minimal 1 Non-Core / (LS).`,
            );
          } else {
            const wsDetail =
              wsList.length === 1
                ? `1 workstation (${wsList[0]}) - Sesuai preferensi utama agar lebih mudah`
                : `${wsList.length} workstation (${wsList.join(" & ")})`;
            info.push(
              `INFO: CQI 24 mengcover ${slot24.machines.length} Mesin (WW + ${nonWwIn24.length} APK Line C dari ${wsDetail}) dengan dukungan Non-Core/(LS).`,
            );
          }
        }
      }
    }

    // 5. Verifikasi aturan khusus OT & CQI 19
    const slot19 = slots.find((s) => r.getCqiNumber(s.cqi) === "19");
    if (slot19) {
      const nonOtIn19 = (slot19.machines || []).filter((m) => !r.isOtMachine(m));
      if (nonOtIn19.length > 0) {
        violations.push(
          `CQI 19 memuat mesin selain OT: ${this.formatMachineList(nonOtIn19, machines, [], r)} (CQI 19 strictly OT saja).`,
        );
      } else if (slot19.machines.length > 2) {
        violations.push(
          `CQI 19 melebihi batas maksimal 2 mesin OT (terisi ${slot19.machines.length} mesin).`,
        );
      }
    }

    // 6. Verifikasi aturan cross-line
    slots.forEach((s) => {
      const cqiNum = r.getCqiNumber(s.cqi);
      (s.machines || []).forEach((m) => {
        const allowed = r.isCrossLineAllowed(
          m,
          s.cqi,
          machines,
          [],
          [],
        );
        if (!allowed) {
          const ws = m.workstation || m.ws || "";
          violations.push(
            `Mesin ${m.name || m.id} (WS: ${ws}) di CQI ${cqiNum} melanggar aturan Cross-Line: Mesin baris belakang dilarang menyeberang jika mesin baris depan aktif.`,
          );
        }
      });
    });

    // 7. Verifikasi ketersediaan Manpower Core
    const emptyCoreSlots = slots.filter(
      (s) => s.machines && s.machines.length > 0 && s.core === 0,
    );
    if (emptyCoreSlots.length > 0) {
      violations.push(
        `${emptyCoreSlots.length} CQI aktif tidak memiliki Manpower Core.`,
      );
    }

    // 8. Verifikasi tidak ada konflik penugasan ganda
    const assignedCoreMap = new Map();
    const assignedNcMap = new Map();

    slots.forEach((s) => {
      const cqiNum = r.getCqiNumber(s.cqi);
      (s.coreNames || []).forEach((name) => {
        if (!name) return;
        const normalized = r.normalizeName(name);
        if (assignedCoreMap.has(normalized)) {
          violations.push(
            `Konflik Manpower Core: "${name}" ditugaskan ganda pada CQI ${assignedCoreMap.get(normalized)} dan CQI ${cqiNum}.`,
          );
        } else {
          assignedCoreMap.set(normalized, cqiNum);
        }
      });

      (s.nonCore || []).forEach((name) => {
        if (!name || name === "(LS)") return;
        const normalized = r.normalizeName(name);
        if (assignedNcMap.has(normalized)) {
          violations.push(
            `Konflik Manpower Non-Core: "${name}" ditugaskan ganda pada CQI ${assignedNcMap.get(normalized)} dan CQI ${cqiNum}.`,
          );
        } else {
          assignedNcMap.set(normalized, cqiNum);
        }
      });
    });

    return { valid: violations.length === 0, violations, info };
  },

  formatText(slots, config = {}, engine = null) {
    const r = engine || this;
    if (!Array.isArray(slots) || slots.length === 0) return "";

    let out = `*PLANNING LIQUID 3*\n`;
    out += `Tanggal: ${new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n`;

    const totalLsInput = parseInt(config.longshift || 0, 10);
    const assignedLsCount = slots.reduce(
      (sum, s) => sum + (s.longshift ? s.longshift.length : 0),
      0,
    );
    const remainingLs =
      slots.remainingLs !== undefined
        ? slots.remainingLs
        : Math.max(0, totalLsInput - assignedLsCount);
    if (totalLsInput > 0 || remainingLs > 0) {
      out += `Sisa LS       : ${remainingLs} Belum Terpakai\n`;
    }
    if (slots.remainingNonCore && slots.remainingNonCore.length > 0) {
      out += `Sisa Non-Core : ${slots.remainingNonCore.join(", ")} Belum Terpakai\n`;
    }
    out += `\n`;

    const allRunningInSlots = [];
    slots.forEach((s) => {
      if (Array.isArray(s.machines)) {
        allRunningInSlots.push(...s.machines);
      }
    });

    slots.forEach((s, i) => {
      if (!s.machines || s.machines.length === 0) return;
      const cqiName = s.cqi.name || `CQI-${i + 1}`;
      const coreStr =
        s.coreNames && s.coreNames.length > 0 ? s.coreNames.join(", ") : `${s.core} Core`;

      let combinedNcAndLs = [];
      if (s.nonCore && s.nonCore.length > 0) combinedNcAndLs.push(...s.nonCore);
      if (s.longshift && s.longshift.length > 0)
        combinedNcAndLs.push(...s.longshift);

      const nonCoreStr =
        combinedNcAndLs.length > 0 ? combinedNcAndLs.join(", ") : "-";
      const macList = this.formatMachineList(s.machines, allRunningInSlots, [], r);

      out += `${i + 1}. *${cqiName}*\n`;
      out += `   - Core     : ${coreStr}\n`;
      out += `   - Non-Core : ${nonCoreStr}\n`;
      out += `   - Mesin    : ${macList}\n\n`;
    });

    if (config.qcPassed) {
      if (config.qcPassed.includes("\n")) {
        out += `- QC Passed  :\n${config.qcPassed}\n`;
      } else {
        out += `- QC Passed  : ${config.qcPassed}\n`;
      }
    }

    if (config.milStd) out += `- Mil-Std    : ${config.milStd}\n`;
    if (config.supportFg) out += `- Support FG : ${config.supportFg}\n`;

    const unassigned =
      slots.unassignedMachines || slots.uncoveredMachines || [];
    if (unassigned.length > 0) {
      out += `\n*MESIN BELUM TERCOVER (${unassigned.length} Mesin):*\n`;
      unassigned.forEach((m, idx) => {
        const ws = r.getWorkstationKey(m);
        const cluster = r.getMachineClusterGroup(m);
        out += `${idx + 1}. ${m.name || m.id} (${ws}) - Cluster: ${cluster}\n`;
      });
    }

    return out;
  },

  // ---------------------------------------------------------------------------
  // 5. EXPORT EXCEL
  // ---------------------------------------------------------------------------
  XL: {
    accent: "FF2563EB",
    accentDark: "FF1E3A8A",
    soft: "FFEFF6FF",
    zebra: "FFF8FAFC",
    line: "FFCBD5E1",
    text: "FF1E293B",
    white: "FFFFFFFF",
  },

  thin(c) {
    return { style: "thin", color: { argb: c || this.XL.line } };
  },

  boxBorder(c) {
    return {
      top: this.thin(c),
      left: this.thin(c),
      bottom: this.thin(c),
      right: this.thin(c),
    };
  },

  async loadExcelJS() {
    if (typeof window !== "undefined" && window.ExcelJS) return window.ExcelJS;
    if (typeof document === "undefined") {
      throw new Error("Lingkungan bukan browser / document tidak tersedia");
    }
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
      s.onload = () => res(window.ExcelJS);
      s.onerror = () => rej(new Error("Gagal memuat library ExcelJS dari CDN."));
      document.head.appendChild(s);
    });
  },

  async exportToExcel(plan, options = {}) {
    return this.exportExcel(plan, options);
  },

  async exportExcel(plan, options = {}) {
    const currentPlan = plan || (typeof window !== "undefined" ? window.currentPlan : null);
    if (!currentPlan || currentPlan.length === 0) {
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert("Generate planning terlebih dahulu!");
      }
      return;
    }

    try {
      await this.loadExcelJS();
    } catch (e) {
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert(e.message);
      }
      return;
    }

    const wb = new window.ExcelJS.Workbook();
    const ws = wb.addWorksheet("Planning Shift", {
      views: [{ state: "frozen", xSplit: 0, ySplit: 4 }],
      pageSetup: {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    ws.columns = [
      { width: 6 },
      { width: 15 },
      { width: 28 },
      { width: 28 },
      { width: 65 },
    ];

    const headers = ["NO", "CQI", "CORE", "NON-CORE & LS", "MESIN"];
    const allRunning = currentPlan.flatMap((s) => s.machines || []);
    const formatter = this.formatMachineList.bind(this);

    const rows = currentPlan.map((slot, i) => {
      let combinedNc = [];
      if (slot.nonCore && slot.nonCore.length > 0) combinedNc.push(...slot.nonCore);
      if (slot.longshift && slot.longshift.length > 0) combinedNc.push(...slot.longshift);

      let coreStr =
        slot.coreNames && slot.coreNames.length > 0
          ? slot.coreNames.join(", ")
          : String(slot.core);
      let ncAndLs = combinedNc.length > 0 ? combinedNc.join(", ") : "-";
      let macList = formatter(slot.machines, allRunning, [], this);
      return [i + 1, slot.cqi.name || `CQI-${i + 1}`, coreStr, ncAndLs, macList];
    });

    const lastCol = headers.length;
    const title = ws.addRow(["PLANNING SHIFT — LIQUID 3"]);
    ws.mergeCells(title.number, 1, title.number, lastCol);
    title.height = 30;

    const tCell = ws.getCell(title.number, 1);
    tCell.font = { name: "Inter", size: 14, bold: true, color: { argb: this.XL.white } };
    tCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: this.XL.accentDark } };
    tCell.alignment = { vertical: "middle", horizontal: "center" };

    const totalMesin = currentPlan.reduce((a, s) => a + (s.machines ? s.machines.length : 0), 0);
    const stampText =
      "Dibuat: " +
      new Date().toLocaleString("id-ID") +
      "   |   Total CQI: " +
      currentPlan.length +
      "   |   Total Mesin: " +
      totalMesin;
    const stamp = ws.addRow([stampText]);
    ws.mergeCells(stamp.number, 1, stamp.number, lastCol);
    stamp.height = 20;

    const sCell = ws.getCell(stamp.number, 1);
    sCell.font = { name: "Inter", size: 10, italic: true, color: { argb: "FF475569" } };
    sCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: this.XL.soft } };
    sCell.alignment = { vertical: "middle", horizontal: "center" };

    ws.addRow([]);

    const headRow = ws.addRow(headers);
    headRow.height = 26;
    headRow.eachCell((c) => {
      c.font = { name: "Inter", size: 11, bold: true, color: { argb: this.XL.white } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: this.XL.accent } };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.border = this.boxBorder(this.XL.accentDark);
    });

    rows.forEach((r, i) => {
      const row = ws.addRow(r);
      let maxLen = Math.max(String(r[2]).length, String(r[3]).length, String(r[4]).length);
      row.height = Math.max(22, Math.ceil(maxLen / 45) * 16);

      row.eachCell({ includeEmpty: true }, (c, col) => {
        c.font = { name: "Inter", size: 10, color: { argb: this.XL.text } };
        c.alignment = {
          vertical: "middle",
          wrapText: true,
          horizontal: col === 1 || col === 2 ? "center" : "left",
        };
        c.border = this.boxBorder();
        if (i % 2 === 1) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: this.XL.zebra } };
        }
      });
    });

    let qcPassed = options.qcPassed;
    if (!qcPassed && typeof document !== "undefined") {
      const el = document.getElementById("qcPassedInput");
      if (el) qcPassed = el.value.trim();
    }

    if (qcPassed) {
      ws.addRow([]);
      const qcRow = ws.addRow(["QC PASSED:"]);
      qcRow.getCell(1).font = { name: "Inter", size: 11, bold: true, color: { argb: this.XL.text } };

      const qcContentRow = ws.addRow([qcPassed]);
      ws.mergeCells(qcContentRow.number, 1, qcContentRow.number, lastCol);
      qcContentRow.height = Math.max(22, qcPassed.split("\n").length * 16);
      const qcCell = qcContentRow.getCell(1);
      qcCell.font = { name: "Inter", size: 10, color: { argb: this.XL.text } };
      qcCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    }

    const buf = await wb.xlsx.writeBuffer();
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      a.download = options.fileName || "Planning_Liquid_3.xlsx";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    return buf;
  },

  // ---------------------------------------------------------------------------
  // 6. HISTORY & PERSISTENCE HELPER
  // ---------------------------------------------------------------------------
  savePlanHistory(slots, config = {}) {
    if (!Array.isArray(slots) || slots.length === 0) return null;
    const dateStr = new Date().toISOString().split("T")[0];
    const record = {
      date: dateStr,
      timestamp: new Date().toISOString(),
      slots: slots.map((s) => ({
        cqiName: s.cqi ? s.cqi.name || s.cqi.id : "CQI",
        cqiNum: this.getCqiNumber(s.cqi),
        core: s.coreNames || s.core,
        nonCore: s.nonCore || [],
        longshift: s.longshift || [],
        machines: (s.machines || []).map((m) => m.name || m.id),
      })),
      config,
    };

    try {
      if (typeof localStorage !== "undefined") {
        const historyList = JSON.parse(localStorage.getItem("planning_history_list") || "[]");
        historyList.push(record);
        if (historyList.length > 60) historyList.shift();
        localStorage.setItem("planning_history_list", JSON.stringify(historyList));
      }
    } catch (e) {
      console.warn("Gagal menyimpan riwayat lokal:", e);
    }

    return record;
  },
};

// Global / Window bindings for browser compatibility
if (typeof window !== "undefined") {
  window.rule = rule;
  window.exportExcel = rule.exportExcel.bind(rule);
  window.loadExcelJS = rule.loadExcelJS.bind(rule);
}

if (typeof globalThis !== "undefined") {
  globalThis.rule = rule;
}

export default rule;
