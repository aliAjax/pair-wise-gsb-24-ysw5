import { useMemo } from "react";
import type { ArchiveApi } from "../store";
import {
  coSourceClass,
  detectCycle,
  directedKindClass,
  fullLabel,
  relationsAlongPath,
  unitLabel,
} from "../logic";
import { Empty, fmtTime } from "./common";

export function RelationsOverview({ api }: { api: ArchiveApi }) {
  const { archive } = api;
  const unitById = (id: string) => archive.units.find((u) => u.id === id);

  // 全库时序体检：以现存关系再跑一次成环检测
  const globalCycle = useMemo(() => detectCycle(archive.relations), [archive.relations]);

  const directed = [...archive.relations].sort((a, b) => b.createdAt - a.createdAt);

  // 按探方归组统计有向关系
  const byTrench = useMemo(() => {
    const map = new Map<string, { overlap: number; break: number }>();
    for (const r of archive.relations) {
      const t = unitById(r.upperId)?.trench ?? "?";
      const cur = map.get(t) ?? { overlap: 0, break: 0 };
      if (r.kind === "叠压") cur.overlap += 1;
      else cur.break += 1;
      map.set(t, cur);
    }
    return Array.from(map.entries()).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archive.relations, archive.units]);

  return (
    <div className="stack-sections">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">关系速查</p>
            <h2>叠压 / 打破关系总表（{directed.length}）</h2>
          </div>
        </div>

        <div className={"health-banner " + (globalCycle.hasCycle ? "bad" : "good")}>
          {globalCycle.hasCycle ? (
            <>
              <strong>⚠ 现存关系中检测到成环</strong>
              <span>环路径：{globalCycle.path.map((id) => unitLabel(unitById(id))).join(" → ")}</span>
            </>
          ) : (
            <>
              <strong>✓ 时序链无环</strong>
              <span>全部叠压 / 打破关系构成合法的早晚时序，可继续整理。</span>
            </>
          )}
        </div>

        {globalCycle.hasCycle && (
          <div className="cycle-origins">
            <p className="block-hint">成环依据的原关系：</p>
            {relationsAlongPath(archive.relations, globalCycle.path).map((r, i) => (
              <div key={r.id} className="origin-row">
                <span className="origin-index">{i + 1}</span>
                <span>
                  <b className={"rel-kind-inline " + directedKindClass(r.kind)}>{r.kind}</b>
                  {fullLabel(unitById(r.upperId))} → {fullLabel(unitById(r.lowerId))}
                  <small>（{r.note ? r.note + "，" : ""}登记于 {fmtTime(r.createdAt)}）</small>
                </span>
                <button className="ghost-btn" onClick={() => api.deleteRelation(r.id)}>
                  删除该原关系解除环
                </button>
              </div>
            ))}
          </div>
        )}

        {directed.length === 0 && <Empty text="尚未登记任何叠压 / 打破关系" />}
        <div className="table-wrap">
          <table className="rel-table">
            <thead>
              <tr>
                <th>类型</th>
                <th>上层 / 打破者（晚）</th>
                <th></th>
                <th>下层 / 被打破者（早）</th>
                <th>依据备注</th>
                <th>登记时间</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {directed.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className={"rel-kind " + directedKindClass(r.kind)}>{r.kind}</span>
                  </td>
                  <td>{fullLabel(unitById(r.upperId))}</td>
                  <td>{r.kind === "叠压" ? "叠压" : "打破"}→</td>
                  <td>{fullLabel(unitById(r.lowerId))}</td>
                  <td className="muted-text">{r.note || "—"}</td>
                  <td className="muted-text small">{fmtTime(r.createdAt)}</td>
                  <td>
                    <button className="icon-btn" onClick={() => api.deleteRelation(r.id)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>共存（同期）关系（{archive.coexistences.length}）</h2>
        </div>
        {archive.coexistences.length === 0 && <Empty text="暂无共存关系；可在单位详情手工登记，或在跨探方接口三项比对一致后自动生成" />}
        <div className="table-wrap">
          <table className="rel-table">
            <thead>
              <tr>
                <th>来源</th>
                <th>单位甲</th>
                <th>单位乙</th>
                <th>说明</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {archive.coexistences.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className={"rel-kind " + coSourceClass(c.source)}>
                      {c.source === "interface" ? "接口确认" : "手工"}
                    </span>
                  </td>
                  <td>{fullLabel(unitById(c.unitAId))}</td>
                  <td>{fullLabel(unitById(c.unitBId))}</td>
                  <td className="muted-text">{c.note || "—"}</td>
                  <td>
                    <button className="icon-btn" onClick={() => api.deleteCoexistence(c.id)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>按探方汇总</h2>
        </div>
        <div className="trench-summary">
          {byTrench.map(([trench, counts]) => {
            const units = archive.units.filter((u) => u.trench === trench);
            const edgesHere = archive.relations.filter(
              (r) =>
                unitById(r.upperId)?.trench === trench &&
                unitById(r.lowerId)?.trench === trench
            );
            return (
              <article key={trench} className="summary-card">
                <h3>{trench}</h3>
                <p className="muted-text small">
                  {units.length} 个单位 · 叠压 {counts.overlap} · 打破 {counts.break}
                </p>
                <ul className="mini-chain">
                  {edgesHere.map((r) => (
                    <li key={r.id}>
                      <span className={"rel-kind-inline " + directedKindClass(r.kind)}>{r.kind}</span>
                      {unitLabel(unitById(r.upperId))} → {unitLabel(unitById(r.lowerId))}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
