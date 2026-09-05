/**
 * Modul Manpower Assigner
 * Mengelola penugasan personel Core, Non-Core, dan Longshift (LS)
 * berdasarkan preferensi prioritas personal dan kapasitas cluster.
 */

export default {
  /**
   * Memasangkan Core personnel ke slot CQI aktif sesuai urutan config.html & hierarki prioritas
   */
  assignCorePersonnel(activeSlots, coreList, engine) {
    if (!Array.isArray(activeSlots) || activeSlots.length === 0) return;

    // Pastikan activeSlots terurut berdasarkan nomor CQI (CQI 1, CQI 2, CQI 3, ...)
    activeSlots.sort((a, b) => {
      const numA = parseInt(a.cqiNum || engine.getCqiNumber(a.cqi), 10) || 999;
      const numB = parseInt(b.cqiNum || engine.getCqiNumber(b.cqi), 10) || 999;
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
    const slot19Active = activeSlots.find((s) => s.cqiNum === "19");
    if (slot19Active && slot19Active.core === 0) {
      let chosenCore = pickCoreByQuery((c) => {
        const id = String(c.id || "").toUpperCase();
        const name = engine.normalizeName(c.name || "");
        return id === "C14" || name === "FARHAN";
      });

      if (!chosenCore) {
        chosenCore = pickCoreByQuery((c) => {
          const id = String(c.id || "").toUpperCase();
          const name = engine.normalizeName(c.name || "");
          return id === "C7" || name === "DINI";
        });
      }

      if (!chosenCore) {
        chosenCore = pickCoreByQuery((c) => {
          const p = String(c.cqi_priority || "").trim();
          return p === "19" || engine.getCqiNumber(p) === "19";
        });
      }

      if (chosenCore) {
        slot19Active.core = 1;
        slot19Active.coreNames = [chosenCore.name];
      }
    }

    // 2. Prioritas Khusus CQI 24 (WW): C9 (Jiddan) -> C8 (Mia)
    const slot24Active = activeSlots.find((s) => s.cqiNum === "24");
    if (slot24Active && slot24Active.core === 0) {
      let chosenCore = pickCoreByQuery((c) => {
        const id = String(c.id || "").toUpperCase();
        const name = engine.normalizeName(c.name || "");
        return id === "C9" || name === "JIDDAN";
      });

      if (!chosenCore) {
        chosenCore = pickCoreByQuery((c) => {
          const id = String(c.id || "").toUpperCase();
          const name = engine.normalizeName(c.name || "");
          return id === "C8" || name === "MIA";
        });
      }

      if (!chosenCore) {
        chosenCore = pickCoreByQuery((c) => {
          const p = String(c.cqi_priority || "").trim();
          return p === "24" || engine.getCqiNumber(p) === "24";
        });
      }

      if (chosenCore) {
        slot24Active.core = 1;
        slot24Active.coreNames = [chosenCore.name];
      }
    }

    // 3. Pasangkan Core berdasarkan cqi_priority khusus jika dikonfigurasi
    activeSlots.forEach((slot) => {
      if (slot.core > 0) return;
      const matchedCore = pickCoreByQuery((c) => {
        if (!c || !c.cqi_priority) return false;
        const prioNum = String(c.cqi_priority).trim();
        return (
          prioNum === slot.cqiNum ||
          engine.getCqiNumber(c.cqi_priority) === slot.cqiNum
        );
      });

      if (matchedCore) {
        slot.core = 1;
        slot.coreNames = [matchedCore.name];
      }
    });

    // 4. Pasangkan sisa Core secara sekuensial sesuai urutan config (Urutan 1 -> CQI 1/2/3 yang pertama)
    activeSlots.forEach((slot) => {
      if (slot.core === 0 && availableCores.length > 0) {
        const nextCore = availableCores.shift();
        slot.core = 1;
        slot.coreNames = [nextCore.name];
      }
    });
  },

  /**
   * TAHAP 4 & 5 (Lanjutan 2 & 3): IDENTIFIKASI KEBUTUHAN NC/LS & ALOKASI PERSONEL
   *
   * 2. Identifikasi CQI yang membutuhkan NC/LS
   *    (mesin > kapasitas 1 Core dasar dari cluster terkait).
   * 3. Tambahkan NC terlebih dahulu sesuai urutan, jika masih kurang tambahkan LS.
   *    (LS: Noncore Longshift kedudukannya sama dengan Noncore).
   */
  assignNonCoreAndLongshift(activeSlots, config, engine) {
    if (!Array.isArray(activeSlots) || activeSlots.length === 0) {
      return { remainingNonCore: [], remainingLs: parseInt(config.longshift || 0, 10) };
    }

    // Pastikan activeSlots terurut berdasarkan nomor CQI (CQI 1, CQI 2, CQI 3, ...)
    activeSlots.sort((a, b) => {
      const numA = parseInt(a.cqiNum || engine.getCqiNumber(a.cqi), 10) || 999;
      const numB = parseInt(b.cqiNum || engine.getCqiNumber(b.cqi), 10) || 999;
      return numA - numB;
    });

    const maxNcPerCqi = 2;
    const lsCount = parseInt(config.longshift || 0, 10);

    let nonCoreNames = [];
    if (Array.isArray(config.nonCoreData) && config.nonCoreData.length > 0) {
      nonCoreNames = config.nonCoreData
        .map((nc) =>
          typeof nc === "object" ? nc.name || "" : String(nc || ""),
        )
        .filter((n) => n.trim() !== "");
    } else if (Array.isArray(config.nonCoreNames)) {
      nonCoreNames = config.nonCoreNames
        .map((nc) =>
          typeof nc === "object" ? nc.name || "" : String(nc || ""),
        )
        .filter((n) => n.trim() !== "");
    }
    const nonCorePool = [...nonCoreNames];
    const lsPool = Array.from({ length: lsCount }, () => "(LS)");

    // Reset penugasan nonCore dan longshift di semua slot aktif
    activeSlots.forEach((s) => {
      s.nonCore = [];
      s.longshift = [];
      s.neededNcLs = 0;
    });

    // -------------------------------------------------------------------------
    // LANGKAH 2: IDENTIFIKASI CQI YANG MEMBUTUHKAN NC/LS
    // Dihitung berdasarkan beban mesin terhadap kapasitas 1 Core dasar per cluster:
    // - hanya 1 cluster: Sosoft, SKLsct, 12Ljumbo, Pouch, Botol = 4 mesin
    // - 2 cluster: Sosoft+SKLsct, Sosoft+12Ljumbo, SKLsct+12Ljumbo = 4 mesin
    // - 2 cluster: 12Ljumbo+Pouch, Pouch+Botol = 5 mesin
    // - OT (CQI 19): 2 mesin (tidak butuh NC/LS)
    // - CQI 24 (WW):
    //   * jika running 2 WW: tanpa NC/LS = 2 WW. Jika ada pouch (pouch > 0), butuh 1 NC/LS
    //   * jika running 1 WW: tanpa NC/LS = 1 WW + 3 pouch. Jika pouch > 3, butuh 1 NC/LS
    // -------------------------------------------------------------------------
    activeSlots.forEach((slot) => {
      if (slot.cqiNum === "19") {
        slot.neededNcLs = 0;
        return;
      }

      const count = slot.machines.length;
      const baseCap = engine.getBaseCoreCapacity(slot);
      const rule = engine.getClusterCapacityRule(slot);
      let needed = 0;

      if (slot.cqiNum === "24") {
        const wwIn24 = slot.machines.filter((m) => engine.isWwMachine(m)).length;
        const pouchIn24 = slot.machines.filter((m) => !engine.isWwMachine(m)).length;
        if (wwIn24 >= 2) {
          needed = pouchIn24 > 0 ? 1 : 0;
        } else if (wwIn24 === 1) {
          needed = pouchIn24 > 3 ? 1 : 0;
        } else {
          needed = count > baseCap ? 1 : 0;
        }
      } else {
        if (count > rule.max1Nc) {
          needed = 2;
        } else if (count > baseCap) {
          needed = 1;
        } else {
          needed = 0;
        }
      }

      slot.neededNcLs = Math.min(maxNcPerCqi, needed);
    });

    // -------------------------------------------------------------------------
    // LANGKAH 3: TAMBAHKAN NC TERLEBIH DAHULU SESUAI URUTAN,
    // JIKA MASIH KURANG TAMBAHKAN LS.
    // -------------------------------------------------------------------------
    const needySlots = activeSlots.filter((s) => s.neededNcLs > 0);

    // Urutkan slot yang membutuhkan NC/LS berdasarkan selisih beban terbesar
    needySlots.sort((a, b) => {
      const excessA = a.machines.length - engine.getBaseCoreCapacity(a);
      const excessB = b.machines.length - engine.getBaseCoreCapacity(b);
      if (excessB !== excessA) return excessB - excessA;
      const numA = parseInt(a.cqiNum || 99, 10);
      const numB = parseInt(b.cqiNum || 99, 10);
      return numA - numB;
    });

    // 3A. Tambahkan NC terlebih dahulu sesuai urutan ke CQI yang membutuhkan
    needySlots.forEach((slot) => {
      while (
        slot.nonCore.length + slot.longshift.length < slot.neededNcLs &&
        nonCorePool.length > 0
      ) {
        slot.nonCore.push(nonCorePool.shift());
      }
    });

    // 3B. Jika masih kurang (NC habis), tambahkan LS (kedudukan sama dengan NC)
    needySlots.forEach((slot) => {
      while (
        slot.nonCore.length + slot.longshift.length < slot.neededNcLs &&
        lsPool.length > 0
      ) {
        slot.longshift.push(lsPool.shift());
      }
    });

    // -------------------------------------------------------------------------
    // DISTRIBUSI SISA NC & LS (JIKA MASIH ADA SISA MANPOWER)
    // Ditambahkan ke CQI dengan beban tertinggi yang masih di bawah maxNcPerCqi
    // -------------------------------------------------------------------------
    const getDynamicMaxNc = (slot) => {
      if (slot.cqiNum === "19") return 0;
      if (slot.cqiNum === "24") {
        const wwIn24 = slot.machines.filter((m) => engine.isWwMachine(m)).length;
        const pouchIn24 = slot.machines.filter((m) => !engine.isWwMachine(m)).length;
        if (wwIn24 >= 2) {
          return pouchIn24 > 0 ? 1 : 0;
        } else if (wwIn24 === 1) {
          return pouchIn24 > 3 ? 1 : 0;
        }
        return 1;
      }
      const rule = engine.getClusterCapacityRule(slot);
      const count = slot.machines.length;
      const baseCap = engine.getBaseCoreCapacity(slot);
      if (count > rule.max1Nc) return 2;
      if (count > baseCap) return 1;
      return 0;
    };

    // Distribusi sisa personil hanya jika diaktifkan atau jika masih ada slot yang over capacity
    if (config.distributeAllManpower === true) {
      // Sisa Non-Core Pool terlebih dahulu
      while (nonCorePool.length > 0) {
        const eligibleSlots = activeSlots.filter(
          (s) =>
            s.nonCore.length + s.longshift.length < getDynamicMaxNc(s) &&
            s.nonCore.length + s.longshift.length < maxNcPerCqi,
        );
        if (eligibleSlots.length === 0) break;

        eligibleSlots.sort((a, b) => {
          const loadA =
            a.machines.length / (a.core + a.nonCore.length + a.longshift.length + 0.1);
          const loadB =
            b.machines.length / (b.core + b.nonCore.length + b.longshift.length + 0.1);
          return loadB - loadA;
        });

        eligibleSlots[0].nonCore.push(nonCorePool.shift());
      }

      // Sisa LS Pool jika NC sudah habis
      while (lsPool.length > 0) {
        const eligibleSlots = activeSlots.filter(
          (s) =>
            s.nonCore.length + s.longshift.length < getDynamicMaxNc(s) &&
            s.nonCore.length + s.longshift.length < maxNcPerCqi,
        );
        if (eligibleSlots.length === 0) break;

        eligibleSlots.sort((a, b) => {
          const loadA =
            a.machines.length / (a.core + a.nonCore.length + a.longshift.length + 0.1);
          const loadB =
            b.machines.length / (b.core + b.nonCore.length + b.longshift.length + 0.1);
          return loadB - loadA;
        });

        eligibleSlots[0].longshift.push(lsPool.shift());
      }
    }

    return { remainingNonCore: nonCorePool, remainingLs: lsPool.length };
  },
};
