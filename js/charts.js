/**
 * MCGI Production Monitoring System - Analytics & Visualization Charts (Chart.js)
 * Supports dynamic multi-system theming:
 * - MCGI Production: Golden Amber & Sapphire Glows
 * - MCGI Guest Coordinators: Strict Monochrome Black & White
 * - MCGI Teatro Kristiano: Vibrant Pink & Crisp White
 */

const ChartsModule = {
  trendChart: null,
  deptChart: null,
  doughnutChart: null,

  init() {
    this.renderAll();
    window.addEventListener('resize', () => this.resizeCharts());
  },

  getThemeConfig() {
    const duty = (typeof getActiveDutyScope === 'function' ? getActiveDutyScope() : 'MPRO').toUpperCase();
    if (duty === 'GCOS') {
      return {
        duty: 'GCOS',
        trendBorder: '#ffffff',
        trendPoint: '#ffffff',
        trendGradStart: 'rgba(255, 255, 255, 0.45)',
        trendGradMid: 'rgba(255, 255, 255, 0.15)',
        trendGradEnd: 'rgba(0, 0, 0, 0.0)',
        tooltipBg: '#09090b',
        tooltipTitle: '#ffffff',
        tooltipBody: '#f8fafc',
        tooltipBorder: 'rgba(255, 255, 255, 0.4)',
        deptBars: [
          'rgba(255, 255, 255, 0.95)',
          'rgba(228, 228, 231, 0.85)',
          'rgba(212, 212, 216, 0.75)',
          'rgba(161, 161, 170, 0.75)',
          'rgba(113, 113, 122, 0.75)',
          'rgba(82, 82, 91, 0.75)'
        ],
        deptBorders: ['#ffffff', '#e4e4e7', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b'],
        doughnutColors: [
          '#ffffff', // Present: Pure White
          '#d4d4d8', // Late: Soft White / Light Gray
          '#52525b', // Absent: Dark Zinc
          '#27272a'  // Excused: Charcoal
        ],
        doughnutBorder: '#09090b',
        legendColor: '#f8fafc'
      };
    } else if (duty === 'TK') {
      return {
        duty: 'TK',
        trendBorder: '#ec4899',
        trendPoint: '#f472b6',
        trendGradStart: 'rgba(236, 72, 153, 0.50)',
        trendGradMid: 'rgba(236, 72, 153, 0.15)',
        trendGradEnd: 'rgba(26, 10, 20, 0.0)',
        tooltipBg: '#1a0a14',
        tooltipTitle: '#f472b6',
        tooltipBody: '#fdf2f8',
        tooltipBorder: 'rgba(236, 72, 153, 0.5)',
        deptBars: [
          'rgba(236, 72, 153, 0.90)',
          'rgba(244, 114, 182, 0.85)',
          'rgba(219, 39, 119, 0.85)',
          'rgba(251, 207, 232, 0.85)',
          'rgba(190, 24, 93, 0.85)',
          'rgba(253, 164, 175, 0.85)'
        ],
        deptBorders: ['#ec4899', '#f472b6', '#db2777', '#fbcfe8', '#be185d', '#fda4af'],
        doughnutColors: [
          '#ec4899', // Present: Hot Pink
          '#f472b6', // Late: Soft Rose
          '#831843', // Absent: Deep Wine
          '#fbcfe8'  // Excused: Blush Pink
        ],
        doughnutBorder: '#1a0a14',
        legendColor: '#fbcfe8'
      };
    } else {
      // MPRO (Reference Gold & Amber Theme)
      return {
        duty: 'MPRO',
        trendBorder: '#fbbf24',
        trendPoint: '#fde047',
        trendGradStart: 'rgba(245, 158, 11, 0.45)',
        trendGradMid: 'rgba(251, 191, 36, 0.12)',
        trendGradEnd: 'rgba(5, 5, 7, 0.0)',
        tooltipBg: '#121216',
        tooltipTitle: '#fbbf24',
        tooltipBody: '#f8fafc',
        tooltipBorder: 'rgba(245, 158, 11, 0.5)',
        deptBars: [
          'rgba(245, 158, 11, 0.85)',
          'rgba(251, 191, 36, 0.85)',
          'rgba(16, 185, 129, 0.85)',
          'rgba(217, 119, 6, 0.85)',
          'rgba(253, 224, 71, 0.85)'
        ],
        deptBorders: ['#fbbf24', '#f59e0b', '#10b981', '#d97706', '#fde047'],
        doughnutColors: [
          '#10b981', // emerald
          '#f59e0b', // gold/amber
          '#ef4444', // red
          '#71717a'  // graphite
        ],
        doughnutBorder: '#121216',
        legendColor: '#d4d4d8'
      };
    }
  },

  resizeCharts() {
    if (this.trendChart) this.trendChart.resize();
    if (this.deptChart) this.deptChart.resize();
    if (this.doughnutChart) this.doughnutChart.resize();
  },

  renderAll() {
    this.renderTrendChart();
    this.renderDeptChart();
    this.renderDoughnutChart();
  },

  renderTrendChart() {
    const ctx = document.getElementById('dashboardTrendChart');
    if (!ctx) return;

    if (this.trendChart) {
      this.trendChart.destroy();
    }

    const cfg = this.getThemeConfig();

    // Get last 7 days
    const dates = Object.keys(AppState.attendance).sort().slice(-7);
    const labels = dates.map(d => {
      const parts = d.split('-');
      return `${parts[1]}/${parts[2]}`;
    });

    const dataRates = dates.map(d => {
      const stats = App.calculateStats(d);
      return stats.rate;
    });

    const chartCtx = ctx.getContext('2d');
    const grad = chartCtx.createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, cfg.trendGradStart);
    grad.addColorStop(0.5, cfg.trendGradMid);
    grad.addColorStop(1, cfg.trendGradEnd);

    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Attendance Rate (%)',
          data: dataRates,
          borderColor: cfg.trendBorder,
          borderWidth: 3,
          backgroundColor: grad,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: cfg.trendPoint,
          pointBorderColor: cfg.duty === 'GCOS' ? '#000000' : '#050507',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointHoverBackgroundColor: cfg.trendBorder,
          pointHoverBorderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: cfg.tooltipBg,
            titleColor: cfg.tooltipTitle,
            bodyColor: cfg.tooltipBody,
            borderColor: cfg.tooltipBorder,
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              label: (context) => `Attendance: ${context.parsed.y}%`
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.06)',
              drawBorder: false
            },
            ticks: {
              color: '#a1a1aa',
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
            }
          },
          y: {
            min: 0,
            max: 100,
            grid: {
              color: 'rgba(255, 255, 255, 0.06)',
              drawBorder: false
            },
            ticks: {
              color: '#a1a1aa',
              callback: (val) => `${val}%`,
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
            }
          }
        }
      }
    });
  },

  renderDeptChart() {
    const ctx = document.getElementById('dashboardDeptChart');
    if (!ctx) return;

    if (this.deptChart) {
      this.deptChart.destroy();
    }

    const cfg = this.getThemeConfig();

    const depts = [...new Set(AppState.members.map(m => m.department))];
    const deptRates = depts.map(dept => {
      const deptMembers = AppState.members.filter(m => m.department === dept);
      if (deptMembers.length === 0) return 0;
      let totalPresents = 0;
      let totalPossible = 0;

      const dates = Object.keys(AppState.attendance);
      dates.forEach(d => {
        deptMembers.forEach(m => {
          totalPossible++;
          const rec = AppState.attendance[d][m.id];
          if (rec && (rec.status === 'present' || rec.status === 'late')) {
            totalPresents++;
          }
        });
      });

      return totalPossible > 0 ? Math.round((totalPresents / totalPossible) * 100) : 0;
    });

    this.deptChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: depts,
        datasets: [{
          label: 'Department Rate (%)',
          data: deptRates,
          backgroundColor: depts.map((_, i) => cfg.deptBars[i % cfg.deptBars.length]),
          borderColor: depts.map((_, i) => cfg.deptBorders[i % cfg.deptBorders.length]),
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: cfg.tooltipBg,
            titleColor: cfg.tooltipTitle,
            bodyColor: cfg.tooltipBody,
            borderColor: cfg.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (context) => `Avg Rate: ${context.parsed.y}%`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#a1a1aa',
              font: { size: 10 }
            }
          },
          y: {
            min: 0,
            max: 100,
            grid: {
              color: 'rgba(255, 255, 255, 0.06)',
              drawBorder: false
            },
            ticks: {
              color: '#a1a1aa',
              callback: (val) => `${val}%`,
              font: { size: 10 }
            }
          }
        }
      }
    });
  },

  renderDoughnutChart() {
    const ctx = document.getElementById('dashboardDoughnutChart');
    if (!ctx) return;

    if (this.doughnutChart) {
      this.doughnutChart.destroy();
    }

    const cfg = this.getThemeConfig();
    const stats = App.calculateStats(AppState.selectedDate);

    this.doughnutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Present', 'Late', 'Absent', 'Excused'],
        datasets: [{
          data: [stats.present, stats.late, stats.absent, stats.excused],
          backgroundColor: cfg.doughnutColors,
          borderColor: cfg.doughnutBorder,
          borderWidth: 3,
          hoverOffset: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: cfg.legendColor,
              font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" },
              padding: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: cfg.tooltipBg,
            titleColor: cfg.tooltipTitle,
            bodyColor: cfg.tooltipBody,
            borderColor: cfg.tooltipBorder,
            borderWidth: 1
          }
        },
        cutout: '72%'
      }
    });
  }
};

window.ChartsModule = ChartsModule;
