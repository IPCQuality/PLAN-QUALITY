export default {
  // ==========================================================================
  // 3. MODUL VALIDATOR SISTEM & ATURAN
  // ==========================================================================

  /**
   * Validasi hasil perencanaan terhadap batasan operasional pabrik, mode alokasi, dan mixing cluster
   * @param {Array} slots - Slot hasil generatePlan
   * @param {Array} machines - Daftar mesin running input
   * @param {number} mode - Mode perencanaan (1 atau 2)
   * @returns {Object} { valid: boolean, violations: string[], info: string[] }
   */
  validate(slots, machines = [], mode = 1) {
    const violations = [];
    const info = [];

    if (!Array.isArray(slots) || slots.length === 0) {
      violations.push("Tidak ada slot perencanaan yang tergenerasi.");
      return { valid: false, violations, info };
    }

    const maxNcPerCqi = mode === 2 ? 1 : 2;
    info.push(
      `INFO: Beroperasi pada MODE ${mode} (Maks ${maxNcPerCqi} Non-Core/LS per CQI).`,
    );

    // 1. Verifikasi kelengkapan alokasi mesin
    const assignedMachineIds = new Set();
    slots.forEach((s) =>
      s.machines.forEach((m) => assignedMachineIds.add(m.id || m.name)),
    );

    const unassigned = machines.filter(
      (m) => !assignedMachineIds.has(m.id || m.name),
    );
    if (unassigned.length > 0) {
      violations.push(
        `${unassigned.length} Mesin Running belum teralokasi: ${this.formatMachineList(unassigned)}.`,
      );
    } else {
      info.push(
        `SUCCESS: 100% Mesin Running (${assignedMachineIds.size} Mesin) berhasil tercover.`,
      );
    }

    // 2. Verifikasi aturan cluster mixing di setiap CQI
    slots.forEach((s) => {
      const cqiNum = this.getCqiNumber(s.cqi);
      const clusters = new Set();
      s.machines.forEach((m) => clusters.add(this.getMachineClusterGroup(m)));
      const clusterArr = Array.from(clusters);

      if (s.machines.length > 1) {
        for (let i = 0; i < s.machines.length; i++) {
          for (let j = i + 1; j < s.machines.length; j++) {
            const mA = s.machines[i];
            const mB = s.machines[j];
            const clusterA = this.getMachineClusterGroup(mA);
            const clusterB = this.getMachineClusterGroup(mB);
            if (
              !this.isClusterMixingAllowed(clusterA, clusterB, cqiNum, mA, mB)
            ) {
              violations.push(
                `CQI ${cqiNum} melanggar aturan mixing cluster: mencampur [${clusterA} - ${mA.name || mA.id}] dengan [${clusterB} - ${mB.name || mB.id}].`,
              );
            }
          }
        }
      }
    });

    // 3. Verifikasi rasio Manpower vs Beban Mesin sesuai Mode 1 / Mode 2 & Aturan Kapasitas Cluster
    slots.forEach((s) => {
      const cqiNum = this.getCqiNumber(s.cqi);
      const mCount = s.machines.length;
      const totalNc = s.nonCore.length + s.longshift.length;
      const rule = this.getClusterCapacityRule(s);

      if (mode === 1) {
        if (totalNc === 0 && mCount > rule.maxCoreOnly) {
          violations.push(
            `CQI ${cqiNum} (Cluster: ${rule.name}) memuat ${mCount} mesin dengan 0 Non-Core (Maksimal ${rule.maxCoreOnly} mesin untuk 1 Core).`,
          );
        } else if (totalNc === 1 && mCount > rule.max1Nc) {
          violations.push(
            `CQI ${cqiNum} (Cluster: ${rule.name}) memuat ${mCount} mesin dengan 1 Non-Core (Maksimal ${rule.max1Nc} mesin untuk 1 Core + 1 Non-Core).`,
          );
        } else if (totalNc >= 2 && mCount > rule.max2Nc) {
          violations.push(
            `CQI ${cqiNum} (Cluster: ${rule.name}) memuat ${mCount} mesin (Maksimal ${rule.max2Nc} mesin untuk 1 Core + 2 Non-Core).`,
          );
        }
        if (totalNc > 2) {
          violations.push(
            `CQI ${cqiNum} melebihi batas maksimal 2 Non-Core/LS di Mode 1.`,
          );
        }
      } else {
        // Mode 2 (Maks 1 Non-Core per CQI)
        if (totalNc === 0 && mCount > rule.maxCoreOnly) {
          violations.push(
            `CQI ${cqiNum} (Cluster: ${rule.name}) memuat ${mCount} mesin dengan 0 Non-Core (Maksimal ${rule.maxCoreOnly} mesin untuk 1 Core di Mode 2).`,
          );
        } else if (totalNc === 1 && mCount > rule.max1Nc) {
          violations.push(
            `CQI ${cqiNum} (Cluster: ${rule.name}) memuat ${mCount} mesin dengan 1 Non-Core (Maksimal ${rule.max1Nc} mesin untuk 1 Core + 1 Non-Core di Mode 2).`,
          );
        }
        if (totalNc > 1) {
          violations.push(
            `CQI ${cqiNum} melebihi batas maksimal 1 Non-Core/LS di Mode 2.`,
          );
        }
      }
    });

    // 4. Verifikasi aturan khusus WW & CQI 24 (Mesin Line A dan B dilarang masuk CQI 24, hanya APK Line C yang diperbolehkan)
    const slot24 = slots.find((s) => this.getCqiNumber(s.cqi) === "24");
    if (slot24) {
      const nonWwIn24 = slot24.machines.filter((m) => !this.isWwMachine(m));
      if (nonWwIn24.length > 0) {
        const invalidIn24 = nonWwIn24.filter((m) => {
          const isLineC = this.isMachineLineC(m);
          const line = String(m.line || "").toUpperCase();
          const ws = String(m.workstation || m.ws || "").toUpperCase();
          const isLineAOrB =
            line.includes("LINE A") ||
            line.includes("LINE B") ||
            line === "A" ||
            line === "B" ||
            ws.endsWith("A") ||
            ws.endsWith("B");
          const isApk =
            this.isPouchMachine(m) ||
            String(m.name || m.id || "")
              .toUpperCase()
              .startsWith("APK");
          return isLineAOrB || !isLineC || !isApk;
        });

        if (invalidIn24.length > 0) {
          violations.push(
            `CQI 24 memuat mesin tidak diizinkan: ${this.formatMachineList(invalidIn24)} (Mesin Line A dan Line B dilarang masuk CQI 24, hanya mesin WW & APK Line C saja yang diperbolehkan).`,
          );
        } else if (nonWwIn24.length > 4) {
          violations.push(
            `CQI 24 memuat lebih dari 4 mesin APK Line C (${nonWwIn24.length} mesin).`,
          );
        } else {
          const wsList = [
            ...new Set(
              nonWwIn24.map((m) =>
                this.getWorkstationKey(m).toUpperCase(),
              ),
            ),
          ];
          if (wsList.length > 2) {
            violations.push(
              `CQI 24 memuat mesin Line C dari ${wsList.length} workstation berbeda (${wsList.join(", ")}). Dilarang keras lebih dari 2 workstation (utamakan 1 workstation atau maksimal 2 workstation).`,
            );
          }

          const totalManpower =
            slot24.core + slot24.nonCore.length + slot24.longshift.length;
          if (totalManpower < 2) {
            violations.push(
              `CQI 24 mendapat tambahan mesin APK Line C tetapi belum memiliki minimal 1 Non-Core / (LS).`,
            );
          } else {
            const wsDetail =
              wsList.length === 1
                ? `1 workstation (${wsList[0]}) - Sesuai preferensi utama agar lebih mudah`
                : `${wsList.length} workstation (${wsList.join(" & ")})`;
            info.push(
              `INFO: CQI 24 mengcover ${slot24.machines.length} Mesin (WW + ${nonWwIn24.length} APK Line C dari ${wsDetail}) dengan dukungan Non-Core/(LS).`,
            );
          }
        }
      }
    }

    // 5. Verifikasi aturan khusus OT & CQI 19 (strictly OT saja, maksimal 2 mesin)
    const slot19 = slots.find((s) => this.getCqiNumber(s.cqi) === "19");
    if (slot19) {
      const nonOtIn19 = slot19.machines.filter((m) => !this.isOtMachine(m));
      if (nonOtIn19.length > 0) {
        violations.push(
          `CQI 19 memuat mesin selain OT: ${this.formatMachineList(nonOtIn19)} (CQI 19 strictly OT saja).`,
        );
      } else if (slot19.machines.length > 2) {
        violations.push(
          `CQI 19 melebihi batas maksimal 2 mesin OT (terisi ${slot19.machines.length} mesin).`,
        );
      } else {
        info.push(
          `INFO: CQI 19 strictly mengcover ${slot19.machines.length} Mesin OT (Maksimal 2 Mesin).`,
        );
      }
    }

    // 6. Verifikasi aturan penyeberangan jalur (Dynamic Cross-Line Rule)
    slots.forEach((s) => {
      const cqiNum = this.getCqiNumber(s.cqi);
      s.machines.forEach((m) => {
        const allowed = this.isCrossLineAllowed(
          m,
          s.cqi,
          machines,
          [],
          [],
        );
        if (!allowed) {
          const ws = m.workstation || m.ws || "";
          violations.push(
            `Mesin ${m.name || m.id} (WS: ${ws}) di CQI ${cqiNum} melanggar aturan Cross-Line: Mesin baris belakang dilarang menyeberang jika mesin baris depan aktif / Line C dilarang keluar.`,
          );
        }
      });
    });

    // 7. Verifikasi ketersediaan Manpower Core
    const emptyCoreSlots = slots.filter(
      (s) => s.machines.length > 0 && s.core === 0,
    );
    if (emptyCoreSlots.length > 0) {
      violations.push(
        `${emptyCoreSlots.length} CQI aktif tidak memiliki Manpower Core.`,
      );
    }

    // 8. Verifikasi tidak ada konflik Manpower ganda (Core / Non-Core assigned lebih dari 1x)
    const assignedCoreMap = new Map();
    const assignedNcMap = new Map();

    slots.forEach((s) => {
      const cqiNum = this.getCqiNumber(s.cqi);
      (s.coreNames || []).forEach((name) => {
        if (!name) return;
        const normalized = this.normalizeName(name);
        if (assignedCoreMap.has(normalized)) {
          violations.push(
            `Konflik Manpower Core: "${name}" ditugaskan ganda pada CQI ${assignedCoreMap.get(normalized)} dan CQI ${cqiNum}.`,
          );
        } else {
          assignedCoreMap.set(normalized, cqiNum);
        }
      });

      (s.nonCore || []).forEach((name) => {
        if (!name || name === "(LS)") return;
        const normalized = this.normalizeName(name);
        if (assignedNcMap.has(normalized)) {
          violations.push(
            `Konflik Manpower Non-Core: "${name}" ditugaskan ganda pada CQI ${assignedNcMap.get(normalized)} dan CQI ${cqiNum}.`,
          );
        } else {
          assignedNcMap.set(normalized, cqiNum);
        }
      });
    });

    return { valid: violations.length === 0, violations, info };
  },

};
