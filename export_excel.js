  async function exportExcel() {
    if (!currentPlan || currentPlan.length === 0) return alert("Generate planning terlebih dahulu!");
    try { await loadExcelJS(); } catch(e){ return alert(e.message); }

    const wb = new ExcelJS.Workbook(); 
    const ws = wb.addWorksheet('Planning Shift', { 
      views:[{ state:'frozen', xSplit: 0, ySplit: 4 }], 
      pageSetup:{ orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:0 } 
    });
    
    // Set column widths
    ws.columns = [
      { width: 6 },  // NO
      { width: 15 }, // CQI
      { width: 28 }, // CORE
      { width: 28 }, // NON-CORE & LS
      { width: 65 }  // MESIN
    ];

    const headers = ["NO", "CQI", "CORE", "NON-CORE & LS", "MESIN"];
    const allRunning = currentPlan.flatMap(s => s.machines || []);

    const rows = currentPlan.map((slot,i)=>{
      let combinedNc = [];
      if (slot.nonCore && slot.nonCore.length > 0) combinedNc.push(...slot.nonCore);
      if (slot.longshift && slot.longshift.length > 0) combinedNc.push(...slot.longshift);
      
      let coreStr = slot.coreNames && slot.coreNames.length > 0 ? slot.coreNames.join(", ") : String(slot.core);
      let ncAndLs = combinedNc.length > 0 ? combinedNc.join(", ") : "-";
      let macList = BrainAI.formatMachineList(slot.machines, allRunning);
      return [ i+1, slot.cqi.name, coreStr, ncAndLs, macList ];
    });

    const lastCol = headers.length; 
    const title = ws.addRow(["PLANNING SHIFT — LIQUID 3"]); 
    ws.mergeCells(title.number, 1, title.number, lastCol); 
    title.height = 30;
    
    const tCell = ws.getCell(title.number, 1); 
    tCell.font = { name:'Inter', size:14, bold:true, color:{argb:XL.white} }; 
    tCell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:XL.accentDark} }; 
    tCell.alignment = { vertical:'middle', horizontal:'center' };
    
    const stampText = "Dibuat: " + new Date().toLocaleString('id-ID') + "   |   Total CQI: " + currentPlan.length + "   |   Total Mesin: " + currentPlan.reduce((a,s)=>a+s.machines.length,0);
    const stamp = ws.addRow([stampText]); 
    ws.mergeCells(stamp.number, 1, stamp.number, lastCol);
    stamp.height = 20;
    
    const sCell = ws.getCell(stamp.number, 1); 
    sCell.font = { name:'Inter', size:10, italic:true, color:{argb:'FF475569'} }; 
    sCell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:XL.soft} }; 
    sCell.alignment = { vertical:'middle', horizontal:'center' }; 
    
    ws.addRow([]);
    
    const headRow = ws.addRow(headers); 
    headRow.height = 26; 
    headRow.eachCell(c=>{ 
      c.font = { name:'Inter', size:11, bold:true, color:{argb:XL.white} }; 
      c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:XL.accent} }; 
      c.alignment = { vertical:'middle', horizontal:'center', wrapText:true }; 
      c.border = boxBorder(XL.accentDark); 
    });

    rows.forEach((r,i)=>{ 
      const row = ws.addRow(r); 
      // Auto-adjust height somewhat based on content length
      let maxLen = Math.max(String(r[2]).length, String(r[3]).length, String(r[4]).length);
      row.height = Math.max(22, Math.ceil(maxLen / 45) * 16); 
      
      row.eachCell({ includeEmpty:true }, (c,col)=>{ 
        c.font = { name:'Inter', size:10, color:{argb:XL.text} }; 
        c.alignment = { vertical:'middle', wrapText:true, horizontal:(col===1||col===2)?'center':'left' }; 
        c.border = boxBorder(); 
        if(i % 2 === 1) c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:XL.zebra} }; 
      }); 
    });

    // Add QC Passed Info at the bottom if any
    const qcPassed = document.getElementById('qcPassedInput').value.trim();
    if (qcPassed) {
      ws.addRow([]);
      const qcRow = ws.addRow(["QC PASSED:"]);
      qcRow.getCell(1).font = { name:'Inter', size:11, bold:true, color:{argb:XL.text} };
      
      const qcContentRow = ws.addRow([qcPassed]);
      ws.mergeCells(qcContentRow.number, 1, qcContentRow.number, lastCol);
      qcContentRow.height = Math.max(22, (qcPassed.split('\n').length * 16));
      const qcCell = qcContentRow.getCell(1);
      qcCell.font = { name:'Inter', size:10, color:{argb:XL.text} };
      qcCell.alignment = { vertical:'top', horizontal:'left', wrapText:true };
    }

    const buf = await wb.xlsx.writeBuffer(); 
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); 
    a.download = "Planning_Liquid_3.xlsx"; 
    a.click(); 
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
  }
