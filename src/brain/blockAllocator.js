/**
 * Modul Block Allocator (Human-Like Planning Engine)
 * Mengelompokkan mesin menjadi Workstation Blocks dan mengalokasikannya ke CQI.
 * Mengutamakan keutuhan zona/line, kontinuitas workstation, dan kemurnian cluster.
 */

export default {
  /**
   * Mengelompokkan mesin running menjadi Workstation Blocks berdasarkan Workstation & Cluster Group
   */
  buildWorkstationBlocks(generalMachines, labels, engine) {
    const wsBlocks = {};
    generalMachines.forEach((m) => {
      const ws = engine.getWorkstationKey(m, labels);
      const clusterGroup = engine.getMachineClusterGroup(m);
      const wsClusterKey = `${ws}_${clusterGroup}`;

      if (!wsBlocks[wsClusterKey]) {
        wsBlocks[wsClusterKey] = {
          ws,
          wsClusterKey,
          machines: [],
          cluster: clusterGroup,
          line: ws.endsWith("A")
            ? "LINE A"
            : ws.endsWith("B")
              ? "LINE B"
              : ws.endsWith("C")
                ? "LINE C"
                : "OTHER",
          col: 99,
          row: 99,
        };

        const lbl = labels.find(
          (l) =>
            l.name === ws ||
            engine.normalizeName(l.name) === engine.normalizeName(ws),
        );
        if (lbl) {
          wsBlocks[wsClusterKey].col = lbl.col;
          wsBlocks[wsClusterKey].row = lbl.row;
        } else if (m.position) {
          wsBlocks[wsClusterKey].col = m.position.col || 99;
          wsBlocks[wsClusterKey].row = m.position.row || 99;
        } else if (m.col) {
          wsBlocks[wsClusterKey].col = m.col;
          wsBlocks[wsClusterKey].row = m.row || 99;
        }
      }
      wsBlocks[wsClusterKey].machines.push(m);
    });

    return wsBlocks;
  },

  /**
   * Evaluasi Afinasi Human-Like Planning untuk penempatan satu Workstation Block ke Slot CQI
   * (Semakin rendah skor = semakin ideal dan selaras dengan pertimbangan supervisor manusia)
   */
  evaluateBlockAffinity(block, slot, engine, mapData, generalSlots, sortedWsBlocks, runningMachines) {
    const labels = mapData.labels || [];
    const cqiNum = slot.cqiNum;
    const prioKey = "cqi " + cqiNum;
    const wsPrioList = (engine.CQI_PRIORITY_MAP[prioKey] || []).map((w) =>
      String(w).toUpperCase(),
    );
    const wsKey = block.ws;
    const slotPrimaryLine = engine.getCqiPrimaryLine(slot.cqi);

    let score = 0;

    // 1. CEK JARAK EKSTREM (Dilarang Ujung Timur ke Ujung Barat)
    if (engine.isFarWorkstationForCqi(wsKey, cqiNum)) {
      score += 30000; // Penalti mutlak
    }

    // 2. STIK PETA PRIORITAS CQI (CQI Priority Map Rank)
    const prioIdx = wsPrioList.indexOf(wsKey);
    if (prioIdx === 0) {
      score -= 25000; // Prioritas utama primer
    } else if (prioIdx === 1) {
      score -= 16000; // Prioritas sekunder
    } else if (prioIdx === 2) {
      score -= 10000; // Prioritas tersier
    } else if (prioIdx > 2) {
      score -= Math.max(2000, 5000 - prioIdx * 1000);
    } else {
      score += 4000; // Tidak ada di peta prioritas CQI ini
    }

    // 3. HUMAN-LIKE RULE: KESELARASAN LINE & TERITORIALITAS (Cegah Cross-Line)
    if (cqiNum === "15") {
      if (block.line === "LINE B") {
        score -= 5000; // CQI 15 utamakan Line B
      } else if (block.line === "LINE C") {
        const wsUpper = wsKey.toUpperCase();
        if (wsUpper === "1C" || wsUpper === "2C") {
          score -= 1000; // Boleh untuk 1C/2C
        } else {
          score += 8000; // Penalti berat untuk Line C jauh (3C-10C)
        }
      } else {
        score += 8000; // Penalti berat untuk Line A
      }
    } else if (block.line === "LINE C") {
      if (slotPrimaryLine === "LINE C") {
        score -= 18000; // Dominansi mutlak: Mesin Line C wajib di CQI Line C
      } else {
        score += 25000; // Penalti berat: Cegah mesin Line C keluar ke A/B
      }
    } else if (slotPrimaryLine === "LINE C") {
      score += 25000; // Penalti berat: Cegah mesin Line A/B masuk ke Line C
    } else if (slotPrimaryLine === block.line) {
      score -= 15000; // Prioritas tinggi: Tetap di line yang sama (Line A -> Line A, Line B -> Line B)
    } else {
      // Cross-line antara Line A dan Line B
      const allFactoryMachines = mapData.machines || runningMachines;
      const isEligibleCross = block.machines.every((m) =>
        engine.isCrossLineAllowed(
          m,
          slot.cqi,
          runningMachines,
          allFactoryMachines,
          labels,
        ),
      );
      if (isEligibleCross) {
        score += 2000;
      } else {
        score += 15000; // Larang cross-line jika mesin di line asalnya belum ter-cover
      }
    }

    // 4. HUMAN-LIKE RULE: KONTINUITAS & KEUTUHAN WORKSTATION
    const sameWsCount = slot.machines.filter(
      (sm) => engine.getWorkstationKey(sm, labels) === wsKey,
    ).length;
    if (sameWsCount > 0) {
      score -= 4000; // Jaga keutuhan workstation (jangan memecah workstation)
    }

    // Penggabungan Workstation Bersebelahan pada Line yang Sama (misal 8A + 9A)
    const slotWsKeys = slot.machines.map((sm) =>
      engine.getWorkstationKey(sm, labels),
    );
    const currentWsNums = slotWsKeys
      .map((w) => parseInt(w.replace(/\D/g, ""), 10))
      .filter((n) => !isNaN(n));
    const blockWsNum = parseInt(wsKey.replace(/\D/g, ""), 10);
    const isAdjacent = currentWsNums.some(
      (n) => Math.abs(n - blockWsNum) === 1,
    );
    const isSameWs = currentWsNums.some((n) => n === blockWsNum);
    const sameLine = slotWsKeys.some((w) => w.slice(-1) === wsKey.slice(-1));

    if (
      sameLine &&
      isAdjacent &&
      slot.machines.length + block.machines.length <= slot.maxAllowedMachines
    ) {
      score -= 6000; // Prioritas kuat: satukan lorong bersebelahan (misal 4A+5A, 6A+7A, 8A+9A)
    } else if (sameLine && currentWsNums.length > 0 && !isSameWs) {
      const minDiff = Math.min(
        ...currentWsNums.map((n) => Math.abs(n - blockWsNum)),
      );
      if (minDiff > 1) {
        // LARANGAN KERAS: Melompati lorong orang lain (misal 4A dan 8A melompati 5A, 6A, 7A)
        score += minDiff * 12000 + 25000;
      }
    } else if (sameLine) {
      score -= 800;
    }

    // 5. HUMAN-LIKE RULE: KEMURNIAN CLUSTER (Cluster Purity Bonus)
    if (slot.machines.length > 0) {
      const existingClusters = new Set(
        slot.machines.map((sm) => engine.getMachineClusterGroup(sm)),
      );
      if (existingClusters.has(block.cluster)) {
        score -= 2500; // Bonus kemurnian cluster: sama dengan cluster yang sudah ada di slot
      }
    }

    // 6. JARAK TEMPUH LORONG PABRIK
    const sampleMachine = block.machines[0];
    const dist = engine.calculateDistance(sampleMachine, slot.cqi, labels);
    score += dist * 40;
    if (dist > 10) {
      score += (dist - 10) * 200;
    }

    // 7. BEBAN MERATA & ERGONOMIS HUMAN-LIKE
    if (slotPrimaryLine === block.line) {
      const lineSlots = generalSlots.filter(
        (s) => engine.getCqiPrimaryLine(s.cqi) === block.line,
      );
      const lineTotalMachines = sortedWsBlocks
        .filter((b) => b.line === block.line)
        .reduce((acc, b) => acc + b.machines.length, 0);
      const targetQuota =
        lineSlots.length > 0
          ? Math.ceil(lineTotalMachines / lineSlots.length)
          : slot.maxAllowedMachines;

      if (slot.machines.length >= targetQuota) {
        score += (slot.machines.length - targetQuota + 1) * 500;
      } else {
        score += slot.machines.length * 50;
      }
    }

    // 8. AFINASI LEARNING MATRIX / RIWAYAT HISTORIS
    let blockHistoryBonus = 0;
    block.machines.forEach((m) => {
      blockHistoryBonus += engine.getHistoryBonus(m, slot.cqi);
    });
    score -= blockHistoryBonus * 30;

    return score;
  },

  /**
   * Mengalokasikan seluruh mesin running ke CQI Slots
   */
  allocateMachinesToSlots(slots, machines, config, mapData, engine) {
    const labels = mapData.labels || [];
    const mode = parseInt(config.mode || 1, 10) === 2 ? 2 : 1;
    const maxSlotCapacity = mode === 1 ? 10 : 8;

    let ncCount = 0;
    if (Array.isArray(config.nonCoreData) && config.nonCoreData.length > 0) {
      ncCount = config.nonCoreData.length;
    } else if (Array.isArray(config.nonCoreNames)) {
      ncCount = config.nonCoreNames.length;
    }
    const lsCount = parseInt(config.longshift || 0, 10);
    const totalNcPool = ncCount + lsCount;

    const runningMachines = [...machines];
    const wwMachines = runningMachines.filter((m) => engine.isWwMachine(m));
    const otMachines = runningMachines.filter((m) => engine.isOtMachine(m));
    const generalMachines = runningMachines.filter(
      (m) => !engine.isWwMachine(m) && !engine.isOtMachine(m),
    );

    const slot24 = slots.find((s) => s.cqiNum === "24");
    const slot19 = slots.find((s) => s.cqiNum === "19");
    if (slot19) {
      slot19.maxAllowedMachines = 2;
    }

    // PASS 1: Mesin OT (M2 & M3) -> Strictly CQI 19
    if (otMachines.length > 0 && slot19) {
      otMachines.slice(0, 2).forEach((m) => {
        if (!slot19.machines.some((sm) => sm.id === m.id || sm.name === m.name)) {
          slot19.machines.push(m);
        }
      });
    }

    // PASS 2: Mesin WW -> Strictly CQI 24
    if (wwMachines.length > 0 && slot24) {
      wwMachines.forEach((m) => {
        if (
          slot24.machines.length < slot24.maxAllowedMachines &&
          !slot24.machines.some((sm) => sm.id === m.id || sm.name === m.name)
        ) {
          slot24.machines.push(m);
        }
      });
    }

    // PASS 3: Alokasi Mesin Umum per Workstation Block
    const wsBlocks = this.buildWorkstationBlocks(generalMachines, labels, engine);
    const excludedCqiNums = new Set(["19", "24"]);
    const generalSlots = slots.filter((s) => {
      const num = String(s.cqiNum || engine.getCqiNumber(s.cqi) || "").trim();
      return !excludedCqiNums.has(num);
    });

    const allFactoryMachines = mapData.machines || runningMachines;

    // --- PASS 3A: ANCHOR PRIMARY WORKSTATION MATCHING ---
    // Setiap CQI aktif mengamankan workstation utamanya (lorong tempat CQI berada) terlebih dahulu
    // Mencegah slot CQI direbut oleh workstation tetangga sebelum workstation utamanya masuk
    generalSlots.forEach((slot) => {
      const prioKey = "cqi " + slot.cqiNum;
      const prioList = engine.CQI_PRIORITY_MAP[prioKey] || [];
      if (prioList.length === 0) return;

      // Ambil workstation anchor utama (misal: 5A untuk CQI 5, 7A untuk CQI 7, 8A untuk CQI 8, 10A untuk CQI 10, 3A untuk CQI 3, 1A & 0A untuk CQI 1)
      const primaryWsList = [String(prioList[0]).toUpperCase()];
      if (slot.cqiNum === "1" && prioList.includes("0A")) {
        primaryWsList.push("0A");
      }

      primaryWsList.forEach((primaryWs) => {
        const matchingKeys = Object.keys(wsBlocks).filter((k) => {
          const b = wsBlocks[k];
          return b.ws.toUpperCase() === primaryWs && b.machines.length > 0;
        });

        matchingKeys.forEach((key) => {
          const anchorBlock = wsBlocks[key];
          const validMachines = anchorBlock.machines.filter((m) =>
            engine.canAddMachineToSlot(
              m,
              slot,
              runningMachines,
              allFactoryMachines,
              labels,
            ),
          );

          const limit = slot.maxAllowedMachines || maxSlotCapacity;
          const availableSpace = limit - slot.machines.length;
          if (availableSpace > 0 && validMachines.length > 0) {
            const toAdd = validMachines.slice(0, availableSpace);
            slot.machines.push(...toAdd);
            anchorBlock.machines = anchorBlock.machines.filter((m) => !toAdd.includes(m));
          }
        });
      });
    });

    // --- PASS 3B: ADJACENT PAIR EXPANSION ---
    // Setelah anchor terkunci, slot CQI memperluas jangkauannya hanya ke workstation lorong yang berdampingan langsung (selisih 1 lorong)
    generalSlots.forEach((slot) => {
      const prioKey = "cqi " + slot.cqiNum;
      const prioList = (engine.CQI_PRIORITY_MAP[prioKey] || []).map((w) =>
        String(w).toUpperCase(),
      );
      if (prioList.length < 2) return;

      const adjacentWsList = prioList.slice(1);

      adjacentWsList.forEach((adjWs) => {
        const matchingKeys = Object.keys(wsBlocks).filter((k) => {
          const b = wsBlocks[k];
          return b.ws.toUpperCase() === adjWs && b.machines.length > 0;
        });

        matchingKeys.forEach((key) => {
          const adjBlock = wsBlocks[key];
          const validMachines = adjBlock.machines.filter((m) =>
            engine.canAddMachineToSlot(
              m,
              slot,
              runningMachines,
              allFactoryMachines,
              labels,
            ),
          );

          const limit = slot.maxAllowedMachines || maxSlotCapacity;
          const availableSpace = limit - slot.machines.length;
          if (availableSpace > 0 && validMachines.length > 0) {
            const toAdd = validMachines.slice(0, availableSpace);
            slot.machines.push(...toAdd);
            adjBlock.machines = adjBlock.machines.filter((m) => !toAdd.includes(m));
          }
        });
      });
    });

    const lineOrder = { "LINE C": 1, "LINE A": 2, "LINE B": 3, OTHER: 4 };
    const sortedWsBlocks = Object.values(wsBlocks)
      .filter((b) => b.machines.length > 0)
      .sort((a, b) => {
        const ordA = lineOrder[a.line] || 9;
        const ordB = lineOrder[b.line] || 9;
        if (ordA !== ordB) return ordA - ordB;
        return a.col - b.col;
      });

    // --- PASS 3C: GENERAL BLOCK ALLOCATION (SISA BLOK) ---
    sortedWsBlocks.forEach((block) => {
      if (block.machines.length === 0) return;
      const blockMachines = [...block.machines];

      let validSlots = generalSlots.filter((s) =>
        blockMachines.every((m) =>
          engine.canAddMachineToSlot(
            m,
            s,
            runningMachines,
            allFactoryMachines,
            labels,
          ),
        ),
      );

      if (validSlots.length === 0) {
        validSlots = generalSlots.filter((s) =>
          blockMachines.some((m) =>
            engine.canAddMachineToSlot(
              m,
              s,
              runningMachines,
              allFactoryMachines,
              labels,
            ),
          ),
        );
      }
      if (validSlots.length === 0) {
        validSlots = generalSlots;
      }

      validSlots.sort(
        (a, b) =>
          this.evaluateBlockAffinity(block, a, engine, mapData, generalSlots, sortedWsBlocks, runningMachines) -
          this.evaluateBlockAffinity(block, b, engine, mapData, generalSlots, sortedWsBlocks, runningMachines),
      );

      let remainingInBlock = [...blockMachines];

      const lineSlots = generalSlots.filter(
        (s) => engine.getCqiPrimaryLine(s.cqi) === block.line,
      );
      const lineTotalMachines = Object.values(wsBlocks)
        .filter((b) => b.line === block.line)
        .reduce((acc, b) => acc + (b.machines.length + generalSlots.reduce((sAcc, s) => sAcc + s.machines.filter(m => engine.getWorkstationKey(m, labels) === b.ws).length, 0)), 0);
      const avgLineLoad =
        lineSlots.length > 0
          ? Math.ceil(lineTotalMachines / lineSlots.length)
          : maxSlotCapacity;

      for (const targetSlot of validSlots) {
        if (remainingInBlock.length === 0) break;
        const targetCapacity = Math.min(
          targetSlot.maxAllowedMachines || maxSlotCapacity,
          Math.max(
            engine.getDynamicSlotLimit(targetSlot, mode, totalNcPool, slots),
            avgLineLoad,
          ),
        );
        const availableSpace = targetCapacity - targetSlot.machines.length;
        if (availableSpace <= 0) continue;

        const validToInsert = remainingInBlock.filter((m) =>
          engine.canAddMachineToSlot(
            m,
            targetSlot,
            runningMachines,
            allFactoryMachines,
            labels,
          ),
        );
        const canTake = Math.min(availableSpace, validToInsert.length);
        if (canTake > 0) {
          const taken = validToInsert.slice(0, canTake);
          targetSlot.machines.push(...taken);
          remainingInBlock = remainingInBlock.filter((m) => !taken.includes(m));
        }
      }

      // Fallback untuk sisa blok jika slot awal penuh
      if (remainingInBlock.length > 0) {
        let stillRemaining = [...remainingInBlock];
        const compatibleSlots = generalSlots.filter((s) =>
          stillRemaining.some((m) =>
            engine.canAddMachineToSlot(
              m,
              s,
              runningMachines,
              allFactoryMachines,
              labels,
            ),
          ),
        );
        let fallbacks = (
          compatibleSlots.length > 0 ? compatibleSlots : generalSlots
        ).sort((a, b) => {
          const aLine = engine.getCqiPrimaryLine(a.cqi);
          const bLine = engine.getCqiPrimaryLine(b.cqi);
          const aSame = aLine === block.line ? 0 : 1;
          const bSame = bLine === block.line ? 0 : 1;
          if (aSame !== bSame) return aSame - bSame;
          const distA = engine.calculateDistance(block.machines[0], a.cqi, labels);
          const distB = engine.calculateDistance(block.machines[0], b.cqi, labels);
          if (distA !== distB) return distA - distB;
          return a.machines.length - b.machines.length;
        });

        for (const fb of fallbacks) {
          if (stillRemaining.length === 0) break;
          const available = engine.getDynamicSlotLimit(fb, mode, totalNcPool, slots) - fb.machines.length;
          if (available <= 0) continue;

          const validToInsert = stillRemaining.filter((m) =>
            engine.canAddMachineToSlot(
              m,
              fb,
              runningMachines,
              allFactoryMachines,
              labels,
            ),
          );
          const toPush = validToInsert.slice(0, available);
          if (toPush.length > 0) {
            fb.machines.push(...toPush);
            stillRemaining = stillRemaining.filter((m) => !toPush.includes(m));
          }
        }
      }
    });

    return { generalSlots, sortedWsBlocks, slot24 };
  },
};
