/**
 * Modul CQI Selector
 * Bertanggung jawab memilih slot CQI aktif secara strategis dan proporsional
 * berdasarkan kebutuhan lini (Line A, B, C) serta mesin khusus (OT, WW).
 */

export default {
  /**
   * Menyeleksi CQI aktif terbaik sesuai kebutuhan riil pabrik
   * @param {Array} runningMachines - Mesin status RUNNING
   * @param {Array} availableCqis - CQI status READY/Tersedia
   * @param {number} maxCoreSlots - Jumlah kuota Core/Slot aktif
   * @param {Object} config - Konfigurasi
   * @param {Object} mapData - Data peta
   * @param {Object} engine - Instance BrainAI (this)
   * @returns {Array} Array CQI terpilih
   */
  selectActiveCQIs(runningMachines, availableCqis, maxCoreSlots, config, mapData, engine) {
    const labels = mapData.labels || [];
    const mode = parseInt(config.mode || 1, 10) === 2 ? 2 : 1;

    // Filter kategori mesin
    const wwMachines = runningMachines.filter((m) => engine.isWwMachine(m));
    const otMachines = runningMachines.filter((m) => engine.isOtMachine(m));
    const generalMachines = runningMachines.filter(
      (m) => !engine.isWwMachine(m) && !engine.isOtMachine(m),
    );

    // Cari CQI khusus
    const cqi19Obj = availableCqis.find((c) => engine.getCqiNumber(c) === "19");
    const cqi24Obj = availableCqis.find((c) => engine.getCqiNumber(c) === "24");

    const selectedCQIs = [];

    // Prioritas 1: CQI 19 jika ada mesin OT
    if (otMachines.length > 0 && cqi19Obj) {
      selectedCQIs.push(cqi19Obj);
    }

    // Prioritas 2: CQI 24 jika ada mesin WW
    if (wwMachines.length > 0 && cqi24Obj && !selectedCQIs.includes(cqi24Obj)) {
      selectedCQIs.push(cqi24Obj);
    }

    // Hitung distribusi mesin running per Line
    const lineAMachines = generalMachines.filter(
      (m) => engine.getMachineLine(m, labels) === "LINE A",
    );
    const lineBMachines = generalMachines.filter(
      (m) => engine.getMachineLine(m, labels) === "LINE B",
    );
    const lineCMachines = generalMachines.filter(
      (m) => engine.getMachineLine(m, labels) === "LINE C",
    );

    const candidateCqis = availableCqis.filter((c) => {
      const num = engine.getCqiNumber(c);
      if (selectedCQIs.includes(c)) return false;
      if (num === "19" || num === "24") return false;
      return true;
    });

    const targetSlotCap = mode === 1 ? 6.0 : 4.5;

    // Helper menghitung kebutuhan slot CQI
    const getClusterSlotDemand = (machinesInLine) => {
      if (!machinesInLine || machinesInLine.length === 0) return 0;
      const clusterCounts = {};
      machinesInLine.forEach((m) => {
        const grp = engine.getMachineClusterGroup(m);
        clusterCounts[grp] = (clusterCounts[grp] || 0) + 1;
      });
      let totalClusterSlots = 0;
      const divisor = mode === 1 ? 5.5 : 3.8;
      Object.values(clusterCounts).forEach((cnt) => {
        totalClusterSlots += Math.ceil(cnt / divisor);
      });
      return Math.max(
        Math.ceil(machinesInLine.length / targetSlotCap),
        totalClusterSlots,
      );
    };

    const neededLineC = getClusterSlotDemand(lineCMachines);
    const neededLineB = getClusterSlotDemand(lineBMachines);
    const neededLineA = getClusterSlotDemand(lineAMachines);

    let allocLineC = neededLineC;
    let allocLineB = neededLineB;
    let allocLineA = neededLineA;
    const totalNeeded = neededLineC + neededLineB + neededLineA;

    if (totalNeeded > maxCoreSlots) {
      const totalM =
        (lineCMachines.length || 0) +
        (lineBMachines.length || 0) +
        (lineAMachines.length || 0);
      if (totalM > 0) {
        allocLineC =
          lineCMachines.length > 0
            ? Math.max(1, Math.round((lineCMachines.length / totalM) * maxCoreSlots))
            : 0;
        allocLineB =
          lineBMachines.length > 0
            ? Math.max(1, Math.round((lineBMachines.length / totalM) * maxCoreSlots))
            : 0;
        allocLineA = Math.max(
          lineAMachines.length > 0 ? 1 : 0,
          maxCoreSlots - allocLineC - allocLineB,
        );
      }
    }

    // Helper seleksi CQI terbaik per line
    const maxSlotCapacity = mode === 1 ? 10 : 8;
    const coreList = Array.isArray(config.coreData) ? config.coreData : [];

    const pickBestCqisForLine = (machinesInLine, candidatePool, maxToPick) => {
      if (machinesInLine.length === 0 || maxToPick <= 0) return [];
      const mDemands = machinesInLine.map((m) => ({
        machine: m,
        ws: engine.getWorkstationKey(m, labels),
        weight: 1.0,
      }));

      const pool = [...candidatePool];
      const picked = [];

      while (picked.length < maxToPick && pool.length > 0) {
        let bestCqi = null;
        let bestScore = -Infinity;
        let bestIndex = -1;

        for (let i = 0; i < pool.length; i++) {
          const c = pool[i];
          const cqiNum = engine.getCqiNumber(c);
          const prioList = (engine.CQI_PRIORITY_MAP["cqi " + cqiNum] || []).map(
            (w) => String(w).toUpperCase(),
          );

          const unserved = mDemands
            .filter((md) => md.weight > 0.1)
            .map((md) => {
              let dist = engine.calculateDistance(md.machine, c, labels);
              const prioIdx = prioList.indexOf(md.ws);
              let prioBonus = 0;
              if (prioIdx === 0) prioBonus = 25000;
              else if (prioIdx === 1) prioBonus = 16000;
              else if (prioIdx === 2) prioBonus = 9000;
              else if (prioIdx > 2) prioBonus = Math.max(1000, 5000 - prioIdx * 1000);

              const utility = md.weight * (prioBonus + 10000 / (3 + dist));
              return { md, dist, utility };
            });

          unserved.sort((a, b) => b.utility - a.utility);
          const topK = unserved.slice(0, maxSlotCapacity);
          let totalUtility = topK.reduce((sum, item) => sum + item.utility, 0);

          // Bonus jika ada core worker preference
          const hasCorePref = coreList.some((core) => {
            const p = String(core.cqi_priority || "").trim();
            return p === cqiNum || engine.getCqiNumber(p) === cqiNum;
          });
          if (hasCorePref) totalUtility += 5000;

          // Khusus Line C: Berikan prioritas khusus untuk CQI 18 dan CQI 20
          if (cqiNum === "18") totalUtility += 3500;
          if (cqiNum === "20") totalUtility += 3000;

          if (totalUtility > bestScore) {
            bestScore = totalUtility;
            bestCqi = c;
            bestIndex = i;
          }
        }

        if (bestCqi && bestIndex >= 0) {
          picked.push(bestCqi);
          pool.splice(bestIndex, 1);

          const dists = mDemands
            .filter((md) => md.weight > 0.1)
            .map((md) => ({
              md,
              d: engine.calculateDistance(md.machine, bestCqi, labels),
            }));
          dists.sort((a, b) => a.d - b.d);

          const topCluster =
            dists.length > 0
              ? engine.getMachineClusterGroup(dists[0].md.machine)
              : null;
          const compatDists = dists.filter((item) => {
            if (!topCluster) return true;
            const cGrp = engine.getMachineClusterGroup(item.md.machine);
            return engine.isClusterMixingAllowed(
              topCluster,
              cGrp,
              engine.getCqiNumber(bestCqi),
              dists[0].md.machine,
              item.md.machine,
            );
          });

          compatDists.slice(0, maxSlotCapacity).forEach((item) => {
            item.md.weight = Math.max(0, item.md.weight - 1.0);
          });
        } else {
          break;
        }
      }

      return picked;
    };

    // 1. Seleksi CQI Line C
    if (allocLineC > 0) {
      const lineCCandidates = candidateCqis.filter(
        (c) =>
          !selectedCQIs.includes(c) &&
          (engine.getCqiPrimaryLine(c) === "LINE C" ||
            ["18", "20", "17"].includes(engine.getCqiNumber(c))),
      );
      const pickedC = pickBestCqisForLine(
        lineCMachines,
        lineCCandidates,
        Math.min(allocLineC, maxCoreSlots - selectedCQIs.length),
      );
      selectedCQIs.push(...pickedC);
    }

    // 2. Seleksi CQI Line B
    if (allocLineB > 0 && selectedCQIs.length < maxCoreSlots) {
      const lineBCandidates = candidateCqis.filter(
        (c) =>
          !selectedCQIs.includes(c) && engine.getCqiPrimaryLine(c) === "LINE B",
      );
      const pickedB = pickBestCqisForLine(
        lineBMachines,
        lineBCandidates,
        Math.min(allocLineB, maxCoreSlots - selectedCQIs.length),
      );
      selectedCQIs.push(...pickedB);
    }

    // 3. Seleksi CQI Line A
    if (allocLineA > 0 && selectedCQIs.length < maxCoreSlots) {
      const lineACandidates = candidateCqis.filter(
        (c) =>
          !selectedCQIs.includes(c) && engine.getCqiPrimaryLine(c) === "LINE A",
      );
      const pickedA = pickBestCqisForLine(
        lineAMachines,
        lineACandidates,
        Math.min(allocLineA, maxCoreSlots - selectedCQIs.length),
      );
      selectedCQIs.push(...pickedA);
    }

    // 4. Isi sisa slot dari kandidat global terbaik
    if (selectedCQIs.length < maxCoreSlots) {
      const remainingCqis = candidateCqis.filter(
        (c) => !selectedCQIs.includes(c),
      );
      const pickedRemaining = pickBestCqisForLine(
        generalMachines,
        remainingCqis,
        maxCoreSlots - selectedCQIs.length,
      );
      selectedCQIs.push(...pickedRemaining);
    }

    return selectedCQIs;
  },
};
