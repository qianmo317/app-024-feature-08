// 谜条打印：版式配置 + 实时预览 + 裁切线 + 同页双联（上联挂灯笼/下联回收）
import { useMemo, useState } from 'react';
import { useAppState } from '../ui/router';
import { calcLayout, pageFooter, MAX_PER_PAGE } from '../lib/print';
import { scanDuplicates } from '../lib/duplicates';
import { CATEGORY_LABEL, FORMAT_LABEL, type Riddle } from '../types';
import { stars } from '../lib/format';
import { store } from '../lib/store';

const PER_PAGE_PRESETS = [4, 6, 8, 9, 12];

export function PrintPage() {
  const state = useAppState();
  const { print } = state.settings;
  const [scope, setScope] = useState<'selected' | 'all'>('selected');
  const [excludeDup, setExcludeDup] = useState(false);
  const [showAnswer, setShowAnswer] = useState(true); // 预览时显示谜底（便于核对）

  const chosen = useMemo(() => {
    const sel = state.riddles.filter((r) => state.selected.has(r.id));
    const list = scope === 'selected' && sel.length ? sel : state.riddles;
    if (!excludeDup || list.length < 2) return list;
    const dupMap = scanDuplicates(list);
    return list.filter((r) => !dupMap.has(r.id));
  }, [state.riddles, state.selected, scope, excludeDup]);

  const layout = useMemo(() => calcLayout(print), [print]);
  const sheets = useMemo(() => {
    const out: Riddle[][] = [];
    for (let i = 0; i < chosen.length; i += layout.perPage) out.push(chosen.slice(i, i + layout.perPage));
    return out;
  }, [chosen, layout.perPage]);

  const setPrint = (patch: Partial<typeof print>) => { void store.saveSettings({ print: { ...print, ...patch } }); };

  const startPage = Math.max(1, Math.floor(print.startPage) || 1);
  const batchPages = chosen.length ? sheets.length : 0;
  const nextStart = startPage + batchPages;

  const cardExtraParts = (r: Riddle): string[] => {
    const parts: string[] = [];
    if (print.showAuthor && r.author?.trim()) parts.push(`作者：${r.author.trim()}`);
    if (print.showSource && r.source?.trim()) parts.push(`出处：${r.source.trim()}`);
    if (print.showDifficulty) parts.push(`难度：${stars(r.difficulty)}`);
    if (print.showTags && r.tags.length) parts.push(r.tags.map((t) => `#${t}`).join(' '));
    return parts;
  };

  return (
    // 根节点不加包裹 div：打印样式按 .container 的直接子元素取舍（.print-area 保留、其余隐藏）
    <>
      <div className="page-head no-print">
        <h1>出条打印 <small>{chosen.length} 条 · 每页 {layout.perPage} 条 · 本批 {batchPages} 页{batchPages > 0 && print.showFooter ? `（第 ${startPage}–${startPage + batchPages - 1} 页）` : ''}</small></h1>
        <button className="btn btn-primary" onClick={() => window.print()} disabled={!chosen.length}>🖨 打印 / 存 PDF</button>
      </div>

      <div className="panel no-print">
        <div className="field-row">
          <label className="field">
            <span>出条范围</span>
            <select className="input" value={scope} onChange={(e) => setScope(e.target.value as 'selected' | 'all')}>
              <option value="selected">选中的谜条（{state.selected.size}）</option>
              <option value="all">全部谜条（{state.riddles.length}）</option>
            </select>
          </label>
          <label className="field">
            <span>每页条数（1~{MAX_PER_PAGE}，自填）</span>
            <input className="input" type="number" min={1} max={MAX_PER_PAGE} value={print.perPage}
              onChange={(e) => setPrint({ perPage: Math.max(1, Math.min(MAX_PER_PAGE, Math.floor(Number(e.target.value)) || 1)) })} />
          </label>
          <label className="field">
            <span>卡片宽（mm）</span>
            <input className="input" type="number" min={30} max={200} value={print.cardWmm}
              onChange={(e) => setPrint({ cardWmm: Math.max(20, Number(e.target.value) || 0) })} />
          </label>
          <label className="field">
            <span>卡片高（mm）</span>
            <input className="input" type="number" min={30} max={290} value={print.cardHmm}
              onChange={(e) => setPrint({ cardHmm: Math.max(20, Number(e.target.value) || 0) })} />
          </label>
        </div>
        <div className="btn-row wrap small muted" style={{ marginBottom: 10 }}>
          常用条数：
          {PER_PAGE_PRESETS.map((n) => (
            <button key={n} type="button" className={`btn btn-sm${print.perPage === n ? ' btn-primary' : ''}`}
              onClick={() => setPrint({ perPage: n })}>{n} 条/页</button>
          ))}
        </div>
        <div className="btn-row wrap">
          <label className="check-inline"><input type="checkbox" checked={print.showAnswerSlip} onChange={(e) => setPrint({ showAnswerSlip: e.target.checked })} /> 同页双联回收联（含谜底）</label>
          <label className="check-inline"><input type="checkbox" checked={print.showCutLine} onChange={(e) => setPrint({ showCutLine: e.target.checked })} /> 裁切线</label>
          <label className="check-inline"><input type="checkbox" checked={excludeDup} onChange={(e) => setExcludeDup(e.target.checked)} /> 排除重复谜面</label>
          <label className="check-inline"><input type="checkbox" checked={showAnswer} onChange={(e) => setShowAnswer(e.target.checked)} /> 预览时显示谜底（不打印）</label>
        </div>
        <h4 className="print-section-title">卡片内容（谜号、谜面、谜目谜格、落款固定打印）</h4>
        <div className="btn-row wrap">
          <label className="check-inline"><input type="checkbox" checked={print.showAuthor} onChange={(e) => setPrint({ showAuthor: e.target.checked })} /> 作者</label>
          <label className="check-inline"><input type="checkbox" checked={print.showSource} onChange={(e) => setPrint({ showSource: e.target.checked })} /> 出处</label>
          <label className="check-inline"><input type="checkbox" checked={print.showDifficulty} onChange={(e) => setPrint({ showDifficulty: e.target.checked })} /> 难度</label>
          <label className="check-inline"><input type="checkbox" checked={print.showTags} onChange={(e) => setPrint({ showTags: e.target.checked })} /> 标签</label>
        </div>
        <h4 className="print-section-title">页码与分页续排</h4>
        <div className="field-row">
          <label className="field field-narrow">
            <span>起始页码</span>
            <input className="input" type="number" min={1} max={9999} value={print.startPage}
              onChange={(e) => setPrint({ startPage: Math.max(1, Math.floor(Number(e.target.value)) || 1) })} />
          </label>
          <div className="field field-narrow field-static">
            <span>本批页码</span>
            <div className="input-like">{batchPages > 0 ? `第 ${startPage} – ${startPage + batchPages - 1} 页` : '—'}</div>
          </div>
          <div className="field field-static">
            <span>续排</span>
            <button type="button" className="btn" disabled={!batchPages}
              title="本批打印完成后点此，把起始页码推进到下一批第一页"
              onClick={() => setPrint({ startPage: nextStart })}>
              本批已打印 → 下一批从第 {nextStart} 页起
            </button>
          </div>
        </div>
        <div className="btn-row wrap">
          <label className="check-inline"><input type="checkbox" checked={print.showFooter} onChange={(e) => setPrint({ showFooter: e.target.checked })} /> 页脚印「第几页 / 共几页 · 本页谜号区间」</label>
        </div>
        {startPage > 1 && <p className="muted small">续排中：本批页码将接着第 {startPage - 1} 页往下编号，页脚总页数含已打印的 {startPage - 1} 页。</p>}
        <label className="field">
          <span>主办方落款</span>
          <input className="input" value={print.hostLine} onChange={(e) => setPrint({ hostLine: e.target.value })} placeholder="例：××社区工会 · 元宵灯会" />
        </label>
        {layout.adjusted && layout.warning && <p className="warn-text">{layout.warning}</p>}
        {!chosen.length && <p className="warn-text">没有可打印的谜条：先在谜库勾选，或把范围改为「全部」。</p>}
        <p className="muted small">实际排版：{layout.cols} 列 × {layout.rows} 行，卡片 {layout.cardW}×{layout.cardH}mm。谜面字号 ≥ 14pt，黑白打印清晰。</p>
      </div>

      <div className="print-area" data-testid="print-area">
        {sheets.map((sheet, si) => {
          const footer = pageFooter(si, sheets.length, startPage, sheet.map((r) => r.no));
          return (
            <section
              className="sheet"
              key={si}
              data-page={footer.pageNo}
              style={{
                contentVisibility: si > 2 ? 'auto' : 'visible',
                containIntrinsicSize: '297mm',
                // 显式网格行列与排版计算一致，避免 flex 换行受亚像素舍入影响
                gridTemplateColumns: `repeat(${layout.cols}, ${layout.cardW}mm)`,
                gridAutoRows: `${layout.cardH}mm`,
              }}
            >
              {Array.from({ length: layout.perPage }, (_, ci) => {
                const r = sheet[ci];
                if (!r) return <div className="card-slot" key={ci} style={{ width: `${layout.cardW}mm`, height: `${layout.cardH}mm` }} />;
                const extras = cardExtraParts(r);
                return (
                  <article
                    className={`card${print.showCutLine ? ' card-cut' : ''}`}
                    key={ci}
                    style={{ width: `${layout.cardW}mm`, height: `${layout.cardH}mm` }}
                    data-no={r.no}
                  >
                    <div className="card-up">
                      <div className="card-no">{r.no}</div>
                      <div className="card-surface">{r.surface}</div>
                      <div className="card-meta">
                        （{CATEGORY_LABEL[r.category]}{r.format !== 'none' ? ` · ${FORMAT_LABEL[r.format]}${r.formatNote ? `：${r.formatNote}` : ''}` : r.formatNote ? ` · ${r.formatNote}` : ''}）
                      </div>
                      {extras.length > 0 && (
                        <div className="card-extra">
                          {extras.map((p, pi) => <span className="card-extra-item" key={pi}>{p}</span>)}
                        </div>
                      )}
                      <div className="card-host">{print.hostLine}</div>
                    </div>
                    {print.showAnswerSlip && (
                      <>
                        <div className="card-tear" aria-hidden>✂</div>
                        <div className="card-slip">
                          <div className="slip-row"><span className="card-no slip-no">{r.no}</span>
                            <span className="slip-answer">{showAnswer ? r.answer : '谜底见上联'}</span></div>
                          <div className="slip-fill">猜中者姓名：＿＿＿＿＿＿　时间：＿＿＿＿＿</div>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
              {print.showFooter && (
                <footer className="sheet-footer" data-testid="sheet-footer">
                  <span>第 {footer.pageNo} 页 / 共 {footer.totalPages} 页</span>
                  <span>本页谜号：{footer.noFrom === footer.noTo ? footer.noFrom : `${footer.noFrom}–${footer.noTo}`}</span>
                </footer>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
