/**
 * App - 대시보드 상태 관리, UI 인터랙션 및 렌더링 파이프라인
 */

class DashboardApp {
  constructor() {
    this.data = [];
    this.fileName = '2027년 국방예산 (기본 데이터)';
    this.activeTab = 'overview';
    this.selectedSector = 'all';
    this.searchQuery = '';
    this.filterType = 'all'; // 'all', 'new', 'existing'
    this.sortCol = 'id';
    this.sortAsc = true;
    this.isDark = localStorage.getItem('theme') === 'dark';

    this.init();
  }

  init() {
    this.applyTheme(this.isDark);
    this.bindEvents();

    // 기본 내장 데이터 로드
    if (window.DEFAULT_DATA && window.DEFAULT_DATA.length > 0) {
      this.loadData(window.DEFAULT_DATA, '2027년_국방예산 (기본 데이터)');
    }
  }

  applyTheme(isDark) {
    this.isDark = isDark;
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.innerHTML = isDark 
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> 라이트`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg> 다크`;
    }

    // 차트 테마 업데이트
    this.renderCharts();
  }

  bindEvents() {
    // 테마 토글
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
      this.applyTheme(!this.isDark);
    });

    // 탭 전환
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabKey = btn.getAttribute('data-tab');
        this.switchTab(tabKey);
      });
    });

    // 파일 업로드 (드롭존 & 인풋)
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          await this.handleFileUpload(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
          await this.handleFileUpload(e.target.files[0]);
          fileInput.value = ''; // 재업로드 가능하도록 초기화
        }
      });
    }

    // 샘플 데이터 복원 버튼
    document.getElementById('btn-load-sample')?.addEventListener('click', () => {
      if (window.DEFAULT_DATA) {
        this.loadData(window.DEFAULT_DATA, '2027년_국방예산 (기본 데이터)');
        this.showToast('기본 샘플 데이터(2027년 국방예산)를 불러왔습니다.', 'success');
      }
    });

    // 양식 템플릿 다운로드
    document.getElementById('btn-download-template')?.addEventListener('click', () => {
      this.downloadTemplate();
    });

    // 엑셀 내보내기
    document.getElementById('btn-export-excel')?.addEventListener('click', () => {
      this.exportToExcel();
    });

    // 테이블 검색 인풋
    document.getElementById('table-search-input')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.renderDataTable();
    });

    // 테이블 필터 셀렉트
    document.getElementById('table-filter-sector')?.addEventListener('change', (e) => {
      this.selectedSector = e.target.value;
      this.renderDataTable();
      this.renderSectorAnalysis();
    });

    document.getElementById('table-filter-type')?.addEventListener('change', (e) => {
      this.filterType = e.target.value;
      this.renderDataTable();
    });

    // 모달 닫기
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') this.closeModal();
    });
  }

  async handleFileUpload(file) {
    try {
      this.showToast(`파일 분석 중: ${file.name}...`, 'info');
      const result = await DataParser.parseFile(file);
      this.loadData(result.data, result.fileName);
      this.showToast(`성공적으로 로드되었습니다! (총 ${result.totalRows}건 / 신규 ${result.newCount}건)`, 'success');
    } catch (err) {
      console.error(err);
      this.showToast(`파일 로드 실패: ${err.message}`, 'error');
    }
  }

  loadData(data, fileName) {
    this.data = data;
    this.fileName = fileName;

    // 헤더 상태 배지 갱신
    const badge = document.getElementById('file-status-badge');
    if (badge) {
      badge.classList.add('loaded');
      badge.innerHTML = `<span class="pulse-dot"></span> ${fileName} (${data.length}개 사업)`;
    }

    // 탭 카운트 뱃지 갱신
    const newItemsCount = data.filter(d => d.isNew).length;
    const tabNewCount = document.getElementById('tab-new-count');
    if (tabNewCount) tabNewCount.textContent = newItemsCount;

    // 분야 필터 셀렉트 옵션 재구성
    this.updateSectorOptions();

    // 화면 렌더링
    this.renderAll();
  }

  switchTab(tabKey) {
    this.activeTab = tabKey;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabKey);
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabKey}`);
    });

    // 탭 전환 시 차트 리사이즈
    if (tabKey === 'overview' || tabKey === 'new-projects') {
      setTimeout(() => this.renderCharts(), 50);
    }
  }

  // 데이터 집계
  getStats() {
    const totalProjects = this.data.length;
    const newProjects = this.data.filter(d => d.isNew);
    const existingProjects = this.data.filter(d => !d.isNew);

    const totalBudget2026 = this.data.reduce((sum, d) => sum + (d.budget2026 || 0), 0);
    const totalBudget2027 = this.data.reduce((sum, d) => sum + (d.budget2027 || 0), 0);
    const totalDiff = totalBudget2027 - totalBudget2026;
    const totalRate = totalBudget2026 > 0 ? ((totalDiff / totalBudget2026) * 100).toFixed(1) : '0.0';

    const newBudget = newProjects.reduce((sum, d) => sum + (d.budget2027 || 0), 0);
    const existingBudget = totalBudget2027 - newBudget;
    const newBudgetRatio = totalBudget2027 > 0 ? ((newBudget / totalBudget2027) * 100).toFixed(1) : '0.0';

    // 분야별 집계
    const sectorMap = {};
    this.data.forEach(d => {
      if (!sectorMap[d.field]) {
        sectorMap[d.field] = {
          name: d.field,
          count: 0,
          budget2026: 0,
          budget2027: 0,
          diff: 0,
          newCount: 0,
          newBudget: 0,
          items: []
        };
      }
      const s = sectorMap[d.field];
      s.count++;
      s.budget2026 += (d.budget2026 || 0);
      s.budget2027 += (d.budget2027 || 0);
      s.diff += (d.diff || 0);
      if (d.isNew) {
        s.newCount++;
        s.newBudget += (d.budget2027 || 0);
      }
      s.items.push(d);
    });

    const sectors = Object.values(sectorMap).sort((a, b) => b.budget2027 - a.budget2027);

    return {
      totalProjects,
      newProjects,
      existingProjects,
      totalBudget2026,
      totalBudget2027,
      totalDiff,
      totalRate,
      newBudget,
      existingBudget,
      newBudgetRatio,
      sectors
    };
  }

  updateSectorOptions() {
    const stats = this.getStats();
    const select = document.getElementById('table-filter-sector');
    if (!select) return;

    let html = `<option value="all">전체 분야 (${stats.totalProjects}개)</option>`;
    stats.sectors.forEach(s => {
      html += `<option value="${s.name}">${s.name} (${s.count}개)</option>`;
    });
    select.innerHTML = html;
  }

  renderAll() {
    this.renderKPIs();
    this.renderCharts();
    this.renderSectorAnalysis();
    this.renderNewProjectsView();
    this.renderDataTable();
  }

  // 1. 종합 KPI 렌더링
  renderKPIs() {
    const stats = this.getStats();

    // 총 사업수
    document.getElementById('kpi-total-projects').textContent = `${stats.totalProjects.toLocaleString()}개`;
    document.getElementById('kpi-new-badge').textContent = `신규 ${stats.newProjects.length}개 (${((stats.newProjects.length / (stats.totalProjects || 1)) * 100).toFixed(0)}%)`;

    // 2026년 본예산
    document.getElementById('kpi-budget-2026').textContent = `${Math.round(stats.totalBudget2026).toLocaleString()} 억원`;

    // 2027년 정부안
    document.getElementById('kpi-budget-2027').textContent = `${Math.round(stats.totalBudget2027).toLocaleString()} 억원`;

    // 총 증감액
    const diffSign = stats.totalDiff >= 0 ? '+' : '';
    document.getElementById('kpi-diff').textContent = `${diffSign}${Math.round(stats.totalDiff).toLocaleString()} 억원`;
    const rateBadge = document.getElementById('kpi-rate-badge');
    rateBadge.textContent = `${diffSign}${stats.totalRate}%`;
    rateBadge.className = `kpi-badge ${stats.totalDiff >= 0 ? 'up' : 'down'}`;

    // 신규사업 총 예산
    document.getElementById('kpi-new-budget').textContent = `${Math.round(stats.newBudget).toLocaleString()} 억원`;
    document.getElementById('kpi-new-ratio').textContent = `전체 예산의 ${stats.newBudgetRatio}%`;
  }

  // 차트 일괄 렌더링
  renderCharts() {
    const stats = this.getStats();
    if (!this.data || this.data.length === 0) return;

    // 개요 차트
    ChartsManager.renderSectorComparison('chart-sector-comparison', stats.sectors, this.isDark);
    ChartsManager.renderSectorShare('chart-sector-share', stats.sectors, this.isDark);
    ChartsManager.renderNewVsExisting('chart-new-vs-existing', stats.newBudget, stats.existingBudget, this.isDark);
    ChartsManager.renderTopIncreases('chart-top-increases', this.data, this.isDark);

    // 신규사업 전용 차트
    ChartsManager.renderNewProjectsRanking('chart-new-ranking', stats.newProjects, this.isDark);
    ChartsManager.renderNewSectorDistribution('chart-new-distribution', stats.sectors, this.isDark);
  }

  // 2. 분야별 대시보드 렌더링
  renderSectorAnalysis() {
    const stats = this.getStats();
    const container = document.getElementById('sector-cards-container');
    const pillsContainer = document.getElementById('sector-pills-container');
    if (!container || !pillsContainer) return;

    // 필터 알약 버튼 렌더링
    let pillsHtml = `
      <button class="pill-btn ${this.selectedSector === 'all' ? 'active' : ''}" data-sector="all">
        전체 보기 (${stats.sectors.length}개 분야)
      </button>
    `;
    stats.sectors.forEach(s => {
      pillsHtml += `
        <button class="pill-btn ${this.selectedSector === s.name ? 'active' : ''}" data-sector="${s.name}">
          ${s.name} (${s.count})
        </button>
      `;
    });
    pillsContainer.innerHTML = pillsHtml;

    pillsContainer.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedSector = btn.getAttribute('data-sector');
        this.renderSectorAnalysis();
        const select = document.getElementById('table-filter-sector');
        if (select) select.value = this.selectedSector;
        this.renderDataTable();
      });
    });

    // 분야 카드 렌더링 (필터된 분야만 표시)
    const filteredSectors = this.selectedSector === 'all' 
      ? stats.sectors 
      : stats.sectors.filter(s => s.name === this.selectedSector);

    let cardsHtml = '';
    filteredSectors.forEach(s => {
      const diffSign = s.diff >= 0 ? '+' : '';
      const rateStr = s.budget2026 > 0 ? `${diffSign}${((s.diff / s.budget2026) * 100).toFixed(1)}%` : '신규';

      cardsHtml += `
        <div class="sector-card">
          <div class="sector-card-top">
            <div>
              <h4 class="sector-name">${s.name}</h4>
              <span class="file-status-badge">총 ${s.count}개 세부사업 ${s.newCount > 0 ? `(신규 ${s.newCount}개)` : ''}</span>
            </div>
            <span class="kpi-badge ${s.diff >= 0 ? 'up' : 'down'}">${rateStr}</span>
          </div>

          <div class="sector-stats-row">
            <div class="sector-stat-col">
              <div class="label">2026년</div>
              <div class="val">${Math.round(s.budget2026).toLocaleString()}억</div>
            </div>
            <div class="sector-stat-col">
              <div class="label">2027년</div>
              <div class="val" style="color:var(--color-primary);">${Math.round(s.budget2027).toLocaleString()}억</div>
            </div>
            <div class="sector-stat-col">
              <div class="label">증감액</div>
              <div class="val" style="color:${s.diff >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">
                ${diffSign}${Math.round(s.diff).toLocaleString()}억
              </div>
            </div>
          </div>

          <div class="sector-project-list">
            ${s.items.map(item => `
              <div class="sector-project-item ${item.isNew ? 'is-new' : ''}" onclick="window.app.openModal(${item.id})">
                <span class="name">${item.isNew ? '<span class="tag-new">신규</span> ' : ''}${item.name}</span>
                <span class="budget">${item.budget2027 ? item.budget2027.toLocaleString() : 0} ${item.unit}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = cardsHtml;
  }

  // 3. 신규사업 집중 분석 뷰 렌더링
  renderNewProjectsView() {
    const stats = this.getStats();
    const bannerCount = document.getElementById('banner-new-count');
    const bannerBudget = document.getElementById('banner-new-budget');
    const bannerRatio = document.getElementById('banner-new-ratio');
    const gridContainer = document.getElementById('new-projects-grid');

    if (bannerCount) bannerCount.textContent = `${stats.newProjects.length}개 과제`;
    if (bannerBudget) bannerBudget.textContent = `${Math.round(stats.newBudget).toLocaleString()} 억원`;
    if (bannerRatio) bannerRatio.textContent = `전체 예산 중 ${stats.newBudgetRatio}% 점유`;

    if (!gridContainer) return;

    let html = '';
    stats.newProjects.forEach(item => {
      html += `
        <div class="new-card" onclick="window.app.openModal(${item.id})">
          <div class="new-card-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            2027 신규 과제
          </div>
          <div class="new-card-field">${item.field}</div>
          <h4 class="new-card-title">${item.name}</h4>
          <div class="new-card-budget">
            <span class="amount">${item.budget2027.toLocaleString()}</span>
            <span class="unit">${item.unit}</span>
          </div>
          <p class="new-card-desc">${item.description || '상세 근거 내용 없음'}</p>
        </div>
      `;
    });

    gridContainer.innerHTML = html;
  }

  // 4. 상세 데이터 테이블 렌더링
  renderDataTable() {
    const tbody = document.getElementById('table-body');
    const footerCount = document.getElementById('table-count-label');
    const footerSum = document.getElementById('table-sum-label');
    if (!tbody) return;

    // 필터링 적용
    let filtered = this.data.filter(item => {
      // 분야 필터
      if (this.selectedSector !== 'all' && item.field !== this.selectedSector) {
        return false;
      }
      // 신규/기존 필터
      if (this.filterType === 'new' && !item.isNew) return false;
      if (this.filterType === 'existing' && item.isNew) return false;

      // 검색어 필터
      if (this.searchQuery) {
        const q = this.searchQuery;
        const inName = item.name.toLowerCase().includes(q);
        const inField = item.field.toLowerCase().includes(q);
        const inDesc = item.description ? item.description.toLowerCase().includes(q) : false;
        if (!inName && !inField && !inDesc) return false;
      }

      return true;
    });

    // 정렬 적용
    filtered.sort((a, b) => {
      let valA = a[this.sortCol];
      let valB = b[this.sortCol];

      if (typeof valA === 'string') {
        return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      valA = valA || 0;
      valB = valB || 0;
      return this.sortAsc ? valA - valB : valB - valA;
    });

    // 렌더링
    let html = '';
    let sumBudget2027 = 0;

    filtered.forEach(row => {
      sumBudget2027 += (row.budget2027 || 0);
      const diffSign = row.diff >= 0 ? '+' : '';
      const diffClass = row.diff >= 0 ? 'tag-diff-up' : 'tag-diff-down';

      html += `
        <tr onclick="window.app.openModal(${row.id})">
          <td class="text-center">${row.id}</td>
          <td><span style="font-weight:600; font-size:0.8rem; color:var(--text-muted);">${row.field}</span></td>
          <td>
            <strong>${row.name}</strong>
            ${row.isNew ? '<span class="tag-new" style="margin-left:6px;">신규</span>' : ''}
          </td>
          <td class="text-center"><span style="font-size:0.75rem; color:var(--text-muted);">${row.unit}</span></td>
          <td class="text-right">${row.budget2026 ? row.budget2026.toLocaleString() : '0'}</td>
          <td class="text-right" style="font-weight:700; color:var(--color-primary);">${row.budget2027 ? row.budget2027.toLocaleString() : '0'}</td>
          <td class="text-right ${diffClass}">${diffSign}${row.diff ? row.diff.toLocaleString() : '0'}</td>
          <td class="text-center">
            ${row.isNew ? '<span class="tag-new">신규</span>' : `<span class="${diffClass}">${row.rate}</span>`}
          </td>
          <td style="max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-muted);">
            ${row.description || '-'}
          </td>
        </tr>
      `;
    });

    if (filtered.length === 0) {
      html = `<tr><td colspan="9" class="text-center" style="padding:2.5rem; color:var(--text-muted);">조건에 부합하는 데이터가 없습니다.</td></tr>`;
    }

    tbody.innerHTML = html;

    if (footerCount) footerCount.textContent = `조회 결과: 총 ${filtered.length}건`;
    if (footerSum) footerSum.textContent = `2027년 예산 합계: ${Math.round(sumBudget2027).toLocaleString()} 억원`;

    // 테이블 헤더 정렬 인디케이터
    document.querySelectorAll('.data-table th[data-col]').forEach(th => {
      const col = th.getAttribute('data-col');
      th.classList.toggle('sorted', col === this.sortCol);
      const icon = th.querySelector('.sort-icon');
      if (icon) {
        icon.textContent = col === this.sortCol ? (this.sortAsc ? '▲' : '▼') : '↕';
      }

      th.onclick = () => {
        if (this.sortCol === col) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortCol = col;
          this.sortAsc = false; // 기본 내림차순
        }
        this.renderDataTable();
      };
    });
  }

  // 상세 모달 열기
  openModal(id) {
    const item = this.data.find(d => d.id === id);
    if (!item) return;

    const modalTitle = document.getElementById('modal-item-title');
    const modalBody = document.getElementById('modal-item-content');
    const modalBackdrop = document.getElementById('modal-backdrop');

    if (modalTitle) modalTitle.textContent = item.name;

    const diffSign = item.diff >= 0 ? '+' : '';
    const rateBadge = item.isNew 
      ? '<span class="tag-new">2027년 신규 사업</span>' 
      : `<span class="kpi-badge up">${item.rate} 증액</span>`;

    let html = `
      <div class="detail-row">
        <span class="detail-label">연번 / ID</span>
        <span class="detail-value">No. ${item.id}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">분야 (중점영역)</span>
        <span class="detail-value" style="font-weight:700; color:var(--color-primary);">${item.field}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">사업 구분</span>
        <span class="detail-value">${rateBadge}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">2026년 예산 (A)</span>
        <span class="detail-value">${item.budget2026 ? item.budget2026.toLocaleString() : '0'} ${item.unit}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">2027년 정부안 (B)</span>
        <span class="detail-value" style="font-size:1.1rem; font-weight:800; color:var(--color-primary);">
          ${item.budget2027 ? item.budget2027.toLocaleString() : '0'} ${item.unit}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">전년 대비 증감</span>
        <span class="detail-value" style="font-weight:700; color:${item.diff >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">
          ${diffSign}${item.diff ? item.diff.toLocaleString() : '0'} ${item.unit}
        </span>
      </div>

      <div class="detail-box">
        <div class="detail-box-title">핵심 내용 및 보도자료 박스 원문 근거</div>
        <div class="detail-box-content">${item.description || '원문 내용이 등록되어 있지 않습니다.'}</div>
      </div>
    `;

    if (modalBody) modalBody.innerHTML = html;
    if (modalBackdrop) modalBackdrop.classList.add('open');
  }

  closeModal() {
    const modalBackdrop = document.getElementById('modal-backdrop');
    if (modalBackdrop) modalBackdrop.classList.remove('open');
  }

  // 엑셀 내보내기
  exportToExcel() {
    if (!this.data || this.data.length === 0) {
      this.showToast('내보낼 데이터가 없습니다.', 'error');
      return;
    }

    const headers = [
      '연번', '분야 (중점영역)', '세부 사업 / 주요 지표', '구분/단위', 
      '2026년 (A)', '2027년 정부안 (B)', '증감 (B-A)', '증가율 (%)', '핵심 내용 및 보도자료 박스 원문 근거'
    ];

    const rows = this.data.map(d => [
      d.id, d.field, d.name, d.unit, d.budget2026, d.budget2027, d.diff, d.rate, d.description
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '예산대시보드_추출');

    const outName = `예산데이터_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, outName);
    this.showToast(`엑셀 파일로 내보냈습니다: ${outName}`, 'success');
  }

  // 양식 CSV 다운로드
  downloadTemplate() {
    const link = document.createElement('a');
    link.href = 'data/sample_template.csv';
    link.download = '예산입력양식_템플릿.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('입력 양식 템플릿(.csv)을 다운로드했습니다.', 'info');
  }

  // 토스트 메시지
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// 앱 초기화
window.addEventListener('DOMContentLoaded', () => {
  window.app = new DashboardApp();
});
