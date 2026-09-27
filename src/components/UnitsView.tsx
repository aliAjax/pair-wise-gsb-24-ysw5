import { useMemo, useState } from "react";
import type { ArchiveApi } from "../store";
import type {
  Coexistence,
  DirectedKind,
  DirectedRelation,
  Unit,
  UnitKind,
  UnitStatus,
} from "../types";
import {
  coSourceClass,
  directedKindClass,
  directedKindLabel,
  fullLabel,
  relationsAlongPath,
  unitLabel,
} from "../logic";
import { Empty, Field, fmtTime, inputClass, StatusBadge } from "./common";

const KINDS: UnitKind[] = ["地层", "灰坑", "墓葬", "房址", "沟状遗迹", "柱洞", "其他"];
const STATUSES: UnitStatus[] = ["整理中", "待核", "已定稿"];

const emptyForm = {
  trench: "",
  code: "",
  kind: "地层" as UnitKind,
  depth: "",
  soilColor: "",
  inclusions: "",
  pottery: "",
  note: "",
  status: "整理中" as UnitStatus,
};

interface Props {
  api: ArchiveApi;
  trenchFilter: string;
  statusFilter: UnitStatus | "全部";
  selectedUnitId: string | null;
  onSelect: (id: string | null) => void;
}

export function UnitsView({
  api,
  trenchFilter,
  statusFilter,
  selectedUnitId,
  onSelect,
}: Props) {
  const { archive } = api;
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);

  const trenches = useMemo(
    () => Array.from(new Set(archive.units.map((u) => u.trench))).sort(),
    [archive.units]
  );

  const filtered = useMemo(
    () =>
      archive.units.filter(
        (u) =>
          (trenchFilter === "全部" || u.trench === trenchFilter) &&
          (statusFilter === "全部" || u.status === statusFilter)
      ),
    [archive.units, trenchFilter, statusFilter]
  );

  const selected = archive.units.find((u) => u.id === selectedUnitId) ?? null;

  const unitById = (id: string) => archive.units.find((u) => u.id === id);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
  };

  const submitUnit = () => {
    if (!form.trench.trim() || !form.code.trim()) return;
    if (editingId) {
      api.updateUnit(editingId, { ...form });
      onSelect(editingId);
    } else {
      const id = api.addUnit({ ...form });
      onSelect(id);
    }
    resetForm();
  };

  const startEdit = (u: Unit) => {
    setEditingId(u.id);
    setForm({
      trench: u.trench,
      code: u.code,
      kind: u.kind,
      depth: u.depth,
      soilColor: u.soilColor,
      inclusions: u.inclusions,
      pottery: u.pottery,
      note: u.note,
      status: u.status,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="two-col">
      <section className="panel">
        <div className="section-heading">
          <h2>{editingId ? "编辑单位" : "新增地层 / 遗迹单位"}</h2>
          {editingId && (
            <button onClick={resetForm} className="ghost-btn">
              取消编辑
            </button>
          )}
        </div>
        <div className="form-grid">
          <Field label="探方">
            <input
              className={inputClass}
              list="trench-list"
              value={form.trench}
              placeholder="如 T0203"
              onChange={(e) => setForm({ ...form, trench: e.target.value })}
            />
            <datalist id="trench-list">
              {trenches.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="地层 / 遗迹编号">
            <input
              className={inputClass}
              value={form.code}
              placeholder="如 第3层、H12、F2"
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </Field>
          <Field label="类型">
            <select
              className={inputClass}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as UnitKind })}
            >
              {KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Field>
          <Field label="深度">
            <input
              className={inputClass}
              value={form.depth}
              placeholder="如 0.62–0.95m"
              onChange={(e) => setForm({ ...form, depth: e.target.value })}
            />
          </Field>
          <Field label="土质土色">
            <input
              className={inputClass}
              value={form.soilColor}
              placeholder="如 灰褐土"
              onChange={(e) => setForm({ ...form, soilColor: e.target.value })}
            />
          </Field>
          <Field label="状态">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as UnitStatus })}
            >
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="包含物">
            <input
              className={inputClass}
              value={form.inclusions}
              placeholder="如 炭屑、动物骨"
              onChange={(e) => setForm({ ...form, inclusions: e.target.value })}
            />
          </Field>
          <Field label="陶片组合">
            <input
              className={inputClass}
              value={form.pottery}
              placeholder="如 夹砂灰陶为主"
              onChange={(e) => setForm({ ...form, pottery: e.target.value })}
            />
          </Field>
          <div className="form-wide">
            <Field label="备注">
              <textarea
                className={inputClass}
                rows={2}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <div className="form-actions">
          <button
            className="primary-action"
            disabled={!form.trench.trim() || !form.code.trim()}
            onClick={submitUnit}
          >
            {editingId ? "保存修订" : "录入单位"}
          </button>
          <span className="muted-text">单位保存后可在右侧登记叠压、打破与共存关系</span>
        </div>

        <div className="unit-filter-row">
          <span>
            共 {filtered.length} 个单位
            {trenchFilter !== "全部" || statusFilter !== "全部" ? "（已筛选）" : ""}
          </span>
        </div>
        <div className="unit-list">
          {filtered.length === 0 && <Empty text="当前筛选下没有单位" />}
          {filtered.map((u) => (
            <button
              key={u.id}
              className={"unit-row" + (selectedUnitId === u.id ? " active" : "")}
              onClick={() => onSelect(u.id)}
            >
              <span className="unit-row-main">
                <strong>{unitLabel(u)}</strong>
                <small>
                  {u.kind} · {u.depth || "深度未记"} · {u.soilColor || "土质未记"}
                </small>
              </span>
              <StatusBadge status={u.status} />
            </button>
          ))}
        </div>
      </section>

      <section className="panel detail-panel">
        {!selected ? (
          <div className="detail-placeholder">
            <h2>地层关系整理台</h2>
            <p>
              从左侧选择一个地层或遗迹单位，集中登记它与其他单位的
              <b>上下叠压</b>、<b>打破</b>、<b>共存</b>关系。
            </p>
            <ul>
              <li>保存叠压 / 打破时自动做时序成环检测，成环会拦住保存并指出涉及探方、地层与原关系。</li>
              <li>跨探方接口请到「跨探方接口」页做土质、包含物、陶片三项比对。</li>
              <li>出土物在「出土物归属」页归入具体地层，修订自动保留原归属与原因。</li>
            </ul>
          </div>
        ) : (
          <UnitDetail
            key={selected.id}
            api={api}
            unit={selected}
            unitById={unitById}
            onEdit={() => startEdit(selected)}
          />
        )}
      </section>
    </div>
  );
}

function UnitDetail({
  api,
  unit,
  unitById,
  onEdit,
}: {
  api: ArchiveApi;
  unit: Unit;
  unitById: (id: string) => Unit | undefined;
  onEdit: () => void;
}) {
  const { archive } = api;
  const [kind, setKind] = useState<DirectedKind>("叠压");
  const [otherId, setOtherId] = useState("");
  const [direction, setDirection] = useState<"upper" | "lower">("upper");
  const [note, setNote] = useState("");
  const [cycleAlert, setCycleAlert] = useState<{
    path: string[];
    rels: DirectedRelation[];
    kind: DirectedKind;
    upperId: string;
    lowerId: string;
  } | null>(null);
  const [error, setError] = useState("");

  const [coOther, setCoOther] = useState("");
  const [coNote, setCoNote] = useState("");

  const incoming = archive.relations.filter((r) => r.lowerId === unit.id);
  const outgoing = archive.relations.filter((r) => r.upperId === unit.id);

  const candidates = archive.units.filter(
    (u) => u.id !== unit.id && u.trench === unit.trench
  );

  const coCandidates = archive.units.filter(
    (u) =>
      u.id !== unit.id &&
      !archive.coexistences.some(
        (c) =>
          (c.unitAId === unit.id && c.unitBId === u.id) ||
          (c.unitAId === u.id && c.unitBId === unit.id)
      )
  );

  const coHere = archive.coexistences.filter(
    (c) => c.unitAId === unit.id || c.unitBId === unit.id
  );

  const artifactsHere = archive.artifacts.filter((a) => a.currentUnitId === unit.id);

  const submitRelation = () => {
    setError("");
    setCycleAlert(null);
    if (!otherId) {
      setError("请选择对方单位");
      return;
    }
    const upperId = direction === "upper" ? unit.id : otherId;
    const lowerId = direction === "upper" ? otherId : unit.id;
    const res = api.addRelation(kind, upperId, lowerId, note);
    if (!res.ok) {
      if (res.cycle) {
        setCycleAlert({
          path: res.cycle.path,
          rels: relationsAlongPath(archive.relations, res.cycle.path),
          kind,
          upperId,
          lowerId,
        });
      } else {
        setError(res.error || "保存失败");
      }
      return;
    }
    setOtherId("");
    setNote("");
  };

  const submitCo = () => {
    setError("");
    if (!coOther) {
      setError("请选择共存单位");
      return;
    }
    const res = api.addCoexistence(unit.id, coOther, coNote);
    if (!res.ok) setError(res.error || "保存失败");
    else {
      setCoOther("");
      setCoNote("");
    }
  };

  return (
    <div>
      <div className="detail-head">
        <div>
          <p className="eyebrow">{unit.trench}</p>
          <h2>{unit.code}</h2>
          <div className="detail-tags">
            <StatusBadge status={unit.status} />
            <span className="tag">{unit.kind}</span>
            <span className="tag">{unit.depth || "深度未记"}</span>
          </div>
        </div>
        <button onClick={onEdit}>编辑单位</button>
      </div>

      <dl className="desc-grid">
        <div>
          <dt>土质土色</dt>
          <dd>{unit.soilColor || "—"}</dd>
        </div>
        <div>
          <dt>包含物</dt>
          <dd>{unit.inclusions || "—"}</dd>
        </div>
        <div>
          <dt>陶片组合</dt>
          <dd>{unit.pottery || "—"}</dd>
        </div>
        <div>
          <dt>备注</dt>
          <dd>{unit.note || "—"}</dd>
        </div>
      </dl>

      <div className="relation-block">
        <h3>上下叠压 / 打破</h3>
        <p className="block-hint">
          叠压：上层晚于下层；打破：打破者晚于被打破者。登记后形成时序链，成环将无法保存。
        </p>

        <div className="existing-rel">
          {incoming.length === 0 && outgoing.length === 0 && <Empty text="尚未登记叠压 / 打破关系" />}
          {[...incoming, ...outgoing].map((r) => {
            const thisIsUpper = r.upperId === unit.id;
            const other = unitById(thisIsUpper ? r.lowerId : r.upperId);
            return (
              <div key={r.id} className="rel-chip-row">
                <span className={"rel-kind " + directedKindClass(r.kind)}>{r.kind}</span>
                <span className="rel-text">
                  {thisIsUpper ? "本单位" : fullLabel(other)}
                  <b>{r.kind === "叠压" ? " 叠压 " : " 打破 "}</b>
                  {thisIsUpper ? fullLabel(other) : "本单位"}
                </span>
                <button
                  className="icon-btn"
                  title="删除该关系"
                  onClick={() => api.deleteRelation(r.id)}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        <div className="rel-form">
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as DirectedKind)}>
            <option value="叠压">{directedKindLabel.叠压}</option>
            <option value="打破">{directedKindLabel.打破}</option>
          </select>
          <select
            className={inputClass}
            value={direction}
            onChange={(e) => setDirection(e.target.value as "upper" | "lower")}
            title="本单位所处位置"
          >
            <option value="upper">本单位为{kind === "叠压" ? "上层" : "打破者"}（晚）</option>
            <option value="lower">本单位为{kind === "叠压" ? "下层" : "被打破者"}（早）</option>
          </select>
          <select className={inputClass} value={otherId} onChange={(e) => setOtherId(e.target.value)}>
            <option value="">选择同探方单位…</option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code}（{u.kind}）
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            placeholder="关系依据 / 备注（可选）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="primary-action" onClick={submitRelation}>
            保存关系
          </button>
        </div>
        {candidates.length === 0 && (
          <p className="muted-text small">本探方内还没有可建立关系的其他单位；跨探方同期请走接口比对。</p>
        )}

        {cycleAlert && (
          <CycleAlert
            path={cycleAlert.path}
            rels={cycleAlert.rels}
            unitById={unitById}
            attemptedKind={cycleAlert.kind}
            candidateEdge={{ upperId: cycleAlert.upperId, lowerId: cycleAlert.lowerId }}
            onClose={() => setCycleAlert(null)}
          />
        )}
      </div>

      <div className="relation-block">
        <h3>共存关系（同期）</h3>
        <div className="existing-rel">
          {coHere.length === 0 && <Empty text="尚未登记共存关系" />}
          {coHere.map((c: Coexistence) => {
            const other = unitById(c.unitAId === unit.id ? c.unitBId : c.unitAId);
            return (
              <div key={c.id} className="rel-chip-row">
                <span className={"rel-kind " + coSourceClass(c.source)}>
                  {c.source === "interface" ? "接口确认" : "共存"}
                </span>
                <span className="rel-text">
                  与 <b>{fullLabel(other)}</b> 同期
                  {c.note ? <small> · {c.note}</small> : null}
                </span>
                <button className="icon-btn" title="删除共存" onClick={() => api.deleteCoexistence(c.id)}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <div className="rel-form">
          <select className={inputClass} value={coOther} onChange={(e) => setCoOther(e.target.value)}>
            <option value="">选择共存单位…</option>
            {coCandidates.map((u) => (
              <option key={u.id} value={u.id}>
                {fullLabel(u)}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            placeholder="共存依据（可选）"
            value={coNote}
            onChange={(e) => setCoNote(e.target.value)}
          />
          <button onClick={submitCo}>登记共存</button>
        </div>
      </div>

      <div className="relation-block">
        <h3>本单位出土物（{artifactsHere.length}）</h3>
        {artifactsHere.length === 0 ? (
          <Empty text="暂无归入本单位的出土物" />
        ) : (
          <div className="existing-rel">
            {artifactsHere.map((a) => (
              <div key={a.id} className="rel-chip-row">
                <span className="rel-kind rel-artifact">出土物</span>
                <span className="rel-text">
                  <b>{a.code}</b> {a.name} <small>· {a.coordinate}</small>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="inline-error">{error}</div>}
    </div>
  );
}

function CycleAlert({
  path,
  rels,
  unitById,
  attemptedKind,
  candidateEdge,
  onClose,
}: {
  path: string[];
  rels: DirectedRelation[];
  unitById: (id: string) => Unit | undefined;
  attemptedKind: DirectedKind;
  candidateEdge: { upperId: string; lowerId: string };
  onClose: () => void;
}) {
  const involvedTrenches = Array.from(
    new Set(path.map((id) => unitById(id)?.trench ?? "?"))
  ).sort();

  // 环上每一段边：已存在的从 rels 取，取不到的就是本次拟新增、被拦住的关系
  const segments = path.slice(0, -1).map((from, i) => {
    const to = path[i + 1];
    const existing = rels.find((r) => r.upperId === from && r.lowerId === to);
    return {
      from,
      to,
      relation: existing,
      isCandidate:
        !existing && from === candidateEdge.upperId && to === candidateEdge.lowerId,
    };
  });

  return (
    <div className="cycle-alert" role="alert">
      <div className="cycle-alert-head">
        <strong>⛔ 检测到时序成环，已拦住保存</strong>
        <button className="icon-btn" onClick={onClose}>
          ✕
        </button>
      </div>
      <p>
        拟保存的「{attemptedKind}」关系会让以下地层 / 遗迹在时序上首尾相接（每段均为“晚于”），请先核对原关系后再调整：
      </p>
      <div className="cycle-chain">
        {path.map((id, i) => (
          <span key={`${id}-${i}`} className="cycle-node-wrap">
            <span className={"cycle-node" + (i === path.length - 1 ? " repeat" : "")}>
              {fullLabel(unitById(id))}
            </span>
            {i < path.length - 1 && <span className="cycle-arrow">晚于 →</span>}
          </span>
        ))}
      </div>
      <div className="cycle-meta">
        <div>
          <span>涉及探方：</span>
          {involvedTrenches.map((t) => (
            <span key={t} className="tag tag-strong">
              {t}
            </span>
          ))}
        </div>
        <div>
          <span>涉及地层 / 遗迹：</span>
          {Array.from(new Set(path)).map((id) => (
            <span key={id} className="tag">
              {unitLabel(unitById(id))}
            </span>
          ))}
        </div>
      </div>
      <div className="cycle-origins">
        <p className="block-hint">成环涉及的原关系：</p>
        {segments.map((seg, i) => (
          <div key={i} className={"origin-row" + (seg.isCandidate ? " candidate" : "")}>
            <span className="origin-index">{i + 1}</span>
            <span>
              <b className={"rel-kind-inline " + directedKindClass(attemptedKind)}>
                {seg.relation?.kind ?? attemptedKind}
              </b>
              {fullLabel(unitById(seg.from))} → {fullLabel(unitById(seg.to))}
              {seg.isCandidate ? (
                <small className="candidate-note">（本次拟新增，已被拦截，未写入档案）</small>
              ) : seg.relation ? (
                <small>
                  （{seg.relation.note ? seg.relation.note + "，" : ""}
                  登记于 {fmtTime(seg.relation.createdAt)}）
                </small>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
