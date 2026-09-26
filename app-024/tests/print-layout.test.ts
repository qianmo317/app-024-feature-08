// 打印排版测试（PRD §10：A4 每页 6/9 条两种版式；超版自动缩小并告警；每页条数 1–24 自由填数；页脚页码与谜号区间）
import { describe, it, expect } from 'vitest';
import { calcLayout, pageCount, pageNoText, noRangeText, MAX_PER_PAGE, PAGE_W_MM, PAGE_H_MM, PAGE_MARGIN_MM } from '../src/lib/print';
import type { PrintSetup } from '../src/types';

function setup(over: Partial<PrintSetup> = {}): PrintSetup {
  return {
    cardWmm: 63, cardHmm: 135, perPage: 6,
    showAnswerSlip: true, showCutLine: true, hostLine: '',
    showAuthor: false, showSource: false, showDifficulty: false, showTags: false,
    showFooter: true, pageStart: 1,
    ...over,
  };
}

function fitsPage(l: ReturnType<typeof calcLayout>): boolean {
  return (
    l.cols * l.cardW + (l.cols - 1) * l.gap <= PAGE_W_MM - 2 * PAGE_MARGIN_MM + 0.01 &&
    l.rows * l.cardH + (l.rows - 1) * l.gap <= PAGE_H_MM - 2 * PAGE_MARGIN_MM + 0.01
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
    const l = calcLayout(setup({ perPage: 6 }));
    expect(l.adjusted).toBe(true);
    expect(l.warning).toBeTruthy();
    expect(l.cardW).toBeLessThan(63);
    expect(l.cardH).toBe(135);
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
  it('perPage 越界钳制（0 → 1 条）', () => {
    const l = calcLayout(setup({ perPage: 0 }));
    expect(l.perPage).toBe(1);
    expect(l.cols * l.rows).toBe(1);
  });
  it(`perPage 上限 ${MAX_PER_PAGE}`, () => {
    const l = calcLayout(setup({ perPage: 999 }));
    expect(l.perPage).toBe(MAX_PER_PAGE);
  });
  it('每页条数自由填数：5 条取 ≥5 的最小整除组合（3 列 × 2 行 = 6）', () => {
    const l = calcLayout(setup({ perPage: 5 }));
    expect(l.perPage).toBe(6);
    expect(l.cols * l.rows).toBe(6);
    expect(fitsPage(l)).toBe(true);
  });
  it('每页条数自由填数：7 条不越界', () => {
    const l = calcLayout(setup({ perPage: 7 }));
    expect(l.perPage).toBeGreaterThanOrEqual(7);
    expect(fitsPage(l)).toBe(true);
  });
  it(`每页 ${MAX_PER_PAGE} 条仍不越界`, () => {
    const l = calcLayout(setup({ perPage: MAX_PER_PAGE }));
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

describe('pageNoText（页脚页码）', () => {
  it('从第 1 页起：第 X 页 / 共 Y 页', () => {
    expect(pageNoText(0, 9, 1)).toBe('第 1 页 / 共 9 页');
    expect(pageNoText(8, 9, 1)).toBe('第 9 页 / 共 9 页');
  });
  it('分批续打：起始页码接着上一批，总页数算入已印页数', () => {
    // 上一批印了 10 页，本批 5 页 → 第 11 页 / 共 15 页 … 第 15 页 / 共 15 页
    expect(pageNoText(0, 5, 11)).toBe('第 11 页 / 共 15 页');
    expect(pageNoText(4, 5, 11)).toBe('第 15 页 / 共 15 页');
  });
  it('起始页码容错：0/负数/小数钳为 ≥1 的整数', () => {
    expect(pageNoText(0, 3, 0)).toBe('第 1 页 / 共 3 页');
    expect(pageNoText(0, 3, -5)).toBe('第 1 页 / 共 3 页');
    expect(pageNoText(1, 3, 2.9)).toBe('第 3 页 / 共 4 页');
  });
});

describe('noRangeText（页脚谜号区间）', () => {
  it('多条显示首末号区间', () => {
    expect(noRangeText([1, 2, 3, 4, 5, 6])).toBe('谜号 1–6');
  });
  it('乱序取最小最大', () => {
    expect(noRangeText([30, 7, 15])).toBe('谜号 7–30');
  });
  it('单条只显示一个号', () => {
    expect(noRangeText([42])).toBe('谜号 42');
  });
  it('空页返回空串', () => {
    expect(noRangeText([])).toBe('');
  });
});
