export default {
  // ==========================================================================
  // 1. MODUL UTILITY & NORMALISASI DATA
  // ==========================================================================

  /**
   * Mensejajarkan format string nama mesin, CQI, atau personel untuk mencegah mismatch
   * @param {string} name - Nama input mentah
   * @returns {string} String yang sudah dibersihkan (Uppercase, tanpa spasi/simbol)
   */
  normalizeName(name) {
    if (!name) return "";
    return String(name)
      .trim()
      .toUpperCase()
      .replace(/[\s\-_]+/g, "");
  },

  /**
   * Peta Prioritas CQI ke Workstation (CQI Priority Map)
   * Menyediakan rekomendasi workstation prioritas untuk meminimalkan cross-line walking
   * - Line A: Hanya 2 workstation terdekat per CQI
   * - Line B: Disesuaikan 2 atau 3 workstation terdekat per CQI
   */
  CQI_PRIORITY_MAP: {
    // Line A (Workstation utama dan tetangga terdekat kiri/kanan)
    "cqi 1": ["1A", "0A", "2A"],
    "cqi 2": ["2A", "1A", "3A", "0A"],
    "cqi 3": ["3A", "2A", "4A", "1A", "5A"],
    "cqi 4": ["4A", "3A", "5A", "2A", "6A"],
    "cqi 5": ["5A", "4A", "6A", "3A", "7A"],
    "cqi 6": ["6A", "5A", "7A", "4A", "8A"],
    "cqi 7": ["7A", "6A", "8A", "5A", "9A"],
    "cqi 8": ["8A", "7A", "9A", "6A", "10A"],
    "cqi 9": ["9A", "8A", "10A", "7A"],
    "cqi 10": ["10A", "9A", "8A", "7A"],

    // Line B (Workstation utama dan tetangga terdekat)
    "cqi 11": ["1B", "0B", "2B", "3B"],
    "cqi 13": ["2B", "3B", "1B", "4B", "0B"],
    "cqi 21": ["4B", "3B", "5B", "0B", "2B", "1B"],
    "cqi 14": ["5B", "6B", "4B", "7B", "3B"],
    "cqi 22": ["5B", "6B", "4B", "7B", "3B"],
    "cqi 23": ["6B", "5B", "7B", "4B", "8B"],
    "cqi 15": ["7B", "8B", "6B", "9B", "5B"],
    "cqi 25": ["7B", "8B", "6B", "9B", "5B"],
    "cqi 16": ["8B", "9B", "7B", "10B", "6B"],
    "cqi 17": ["10B", "11B", "9B", "8B"],
    "cqi 12": ["10B", "11B", "9B", "8B"],
    "cqi 19": ["OT"],
    "cqi 24": ["WW", "1C", "2C"],

    // Line C (Workstation terdekat)
    "cqi 18": ["3C", "2C", "1C", "4C", "5C"],
    "cqi 20": ["10C", "9C", "8C", "7C", "6C", "5C", "4C"],
  },

  /**
   * Peta Prioritas Cluster Per CQI (CQI Cluster Priority Map)
   * Menyediakan rekomendasi cluster/kemasan produk untuk setiap CQI
   */
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
    "cqi 14": ["Pouch", "Botol"],
    "cqi 15": ["12Ljumbo", "Pouch"],
    "cqi 16": ["Pouch", "12Ljumbo"],
    "cqi 17": ["Botol", "Pouch"],
    "cqi 18": ["Pouch"],
    "cqi 19": ["OT"],
    "cqi 20": ["Pouch", "Botol"],
    "cqi 21": ["Pouch", "Botol"],
    "cqi 22": ["12Ljumbo"],
    "cqi 23": ["12Ljumbo"],
    "cqi 24": ["WW", "Pouch"],
    "cqi 25": ["12Ljumbo", "SKLsct"],
  },

  /**
   * Cek apakah relasi workstation dan CQI terlalu jauh secara fisik di denah pabrik
   * @param {string} wsKey - Kode workstation (misal: '10B', '9B')
   * @param {string} cqiNum - Nomor CQI (misal: '13', '11')
   * @returns {boolean}
   */
  isFarWorkstationForCqi(wsKey, cqiNum) {
    const ws = String(wsKey || "").trim().toUpperCase();
    const num = String(cqiNum || "").trim();

    // 8B, 9B, 10B, 11B ke CQI 11, 13, 21 terlalu jauh (ujung timur ke ujung barat Line B)
    if (
      (ws === "8B" || ws === "9B" || ws === "10B" || ws === "11B") &&
      (num === "11" || num === "13" || num === "21")
    ) {
      return true;
    }

    // 0B, 1B, 2B, 3B ke CQI 15, 16, 17, 25, 12 terlalu jauh (ujung barat ke ujung timur Line B)
    if (
      (ws === "0B" || ws === "1B" || ws === "2B" || ws === "3B") &&
      (num === "15" || num === "16" || num === "17" || num === "25" || num === "12")
    ) {
      return true;
    }

    // 7A, 8A, 9A, 10A ke CQI 1, 2, 3 terlalu jauh (ujung timur ke ujung barat Line A)
    if (
      (ws === "7A" || ws === "8A" || ws === "9A" || ws === "10A") &&
      (num === "1" || num === "2" || num === "3")
    ) {
      return true;
    }

    // 0A, 1A, 2A, 3A ke CQI 8, 9, 10 terlalu jauh (ujung barat ke ujung timur Line A)
    if (
      (ws === "0A" || ws === "1A" || ws === "2A" || ws === "3A") &&
      (num === "8" || num === "9" || num === "10")
    ) {
      return true;
    }

    // 0A, 1A, 2A ke CQI 6, 7 juga terlalu jauh
    if ((ws === "0A" || ws === "1A" || ws === "2A") && (num === "6" || num === "7")) {
      return true;
    }

    // 10A ke CQI 6, 7 juga terlalu jauh (melompati 8A dan 9A)
    if (ws === "10A" && (num === "6" || num === "7")) {
      return true;
    }

    // 0A, 8A, 9A, 10A ke CQI 4, 5 juga terlalu jauh
    if ((ws === "0A" || ws === "8A" || ws === "9A" || ws === "10A") && (num === "4" || num === "5")) {
      return true;
    }

    return false;
  },

  /**
   * Menghitung jarak logis/lorong antara dua workstation
   * Contoh: 7A dan 8A -> 1 lorong (tetangga langsung)
   * Contoh: 7A dan 9A -> 2 lorong (melompati 8A)
   * @param {string} wsA - Workstation A (misal "7A")
   * @param {string} wsB - Workstation B (misal "8A" atau "9A")
   * @returns {number} Selisih nomor workstation jika line sama, atau 999 jika line beda
   */
  getWorkstationDistance(wsA, wsB) {
    if (!wsA || !wsB) return 999;
    const a = String(wsA).trim().toUpperCase();
    const b = String(wsB).trim().toUpperCase();
    if (a === b) return 0;

    const lineA = a.replace(/\d+/g, "");
    const lineB = b.replace(/\d+/g, "");
    if (lineA !== lineB) return 999;

    const numA = parseInt(a.replace(/\D/g, ""), 10);
    const numB = parseInt(b.replace(/\D/g, ""), 10);
    if (isNaN(numA) || isNaN(numB)) return 999;

    return Math.abs(numA - numB);
  },

  /**
   * Mengambil nama line utama (LINE A, LINE B, LINE C, OT, WW) dari sebuah CQI berdasarkan CQI_PRIORITY_MAP
   * @param {Object|string} cqi - Objek CQI atau ID
   * @returns {string} 'LINE A', 'LINE B', 'LINE C', 'OT', 'WW', atau 'OTHER'
   */
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

  /**
   * Mengambil nama line utama (LINE A, LINE B, LINE C, OT, WW) dari sebuah mesin
   * @param {Object} m - Objek Mesin
   * @param {Array} labels - Label map
   * @returns {string} 'LINE A', 'LINE B', 'LINE C', 'OT', 'WW', atau 'OTHER'
   */
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

  /**
   * Menghitung nilai skor bonus kesesuaian prioritas workstation & mesin untuk CQI tertentu
   * @param {Object} m - Objek Mesin
   * @param {Object|string} cqi - Objek CQI atau nomor CQI
   * @param {Array} labels - Label map
   * @returns {number} Nilai bonus prioritas
   */
  getCqiPriorityBonus(m, cqi, labels = []) {
    if (!m || !cqi) return 0;
    const cqiNum = this.getCqiNumber(cqi);
    const key = `cqi ${cqiNum}`;
    const wsList = this.CQI_PRIORITY_MAP[key] || [];

    const mWs = this.getWorkstationKey(m, labels).toUpperCase();
    const mName = this.normalizeName(m.name || m.id);

    let bonus = 0;

    // 1. Cek di CQI_PRIORITY_MAP
    if (wsList.length > 0) {
      const idx = wsList.findIndex((ws) => ws.toUpperCase() === mWs);
      if (idx === 0) {
        bonus += 160; // Workstation utama/anchor
      } else if (idx === 1 || idx === 2) {
        bonus += 100; // Workstation tetangga langsung kiri/kanan
      } else if (idx === 3 || idx === 4) {
        bonus += 40; // Workstation lapis kedua
      } else if (idx > 4) {
        bonus += 15;
      }
    }

    // 2. Cek di CQI_CLUSTER_PRIORITY_MAP atau cqi.priority dari map.json
    const clusterPrioMapList = this.CQI_CLUSTER_PRIORITY_MAP["cqi " + cqiNum] || [];
    const mapJsonPrioList = typeof cqi === "object" && Array.isArray(cqi.priority) ? cqi.priority : [];
    const prioList = [...clusterPrioMapList, ...mapJsonPrioList].map((p) => this.normalizeName(p));

    if (prioList.length > 0) {
      const mCluster = this.normalizeName(m.cluster || "");
      const mClusterGroup = this.normalizeName(this.getMachineClusterGroup(m));
      if (
        prioList.includes(mName) ||
        prioList.includes(this.normalizeName(mWs)) ||
        (mCluster && prioList.includes(mCluster)) ||
        (mClusterGroup && prioList.includes(mClusterGroup))
      ) {
        bonus += 30;
      }
    }

    return bonus;
  },

  /**
   * Mengambil angka identifikasi dari CQI (misal: "CQI-24", "CQI 24", "24" -> "24")
   * @param {Object|string} cqi - Objek CQI atau string nama/id
   * @returns {string} Angka ID CQI
   */
  getCqiNumber(cqi) {
    if (!cqi) return "";
    const str =
      typeof cqi === "object" ? cqi.name || cqi.id || "" : String(cqi);
    const match = str.match(/\d+/);
    return match ? match[0] : str.trim().toUpperCase();
  },

  /**
   * Mengidentifikasi kelompok cluster mesin secara terstandarisasi
   * Output: 'WW', 'OT', 'SOSOFT', 'SKLSCT', '12LJUMBO', 'POUCH', 'BOTOL', atau 'LAINNYA'
   * @param {Object} m - Objek Mesin
   * @returns {string}
   */
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

  /**
   * Mengambil daftar kelompok cluster standar yang diizinkan untuk suatu CQI berdasarkan CQI_CLUSTER_PRIORITY_MAP
   * @param {string|Object} cqi - Nomor CQI atau objek CQI
   * @returns {string[]} Array kelompok cluster (Uppercase: 'SOSOFT', 'SKLSCT', '12LJUMBO', 'POUCH', 'BOTOL', 'WW', 'OT')
   */
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
      else if (norm.includes("BOTOL") || norm.includes("BTL"))
        allowed.add("BOTOL");
      else if (norm.includes("WW")) allowed.add("WW");
      else if (norm.includes("OT")) allowed.add("OT");
      else if (norm) allowed.add(norm);
    });

    return Array.from(allowed);
  },

  /**
   * Cek apakah dua cluster diperbolehkan dicampur di 1 CQI berdasarkan aturan:
   * 1. (sosoft, sklsct, 12ljumbo) -> Boleh dicampur.
   * 2. (pouch, botol) -> Boleh dicampur.
   * 3. Semua CQI Line B boleh mencampur cluster, namun harus sesuai cqi cluster map di utils.js.
   * 4. CQI 10 -> Khusus boleh mencampur (sklsct, pouch line C dan 8B) atau sesuai CQI_CLUSTER_PRIORITY_MAP.
   * 5. CQI 24 -> Khusus boleh mencampur (WW, pouch).
   * 6. Cluster lain tidak boleh dicampur.
   *
   * @param {string} clusterA - Cluster mesin A
   * @param {string} clusterB - Cluster mesin B
   * @param {string} cqiNumber - Nomor CQI (misal: '10', '15', '16', '24', '25', '26', dll.)
   * @param {Object} machineA - Objek mesin A (opsional untuk verifikasi line/ws)
   * @param {Object} machineB - Objek mesin B (opsional untuk verifikasi line/ws)
   * @returns {boolean}
   */
  isClusterMixingAllowed(
    clusterA,
    clusterB,
    cqiNumber = "",
    machineA = null,
    machineB = null,
  ) {
    if (!clusterA || !clusterB || clusterA === clusterB) return true;

    const normA = String(clusterA).toUpperCase().trim();
    const normB = String(clusterB).toUpperCase().trim();
    const cqiNumStr = String(cqiNumber || "").trim();

    const group1 = ["SOSOFT", "SKLSCT", "12LJUMBO"];
    const group2 = ["POUCH", "BOTOL"];

    // Aturan 1: sosoft, sklsct, 12ljumbo boleh dicampur secara umum
    if (group1.includes(normA) && group1.includes(normB)) {
      return true;
    }

    // Aturan 2: pouch, botol boleh dicampur secara umum
    if (group2.includes(normA) && group2.includes(normB)) {
      return true;
    }

    // Aturan 3: Semua CQI Line B (dan CQI yang terdaftar di map) boleh mencampur cluster jika kedua cluster sesuai CQI_CLUSTER_PRIORITY_MAP
    if (cqiNumStr) {
      const allowedClusters = this.getAllowedClustersForCqi(cqiNumStr);
      if (
        allowedClusters.length > 0 &&
        allowedClusters.includes(normA) &&
        allowedClusters.includes(normB)
      ) {
        return true;
      }
    }

    // Aturan Note: Cluster Botol di line B, boleh di gabung dengan cluster 12Ljumbo dan SKLsct
    const isBotolAndLineBMix =
      (normA === "BOTOL" && (normB === "12LJUMBO" || normB === "SKLSCT")) ||
      (normB === "BOTOL" && (normA === "12LJUMBO" || normA === "SKLSCT"));
    if (isBotolAndLineBMix) {
      const botolM = normA === "BOTOL" ? machineA : machineB;
      const otherM = normA === "BOTOL" ? machineB : machineA;
      const isBotolLineB = botolM ? this.getMachineLine(botolM) === "LINE B" : true;
      const isCqiLineB = cqiNumStr ? this.getCqiPrimaryLine(cqiNumStr) === "LINE B" : false;
      if (isBotolLineB || isCqiLineB) {
        return true;
      }
    }

    // Aturan 4: CQI 10 khusus boleh mencampur Cluster SKLsct + Pouch
    if (cqiNumStr === "10") {
      const isSklAndPouch =
        (normA === "SKLSCT" && normB === "POUCH") ||
        (normA === "POUCH" && normB === "SKLSCT");
      if (isSklAndPouch) {
        return true;
      }
      const is12LAndPouch =
        (normA === "12LJUMBO" && normB === "POUCH") ||
        (normA === "POUCH" && normB === "12LJUMBO");
      if (is12LAndPouch) {
        return true;
      }
    }

    // Aturan 5: CQI 24 khusus boleh mencampur (WW, pouch)
    if (cqiNumStr === "24") {
      const allowedPair = ["WW", "POUCH"];
      if (allowedPair.includes(normA) && allowedPair.includes(normB)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Cek apakah mesin merupakan kategori Pouch dari Line C atau Workstation 8B
   * @param {Object} m - Objek Mesin
   * @returns {boolean}
   */
  isPouchLineCAnd8B(m) {
    if (!m || !this.isPouchMachine(m)) return false;
    const line = String(m.line || "").toUpperCase();
    const ws = String(m.workstation || m.ws || "").toUpperCase();
    return (
      line.includes("LINE C") ||
      line === "C" ||
      ws.includes("C") ||
      ws === "8B" ||
      ws.includes("8B")
    );
  },

  /**
   * Cek apakah sebuah mesin dapat dimasukkan ke CQI tanpa melanggar aturan mixing cluster
   * @param {Object} m - Objek Mesin
   * @param {Object} slot - Objek Slot CQI
   * @returns {boolean}
   */
  canAddMachineToSlotCluster(m, slot) {
    const cqiNum = String(slot.cqiNum || this.getCqiNumber(slot.cqi));
    const isOt = this.isOtMachine(m);

    // ATURAN MUTLAK: Mesin M2 & M3 (OT) TIDAK BISA dicek oleh CQI lain, HARUS CQI 19.
    // CQI 19 HANYA BOLEH MENGECEK MESIN OT (Dilarang keras mengecek Line A, Line B, Line C, ataupun WW).
    if (isOt && cqiNum !== "19") return false;
    if (!isOt && cqiNum === "19") return false;
    if (cqiNum === "19") {
      const line = String(m.line || "").toUpperCase();
      const ws = String(m.workstation || m.ws || "").toUpperCase();
      if (
        line.includes("LINE A") ||
        line.includes("LINE B") ||
        line.includes("LINE C") ||
        line.includes("WW") ||
        ws.endsWith("A") ||
        ws.endsWith("B") ||
        ws.endsWith("C") ||
        ws === "WW"
      ) {
        return false;
      }
      return isOt;
    }

    // CQI 24: Khusus WW & Mesin APK Line C
    // ATURAN MUTLAK: Mesin Line A dan Line B TIDAK BOLEH masuk ke CQI 24, hanya mesin APK Line C saja yang diperbolehkan.
    const isWw = this.isWwMachine(m);
    if (isWw && cqiNum !== "24") return false;
    if (cqiNum === "24") {
      if (isWw) return true;
      const isLineC = this.isMachineLineC(m);
      const isApk =
        this.isPouchMachine(m) ||
        String(m.name || m.id || "")
          .toUpperCase()
          .startsWith("APK");
      const line = String(m.line || "").toUpperCase();
      const ws = String(m.workstation || m.ws || "").toUpperCase();
      const isLineAOrB =
        line.includes("LINE A") ||
        line.includes("LINE B") ||
        line === "A" ||
        line === "B" ||
        ws.endsWith("A") ||
        ws.endsWith("B");

      if (isLineAOrB || !isLineC || !isApk) {
        return false;
      }

      // Validasi jumlah mesin pouch di CQI 24:
      // - jika running 2 WW: maks 5 mesin pouch (dengan 1 NC/LS)
      // - jika running 1 WW: maks 6 mesin pouch (dengan 1 NC/LS)
      const wwInSlot = (slot.machines || []).filter((sm) => this.isWwMachine(sm)).length;
      const nonWwInSlot = (slot.machines || []).filter((sm) => !this.isWwMachine(sm));
      const maxPouchFor24 = wwInSlot >= 2 ? 5 : 6;
      if (nonWwInSlot.length >= maxPouchFor24) return false;
      const mWs = this.getWorkstationKey(m).toUpperCase();
      const existingWs = new Set(
        nonWwInSlot.map((sm) => this.getWorkstationKey(sm).toUpperCase()),
      );
      if (!existingWs.has(mWs) && existingWs.size >= 2) {
        return false; // Maksimal 2 workstation di CQI 24
      }
    }

    // CQI 15: Jika menerima mesin Line C, dibatasi hanya untuk workstation 1C atau 2C
    if (cqiNum === "15" && this.isMachineLineC(m)) {
      const ws = this.getWorkstationKey(m).toUpperCase();
      if (ws !== "1C" && ws !== "2C") {
        return false;
      }
    }

    // Aturan Khusus Cluster Botol:
    // * Cluster Botol di line B, boleh di gabung dengan cluster 12Ljumbo dan SKLsct,
    //   walaupun hanya Cluster Botol, CQI wajib di line B.
    // * Cluster Botol di line C, CQI wajib di line C.
    const mCluster = this.getMachineClusterGroup(m);
    const mLine = this.getMachineLine(m);
    const cqiLine = this.getCqiPrimaryLine(slot.cqi);

    if (mCluster === "BOTOL") {
      if (mLine === "LINE B" && cqiLine !== "LINE B") {
        return false;
      }
      if (mLine === "LINE C" && cqiLine !== "LINE C") {
        return false;
      }
    }

    if (!slot.machines || slot.machines.length === 0) return true;

    for (const existingMachine of slot.machines) {
      const existCluster = this.getMachineClusterGroup(existingMachine);
      if (
        !this.isClusterMixingAllowed(
          mCluster,
          existCluster,
          cqiNum,
          m,
          existingMachine,
        )
      ) {
        return false;
      }
    }

    // Periksa apakah penambahan mesin melebihi kapasitas absolut dari cluster terkait
    const testMachines = [...slot.machines, m];
    const rule = this.getClusterCapacityRule(testMachines);
    if (testMachines.length > rule.absoluteMax) {
      return false;
    }

    return true;
  },

  /**
   * Cek apakah sebuah mesin berada di baris depan workstation (menghadap lorong tengah Line A & Line B)
   * Di setiap workstation ada 2 mesin terdepan yang paling dekat dengan lorong tengah.
   * @param {Object} m - Objek Mesin
   * @param {Array} allMachines - Semua mesin pabrik
   * @param {Array} labels - Label map
   * @returns {boolean}
   */
  isFrontRowMachine(m, allMachines = [], labels = []) {
    if (!m) return false;
    const mLine = this.getMachineLine(m, labels);
    if (mLine !== "LINE A" && mLine !== "LINE B") return false;

    const wsKey = this.getWorkstationKey(m, labels).toUpperCase();

    // Jika ada data workstation machines, urutkan berdasarkan kedekatan ke lorong tengah (baris 9-11)
    if (Array.isArray(allMachines) && allMachines.length > 0) {
      const wsMachines = allMachines.filter(
        (om) => this.getWorkstationKey(om, labels).toUpperCase() === wsKey,
      );
      if (wsMachines.length <= 2) return true; // Workstation dengan <=2 mesin otomatis semua di baris depan

      if (mLine === "LINE A") {
        // Line A: lorong tengah di baris 9 -> sort descending berdasarkan row (makin besar row, makin dekat lorong)
        const sorted = [...wsMachines].sort(
          (a, b) => (b.position?.row || 0) - (a.position?.row || 0),
        );
        const frontTwo = sorted.slice(0, 2);
        return frontTwo.some(
          (fm) =>
            fm.id === m.id ||
            this.normalizeName(fm.name) === this.normalizeName(m.name),
        );
      } else if (mLine === "LINE B") {
        // Line B: lorong tengah di baris 11 -> sort ascending berdasarkan row (makin kecil row, makin dekat lorong)
        const sorted = [...wsMachines].sort(
          (a, b) => (a.position?.row || 99) - (b.position?.row || 99),
        );
        const frontTwo = sorted.slice(0, 2);
        return frontTwo.some(
          (fm) =>
            fm.id === m.id ||
            this.normalizeName(fm.name) === this.normalizeName(m.name),
        );
      }
    }

    // Fallback berbasis row statis
    const row =
      m.position && typeof m.position.row === "number" ? m.position.row : null;
    if (row === null) return false;
    if (mLine === "LINE A") {
      return (
        row >= 7 ||
        (wsKey === "1A" && row >= 6) ||
        (wsKey === "3A" && row >= 6) ||
        wsKey === "0A"
      );
    }
    if (mLine === "LINE B") {
      return row <= 13;
    }
    return false;
  },

  /**
   * Logika Penyeberangan Dinamis (Dynamic Cross-Line):
   * 1. 2 Mesin Depan di setiap Workstation Line A / Line B diperbolehkan menyeberang (cross-line) jika CQI seberang membutuhkannya.
   * 2. Jika 2 Mesin Depan TIDAK RUNNING (OFF), maka 2 Mesin Belakang otomatis menjadi baris aktif terdepan dan juga diperbolehkan menyeberang.
   * 3. Line C tidak memiliki aturan lorong tengah ini (Line C tetap terisolasi di Line C).
   *
   * @param {Object} m - Objek Mesin
   * @param {Object|string} targetCqi - Objek CQI atau string ID
   * @param {Array} runningMachines - Daftar mesin yang sedang running saat ini
   * @param {Array} allMachines - Seluruh data mesin pabrik dari peta
   * @param {Array} labels - Label peta
   * @returns {boolean}
   */
  isCrossLineAllowed(
    m,
    targetCqi,
    runningMachines = [],
    allMachines = [],
    labels = [],
  ) {
    if (!m || !targetCqi) return false;
    const mLine = this.getMachineLine(m, labels);
    const cqiLine = this.getCqiPrimaryLine(targetCqi);
    const cqiNum = String(this.getCqiNumber(targetCqi));

    // 1. Same line selalu diperbolehkan
    if (mLine === cqiLine) return true;

    // 2. Mesin OT strictly hanya CQI 19
    if (this.isOtMachine(m) || cqiNum === "19") {
      return this.isOtMachine(m) && cqiNum === "19";
    }

    // 3. CQI 24 (WW): Hanya WW & APK Line C
    if (cqiNum === "24") {
      if (this.isWwMachine(m)) return true;
      return (
        mLine === "LINE C" &&
        (this.isPouchMachine(m) ||
          String(m.name || m.id || "").toUpperCase().startsWith("APK"))
      );
    }

    // 4. CQI 15 (Line B): Boleh mengambil 1C dan 2C (Line C)
    if (cqiNum === "15" && mLine === "LINE C") {
      const ws = this.getWorkstationKey(m, labels).toUpperCase();
      return ws === "1C" || ws === "2C";
    }

    // 5. CQI 10 (Line A): Boleh mengambil 9B/10B/1C/2C jika diizinkan
    if (cqiNum === "10") {
      const ws = this.getWorkstationKey(m, labels).toUpperCase();
      if (ws === "9B" || ws === "10B" || ws === "1C" || ws === "2C") {
        return true;
      }
    }

    // 6. Dynamic Cross-Line Antara Line A dan Line B
    const isAtoB = mLine === "LINE A" && cqiLine === "LINE B";
    const isBtoA = mLine === "LINE B" && cqiLine === "LINE A";

    if (isAtoB || isBtoA) {
      const wsKey = this.getWorkstationKey(m, labels).toUpperCase();
      const pool =
        Array.isArray(allMachines) && allMachines.length > 0
          ? allMachines
          : runningMachines;

      // Cek apakah mesin ini adalah baris depan
      if (this.isFrontRowMachine(m, pool, labels)) {
        return true; // 2 Mesin Depan selalu boleh menyeberang
      }

      // Jika mesin ini adalah baris belakang, periksa apakah ada mesin depan di workstation yang sama yang sedang RUNNING
      const wsMachines = pool.filter(
        (otherM) =>
          this.getWorkstationKey(otherM, labels).toUpperCase() === wsKey,
      );

      const frontMachines = wsMachines.filter((otherM) =>
        this.isFrontRowMachine(otherM, pool, labels),
      );

      // Cek apakah ada mesin depan yang sedang RUNNING di batch runningMachines
      const isAnyFrontRunning = frontMachines.some((fm) =>
        runningMachines.some(
          (rm) =>
            rm.id === fm.id ||
            this.normalizeName(rm.name) === this.normalizeName(fm.name),
        ),
      );

      // Jika 2 mesin depan TIDAK running (OFF), maka mesin belakang menjadi baris terdepan aktif dan boleh menyeberang
      if (!isAnyFrontRunning) {
        return true;
      }

      // Jika mesin depan sedang running, maka mesin belakang dilarang menyeberang
      return false;
    }

    // Line C tidak diizinkan menyeberang ke Line A atau Line B (selain aturan khusus CQI 15 / CQI 24)
    return false;
  },

  /**
   * Cek kelayakan menyeluruh penempatan mesin ke slot CQI (Cluster + Kapasitas + Cross-Line)
   * @param {Object} m - Objek Mesin
   * @param {Object} slot - Slot CQI
   * @param {Array} runningMachines - Mesin running
   * @param {Array} allMachines - Semua mesin
   * @param {Array} labels - Label map
   * @returns {boolean}
   */
  canAddMachineToSlot(
    m,
    slot,
    runningMachines = [],
    allMachines = [],
    labels = [],
  ) {
    const wsKey = this.getWorkstationKey(m, labels).toUpperCase();
    const cqiNum = String(slot.cqiNum || this.getCqiNumber(slot.cqi) || "");
    if (this.isFarWorkstationForCqi(wsKey, cqiNum)) return false;

    if (!this.canAddMachineToSlotCluster(m, slot)) return false;
    if (
      !this.isCrossLineAllowed(
        m,
        slot.cqi,
        runningMachines,
        allMachines,
        labels,
      )
    ) {
      return false;
    }
    return true;
  },

  /**
   * Mengembalikan aturan kapasitas mesin & kebutuhan manpower (Core, Non-Core)
   * berdasarkan cluster mesin yang dialokasikan di CQI:
   * 1. pouch + botol:
   *    - 1 Core = 5 mesin
   *    - 1 Core + 1 Non-Core = 6-8 mesin
   *    - 1 Core + 2 Non-Core = 8-10 mesin (maks 10)
   * 2. sosoft (murni):
   *    - 1 Core = 4 mesin
   *    - 1 Core + 1 Non-Core = 6-7 mesin
   *    - 1 Core + 2 Non-Core = 8-10 mesin (maks 10)
   * 3. sosoft + SKLsct:
   *    - 1 Core = 4 mesin
   *    - 1 Core + 1 Non-Core = 6 mesin
   *    - 1 Core + 2 Non-Core = 8 mesin (maks 8)
   * 4. sosoft + 12Ljumbo:
   *    - 1 Core = 4 mesin
   *    - 1 Core + 1 Non-Core = 6 mesin
   *    - 1 Core + 2 Non-Core = 8 mesin (maks 8)
   *
   * @param {Object|Array} slotOrMachines - Slot CQI atau Array Mesin
   * @returns {Object} Objek aturan kapasitas cluster
   */
  getClusterCapacityRule(slotOrMachines) {
    const machines = Array.isArray(slotOrMachines)
      ? slotOrMachines
      : (slotOrMachines && slotOrMachines.machines) || [];

    if (machines.length === 0) {
      return {
        type: "default",
        name: "Default",
        maxCoreOnly: 4,
        max1Nc: 6,
        max2Nc: 8,
        absoluteMax: 8,
        getNeededNc: (count) => {
          if (count > 6) return 2;
          if (count > 4) return 1;
          return 0;
        },
        getMaxAllowed: (ncCount) => {
          if (ncCount >= 2) return 8;
          if (ncCount >= 1) return 6;
          return 4;
        },
      };
    }

    const clusters = new Set();
    machines.forEach((m) => clusters.add(this.getMachineClusterGroup(m)));

    const hasSosoft = clusters.has("SOSOFT");
    const hasSklsct = clusters.has("SKLSCT");
    const has12L = clusters.has("12LJUMBO");
    const hasPouch = clusters.has("POUCH");
    const hasBotol = clusters.has("BOTOL");
    const hasWw = clusters.has("WW");
    const hasOt = clusters.has("OT");

    // Khusus Mesin OT (M2 & M3) -> Strictly 2 mesin
    if (hasOt) {
      return {
        type: "ot",
        name: "OT",
        maxCoreOnly: 2,
        max1Nc: 2,
        max2Nc: 2,
        absoluteMax: 2,
        getNeededNc: () => 0,
        getMaxAllowed: () => 2,
      };
    }

    // Khusus Mesin WW (CQI 24)
    // ATURAN CQI 24:
    // TANPA NONCORE/LS:
    // - jika running 2, maka 2 mesin WW
    // - jika running 1, maka 1 mesin WW dan 3 mesin pouch (total 4)
    // DENGAN 1 NONCORE/LS:
    // - jika running 2, maka 2 mesin WW dan 5 mesin pouch (total 7)
    // - jika running 1, maka 1 mesin WW dan 6 mesin pouch (total 7)
    if (hasWw) {
      const wwCount = machines.filter((m) => this.isWwMachine(m)).length;
      const pouchCount = machines.filter((m) => !this.isWwMachine(m)).length;

      if (wwCount >= 2) {
        return {
          type: "ww_2",
          name: "WW (2 WW + Pouch)",
          maxCoreOnly: 2, // jika running 2, tanpa NC/LS = 2 mesin WW
          max1Nc: 7, // jika running 2, dengan 1 NC/LS = 2 WW + 5 pouch (total 7)
          max2Nc: 7,
          absoluteMax: 7,
          getNeededNc: (count) => {
            // Jika ada pouch ditambahkan (total mesin > 2), butuh 1 NC/LS
            return count > 2 ? 1 : 0;
          },
          getMaxAllowed: (ncCount) => {
            return ncCount >= 1 ? 7 : 2;
          },
        };
      } else {
        return {
          type: "ww_1",
          name: "WW (1 WW + Pouch)",
          maxCoreOnly: 4, // jika running 1, tanpa NC/LS = 1 WW + 3 pouch (total 4)
          max1Nc: 7, // jika running 1, dengan 1 NC/LS = 1 WW + 6 pouch (total 7)
          max2Nc: 7,
          absoluteMax: 7,
          getNeededNc: (count) => {
            // Jika pouch > 3 (total mesin > 4), butuh 1 NC/LS
            return count > 4 ? 1 : 0;
          },
          getMaxAllowed: (ncCount) => {
            return ncCount >= 1 ? 7 : 4;
          },
        };
      }
    }

    // 1A. Cluster Hanya Pouch (murni Pouch - tanpa Botol, tanpa Sosoft, tanpa SKLsct, tanpa 12Ljumbo)
    if (hasPouch && !hasBotol && !hasSosoft && !hasSklsct && !has12L) {
      return {
        type: "hanya_pouch",
        name: "hanya Pouch",
        maxCoreOnly: 4,
        max1Nc: 6,
        max2Nc: 10,
        absoluteMax: 10,
        getNeededNc: (count) => {
          if (count > 6) return 2;
          if (count > 4) return 1;
          return 0;
        },
        getMaxAllowed: (ncCount) => {
          if (ncCount >= 2) return 10;
          if (ncCount >= 1) return 6;
          return 4;
        },
      };
    }

    // 1B. Cluster Hanya Botol (murni Botol - tanpa Pouch, tanpa Sosoft, tanpa SKLsct, tanpa 12Ljumbo)
    if (hasBotol && !hasPouch && !hasSosoft && !hasSklsct && !has12L) {
      return {
        type: "hanya_botol",
        name: "hanya Botol",
        maxCoreOnly: 4,
        max1Nc: 6,
        max2Nc: 10,
        absoluteMax: 10,
        getNeededNc: (count) => {
          if (count > 6) return 2;
          if (count > 4) return 1;
          return 0;
        },
        getMaxAllowed: (ncCount) => {
          if (ncCount >= 2) return 10;
          if (ncCount >= 1) return 6;
          return 4;
        },
      };
    }

    // 1C. Cluster Pouch + Botol (2 cluster)
    if (hasPouch && hasBotol && !hasSosoft && !hasSklsct && !has12L) {
      return {
        type: "pouch_botol",
        name: "Pouch + Botol",
        maxCoreOnly: 5,
        max1Nc: 6,
        max2Nc: 10,
        absoluteMax: 10,
        getNeededNc: (count) => {
          if (count > 6) return 2;
          if (count > 5) return 1;
          return 0;
        },
        getMaxAllowed: (ncCount) => {
          if (ncCount >= 2) return 10;
          if (ncCount >= 1) return 6;
          return 5;
        },
      };
    }

    // 2. Cluster Sosoft (murni)
    if (hasSosoft && !hasSklsct && !has12L && !hasPouch && !hasBotol) {
      return {
        type: "sosoft",
        name: "Sosoft",
        maxCoreOnly: 4,
        max1Nc: 6,
        max2Nc: 8,
        absoluteMax: 8,
        getNeededNc: (count) => {
          if (count > 6) return 2;
          if (count > 4) return 1;
          return 0;
        },
        getMaxAllowed: (ncCount) => {
          if (ncCount >= 2) return 8;
          if (ncCount >= 1) return 6;
          return 4;
        },
      };
    }

    // 3. Cluster SKLsct (murni)
    if (hasSklsct && !hasSosoft && !has12L && !hasPouch && !hasBotol) {
      return {
        type: "sklsct",
        name: "SKLsct",
        maxCoreOnly: 4,
        max1Nc: 5,
        max2Nc: 8,
        absoluteMax: 8,
        getNeededNc: (count) => {
          if (count > 5) return 2;
          if (count > 4) return 1;
          return 0;
        },
        getMaxAllowed: (ncCount) => {
          if (ncCount >= 2) return 8;
          if (ncCount >= 1) return 5;
          return 4;
        },
      };
    }

    // 4. Cluster 12Ljumbo (murni)
    if (has12L && !hasSosoft && !hasSklsct && !hasPouch && !hasBotol) {
      return {
        type: "12ljumbo",
        name: "12Ljumbo",
        maxCoreOnly: 4,
        max1Nc: 6,
        max2Nc: 8,
        absoluteMax: 8,
        getNeededNc: (count) => {
          if (count > 6) return 2;
          if (count > 4) return 1;
          return 0;
        },
        getMaxAllowed: (ncCount) => {
          if (ncCount >= 2) return 8;
          if (ncCount >= 1) return 6;
          return 4;
        },
      };
    }

    // 5. Cluster Sosoft + SKLsct (2 cluster)
    if (hasSosoft && hasSklsct && !has12L && !hasPouch && !hasBotol) {
      return {
        type: "sosoft_sklsct",
        name: "Sosoft + SKLsct",
        maxCoreOnly: 4,
        max1Nc: 6,
        max2Nc: 8,
        absoluteMax: 8,
        getNeededNc: (count) => {
          if (count > 6) return 2;
          if (count > 4) return 1;
          return 0;
        },
        getMaxAllowed: (ncCount) => {
          if (ncCount >= 2) return 8;
          if (ncCount >= 1) return 6;
          return 4;
        },
      };
    }

    // 6. Cluster Sosoft + 12Ljumbo (2 cluster)
    if (hasSosoft && has12L && !hasSklsct && !hasPouch && !hasBotol) {
      return {
        type: "sosoft_12ljumbo",
        name: "Sosoft + 12Ljumbo",
        maxCoreOnly: 4,
        max1Nc: 6,
        max2Nc: 8,
        absoluteMax: 8,
        getNeededNc: (count) => {
          if (count > 6) return 2;
          if (count > 4) return 1;
          return 0;
        },
        getMaxAllowed: (ncCount) => {
          if (ncCount >= 2) return 8;
          if (ncCount >= 1) return 6;
          return 4;
        },
      };
    }

    // 7. Cluster SKLsct + 12Ljumbo (2 cluster, misal CQI 5 / CQI 25)
    if (hasSklsct && has12L && !hasSosoft && !hasPouch && !hasBotol) {
      return {
        type: "sklsct_12ljumbo",
        name: "SKLsct + 12Ljumbo",
        maxCoreOnly: 4,
        max1Nc: 6,
        max2Nc: 8,
        absoluteMax: 8,
        getNeededNc: (count) => {
          if (count > 6) return 2;
          if (count > 4) return 1;
          return 0;
        },
        getMaxAllowed: (ncCount) => {
          if (ncCount >= 2) return 8;
          if (ncCount >= 1) return 6;
          return 4;
        },
      };
    }

    // 8. Cluster 12Ljumbo + Pouch (2 cluster)
    if (has12L && hasPouch && !hasSosoft && !hasSklsct && !hasBotol) {
      return {
        type: "12ljumbo_pouch",
        name: "12Ljumbo + Pouch",
        maxCoreOnly: 5,
        max1Nc: 6,
        max2Nc: 9,
        absoluteMax: 9,
        getNeededNc: (count) => {
          if (count > 6) return 2;
          if (count > 5) return 1;
          return 0;
        },
        getMaxAllowed: (ncCount) => {
          if (ncCount >= 2) return 9;
          if (ncCount >= 1) return 6;
          return 5;
        },
      };
    }

    // 9. Cluster SKLsct + Pouch (misal CQI 10)
    if (hasSklsct && hasPouch && !hasSosoft && !has12L && !hasBotol) {
      return {
        type: "sklsct_pouch",
        name: "SKLsct + Pouch",
        maxCoreOnly: 4,
        max1Nc: 6,
        max2Nc: 8,
        absoluteMax: 8,
        getNeededNc: (count) => {
          if (count > 6) return 2;
          if (count > 4) return 1;
          return 0;
        },
        getMaxAllowed: (ncCount) => {
          if (ncCount >= 2) return 8;
          if (ncCount >= 1) return 6;
          return 4;
        },
      };
    }

    // 10. Cluster Botol + 12Ljumbo (Line B)
    if (hasBotol && has12L && !hasSosoft && !hasSklsct && !hasPouch) {
      return {
        type: "botol_12ljumbo",
        name: "Botol + 12Ljumbo",
        maxCoreOnly: 4,
        max1Nc: 6,
        max2Nc: 8,
        absoluteMax: 8,
        getNeededNc: (count) => {
          if (count > 6) return 2;
          if (count > 4) return 1;
          return 0;
        },
        getMaxAllowed: (ncCount) => {
          if (ncCount >= 2) return 8;
          if (ncCount >= 1) return 6;
          return 4;
        },
      };
    }

    // 11. Cluster Botol + SKLsct (Line B)
    if (hasBotol && hasSklsct && !hasSosoft && !has12L && !hasPouch) {
      return {
        type: "botol_sklsct",
        name: "Botol + SKLsct",
        maxCoreOnly: 4,
        max1Nc: 6,
        max2Nc: 8,
        absoluteMax: 8,
        getNeededNc: (count) => {
          if (count > 6) return 2;
          if (count > 4) return 1;
          return 0;
        },
        getMaxAllowed: (ncCount) => {
          if (ncCount >= 2) return 8;
          if (ncCount >= 1) return 6;
          return 4;
        },
      };
    }

    // Default Fallback
    return {
      type: "default",
      name: "Default",
      maxCoreOnly: 4,
      max1Nc: 6,
      max2Nc: 8,
      absoluteMax: 8,
      getNeededNc: (count) => {
        if (count > 6) return 2;
        if (count > 4) return 1;
        return 0;
      },
      getMaxAllowed: (ncCount) => {
        if (ncCount >= 2) return 8;
        if (ncCount >= 1) return 6;
        return 4;
      },
    };
  },

  /**
   * Mengembalikan batas kapasitas 1 Core dasar tanpa Non-Core / Longshift:
   * TANPA NONCORE/LS:
   * - hanya 1 cluster: Sosoft, SKLsct, 12Ljumbo, Pouch, Botol = 4 mesin
   * - 2 cluster: Sosoft+SKLsct, Sosoft+12Ljumbo, SKLsct+12Ljumbo = 4 mesin
   * - 2 cluster: 12Ljumbo+Pouch, Pouch+Botol = 5 mesin
   * - OT (CQI 19) : 2 mesin
   * - WW (CQI 24) :
   *   * jika running 2 WW: 2 mesin WW
   *   * jika running 1 WW: 1 mesin WW dan 3 mesin pouch (total 4 mesin)
   * @param {Object|Array} slotOrMachines
   * @returns {number}
   */
  getBaseCoreCapacity(slotOrMachines) {
    const machines = Array.isArray(slotOrMachines)
      ? slotOrMachines
      : (slotOrMachines && slotOrMachines.machines) || [];

    if (slotOrMachines && slotOrMachines.cqiNum === "19") return 2;
    if (slotOrMachines && slotOrMachines.cqiNum === "24") {
      const wwCount = machines.filter((m) => this.isWwMachine(m)).length;
      if (wwCount >= 2) return 2;
      if (wwCount === 1) return 4;
      return 4;
    }

    if (machines.length === 0) {
      if (slotOrMachines && slotOrMachines.cqiNum) {
        const cqiKey = "cqi " + slotOrMachines.cqiNum;
        const prio = this.CQI_CLUSTER_PRIORITY_MAP[cqiKey] || [];
        const p1 = String(prio[0] || "").toUpperCase();
        const p2 = String(prio[1] || "").toUpperCase();
        if (
          (p1.includes("12L") && p2.includes("POUCH")) ||
          (p1.includes("POUCH") && p2.includes("12L")) ||
          (p1.includes("POUCH") && p2.includes("BOTOL")) ||
          (p1.includes("BOTOL") && p2.includes("POUCH"))
        ) {
          return 5;
        }
      }
      return 4;
    }
    return this.getClusterCapacityRule(machines).maxCoreOnly;
  },

  /**
   * Menghitung batas maksimal mesin yang BISA ditambahkan ke CQI secara aman,
   * mempertimbangkan ketersediaan sisa manpower Non-Core / Longshift.
   * @param {Object} slot - Slot CQI
   * @param {number} totalNcPool - Total ketersediaan Non-Core + Longshift (angka)
   * @param {Array} allSlots - Seluruh slot aktif
   * @returns {number} Limit dinamis mesin
   */
  getDynamicSlotLimit(slot, totalNcPool, allSlots) {
    const rule = this.getClusterCapacityRule(slot);
    // CQI Khusus punya aturan fix
    if (slot.cqiNum === "19") return 2;
    if (slot.cqiNum === "24") {
      const wwCount = slot.machines.filter((m) => this.isWwMachine(m)).length;
      const baseCap = wwCount >= 2 ? 2 : 4;
      const currentCount = slot.machines.length;
      return 7;
    }

    const currentCount = slot.machines.length;
    let limit = Math.min(rule.absoluteMax, rule.maxCoreOnly);

    // Hitung berapa NC yang sudah terpakai/direserve oleh SEMUA slot sejauh ini
    let globalNeeded = 0;
    allSlots.forEach((s) => {
      if (s.cqiNum === "19") return;
      if (s.cqiNum === "24") {
        const wwIn24 = s.machines.filter((m) => this.isWwMachine(m)).length;
        const pouchIn24 = s.machines.filter((m) => !this.isWwMachine(m)).length;
        if (wwIn24 >= 2) {
          globalNeeded += pouchIn24 > 0 ? 1 : 0;
        } else if (wwIn24 === 1) {
          globalNeeded += pouchIn24 > 3 ? 1 : 0;
        } else {
          globalNeeded += s.machines.length > this.getBaseCoreCapacity(s) ? 1 : 0;
        }
        return;
      }
      globalNeeded += this.getClusterCapacityRule(s).getNeededNc(s.machines.length);
    });

    const availableNc = totalNcPool - globalNeeded;

    // Jika belum butuh extra NC (atau mau nambah di batas 1 Core), aman
    if (availableNc <= 0) return Math.min(rule.absoluteMax, Math.max(currentCount, limit));

    // Hitung kebutuhan NC saat ini vs untuk batas berikutnya
    const currentSlotNeeded = rule.getNeededNc(currentCount);
    const neededForMax1 = rule.getNeededNc(rule.max1Nc) - currentSlotNeeded;
    
    if (neededForMax1 > 0 && availableNc >= neededForMax1) {
      limit = Math.min(rule.absoluteMax, rule.max1Nc);
      
      const neededForMax2 = rule.getNeededNc(rule.max2Nc) - currentSlotNeeded - neededForMax1;
      if (neededForMax2 > 0 && (availableNc - neededForMax1) >= neededForMax2) {
        limit = Math.min(rule.absoluteMax, rule.max2Nc);
      }
    }
    
    return Math.min(rule.absoluteMax, Math.max(currentCount, limit));
  },

  /**
   * Cek apakah sebuah mesin merupakan kategori Wet Wipes (WW)
   * @param {Object} m - Objek Mesin
   * @returns {boolean}
   */
  isWwMachine(m) {
    if (!m) return false;
    const line = String(m.line || "").toUpperCase();
    const ws = String(m.workstation || m.ws || "").toUpperCase();
    const name = String(m.name || m.id || "").toUpperCase();
    const cluster = String(m.cluster || "").toUpperCase();
    return (
      line === "WW" ||
      line.includes("WW") ||
      ws === "WW" ||
      ws.includes("WW") ||
      cluster.includes("WW") ||
      name.includes("WW") ||
      /^C\d+/.test(name)
    );
  },

  /**
   * Cek apakah sebuah mesin merupakan kategori Oral & Tube / Other (OT - yaitu mesin M2 dan M3)
   * @param {Object} m - Objek Mesin
   * @returns {boolean}
   */
  isOtMachine(m) {
    if (!m) return false;
    const line = String(m.line || "").toUpperCase();
    const ws = String(m.workstation || m.ws || "").toUpperCase();
    const name = String(m.name || m.id || "").toUpperCase();
    const id = String(m.id || "").toUpperCase();
    const cluster = String(m.cluster || "").toUpperCase();

    // PERBAIKAN: Gunakan exact match (===) atau regex kata utuh (\b)
    // Jangan gunakan .includes('OT') karena akan mendeteksi string 'BOTOL'
    const isClusterOt = cluster === "OT" || /\bOT\b/.test(cluster);

    return (
      name === "M2" ||
      name === "M3" ||
      id === "M2" ||
      id === "M3" ||
      line === "OT" ||
      ws === "OT" ||
      isClusterOt ||
      /^M\d+/.test(name) ||
      /^M\d+/.test(id)
    );
  },

  /**
   * Cek apakah sebuah mesin merupakan kategori Pouch
   * @param {Object} m - Objek Mesin
   * @returns {boolean}
   */
  isPouchMachine(m) {
    if (!m) return false;
    const cluster = String(m.cluster || "").toUpperCase();
    const name = String(m.name || m.id || "").toUpperCase();
    return cluster.includes("POUCH") || name.startsWith("APK");
  },

  /**
   * Cek apakah sebuah mesin berada di Line C
   * @param {Object} m - Objek Mesin
   * @param {Array} labels - Label map (opsional)
   * @returns {boolean}
   */
  isMachineLineC(m, labels = []) {
    if (!m) return false;
    const line = String(m.line || "").toUpperCase();
    const ws = this.getWorkstationKey(m, labels).toUpperCase();
    const col = m.col || (m.position ? m.position.col : 0);
    return (
      line.includes("LINE C") ||
      line === "C" ||
      ws.endsWith("C") ||
      ws.includes("C") ||
      col >= 32
    );
  },

  /**
   * Mengambil identitas workstation secara dinamis dari properti objek mesin, label, atau nama string
   * @param {Object|string} machineInput - Objek mesin atau string nama mesin
   * @param {Array} labels - Daftar label area dari map.json
   * @returns {string} Kode Workstation (misal: '0A', '1A', 'WW', 'OT', dll.)
   */
  getWorkstationKey(machineInput, labels = []) {
    if (typeof machineInput === "object" && machineInput !== null) {
      if (machineInput.workstation) {
        return String(machineInput.workstation).trim().toUpperCase();
      }
      if (machineInput.ws) {
        return String(machineInput.ws).trim().toUpperCase();
      }
      machineInput = machineInput.name || machineInput.id || "";
    }

    const normM = this.normalizeName(machineInput);

    if (Array.isArray(labels)) {
      for (const l of labels) {
        const normL = this.normalizeName(l.name);
        if (normL && (normM.includes(normL) || normL.includes(normM))) {
          return l.name;
        }
      }
    }

    const match = normM.match(/(\d+[A-Z]|WW|OT)/);
    return match ? match[0] : "LAINNYA";
  },

  /**
   * Menghasilkan titik rute (waypoints) navigasi fisik melewati lorong dan node label depan workstation,
   * sehingga jalur koneksi tidak menerobos atau memotong blok mesin lain secara diagonal.
   * Rute: Mesin -> Node Label WS Depan -> Lorong Transit Sentral -> Kolom CQI -> CQI Target
   * @param {Object} m - Objek Mesin
   * @param {Object} cqi - Objek CQI Target
   * @param {Array} labels - Daftar label workstation dari map.json
   * @returns {Array<{row: number, col: number}>} Array titik koordinat grid
   */
  getAisleWaypoints(m, cqi, labels = []) {
    if (!m || !cqi) return [];
    const mRow = m.row || (m.position ? m.position.row : 0);
    const mCol = m.col || (m.position ? m.position.col : 0);
    const cRow = cqi.row || (cqi.position ? cqi.position.row : 0);
    const cCol = cqi.col || (cqi.position ? cqi.position.col : 0);

    if (mRow === 0 || mCol === 0 || cRow === 0 || cCol === 0) return [];
    if (mRow === cRow && mCol === cCol) return [{ row: mRow, col: mCol }];

    // 1. Kasus Khusus OT (row 3-4, col 33) & CQI 19 (row 3, col 34)
    if ((mCol === 33 || mCol === 32) && mRow <= 5 && cCol >= 32 && cRow <= 5) {
      return [
        { row: mRow, col: mCol },
        { row: cRow, col: mCol },
        { row: cRow, col: cCol },
      ];
    }

    // 2. Kasus Khusus WW (row 8-9, col 33) & CQI 24 (row 8, col 34)
    if (
      (mCol === 33 || mCol === 32) &&
      mRow >= 7 &&
      mRow <= 10 &&
      cCol >= 32 &&
      cRow >= 7 &&
      cRow <= 10
    ) {
      return [
        { row: mRow, col: mCol },
        { row: cRow, col: mCol },
        { row: cRow, col: cCol },
      ];
    }

    // 3. Cari Node Label depan Workstation mesin
    let wsName = m.workstation || m.ws || "";
    let labelObj = null;
    if (Array.isArray(labels) && labels.length > 0) {
      if (wsName) {
        labelObj = labels.find(
          (l) =>
            l.name === wsName ||
            this.normalizeName(l.name) === this.normalizeName(wsName),
        );
      }
      if (!labelObj) {
        const wsKey = this.getWorkstationKey(m, labels);
        if (wsKey && wsKey !== "LAINNYA") {
          labelObj = labels.find(
            (l) =>
              l.name === wsKey ||
              this.normalizeName(l.name) === this.normalizeName(wsKey),
          );
        }
      }
    }

    // Posisi baris & kolom label depan:
    // Line A (mRow <= 9) -> Label di Row 9
    // Line B (mRow >= 11, mCol <= 30) -> Label di Row 11
    // Line C (mCol >= 32) -> Label di Row 13
    const labelRow = labelObj
      ? labelObj.row ?? (labelObj.position ? labelObj.position.row : undefined)
      : undefined;
    const labelCol = labelObj
      ? labelObj.col ?? (labelObj.position ? labelObj.position.col : undefined)
      : undefined;

    let lRow = labelRow !== undefined ? labelRow : mRow <= 9 ? 9 : mCol >= 32 ? 13 : 11;
    let lCol = labelCol !== undefined ? labelCol : mCol;

    const isMachineLineA = mRow <= 9 && mCol <= 30;
    const isCqiLineA = cRow <= 4 && cCol <= 30;

    // Jika CQI berada di Line A (posisi atas di header baris 3-4) dan mesin juga di Line A:
    // Pergerakan bisa lewat lorong atas (baris header CQI) atau lorong tengah/bawah (baris 9), pilih jalur fisik terpendek!
    if (isMachineLineA && isCqiLineA) {
      const distTop = Math.abs(mRow - cRow) + Math.abs(mCol - cCol);
      const distBottom = Math.abs(mRow - lRow) + Math.abs(mCol - cCol) + Math.abs(lRow - cRow);

      if (distTop <= distBottom) {
        const pts = [];
        const add = (r, c) => {
          if (pts.length === 0 || pts[pts.length - 1].row !== r || pts[pts.length - 1].col !== c) {
            pts.push({ row: r, col: c });
          }
        };
        add(mRow, mCol);
        add(cRow, mCol);
        add(cRow, cCol);
        return pts;
      }
    }

    // Tentukan baris node label untuk target CQI (cLRow)
    const cqiLine = this.getCqiPrimaryLine(cqi);
    let cLRow = 9;
    if (cqiLine === "LINE B" || (cRow >= 11 && cRow <= 16 && cCol <= 30)) cLRow = 11;
    else if (cqiLine === "LINE C" || cCol >= 32 || cRow >= 13) cLRow = 13;
    else if (cqiLine === "LINE A" || cRow <= 4) cLRow = 9;
    else {
      cLRow = cRow <= 10 ? 9 : cRow >= 13 ? 13 : 11;
    }

    const waypoints = [];
    function addPt(r, c) {
      if (waypoints.length === 0) {
        waypoints.push({ row: r, col: c });
      } else {
        const last = waypoints[waypoints.length - 1];
        if (last.row !== r || last.col !== c) {
          waypoints.push({ row: r, col: c });
        }
      }
    }

    // Titik Awal: Posisi Mesin
    addPt(mRow, mCol);

    // Langkah 1: Bergerak vertikal keluar dari mesin ke baris label depan mesin
    addPt(lRow, mCol);

    // Langkah 2: Masuk ke titik tengah Label Workstation jika posisi kolomnya berbeda
    if (lCol !== mCol) {
      addPt(lRow, lCol);
    }

    // Langkah 3 & 4: Penentuan rute lorong antarnode (Langsung lewat baris node label, tanpa perlu belok baris 10 dulu)
    const isMachineLineC = mCol >= 32 || lRow === 13;
    const isCqiLineC = cCol >= 32 || cLRow === 13;

    if (isMachineLineC && !isCqiLineC) {
      // Mesin di Line C / area kanan -> CQI di Line A/B
      if (lRow !== 13) {
        addPt(lRow, 31);
      } else {
        addPt(13, 31); // Bergerak di Row 13 ke titik transit Line C (Col 31)
      }
      addPt(cLRow, 31); // Menyeberang ke baris node CQI target (Row 9 atau 11)
      addPt(cLRow, cCol); // Bergerak di baris node CQI ke kolom CQI
    } else if (!isMachineLineC && isCqiLineC) {
      // Mesin di Line A/B -> CQI di Line C / area kanan
      addPt(lRow, 31); // Bergerak di baris node mesin ke titik transit (Col 31)
      addPt(cLRow, 31); // Menyeberang ke baris lorong CQI target (Col 31)
      addPt(cLRow, cCol); // Bergerak di baris lorong CQI ke kolom CQI
    } else if (lRow === cLRow) {
      // Sama-sama di Line A (Row 9), Line B (Row 11), atau Line C (Row 13)
      // Bergerak LANGSUNG sepanjang baris node label (Row 9/11/13) dari node mesin ke kolom CQI
      addPt(lRow, cCol);
    } else {
      // Beda Line A <-> Line B (Row 9 <-> Row 11)
      addPt(lRow, cCol); // Bergerak di baris node label mesin ke kolom CQI
      addPt(cLRow, cCol); // Menyeberang vertikal langsung ke baris node CQI
    }

    // Langkah 5: Bergerak vertikal dari baris label CQI menuju ke posisi CQI target
    addPt(cRow, cCol);

    return waypoints;
  },

  /**
   * Menghitung jarak lintasan lorong aktual (Aisle Manhattan Distance) melewati node label & lorong transit.
   * Jarak dihitung berdasarkan panjang langkah riil tanpa menabrak blok mesin lain.
   * @param {Object} m - Objek Mesin
   * @param {Object} cqi - Objek CQI Target
   * @param {Array} labels - Daftar label area dari map.json
   * @returns {number} Jarak langkah lintasan lorong
   */
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

  /**
   * Menghitung nilai bonus afinitas riwayat penugasan mesin ke CQI
   * @param {Object} machine - Objek Mesin
   * @param {Object} cqi - Objek CQI
   * @param {Array} historyList - Daftar riwayat penugasan (opsional)
   * @returns {number} Nilai bonus (0 - 30)
   */
  getHistoryBonus(machine, cqi, historyList = null) {
    if (!machine || !cqi) return 0;
    const mName = this.normalizeName(machine.name || machine.id);
    const cqiNum = String(this.getCqiNumber(cqi) || "").trim();
    if (!mName || !cqiNum) return 0;

    // 1. Cek dari in-memory cache lookup jika sudah siap
    if (
      this._historyAffinityMap &&
      this._historyAffinityMap[mName] &&
      this._historyAffinityMap[mName][cqiNum]
    ) {
      const freq = this._historyAffinityMap[mName][cqiNum];
      return Math.min(freq * 10, 30);
    }

    if (!historyList) {
      if (Array.isArray(this._historyRecords) && this._historyRecords.length > 0) {
        historyList = this._historyRecords;
      } else {
        try {
          const raw =
            typeof localStorage !== "undefined"
              ? localStorage.getItem("planning_history")
              : null;
          historyList = raw ? JSON.parse(raw) : [];
        } catch (e) {
          historyList = [];
        }
      }
    }
    if (!Array.isArray(historyList) || historyList.length === 0) return 0;

    let matchCount = 0;
    for (const h of historyList) {
      const hM = this.normalizeName(h.machineId || h.machine || h.name || h.machineName);
      const hCqi = String(this.getCqiNumber(h.cqiId || h.cqi || h.nama || h.cqiName) || "").trim();
      if (
        hM &&
        (hM === mName || mName.includes(hM) || hM.includes(mName)) &&
        hCqi === cqiNum
      ) {
        matchCount++;
      }
    }
    return Math.min(matchCount * 10, 30);
  },

  /**
   * Mengubah daftar array objek mesin menjadi teks terpisah koma yang rapi.
   * ATURAN: Jika seluruh mesin running dalam satu workstation (WS) dicek oleh 1 CQI yang sama,
   * maka tuliskan format ringkas WS dan jumlah mesin running-nya (misal: "0A (2)", "1A (3)").
   * Mesin individual yang tidak mengcover seluruh running mesin di WS-nya tetap ditulis nama mesinnya.
   *
   * @param {Array} slotMachines - Daftar mesin pada slot CQI ini
   * @param {Array} allRunningMachines - Daftar seluruh mesin running di shift ini (opsional)
   * @param {Array} labels - Label map (opsional)
   * @returns {string} Daftar nama mesin terpisah koma
   */
  formatMachineList(slotMachines, allRunningMachines = null, labels = []) {
    if (!Array.isArray(slotMachines) || slotMachines.length === 0) return "-";

    // Jika daftar seluruh mesin running diberikan, kita bisa menghitung total mesin running per workstation
    // Jika tidak diberikan, kita anggap referensi dari slotMachines
    const allRunning =
      Array.isArray(allRunningMachines) && allRunningMachines.length > 0
        ? allRunningMachines
        : slotMachines;

    // 1. Hitung total mesin running per WS di seluruh pabrik
    const totalRunningPerWs = {};
    allRunning.forEach((m) => {
      const ws = this.getWorkstationKey(m, labels);
      if (ws && ws !== "LAINNYA") {
        totalRunningPerWs[ws] = (totalRunningPerWs[ws] || 0) + 1;
      }
    });

    // 2. Kelompokkan mesin yang ada di slot CQI ini berdasarkan WS
    const slotWsGroups = {};
    slotMachines.forEach((m) => {
      const ws = this.getWorkstationKey(m, labels);
      if (!slotWsGroups[ws]) slotWsGroups[ws] = [];
      slotWsGroups[ws].push(m);
    });

    // 3. Susun output: Jika jumlah mesin di slot untuk WS tersebut == total mesin running WS tersebut (dan > 1),
    // tulis "WS (count)". Jika hanya 1 mesin atau belum mengcover 100% running mesin di WS tersebut,
    // tampilkan nama masing-masing mesin.
    const resultParts = [];
    const processedWs = new Set();

    // Urutkan workstation grup agar konsisten sesuai urutan mesin di slot
    slotMachines.forEach((m) => {
      const ws = this.getWorkstationKey(m, labels);
      if (processedWs.has(m.id || m.name)) return;

      const group = slotWsGroups[ws] || [];
      const totalInShift = totalRunningPerWs[ws] || 0;

      // Jika seluruh mesin running di WS tersebut berada di 1 CQI ini dan jumlahnya >= 2 (atau totalInShift == group.length)
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

};
