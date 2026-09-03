export default {
  // ==========================================================================
  // 5. MODUL PERSISTENSI & PEMBELAJARAN DATA HISTORY (AI LEARNING ENGINE)
  // ==========================================================================

  _historyRecords: [],
  _historyAffinityMap: {},

  /**
   * Parser Universal: Mengonversi format history JSON apapun menjadi pasangan machine-CQI terstandar
   * Mendukung: GitHub export planning-*.json, legacy 01-01-2026.json, learning_data.json, atau array slot
   * @param {Object|Array} rawData - Data JSON mentah
   * @returns {Array} Array of { machineId, machineName, cqiId, cqiName, cqiNum, timestamp }
   */
  parseHistoryData(rawData) {
    if (!rawData) return [];
    const pairs = [];

    // Kasus 1: Array of pairs langsung
    if (Array.isArray(rawData)) {
      rawData.forEach((item) => {
        if (!item) return;
        // Format pair { machineId, cqiId }
        if (item.machineId || item.machine || item.m) {
          const mName = item.machineName || item.machine || item.machineId || item.m;
          const cqi = item.cqiName || item.cqi || item.cqiId || item.c;
          pairs.push({
            machineId: item.machineId || mName,
            machineName: mName,
            cqiId: item.cqiId || cqi,
            cqiName: cqi,
            cqiNum: String(this.getCqiNumber(cqi) || "").trim(),
            timestamp: item.timestamp || item.date || new Date().toISOString(),
          });
        } else if (item.cqi && item.machines) {
          // Format slot array
          const cqiName = item.cqi.name || item.cqi.id || item.cqi;
          const cqiNum = String(this.getCqiNumber(cqiName) || "").trim();
          (item.machines || []).forEach((m) => {
            const mName = typeof m === "object" ? m.name || m.id : String(m);
            pairs.push({
              machineId: typeof m === "object" ? m.id || mName : mName,
              machineName: mName,
              cqiId: typeof item.cqi === "object" ? item.cqi.id || cqiName : cqiName,
              cqiName: cqiName,
              cqiNum: cqiNum,
              timestamp: item.timestamp || new Date().toISOString(),
            });
          });
        }
      });
      return pairs;
    }

    // Kasus 2: Objek dengan property .pairs
    if (Array.isArray(rawData.pairs) && rawData.pairs.length > 0) {
      return this.parseHistoryData(rawData.pairs);
    }

    // Kasus 3: Objek dengan property .planning (Standard GitHub Export)
    if (Array.isArray(rawData.planning) && rawData.planning.length > 0) {
      rawData.planning.forEach((slot) => {
        const cqiName = slot.cqi || slot.nama || "CQI";
        const cqiNum = String(this.getCqiNumber(cqiName) || "").trim();
        (slot.machines || []).forEach((m) => {
          const mName = typeof m === "object" ? m.name || m.id : String(m);
          pairs.push({
            machineId: typeof m === "object" ? m.id || mName : mName,
            machineName: mName,
            cqiId: cqiName,
            cqiName: cqiName,
            cqiNum: cqiNum,
            timestamp: rawData.meta ? rawData.meta.date_iso || rawData.meta.date : new Date().toISOString(),
          });
        });
      });
      return pairs;
    }

    // Kasus 4: Objek dengan property .planning_history (Legacy Format)
    if (Array.isArray(rawData.planning_history) && rawData.planning_history.length > 0) {
      rawData.planning_history.forEach((session) => {
        (session.cqi || []).forEach((cqiBlock) => {
          const cqiName = cqiBlock.nama || cqiBlock.name || "CQI";
          const cqiNum = String(this.getCqiNumber(cqiName) || "").trim();
          (cqiBlock.mesin || []).forEach((m) => {
            const mName = typeof m === "object" ? m.name || m.id : String(m);
            pairs.push({
              machineId: typeof m === "object" ? m.id || mName : mName,
              machineName: mName,
              cqiId: cqiName,
              cqiName: cqiName,
              cqiNum: cqiNum,
              timestamp: session.tanggal || new Date().toISOString(),
            });
          });
        });
      });
      return pairs;
    }

    // Kasus 5: Objek dictionary sederhana { "CQI 1": ["1A1", "1A2"], "CQI 2": ["3A1"] }
    if (typeof rawData === "object" && rawData !== null && !Array.isArray(rawData)) {
      Object.keys(rawData).forEach((key) => {
        if (["meta", "planning", "planning_history", "pairs"].includes(key)) return;
        const val = rawData[key];
        if (Array.isArray(val)) {
          const cqiName = String(key).toUpperCase().includes("CQI") ? String(key) : `CQI ${key}`;
          const cqiNum = String(this.getCqiNumber(cqiName) || "").trim();
          val.forEach((m) => {
            const mName = typeof m === "object" ? m.name || m.id : String(m);
            pairs.push({
              machineId: mName,
              machineName: mName,
              cqiId: cqiName,
              cqiName: cqiName,
              cqiNum: cqiNum,
              timestamp: new Date().toISOString(),
            });
          });
        }
      });
    }

    return pairs;
  },

  /**
   * Inisialisasi memori AI dari koleksi pasangan history
   * Membangun fast lookup Map untuk O(1) evaluasi skor afinitas
   * @param {Array} records - Array of pairs
   * @param {boolean} persistToLocalStorage - Apakah disimpan ke local storage
   */
  initHistoryMemory(records, persistToLocalStorage = false) {
    if (!Array.isArray(records)) return;
    this._historyRecords = records;
    this._historyAffinityMap = {};

    records.forEach((r) => {
      const mName = this.normalizeName(r.machineName || r.machineId || r.name);
      const cqiNum = String(this.getCqiNumber(r.cqiNum || r.cqiName || r.cqiId) || "").trim();
      if (!mName || !cqiNum) return;

      if (!this._historyAffinityMap[mName]) {
        this._historyAffinityMap[mName] = {};
      }
      this._historyAffinityMap[mName][cqiNum] = (this._historyAffinityMap[mName][cqiNum] || 0) + 1;
    });

    if (persistToLocalStorage && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("planning_history", JSON.stringify(records));
      } catch (e) {
        console.warn("Gagal menyimpan history ke localStorage:", e);
      }
    }
  },

  /**
   * Memuat semua data history yang tersedia dari Server API, File Static, atau LocalStorage
   * @param {Object} [customData] - Data riwayat opsional untuk langsung dimuat
   */
  async loadAllHistory(customData = null) {
    if (customData) {
      const parsed = this.parseHistoryData(customData);
      this.initHistoryMemory(parsed, true);
      return parsed;
    }

    let allPairs = [];

    // 1. Coba ambil dari Server Backend /api/history jika tersedia
    if (typeof fetch !== "undefined") {
      try {
        const resp = await fetch("/api/history");
        if (resp.ok) {
          const json = await resp.json();
          if (json && json.learningData && Array.isArray(json.learningData)) {
            const parsed = this.parseHistoryData(json.learningData);
            allPairs.push(...parsed);
          }
        }
      } catch (e) {
        // Abaikan jika tidak di backend
      }
    }

    // 2. Jika masih kosong, coba fetch learning_data.json statis
    if (allPairs.length === 0 && typeof fetch !== "undefined") {
      try {
        const resp = await fetch("history/learning_data.json");
        if (resp.ok) {
          const json = await resp.json();
          const parsed = this.parseHistoryData(json);
          allPairs.push(...parsed);
        }
      } catch (e) {}
    }

    // 3. Gabungkan dengan localStorage
    if (typeof localStorage !== "undefined") {
      try {
        const raw = localStorage.getItem("planning_history");
        if (raw) {
          const parsedLocal = this.parseHistoryData(JSON.parse(raw));
          allPairs.push(...parsedLocal);
        }
      } catch (e) {}
    }

    // Deduplikasi
    const seen = new Set();
    const uniquePairs = allPairs.filter((p) => {
      const key = `${p.machineId}_${p.cqiNum}_${p.timestamp}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    this.initHistoryMemory(uniquePairs, true);
    return uniquePairs;
  },

  /**
   * Mengembalikan ringkasan statistik pembelajaran AI
   */
  getHistoryStats() {
    const totalRecords = this._historyRecords ? this._historyRecords.length : 0;
    const machinesCount = Object.keys(this._historyAffinityMap || {}).length;
    
    // Hitung top afinitas
    const topAffinities = [];
    Object.entries(this._historyAffinityMap || {}).forEach(([mName, cqiMap]) => {
      Object.entries(cqiMap).forEach(([cqiNum, count]) => {
        topAffinities.push({
          machine: mName,
          cqi: `CQI ${cqiNum}`,
          cqiNum,
          frequency: count,
          bonus: Math.min(count * 10, 30),
        });
      });
    });

    topAffinities.sort((a, b) => b.frequency - a.frequency);

    return {
      totalRecords,
      uniqueMachines: machinesCount,
      topAffinities: topAffinities.slice(0, 20),
    };
  },

  /**
   * Mencatat log riwayat alokasi ke local storage dan memori AI aktif
   * @param {string} machineId - ID Mesin
   * @param {string} cqiId - ID CQI
   */
  recordHistory(machineId, cqiId) {
    try {
      const mName = this.normalizeName(machineId);
      const cqiNum = String(this.getCqiNumber(cqiId) || "").trim();
      const newRecord = {
        machineId,
        machineName: machineId,
        cqiId,
        cqiName: cqiId,
        cqiNum,
        timestamp: new Date().toISOString(),
      };

      if (!this._historyRecords) this._historyRecords = [];
      this._historyRecords.push(newRecord);
      if (this._historyRecords.length > 2000) this._historyRecords.shift();

      if (!this._historyAffinityMap) this._historyAffinityMap = {};
      if (!this._historyAffinityMap[mName]) this._historyAffinityMap[mName] = {};
      this._historyAffinityMap[mName][cqiNum] = (this._historyAffinityMap[mName][cqiNum] || 0) + 1;

      if (typeof localStorage !== "undefined") {
        localStorage.setItem("planning_history", JSON.stringify(this._historyRecords));
      }
    } catch (e) {
      console.warn("Gagal mencatat history alokasi:", e);
    }
  },

};
