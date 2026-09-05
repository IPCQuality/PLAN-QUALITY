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
   * TAHAP 2: PEMBENTUKAN PLANING SEMENTARA (1 Core per Cluster tanpa Noncore)
   *
   * Aturan kapasitas dasar 1 Core:
   * - Sosoft : 1 Core 4 mesin, tanpa noncore
   * - SKLsct : 1 Core 4 mesin, tanpa noncore
   * - 12Ljumbo : 1 Core 4 mesin, tanpa noncore
   * - hanya Pouch : 1 Core 5 mesin, tanpa noncore
   * - Pouch+Botol : 1 Core 4 mesin, tanpa noncore
   * - OT (CQI 19) : 1 Core 2 mesin (M2, M3)
   * - WW (CQI 24) : 1 Core 4 mesin WW
   *
   * Dialokasikan sesuai workstation masing-masing (Line A CQI 1 -> 1A, dll.)
   * atau sesuai cqiprioritymap dan cqiclusterpriority.
   * Menghasilkan Planing Sementara (banyak mesin belum tercover).
   */
  allocateTemporaryPlan(slots, machines, config, mapData, engine) {
    const labels = mapData.labels || [];
    const allFactoryMachines = mapData.machines || machines;
    const runningMachines = [...machines];

    // Reset machines di seluruh slot
    slots.forEach((s) => {
      s.machines = [];
      s.pouchAddedToWw = false;
    });

    const wwMachines = runningMachines.filter((m) => engine.isWwMachine(m));
    const otMachines = runningMachines.filter((m) => engine.isOtMachine(m));
    const generalMachines = runningMachines.filter(
      (m) => !engine.isWwMachine(m) && !engine.isOtMachine(m),
    );

    const slot19 = slots.find((s) => s.cqiNum === "19");
    const slot24 = slots.find((s) => s.cqiNum === "24");

    // 1. CQI 19: Khusus Mesin OT (M2 & M3) - Maksimal 2 mesin 1 Core tanpa Noncore
    if (slot19) {
      slot19.maxAllowedMachines = 2;
      if (otMachines.length > 0) {
        otMachines.slice(0, 2).forEach((m) => {
          if (!slot19.machines.some((sm) => sm.id === m.id || sm.name === m.name)) {
            slot19.machines.push(m);
          }
        });
      }
    }

    // 2. CQI 24: Khusus Mesin WW
    // ATURAN CQI 24 (TANPA NONCORE/LS):
    // - jika running 2, maka 2 mesin WW (tanpa pouch)
    // - jika running 1, maka 1 mesin WW dan 3 mesin pouch (total 4)
    let pouchUsedBy24InTemp = [];
    if (slot24) {
      slot24.maxAllowedMachines = 7;
      if (wwMachines.length >= 2) {
        wwMachines.slice(0, 2).forEach((m) => {
          if (!slot24.machines.some((sm) => sm.id === m.id || sm.name === m.name)) {
            slot24.machines.push(m);
          }
        });
      } else if (wwMachines.length === 1) {
        const wwM = wwMachines[0];
        if (!slot24.machines.some((sm) => sm.id === wwM.id || sm.name === wwM.name)) {
          slot24.machines.push(wwM);
        }

        const apkLineCMachines = generalMachines.filter(
          (m) =>
            engine.isMachineLineC(m, labels) &&
            (engine.isPouchMachine(m) ||
              String(m.name || m.id || "").toUpperCase().startsWith("APK")),
        );

        const validFor24 = apkLineCMachines.filter((m) =>
          engine.canAddMachineToSlot(
            m,
            slot24,
            runningMachines,
            allFactoryMachines,
            labels,
          ),
        );

        const toAdd = validFor24.slice(0, 3);
        toAdd.forEach((m) => {
          if (!slot24.machines.some((sm) => sm.id === m.id || sm.name === m.name)) {
            slot24.machines.push(m);
            pouchUsedBy24InTemp.push(m);
          }
        });
      }
    }

    // 3. Slot Umum (Line A, Line B, Line C selain CQI 19 & 24)
    const excludedCqiNums = new Set(["19", "24"]);
    const generalSlots = slots.filter((s) => {
      const num = String(s.cqiNum || engine.getCqiNumber(s.cqi) || "").trim();
      return !excludedCqiNums.has(num);
    });

    const usedIn24Ids = new Set(pouchUsedBy24InTemp.map((m) => m.id || m.name));
    const availableGeneralMachines = generalMachines.filter(
      (m) => !usedIn24Ids.has(m.id || m.name),
    );

    // Bangun kelompok blok workstation
    const wsBlocks = this.buildWorkstationBlocks(
      availableGeneralMachines,
      labels,
      engine,
    );

    // Tentukan kapasitas 1 Core dasar untuk setiap slot umum berdasarkan cluster:
    // - hanya 1 cluster: Sosoft, SKLsct, 12Ljumbo, Pouch, Botol = 4 mesin
    // - 2 cluster: Sosoft+SKLsct, Sosoft+12Ljumbo, SKLsct+12Ljumbo = 4 mesin
    // - 2 cluster: 12Ljumbo+Pouch, Pouch+Botol = 5 mesin
    const getBaseCapacityForSlot = (slot) => {
      return engine.getBaseCoreCapacity(slot);
    };

    // --- PASS 1: SESUAI WORKSTATION UTAMA (ANCHOR) MASING-MASING CQI ---
    // Contoh: Line A CQI 1 -> 1A (& 0A), CQI 2 -> 2A, CQI 3 -> 3A, dll.
    generalSlots.forEach((slot) => {
      const prioKey = "cqi " + slot.cqiNum;
      const prioList = engine.CQI_PRIORITY_MAP[prioKey] || [];
      if (prioList.length === 0) return;

      const primaryWsList = [String(prioList[0]).toUpperCase()];
      if (slot.cqiNum === "1" && prioList.includes("0A")) {
        primaryWsList.push("0A");
      }

      primaryWsList.forEach((primaryWs) => {
        const baseCap = getBaseCapacityForSlot(slot);
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

          // Urutkan mesin berdasarkan jarak terdekat ke CQI
          validMachines.sort((a, b) => {
            const dA = engine.calculateDistance(a, slot.cqi, labels);
            const dB = engine.calculateDistance(b, slot.cqi, labels);
            return dA - dB;
          });

          const availableSpace = baseCap - slot.machines.length;
          if (availableSpace > 0 && validMachines.length > 0) {
            const toAdd = validMachines.slice(0, availableSpace);
            slot.machines.push(...toAdd);
            anchorBlock.machines = anchorBlock.machines.filter(
              (m) => !toAdd.includes(m),
            );
          }
        });
      });
    });

    // --- PASS 2: WORKSTATION PRIORITAS BERIKUTNYA (JIKA BELUM MENCAPAI 1 CORE) ---
    generalSlots.forEach((slot) => {
      const baseCap = getBaseCapacityForSlot(slot);
      if (slot.machines.length >= baseCap) return;

      const prioKey = "cqi " + slot.cqiNum;
      const prioList = (engine.CQI_PRIORITY_MAP[prioKey] || []).map((w) =>
        String(w).toUpperCase(),
      );
      if (prioList.length < 2) return;

      const adjacentWsList = prioList.slice(1);

      adjacentWsList.forEach((adjWs) => {
        if (slot.machines.length >= baseCap) return;

        const matchingKeys = Object.keys(wsBlocks).filter((k) => {
          const b = wsBlocks[k];
          return b.ws.toUpperCase() === adjWs && b.machines.length > 0;
        });

        matchingKeys.forEach((key) => {
          if (slot.machines.length >= baseCap) return;
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

          // Urutkan mesin berdasarkan jarak terdekat ke CQI (misal CQI 1 ambil mesin teratas 68-18L/16L)
          validMachines.sort((a, b) => {
            const dA = engine.calculateDistance(a, slot.cqi, labels);
            const dB = engine.calculateDistance(b, slot.cqi, labels);
            return dA - dB;
          });

          const availableSpace = baseCap - slot.machines.length;
          if (availableSpace > 0 && validMachines.length > 0) {
            const toAdd = validMachines.slice(0, availableSpace);
            slot.machines.push(...toAdd);
            adjBlock.machines = adjBlock.machines.filter(
              (m) => !toAdd.includes(m),
            );
          }
        });
      });
    });

    return { generalSlots, slot24, slot19, wsBlocks };
  },

  /**
   * TAHAP 3 (Lanjutan 1): MAKSIMALKAN CQI YANG BISA DIMAKSIMALKAN (MAKS = 8 MESIN)
   * berdasarkan cqiprioritymap dan cqiclusterpriority.
   *
   * Dengan cara menambahkan mesin belum tercover ke (planing sementara)
   * TANPA MENGUBAH (planing sementara), HANYA MENAMBAHKAN.
   */
  maximizeCqiSlots(
    slots,
    uncoveredMachines,
    allRunningMachines,
    config,
    mapData,
    engine,
  ) {
    if (!Array.isArray(uncoveredMachines) || uncoveredMachines.length === 0) {
      return [];
    }

    const labels = mapData.labels || [];
    const allFactoryMachines = mapData.machines || allRunningMachines;
    let remaining = [...uncoveredMachines];

    // 1. Evaluasi CQI 24 jika ada mesin APK Line C yang belum tercover
    // DENGAN 1 NONCORE/LS:
    // - jika running 2 WW, maka 2 mesin WW dan 5 mesin pouch (total 7)
    // - jika running 1 WW, maka 1 mesin WW dan 6 mesin pouch (total 7)
    const slot24 = slots.find((s) => s.cqiNum === "24");
    if (slot24 && slot24.machines.length < 7) {
      const wwCountIn24 = slot24.machines.filter((m) => engine.isWwMachine(m)).length;
      const pouchCountIn24 = slot24.machines.filter((m) => !engine.isWwMachine(m)).length;
      const maxPouchAllowed = wwCountIn24 >= 2 ? 5 : (wwCountIn24 === 1 ? 6 : 6);
      const availablePouchSpace = Math.max(0, maxPouchAllowed - pouchCountIn24);

      if (availablePouchSpace > 0) {
        const apkLineCMachines = remaining.filter(
          (m) =>
            engine.isMachineLineC(m, labels) &&
            (engine.isPouchMachine(m) ||
              String(m.name || m.id || "").toUpperCase().startsWith("APK")),
        );

        if (apkLineCMachines.length > 0) {
          const validFor24 = apkLineCMachines.filter((m) =>
            engine.canAddMachineToSlot(
              m,
              slot24,
              allRunningMachines,
              allFactoryMachines,
              labels,
            ),
          );
          const toAdd = validFor24.slice(0, availablePouchSpace);
          if (toAdd.length > 0) {
            slot24.machines.push(...toAdd);
            slot24.pouchAddedToWw = true;
            const addedIds = new Set(toAdd.map((m) => m.id || m.name));
            remaining = remaining.filter((m) => !addedIds.has(m.id || m.name));
          }
        }
      }
    }

    // 2. Evaluasi Slot Umum (Maksimal 8 Mesin)
    // Urutkan uncovered machines berdasarkan lorong & workstation agar mesin yang berdampingan dipertimbangkan bersama
    remaining.sort((a, b) => {
      const lineA = engine.getMachineLine(a, labels);
      const lineB = engine.getMachineLine(b, labels);
      if (lineA !== lineB) return lineA.localeCompare(lineB);
      const wsA = engine.getWorkstationKey(a, labels);
      const wsB = engine.getWorkstationKey(b, labels);
      if (wsA !== wsB) return wsA.localeCompare(wsB);
      return (a.position?.col || 0) - (b.position?.col || 0);
    });

    let progressMade = true;
    while (remaining.length > 0 && progressMade) {
      progressMade = false;

      let bestMatch = null;
      let highestScore = -Infinity;
      let bestRemainingIdx = -1;

      for (let i = 0; i < remaining.length; i++) {
        const m = remaining[i];
        const mWs = engine.getWorkstationKey(m, labels).toUpperCase();
        const mCluster = engine.getMachineClusterGroup(m);
        const mLine = engine.getMachineLine(m, labels);

        // Cari kandidat slot yang eligible (belum mencapai maks 8 mesin dan lulus canAddMachineToSlot)
        slots.forEach((s) => {
          if (s.cqiNum === "19") return; // CQI 19 strictly 2 mesin OT
          const sRule = engine.getClusterCapacityRule(s);
          const maxLimit = Math.min(8, sRule.absoluteMax || 8);
          if (s.machines.length >= maxLimit) return;

          if (
            engine.canAddMachineToSlot(
              m,
              s,
              allRunningMachines,
              allFactoryMachines,
              labels,
            )
          ) {
            const prioKey = "cqi " + s.cqiNum;
            const wsPrioList = (engine.CQI_PRIORITY_MAP[prioKey] || []).map(
              (w) => String(w).toUpperCase(),
            );
            const clusterPrioList = (
              engine.CQI_CLUSTER_PRIORITY_MAP[prioKey] || []
            ).map((c) => String(c).toUpperCase());

            let score = 0;

            // Kriteria 0: MEMINIMALKAN PENGGUNAAN NON-CORE / LONGSHIFT SECARA AGRESIF
            const baseCap = engine.getBaseCoreCapacity(s);
            if (s.machines.length < baseCap) {
              // Masih dalam kuota 1 core murni tanpa butuh NC/LS sama sekali!
              score += 15000;
            } else if (s.machines.length < sRule.max1Nc) {
              // Membutuhkan 1 NC/LS
              score += 1500;
            } else {
              // Membutuhkan 2 NC/LS (Sangat dihindari jika masih ada alternatif)
              score -= 12000;
            }

            // Kriteria 1: CQI Priority Map
            const wsIdx = wsPrioList.indexOf(mWs);
            if (wsIdx === 0) score += 4000;
            else if (wsIdx === 1 || wsIdx === 2) score += 2600; // Tetangga langsung kiri/kanan
            else if (wsIdx === 3 || wsIdx === 4) score += 1200;
            else if (wsIdx > 4) score += Math.max(200, 800 - wsIdx * 150);

            // Kriteria 1.1: Kedekatan Workstation Tetangga (Workstation Adjacency)
            // Utamakan diambil oleh CQI tetangga / workstation tetangga (misal CQI 7 di 7A mengambil dari 8A atau 6A)!
            // DILARANG melompati lorong/workstation jika ada workstation tetangga yang bisa diambil
            if (s.machines.length > 0) {
              const existingWsKeys = s.machines.map((sm) =>
                engine.getWorkstationKey(sm, labels).toUpperCase(),
              );
              const minWsDiff = Math.min(
                ...existingWsKeys.map((w) => engine.getWorkstationDistance(w, mWs)),
              );
              if (minWsDiff === 0) {
                score += 3500; // Workstation yang sama persis
              } else if (minWsDiff === 1) {
                score += 2500; // Workstation tetangga langsung (adjacent)
              } else if (minWsDiff === 2) {
                score -= 3000; // Melompati 1 workstation
              } else if (minWsDiff > 2 && minWsDiff < 999) {
                score -= minWsDiff * 4000 + 5000; // Penalti sangat berat jika melompat jauh
              }
            }

            // Kriteria 2: CQI Cluster Priority
            const clusterIdx = clusterPrioList.indexOf(mCluster);
            if (clusterIdx === 0) score += 1500;
            else if (clusterIdx === 1) score += 800;
            else if (clusterIdx > 1) score += 400;

            // Kriteria 3: Kesatuan Workstation (Sangat prioritaskan CQI yang sudah punya mesin dari WS yang sama)
            const sameWsCount = s.machines.filter(
              (sm) =>
                engine.getWorkstationKey(sm, labels).toUpperCase() === mWs,
            ).length;
            if (sameWsCount > 0) {
              score += 2500 + sameWsCount * 500;
            }

            // Kriteria 4: Keselarasan Line
            const sLine = engine.getCqiPrimaryLine(s.cqi);
            if (sLine === mLine) {
              score += 800;
            } else {
              score -= 400;
            }

            // Kriteria 5: Jarak Fisik Aktual (Ambil mesin fisik terdekat ke CQI, misal CQI 1 ambil 68-18L dan CQI 11 ambil 70-16L)
            const dist = engine.calculateDistance(m, s.cqi, labels);
            score -= dist * 100;

            // Kriteria 6: Distribusi Beban (Pilih yang beban mesinnya lebih rendah jika skor mendekati)
            score -= s.machines.length * 50;

            if (score > highestScore) {
              highestScore = score;
              bestMatch = { slot: s, machine: m };
              bestRemainingIdx = i;
            }
          }
        });
      }

      if (bestMatch) {
        bestMatch.slot.machines.push(bestMatch.machine);
        remaining.splice(bestRemainingIdx, 1);
        progressMade = true;
      }
    }

    return remaining;
  },

  /**
   * Mengalokasikan seluruh mesin running ke CQI Slots secara menyeluruh
   * Menggabungkan Planing Sementara (1 Core tanpa NC) dan Maksimasi Slot (Maks 8 Mesin)
   */
  allocateMachinesToSlots(slots, machines, config, mapData, engine) {
    this.allocateTemporaryPlan(slots, machines, config, mapData, engine);

    const assignedIds = new Set();
    slots.forEach((s) =>
      s.machines.forEach((m) => assignedIds.add(m.id || m.name)),
    );
    let uncovered = machines.filter((m) => !assignedIds.has(m.id || m.name));

    uncovered = this.maximizeCqiSlots(
      slots,
      uncovered,
      machines,
      config,
      mapData,
      engine,
    );

    return { slots, uncovered };
  },
};
