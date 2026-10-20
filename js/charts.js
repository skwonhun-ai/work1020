/**
 * ChartsManager - Chart.js 인스턴스 라이프사이클 및 시각화 관리
 */

const ChartsManager = {
  instances: {},

  // 색상 팔레트
  PALETTES: [
    '#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', 
    '#0891b2', '#4f46e5', '#db2777', '#ca8a04', '#475569'
  ],

  getThemeColors(isDark) {
    return {
      textColor: isDark ? '#cbd5e1' : '#475569',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? '#1e293b' : '#0f172a',
      tooltipText: '#ffffff'
    };
  },

  destroy(chartKey) {
    if (this.instances[chartKey]) {
      this.instances[chartKey].destroy();
      delete this.instances[chartKey];
    }
  },

  destroyAll() {
    Object.keys(this.instances).forEach(k => this.destroy(k));
  },

  /**
   * 1. 분야별 2026 vs 2027 예산 비교 막대 그래프
   */
  renderSectorComparison(canvasId, sectors, isDark = false) {
    this.destroy('sectorComparison');
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const theme = this.getThemeColors(isDark);
    const labels = sectors.map(s => {
      // 분야명 앞의 ①, ② 같은 기호나 너무 긴 텍스트 정리
      return s.name.length > 14 ? s.name.substring(0, 14) + '...' : s.name;
    });

    const data2026 = sectors.map(s => Math.round(s.budget2026));
    const data2027 = sectors.map(s => Math.round(s.budget2027));

    this.instances['sectorComparison'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '2026년 예산',
            data: data2026,
            backgroundColor: isDark ? 'rgba(148, 163, 184, 0.6)' : 'rgba(100, 116, 139, 0.7)',
            borderColor: isDark ? '#94a3b8' : '#64748b',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: '2027년 정부안',
            data: data2027,
            backgroundColor: 'rgba(37, 99, 235, 0.85)',
            borderColor: '#1d4ed8',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: theme.textColor, font: { weight: '600', size: 12 } }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toLocaleString()} 억원`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { size: 11 } }
          },
          y: {
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              font: { size: 11 },
              callback: (v) => v >= 10000 ? (v / 10000).toFixed(1) + '조' : v.toLocaleString()
            }
          }
        }
      }
    });
  },

  /**
   * 2. 분야별 예산 점유율 (Doughnut Chart)
   */
  renderSectorShare(canvasId, sectors, isDark = false) {
    this.destroy('sectorShare');
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const theme = this.getThemeColors(isDark);
    const labels = sectors.map(s => s.name);
    const data = sectors.map(s => Math.round(s.budget2027));

    this.instances['sectorShare'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: this.PALETTES.slice(0, sectors.length),
          borderWidth: isDark ? 2 : 1,
          borderColor: isDark ? '#151f32' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: theme.textColor,
              boxWidth: 12,
              font: { size: 11 },
              generateLabels: (chart) => {
                const dataset = chart.data.datasets[0];
                const total = dataset.data.reduce((a, b) => a + b, 0);
                return chart.data.labels.map((lbl, idx) => {
                  const val = dataset.data[idx];
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                  return {
                    text: `${lbl} (${pct}%)`,
                    fillStyle: dataset.backgroundColor[idx],
                    hidden: isNaN(dataset.data[idx]) || chart.getDatasetMeta(0).data[idx].hidden,
                    index: idx
                  };
                });
              }
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const val = ctx.raw;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${val.toLocaleString()} 억원 (${pct}%)`;
              }
            }
          }
        },
        cutout: '62%'
      }
    });
  },

  /**
   * 3. 신규사업 예산 vs 기존 예산 구성비
   */
  renderNewVsExisting(canvasId, newBudget, existingBudget, isDark = false) {
    this.destroy('newVsExisting');
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const theme = this.getThemeColors(isDark);
    const total = newBudget + existingBudget;
    const newPct = total > 0 ? ((newBudget / total) * 100).toFixed(1) : 0;
    const existPct = total > 0 ? ((existingBudget / total) * 100).toFixed(1) : 0;

    this.instances['newVsExisting'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [`기존/증액 사업 (${existPct}%)`, `신규 착수 과제 (${newPct}%)`],
        datasets: [{
          data: [Math.round(existingBudget), Math.round(newBudget)],
          backgroundColor: ['#2563eb', '#7c3aed'],
          borderWidth: isDark ? 2 : 1,
          borderColor: isDark ? '#151f32' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: theme.textColor, font: { weight: '600', size: 12 } }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw.toLocaleString()} 억원`
            }
          }
        },
        cutout: '65%'
      }
    });
  },

  /**
   * 4. 증액 상위 Top 5 사업 (수평 막대 그래프)
   */
  renderTopIncreases(canvasId, items, isDark = false) {
    this.destroy('topIncreases');
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const theme = this.getThemeColors(isDark);
    // 증감액 기준 내림차순 정렬 상위 5개
    const sorted = [...items].sort((a, b) => b.diff - a.diff).slice(0, 5);
    const labels = sorted.map(i => i.name.length > 15 ? i.name.substring(0, 15) + '...' : i.name);
    const values = sorted.map(i => Math.round(i.diff));

    this.instances['topIncreases'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '증감액 (억원)',
          data: values,
          backgroundColor: 'rgba(5, 150, 105, 0.85)',
          borderColor: '#059669',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            callbacks: {
              label: (ctx) => ` +${ctx.raw.toLocaleString()} 억원 증액`
            }
          }
        },
        scales: {
          x: {
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              font: { size: 11 },
              callback: (v) => v.toLocaleString()
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { size: 11, weight: '600' } }
          }
        }
      }
    });
  },

  /**
   * 5. 신규사업 예산 규모 순위 (수평 막대 그래프)
   */
  renderNewProjectsRanking(canvasId, newProjects, isDark = false) {
    this.destroy('newRanking');
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const theme = this.getThemeColors(isDark);
    const sorted = [...newProjects].sort((a, b) => b.budget2027 - a.budget2027);
    const labels = sorted.map(p => p.name.length > 18 ? p.name.substring(0, 18) + '...' : p.name);
    const values = sorted.map(p => p.budget2027);

    this.instances['newRanking'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '2027년 신규 예산',
          data: values,
          backgroundColor: 'rgba(124, 58, 237, 0.85)',
          borderColor: '#7c3aed',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            callbacks: {
              title: (items) => sorted[items[0].dataIndex].name,
              afterTitle: (items) => `분야: ${sorted[items[0].dataIndex].field}`,
              label: (ctx) => ` 2027년 예산: ${ctx.raw.toLocaleString()} 억원`
            }
          }
        },
        scales: {
          x: {
            grid: { color: theme.gridColor },
            ticks: { color: theme.textColor, font: { size: 11 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { size: 11, weight: '600' } }
          }
        }
      }
    });
  },

  /**
   * 6. 분야별 신규사업 예산 분포 차트
   */
  renderNewSectorDistribution(canvasId, sectorData, isDark = false) {
    this.destroy('newSectorDist');
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const theme = this.getThemeColors(isDark);
    const filtered = sectorData.filter(s => s.newBudget > 0);
    const labels = filtered.map(s => s.name);
    const values = filtered.map(s => Math.round(s.newBudget));

    this.instances['newSectorDist'] = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: this.PALETTES.slice(0, filtered.length).map(c => c + 'cc')
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: theme.textColor, font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw.toLocaleString()} 억원`
            }
          }
        },
        scales: {
          r: {
            grid: { color: theme.gridColor },
            ticks: { display: false }
          }
        }
      }
    });
  }
};

window.ChartsManager = ChartsManager;
