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
      maxAllowedMachines: maxSlotCapacity,
    }));

    // --- TAHAP 3: ALOKASI MESIN RUNNING KE CQI (HUMAN-LIKE AFFINITY & WORKSTATION BLOCKING) ---
    const { generalSlots, slot24 } = blockAllocator.allocateMachinesToSlots(
      slots,
      runningMachines,
      config,
      mapData,
      this,
    );

    // --- TAHAP 3.5: INTRA-LINE LOAD BALANCING & OVERFLOW APK LINE C (OPTIMASI JARAK PUTARAN 1) ---
    let ncCount = 0;
    if (Array.isArray(config.nonCoreData) && config.nonCoreData.length > 0) {
      ncCount = config.nonCoreData.length;
    } else if (Array.isArray(config.nonCoreNames)) {
      ncCount = config.nonCoreNames.length;
    }
    const lsCount = parseInt(config.longshift || 0, 10);
    const totalNcPool = ncCount + lsCount;

    loadBalancer.balanceIntraLineLoad(
      generalSlots,
      mode,
      totalNcPool,
      slots,
      mapData,
      this,
    );

    loadBalancer.handleWwOverflow(
      slot24,
      generalSlots,
      mode,
      mapData.labels || [],
      this,
      runningMachines,
      slots,
    );

    // --- TAHAP 3.6: ALOKASI MESIN RUNNING SISA KE LINE TERDEKAT (PUTARAN 1) ---
    loadBalancer.allocateRemainingUnassigned(
      generalSlots,
      runningMachines,
      slots,
      mapData.labels || [],
      this,
    );

    // --- FITUR OPTIMASI JARAK DUA KALI (PUTARAN 2: RE-EVALUASI JARAK PHYSICAL BALANCE) ---
    loadBalancer.balanceIntraLineLoad(
      generalSlots,
      mode,
      totalNcPool,
      slots,
      mapData,
      this,
    );

    loadBalancer.allocateRemainingUnassigned(
      generalSlots,
      runningMachines,
      slots,
      mapData.labels || [],
      this,
    );

    // Saring slot aktif yang memiliki mesin dan urutkan berdasarkan nomor CQI (CQI 1, CQI 2, CQI 3...)
    const activeSlots = slots.filter((s) => s.machines.length > 0);
    activeSlots.sort((a, b) => {
      const numA = parseInt(a.cqiNum, 10) || 999;
      const numB = parseInt(b.cqiNum, 10) || 999;
      return numA - numB;
    });

    // --- TAHAP 4: PEMASANGAN CORE MANPOWER BERDASARKAN URUTAN CONFIG & PREFERENSI PRIORITAS ---
    manpowerAssigner.assignCorePersonnel(activeSlots, coreList, this);

    // --- TAHAP 5 & 6: DISTRIBUSI NON-CORE & LONGSHIFT BERDASARKAN URUTAN CONFIG ---
    const { remainingNonCore, remainingLs } =
      manpowerAssigner.assignNonCoreAndLongshift(activeSlots, config, mode, this);

    // Hitung Mesin Running Unassigned/Uncovered
    let assignedIds = new Set();
    activeSlots.forEach((s) =>
      s.machines.forEach((m) => assignedIds.add(m.id || m.name)),
    );

    let unassigned = runningMachines.filter(
      (m) => !assignedIds.has(m.id || m.name),
    );

    // BILA ADA MESIN YANG BELUM TERCOVER, JALANKAN ULANG ENGINE PEMBAGIAN UNTUK MEMAKSA
    // MESIN MASUK KE CQI TERDEKAT DI LINENYA DENGAN PERGESERAN ESTAFET
    if (unassigned.length > 0) {
      this.forceFitUnassignedMachines(slots, unassigned, config, mapData);

      assignedIds = new Set();
      activeSlots.forEach((s) =>
        s.machines.forEach((m) => assignedIds.add(m.id || m.name)),
      );
      unassigned = runningMachines.filter(
        (m) => !assignedIds.has(m.id || m.name),
      );
    }

    activeSlots.unassignedMachines = unassigned;
    activeSlots.uncoveredMachines = unassigned;
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
