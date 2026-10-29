// The "Hours per week" chart (Chart.js, loaded only when the Progress screen is opened).

import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip, type TooltipItem } from 'chart.js';
import { formatMinutes } from './dom';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

// Colours from the app's palette (see style.css).
const SURFACE = '#16233a';
const GOLD = '#c9a04e';
const PARCHMENT = '#e3cf9f';
const SILVER = '#9a9a9a';
const GRID = 'rgba(201, 160, 78, 0.16)';
const FONT = { family: "'EB Garamond', Garamond, serif", size: 14 };

let current: Chart | null = null;

export function drawWeeklyChart(
  canvas: HTMLCanvasElement,
  weekLabels: string[],
  series: { label: string; color: string; hours: number[] }[],
) {
  current?.destroy(); // the screen was redrawn: replace the old chart
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  current = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: weekLabels,
      datasets: series.map((s) => ({
        label: s.label,
        data: s.hours,
        backgroundColor: s.color,
        hoverBackgroundColor: s.color,
        // A thin line in the card colour between stacked pieces (instead of borders).
        borderColor: SURFACE,
        borderWidth: { top: 2, right: 0, bottom: 0, left: 0 },
        borderRadius: 3,
        borderSkipped: 'start',
        barPercentage: 0.72,
        categoryPercentage: 0.9,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: reduceMotion ? false : { duration: 300 },
      interaction: { mode: 'index', intersect: false }, // hovering anywhere over a week shows that week
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          border: { color: GRID },
          ticks: { color: SILVER, font: FONT, maxRotation: 0, autoSkip: true, autoSkipPadding: 10 },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: GRID },
          border: { display: false },
          ticks: { color: SILVER, font: FONT, precision: 0, maxTicksLimit: 5, callback: (v) => `${v} h` },
        },
      },
      plugins: {
        tooltip: {
          backgroundColor: '#0e1726',
          borderColor: GOLD,
          borderWidth: 1,
          titleColor: GOLD,
          bodyColor: PARCHMENT,
          footerColor: PARCHMENT,
          titleFont: { ...FONT, weight: 'bold' },
          bodyFont: FONT,
          footerFont: { ...FONT, weight: 'bold' },
          padding: 10,
          boxPadding: 4,
          filter: (item: TooltipItem<'bar'>) => (item.raw as number) > 0,
          callbacks: {
            title: (items) => `Week of ${items[0]?.label ?? ''}`,
            label: (item) => ` ${item.dataset.label}: ${formatMinutes((item.raw as number) * 60)}`,
            footer: (items) => `Total: ${formatMinutes(items.reduce((sum, i) => sum + (i.raw as number) * 60, 0))}`,
          },
        },
      },
    },
  });
}
