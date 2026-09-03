export default {
  // ==========================================================================
  // 4. MODUL FORMATTER & EXPORTER
  // ==========================================================================

  /**
   * Menyusun Teks Output Final untuk dibagikan via WhatsApp / Clipboard
   * @param {Array} slots - Slot hasil alokasi
   * @param {Object} config - Konfigurasi tambahan (qcPassed, milStd, supportFg, mode)
   * @returns {string} String teks berformat rapi
   */
  formatText(slots, config = {}) {
    if (!Array.isArray(slots) || slots.length === 0) return "";

    let out = `*PLANNING LIQUID 3*\n`;
    out += `Tanggal: ${new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n`;

    // Tampilkan sisa LS dan Non-Core yang belum terpakai di planning
    const totalLsInput = parseInt(config.longshift || 0, 10);
    const assignedLsCount = slots.reduce(
      (sum, s) => sum + (s.longshift ? s.longshift.length : 0),
      0,
    );
    const remainingLs =
      slots.remainingLs !== undefined
        ? slots.remainingLs
        : Math.max(0, totalLsInput - assignedLsCount);
    if (totalLsInput > 0 || remainingLs > 0) {
      out += `Sisa LS       : ${remainingLs} Belum Terpakai\n`;
    }
    if (slots.remainingNonCore && slots.remainingNonCore.length > 0) {
      out += `Sisa Non-Core : ${slots.remainingNonCore.join(", ")} Belum Terpakai\n`;
    }
    out += `\n`;

    // Kumpulkan seluruh mesin running yang ada di semua slot untuk referensi total per WS
    const allRunningInSlots = [];
    slots.forEach((s) => {
      if (Array.isArray(s.machines)) {
        allRunningInSlots.push(...s.machines);
      }
    });

    // A. Daftar CQI & Alokasi Mesin
    slots.forEach((s, i) => {
      if (s.machines.length === 0) return;
      const cqiName = s.cqi.name || `CQI-${i + 1}`;
      const coreStr =
        s.coreNames.length > 0 ? s.coreNames.join(", ") : `${s.core} Core`;

      let combinedNcAndLs = [];
      if (s.nonCore && s.nonCore.length > 0) combinedNcAndLs.push(...s.nonCore);
      if (s.longshift && s.longshift.length > 0)
        combinedNcAndLs.push(...s.longshift);

      const nonCoreStr =
        combinedNcAndLs.length > 0 ? combinedNcAndLs.join(", ") : "-";
      const macList = this.formatMachineList(s.machines, allRunningInSlots);

      out += `${i + 1}. *${cqiName}*\n`;
      out += `   - Core     : ${coreStr}\n`;
      out += `   - Non-Core : ${nonCoreStr}\n`;
      out += `   - Mesin    : ${macList}\n\n`;
    });

    // B. Bagian Tugas Khusus & QC Passed
    if (config.qcPassed) {
      if (config.qcPassed.includes("\n")) {
        out += `- QC Passed  :\n${config.qcPassed}\n`;
      } else {
        out += `- QC Passed  : ${config.qcPassed}\n`;
      }
    }

    if (config.milStd) out += `- Mil-Std    : ${config.milStd}\n`;
    if (config.supportFg) out += `- Support FG : ${config.supportFg}\n`;

    // C. Tampilkan Sisa Mesin Belum Tercover (jika ada)
    const unassigned =
      slots.unassignedMachines || slots.uncoveredMachines || [];
    if (unassigned.length > 0) {
      out += `\n*MESIN BELUM TERCOVER (${unassigned.length} Mesin):*\n`;
      unassigned.forEach((m, idx) => {
        const ws = this.getWorkstationKey(m);
        const cluster = this.getMachineClusterGroup(m);
        out += `${idx + 1}. ${m.name || m.id} (${ws}) - Cluster: ${cluster}\n`;
      });
    }

    // D. FITUR JARAK DI AKHIR OUTPUT
    let totalPlanDist = slots.totalDistance;
    if (totalPlanDist === undefined) {
      totalPlanDist = 0;
      slots.forEach((s) => {
        (s.machines || []).forEach((m) => {
          totalPlanDist += typeof this.calculateDistance === "function" ? this.calculateDistance(m, s.cqi) : 0;
        });
      });
    }
    const avgPlanDist = slots.avgDistance || (slots.length > 0 ? (totalPlanDist / slots.length).toFixed(1) : 0);
    out += `\n📍 *ESTIMASI JARAK TEMPUH LORONG:* ${totalPlanDist} langkah (~${Math.round(totalPlanDist * 0.8)} meter) | Rata-rata: ${avgPlanDist} langkah/CQI\n`;

    return out;
  },

};
