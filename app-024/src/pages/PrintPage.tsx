// 谜条打印：版式配置 + 实时预览 + 裁切线 + 同页双联（上联挂灯笼/下联回收）+ 页脚页码
import { useMemo, useState } from 'react';
import { useAppState } from '../ui/router';
import { calcLayout, pageCount, pageNoText, noRangeText, MAX_PER_PAGE } from '../lib/print';
import { scanDuplicates } from '../lib/duplicates';
import { stars } from '../lib/format';
import { CATEGORY_LABEL, FORMAT_LABEL, type Riddle } from '../types';
import { store } from '../lib/store';

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
  const setPerPage = (v: number) => setPrint({ perPage: Math.max(1, Math.min(MAX_PER_PAGE, Math.floor(v) || 1)) });
  const setPageStart = (v: number) => setPrint({ pageStart: Math.max(1, Math.floor(v) || 1) });

  return (
    <div>
      <div className="page-head no-print">
        <h1>出条打印 <small>{chosen.length} 条 · 每页 {layout.perPage} 条 · 共 {pageCount(chosen.length, layout.perPage)} 页</small></h1>
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
            <span>每页条数（1–{MAX_PER_PAGE}）</span>
            <input className="input" type="number" min={1} max={MAX_PER_PAGE} value={print.perPage}
              onChange={(e) => setPerPage(Number(e.target.value))} />
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
          <label className="field">
            <span>起始页码（分批续打）</span>
            <input className="input" type="number" min={1} max={9999} value={print.pageStart}
              onChange={(e) => setPageStart(Number(e.target.value))} />
          </label>
        </div>
        <div className="btn-row wrap">
          <span className="muted small">卡片加印：</span>
          <label className="check-inline"><input type="checkbox" checked={print.showAuthor} onChange={(e) => setPrint({ showAuthor: e.target.checked })} /> 作者</label>
          <label className="check-inline"><input type="checkbox" checked={print.showSource} onChange={(e) => setPrint({ showSource: e.target.checked })} /> 出处</label>
          <label className="check-inline"><input type="checkbox" checked={print.showDifficulty} onChange={(e) => setPrint({ showDifficulty: e.target.checked })} /> 难度</label>
          <label className="check-inline"><input type="checkbox" checked={print.showTags} onChange={(e) => setPrint({ showTags: e.target.checked })} /> 标签</label>
        </div>
        <div className="btn-row wrap">
          <label className="check-inline"><input type="checkbox" checked={print.showAnswerSlip} onChange={(e) => setPrint({ showAnswerSlip: e.target.checked })} /> 同页双联回收联（含谜底）</label>
          <label className="check-inline"><input type="checkbox" checked={print.showCutLine} onChange={(e) => setPrint({ showCutLine: e.target.checked })} /> 裁切线</label>
          <label className="check-inline"><input type="checkbox" checked={print.showFooter} onChange={(e) => setPrint({ showFooter: e.target.checked })} /> 页脚（页码 + 谜号区间）</label>
          <label className="check-inline"><input type="checkbox" checked={excludeDup} onChange={(e) => setExcludeDup(e.target.checked)} /> 排除重复谜面</label>
          <label className="check-inline"><input type="checkbox" checked={showAnswer} onChange={(e) => setShowAnswer(e.target.checked)} /> 预览时显示谜底（不打印）</label>
        </div>
        <label className="field">
          <span>主办方落款</span>
          <input className="input" value={print.hostLine} onChange={(e) => setPrint({ hostLine: e.target.value })} placeholder="例：××社区工会 · 元宵灯会" />
        </label>
        {layout.adjusted && layout.warning && <p className="warn-text">{layout.warning}</p>}
        {!chosen.length && <p className="warn-text">没有可打印的谜条：先在谜库勾选，或把范围改为「全部」。</p>}
        <p className="muted small">实际排版：{layout.cols} 列 × {layout.rows} 行，卡片 {layout.cardW}×{layout.cardH}mm。谜面字号 ≥ 14pt，黑白打印清晰。</p>
        {print.showFooter && sheets.length > 0 && (
          <p className="muted small" data-testid="batch-pages">本批页码：第 {print.pageStart} 页 至 第 {print.pageStart + sheets.length - 1} 页；分两次打印时，下一批「起始页码」填 {print.pageStart + sheets.length} 即可接着排。</p>
        )}
      </div>

      <div className="print-area" data-testid="print-area">
        {sheets.map((sheet, si) => (
          <section className="sheet" key={si} style={{ contentVisibility: si > 2 ? 'auto' : 'visible', containIntrinsicSize: '297mm' }}>
            {Array.from({ length: layout.perPage }, (_, ci) => {
              const r = sheet[ci];
              if (!r) return <div className="card-slot" key={ci} style={{ width: `${layout.cardW}mm`, height: `${layout.cardH}mm` }} />;
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
                    {(print.showAuthor && r.author) ? <div className="card-extra">作者：{r.author}</div> : null}
                    {(print.showSource && r.source) ? <div className="card-extra">出处：{r.source}</div> : null}
                    {print.showDifficulty && <div className="card-extra">难度：<span className="stars">{stars(r.difficulty)}</span></div>}
                    {(print.showTags && r.tags.length) ? <div className="card-extra">标签：{r.tags.join('、')}</div> : null}
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
            {print.showFooter && sheet.length > 0 && (
              <footer className="sheet-footer" data-testid="sheet-footer">
                <span>{pageNoText(si, sheets.length, print.pageStart)}</span>
                <span>{noRangeText(sheet.map((r) => r.no))}</span>
              </footer>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
