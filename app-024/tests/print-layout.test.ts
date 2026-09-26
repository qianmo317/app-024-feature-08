// 打印排版测试（PRD §10：A4 每页条数自定义；超版自动缩小并告警；页脚占位与页码续排）
import { describe, it, expect } from 'vitest';
import { calcLayout, pageCount, pageFooter, PAGE_W_MM, PAGE_H_MM, PAGE_MARGIN_MM, FOOTER_RESERVE_MM, MAX_PER_PAGE } from '../src/lib/print';
import type { PrintSetup } from '../src/types';

function setup(over: Partial<PrintSetup> = {}): PrintSetup {
  return {
    cardWmm: 63, cardHmm: 135, perPage: 6,
    showAnswerSlip: true, showCutLine: true, hostLine: '',
    showAuthor: false, showSource: false, showDifficulty: false, showTags: false,
    showFooter: true, startPage: 1,
    ...over,
  };
}

function fitsPage(l: ReturnType<typeof calcLayout>, footer = true): boolean {
  const reserve = footer ? FOOTER_RESERVE_MM : 0;
  return (
    l.cols * l.cardW + (l.cols - 1) * l.gap <= PAGE_W_MM - 2 * PAGE_MARGIN_MM + 0.01 &&
    l.rows * l.cardH + (l.rows - 1) * l.gap <= PAGE_H_MM - 2 * PAGE_MARGIN_MM - reserve + 0.01
  );
}

describe('calcLayout', () => {
  it('每页 6 条：3 列 × 2 行，卡片不超出 A4 可用区', () => {
    const l = calcLayout(setup({ perPage: 6 }));
    expect(l.cols).toBe(3);
    expect(l.rows).toBe(2);
    expect(l.perPage).toBe(6);
    expect(fitsPage(l)).toBe(true);
  });
  it('每页 9 条：3 列 × 3 行，卡片不超出 A4 可用区', () => {
    const l = calcLayout(setup({ perPage: 9 }));
    expect(l.cols).toBe(3);
    expect(l.rows).toBe(3);
    expect(fitsPage(l)).toBe(true);
  });
  it('63×135mm 在每页 6 条时宽度受限自动缩小并告警', () => {
    const l = calcLayout(setup({ perPage: 6, showFooter: false }));
    expect(l.adjusted).toBe(true);
    expect(l.warning).toBeTruthy();
    expect(l.cardW).toBeLessThan(63);
    expect(l.cardH).toBe(135);
  });
  it('页脚占位：默认开页脚时高度预留，卡片不压页脚', () => {
    const withFooter = calcLayout(setup({ perPage: 6, showFooter: true }));
    const noFooter = calcLayout(setup({ perPage: 6, showFooter: false }));
    expect(withFooter.cardH).toBeLessThan(noFooter.cardH);
    expect(fitsPage(withFooter, true)).toBe(true);
    // 卡片区底边不超过页脚区顶边（版心内扣掉页脚预留）
    const bottom = PAGE_MARGIN_MM + withFooter.rows * withFooter.cardH + (withFooter.rows - 1) * withFooter.gap;
    expect(bottom).toBeLessThanOrEqual(PAGE_H_MM - PAGE_MARGIN_MM - FOOTER_RESERVE_MM + 0.01);
  });
  it('小卡片（50×80）在每页 6 条时无需缩小', () => {
    const l = calcLayout(setup({ perPage: 6, cardWmm: 50, cardHmm: 80 }));
    expect(l.adjusted).toBe(false);
    expect(l.cardW).toBe(50);
    expect(l.cardH).toBe(80);
  });
  it('每页 12 条仍不越界', () => {
    const l = calcLayout(setup({ perPage: 12 }));
    expect(l.perPage).toBe(12);
    expect(fitsPage(l)).toBe(true);
  });
  it('每页条数可自定义非预设值（如 5、7、10）', () => {
    for (const n of [5, 7, 10, 11, 15, 20]) {
      const l = calcLayout(setup({ perPage: n }));
      expect(l.perPage).toBeGreaterThanOrEqual(n);
      expect(fitsPage(l)).toBe(true);
    }
  });
  it('perPage 越界钳制（0 → 1 条）', () => {
    const l = calcLayout(setup({ perPage: 0 }));
    expect(l.perPage).toBe(1);
    expect(l.cols * l.rows).toBe(1);
  });
  it(`perPage 上限 ${MAX_PER_PAGE}`, () => {
    const l = calcLayout(setup({ perPage: 999 }));
    expect(l.perPage).toBe(MAX_PER_PAGE);
    expect(fitsPage(l)).toBe(true);
  });
  it('超大卡片自动缩小到可用区', () => {
    const l = calcLayout(setup({ perPage: 1, cardWmm: 300, cardHmm: 400 }));
    expect(fitsPage(l)).toBe(true);
    expect(l.adjusted).toBe(true);
  });
});

describe('pageCount', () => {
  it('向上取整', () => {
    expect(pageCount(0, 6)).toBe(1);
    expect(pageCount(1, 6)).toBe(1);
    expect(pageCount(7, 6)).toBe(2);
    expect(pageCount(300, 9)).toBe(34);
  });
});

describe('pageFooter（页码与谜号区间）', () => {
  it('第一批从第 1 页起：页码 = 页序 + 1，总页数 = 本批页数', () => {
    const f = pageFooter(0, 3, 1, [1, 2, 3, 4, 5, 6]);
    expect(f.pageNo).toBe(1);
    expect(f.totalPages).toBe(3);
    expect(f.noFrom).toBe(1);
    expect(f.noTo).toBe(6);
  });
  it('续排：起始页码接着上一批往下排，总页数含已打印页', () => {
    // 上一批打了 6 页，本批 2 页：本批第一页应为第 7 页 / 共 8 页
    const f = pageFooter(0, 2, 7, [101, 102]);
    expect(f.pageNo).toBe(7);
    expect(f.totalPages).toBe(8);
    const last = pageFooter(1, 2, 7, [105, 106]);
    expect(last.pageNo).toBe(8);
    expect(last.totalPages).toBe(8);
  });
  it('谜号区间取本页最小~最大（谜号可不连续）', () => {
    const f = pageFooter(0, 1, 1, [12, 3, 27, 8]);
    expect(f.noFrom).toBe(3);
    expect(f.noTo).toBe(27);
  });
  it('单条页：区间起止相同', () => {
    const f = pageFooter(0, 1, 1, [42]);
    expect(f.noFrom).toBe(42);
    expect(f.noTo).toBe(42);
  });
  it('起始页码容错：0 / 负数 / 小数钳为 1 起', () => {
    expect(pageFooter(0, 1, 0, [1]).pageNo).toBe(1);
    expect(pageFooter(0, 1, -5, [1]).pageNo).toBe(1);
    expect(pageFooter(2, 3, 2.9, [1]).pageNo).toBe(4);
  });
});
