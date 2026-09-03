/**
 * Modul Unassigned Fitter
 * Bertanggung jawab memaksa alokasi mesin sisa (unassigned/uncovered)
 * ke CQI yang paling memungkinkan dengan perpindahan pintar (smart shift/swap).
 */

import manpowerAssigner from './manpowerAssigner.js';

export default {
  /**
   * Menghitung skor kelayakan slot CQI terhadap mesin sisa
   */
  getSlotProximityScore(m, slot, engine, labels) {
    const cqiNum = String(slot.cqiNum || engine.getCqiNumber(slot.cqi));
    const prioKey = "cqi " + cqiNum;
    const wsPrioList = (engine.CQI_PRIORITY_MAP[prioKey] || []).map((w) =>
      String(w).toUpperCase(),
    );
    const wsKey = engine.getWorkstationKey(m, labels).toUpperCase();
    const mLine = engine.getMachineLine(m, labels);
    const slotPrimaryLine = engine.getCqiPrimaryLine(slot.cqi);

    let score = 0;

    // 1. Peta Prioritas CQI
    const prioIdx = wsPrioList.indexOf(wsKey);
    if (prioIdx === 0) score -= 22000;
    else if (prioIdx === 1) score -= 15000;
    else if (prioIdx === 2) score -= 9000;
    else if (prioIdx > 2) score -= Math.max(2000, 5000 - prioIdx * 1000);
    else score += 3500;

    // 2. Keselarasan Line (Utamakan tetap di Line yang sama)
    if (cqiNum === "15") {
      if (mLine === "LINE B") {
        score -= 3200;
      } else if (mLine === "LINE C") {
        if (wsKey === "1C" || wsKey === "2C") score += 200;
        else score += 5000;
      } else {
        score += 3500;
      }
    } else if (mLine === slotPrimaryLine) {
      score -= 3000;
    } else {
      if (mLine === "LINE C" || slotPrimaryLine === "LINE C") {
        score += 6000;
      } else {
        score += 3800;
      }
    }

    // 3. Jarak fisik
    const dist = engine.calculateDistance(m, slot.cqi, labels);
    score += dist * 25;

    // 4. Keutuhan Workstation
    const sameWsCount = slot.machines.filter(
      (sm) => engine.getWorkstationKey(sm, labels).toUpperCase() === wsKey,
    ).length;
    if (sameWsCount > 0) {
      score -= 1000;
    }

    // 5. Riwayat Pembelajaran
    const histBonus = engine.getHistoryBonus(m, slot.cqi);
    score -= histBonus * 30;

    // 6. Beban mesin terpasang
    score += slot.machines.length * 50;

    // 7. Aturan Khusus CQI 24 (Utamakan 1 workstation, maksimal 2 workstation)
    if (cqiNum === "24" && engine.isMachineLineC(m, labels)) {
      const nonWw = slot.machines.filter((sm) => !engine.isWwMachine(sm));
      const existingWs = new Set(
        nonWw.map((sm) => engine.getWorkstationKey(sm, labels).toUpperCase()),
      );
      if (existingWs.has(wsKey)) {
        score -= 25000; // Sangat prioritaskan 1 workstation yang sama
      } else if (existingWs.size === 0) {
        score -= 8000; // Workstation pertama
      } else if (existingWs.size === 1) {
        score += 2000; // Workstation ke-2 (boleh tetapi lebih rendah dari workstation yang sama)
      } else {
        score += 999999; // Dilarang workstation ke-3
      }
    }

    return score;
  },

  /**
   * Memaksa alokasi mesin sisa secara presisi dan terstruktur
   */
  forceFit(slots, unassignedMachines, config, mapData, engine) {
    if (!Array.isArray(slots) || slots.length === 0) return slots;

    let remaining = Array.isArray(unassignedMachines)
      ? [...unassignedMachines]
      : slots.unassignedMachines
        ? [...slots.unassignedMachines]
        : [];

    if (remaining.length === 0) {
      slots.unassignedMachines = [];
      slots.uncoveredMachines = [];
      return slots;
    }

    const labels = mapData.labels || [];
    const mode = parseInt(config.mode || 1, 10) === 2 ? 2 : 1;

    let ncCount = 0;
    if (Array.isArray(config.nonCoreData) && config.nonCoreData.length > 0) {
      ncCount = config.nonCoreData.length;
    } else if (Array.isArray(config.nonCoreNames)) {
      ncCount = config.nonCoreNames.length;
    }
    const lsCount = parseInt(config.longshift || 0, 10);
    const totalNcPool = ncCount + lsCount;

    const isSlotEligibleForMachine = (slot, m) => {
      if (slot.cqiNum === "19") {
        return engine.isOtMachine(m);
      }
      if (slot.cqiNum === "24") {
        if (engine.isWwMachine(m)) return true;
        if (engine.isMachineLineC(m, labels)) {
          const nonWw = slot.machines.filter((sm) => !engine.isWwMachine(sm));
          if (nonWw.length >= 4) return false;
          if (
            !engine.isPouchMachine(m) &&
            !String(m.name || m.id || "").toUpperCase().startsWith("APK")
          ) {
            return false;
          }
          const mWs = engine.getWorkstationKey(m, labels).toUpperCase();
          const existingWs = new Set(
            nonWw.map((sm) => engine.getWorkstationKey(sm, labels).toUpperCase()),
          );
          if (existingWs.has(mWs)) return true;
          if (existingWs.size >= 2) return false; // Dilarang workstation ke-3
          return true;
        }
        return false;
      }
      if (slot.cqiNum === "15" && engine.isMachineLineC(m, labels)) {
        const ws = engine.getWorkstationKey(m, labels).toUpperCase();
        if (ws !== "1C" && ws !== "2C") return false;
      }
      return engine.canAddMachineToSlotCluster(m, slot);
    };

    // STEP 1: Direct insertion ke CQI TERDEKAT & PALING KOMPATIBEL
    let directProgress = true;
    while (remaining.length > 0 && directProgress) {
      directProgress = false;

      for (let i = 0; i < remaining.length; i++) {
        const m = remaining[i];

        const eligibleSlots = slots.filter((slot) => {
          const slotLimit = engine.getDynamicSlotLimit(
            slot,
            mode,
            totalNcPool,
            slots,
          );
          slot.maxAllowedMachines = slotLimit;
          if (slot.machines.length >= slotLimit) return false;

          return isSlotEligibleForMachine(slot, m);
        });

        if (eligibleSlots.length > 0) {
          eligibleSlots.sort(
            (a, b) =>
              this.getSlotProximityScore(m, a, engine, labels) -
              this.getSlotProximityScore(m, b, engine, labels),
          );

          const bestSlot = eligibleSlots[0];
          bestSlot.machines.push(m);
          remaining.splice(i, 1);
          directProgress = true;
          break;
        }
      }
    }

    // STEP 2: Estafet Shift/Swap jika direct insertion gagal
    if (remaining.length > 0) {
      let shiftProgress = true;
      while (remaining.length > 0 && shiftProgress) {
        shiftProgress = false;

        for (let rIdx = 0; rIdx < remaining.length; rIdx++) {
          const unassignedM = remaining[rIdx];
          const mLine = engine.getMachineLine(unassignedM, labels);

          const sortedTargetSlots = [...slots].sort((a, b) => {
            const aLine = engine.getCqiPrimaryLine(a.cqi);
            const bLine = engine.getCqiPrimaryLine(b.cqi);
            const aSame = aLine === mLine ? 0 : 1;
            const bSame = bLine === mLine ? 0 : 1;
            if (aSame !== bSame) return aSame - bSame;

            return (
              this.getSlotProximityScore(unassignedM, a, engine, labels) -
              this.getSlotProximityScore(unassignedM, b, engine, labels)
            );
          });

          let placed = false;

          for (const targetSlot of sortedTargetSlots) {
            if (placed) break;
            if (!isSlotEligibleForMachine(targetSlot, unassignedM)) continue;

            const targetLimit = engine.getDynamicSlotLimit(
              targetSlot,
              mode,
              totalNcPool,
              slots,
            );
            targetSlot.maxAllowedMachines = targetLimit;

            // Jika targetSlot masih ada tempat langsung
            if (targetSlot.machines.length < targetLimit) {
              targetSlot.machines.push(unassignedM);
              remaining.splice(rIdx, 1);
              placed = true;
              shiftProgress = true;
              break;
            }

            // Jika targetSlot penuh, cari donorSlot untuk pergeseran estafet
            const candidateDonors = slots.filter((s) => s !== targetSlot);
            candidateDonors.sort((a, b) => {
              const aLine = engine.getCqiPrimaryLine(a.cqi);
              const bLine = engine.getCqiPrimaryLine(b.cqi);
              const aSame = aLine === mLine ? 0 : 1;
              const bSame = bLine === mLine ? 0 : 1;
              if (aSame !== bSame) return aSame - bSame;
              return a.machines.length - b.machines.length;
            });

            for (const donorSlot of candidateDonors) {
              if (placed) break;

              const donorLimit = engine.getDynamicSlotLimit(
                donorSlot,
                mode,
                totalNcPool,
                slots,
              );
              if (donorSlot.machines.length >= donorLimit) continue;

              for (let i = 0; i < targetSlot.machines.length; i++) {
                const mToMove = targetSlot.machines[i];
                if (isSlotEligibleForMachine(donorSlot, mToMove)) {
                  targetSlot.machines.splice(i, 1);
                  donorSlot.machines.push(mToMove);

                  if (isSlotEligibleForMachine(targetSlot, unassignedM)) {
                    targetSlot.machines.push(unassignedM);
                    remaining.splice(rIdx, 1);
                    placed = true;
                    shiftProgress = true;
                    break;
                  } else {
                    // Rollback
                    donorSlot.machines.pop();
                    targetSlot.machines.splice(i, 0, mToMove);
                  }
                }
              }
            }
          }

          if (placed) break;
        }
      }
    }

    // STEP 3: Fallback Absolute Max Insertion
    if (remaining.length > 0) {
      for (let rIdx = remaining.length - 1; rIdx >= 0; rIdx--) {
        const unassignedM = remaining[rIdx];
        const mLine = engine.getMachineLine(unassignedM, labels);
        const wsKey = engine.getWorkstationKey(unassignedM, labels).toUpperCase();

        const eligibleSlots = slots.filter((slot) => {
          const rule = engine.getClusterCapacityRule([...slot.machines, unassignedM]);
          if (slot.machines.length >= rule.absoluteMax) return false;
          return isSlotEligibleForMachine(slot, unassignedM);
        });

        if (eligibleSlots.length > 0) {
          eligibleSlots.sort((a, b) => {
            const aLine = engine.getCqiPrimaryLine(a.cqi);
            const bLine = engine.getCqiPrimaryLine(b.cqi);
            const aSame = aLine === mLine ? 0 : 1;
            const bSame = bLine === mLine ? 0 : 1;
            if (aSame !== bSame) return aSame - bSame;

            const prioKeyA = "cqi " + a.cqiNum;
            const prioKeyB = "cqi " + b.cqiNum;
            const prioListA = (engine.CQI_PRIORITY_MAP[prioKeyA] || []).map((w) =>
              String(w).toUpperCase(),
            );
            const prioListB = (engine.CQI_PRIORITY_MAP[prioKeyB] || []).map((w) =>
              String(w).toUpperCase(),
            );
            const idxA = prioListA.indexOf(wsKey);
            const idxB = prioListB.indexOf(wsKey);
            const pA = idxA >= 0 ? idxA : 99;
            const pB = idxB >= 0 ? idxB : 99;
            if (pA !== pB) return pA - pB;

            const distA = engine.calculateDistance(unassignedM, a.cqi, labels);
            const distB = engine.calculateDistance(unassignedM, b.cqi, labels);
            if (distA !== distB) return distA - distB;

            return a.machines.length - b.machines.length;
          });

          eligibleSlots[0].machines.push(unassignedM);
          remaining.splice(rIdx, 1);
        }
      }
    }

    // STEP 4: Sinkronisasi Ulang Manpower Non-Core & Longshift
    const activeSlots = slots.filter((s) => s.machines.length > 0);
    const { remainingNonCore, remainingLs } =
      manpowerAssigner.assignNonCoreAndLongshift(activeSlots, config, mode, engine);

    slots.unassignedMachines = remaining;
    slots.uncoveredMachines = remaining;
    slots.remainingLs = remainingLs;
    slots.remainingNonCore = remainingNonCore;

    return slots;
  },
};
