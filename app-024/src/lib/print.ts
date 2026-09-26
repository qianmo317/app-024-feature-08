// 打印排版：按卡纸尺寸与 A4 可用区计算每页行列、间距与实际卡片尺寸（PRD §8）
import type { PrintSetup } from '../types';

export const PAGE_W_MM = 210;
export const PAGE_H_MM = 297;
export const PAGE_MARGIN_MM = 10;
export const GAP_MM = 4;
/** 每页条数上限：自由填数，A4 版面 6 列 × 4 行 = 24 条仍可容纳（卡片自动缩小） */
export const MAX_PER_PAGE = 24;

export interface PrintLayout {
  cols: number;
  rows: number;
  perPage: number;      // 实际每页条数（cols*rows，≥ setup.perPage 的最小整除组合）
  cardW: number;        // 实际卡片宽（可能自动缩小）
  cardH: number;
  gap: number;
  adjusted: boolean;    // 是否因版面被缩小
  warning?: string;
}

function available(cols: number, rows: number, gap: number): { w: number; h: number } {
  const usableW = PAGE_W_MM - 2 * PAGE_MARGIN_MM;
  const usableH = PAGE_H_MM - 2 * PAGE_MARGIN_MM;
  return {
    w: (usableW - (cols - 1) * gap) / cols,
    h: (usableH - (rows - 1) * gap) / rows,
  };
}

export function calcLayout(setup: PrintSetup, gap = GAP_MM): PrintLayout {
  const want = Math.max(1, Math.min(MAX_PER_PAGE, Math.floor(setup.perPage) || 1));
  let best: PrintLayout | null = null;
  // 枚举列数 1..6，行数 = ceil(want/cols)，取卡片面积最大者（面积相同取更方的）
  for (let cols = 1; cols <= 6; cols++) {
    const rows = Math.ceil(want / cols);
    if (cols * rows < want) continue;
    const avail = available(cols, rows, gap);
    const w = Math.min(setup.cardWmm, avail.w);
    const h = Math.min(setup.cardHmm, avail.h);
    if (w <= 10 || h <= 10) continue;
    const area = w * h;
    if (!best || area > best.cardW * best.cardH + 0.01) {
      const adjusted = w < setup.cardWmm - 0.05 || h < setup.cardHmm - 0.05;
      best = {
        cols, rows, perPage: cols * rows, cardW: round2(w), cardH: round2(h), gap, adjusted,
        warning: adjusted
          ? `卡片 ${setup.cardWmm}×${setup.cardHmm}mm 超出每页 ${want} 条的 A4 版面，已自动缩小为 ${round2(w)}×${round2(h)}mm`
          : undefined,
      };
    }
  }
  if (!best) {
    const avail = available(1, 1, gap);
    best = {
      cols: 1, rows: 1, perPage: 1,
      cardW: Math.min(setup.cardWmm, round2(avail.w)),
      cardH: Math.min(setup.cardHmm, round2(avail.h)),
      gap, adjusted: true,
      warning: '版面参数过小或过大，已回退为单条/页',
    };
  }
  return best;
}

export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}

/** 页脚「谜号区间」文案：单条只显示一个号，空页返回空串 */
export function noRangeText(nos: number[]): string {
  if (!nos.length) return '';
  const lo = Math.min(...nos);
  const hi = Math.max(...nos);
  return lo === hi ? `谜号 ${lo}` : `谜号 ${lo}–${hi}`;
}

/**
 * 页脚「第 X 页 / 共 Y 页」文案。
 * pageStart 为起始页码（≥1）：同一批谜条分两次打印时，
 * 第二批把 pageStart 设为上一批末页 +1，页码即可接着往下排，
 * 「共 Y 页」也算入之前已印的页数（= pageStart - 1 + 本批页数）。
 */
export function pageNoText(pageIndex: number, sheetCount: number, pageStart: number): string {
  const start = Math.max(1, Math.floor(pageStart) || 1);
  return `第 ${start + pageIndex} 页 / 共 ${start + sheetCount - 1} 页`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
