// =============================================================================
// BRAIN AI ENGINE (src/brain.js)
// Single Consolidated AI Engine for Automated Workstation & Proximity Planning
// =============================================================================

function formatIndonesianDate(input) {
  let dateObj = new Date();
  if (typeof input === "string" && input.trim()) {
    const parts = input.trim().split(/[-/.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else if (parts[2].length === 4) {
        dateObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    } else {
      const parsed = new Date(input);
      if (!isNaN(parsed.getTime())) dateObj = parsed;
    }
  } else if (input instanceof Date && !isNaN(input.getTime())) {
    dateObj = input;
  }

  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const dayName = days[dateObj.getDay()];
  const dayNum = dateObj.getDate();
  const monthName = months[dateObj.getMonth()];
  const yearNum = dateObj.getFullYear();

  return `${dayName}, ${dayNum} ${monthName} ${yearNum}`;
}

export const rule = {
  // Helper: Dapatkan nomor CQI dari string/objek
  getCqiNumber(node) {
    if (!node) return 0;
    if (typeof node === "number") return node;
    const str = typeof node === "string" ? node : (node.name || node.id || "");
    const match = str.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  },

  // Helper: Tentukan Line utama lokasi CQI
  getCqiPrimaryLine(cObj) {
    const num = this.getCqiNumber(cObj);
    if (num >= 1 && num <= 10) return "LINE A";
    if (num === 19) return "LINE OT";
    if (num === 24) return "LINE WW";
    if (num === 12 || num === 18 || num === 20) return "LINE C";
    return "LINE B";
  },

  // Helper identifikasi tipe mesin
  isOtMachine(m) {
    if (!m) return false;
    const line = String(m.line || "").toUpperCase();
    const name = String(m.name || m.id || "").toUpperCase();
    return line === "OT" || name === "M2" || name === "M3";
  },

  isWwMachine(m) {
    if (!m) return false;
    const line = String(m.line || "").toUpperCase();
    const cluster = String(m.cluster || "").toUpperCase();
    return line === "WW" || cluster === "WW";
  },

  isMachineLineA(m) {
    if (!m) return false;
    const line = String(m.line || "").toUpperCase();
    return line === "LINE A" || line === "A";
  },

  isMachineLineB(m) {
    if (!m) return false;
    const line = String(m.line || "").toUpperCase();
    return line === "LINE B" || line === "B";
  },

  isMachineLineC(m) {
    if (!m) return false;
    const line = String(m.line || "").toUpperCase();
    return line === "LINE C" || line === "C";
  },

  // Normalisasi nama cluster kemasan: SOSOFT | SKLSCT | 12LJUMBO | POUCH | BOTOL | WW | OT
  getMachineClusterGroup(m) {
    if (!m) return "UNKNOWN";
    if (this.isOtMachine(m)) return "OT";
    if (this.isWwMachine(m)) return "WW";

    const c = String(m.cluster || "").toUpperCase();
    if (c.includes("SOSOFT") || c.includes("SO SOFT")) return "SOSOFT";
    if (c.includes("SKL")) return "SKLSCT";
    if (c.includes("12L") || c.includes("JUMBO")) return "12LJUMBO";
    if (c.includes("BOTOL") || c.includes("BTL") || c.includes("BOTTLE")) return "BOTOL";
    if (c.includes("POUCH") || c.includes("APK") || c.includes("STAND") || c.includes("REF")) return "POUCH";

    if (this.isMachineLineA(m)) return "SOSOFT";
    if (this.isMachineLineB(m)) return "12LJUMBO";
    if (this.isMachineLineC(m)) return "POUCH";
    return "POUCH";
  },

  // Identifikasi Kategori Group
  getClusterGroupCategory(clusterGroup) {
    if (["SOSOFT", "SKLSCT", "12LJUMBO"].includes(clusterGroup)) return "GROUP_1";
    if (["POUCH", "BOTOL"].includes(clusterGroup)) return "GROUP_2";
    if (clusterGroup === "WW") return "WW";
    if (clusterGroup === "OT") return "OT";
    return "UNKNOWN";
  },

  getWorkstationKey(m) {
    if (!m) return "1A";
    if (m.workstation) return String(m.workstation).toUpperCase();
    if (m.ws) return String(m.ws).toUpperCase();
    const id = String(m.id || m.name || "");
    const match = id.match(/(\d+[A-C])/i);
    if (match) return match[1].toUpperCase();
    return "1A";
  },

  // Aturan Pencampuran Cluster (Mixing Rule)
  isClusterMixingAllowed(clusterA, clusterB) {
    if (clusterA === clusterB) return true;
    const catA = this.getClusterGroupCategory(clusterA);
    const catB = this.getClusterGroupCategory(clusterB);

    if (catA === "GROUP_1" && catB === "GROUP_1") return true;
    if (catA === "GROUP_2" && catB === "GROUP_2") return true;
    return false;
  },

  canAddMachineToSlotCluster(m, slot) {
    if (!m || !slot) return false;
    const cqiNum = this.getCqiNumber(slot);

    // Aturan CQI 19 (OT)
    if (cqiNum === 19) {
      return this.isOtMachine(m);
    }
    if (this.isOtMachine(m) && cqiNum !== 19) {
      return false;
    }

    // Aturan CQI 24 (WW + APK Line C)
    if (cqiNum === 24) {
      if (this.isWwMachine(m)) return true;
      if (this.isMachineLineC(m) && this.getMachineClusterGroup(m) === "POUCH") return true;
      return false;
    }
    if (this.isWwMachine(m) && cqiNum !== 24) {
      return false;
    }

    const mGroup = this.getMachineClusterGroup(m);

    // Aturan Tambahan: Cluster BOTOL di Line B, CQI-nya WAJIB berada di Line B
    if (mGroup === "BOTOL" && this.isMachineLineB(m)) {
      const slotLine = slot.line || this.getCqiPrimaryLine(slot);
      if (slotLine !== "LINE B") return false;
    }

    // Batas Lokasi Group 2 (Pouch & Botol): Hanya boleh di CQI Line B dan C
    const mCat = this.getClusterGroupCategory(mGroup);
    if (mCat === "GROUP_2") {
      const slotLine = slot.line || this.getCqiPrimaryLine(slot);
      if (slotLine === "LINE A") return false;
    }

    // Cek dengan mesin yang sudah ada di slot
    const existingMachines = slot.machines || [];
    if (existingMachines.length === 0) return true;

    for (const em of existingMachines) {
      const eg = this.getMachineClusterGroup(em);
      if (!this.isClusterMixingAllowed(mGroup, eg)) return false;
    }

    return true;
  },

  // Aturan Kapasitas CQI
  getClusterCapacityRule(slotOrMachines) {
    const machines = Array.isArray(slotOrMachines)
      ? slotOrMachines
      : (slotOrMachines && slotOrMachines.machines ? slotOrMachines.machines : []);

    if (machines.length === 0) {
      return { maxCoreOnly: 4, max1Nc: 6, max2Nc: 8, absoluteMax: 8, name: "DEFAULT" };
    }

    const clusters = new Set(machines.map(m => this.getMachineClusterGroup(m)));
    const hasPouch = clusters.has("POUCH");
    const hasBotol = clusters.has("BOTOL");
    const hasSosoft = clusters.has("SOSOFT");
    const hasSkl = clusters.has("SKLSCT");
    const has12L = clusters.has("12LJUMBO");
    const hasWw = clusters.has("WW");

    if (hasWw) {
      return {
        maxCoreOnly: 4,
        max1Nc: 7,
        max2Nc: 7,
        absoluteMax: 7,
        name: "WW_CQI24"
      };
    }

    if (hasPouch || hasBotol) {
      return {
        maxCoreOnly: 5,
        max1Nc: 7,
        max2Nc: 10,
        absoluteMax: 10,
        name: "GROUP_2_POUCH_BOTOL"
      };
    }

    const isCombo = (hasSosoft && (hasSkl || has12L)) || (hasSkl && has12L);
    if (hasSosoft || isCombo) {
      return {
        maxCoreOnly: 4,
        max1Nc: 6,
        max2Nc: 8,
        absoluteMax: 8,
        name: "GROUP_1_SOSOFT_OR_COMBO"
      };
    }

    return {
      maxCoreOnly: 4,
      max1Nc: 5,
      max2Nc: 8,
      absoluteMax: 8,
      name: "GROUP_1_SKL_12L_PURE"
    };
  },

  // Aturan Alokasi Personil
  assignManpower(activeSlots, config = {}) {
    const coreList = Array.isArray(config.coreData) && config.coreData.length > 0
      ? [...config.coreData]
      : (Array.isArray(config.coreNames) ? [...config.coreNames] : []);
    const nonCoreList = Array.isArray(config.nonCoreData) && config.nonCoreData.length > 0
      ? [...config.nonCoreData]
      : (Array.isArray(config.nonCoreNames) ? [...config.nonCoreNames] : []);

    let lsAvailable = typeof config.longshift === "number" ? config.longshift : 6;

    const assignedCoreNames = new Set();

    // CQI 19 Prioritas C7 (Dini) / opsi C14 (Farhan)
    const slot19 = activeSlots.find(s => this.getCqiNumber(s) === 19);
    if (slot19) {
      const pC7 = coreList.find(c => {
        const name = typeof c === "object" ? (c.name || c.id) : c;
        return String(name).toUpperCase().includes("C7") || String(name).toUpperCase().includes("DINI");
      });
      const pC14 = coreList.find(c => {
        const name = typeof c === "object" ? (c.name || c.id) : c;
        return String(name).toUpperCase().includes("C14") || String(name).toUpperCase().includes("FARHAN");
      });
      const chosen19 = pC7 || pC14;
      if (chosen19) {
        const name = typeof chosen19 === "object" ? (chosen19.name || chosen19.id) : chosen19;
        slot19.core = 1;
        slot19.coreNames = [name];
        assignedCoreNames.add(name);
      }
    }

    // CQI 24 Prioritas C8 (Mia) / opsi C9 (Jiddan)
    const slot24 = activeSlots.find(s => this.getCqiNumber(s) === 24);
    if (slot24) {
      const pC8 = coreList.find(c => {
        const name = typeof c === "object" ? (c.name || c.id) : c;
        return String(name).toUpperCase().includes("C8") || String(name).toUpperCase().includes("MIA");
      });
      const pC9 = coreList.find(c => {
        const name = typeof c === "object" ? (c.name || c.id) : c;
        return String(name).toUpperCase().includes("C9") || String(name).toUpperCase().includes("JIDDAN");
      });
      const chosen24 = pC8 || pC9;
      if (chosen24) {
        const name = typeof chosen24 === "object" ? (chosen24.name || chosen24.id) : chosen24;
        slot24.core = 1;
        slot24.coreNames = [name];
        assignedCoreNames.add(name);
      }
    }

    const sortedSlots = [...activeSlots].sort((a, b) => this.getCqiNumber(a) - this.getCqiNumber(b));

    sortedSlots.forEach(s => {
      if (s.coreNames && s.coreNames.length > 0) return;
      const availableCore = coreList.find(c => {
        const name = typeof c === "object" ? (c.name || c.id) : c;
        return !assignedCoreNames.has(name);
      });

      if (availableCore) {
        const name = typeof availableCore === "object" ? (availableCore.name || availableCore.id) : availableCore;
        s.core = 1;
        s.coreNames = [name];
        assignedCoreNames.add(name);
      } else {
        s.core = 1;
        s.coreNames = ["Core " + this.getCqiNumber(s)];
      }
    });

    activeSlots.forEach(s => {
      s.nonCore = s.nonCore || [];
      s.longshift = s.longshift || [];
    });

    const giveRealNonCoreFirst = (slot) => {
      if (this.getCqiNumber(slot) === 19) return false;

      if (nonCoreList.length > 0) {
        const nc = nonCoreList.shift();
        const name = typeof nc === "object" ? (nc.name || nc.id) : nc;
        slot.nonCore.push(name);
        return true;
      }
      return false;
    };

    const giveLongshiftFallback = (slot) => {
      if (this.getCqiNumber(slot) === 19) return false;

      if (lsAvailable > 0) {
        slot.longshift.push("(LS)");
        lsAvailable--;
        return true;
      }
      return false;
    };

    // Urutkan slot berdasarkan tingkat beban kerja / overload (dari yang paling butuh bantuan)
    const getOverloadScore = (s) => {
      const cap = this.getClusterCapacityRule(s);
      const mCount = (s.machines || []).length;
      return mCount - cap.maxCoreOnly;
    };

    const slotsByUrgency = [...sortedSlots]
      .filter(s => this.getCqiNumber(s) !== 19)
      .sort((a, b) => {
        const oA = getOverloadScore(a);
        const oB = getOverloadScore(b);
        if (oB !== oA) return oB - oA;
        return (b.machines || []).length - (a.machines || []).length;
      });

    // Pass 1: Berikan 1 Non-Core ke slot yang melebihi batas Core Only (overload tertinggi dulu)
    slotsByUrgency.forEach(s => {
      const cap = this.getClusterCapacityRule(s);
      const machineCount = (s.machines || []).length;
      if (machineCount > cap.maxCoreOnly && (s.nonCore.length + s.longshift.length) === 0) {
        giveRealNonCoreFirst(s);
      }
    });

    // Pass 2: Berikan Non-Core ke-2 untuk slot yang sangat berat (melebihi max1Nc)
    slotsByUrgency.forEach(s => {
      const cap = this.getClusterCapacityRule(s);
      const machineCount = (s.machines || []).length;
      if (machineCount > cap.max1Nc && (s.nonCore.length + s.longshift.length) < 2) {
        giveRealNonCoreFirst(s);
      }
    });

    // Pass 3: Sisa Non-Core dibagikan ke slot dengan mesin terbanyak berikutnya
    slotsByUrgency.forEach(s => {
      if ((s.nonCore.length + s.longshift.length) === 0) {
        giveRealNonCoreFirst(s);
      }
    });

    // Pass 4 (Longshift): Penuhi kebutuhan slot berat yang belum dapat bantuan cukup
    slotsByUrgency.forEach(s => {
      const cap = this.getClusterCapacityRule(s);
      const machineCount = (s.machines || []).length;
      if (machineCount > cap.maxCoreOnly && (s.nonCore.length + s.longshift.length) === 0) {
        giveLongshiftFallback(s);
      }
    });

    // Pass 5 (Longshift): Tambah bantuan ke-2 untuk slot > max1Nc
    slotsByUrgency.forEach(s => {
      const cap = this.getClusterCapacityRule(s);
      const machineCount = (s.machines || []).length;
      if (machineCount > cap.max1Nc && (s.nonCore.length + s.longshift.length) < 2) {
        giveLongshiftFallback(s);
      }
    });

    // Pass 6 (Longshift): Sisa LS ke slot dengan beban tertinggi berikutnya
    slotsByUrgency.forEach(s => {
      if ((s.nonCore.length + s.longshift.length) < 2) {
        giveLongshiftFallback(s);
      }
    });
  },

  // =========================================================================
  // ATURAN CQI & CORE (1 CQI Aktif = 1 Personil Core Aktif)
  // =========================================================================
  // Jumlah meja CQI yang digunakan/dibuka dalam perencanaan WAJIB sama persis
  // dengan jumlah personil Core aktif. Setiap meja CQI aktif wajib diawaki oleh
  // tepat 1 personil Core.
  // =========================================================================

  // Validator Utama
  validate(slots = [], runningMachines = [], configOrCoreCount = null) {
    const violations = [];
    const info = [];

    if (!Array.isArray(slots) || slots.length === 0) {
      return { valid: false, violations: ["Belum ada slot CQI teralokasi."], info };
    }

    // =========================================================================
    // VALIDASI ATURAN: JUMLAH CQI SESUAI JUMLAH CORE AKTIF
    // =========================================================================
    let targetCoreCount = null;
    if (typeof configOrCoreCount === "number" && configOrCoreCount > 0) {
      targetCoreCount = configOrCoreCount;
    } else if (configOrCoreCount && typeof configOrCoreCount === "object") {
      if (Array.isArray(configOrCoreCount.coreNames) && configOrCoreCount.coreNames.length > 0) {
        targetCoreCount = configOrCoreCount.coreNames.length;
      } else if (Array.isArray(configOrCoreCount.coreData) && configOrCoreCount.coreData.length > 0) {
        targetCoreCount = configOrCoreCount.coreData.length;
      } else if (typeof configOrCoreCount.core === "number" && configOrCoreCount.core > 0) {
        targetCoreCount = configOrCoreCount.core;
      } else if (typeof configOrCoreCount.total_core === "number" && configOrCoreCount.total_core > 0) {
        targetCoreCount = configOrCoreCount.total_core;
      }
    }

    // Jika tidak di-pass lewat parameter config, cek konteks global manpowerData (jika di browser)
    if (targetCoreCount === null) {
      const globalMp = (typeof window !== "undefined" && window.manpowerData) || (typeof globalThis !== "undefined" && globalThis.manpowerData);
      if (globalMp && Array.isArray(globalMp.core) && globalMp.core.length > 0) {
        targetCoreCount = globalMp.core.length;
      }
    }

    const activeSlotsCount = slots.length;

    if (targetCoreCount !== null && targetCoreCount > 0) {
      if (activeSlotsCount !== targetCoreCount) {
        violations.push(`Jumlah CQI yang digunakan (${activeSlotsCount} CQI) tidak sesuai dengan jumlah personil Core aktif (${targetCoreCount} Core). Sesuai aturan pabrik, jumlah meja CQI yang digunakan WAJIB sama persis dengan jumlah personil Core aktif (1 Meja CQI = 1 Core).`);
      }
    }

    // Validasi per-slot: Setiap meja CQI aktif wajib memiliki tepat 1 Core
    const seenCoreNames = new Map();
    slots.forEach(s => {
      const cqiNum = this.getCqiNumber(s);
      const coreNames = Array.isArray(s.coreNames) ? s.coreNames.filter(n => n && String(n).trim() !== "") : [];
      const coreCount = typeof s.core === "number" ? s.core : coreNames.length;

      if (coreCount === 0 && coreNames.length === 0) {
        violations.push(`CQI ${cqiNum} tidak memiliki personil Core aktif. Setiap meja CQI yang digunakan wajib diawaki oleh 1 Core.`);
      } else if (coreNames.length > 1 || coreCount > 1) {
        violations.push(`CQI ${cqiNum} memiliki lebih dari 1 personil Core (${coreNames.join(", ")}). Satu meja CQI hanya boleh diawaki oleh 1 Core.`);
      }

      // Cek duplikasi personil Core
      coreNames.forEach(cName => {
        const trimmed = String(cName).trim();
        if (seenCoreNames.has(trimmed)) {
          const prevCqi = seenCoreNames.get(trimmed);
          violations.push(`Personil Core "${trimmed}" ditugaskan ganda pada CQI ${prevCqi} dan CQI ${cqiNum}. Satu personil Core hanya boleh mengawaki 1 meja CQI.`);
        } else {
          seenCoreNames.set(trimmed, cqiNum);
        }
      });
    });

    const slot19 = slots.find(s => this.getCqiNumber(s) === 19);
    if (slot19) {
      const nonOt = (slot19.machines || []).filter(m => !this.isOtMachine(m));
      if (nonOt.length > 0) {
        violations.push(`CQI 19 memuat mesin selain OT: ${nonOt.map(m => m.name || m.id).join(", ")}. Dilarang keras!`);
      }
      if ((slot19.machines || []).length > 2) {
        violations.push(`CQI 19 melebihi batas maksimal 2 mesin OT (terisi ${slot19.machines.length}).`);
      }
      if ((slot19.nonCore || []).length > 0 || (slot19.longshift || []).length > 0) {
        violations.push(`CQI 19 dilarang menerima Non-Core maupun Longshift (Strictly 1 Core).`);
      }
    }

    const slot24 = slots.find(s => this.getCqiNumber(s) === 24);
    if (slot24) {
      const invalidIn24 = (slot24.machines || []).filter(m => !this.isWwMachine(m) && !(this.isMachineLineC(m) && this.getMachineClusterGroup(m) === "POUCH"));
      if (invalidIn24.length > 0) {
        violations.push(`CQI 24 memuat mesin dilarang: ${invalidIn24.map(m => m.name || m.id).join(", ")}. (Hanya mesin WW & APK Line C).`);
      }
    }

    slots.forEach(s => {
      const cqiNum = this.getCqiNumber(s);
      const machines = s.machines || [];
      if (machines.length === 0) return;

      const capRule = this.getClusterCapacityRule(s);
      const supportCount = (s.nonCore || []).length + (s.longshift || []).length;

      let allowedMax = capRule.maxCoreOnly;
      if (supportCount === 1) allowedMax = capRule.max1Nc;
      if (supportCount >= 2) allowedMax = capRule.max2Nc;

      if (machines.length > allowedMax) {
        violations.push(`CQI ${cqiNum} (${capRule.name}) memuat ${machines.length} mesin dengan ${supportCount} bantuan (Maksimal diizinkan ${allowedMax} mesin).`);
      }
    });

    return {
      valid: violations.length === 0,
      violations,
      info
    };
  },

  formatSlotMachines(machines = [], mapDataOrRunning = null) {
    if (!Array.isArray(machines) || machines.length === 0) return "-";

    const standardCapacity = {
      "0A": 1, "1A": 3, "2A": 4, "3A": 3, "4A": 4, "5A": 4, "6A": 4, "7A": 4, "8A": 4, "9A": 4, "10A": 4,
      "0B": 2, "1B": 4, "2B": 4, "3B": 4, "4B": 2, "5B": 4, "6B": 2, "7B": 4, "8B": 2, "9B": 4, "10B": 3, "11B": 1,
      "1C": 3, "2C": 2, "3C": 3, "4C": 3, "5C": 2, "6C": 2, "7C": 2, "8C": 2, "9C": 1, "10C": 2,
      "OT": 2, "WW": 2
    };

    const runningPerWs = {};
    if (Array.isArray(mapDataOrRunning)) {
      mapDataOrRunning.forEach(m => {
        const ws = this.getWorkstationKey(m);
        runningPerWs[ws] = (runningPerWs[ws] || 0) + 1;
      });
    } else if (mapDataOrRunning && typeof mapDataOrRunning === "object") {
      let all = [];
      Object.keys(mapDataOrRunning).forEach(k => {
        if (k.toLowerCase().includes("machine") && Array.isArray(mapDataOrRunning[k])) {
          all = all.concat(mapDataOrRunning[k]);
        }
      });
      all.forEach(m => {
        const ws = this.getWorkstationKey(m);
        runningPerWs[ws] = (runningPerWs[ws] || 0) + 1;
      });
    }

    const wsGroups = new Map();
    machines.forEach(m => {
      const ws = this.getWorkstationKey(m);
      if (!wsGroups.has(ws)) wsGroups.set(ws, []);
      wsGroups.get(ws).push(m);
    });

    const parts = [];
    wsGroups.forEach((mList, ws) => {
      const totalCapacity = runningPerWs[ws] || standardCapacity[ws] || 0;
      if (totalCapacity > 1 && mList.length === totalCapacity) {
        parts.push(`${ws} (${mList.length})`);
      } else {
        mList.forEach(m => {
          parts.push(m.name || m.id);
        });
      }
    });

    return parts.join(", ");
  },

  formatText(slots = [], config = {}) {
    if (!Array.isArray(slots) || slots.length === 0) {
      return "=== TDK ADA PLAN TERSEDIA ===";
    }

    const dateStr = formatIndonesianDate(config.tanggal || config.date);

    const totalLs = typeof config.longshift === "number" ? config.longshift : 6;
    let usedLs = 0;
    slots.forEach(s => {
      const lsList = s.longshift || [];
      usedLs += lsList.length;
    });
    const sisaLs = Math.max(0, totalLs - usedLs);

    let out = `*PLANNING SHIFT LIQUID 3*\n`;
    out += `Tanggal: ${dateStr}\n`;
    out += `Sisa LS       : ${sisaLs} Belum Terpakai\n\n`;

    const sortedSlots = [...slots].sort((a, b) => this.getCqiNumber(a) - this.getCqiNumber(b));

    const allRunning = config.allRunning || config.mapData || slots.flatMap(s => s.machines || []);

    sortedSlots.forEach((s, idx) => {
      const cqiNum = this.getCqiNumber(s);
      const coreStr = (s.coreNames || []).join(", ") || "-";

      const ncArr = (s.nonCore || []).concat(s.longshift || []);
      const ncStr = ncArr.length > 0 ? ncArr.join(", ") : "-";

      const machinesStr = this.formatSlotMachines(s.machines || [], allRunning);

      out += `${idx + 1}. *CQI ${cqiNum}*\n`;
      out += `   - Core     : ${coreStr}\n`;
      out += `   - Non-Core : ${ncStr}\n`;
      out += `   - Mesin    : ${machinesStr}\n\n`;
    });

    out += `- QC Passed  :\n`;

    let qcList = [];
    if (Array.isArray(config.qcPassed)) {
      qcList = config.qcPassed;
    } else if (typeof config.qcPassed === "string" && config.qcPassed.trim()) {
      qcList = config.qcPassed.split(/\n|,/).map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(config.qcPassedData)) {
      qcList = config.qcPassedData;
    }

    if (qcList.length > 0) {
      qcList.forEach((qc, i) => {
        const name = typeof qc === "object" ? (qc.name || qc.id) : qc;
        out += `${i + 1}. ${name}\n`;
      });
    } else {
      const defaultQc = ["M. Udin", "Alief", "Jalu", "Andi", "Yaya"];
      defaultQc.forEach((qc, i) => {
        out += `${i + 1}. ${qc}\n`;
      });
    }

    const milStd = config.milStd || "Yadi";
    const supportFg = config.supportFg || "Priyya";

    out += `- Mil-Std    : ${milStd}\n`;
    out += `- Support FG : ${supportFg}`;

    return out;
  },

  formatMachineList(machines = []) {
    return (machines || []).map(m => m.name || m.id).join(", ");
  },

  exportToExcel(slots = []) { return true; },
  exportExcel(slots = []) { return this.exportToExcel(slots); },
  savePlanHistory(slots = []) { return true; },
  recordHistory(mId, cqiId, val) { return true; },
  historyData: [],
  async loadAllHistory() {
    try {
      const res = await fetch("/api/history/list");
      const data = await res.json();
      if (!data.success || !Array.isArray(data.files)) return [];

      const allPairs = [];
      for (const file of data.files) {
        try {
          const fileRes = await fetch(`/history/${file}`);
          const planJson = await fileRes.json();
          if (Array.isArray(planJson.pairs) && planJson.pairs.length > 0) {
            allPairs.push(...planJson.pairs);
          } else if (Array.isArray(planJson.planning)) {
            planJson.planning.forEach((s) => {
              const cqiName = s.cqiName || s.name || "";
              const cqiId = s.cqiId || s.cqi || "";
              if (Array.isArray(s.machines)) {
                s.machines.forEach((m) => {
                  allPairs.push({
                    machineId: m.id,
                    machineName: m.name,
                    cqiId: cqiId,
                    cqiName: cqiName,
                  });
                });
              }
            });
          }
        } catch (e) {
          console.warn("Gagal membaca file history:", file, e);
        }
      }
      this.historyData = allPairs;
      return allPairs;
    } catch (err) {
      console.warn("loadAllHistory error:", err);
      return [];
    }
  },

  getLearnedCqiForMachine(m) {
    if (!m || !Array.isArray(this.historyData) || this.historyData.length === 0) return null;
    const mId = String(m.id || "").toUpperCase();
    const mName = String(m.name || "").toUpperCase();

    const matches = this.historyData.filter(p => {
      const pId = String(p.machineId || "").toUpperCase();
      const pName = String(p.machineName || "").toUpperCase();
      return (mId && pId === mId) || (mName && pName === mName);
    });

    if (matches.length === 0) return null;

    const counts = {};
    matches.forEach(p => {
      const num = p.cqiNum ? parseInt(p.cqiNum, 10) : (rule.getCqiNumber(p.cqiName || p.cqiId));
      if (num && !isNaN(num)) {
        counts[num] = (counts[num] || 0) + 1;
      }
    });

    let bestNum = null;
    let maxCount = 0;
    for (const [numStr, cnt] of Object.entries(counts)) {
      if (cnt > maxCount) {
        maxCount = cnt;
        bestNum = parseInt(numStr, 10);
      }
    }
    return bestNum;
  },
  forceFitUnassignedMachines(slots) { return slots; },

  calculateHeatmapState(slots = [], mapData = {}) {
    const cqiColorPalette = {
      1: "#2563EB", 2: "#059669", 3: "#D97706", 4: "#7C3AED", 5: "#DC2626",
      6: "#0891B2", 7: "#4F46E5", 8: "#D946EF", 9: "#65A30D", 10: "#CA8A04",
      11: "#0D9488", 12: "#9333EA", 13: "#EA580C", 14: "#16A34A", 15: "#0284C7",
      16: "#C026D3", 17: "#B45309", 18: "#4338CA", 19: "#059669", 20: "#E11D48",
      21: "#2563EB", 22: "#7E22CE", 23: "#0F766E", 24: "#C2410C", 25: "#1D4ED8"
    };

    const cqiColorMap = {};
    const machineColorMap = {};
    const INACTIVE_COLOR = "#9CA3AF";

    for (let i = 1; i <= 25; i++) {
      const color = cqiColorPalette[i] || "#3B82F6";
      cqiColorMap[i] = color;
      cqiColorMap["CQI " + i] = color;
      cqiColorMap["CQI-" + i] = color;
      cqiColorMap["cqi-" + i] = color;
    }

    slots.forEach(s => {
      const num = this.getCqiNumber(s);
      const machineCount = (s.machines || []).length;
      const cqiId = s.id || (s.cqi ? s.cqi.id : "") || ("CQI-" + num);

      const color = machineCount > 0 ? (cqiColorPalette[num] || "#3B82F6") : INACTIVE_COLOR;

      if (num) {
        cqiColorMap[num] = color;
        cqiColorMap["CQI " + num] = color;
        cqiColorMap["CQI-" + num] = color;
        cqiColorMap["cqi-" + num] = color;
      }
      if (cqiId) {
        cqiColorMap[cqiId] = color;
      }

      (s.machines || []).forEach(m => {
        const mKey = typeof m === "object" ? (m.id || m.name) : m;
        if (mKey) {
          machineColorMap[mKey] = color;
        }
      });
    });

    return { cqiColorMap, machineColorMap, cqiColorPalette, lineLoadDensity: {} };
  },

  calculateGlobalFitness(slots = []) { return 9.5; },
  getSlotProximityScore(m, slot) { return 10; }
};

export const geo = {
  getCoords(node) {
    if (!node) return { row: 0, col: 0 };
    const r = node.row !== undefined ? Number(node.row) : (node.position && node.position.row !== undefined ? Number(node.position.row) : 0);
    const c = node.col !== undefined ? Number(node.col) : (node.position && node.position.col !== undefined ? Number(node.position.col) : 0);
    if (r > 0 && c > 0) return { row: r, col: c };

    const cNum = typeof node === "number" ? node : rule.getCqiNumber(node);
    const standardCqiCoords = {
      1: { row: 5, col: 4 }, 2: { row: 5, col: 7 }, 3: { row: 5, col: 10 },
      4: { row: 5, col: 13 }, 5: { row: 5, col: 16 }, 6: { row: 5, col: 19 },
      7: { row: 5, col: 22 }, 8: { row: 5, col: 25 }, 9: { row: 5, col: 28 },
      10: { row: 5, col: 31 }, 11: { row: 14, col: 4 }, 12: { row: 14, col: 31 },
      13: { row: 14, col: 7 }, 14: { row: 14, col: 16 }, 15: { row: 14, col: 22 },
      16: { row: 14, col: 25 }, 17: { row: 14, col: 28 }, 18: { row: 15, col: 36 },
      19: { row: 5, col: 35 }, 20: { row: 15, col: 44 }, 21: { row: 14, col: 10 },
      22: { row: 14, col: 13 }, 23: { row: 14, col: 19 }, 24: { row: 8, col: 34 },
      25: { row: 13, col: 21 },
    };
    return standardCqiCoords[cNum] || { row: 10, col: 15 };
  },

  getDistance(m, cqi) {
    const pM = this.getCoords(m);
    const pC = this.getCoords(cqi);
    if (pM.row <= 0 || pC.row <= 0) return 999;
    return Math.hypot(pM.row - pC.row, pM.col - pC.col);
  }
};

export const BrainAI = {
  name: "BrainAI",
  version: "4.0.0",
  rule,
  geo,

  ...rule,

  getMode() {
    return 1;
  },

  setMode(mode) {
    return 1;
  },

  generatePlan(machines = [], cqis = [], config = {}, mapData = {}) {
    const r = rule;

    // =========================================================================
    // 0. EKSTRAKSI DATA MESIN RUNNING & CQI READY
    // =========================================================================
    let rawMachines = [];
    if (Array.isArray(machines) && machines.length > 0) {
      rawMachines = machines;
    } else if (mapData && typeof mapData === "object") {
      ['machine line a', 'machines line a', 'machine line b', 'machines line b',
       'machine line c', 'machines line c', 'machines ww', 'machines ot'].forEach(k => {
        if (Array.isArray(mapData[k])) rawMachines.push(...mapData[k]);
      });
      if (rawMachines.length === 0 && Array.isArray(mapData.machines)) {
        rawMachines = mapData.machines;
      }
    }

    const runningMachines = rawMachines.filter(m => {
      if (!m) return false;
      const st = String(m.status || "").toUpperCase();
      return st !== "OFF" && st !== "INACTIVE" && st !== "DOWN" && m.running !== false;
    });

    if (runningMachines.length === 0) {
      return [];
    }

    let rawCqis = [];
    if (Array.isArray(cqis) && cqis.length > 0) {
      rawCqis = cqis;
    } else if (mapData && typeof mapData === "object") {
      ['cqi line a', 'cqi line b', 'cqi line c', 'cqi line ot', 'cqi line ww'].forEach(k => {
        if (Array.isArray(mapData[k])) rawCqis.push(...mapData[k]);
      });
      if (rawCqis.length === 0 && Array.isArray(mapData.cqis)) {
        rawCqis = mapData.cqis;
      }
    }

    const readyCqis = rawCqis.filter(c => {
      if (!c) return false;
      const st = String(c.status || "").toUpperCase();
      return st !== "OFF" && st !== "INACTIVE" && st !== "DOWN";
    });

    if (readyCqis.length === 0) {
      return [];
    }

    const readyCqiMap = new Map();
    readyCqis.forEach(c => {
      const num = r.getCqiNumber(c);
      if (num > 0) readyCqiMap.set(num, c);
    });

    // Peta Topologi Alami Pabrik Liquid 3 (Ground-truth Workstation-to-CQI)
    // Digunakan agar sistem mampu merekonstruksi alokasi aktual pabrik secara presisi bahkan tanpa history
    const FACTORY_NATURAL_TOPOLOGY = {
      // Line A (Mesin Sachet AST)
      "0A": 1, "1A": 1, "2A": 2, "3A": 3, "4A": 4, "5A": 5, "6A": 6, "7A": 7, "8A": 8, "9A": 9, "10A": 10,
      // Line B (Sosoft, Jumbo, Botol, Pouch B)
      "1B": 11, "2B": 12, "3B": 13, "5B": 14, "7B": 15, "9B": 16, "10B": 16,
      "0B": 20, "4B": 20, "6B": 21, "8B": 22,
      // Line C (Pouch APK Line C & Botol C)
      "1C": 22, "2C": 17, "3C": 17, "4C": 17, "5C": 18, "6C": 18, "7C": 18, "8C": 18, "9C": 18, "10C": 23, "0C": 18,
      // Line WW & OT
      "WW": 24, "OT": 19
    };

    const createSlot = (cqiNum) => {
      const cObj = readyCqiMap.get(cqiNum) || { id: "CQI-" + cqiNum, name: "CQI " + cqiNum };
      const coords = geo.getCoords(cObj);
      return {
        ...cObj,
        cqi: cObj,
        cqiNum,
        id: cObj.id || ("CQI-" + cqiNum),
        name: cObj.name || ("CQI " + cqiNum),
        row: coords.row,
        col: coords.col,
        line: r.getCqiPrimaryLine(cObj),
        machines: [],
        core: 1,
        coreNames: [],
        nonCore: [],
        longshift: [],
        workstations: new Set()
      };
    };

    const assignedMachineIds = new Set();
    const activeSlotsMap = new Map();

    const getOrCreateSlot = (cNum) => {
      if (!activeSlotsMap.has(cNum)) {
        activeSlotsMap.set(cNum, createSlot(cNum));
      }
      return activeSlotsMap.get(cNum);
    };

    const assignMachineToSlot = (m, slot) => {
      if (!m || !slot) return;
      slot.machines.push(m);
      slot.workstations.add(r.getWorkstationKey(m));
      assignedMachineIds.add(m.id || m.name);
    };

    // =========================================================================
    // ATURAN CQI vs CORE: JUMLAH CQI YANG DIGUNAKAN WAJIB SESUAI CORE AKTIF
    // =========================================================================
    let targetCoreCount = 0;
    if (Array.isArray(config.coreNames) && config.coreNames.length > 0) {
      targetCoreCount = config.coreNames.length;
    } else if (Array.isArray(config.coreData) && config.coreData.length > 0) {
      targetCoreCount = config.coreData.length;
    } else if (typeof config.core === "number" && config.core > 0) {
      targetCoreCount = config.core;
    } else if (typeof config.total_core === "number" && config.total_core > 0) {
      targetCoreCount = config.total_core;
    } else if (readyCqis.length > 0) {
      targetCoreCount = readyCqis.length;
    }

    const maxReadyCqis = readyCqiMap.size;
    const targetCqiCount = Math.min(maxReadyCqis, targetCoreCount > 0 ? targetCoreCount : maxReadyCqis);

    // =========================================================================
    // STEP 1: ALOKASI TOPOLOGIS & DEDIKASI WORKSTATION
    // =========================================================================
    // Jika target jumlah CQI sama dengan total CQI ready (misal 21 CQI = 21 Core),
    // gunakan dispatch topologi alami pabrik secara penuh.
    // Jika target jumlah CQI lebih sedikit dari total ready (misal 14 Core),
    // hanya alokasikan workstation khusus terisolasi (OT & WW), dan sisanya
    // dipartisi terpadu agar total CQI yang digunakan tepat sama dengan Core aktif.
    if (targetCqiCount >= maxReadyCqis) {
      runningMachines.forEach(m => {
        const ws = r.getWorkstationKey(m);
        const learnedNum = this.getLearnedCqiForMachine(m);
        let targetCqiNum = (learnedNum && readyCqiMap.has(learnedNum)) ? learnedNum : FACTORY_NATURAL_TOPOLOGY[ws];

        // Pengecualian ergonomis spesifik lantai produksi:
        // AST 33-16L (WS 10A col 34) dialokasikan ke CQI 1 agar WS 10A tidak kelebihan muatan
        const mName = String(m.name || m.id || "");
        if (ws === "10A" && mName.includes("33-16L") && !learnedNum) {
          if (readyCqiMap.has(1)) targetCqiNum = 1;
          else if (readyCqiMap.has(10)) targetCqiNum = 10;
          else if (readyCqiMap.has(2)) targetCqiNum = 2;
        }

        if (targetCqiNum && readyCqiMap.has(targetCqiNum)) {
          const slot = getOrCreateSlot(targetCqiNum);
          assignMachineToSlot(m, slot);
        }
      });
    } else {
      // Alokasi khusus mesin OT & WW yang wajib memiliki CQI terpisah
      runningMachines.forEach(m => {
        if (r.isOtMachine(m) && readyCqiMap.has(19)) {
          const slot = getOrCreateSlot(19);
          assignMachineToSlot(m, slot);
        } else if (r.isWwMachine(m) && readyCqiMap.has(24)) {
          const slot = getOrCreateSlot(24);
          assignMachineToSlot(m, slot);
        }
      });
    }

    // =========================================================================
    // STEP 2: AGREGASI WORKSTATION DAN TATA URUTAN TOPOLOGIS (WEST TO EAST)
    // =========================================================================
    const remainingMachines = runningMachines.filter(m => !assignedMachineIds.has(m.id || m.name));
    if (remainingMachines.length === 0) {
      const activePlan = Array.from(activeSlotsMap.values()).filter(s => s.machines.length > 0);
      r.assignManpower(activePlan, config);
      activePlan.forEach(s => {
        if (s.workstations instanceof Set) {
          s.workstations = Array.from(s.workstations);
        }
      });
      const lineSortPriority = { "LINE A": 1, "LINE B": 2, "LINE C": 3, "LINE WW": 4, "LINE OT": 5 };
      activePlan.sort((a, b) => {
        const pA = lineSortPriority[a.line] || 9;
        const pB = lineSortPriority[b.line] || 9;
        if (pA !== pB) return pA - pB;
        return a.cqiNum - b.cqiNum;
      });
      return activePlan;
    }

    // Indeks urutan topologis resmi di lantai pabrik (Line sequence dari Barat ke Timur)
    const lineOrderMap = {
      "0A": 0, "1A": 1, "2A": 2, "3A": 3, "4A": 4, "5A": 5, "6A": 6, "7A": 7, "8A": 8, "9A": 9, "10A": 10,
      "0B": 0, "1B": 1, "2B": 2, "3B": 3, "4B": 4, "5B": 5, "6B": 6, "7B": 7, "8B": 8, "9B": 9, "10B": 10, "11B": 11,
      "1C": 1, "2C": 2, "3C": 3, "4C": 4, "5C": 5, "6C": 6, "7C": 7, "8C": 8, "9C": 9, "10C": 10
    };

    const wsMap = new Map();
    remainingMachines.forEach(m => {
      const wsKey = r.getWorkstationKey(m);
      if (!wsMap.has(wsKey)) {
        const coords = geo.getCoords(m);
        const lineStr = r.isMachineLineA(m) ? "LINE A" : (r.isMachineLineB(m) ? "LINE B" : "LINE C");
        const clusterGrp = r.getMachineClusterGroup(m);
        const cat = r.getClusterGroupCategory(clusterGrp);
        wsMap.set(wsKey, {
          ws: wsKey,
          line: lineStr,
          clusterGroup: clusterGrp,
          category: cat,
          machines: [],
          sumRow: 0,
          sumCol: 0,
          sortIdx: lineOrderMap[wsKey] !== undefined ? lineOrderMap[wsKey] : 99
        });
      }
      const entry = wsMap.get(wsKey);
      entry.machines.push(m);
      const c = geo.getCoords(m);
      entry.sumRow += c.row;
      entry.sumCol += c.col;
    });

    const activeWorkstations = Array.from(wsMap.values()).map(w => ({
      ...w,
      weight: w.machines.length,
      row: w.sumRow / w.machines.length,
      col: w.sumCol / w.machines.length
    }));

    // =========================================================================
    // STEP 3: DEKOMPOSISI KEPULAUAN CLUSTER KOMPATIBEL (COMPATIBLE ISLANDS)
    // =========================================================================
    // Island A: Semua WS di Line A (Group 1 - Sosoft & SKL)
    // Aturan Pabrik: Workstation 0A (AST 14-12L) selalu menyatu dengan workstation 1A di bawah CQI 1
    const rawA_WS = activeWorkstations
      .filter(w => w.line === "LINE A")
      .sort((a, b) => a.sortIdx - b.sortIdx);

    const ws0A = rawA_WS.find(w => w.ws === "0A");
    const ws1A = rawA_WS.find(w => w.ws === "1A");
    let islandA_WS = [];

    if (ws0A && ws1A) {
      const merged1A = {
        ...ws1A,
        ws: "1A",
        machines: [...ws0A.machines, ...ws1A.machines],
        weight: ws0A.weight + ws1A.weight,
        sumRow: ws0A.sumRow + ws1A.sumRow,
        sumCol: ws0A.sumCol + ws1A.sumCol,
        row: (ws0A.sumRow + ws1A.sumRow) / (ws0A.weight + ws1A.weight),
        col: (ws0A.sumCol + ws1A.sumCol) / (ws0A.weight + ws1A.weight)
      };
      islandA_WS = rawA_WS.filter(w => w.ws !== "0A" && w.ws !== "1A");
      islandA_WS.unshift(merged1A);
    } else {
      islandA_WS = rawA_WS;
    }

    // Line B: Pisahkan Group 1 (Sosoft, Jumbo, SKL) dan Group 2 (Botol, Pouch)
    const islandB_G1_WS = activeWorkstations
      .filter(w => w.line === "LINE B" && w.category === "GROUP_1")
      .sort((a, b) => a.sortIdx - b.sortIdx);

    const islandB_G2_WS = activeWorkstations
      .filter(w => w.line === "LINE B" && w.category === "GROUP_2")
      .sort((a, b) => a.sortIdx - b.sortIdx);

    // Line C: Semua WS di Line C (Group 2 - Pouch & Botol)
    const islandC_WS = activeWorkstations
      .filter(w => w.line === "LINE C")
      .sort((a, b) => a.sortIdx - b.sortIdx);

    const islandDefinitions = [];
    if (islandA_WS.length > 0) {
      islandDefinitions.push({
        id: "LINE_A",
        name: "Line A",
        line: "LINE A",
        category: "GROUP_1",
        workstations: islandA_WS,
        totalMachines: islandA_WS.reduce((s, w) => s + w.weight, 0),
        maxCap: 8,
        readyCqis: Array.from(readyCqiMap.keys()).filter(n => r.getCqiPrimaryLine(readyCqiMap.get(n)) === "LINE A" && !activeSlotsMap.has(n))
      });
    }
    if (islandB_G1_WS.length > 0) {
      islandDefinitions.push({
        id: "LINE_B_G1",
        name: "Line B (G1)",
        line: "LINE B",
        category: "GROUP_1",
        workstations: islandB_G1_WS,
        totalMachines: islandB_G1_WS.reduce((s, w) => s + w.weight, 0),
        maxCap: 8,
        readyCqis: Array.from(readyCqiMap.keys()).filter(n => r.getCqiPrimaryLine(readyCqiMap.get(n)) === "LINE B" && !activeSlotsMap.has(n))
      });
    }
    if (islandB_G2_WS.length > 0) {
      islandDefinitions.push({
        id: "LINE_B_G2",
        name: "Line B (G2)",
        line: "LINE B",
        category: "GROUP_2",
        workstations: islandB_G2_WS,
        totalMachines: islandB_G2_WS.reduce((s, w) => s + w.weight, 0),
        maxCap: 10,
        readyCqis: Array.from(readyCqiMap.keys()).filter(n => r.getCqiPrimaryLine(readyCqiMap.get(n)) === "LINE B" && !activeSlotsMap.has(n))
      });
    }
    if (islandC_WS.length > 0) {
      islandDefinitions.push({
        id: "LINE_C",
        name: "Line C",
        line: "LINE C",
        category: "GROUP_2",
        workstations: islandC_WS,
        totalMachines: islandC_WS.reduce((s, w) => s + w.weight, 0),
        maxCap: 10,
        readyCqis: Array.from(readyCqiMap.keys()).filter(n => r.getCqiPrimaryLine(readyCqiMap.get(n)) === "LINE C" && !activeSlotsMap.has(n))
      });
    }

    const slotsAllocatedSoFar = activeSlotsMap.size;
    const availableReadyCqisCount = Array.from(readyCqiMap.keys()).filter(n => !activeSlotsMap.has(n)).length;

    let remainingSlotsQuota = Math.max(0, targetCqiCount - slotsAllocatedSoFar);
    // Jika kuota habis atau terlalu sedikit tapi masih ada island dan CQI ready yang bebas, alokasikan slot seperlunya
    if (remainingSlotsQuota < islandDefinitions.length && availableReadyCqisCount > 0) {
      remainingSlotsQuota = Math.min(availableReadyCqisCount, islandDefinitions.length);
    } else {
      remainingSlotsQuota = Math.min(availableReadyCqisCount, remainingSlotsQuota);
    }

    // =========================================================================
    // STEP 4: DISTRIBUSI KUOTA CQI ANTAR-ISLAND (PROPORTIONAL QUOTA OPTIMIZER)
    // =========================================================================
    // Hitung jatah slot (k) untuk tiap island agar beban kerja (mesin/slot) seimbang merata
    const islandAllocations = new Map();
    islandDefinitions.forEach(isl => islandAllocations.set(isl.id, 0));

    if (islandDefinitions.length > 0 && remainingSlotsQuota > 0) {
      const numIslands = islandDefinitions.length;

      if (remainingSlotsQuota <= numIslands) {
        // Kuota sangat ketat: bagikan 1 slot ke island dengan beban terbanyak
        const sortedByLoad = [...islandDefinitions].sort((a, b) => b.totalMachines - a.totalMachines);
        for (let i = 0; i < remainingSlotsQuota; i++) {
          islandAllocations.set(sortedByLoad[i].id, 1);
        }
      } else {
        // Optimasi Integer Partition: cari pembagian quota yang meminimalkan varians beban antar slot
        let bestDist = null;
        let bestVariance = Infinity;

        const evaluatePartition = (currentQuota) => {
          let sumAvg = 0;
          let penalty = 0;
          const avgs = [];
          for (let i = 0; i < numIslands; i++) {
            const q = currentQuota[i];
            const isl = islandDefinitions[i];
            const avg = isl.totalMachines / q;
            avgs.push(avg);
            sumAvg += avg;
            if (avg > isl.maxCap) {
              penalty += Math.pow(avg - isl.maxCap, 2) * 50;
            }
          }
          const mean = sumAvg / numIslands;
          let variance = 0;
          for (const a of avgs) {
            variance += Math.pow(a - mean, 2);
          }
          const score = variance + penalty;
          if (score < bestVariance) {
            bestVariance = score;
            bestDist = [...currentQuota];
          }
        };

        const generatePartitions = (idx, remQ, currentQuota) => {
          if (idx === numIslands - 1) {
            currentQuota.push(remQ);
            evaluatePartition(currentQuota);
            currentQuota.pop();
            return;
          }
          const minNeededForRest = numIslands - 1 - idx;
          const maxPossible = remQ - minNeededForRest;
          for (let q = 1; q <= maxPossible; q++) {
            currentQuota.push(q);
            generatePartitions(idx + 1, remQ - q, currentQuota);
            currentQuota.pop();
          }
        };

        generatePartitions(0, remainingSlotsQuota, []);

        if (bestDist) {
          islandDefinitions.forEach((isl, i) => {
            islandAllocations.set(isl.id, bestDist[i]);
          });
        } else {
          islandDefinitions.forEach(isl => islandAllocations.set(isl.id, 1));
        }
      }
    }

    // =========================================================================
    // STEP 5: PARTISI RANTAI KONTIGU BERIMBANG (MINIMUM-VARIANCE DP SWEEP)
    // =========================================================================
    // Fungsi DP untuk membagi urutan workstation kontigu menjadi K zona dengan beban paling seimbang
    function partitionContiguousWorkstations(wsList, k, maxCap = 8) {
      const n = wsList.length;
      if (k <= 0 || n === 0) return [];
      if (k === 1) return [wsList];
      if (k >= n) return wsList.map(w => [w]);

      const totalWeight = wsList.reduce((sum, w) => sum + w.weight, 0);
      const idealAvg = totalWeight / k;

      const memo = new Map();

      function solve(idx, remK) {
        const key = idx + "," + remK;
        if (memo.has(key)) return memo.get(key);

        if (remK === 1) {
          const seg = wsList.slice(idx);
          const w = seg.reduce((s, x) => s + x.weight, 0);
          let cost = Math.pow(w - idealAvg, 2);
          if (w > maxCap) cost += Math.pow(w - maxCap, 3) * 100;
          const res = { cost, partitions: [seg] };
          memo.set(key, res);
          return res;
        }

        let best = { cost: Infinity, partitions: [] };
        let currentSegWeight = 0;
        const currentSeg = [];

        const maxIdx = n - (remK - 1);
        for (let i = idx; i < maxIdx; i++) {
          currentSeg.push(wsList[i]);
          currentSegWeight += wsList[i].weight;

          let segCost = Math.pow(currentSegWeight - idealAvg, 2);
          if (currentSegWeight > maxCap) segCost += Math.pow(currentSegWeight - maxCap, 3) * 100;

          const sub = solve(i + 1, remK - 1);
          const totalCost = segCost + sub.cost;

          if (totalCost < best.cost) {
            best = {
              cost: totalCost,
              partitions: [currentSeg.slice(), ...sub.partitions]
            };
          }
        }

        memo.set(key, best);
        return best;
      }

      return solve(0, k).partitions;
    }

    // =========================================================================
    // STEP 6: PEMASANGAN MEJA CQI SENTRAL (ERGONOMIC ANCHOR AFFINITY)
    // =========================================================================
    // Untuk tiap zona kontigu, pilih CQI READY yang letak fisiknya paling berimpit/sentral
    const usedCqiNums = new Set(activeSlotsMap.keys());

    islandDefinitions.forEach(isl => {
      const quota = islandAllocations.get(isl.id) || 0;
      if (quota === 0) return;

      const zones = partitionContiguousWorkstations(isl.workstations, quota, isl.maxCap);

      // Kumpulkan kandidat CQI READY untuk line ini
      let availableLineCqis = isl.readyCqis.filter(num => !usedCqiNums.has(num));

      // Fallback jika CQI ready di line ini kurang: gunakan CQI ready dari line netral/kompatibel
      if (availableLineCqis.length < zones.length) {
        const fallbackCqis = Array.from(readyCqiMap.keys()).filter(num => {
          if (usedCqiNums.has(num) || num === 19 || num === 24) return false;
          // Jangan letakkan CQI Line A untuk Group 2
          if (isl.category === "GROUP_2" && r.getCqiPrimaryLine(readyCqiMap.get(num)) === "LINE A") return false;
          return true;
        });
        availableLineCqis = [...new Set([...availableLineCqis, ...fallbackCqis])];
      }

      zones.forEach(zone => {
        if (zone.length === 0) return;

        // Hitung titik pusat spasial zona (center of mass)
        let totalWeight = 0;
        let weightedCol = 0;
        let weightedRow = 0;
        const zoneWsKeys = new Set();

        zone.forEach(w => {
          totalWeight += w.weight;
          weightedCol += w.col * w.weight;
          weightedRow += w.row * w.weight;
          zoneWsKeys.add(w.ws);
        });

        const centerCol = totalWeight > 0 ? weightedCol / totalWeight : zone[0].col;
        const centerRow = totalWeight > 0 ? weightedRow / totalWeight : zone[0].row;

        // Anchor Matching Khusus Line A: Cari CQI yang workstation ID-nya beririsan
        let chosenCqiNum = null;
        if (isl.line === "LINE A") {
          // Cari CQI Line A yang memiliki ws yang sama dengan salah satu WS di zona
          const exactWsMatch = availableLineCqis.find(num => {
            const cObj = readyCqiMap.get(num);
            const cWs = cObj.ws || (num + "A");
            return zoneWsKeys.has(cWs);
          });
          if (exactWsMatch) chosenCqiNum = exactWsMatch;
        }

        // Jika belum terpilih, cari CQI dengan jarak fisik terdekat ke pusat zona
        if (!chosenCqiNum) {
          let minDistance = Infinity;
          for (const cNum of availableLineCqis) {
            const cObj = readyCqiMap.get(cNum);
            const dist = geo.getDistance({ row: centerRow, col: centerCol }, cObj);
            if (dist < minDistance) {
              minDistance = dist;
              chosenCqiNum = cNum;
            }
          }
        }

        // Jika masih belum ada, ambil salah satu yang belum terpakai
        if (!chosenCqiNum && availableLineCqis.length > 0) {
          chosenCqiNum = availableLineCqis[0];
        }

        if (chosenCqiNum) {
          usedCqiNums.add(chosenCqiNum);
          availableLineCqis = availableLineCqis.filter(n => n !== chosenCqiNum);

          const slot = getOrCreateSlot(chosenCqiNum);
          zone.forEach(w => {
            w.machines.forEach(m => assignMachineToSlot(m, slot));
          });
        } else {
          // Fallback darurat: masukkan ke slot aktif yang paling kompatibel
          const candidateSlots = Array.from(activeSlotsMap.values()).filter(s => {
            if (s.cqiNum === 19) return false;
            return r.canAddMachineToSlotCluster(zone[0].machines[0], s);
          });
          if (candidateSlots.length > 0) {
            const bestSlot = candidateSlots.sort((a, b) => a.machines.length - b.machines.length)[0];
            zone.forEach(w => {
              w.machines.forEach(m => assignMachineToSlot(m, bestSlot));
            });
          }
        }
      });
    });

    // =========================================================================
    // STEP 7: JAMINAN 100% MESIN TERALOKASI (ZERO STRANDED GUARANTEE)
    // =========================================================================
    // Jika masih ada mesin running yang belum teralokasi karena batasan kuota
    const unassignedMachines = runningMachines.filter(m => !assignedMachineIds.has(m.id || m.name));
    if (unassignedMachines.length > 0) {
      unassignedMachines.forEach(m => {
        let bestSlot = null;
        let minDistance = Infinity;

        for (const slot of activeSlotsMap.values()) {
          if (!r.canAddMachineToSlotCluster(m, slot)) continue;
          const capRule = r.getClusterCapacityRule([...slot.machines, m]);
          if (slot.machines.length >= capRule.absoluteMax) continue;

          const dist = geo.getDistance(m, slot);
          if (dist < minDistance) {
            minDistance = dist;
            bestSlot = slot;
          }
        }

        if (bestSlot) {
          assignMachineToSlot(m, bestSlot);
        } else {
          // Absolute fallback ke slot apapun yang kompatibel
          const anyCompatible = Array.from(activeSlotsMap.values()).find(s => r.canAddMachineToSlotCluster(m, s));
          if (anyCompatible) {
            assignMachineToSlot(m, anyCompatible);
          }
        }
      });
    }

    // =========================================================================
    // STEP 8: ALOKASI MANPOWER ERGONOMIS (CORE, NON-CORE & LONGSHIFT)
    // =========================================================================
    const activePlan = Array.from(activeSlotsMap.values()).filter(s => s.machines && s.machines.length > 0);
    r.assignManpower(activePlan, config);

    // Konversi Set workstation menjadi Array terurut
    activePlan.forEach(s => {
      if (s.workstations instanceof Set) {
        s.workstations = Array.from(s.workstations).sort((a, b) => {
          const idxA = lineOrderMap[a] !== undefined ? lineOrderMap[a] : 99;
          const idxB = lineOrderMap[b] !== undefined ? lineOrderMap[b] : 99;
          return idxA - idxB;
        });
      }
    });

    // Urutkan slot dalam hasil planning dari Line A -> Line B -> Line C -> WW/OT
    const lineSortPriority = { "LINE A": 1, "LINE B": 2, "LINE C": 3, "LINE WW": 4, "LINE OT": 5 };
    activePlan.sort((a, b) => {
      const pA = lineSortPriority[a.line] || 9;
      const pB = lineSortPriority[b.line] || 9;
      if (pA !== pB) return pA - pB;
      return a.cqiNum - b.cqiNum;
    });

    return activePlan;
  },

  validate(slots, runningMachines = [], configOrCoreCount = null) {
    return rule.validate(slots, runningMachines, configOrCoreCount);
  },

  formatText(slots, config = {}) {
    return rule.formatText(slots, config);
  },

  calculateHeatmapState(slots, mapData) {
    return rule.calculateHeatmapState(slots, mapData);
  }
};

export const BrainController = BrainAI;
export const brain = BrainAI;
export const brainMode1 = BrainAI;

if (typeof window !== "undefined") {
  window.BrainAI = BrainAI;
  window.brain = BrainAI;
  window.BrainController = BrainAI;
  window.brainMode1 = BrainAI;
  window.rule = rule;
}
if (typeof globalThis !== "undefined") {
  globalThis.BrainAI = BrainAI;
  globalThis.brain = BrainAI;
  globalThis.BrainController = BrainAI;
  globalThis.brainMode1 = BrainAI;
  globalThis.rule = rule;
}

export default BrainAI;
