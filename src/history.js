/**
 * MAP LIQUID 3 - Planning History Management Module
 * Handles loading, previewing, restoring, filtering, and auto-saving shift plannings.
 */

class HistoryManager {
  constructor() {
    this.historyItems = [];
    this.activeShiftFilter = 'all';
    this.activeDateFilter = '';
    this.activeSearchQuery = '';
    this.isLoading = false;
    this.cachedDetails = new Map();
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    this.injectModals();
    this.bindEvents();
    this.isInitialized = true;
  }

  injectModals() {
    if (!document.getElementById('historyModal')) {
      const modalHtml = `
        <div id="historyModal" class="history-modal-overlay" onclick="window.historyManager && window.historyManager.handleOverlayClick(event, 'historyModal')">
          <div class="history-modal-container" onclick="event.stopPropagation()">
            <div class="history-modal-header">
              <div class="history-header-title-group">
                <span class="history-header-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </span>
                <div>
                  <h3>Riwayat Perencanaan Shift</h3>
                  <span style="font-size:11.5px; color:var(--text-muted, #64748b);">Arsip alokasi mesin &amp; manpower per tanggal/shift</span>
                </div>
              </div>
              <div class="history-header-actions">
                <button type="button" class="history-btn-icon" onclick="window.historyManager && window.historyManager.fetchHistoryList(true)" title="Segarkan Daftar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                  </svg>
                </button>
                <button type="button" class="history-btn-close" onclick="window.historyManager && window.historyManager.closeModal()" title="Tutup">&times;</button>
              </div>
            </div>

            <div class="history-filter-bar">
              <div class="history-shift-tabs">
                <button type="button" class="history-shift-tab active" data-shift="all" onclick="window.historyManager.setShiftFilter('all')">Semua Shift</button>
                <button type="button" class="history-shift-tab" data-shift="1" onclick="window.historyManager.setShiftFilter('1')">Shift 1</button>
                <button type="button" class="history-shift-tab" data-shift="2" onclick="window.historyManager.setShiftFilter('2')">Shift 2</button>
                <button type="button" class="history-shift-tab" data-shift="3" onclick="window.historyManager.setShiftFilter('3')">Shift 3</button>
              </div>

              <div class="history-search-group">
                <input type="date" id="historyDateInput" class="history-date-input" title="Filter Tanggal" onchange="window.historyManager.setDateFilter(this.value)">
              </div>
            </div>

            <div id="historyListContainer" class="history-modal-body">
              <div class="history-empty-state">
                <div class="history-loading-spinner"></div>
                <span>Memuat riwayat perencanaan...</span>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    if (!document.getElementById('historyPreviewModal')) {
      const previewModalHtml = `
        <div id="historyPreviewModal" class="history-preview-overlay" onclick="window.historyManager && window.historyManager.handleOverlayClick(event, 'historyPreviewModal')">
          <div class="history-preview-container" onclick="event.stopPropagation()">
            <div class="history-preview-header">
              <div>
                <h3 id="historyPreviewTitle" style="margin:0; font-size:1.05rem; font-weight:700;">Detail Perencanaan</h3>
                <span id="historyPreviewSubtitle" style="font-size:11.5px; color:var(--text-muted, #64748b);">Ringkasan alokasi slot CQI &amp; mesin</span>
              </div>
              <button type="button" class="history-btn-close" onclick="window.historyManager && window.historyManager.closePreview()" title="Tutup">&times;</button>
            </div>

            <div id="historyPreviewContent" class="history-preview-body">
              <!-- Rendered slot table -->
            </div>

            <div class="history-preview-footer">
              <button type="button" class="btn-history-action btn-history-preview" onclick="window.historyManager && window.historyManager.closePreview()">Tutup</button>
              <button type="button" id="historyPreviewLoadBtn" class="btn-history-action btn-history-load">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Terapkan Perencanaan Ini
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', previewModalHtml);
    }
  }

  bindEvents() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (document.getElementById('historyPreviewModal')?.classList.contains('active')) {
          this.closePreview();
        } else if (document.getElementById('historyModal')?.classList.contains('active')) {
          this.closeModal();
        }
      }
    });
  }

  handleOverlayClick(e, modalId) {
    if (e.target.id === modalId) {
      if (modalId === 'historyPreviewModal') this.closePreview();
      if (modalId === 'historyModal') this.closeModal();
    }
  }

  openModal() {
    this.init();
    const modal = document.getElementById('historyModal');
    if (modal) {
      modal.classList.add('active');
      this.fetchHistoryList();
    }
  }

  closeModal() {
    const modal = document.getElementById('historyModal');
    if (modal) modal.classList.remove('active');
  }

  closePreview() {
    const modal = document.getElementById('historyPreviewModal');
    if (modal) modal.classList.remove('active');
  }

  setShiftFilter(shift) {
    this.activeShiftFilter = String(shift);
    document.querySelectorAll('.history-shift-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.getAttribute('data-shift') === this.activeShiftFilter);
    });
    this.renderList();
  }

  setDateFilter(val) {
    this.activeDateFilter = val ? val.trim() : '';
    this.renderList();
  }

  setSearchFilter(val) {
    this.activeSearchQuery = val ? val.trim().toLowerCase() : '';
    this.renderList();
  }

  resetFilters() {
    this.activeShiftFilter = 'all';
    this.activeDateFilter = '';
    this.activeSearchQuery = '';
    const dInput = document.getElementById('historyDateInput');
    const sInput = document.getElementById('historySearchInput');
    if (dInput) dInput.value = '';
    if (sInput) sInput.value = '';
    document.querySelectorAll('.history-shift-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.getAttribute('data-shift') === 'all');
    });
    this.renderList();
  }

  async fetchHistoryList(forceRefresh = false) {
    const container = document.getElementById('historyListContainer');
    if (!container) return;

    if (this.isLoading && !forceRefresh) return;
    this.isLoading = true;

    if (forceRefresh || this.historyItems.length === 0) {
      container.innerHTML = `
        <div class="history-empty-state">
          <div class="history-loading-spinner"></div>
          <span>Menyinkronkan daftar riwayat shift...</span>
        </div>
      `;
    }

    try {
      const res = await fetch('/api/history/list', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.success) {
        this.historyItems = data.items || [];
      } else {
        this.historyItems = [];
      }
    } catch (err) {
      console.warn('Gagal memuat riwayat dari server:', err);
      // Fallback local storage check if any cached plannings exist
      this.historyItems = this.getLocalFallbackItems();
    } finally {
      this.isLoading = false;
      this.renderList();
    }
  }

  getLocalFallbackItems() {
    const items = [];
    try {
      const activeRaw = localStorage.getItem('last_active_planning') || sessionStorage.getItem('active_planning');
      if (activeRaw) {
        const parsed = JSON.parse(activeRaw);
        items.push({
          fileName: 'active_session_planning.json',
          date: new Date().toISOString().split('T')[0],
          shift: 1,
          totalCqi: Array.isArray(parsed) ? parsed.length : 0,
          totalMachines: Array.isArray(parsed) ? parsed.reduce((a, s) => a + ((s.machines || []).length), 0) : 0,
          totalCore: Array.isArray(parsed) ? parsed.filter(s => s.coreNames && s.coreNames.length > 0).length : 0,
          totalNonCore: Array.isArray(parsed) ? parsed.reduce((a, s) => a + ((s.nonCore || []).length), 0) : 0,
          totalLongshift: Array.isArray(parsed) ? parsed.reduce((a, s) => a + ((s.longshift || []).length), 0) : 0,
          generatedAt: new Date().toISOString()
        });
      }
    } catch (e) {}
    return items;
  }

  renderList() {
    const container = document.getElementById('historyListContainer');
    if (!container) return;

    let filtered = [...this.historyItems];

    // Filter by Shift
    if (this.activeShiftFilter !== 'all') {
      const sNum = parseInt(this.activeShiftFilter, 10);
      filtered = filtered.filter((i) => i.shift === sNum);
    }

    // Filter by Date
    if (this.activeDateFilter) {
      filtered = filtered.filter((i) => i.date === this.activeDateFilter || i.fileName.includes(this.activeDateFilter));
    }

    // Filter by Search Query
    if (this.activeSearchQuery) {
      const q = this.activeSearchQuery;
      filtered = filtered.filter((i) =>
        i.fileName.toLowerCase().includes(q) ||
        (i.date && i.date.includes(q)) ||
        `shift ${i.shift}`.includes(q)
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="history-empty-state">
          <div class="history-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <strong style="font-size:13px; color:var(--text-main, #0f172a);">Tidak ada riwayat perencanaan ditemukan</strong>
          <span style="font-size:12px; color:var(--text-muted, #64748b);">Coba sesuaikan filter shift atau tanggal di atas.</span>
        </div>
      `;
      return;
    }

    const isConfigPage = window.location.pathname.includes('config') || typeof window.goToStep === 'function';
    const applyLabel = isConfigPage ? 'Muat ke Board Alokasi' : 'Terapkan ke Live Map';

    const html = filtered.map((item) => {
      const dateFormatted = this.formatIndonesianDate(item.date);
      const shiftName = item.shift === 1 ? 'Shift 1 (07:00 - 15:00)' : item.shift === 2 ? 'Shift 2 (15:00 - 23:00)' : 'Shift 3 (23:00 - 07:00)';
      const shiftClass = `shift-${item.shift || 1}`;

      return `
        <div class="history-card" data-filename="${item.fileName}">
          <div class="history-card-header">
            <div class="history-card-date-badge">
              <span class="history-shift-badge ${shiftClass}">Shift ${item.shift || 1}</span>
              <span>${dateFormatted}</span>
            </div>
            <div class="history-card-meta-text">
              <span class="cqi-id-mono" style="font-size:11px; color:var(--text-muted);">${item.fileName}</span>
            </div>
          </div>

          <div class="history-metrics-grid">
            <div class="history-metric-box">
              <span class="history-metric-label">Slot CQI</span>
              <span class="history-metric-value">${item.totalCqi || 0} Meja</span>
            </div>
            <div class="history-metric-box">
              <span class="history-metric-label">Mesin Running</span>
              <span class="history-metric-value" style="color:#2563eb;">${item.totalMachines || 0} Mesin</span>
            </div>
            <div class="history-metric-box">
              <span class="history-metric-label">Personil Core</span>
              <span class="history-metric-value" style="color:#16a34a;">${item.totalCore || 0} Orang</span>
            </div>
            <div class="history-metric-box">
              <span class="history-metric-label">Non-Core / LS</span>
              <span class="history-metric-value" style="color:#d97706;">${(item.totalNonCore || 0) + (item.totalLongshift || 0)} Orang</span>
            </div>
          </div>

          <div class="history-card-actions">
            <button type="button" class="btn-history-action btn-history-preview" onclick="window.historyManager.previewItem('${item.fileName}')" title="Lihat detail alokasi per meja CQI">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Pratinjau
            </button>
            <button type="button" class="btn-history-action btn-history-load" onclick="window.historyManager.loadItem('${item.fileName}')" title="Terapkan konfigurasi riwayat ini">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              ${applyLabel}
            </button>
            <button type="button" class="btn-history-action btn-history-delete" onclick="window.historyManager.deleteItem('${item.fileName}')" title="Hapus arsip ini">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  formatIndonesianDate(isoDateStr) {
    if (!isoDateStr) return 'Tanggal Tidak Diketahui';
    try {
      const parts = isoDateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      const d = new Date(isoDateStr);
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return isoDateStr;
    }
  }

  async fetchItemDetail(fileName) {
    if (this.cachedDetails.has(fileName)) {
      return this.cachedDetails.get(fileName);
    }
    const res = await fetch(`/history/${fileName}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    this.cachedDetails.set(fileName, json);
    return json;
  }

  async previewItem(fileName) {
    const pModal = document.getElementById('historyPreviewModal');
    const pTitle = document.getElementById('historyPreviewTitle');
    const pSub = document.getElementById('historyPreviewSubtitle');
    const pBody = document.getElementById('historyPreviewContent');
    const pLoadBtn = document.getElementById('historyPreviewLoadBtn');

    if (!pModal || !pBody) return;

    pBody.innerHTML = `
      <div class="history-empty-state">
        <div class="history-loading-spinner"></div>
        <span>Memuat detail alokasi ${fileName}...</span>
      </div>
    `;
    pModal.classList.add('active');

    try {
      const data = await this.fetchItemDetail(fileName);
      const meta = data.meta || {};
      const slots = data.planning || data.slots || data.currentPlan || [];

      if (pTitle) pTitle.innerText = `Detail Perencanaan: ${this.formatIndonesianDate(meta.date || fileName)}`;
      if (pSub) pSub.innerText = `Shift ${meta.shift || 1} · ${meta.total_machines_running || 0} Mesin Running · ${slots.length} Meja CQI`;

      if (pLoadBtn) {
        pLoadBtn.onclick = () => {
          this.closePreview();
          this.loadItem(fileName);
        };
      }

      if (slots.length === 0) {
        pBody.innerHTML = `<div class="history-empty-state">Tidak ada data slot dalam arsip ini.</div>`;
        return;
      }

      const tableRows = slots.map((s, idx) => {
        const cqiLabel = s.cqi || (s.cqi ? s.cqi.name : `Slot ${idx + 1}`);
        const lineLabel = s.cqi_line || '-';
        const coreLabel = s.core || (Array.isArray(s.coreNames) ? s.coreNames.join(', ') : '-');
        const ncArr = Array.isArray(s.non_core) ? s.non_core : (Array.isArray(s.nonCore) ? s.nonCore : []);
        const lsArr = Array.isArray(s.longshift) ? s.longshift : [];
        const supportCombined = ncArr.concat(lsArr);
        const supportText = supportCombined.length > 0 ? supportCombined.join(', ') : '-';
        const macList = Array.isArray(s.machines) ? s.machines.map(m => typeof m === 'object' ? (m.name || m.id) : m) : [];

        return `
          <tr>
            <td style="font-weight:700; width:36px; text-align:center;">${s.no || idx + 1}</td>
            <td>
              <strong style="color:var(--primary, #2563eb);">${cqiLabel}</strong>
              ${lineLabel !== '-' ? `<span style="font-size:10.5px; color:var(--text-muted); display:block;">Line ${lineLabel}</span>` : ''}
            </td>
            <td><span class="person-pill core" style="display:inline-block; font-size:11px; padding:2px 6px;">${coreLabel}</span></td>
            <td>${supportCombined.length > 0 ? supportCombined.map(p => `<span class="person-pill noncore ${String(p).includes('LS') ? 'ls-pill' : ''}" style="display:inline-block; font-size:11px; padding:2px 6px; margin:1px;">${p}</span>`).join('') : '<span style="color:var(--text-muted);">-</span>'}</td>
            <td style="font-weight:700; text-align:center; font-family:'JetBrains Mono', monospace;">${macList.length}</td>
            <td style="font-size:11px; font-family:'JetBrains Mono', monospace; line-height:1.4;">
              ${macList.join(', ')}
            </td>
          </tr>
        `;
      }).join('');

      pBody.innerHTML = `
        <table class="history-preview-table">
          <thead>
            <tr>
              <th style="text-align:center;">No</th>
              <th>Meja CQI</th>
              <th>Personil Core</th>
              <th>Support (NC / LS)</th>
              <th style="text-align:center;">Mesin</th>
              <th>Daftar Mesin Teralokasi</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      `;
    } catch (err) {
      pBody.innerHTML = `
        <div class="history-empty-state" style="color:#dc2626;">
          <strong>Gagal memuat detail file</strong>
          <span>${err.message}</span>
        </div>
      `;
    }
  }

  async loadItem(fileName) {
    try {
      if (typeof window.showToast === 'function') {
        window.showToast(`Memuat data ${fileName}...`, 'info');
      }

      const json = await this.fetchItemDetail(fileName);
      const meta = json.meta || {};
      const rawSlots = json.raw_slots || json.planning || json.slots || json.currentPlan || [];

      // Convert slot into standardized runtime slot structure
      const convertedSlots = rawSlots.map((s, idx) => {
        const cqiName = s.cqi?.name || s.cqi?.id || s.cqi || (s.name ? s.name : `CQI ${idx + 1}`);
        const coreNames = Array.isArray(s.coreNames)
          ? s.coreNames
          : (Array.isArray(s.core) ? s.core.filter(c => c && c !== '-') : (s.core && s.core !== '-' ? [s.core] : []));
        const nonCore = Array.isArray(s.non_core)
          ? s.non_core
          : (Array.isArray(s.nonCore) ? s.nonCore : []);
        const longshift = Array.isArray(s.longshift) ? s.longshift : [];
        const supportPersonnel = (Array.isArray(s.supportPersonnel) && s.supportPersonnel.length > 0)
          ? s.supportPersonnel
          : nonCore.concat(longshift);

        const macList = (Array.isArray(s.machines) ? s.machines : []).map((m) => {
          if (typeof m === 'object' && m !== null) return m;
          return { id: String(m).trim(), name: String(m).trim(), status: 'RUNNING' };
        });

        return {
          id: s.id || `slot-${idx + 1}`,
          no: s.no || idx + 1,
          name: cqiName,
          cqi: typeof s.cqi === 'object' && s.cqi !== null ? s.cqi : { id: cqiName, name: cqiName },
          coreNames: [...coreNames],
          nonCore: [...nonCore],
          longshift: [...longshift],
          supportPersonnel: [...supportPersonnel],
          machines: macList,
          machineColAssignments: s.machineColAssignments || {}
        };
      });

      // Collect all running machine IDs and ready CQI IDs
      const runningMacIds = new Set();
      const readyCqiNames = new Set();

      convertedSlots.forEach((slot) => {
        if (slot.cqi) {
          if (slot.cqi.id) readyCqiNames.add(String(slot.cqi.id).trim().toUpperCase());
          if (slot.cqi.name) readyCqiNames.add(String(slot.cqi.name).trim().toUpperCase());
        }
        (slot.machines || []).forEach((m) => {
          const mId = typeof m === 'object' ? (m.id || m.name) : m;
          if (mId) runningMacIds.add(String(mId).trim().toUpperCase());
        });
      });

      // Synchronize factory internal storage
      try {
        const savedStorageRaw = localStorage.getItem('factory_internal_storage');
        let factoryStorage = savedStorageRaw ? JSON.parse(savedStorageRaw) : null;
        if (factoryStorage && Array.isArray(factoryStorage.machines)) {
          factoryStorage.machines.forEach((m) => {
            const match = runningMacIds.has(String(m.id).trim().toUpperCase()) || runningMacIds.has(String(m.name).trim().toUpperCase());
            m.status = match ? 'RUNNING' : 'OFF';
          });
          if (Array.isArray(factoryStorage.cqis)) {
            factoryStorage.cqis.forEach((c) => {
              const match = readyCqiNames.has(String(c.id).trim().toUpperCase()) || readyCqiNames.has(String(c.name).trim().toUpperCase());
              c.status = match ? 'READY' : 'OFF';
            });
          }
          localStorage.setItem('factory_internal_storage', JSON.stringify(factoryStorage));
        }
      } catch (e) {
        console.warn('Storage sync issue:', e);
      }

      // Reconstruct complete manpower data from slots and special assignments
      const corePool = [];
      const otPool = [];
      const wwPool = [];
      const nonCorePool = [];
      const qcPassedPool = Array.isArray(json.special_assignments?.qc_passed)
        ? json.special_assignments.qc_passed
        : [];

      const CANONICAL_MP = {
        'angel': { id: 'C1', name: 'Angel' },
        'allyssa': { id: 'C2', name: 'Allyssa' },
        'amanda': { id: 'C3', name: 'Amanda' },
        'fira': { id: 'C4', name: 'Fira' },
        'chalista': { id: 'C5', name: 'Chalista' },
        'dwi': { id: 'C6', name: 'Dwi' },
        'dini': { id: 'C7', name: 'Dini', cqi_priority: 'ot', job_priority: 'ot' },
        'mia': { id: 'C8', name: 'Mia', cqi_priority: 'ww', job_priority: 'ww' },
        'jiddan': { id: 'C9', name: 'Jiddan', cqi_priority: 'ww', job_priority: 'ww' },
        'jidan': { id: 'C9', name: 'Jiddan', cqi_priority: 'ww', job_priority: 'ww' },
        'ninda': { id: 'C10', name: 'Ninda' },
        'nurul': { id: 'C11', name: 'Nurul' },
        'thazkia': { id: 'C12', name: 'Thazkia' },
        'riri': { id: 'C13', name: 'Riri' },
        'farhan': { id: 'C14', name: 'Farhan', cqi_priority: 'ot', job_priority: 'ot' },
        'gita': { id: 'C15', name: 'Gita' },
        'allen': { id: 'NC1', name: 'Allen' },
        'dinda': { id: 'NC2', name: 'Dinda' },
        'litha': { id: 'NC3', name: 'Litha' },
        'siska': { id: 'NC4', name: 'Siska' },
        'wulan': { id: 'NC5', name: 'Wulan' },
        'syifa': { id: 'NC6', name: 'Syifa' },
        'm. udin': { id: 'NC7', name: 'M. Udin', job_priority: 'qc-passed' },
        'udin': { id: 'NC7', name: 'M. Udin', job_priority: 'qc-passed' },
        'alief': { id: 'NC8', name: 'Alief', job_priority: 'qc-passed' },
        'jalu': { id: 'NC9', name: 'Jalu', job_priority: 'qc-passed' },
        'andi': { id: 'NC10', name: 'Andi', job_priority: 'qc-passed' },
        'yaya': { id: 'NC11', name: 'Yaya', job_priority: 'qc-passed' },
        'yadi': { id: 'NC12', name: 'Yadi', job_priority: 'milstd,qc-passed' },
        'kirana': { id: 'NC13', name: 'Kirana' },
        'priyya': { id: 'NC14', name: 'Priyya', job_priority: 'supportfg' }
      };

      const getMpCanonical = (rawName, fallbackPrefix, idx) => {
        const clean = String(rawName || '').trim().toLowerCase();
        if (CANONICAL_MP[clean]) return { ...CANONICAL_MP[clean] };
        return { id: `${fallbackPrefix}${idx}`, name: String(rawName).trim() };
      };

      convertedSlots.forEach((slot) => {
        const cqiNum = parseInt(String(slot.cqi?.name || slot.cqi?.id || slot.name || '').replace(/\D/g, '') || '0', 10);
        (slot.coreNames || []).forEach((name) => {
          if (!name || name === '-') return;
          const trimmed = String(name).trim();
          if (cqiNum === 19 || trimmed.toLowerCase() === 'dini' || trimmed.toLowerCase() === 'farhan') {
            if (!otPool.some(x => (typeof x === 'object' ? x.name : x).toLowerCase() === trimmed.toLowerCase())) {
              const info = getMpCanonical(trimmed, 'C', otPool.length + 1);
              otPool.push({ ...info, cqi_priority: 'ot', job_priority: 'ot' });
            }
          } else if (cqiNum === 24 || trimmed.toLowerCase() === 'jiddan' || trimmed.toLowerCase() === 'mia') {
            if (!wwPool.some(x => (typeof x === 'object' ? x.name : x).toLowerCase() === trimmed.toLowerCase())) {
              const info = getMpCanonical(trimmed, 'C', wwPool.length + 1);
              wwPool.push({ ...info, cqi_priority: 'ww', job_priority: 'ww' });
            }
          } else {
            if (!corePool.some(x => (typeof x === 'object' ? x.name : x).toLowerCase() === trimmed.toLowerCase())) {
              corePool.push(getMpCanonical(trimmed, 'C', corePool.length + 1));
            }
          }
        });

        (slot.nonCore || []).forEach((name) => {
          if (!name || name === '-') return;
          const trimmed = String(name).trim();
          if (!nonCorePool.some(x => (typeof x === 'object' ? x.name : x).toLowerCase() === trimmed.toLowerCase())) {
            nonCorePool.push(getMpCanonical(trimmed, 'NC', nonCorePool.length + 1));
          }
        });
      });

      const numSort = (a, b) => {
        const numA = parseInt(String(a.id || '').replace(/\D/g, '') || '0', 10);
        const numB = parseInt(String(b.id || '').replace(/\D/g, '') || '0', 10);
        return numA - numB;
      };
      corePool.sort(numSort);
      nonCorePool.sort(numSort);

      // Count longshift tokens
      let totalLs = 0;
      convertedSlots.forEach(s => {
        (s.longshift || []).forEach(ls => {
          if (ls) totalLs++;
        });
      });
      if (meta.total_longshift !== undefined && !isNaN(meta.total_longshift)) {
        totalLs = parseInt(meta.total_longshift, 10);
      }

      // Persist reconstructed manpower datasets for config.html
      localStorage.setItem('manpower_core', JSON.stringify(corePool));
      localStorage.setItem('manpower_ot', JSON.stringify(otPool));
      localStorage.setItem('manpower_ww', JSON.stringify(wwPool));
      localStorage.setItem('manpower_noncore', JSON.stringify(nonCorePool));
      localStorage.setItem('manpower_qc', JSON.stringify(qcPassedPool));
      localStorage.setItem('manpower_data_v2', JSON.stringify({
        core: corePool,
        ot: otPool,
        ww: wwPool,
        nonCore: nonCorePool,
        qcPassed: qcPassedPool
      }));
      localStorage.setItem('ncls_count', String(totalLs));
      if (meta.date) {
        localStorage.setItem('planning_date', meta.date);
        sessionStorage.setItem('planning_date', meta.date);
      }
      if (meta.shift) {
        localStorage.setItem('selected_shift', String(meta.shift));
        sessionStorage.setItem('selected_shift', String(meta.shift));
      }
      if (json.special_assignments?.mil_std) {
        localStorage.setItem('milStd_val', json.special_assignments.mil_std);
      }
      if (json.special_assignments?.support_fg) {
        localStorage.setItem('supportFg_val', json.special_assignments.support_fg);
      }

      const finalConfigObj = {
        coreData: corePool,
        coreNames: corePool.map(c => c.name),
        otData: otPool,
        otNames: otPool.map(c => c.name),
        wwData: wwPool,
        wwNames: wwPool.map(c => c.name),
        nonCoreData: nonCorePool,
        nonCoreNames: nonCorePool.map(c => c.name),
        longshift: totalLs,
        milStd: json.special_assignments?.mil_std || '',
        supportFg: json.special_assignments?.support_fg || '',
        shift: meta.shift || 1,
        date: meta.date || '',
        tanggal: meta.date || ''
      };

      // Persist active planning across session and local storage
      const planPayloadToSave = {
        version: 1,
        updatedAt: new Date().toISOString(),
        mode: meta.mode || 'standard',
        slots: convertedSlots,
        currentPlan: convertedSlots,
        planning: json.planning || convertedSlots,
        meta: meta,
        special_assignments: json.special_assignments || {},
        lastFinalConfig: finalConfigObj,
        isFromHistory: true,
        historyFile: fileName
      };

      const cacheFull = {
        timestamp: Date.now(),
        currentPlan: convertedSlots,
        slots: convertedSlots,
        lastFinalConfig: finalConfigObj,
        canNavigateSteps: true,
        machineIdsHash: Array.from(runningMacIds).sort().join(','),
        cqiIdsHash: Array.from(readyCqiNames).sort().join(','),
        unassignedMachines: [],
        isFromHistory: true,
        historyFile: fileName
      };

      sessionStorage.setItem('active_planning', JSON.stringify(planPayloadToSave));
      localStorage.setItem('last_active_planning', JSON.stringify(planPayloadToSave));
      sessionStorage.setItem('planning_state', JSON.stringify({ slots: convertedSlots }));
      localStorage.setItem('plan_maker_cache_full_v2', JSON.stringify(cacheFull));

      this.closeModal();

      // Check if we are in index.html (Live Map) or config.html (Dashboard)
      const isMapPage = typeof window.renderGrid === 'function';
      const isConfigPage = typeof window.goToStep === 'function';

      if (isMapPage) {
        if (typeof window.initializeStatuses === 'function') {
          window.initializeStatuses(true);
        }
        if (typeof window.showToast === 'function') {
          window.showToast(`Riwayat ${meta.date || fileName} berhasil diterapkan ke Live Map & Konfigurasi!`, 'success');
        }
      } else if (isConfigPage) {
        window.currentPlan = convertedSlots;
        window.activePlanning = planPayloadToSave;
        window.lastFinalConfig = finalConfigObj;

        // Populate date and shift
        if (meta.date && typeof window.initPlanningDatePicker === 'function') {
          const dateInput = document.getElementById('planningDatePicker');
          if (dateInput) dateInput.value = meta.date;
        }
        if (meta.shift) {
          const shiftSel = document.getElementById('shiftSelect');
          if (shiftSel) shiftSel.value = meta.shift;
          window.currentShiftNum = meta.shift;
        }

        if (typeof window.recalculatePlanDistance === 'function') {
          window.recalculatePlanDistance();
        }
        if (typeof window.renderInteractiveBoard === 'function') {
          window.renderInteractiveBoard();
        }
        if (typeof window.generateTextOutput === 'function') {
          window.generateTextOutput(finalConfigObj);
        }
        if (typeof window.goToStep === 'function') {
          window.canNavigateSteps = true;
          window.goToStep(2);
        }
        if (typeof window.showToast === 'function') {
          window.showToast(`Riwayat ${meta.date || fileName} berhasil dimuat ke Board Alokasi!`, 'success');
        }
      } else {
        window.location.href = 'index.html';
      }
    } catch (err) {
      console.error('Gagal memuat file riwayat:', err);
      if (typeof window.showToast === 'function') {
        window.showToast(`Gagal memuat riwayat: ${err.message}`, 'danger');
      } else {
        alert(`Gagal memuat riwayat: ${err.message}`);
      }
    }
  }

  downloadItem(fileName) {
    const a = document.createElement('a');
    a.href = `/history/${fileName}`;
    a.download = fileName;
    a.click();
    if (typeof window.showToast === 'function') {
      window.showToast(`Mengunduh ${fileName}...`, 'info');
    }
  }

  async deleteItem(fileName) {
    if (!confirm(`Apakah Anda yakin ingin menghapus arsip riwayat "${fileName}" dari server?`)) {
      return;
    }

    try {
      const res = await fetch('/api/history/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName })
      });
      const data = await res.json();
      if (data && data.success) {
        if (typeof window.showToast === 'function') {
          window.showToast(`File ${fileName} berhasil dihapus.`, 'info');
        }
        this.fetchHistoryList(true);
      } else {
        throw new Error(data.error || 'Gagal menghapus file');
      }
    } catch (err) {
      if (typeof window.showToast === 'function') {
        window.showToast(`Gagal menghapus: ${err.message}`, 'danger');
      }
    }
  }

  async autoSaveHistory(payload, fileName) {
    try {
      const res = await fetch('/api/history/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, fileName })
      });
      const data = await res.json();
      if (data && data.success) {
        console.log(`[AutoSave] Arsip ${fileName} berhasil disimpan di server.`);
      }
    } catch (err) {
      console.warn('[AutoSave] Gagal menyimpan ke server:', err);
    }
  }
}

// Global Singleton Instance
const historyManager = new HistoryManager();
window.HistoryManager = HistoryManager;
window.historyManager = historyManager;
window.openHistoryModal = () => historyManager.openModal();
window.closeHistoryModal = () => historyManager.closeModal();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => historyManager.init());
} else {
  historyManager.init();
}

export default historyManager;
