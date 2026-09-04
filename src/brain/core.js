import cqiSelector from './cqiSelector.js';
import blockAllocator from './blockAllocator.js';
import loadBalancer from './loadBalancer.js';
import manpowerAssigner from './manpowerAssigner.js';
import unassignedFitter from './unassignedFitter.js';

export default {
  // ==========================================================================
  // 2. MODUL CORE ALGORITHM (Engine Alokasi & Distribusi Manpower)
  // ==========================================================================

  /**
   * Engine Utama Perencanaan Human-Like Planning:
   *
   * Tahap 1: Inisialisasi & Hitung Kapasitas Slot Core
   * Tahap 2: Seleksi Slot CQI Aktif Strategis (cqiSelector)
   * Tahap 3: Alokasi Mesin ke CQI Berdasarkan Human-Like Affinity (blockAllocator)
   * Tahap 3.5: Intra-Line Load Balancing & APK Line C Overflow (loadBalancer)
   * Tahap 3.6: Alokasi Mesin Running Sisa ke Line Terdekat (loadBalancer)
   * Tahap 4: Penugasan Core Manpower Berdasarkan Preferensi (manpowerAssigner)
   * Tahap 5 & 6: Distribusi Non-Core & Longshift (manpowerAssigner)
   *
   * @param {Array} machines - Daftar mesin berstatus RUNNING
   * @param {Array} cqis - Daftar CQI berstatus READY
   * @param {Object} config - Konfigurasi manpower & mode
   * @param {Object} mapData - Referensi data denah
   * @returns {Array} Array slots perencanaan lengkap
   */
  generatePlan(machines, cqis, config = {}, mapData = {}) {
    if (
      !Array.isArray(machines) ||
      machines.length === 0 ||
      !Array.isArray(cqis) ||
      cqis.length === 0
    ) {
      return [];
    }

    const maxSlotCapacity = 10;

    // --- TAHAP 1: FILTER KATEGORI MESIN & HITUNG KAPASITAS CORE ---
    const runningMachines = [...machines];
    const readyCQIs = cqis.filter((c) => c.status === "READY");
    const availableCqis = readyCQIs.length > 0 ? readyCQIs : [...cqis];

    let coreList = [];
    if (Array.isArray(config.coreData) && config.coreData.length > 0) {
      coreList = config.coreData.map((c) =>
        typeof c === "object" ? c : { name: c, cqi_priority: "" },
      );
    } else if (Array.isArray(config.coreNames) && config.coreNames.length > 0) {
      coreList = config.coreNames.map((name) => ({ name, cqi_priority: "" }));
    }
    let maxCoreSlots = availableCqis.length;
    if (coreList.length > 0) {
      maxCoreSlots = coreList.length;
    } else if (config.core !== undefined && config.core !== null) {
      maxCoreSlots = parseInt(config.core, 10);
      if (isNaN(maxCoreSlots)) maxCoreSlots = availableCqis.length;
    }

    // --- TAHAP 2: SELEKSI CQI AKTIF STRATEGIS BERDASARKAN KEBUTUHAN LINE & CLUSTER ---
    const selectedCQIs = cqiSelector.selectActiveCQIs(
      runningMachines,
      availableCqis,
      maxCoreSlots,
      config,
      mapData,
      this,
    );

    // Buat Objek Slot CQI
    const slots = selectedCQIs.map((c) => {
      const cqiNum = this.getCqiNumber(c);
      let initialMax = 8;
      if (cqiNum === "19") initialMax = 2;
      else if (cqiNum === "24") initialMax = 7;
      else initialMax = 10;
      return {
        cqi: c,
        cqiNum,
        machines: [],
        core: 0,
        coreNames: [],
        nonCore: [],
        longshift: [],
        pouchAddedToWw: false,
        maxAllowedMachines: initialMax,
      };
    });

    // Saring slot aktif dan urutkan berdasarkan nomor CQI (CQI 1, CQI 2, CQI 3...)
    slots.sort((a, b) => {
      const numA = parseInt(a.cqiNum, 10) || 999;
      const numB = parseInt(b.cqiNum, 10) || 999;
      return numA - numB;
    });

    // Pasangkan Core manpower (1 Core per CQI aktif)
    manpowerAssigner.assignCorePersonnel(slots, coreList, this);

    // =========================================================================
    // #PENYEDERHANAAN PLANNING
    // //tahap 1: buat 3 planing dengan meminimalkan penggunaan noncore/ls
    // //tahap 2: pilih planing yang paling sedikit menggunakan noncore/ls
    // =========================================================================

    // Tahap 1: Buat 3 kandidat planning
    const plan1 = this.buildSingleCandidate(
      runningMachines,
      selectedCQIs,
      coreList,
      config,
      mapData,
      "standard_balanced",
    );
    const plan2 = this.buildSingleCandidate(
      runningMachines,
      selectedCQIs,
      coreList,
      config,
      mapData,
      "cluster_first",
    );
    const plan3 = this.buildSingleCandidate(
      runningMachines,
      selectedCQIs,
      coreList,
      config,
      mapData,
      "corridor_compact",
    );

    const candidateList = [
      { id: 1, name: "Planing 1 (Standard Balanced)", plan: plan1 },
      { id: 2, name: "Planing 2 (Cluster Consolidation)", plan: plan2 },
      { id: 3, name: "Planing 3 (Corridor Compact)", plan: plan3 },
    ];

    // Tahap 2: Pilih planing yang paling sedikit menggunakan noncore/ls
    candidateList.sort((a, b) => {
      // 1. Cakupan mesin maksimal (unassigned paling sedikit)
      const unassignedA = a.plan.unassignedMachines.length;
      const unassignedB = b.plan.unassignedMachines.length;
      if (unassignedA !== unassignedB) return unassignedA - unassignedB;

      // 2. Kriteria Utama: Paling sedikit menggunakan noncore/ls
      const ncLsA = a.plan.totalNcLsUsed;
      const ncLsB = b.plan.totalNcLsUsed;
      if (ncLsA !== ncLsB) return ncLsA - ncLsB;

      // 3. Jarak total terkecil (efisiensi pergerakan teknisi CQI)
      return a.plan.totalDistance - b.plan.totalDistance;
    });

    const chosenCandidate = candidateList[0];
    const bestPlan = chosenCandidate.plan;

    bestPlan.candidateSummaries = candidateList.map((c) => ({
      id: c.id,
      name: c.name,
      totalNcLs: c.plan.totalNcLsUsed,
      totalNc: c.plan.totalNcUsed,
      totalLs: c.plan.totalLsUsed,
      unassigned: c.plan.unassignedMachines.length,
      totalDistance: c.plan.totalDistance,
      activeSlots: c.plan.length,
      isSelected: c.id === chosenCandidate.id,
    }));
    bestPlan.chosenStrategy = chosenCandidate.name;

    return bestPlan;
  },

  /**
   * Membangun satu kandidat planning dengan strategi tertentu untuk meminimalkan NC/LS
   */
  buildSingleCandidate(
    runningMachines,
    selectedCQIs,
    coreList,
    config,
    mapData,
    strategy,
  ) {
    const slots = selectedCQIs.map((c) => {
      const cqiNum = this.getCqiNumber(c);
      let initialMax = 8;
      if (cqiNum === "19") initialMax = 2;
      else if (cqiNum === "24") initialMax = 7;
      else initialMax = 10;
      return {
        cqi: c,
        cqiNum,
        machines: [],
        core: 0,
        coreNames: [],
        nonCore: [],
        longshift: [],
        pouchAddedToWw: false,
        maxAllowedMachines: initialMax,
      };
    });

    slots.sort((a, b) => {
      const numA = parseInt(a.cqiNum, 10) || 999;
      const numB = parseInt(b.cqiNum, 10) || 999;
      return numA - numB;
    });

    manpowerAssigner.assignCorePersonnel(slots, coreList, this);

    let machinesToAllocate = [...runningMachines];
    if (strategy === "cluster_first") {
      // Prioritaskan kemurnian cluster untuk memaksimalkan kapasitas 1 core murni tanpa NC/LS
      machinesToAllocate.sort((a, b) => {
        const cA = this.getMachineClusterGroup(a);
        const cB = this.getMachineClusterGroup(b);
        if (cA !== cB) return cA.localeCompare(cB);
        return (a.name || a.id || "").localeCompare(b.name || b.id || "");
      });
    } else if (strategy === "corridor_compact") {
      // Prioritaskan lorong fisik terdekat dan workstation line
      const labels = mapData.labels || [];
      machinesToAllocate.sort((a, b) => {
        const lA = this.getMachineLine(a, labels);
        const lB = this.getMachineLine(b, labels);
        if (lA !== lB) return lA.localeCompare(lB);
        const wsA = this.getWorkstationKey(a, labels);
        const wsB = this.getWorkstationKey(b, labels);
        return wsA.localeCompare(wsB);
      });
    }

    // -------------------------------------------------------------------------
    // TAHAP 2: PEMBENTUKAN PLANING SEMENTARA (1 Core per Cluster tanpa Noncore)
    // -------------------------------------------------------------------------
    blockAllocator.allocateTemporaryPlan(
      slots,
      machinesToAllocate,
      config,
      mapData,
      this,
    );

    const temporaryPlan = slots.map((s) => ({
      cqiNum: s.cqiNum,
      machines: [...s.machines],
    }));

    let assignedIds = new Set();
    slots.forEach((s) =>
      s.machines.forEach((m) => assignedIds.add(m.id || m.name)),
    );
    let uncoveredMachines = runningMachines.filter(
      (m) => !assignedIds.has(m.id || m.name),
    );

    // -------------------------------------------------------------------------
    // TAHAP 3: MAKSIMALKAN CQI YANG BISA DIMAKSIMALKAN (MAKS = 8 MESIN)
    // Berdasarkan cqiprioritymap dan cqiclusterpriority serta meminimalkan NC/LS
    // -------------------------------------------------------------------------
    uncoveredMachines = blockAllocator.maximizeCqiSlots(
      slots,
      uncoveredMachines,
      runningMachines,
      config,
      mapData,
      this,
    );

    const activeSlots = slots.filter((s) => s.machines.length > 0);
    activeSlots.sort((a, b) => {
      const numA = parseInt(a.cqiNum, 10) || 999;
      const numB = parseInt(b.cqiNum, 10) || 999;
      return numA - numB;
    });

    // -------------------------------------------------------------------------
    // TAHAP 4 & 5: IDENTIFIKASI KEBUTUHAN NC/LS & ALOKASI NC LALU LS
    // -------------------------------------------------------------------------
    const { remainingNonCore, remainingLs } =
      manpowerAssigner.assignNonCoreAndLongshift(activeSlots, config, this);

    assignedIds = new Set();
    activeSlots.forEach((s) =>
      s.machines.forEach((m) => assignedIds.add(m.id || m.name)),
    );
    let finalUnassigned = runningMachines.filter(
      (m) => !assignedIds.has(m.id || m.name),
    );

    activeSlots.temporaryPlan = temporaryPlan;
    activeSlots.unassignedMachines = finalUnassigned;
    activeSlots.uncoveredMachines = finalUnassigned;
    activeSlots.remainingLs = remainingLs;
    activeSlots.remainingNonCore = remainingNonCore;

    // Hitung total jarak
    let grandTotalDist = 0;
    activeSlots.forEach((slot) => {
      let slotDist = 0;
      slot.machines.forEach((m) => {
        const d = this.calculateDistance(m, slot.cqi, mapData.labels || []);
        slotDist += d;
      });
      slot.totalDistance = slotDist;
      grandTotalDist += slotDist;
    });
    activeSlots.totalDistance = grandTotalDist;
    activeSlots.avgDistance =
      activeSlots.length > 0
        ? (grandTotalDist / activeSlots.length).toFixed(1)
        : 0;

    const totalNcUsed = activeSlots.reduce(
      (sum, s) => sum + (s.nonCore ? s.nonCore.length : 0),
      0,
    );
    const totalLsUsed = activeSlots.reduce(
      (sum, s) => sum + (s.longshift ? s.longshift.length : 0),
      0,
    );
    activeSlots.totalNcLsUsed = totalNcUsed + totalLsUsed;
    activeSlots.totalNcUsed = totalNcUsed;
    activeSlots.totalLsUsed = totalLsUsed;
    activeSlots.strategyName = strategy;

    return activeSlots;
  },

  /**
   * Memaksa mengalokasikan mesin sisa yang belum tercover ke CQI yang belum maksimal.
   * Otomatis mencari CQI yang belum maks, menggeser mesin yang boleh dicampur/ada di history/ada di CQI priority.
   *
   * @param {Array} slots - Slot perencanaan yang ada
   * @param {Array} unassignedMachines - Daftar mesin yang belum tercover
   * @param {Object} config - Konfigurasi perencanaan
   * @param {Object} mapData - Map data
   * @returns {Array} Slots hasil penyesuaian paksa
   */
  forceFitUnassignedMachines(
    slots,
    unassignedMachines = null,
    config = {},
    mapData = {},
  ) {
    return unassignedFitter.forceFit(
      slots,
      unassignedMachines,
      config,
      mapData,
      this,
    );
  },

  /**
   * Helper mencari slot CQI terdekat untuk fallback
   * @param {Object} machine - Objek mesin
   * @param {Array} slots - Daftar slot CQI
   * @returns {Object|null}
   */
  findNearestSlot(machine, slots) {
    if (!slots || slots.length === 0) return null;
    let nearest = null;
    let minDist = Infinity;
    slots.forEach((s) => {
      const d = this.calculateDistance(machine, s.cqi);
      if (d < minDist) {
        minDist = d;
        nearest = s;
      }
    });
    return nearest;
  },
};
