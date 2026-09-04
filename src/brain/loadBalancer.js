/**
 * Modul Load Balancer & Overflow Engine
 * Menyeimbangkan beban antar CQI dalam 1 Line (Intra-line load balancing)
 * serta menangani overflow APK Line C ke CQI 24 dan pengalokasian mesin sisa.
 */

export default {
  /**
   * Menyeimbangkan beban mesin secara adil dan ergonomis antar CQI pada Line yang sama (Line C, Line A, Line B)
   */
  balanceIntraLineLoad(generalSlots, totalNcPool, slots, mapData, engine) {
    const labels = mapData.labels || [];
    const linesToBalance = ["LINE C", "LINE A", "LINE B"];

    linesToBalance.forEach((lineName) => {
      const lineSlots = generalSlots.filter(
        (s) => engine.getCqiPrimaryLine(s.cqi) === lineName,
      );
      if (lineSlots.length < 2) return;

      let improved = true;
      let iterations = 0;
      while (improved && iterations < 20) {
        improved = false;
        iterations++;

        lineSlots.sort((a, b) => b.machines.length - a.machines.length);
        const maxSlot = lineSlots[0];
        const minSlot = lineSlots[lineSlots.length - 1];

        const diff = maxSlot.machines.length - minSlot.machines.length;
        if (diff <= 1) break;

        const wsMapInMax = {};
        maxSlot.machines.forEach((m) => {
          const ws = engine.getWorkstationKey(m, labels);
          if (!wsMapInMax[ws]) wsMapInMax[ws] = [];
          wsMapInMax[ws].push(m);
        });

        const wsKeysInMax = Object.keys(wsMapInMax);
        if (wsKeysInMax.length === 0) break;

        let bestWsCandidate = null;
        let bestTransferScore = -Infinity;

        for (const wsKey of wsKeysInMax) {
          const group = wsMapInMax[wsKey];
          const groupSize = group.length;

          if (
            minSlot.machines.length + groupSize >
            engine.getDynamicSlotLimit(minSlot, totalNcPool, slots)
          )
            continue;

          if (
            maxSlot.machines.length - groupSize <
            minSlot.machines.length + groupSize - 1
          ) {
            if (
              groupSize > 1 &&
              maxSlot.machines.length - groupSize < minSlot.machines.length
            )
              continue;
          }

          if (engine.isFarWorkstationForCqi(wsKey, minSlot.cqiNum)) continue;

          // Cek kontinuitas lorong: cegah CQI mengambil workstation yang melompati lorong orang lain (> 1 lorong)
          const minWsNums = minSlot.machines
            .map((m) =>
              parseInt(
                engine.getWorkstationKey(m, labels).replace(/\D/g, ""),
                10,
              ),
            )
            .filter((n) => !isNaN(n));
          const candWsNum = parseInt(wsKey.replace(/\D/g, ""), 10);
          if (minWsNums.length > 0 && !isNaN(candWsNum)) {
            const minDiff = Math.min(
              ...minWsNums.map((n) => Math.abs(n - candWsNum)),
            );
            if (minDiff > 1) continue;
          }

          const clusterValid = group.every((m) =>
            engine.canAddMachineToSlotCluster(m, minSlot),
          );
          if (!clusterValid) continue;

          const sampleM = group[0];
          const distToMin = engine.calculateDistance(
            sampleM,
            minSlot.cqi,
            labels,
          );
          const distToMax = engine.calculateDistance(
            sampleM,
            maxSlot.cqi,
            labels,
          );

          const prioKeyMin = "cqi " + minSlot.cqiNum;
          const prioListMin = (engine.CQI_PRIORITY_MAP[prioKeyMin] || []).map(
            (w) => String(w).toUpperCase(),
          );
          const prioIdxMin = prioListMin.indexOf(wsKey);

          let transferScore =
            1000 - distToMin + (distToMax >= distToMin ? 500 : 0);
          if (prioIdxMin === 0) transferScore += 25000;
          else if (prioIdxMin === 1) transferScore += 16000;
          else if (prioIdxMin === 2) transferScore += 9000;
          else if (prioIdxMin > 2)
            transferScore += Math.max(1000, 5000 - prioIdxMin * 1000);

          if (transferScore > bestTransferScore) {
            bestTransferScore = transferScore;
            bestWsCandidate = { wsKey, machines: group };
          }
        }

        if (bestWsCandidate) {
          const movingIds = new Set(
            bestWsCandidate.machines.map((m) => m.id || m.name),
          );
          maxSlot.machines = maxSlot.machines.filter(
            (m) => !movingIds.has(m.id || m.name),
          );
          minSlot.machines.push(...bestWsCandidate.machines);
          improved = true;
          continue;
        }

        for (const wsKey of wsKeysInMax) {
          if (engine.isFarWorkstationForCqi(wsKey, minSlot.cqiNum)) continue;
          const group = wsMapInMax[wsKey];
          const candWsNum = parseInt(wsKey.replace(/\D/g, ""), 10);
          const minWsNums = minSlot.machines
            .map((m) =>
              parseInt(
                engine.getWorkstationKey(m, labels).replace(/\D/g, ""),
                10,
              ),
            )
            .filter((n) => !isNaN(n));
          if (minWsNums.length > 0 && !isNaN(candWsNum)) {
            const minDiff = Math.min(
              ...minWsNums.map((n) => Math.abs(n - candWsNum)),
            );
            if (minDiff > 1) continue;
          }

          for (const m of group) {
            if (
              minSlot.machines.length >=
              engine.getDynamicSlotLimit(minSlot, totalNcPool, slots)
            )
              break;
            if (maxSlot.machines.length - 1 < minSlot.machines.length + 1)
              break;

            if (engine.canAddMachineToSlotCluster(m, minSlot)) {
              maxSlot.machines = maxSlot.machines.filter(
                (sm) => (sm.id || sm.name) !== (m.id || m.name),
              );
              minSlot.machines.push(m);
              improved = true;
              break;
            }
          }
          if (improved) break;
        }
      }
    });
  },

  /**
   * Menangani overflow APK Line C ke CQI 24 (WW)
   */
  /**
   * Menangani overflow APK Line C ke CQI 24 (WW)
   * Aturan: Jika CQI 24 harus mengambil mesin dari Line C, utamakan 1 workstation agar lebih mudah,
   * atau maksimal 2 workstation. Dilarang keras memuat mesin dari 3 workstation atau lebih.
   */
  handleWwOverflow(slot24, generalSlots, labels, engine, runningMachines = [], slots = []) {
    if (!slot24) return;

    const assignedIds = new Set();
    slots.forEach((s) =>
      s.machines.forEach((m) => assignedIds.add(m.id || m.name)),
    );

    // 1. Kumpulkan mesin APK Line C yang belum teralokasi
    const unassignedApkLineC = runningMachines.filter((m) => {
      if (assignedIds.has(m.id || m.name)) return false;
      if (!engine.isMachineLineC(m, labels)) return false;
      const line = String(m.line || "").toUpperCase();
      const ws = String(m.workstation || m.ws || "").toUpperCase();
      if (
        line.includes("LINE A") ||
        line.includes("LINE B") ||
        line === "A" ||
        line === "B" ||
        ws.endsWith("A") ||
        ws.endsWith("B")
      ) {
        return false;
      }
      return (
        engine.isPouchMachine(m) ||
        String(m.name || m.id || "").toUpperCase().startsWith("APK")
      );
    });

    const wwCount = slot24.machines.filter((m) => engine.isWwMachine(m)).length;
    const nonWwCount = slot24.machines.filter((m) => !engine.isWwMachine(m)).length;
    const maxPouchFor24 = wwCount >= 2 ? 5 : 6;
    const maxApkToTake = Math.min(
      maxPouchFor24 - nonWwCount,
      (slot24.maxAllowedMachines || 7) - slot24.machines.length,
    );
    if (maxApkToTake <= 0) return;

    let apkCandidates = [...unassignedApkLineC];

    // 2. Jika ada workstation yang terbelah atau slot Line C dekat CQI 24 (CQI 18) mengalami overload (> 8)
    // Utamakan menyatukan workstation (misal sisa 4C yang terbelah) dan HINDARI mengambil dari CQI 20 (lorong 10C/9C/8C)
    const overloadedSlots = generalSlots.filter((s) => {
      const isLineC = engine.getCqiPrimaryLine(s.cqi) === "LINE C";
      const num = String(s.cqiNum || engine.getCqiNumber(s.cqi));
      // Hanya slot Line C dekat WW (CQI 18), hindari CQI 20 yang berlokasi di ujung timur lorong 10C
      return isLineC && num !== "20" && s.machines.length > 8;
    });

    if (overloadedSlots.length > 0) {
      overloadedSlots.forEach((os) => {
        // Satukan workstation yang sudah ada di kandidat (misal 4C)
        const candidateWs = new Set(
          apkCandidates.map((m) => engine.getWorkstationKey(m, labels).toUpperCase())
        );
        const matchingMachines = os.machines.filter((m) => {
          const ws = engine.getWorkstationKey(m, labels).toUpperCase();
          return candidateWs.has(ws);
        });

        matchingMachines.forEach((pm) => {
          if (apkCandidates.length < maxApkToTake) {
            apkCandidates.push(pm);
            os.machines = os.machines.filter(
              (m) => (m.id || m.name) !== (pm.id || pm.name)
            );
          }
        });

        // Jika masih kurang, cek apakah ada workstation dekat WW (misal 1C, 2C, 4C) yang bisa ditransfer utuh
        if (apkCandidates.length < maxApkToTake && os.machines.length > 8) {
          const transferable = os.machines.filter((m) => {
            const ws = engine.getWorkstationKey(m, labels).toUpperCase();
            return ["1C", "2C", "3C", "4C"].includes(ws);
          });
          const wsGroupsInOs = new Map();
          transferable.forEach((m) => {
            const ws = engine.getWorkstationKey(m, labels).toUpperCase();
            if (!wsGroupsInOs.has(ws)) wsGroupsInOs.set(ws, []);
            wsGroupsInOs.get(ws).push(m);
          });

          for (const [wsKey, ms] of wsGroupsInOs.entries()) {
            if (apkCandidates.length >= maxApkToTake) break;
            if (os.machines.length - ms.length >= 7) {
              ms.forEach((pm) => {
                if (apkCandidates.length < maxApkToTake) {
                  apkCandidates.push(pm);
                  os.machines = os.machines.filter(
                    (m) => (m.id || m.name) !== (pm.id || pm.name)
                  );
                }
              });
            }
          }
        }
      });
    }

    if (apkCandidates.length === 0) return;

    // 3. Kelompokkan kandidat APK Line C per Workstation
    const wsGroups = new Map();
    apkCandidates.forEach((m) => {
      const ws = engine.getWorkstationKey(m, labels).toUpperCase();
      if (!wsGroups.has(ws)) wsGroups.set(ws, []);
      wsGroups.get(ws).push(m);
    });

    const currentWsIn24 = new Set(
      slot24.machines
        .filter((m) => !engine.isWwMachine(m))
        .map((m) => engine.getWorkstationKey(m, labels).toUpperCase())
    );

    const prioMap24 =
      (engine.CQI_PRIORITY_MAP && engine.CQI_PRIORITY_MAP["cqi 24"]) || [
        "WW",
        "1C",
        "2C",
      ];

    // Urutkan workstation kandidat berdasarkan:
    // a. Workstation yang sudah ada di CQI 24
    // b. Prioritas CQI 24 (1C, 2C)
    // c. Jarak fisik ke CQI 24
    const rankedWsList = Array.from(wsGroups.keys()).sort((wsA, wsB) => {
      const aInCurrent = currentWsIn24.has(wsA) ? 0 : 1;
      const bInCurrent = currentWsIn24.has(wsB) ? 0 : 1;
      if (aInCurrent !== bInCurrent) return aInCurrent - bInCurrent;

      const idxA = prioMap24.indexOf(wsA);
      const idxB = prioMap24.indexOf(wsB);
      const pA = idxA !== -1 ? idxA : 999;
      const pB = idxB !== -1 ? idxB : 999;
      if (pA !== pB) return pA - pB;

      const distA =
        wsGroups.get(wsA).reduce(
          (sum, m) => sum + engine.calculateDistance(m, slot24.cqi, labels),
          0
        ) / wsGroups.get(wsA).length;
      const distB =
        wsGroups.get(wsB).reduce(
          (sum, m) => sum + engine.calculateDistance(m, slot24.cqi, labels),
          0
        ) / wsGroups.get(wsB).length;
      return distA - distB;
    });

    // ATURAN: UTAMAKAN 1 WORKSTATION AGAR LEBIH MUDAH, ATAU MAKSIMAL 2 WORKSTATION
    const chosenWsSet = new Set(currentWsIn24);
    const selectedMachines = [];

    for (const wsKey of rankedWsList) {
      if (selectedMachines.length >= maxApkToTake) break;
      const isNew = !chosenWsSet.has(wsKey);
      if (isNew && chosenWsSet.size >= 2) continue; // Dilarang lebih dari 2 workstation

      const ms = wsGroups.get(wsKey);
      const spaceLeft = maxApkToTake - selectedMachines.length;
      const takeFromWs = ms.slice(0, spaceLeft);
      if (takeFromWs.length > 0) {
        selectedMachines.push(...takeFromWs);
        chosenWsSet.add(wsKey);
      }
    }

    if (selectedMachines.length > 0) {
      selectedMachines.forEach((pm) => slot24.machines.push(pm));
      slot24.pouchAddedToWw = true;
    }
  },

  /**
   * Mengalokasikan sisa mesin running yang belum tercover ke CQI di line yang sama
   */
  allocateRemainingUnassigned(generalSlots, runningMachines, slots, labels, engine) {
    const allFactoryMachines = runningMachines;
    const allAssignedIds = new Set();
    slots.forEach((s) =>
      s.machines.forEach((m) => allAssignedIds.add(m.id || m.name)),
    );
    const unallocatedRunning = runningMachines.filter(
      (m) => !allAssignedIds.has(m.id || m.name),
    );

    if (unallocatedRunning.length > 0) {
      unallocatedRunning.forEach((m) => {
        const mLine = engine.getMachineLine(m, labels);
        const wsKey = engine.getWorkstationKey(m, labels).toUpperCase();

        const eligibleSlots = generalSlots.filter((s) => {
          if (engine.isFarWorkstationForCqi(wsKey, s.cqiNum)) return false;
          const rule = engine.getClusterCapacityRule([...s.machines, m]);
          if (s.machines.length >= rule.absoluteMax) return false;
          return engine.canAddMachineToSlot(
            m,
            s,
            runningMachines,
            allFactoryMachines,
            labels,
          );
        });

        if (eligibleSlots.length > 0) {
          eligibleSlots.sort((a, b) => {
            const aLine = engine.getCqiPrimaryLine(a.cqi);
            const bLine = engine.getCqiPrimaryLine(b.cqi);
            const aSame = aLine === mLine ? 0 : 1;
            const bSame = bLine === mLine ? 0 : 1;
            if (aSame !== bSame) return aSame - bSame;

            // Kontinuitas lorong: hindari slot yang melompati lorong (> 1 lorong)
            const wsNumsA = a.machines
              .map((sm) =>
                parseInt(
                  engine.getWorkstationKey(sm, labels).replace(/\D/g, ""),
                  10,
                ),
              )
              .filter((n) => !isNaN(n));
            const wsNumsB = b.machines
              .map((sm) =>
                parseInt(
                  engine.getWorkstationKey(sm, labels).replace(/\D/g, ""),
                  10,
                ),
              )
              .filter((n) => !isNaN(n));
            const mWsNum = parseInt(wsKey.replace(/\D/g, ""), 10);

            const diffA =
              wsNumsA.length > 0 && !isNaN(mWsNum)
                ? Math.min(...wsNumsA.map((n) => Math.abs(n - mWsNum)))
                : 0;
            const diffB =
              wsNumsB.length > 0 && !isNaN(mWsNum)
                ? Math.min(...wsNumsB.map((n) => Math.abs(n - mWsNum)))
                : 0;

            if ((diffA <= 1) !== (diffB <= 1)) {
              return diffA <= 1 ? -1 : 1;
            }

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

            const distA = engine.calculateDistance(m, a.cqi, labels);
            const distB = engine.calculateDistance(m, b.cqi, labels);
            if (distA !== distB) return distA - distB;

            return a.machines.length - b.machines.length;
          });

          eligibleSlots[0].machines.push(m);
        }
      });
    }
  },
};
