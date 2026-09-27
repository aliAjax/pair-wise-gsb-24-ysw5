import { useState } from "react";
import type { ArchiveApi } from "../store";
import type { Artifact } from "../types";
import { fullLabel, unitLabel } from "../logic";
import { Empty, Field, fmtTime, inputClass } from "./common";

export function ArtifactsView({
  api,
  trenchFilter,
  statusFilter,
}: {
  api: ArchiveApi;
  trenchFilter: string;
  statusFilter: string;
}) {
  const { archive } = api;
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [coordinate, setCoordinate] = useState("");
  const [unitId, setUnitId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const unitById = (id?: string | null) => archive.units.find((u) => u.id === id);

  // 按探方 + 单位状态查找（归属单位决定）
  const filtered = archive.artifacts.filter((a) => {
    const u = unitById(a.currentUnitId);
    if (!u) return trenchFilter === "全部" && statusFilter === "全部";
    return (
      (trenchFilter === "全部" || u.trench === trenchFilter) &&
      (statusFilter === "全部" || u.status === statusFilter)
    );
  });

  const submit = () => {
    setError("");
    if (!code.trim() || !name.trim()) {
      setError("编号与名称必填");
      return;
    }
    if (!unitId) {
      setError("出土物必须归入一个具体地层 / 遗迹单位");
      return;
    }
    api.addArtifact({
      code: code.trim(),
      name: name.trim(),
      coordinate,
      note,
      currentUnitId: unitId,
    });
    setCode("");
    setName("");
    setCoordinate("");
    setNote("");
    setUnitId("");
  };

  return (
    <div className="stack-sections">
      <section className="panel">
        <div className="section-heading">
          <h2>出土物登记</h2>
        </div>
        <p className="block-hint">
          每件出土物都必须归入一个具体的地层 / 遗迹单位；日后修订归属时，系统会自动保留原归属与更正原因。
        </p>
        <div className="form-grid">
          <Field label="出土物编号">
            <input className={inputClass} value={code} placeholder="如 TB-003" onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="名称">
            <input className={inputClass} value={name} placeholder="如 夹砂灰陶罐口沿" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="坐标点">
            <input className={inputClass} value={coordinate} placeholder="如 T0203 E3N4" onChange={(e) => setCoordinate(e.target.value)} />
          </Field>
          <Field label="归入地层 / 遗迹" hint="必选">
            <select className={inputClass} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">选择归属单位…</option>
              {archive.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {fullLabel(u)}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-wide">
            <Field label="备注">
              <textarea className={inputClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="form-actions">
          <button className="primary-action" onClick={submit}>
            登记并归入单位
          </button>
          {error && <span className="inline-error">{error}</span>}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">归属台账</p>
            <h2>出土物列表（{filtered.length}）</h2>
          </div>
        </div>
        {filtered.length === 0 && <Empty text="当前探方 / 状态筛选下没有出土物" />}
        <div className="card-grid">
          {filtered.map((art) => (
            <ArtifactCard key={art.id} art={art} api={api} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ArtifactCard({ art, api }: { art: Artifact; api: ArchiveApi }) {
  const { archive } = api;
  const unitById = (id?: string | null) => archive.units.find((u) => u.id === id);
  const current = unitById(art.currentUnitId);
  const [reassigning, setReassigning] = useState(false);
  const [toId, setToId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const submitReassign = () => {
    setError("");
    if (!toId) {
      setError("请选择新归属单位");
      return;
    }
    const res = api.reassignArtifact(art.id, toId, reason);
    if (!res.ok) {
      setError(res.error || "修订失败");
      return;
    }
    setReassigning(false);
    setToId("");
    setReason("");
  };

  return (
    <article className="art-card">
      <div className="if-card-head">
        <strong>
          <span className="art-code">{art.code}</span> {art.name}
        </strong>
        <button className="icon-btn" title="删除出土物" onClick={() => api.deleteArtifact(art.id)}>
          ✕
        </button>
      </div>
      <p className="muted-text small">{art.coordinate || "未记坐标"}{art.note ? ` · ${art.note}` : ""}</p>
      <div className="current-attribution">
        <span className="tag tag-strong">当前归属：{current ? fullLabel(current) : "单位已缺失"}</span>
        <button onClick={() => setReassigning((v) => !v)}>
          {reassigning ? "取消修订" : "修订归属"}
        </button>
      </div>

      {reassigning && (
        <div className="reassign-box">
          <select className={inputClass} value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">选择更正后的单位…</option>
            {archive.units
              .filter((u) => u.id !== art.currentUnitId)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {fullLabel(u)}
                </option>
              ))}
          </select>
          <textarea
            className={inputClass}
            rows={2}
            placeholder="更正原因（必填）：原记录依据、新证据、复核人意见等"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="form-actions">
            <button className="primary-action" onClick={submitReassign}>
              确认修订
            </button>
            {error && <span className="inline-error">{error}</span>}
          </div>
        </div>
      )}

      <div className="revision-track">
        <p className="block-hint">归属变更记录（{art.revisions.length}）</p>
        <ol className="revision-list">
          {[...art.revisions].reverse().map((rev, idx) => {
            const isLatest = idx === 0;
            const from = unitById(rev.fromUnitId);
            const to = unitById(rev.toUnitId);
            return (
              <li key={idx} className={"revision-row" + (isLatest ? " latest" : "")}>
                <div className="revision-when">{fmtTime(rev.at)}</div>
                <div className="revision-what">
                  {rev.fromUnitId === null ? (
                    <>
                      初次登记，归入 <b>{fullLabel(to)}</b>
                    </>
                  ) : (
                    <>
                      <span className="from-attrib">{unitLabel(from)}</span>
                      <span className="rev-arrow">→</span>
                      <b>{unitLabel(to)}</b>
                    </>
                  )}
                  <p className="revision-reason">原因：{rev.reason}</p>
                </div>
                {isLatest && <span className="badge badge-ok">当前</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </article>
  );
}
