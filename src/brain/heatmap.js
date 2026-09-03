export default {
  // ==========================================================================
  // 6. MODUL HEATMAP & DENSITAS BEBAN LINE (BOTTLE-NECK IDENTIFICATION)
  // ==========================================================================

  /**
   * Menghitung status heatmap, densitas beban per line, dan alokasi warna berintensitas tinggi
   * dengan resolusi konflik warna tetangga (Neighbor Swap) agar tidak ada dua CQI berdekatan
   * yang memiliki warna mirip atau membingungkan.
   */
  calculateHeatmapState(slots, mapData) {
    if (!slots || !Array.isArray(slots) || slots.length === 0 || !mapData) {
      return {
        lineWorkloadMap: {},
        cqiColorMap: {},
        bottleneckLine: null,
        slotDetails: [],
      };
    }

    const HEATMAP_PALETTES = [
      // Level 1: Hot / Crimson / Deep Red (Beban Tertinggi / Bottleneck)
      {
        id: "crimson_dark",
        hex: "#be123c",
        darkHex: "#881337",
        hue: 345,
        family: "red",
        heatRank: 1,
      },
      {
        id: "scarlet_red",
        hex: "#dc2626",
        darkHex: "#991b1b",
        hue: 0,
        family: "red",
        heatRank: 1,
      },
      {
        id: "deep_red",
        hex: "#b91c1c",
        darkHex: "#7f1d1d",
        hue: 355,
        family: "red",
        heatRank: 1,
      },
      {
        id: "ruby_red",
        hex: "#e11d48",
        darkHex: "#9f1239",
        hue: 340,
        family: "red",
        heatRank: 1,
      },

      // Level 2: Fire Orange / Dark Amber / Warm Coral (Beban Tinggi)
      {
        id: "fire_orange",
        hex: "#ea580c",
        darkHex: "#9a3412",
        hue: 25,
        family: "orange",
        heatRank: 2,
      },
      {
        id: "amber_dark",
        hex: "#d97706",
        darkHex: "#92400e",
        hue: 42,
        family: "amber",
        heatRank: 2,
      },
      {
        id: "coral_warm",
        hex: "#f97316",
        darkHex: "#c2410c",
        hue: 20,
        family: "orange",
        heatRank: 2,
      },
      {
        id: "magenta_deep",
        hex: "#c026d3",
        darkHex: "#86198f",
        hue: 295,
        family: "magenta",
        heatRank: 2,
      },

      // Level 3: Royal Indigo / Deep Violet / Vibrant Blue (Beban Sedang)
      {
        id: "indigo_deep",
        hex: "#4338ca",
        darkHex: "#312e81",
        hue: 240,
        family: "indigo",
        heatRank: 3,
      },
      {
        id: "violet_royal",
        hex: "#7c3aed",
        darkHex: "#5b21b6",
        hue: 265,
        family: "violet",
        heatRank: 3,
      },
      {
        id: "blue_royal",
        hex: "#2563eb",
        darkHex: "#1e40af",
        hue: 220,
        family: "blue",
        heatRank: 3,
      },
      {
        id: "purple_vibrant",
        hex: "#9333ea",
        darkHex: "#6b21a8",
        hue: 275,
        family: "purple",
        heatRank: 3,
      },

      // Level 4: Deep Teal / Cyan / Emerald / Forest Green (Beban Normal / Cool)
      {
        id: "teal_deep",
        hex: "#0f766e",
        darkHex: "#134e4a",
        hue: 175,
        family: "teal",
        heatRank: 4,
      },
      {
        id: "cyan_rich",
        hex: "#0284c7",
        darkHex: "#075985",
        hue: 198,
        family: "cyan",
        heatRank: 4,
      },
      {
        id: "emerald_deep",
        hex: "#047857",
        darkHex: "#064e3b",
        hue: 155,
        family: "green",
        heatRank: 4,
      },
      {
        id: "forest_green",
        hex: "#15803d",
        darkHex: "#14532d",
        hue: 135,
        family: "green",
        heatRank: 4,
      },
    ];

    const getHueDistance = (h1, h2) => {
      const d = Math.abs(h1 - h2) % 360;
      return d > 180 ? 360 - d : d;
    };

    // 1. Hitung densitas beban kerja untuk setiap Line
    const lineStats = {};
    (mapData.lines || []).forEach((l) => {
      lineStats[l.name] = {
        line: l,
        name: l.name,
        runningMachines: 0,
        totalMachines: 0,
        activeSlots: 0,
        density: 0,
        workloadScore: 0,
      };
    });

    (mapData.machines || []).forEach((m) => {
      const ws = this.getWorkstationKey(m, mapData.labels);
      let lineName = m.line;
      if (!lineName) {
        if (ws.endsWith("A")) lineName = "LINE A";
        else if (ws.endsWith("B")) lineName = "LINE B";
        else if (ws.endsWith("C")) lineName = "LINE C";
        else if (ws === "WW") lineName = "WW";
        else if (ws === "OT") lineName = "OT";
        else lineName = "LAINNYA";
      }
      if (!lineStats[lineName]) {
        lineStats[lineName] = {
          line: {
            name: lineName,
            id: lineName.toLowerCase().replace(/\s+/g, "-"),
          },
          name: lineName,
          runningMachines: 0,
          totalMachines: 0,
          activeSlots: 0,
          density: 0,
          workloadScore: 0,
        };
      }
      lineStats[lineName].totalMachines++;
      if (m.status === "RUNNING") {
        lineStats[lineName].runningMachines++;
      }
    });

    // Periksa juga mesin running dari objek slot activePlanning
    const runningFromSlots = new Set();
    slots.forEach((s) => {
      if (!s) return;
      if (s.cqi) {
        const primaryLine = this.getCqiPrimaryLine(s.cqi);
        if (lineStats[primaryLine]) {
          lineStats[primaryLine].activeSlots++;
        }
      }
      if (Array.isArray(s.machines)) {
        s.machines.forEach((m) => {
          const mKey = String(m.id || m.name).trim();
          if (!runningFromSlots.has(mKey)) {
            runningFromSlots.add(mKey);
            const ws = this.getWorkstationKey(m, mapData.labels);
            let lineName = m.line;
            if (!lineName) {
              if (ws.endsWith("A")) lineName = "LINE A";
              else if (ws.endsWith("B")) lineName = "LINE B";
              else if (ws.endsWith("C")) lineName = "LINE C";
              else if (ws === "WW") lineName = "WW";
              else if (ws === "OT") lineName = "OT";
              else lineName = "LAINNYA";
            }
            if (
              lineStats[lineName] &&
              lineStats[lineName].runningMachines < runningFromSlots.size
            ) {
              // Jika mapData belum di-update statusnya, gunakan count dari slot
              lineStats[lineName].slotMachineCount =
                (lineStats[lineName].slotMachineCount || 0) + 1;
            }
          }
        });
      }
    });

    // Sinkronisasi runningMachines jika data slot lebih spesifik
    Object.values(lineStats).forEach((st) => {
      if (st.slotMachineCount && st.slotMachineCount > st.runningMachines) {
        st.runningMachines = st.slotMachineCount;
      }
    });

    Object.values(lineStats).forEach((st) => {
      st.density =
        st.totalMachines > 0 ? st.runningMachines / st.totalMachines : 0;
      st.workloadScore =
        st.runningMachines * 10 + st.density * 50 + st.activeSlots * 6;
    });

    const sortedLines = Object.values(lineStats).sort(
      (a, b) => b.workloadScore - a.workloadScore,
    );
    const maxLineScore =
      sortedLines.length > 0 ? Math.max(1, sortedLines[0].workloadScore) : 1;

    const lineWorkloadMap = {};
    let bottleneckLine = null;

    sortedLines.forEach((st, idx) => {
      const isBottleneck = idx === 0 && st.runningMachines > 0;
      if (isBottleneck) bottleneckLine = st.name;

      let tier = "normal";
      if (st.runningMachines === 0) {
        tier = "idle";
      } else if (isBottleneck) {
        tier = "bottleneck";
      } else if (idx === 1 || st.workloadScore / maxLineScore >= 0.6) {
        tier = "high";
      } else if (st.workloadScore / maxLineScore >= 0.35) {
        tier = "medium";
      }

      lineWorkloadMap[st.name] = {
        name: st.name,
        rank: idx + 1,
        isBottleneck,
        tier,
        score: st.workloadScore,
        relativeLoad: st.workloadScore / maxLineScore,
        runningMachines: st.runningMachines,
        totalMachines: st.totalMachines,
        activeSlots: st.activeSlots,
        density: st.density,
        densityPercent: Math.round(st.density * 100),
      };
    });

    // 2. Siapkan data centroid posisi dan line untuk masing-masing CQI slot
    const slotDetails = slots.map((s, idx) => {
      const primaryLine = this.getCqiPrimaryLine(s.cqi);
      const lineInfo = lineWorkloadMap[primaryLine] || {
        rank: 99,
        relativeLoad: 0.5,
        tier: "normal",
      };

      let sumR = 0,
        sumC = 0,
        count = 0;
      (s.machines || []).forEach((m) => {
        const pos = m.position || { row: m.row || 0, col: m.col || 0 };
        sumR += pos.row;
        sumC += pos.col;
        count++;
      });
      const cqiNode = (mapData.cqis || []).find(
        (c) => (c.id || c.name) === (s.cqi.id || s.cqi.name),
      );
      if (cqiNode) {
        sumR += (cqiNode.row || 0) * 2;
        sumC += (cqiNode.col || 0) * 2;
        count += 2;
      }

      const centerRow = count > 0 ? sumR / count : 10;
      const centerCol = count > 0 ? sumC / count : 10;

      return {
        slot: s,
        idx,
        cqiId: s.cqi.id || s.cqi.name,
        cqiName: s.cqi.name,
        primaryLine,
        lineRank: lineInfo.rank,
        lineTier: lineInfo.tier,
        lineRelativeLoad: lineInfo.relativeLoad,
        machineCount: (s.machines || []).length,
        centerRow,
        centerCol,
        assignedColor: null,
      };
    });

    // Urutkan slot berdasarkan prioritas densitas line dan posisi kolom
    slotDetails.sort((a, b) => {
      if (a.lineRank !== b.lineRank) return a.lineRank - b.lineRank;
      return a.centerCol - b.centerCol;
    });

    // 3. Alokasikan warna dengan heat rank yang sesuai dan bobot kontras tetangga
    slotDetails.forEach((slotInfo, sIdx) => {
      let targetHeatRank = 3;
      if (slotInfo.lineTier === "bottleneck") {
        targetHeatRank = 1;
      } else if (slotInfo.lineTier === "high") {
        targetHeatRank = slotInfo.machineCount >= 5 ? 1 : 2;
      } else if (slotInfo.lineTier === "medium") {
        targetHeatRank = 2;
      } else {
        targetHeatRank = 3;
      }

      // Kumpulkan warna tetangga yang sudah teralokasi
      const neighborColors = slotDetails
        .filter((other) => other.assignedColor && other !== slotInfo)
        .filter((other) => {
          const d = Math.hypot(
            other.centerRow - slotInfo.centerRow,
            other.centerCol - slotInfo.centerCol,
          );
          return d < 12 || other.primaryLine === slotInfo.primaryLine;
        })
        .map((other) => other.assignedColor);

      let bestCandidate = null;
      let bestScore = -Infinity;

      HEATMAP_PALETTES.forEach((col) => {
        let score = 0;
        const heatDiff = Math.abs(col.heatRank - targetHeatRank);
        score -= heatDiff * 45;

        for (const nCol of neighborColors) {
          const hueDist = getHueDistance(col.hue, nCol.hue);
          if (hueDist < 40) {
            score -= 600; // Penalti kuat jika warnanya terlalu mirip dengan tetangga!
          } else if (hueDist < 65) {
            score -= 220;
          } else {
            score += hueDist * 1.5; // Bonus kontras tinggi
          }
          if (col.family === nCol.family) {
            score -= 350;
          }
        }

        const totalUsed = slotDetails.filter(
          (o) => o.assignedColor && o.assignedColor.id === col.id,
        ).length;
        score -= totalUsed * 250;

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = col;
        }
      });

      slotInfo.assignedColor =
        bestCandidate || HEATMAP_PALETTES[sIdx % HEATMAP_PALETTES.length];
    });

    // 4. Resolusi Konflik Warna Tetangga (Swap pass)
    for (let pass = 0; pass < 5; pass++) {
      let swapped = false;
      for (let i = 0; i < slotDetails.length; i++) {
        for (let j = i + 1; j < slotDetails.length; j++) {
          const a = slotDetails[i];
          const b = slotDetails[j];
          const dist = Math.hypot(
            a.centerRow - b.centerRow,
            a.centerCol - b.centerCol,
          );
          const isNeighbor = dist < 11 || a.primaryLine === b.primaryLine;

          if (isNeighbor && a.assignedColor && b.assignedColor) {
            const hueDist = getHueDistance(
              a.assignedColor.hue,
              b.assignedColor.hue,
            );
            if (
              hueDist < 45 ||
              a.assignedColor.family === b.assignedColor.family
            ) {
              // Terlalu mirip! Cari slot k di posisi lain yang berjauhan untuk ditukar
              let bestK = -1;
              for (let k = 0; k < slotDetails.length; k++) {
                if (k === i || k === j) continue;
                const cand = slotDetails[k];
                if (!cand.assignedColor) continue;
                const distToA = Math.hypot(
                  a.centerRow - cand.centerRow,
                  a.centerCol - cand.centerCol,
                );
                if (distToA > 14 || cand.primaryLine !== a.primaryLine) {
                  const newHueDist = getHueDistance(
                    a.assignedColor.hue,
                    cand.assignedColor.hue,
                  );
                  if (
                    newHueDist > 70 &&
                    cand.assignedColor.family !== a.assignedColor.family
                  ) {
                    bestK = k;
                    break;
                  }
                }
              }

              if (bestK !== -1) {
                const temp = b.assignedColor;
                b.assignedColor = slotDetails[bestK].assignedColor;
                slotDetails[bestK].assignedColor = temp;
                swapped = true;
              }
            }
          }
        }
      }
      if (!swapped) break;
    }

    const cqiColorMap = {};
    slotDetails.forEach((si) => {
      if (si.assignedColor) {
        cqiColorMap[si.cqiId] = si.assignedColor.hex;
      }
    });

    return { lineWorkloadMap, cqiColorMap, bottleneckLine, slotDetails };
  },
};

// Dukungan Export CommonJS / Browser / Module Node
if (typeof globalThis !== "undefined") {

};
