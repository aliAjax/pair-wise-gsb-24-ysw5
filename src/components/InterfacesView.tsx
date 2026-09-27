import { useState } from "react";
import type { ArchiveApi } from "../store";
import type { InterfaceLink, Unit } from "../types";
import { compareUnits, fullLabel, unitLabel } from "../logic";
import { Empty, fmtTime, inputClass } from "./common";

export function InterfacesView({ api }: { api: ArchiveApi }) {
  const { archive } = api;
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  const unitById = (id: string) => archive.units.find((u) => u.id === id);
  const trenches = Array.from(new Set(archive.units.map((u) => u.trench))).sort();

  // 第一个下拉选定后，只列其他探方的单位
  const bCandidates = archive.units.filter(
    (u) => u.id !== aId && u.trench !== unitById(aId)?.trench
  );

  const pending = archive.interfaces.filter((i) => i.status === "待核");
  const confirmed = archive.interfaces.filter((i) => i.status === "已确认同期");

  const submit = () => {
    setError("");
    if (!aId || !bId) {
      setError("请选择接口两端的单位");
      return;
    }
    const res = api.addInterface(aId, bId, note);
    if (!res.ok) {
      setError(res.error || "登记失败");
      return;
    }
    setAId("");
    setBId("");
    setNote("");
  };

  return (
    <div className="stack-sections">
      <section className="panel">
        <div className="section-heading">
          <h2>登记跨探方接口</h2>
        </div>
        <p className="block-hint">
          接口两端必须分属不同探方。登记后进入待核区，经
          <b> 土质土色、包含物、陶片组合 </b>
          三项比对全部一致，才确认同期并自动生成共存关系；任一项不符即留在待核区。
        </p>
        <div className="rel-form interface-form">
          <select className={inputClass} value={aId} onChange={(e) => { setAId(e.target.value); setBId(""); }}>
            <option value="">选择甲端单位…</option>
            {archive.units.map((u) => (
              <option key={u.id} value={u.id}>
                {fullLabel(u)}
              </option>
            ))}
          </select>
          <span className="link-sep">⇄</span>
          <select className={inputClass} value={bId} onChange={(e) => setBId(e.target.value)} disabled={!aId}>
            <option value="">
              {aId ? `选择 ${unitById(aId)?.trench} 以外的探方单位…` : "请先选甲端"}
            </option>
            {bCandidates.map((u) => (
              <option key={u.id} value={u.id}>
                {fullLabel(u)}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            placeholder="接口位置 / 依据（可选，如隔梁下土色连续）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="primary-action" onClick={submit}>
            登记并送核
          </button>
        </div>
        {error && <div className="inline-error">{error}</div>}
        <p className="muted-text small">可选探方：{trenches.join("、")}</p>
      </section>

      <section className="panel pending-zone">
        <div className="section-heading">
          <div>
            <p className="eyebrow">待核区</p>
            <h2>待核接口（{pending.length}）</h2>
          </div>
        </div>
        {pending.length === 0 && <Empty text="待核区为空：没有等待三项比对的跨探方接口" />}
        <div className="card-grid">
          {pending.map((link) => (
            <InterfaceCard
              key={link.id}
              link={link}
              a={unitById(link.unitAId)}
              b={unitById(link.unitBId)}
              onCheck={() => {
                const res = api.checkInterface(link.id);
                if (!res.ok) setRejectNote((m) => ({ ...m, [link.id]: res.error || "" }));
                else setRejectNote((m) => {
                  const next = { ...m };
                  delete next[link.id];
                  return next;
                });
              }}
              rejectReason={rejectNote[link.id]}
              onDelete={() => api.deleteInterface(link.id)}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">已确认</p>
            <h2>同期接口（{confirmed.length}）</h2>
          </div>
        </div>
        {confirmed.length === 0 && <Empty text="尚无三项比对一致、确认同期的接口" />}
        <div className="card-grid">
          {confirmed.map((link) => {
            const a = unitById(link.unitAId);
            const b = unitById(link.unitBId);
            return (
              <article key={link.id} className="if-card confirmed">
                <div className="if-card-head">
                  <strong>
                    {unitLabel(a)} <span className="link-sep">⇄</span> {unitLabel(b)}
                  </strong>
                  <button className="icon-btn" title="删除接口" onClick={() => api.deleteInterface(link.id)}>
                    ✕
                  </button>
                </div>
                <p className="muted-text small">
                  三项一致，{link.checkedAt ? fmtTime(link.checkedAt) : ""} 已生成共存关系
                </p>
                {link.note && <p className="if-note">{link.note}</p>}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function InterfaceCard({
  link,
  a,
  b,
  onCheck,
  rejectReason,
  onDelete,
}: {
  link: InterfaceLink;
  a: Unit | undefined;
  b: Unit | undefined;
  onCheck: () => void;
  rejectReason?: string;
  onDelete: () => void;
}) {
  if (!a || !b) {
    return (
      <article className="if-card">
        <p className="inline-error">接口两端单位已缺失</p>
        <button onClick={onDelete}>删除该接口</button>
      </article>
    );
  }
  const cmp = compareUnits(a, b);
  const rows: { label: string; x: string; y: string; match: boolean }[] = [
    { label: "土质土色", x: a.soilColor || "（空）", y: b.soilColor || "（空）", match: cmp.soilMatch },
    { label: "包含物", x: a.inclusions || "（空）", y: b.inclusions || "（空）", match: cmp.inclusionMatch },
    { label: "陶片组合", x: a.pottery || "（空）", y: b.pottery || "（空）", match: cmp.potteryMatch },
  ];

  return (
    <article className="if-card">
      <div className="if-card-head">
        <strong>
          {unitLabel(a)} <span className="link-sep">⇄</span> {unitLabel(b)}
        </strong>
        <button className="icon-btn" title="移出待核区" onClick={onDelete}>
          ✕
        </button>
      </div>
      {link.note && <p className="if-note">{link.note}</p>}
      <table className="compare-table">
        <thead>
          <tr>
            <th>比对项</th>
            <th>{a.trench}</th>
            <th>{b.trench}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.match ? "match" : "mismatch"}>
              <td>
                <span className={"dot " + (r.match ? "dot-ok" : "dot-no")} />
                {r.label}
              </td>
              <td>{r.x}</td>
              <td>{r.y}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="if-actions">
        <button className="primary-action" onClick={onCheck} disabled={!cmp.matched}>
          三项一致，确认同期
        </button>
        {!cmp.matched && (
          <p className="muted-text small">
            {cmp.reasons.join("；")}，无法确认，接口继续留在待核区
          </p>
        )}
        {rejectReason && !cmp.matched && (
          <div className="inline-error small">核查结果：{rejectReason}（已留在待核区）</div>
        )}
      </div>
    </article>
  );
}
