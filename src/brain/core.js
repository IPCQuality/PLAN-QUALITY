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

    const mode = parseInt(config.mode || 1, 10) === 2 ? 2 : 1;
    const maxSlotCapacity = mode === 1 ? 10 : 8;

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
    const slots = selectedCQIs.map((c) => ({
      cqi: c,
      cqiNum: this.getCqiNumber(c),
      machines: [],
      core: 0,
      coreNames: [],
      nonCore: [],
      longshift: [],
      pouchAddedToWw: false,
      maxAllowedMachines: 8,
    }));

    // Saring slot aktif dan urutkan berdasarkan nomor CQI (CQI 1, CQI 2, CQI 3...)
    slots.sort((a, b) => {
      const numA = parseInt(a.cqiNum, 10) || 999;
      const numB = parseInt(b.cqiNum, 10) || 999;
      return numA - numB;
    });

    // Pasangkan Core manpower (1 Core per CQI aktif)
    manpowerAssigner.assignCorePersonnel(slots, coreList, this);

    // -------------------------------------------------------------------------
    // TAHAP 2: PEMBENTUKAN PLANING SEMENTARA (1 Core per Cluster tanpa Noncore)
    // Aturan kapasitas dasar 1 Core:
    // - Sosoft: 1 Core 4 mesin, tanpa noncore
    // - SKLsct: 1 Core 4 mesin, tanpa noncore
    // - 12Ljumbo: 1 Core 4 mesin, tanpa noncore
    // - hanya Pouch: 1 Core 5 mesin, tanpa noncore
    // - Pouch+Botol: 1 Core 4 mesin, tanpa noncore
    // - OT (CQI 19): 1 Core 2 mesin (M2, M3)
    // - WW (CQI 24): 1 Core 4 mesin WW
    // Sesuai workstation masing-masing (Line A CQI 1 -> 1A, dll.)
    // atau sesuai cqiprioritymap dan cqiclusterpriority.
    // Menghasilkan Planing Sementara (banyak mesin belum tercover).
    // -------------------------------------------------------------------------
    blockAllocator.allocateTemporaryPlan(
      slots,
      runningMachines,
      config,
      mapData,
      this,
    );

    // Simpan snapshot Planing Sementara
    const temporaryPlan = slots.map((s) => ({
      cqiNum: s.cqiNum,
      machines: [...s.machines],
    }));

    // Hitung mesin yang belum tercover di Planing Sementara
    let assignedIds = new Set();
    slots.forEach((s) =>
      s.machines.forEach((m) => assignedIds.add(m.id || m.name)),
    );
    let uncoveredMachines = runningMachines.filter(
      (m) => !assignedIds.has(m.id || m.name),
    );

    // -------------------------------------------------------------------------
    // TAHAP 3 (Lanjutan 1): MAKSIMALKAN CQI YANG BISA DIMAKSIMALKAN (MAKS = 8 MESIN)
    // berdasarkan cqiprioritymap dan cqiclusterpriority.
    // Dengan cara menambahkan mesin belum tercover ke (planing sementara)
    // TANPA MENGUBAH (planing sementara), HANYA MENAMBAHKAN.
    // -------------------------------------------------------------------------
    uncoveredMachines = blockAllocator.maximizeCqiSlots(
      slots,
      uncoveredMachines,
      runningMachines,
      config,
      mapData,
      this,
    );

    // Saring slot aktif yang memiliki mesin
    const activeSlots = slots.filter((s) => s.machines.length > 0);
    activeSlots.sort((a, b) => {
      const numA = parseInt(a.cqiNum, 10) || 999;
      const numB = parseInt(b.cqiNum, 10) || 999;
      return numA - numB;
    });

    // -------------------------------------------------------------------------
    // TAHAP 4 & 5 (Lanjutan 2 & 3): IDENTIFIKASI KEBUTUHAN NC/LS & ALOKASI
    // 2. Identifikasi CQI yang membutuhkan NC/LS (mesin > kapasitas 1 Core)
    // 3. Tambahkan NC terlebih dahulu sesuai urutan, jika masih kurang tambahkan LS.
    // (LS: Noncore Longshift kedudukannya sama dengan Noncore)
    // -------------------------------------------------------------------------
    const { remainingNonCore, remainingLs } =
      manpowerAssigner.assignNonCoreAndLongshift(activeSlots, config, mode, this);

    // Periksa ulang sisa mesin unassigned
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

    // --- FITUR HITUNG TOTAL JARAK DI AKHIR ---
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
    activeSlots.avgDistance = activeSlots.length > 0 ? (grandTotalDist / activeSlots.length).toFixed(1) : 0;

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
