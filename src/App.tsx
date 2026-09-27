import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type {
  Artifact,
  InterfaceLink,
  RelType,
  StratState,
  Unit,
  UnitStatus,
} from "./types";
import { seedState, STORAGE_KEY } from "./seed";
import { checkRelation, type CycleCheck } from "./graph";

const project = {
  id: "hxwl-10",
  port: 5110,
  title: "考古探方记录 · 地层关系整理台",
  subtitle: "同一遗迹的叠压、打破、共存关系集中整理；成环拦截、跨探方接口核对、出土物归层与修订留痕。",
};

const REL_LABEL: Record<RelType, string> = {
  overlies: "叠压",
  cuts: "打破",
  coexists: "共存",
};

const REL_HINT: Record<RelType, string> = {
  overlies: "本单位在上，叠压目标（本单位更晚）",
  cuts: "本单位打破目标（本单位更晚）",
  coexists: "与目标同期共存，无早晚之分",
};

const UNIT_STATUSES: UnitStatus[] = ["整理中", "已确认", "待复核"];

const STATUS_CLASS: Record<UnitStatus, string> = {
  整理中: "st-progress",
  已确认: "st-done",
  待复核: "st-review",
};

interface CycleBlock {
  attempted: { aId: string; bId: string; type: RelType };
  check: CycleCheck;
}

function loadState(): StratState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StratState;
      if (parsed && Array.isArray(parsed.units) && Array.isArray(parsed.relations)) {
        return parsed;
      }
    }
  } catch {
    /* 数据损坏时回退到示例数据 */
  }
  return seedState;
}

function now(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

function App() {
  const [state, setState] = useState<StratState>(loadState);
  const [selectedId, setSelectedId] = useState<string>(state.units[0]?.id ?? "");
  const [trenchFilter, setTrenchFilter] = useState("全部");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [cycleBlock, setCycleBlock] = useState<CycleBlock | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const unitById = useMemo(() => {
    const map = new Map<string, Unit>();
    state.units.forEach((u) => map.set(u.id, u));
    return map;
  }, [state.units]);

  const trenches = useMemo(
    () => Array.from(new Set(state.units.map((u) => u.trench))).sort(),
    [state.units]
  );

  const fmtUnit = (id: string | null): string => {
    if (!id) return "未归层";
    const u = unitById.get(id);
    return u ? `${u.trench} · ${u.label}` : "（已删除）";
  };

  const filteredUnits = state.units.filter(
    (u) =>
      (trenchFilter === "全部" || u.trench === trenchFilter) &&
      (statusFilter === "全部" || u.status === statusFilter)
  );

  const selected = unitById.get(selectedId) ?? null;

  const pendingInterfaces = state.interfaces.filter((i) => i.status === "pending");
  const confirmedInterfaces = state.interfaces.filter((i) => i.status === "confirmed");
  const rejectedInterfaces = state.interfaces.filter((i) => i.status === "rejected");
  const unassignedArtifacts = state.artifacts.filter((a) => !a.unitId);

  const metrics = [
    { label: "探方数", value: String(trenches.length), sub: trenches.join(" / ") },
    { label: "地层与遗迹", value: String(state.units.length), sub: `关系 ${state.relations.length} 条` },
    { label: "出土物", value: String(state.artifacts.length), sub: `待归层 ${unassignedArtifacts.length} 件` },
    { label: "待核接口", value: String(pendingInterfaces.length), sub: `已确认同期 ${confirmedInterfaces.length} 处` },
  ];

  const update = (fn: (s: StratState) => StratState) => setState((s) => fn(s));

  const setUnitStatus = (id: string, status: UnitStatus) =>
    update((s) => ({ ...s, units: s.units.map((u) => (u.id === id ? { ...u, status } : u)) }));

  const addUnit = (unit: Omit<Unit, "id" | "status">) => {
    const id = nextId("u");
    update((s) => ({ ...s, units: [...s.units, { ...unit, id, status: "整理中" }] }));
    setSelectedId(id);
  };

  const addRelation = (type: RelType, targetId: string, note: string) => {
    if (!selected) return;
    const check = checkRelation(state, selected.id, targetId, type);
    if (!check.ok) {
      setCycleBlock({ attempted: { aId: selected.id, bId: targetId, type }, check });
      return;
    }
    setCycleBlock(null);
    update((s) => ({
      ...s,
      relations: [...s.relations, { id: nextId("r"), a: selected.id, b: targetId, type, note }],
    }));
  };

  const removeRelation = (id: string) =>
    update((s) => ({ ...s, relations: s.relations.filter((r) => r.id !== id) }));

  const interfaceRows = (link: InterfaceLink) => {
    const a = unitById.get(link.a);
    const b = unitById.get(link.b);
    if (!a || !b) return { rows: [], all: false };
    const rows = [
      { key: "土质", va: a.soil, vb: b.soil },
      { key: "包含物", va: a.inclusions, vb: b.inclusions },
      { key: "陶片组合", va: a.pottery, vb: b.pottery },
    ].map((r) => ({ ...r, match: r.va.trim() !== "" && r.va.trim() === r.vb.trim() }));
    return { rows, all: rows.every((r) => r.match) };
  };

  const confirmInterface = (link: InterfaceLink) => {
    if (!interfaceRows(link).all) return; // 三项不全部对应，留在待核区
    const check = checkRelation(state, link.a, link.b, "coexists");
    if (!check.ok) {
      setCycleBlock({ attempted: { aId: link.a, bId: link.b, type: "coexists" }, check });
      return;
    }
    setCycleBlock(null);
    update((s) => ({
      ...s,
      interfaces: s.interfaces.map((i) => (i.id === link.id ? { ...i, status: "confirmed" } : i)),
      relations: [
        ...s.relations,
        { id: nextId("r"), a: link.a, b: link.b, type: "coexists", note: "跨探方接口确认同期" },
      ],
    }));
  };

  const setInterfaceStatus = (id: string, status: InterfaceLink["status"]) =>
    update((s) => ({
      ...s,
      interfaces: s.interfaces.map((i) => (i.id === id ? { ...i, status } : i)),
    }));

  const addInterface = (a: string, b: string, note: string): string | null => {
    const ua = unitById.get(a);
    const ub = unitById.get(b);
    if (!ua || !ub) return "请选择两个单位";
    if (ua.trench === ub.trench) return "接口必须跨探方，请选择不同探方的单位";
    const dup = state.interfaces.some(
      (i) => (i.a === a && i.b === b) || (i.a === b && i.b === a)
    );
    if (dup) return "这两个单位的接口已存在";
    update((s) => ({
      ...s,
      interfaces: [...s.interfaces, { id: nextId("i"), a, b, status: "pending", note }],
    }));
    return null;
  };

  const reviseArtifact = (id: string, toId: string, reason: string) =>
    update((s) => ({
      ...s,
      artifacts: s.artifacts.map((a) =>
        a.id === id
          ? {
              ...a,
              unitId: toId,
              history: [...a.history, { fromId: a.unitId, toId, reason, time: now() }],
            }
          : a
      ),
    }));

  const addArtifact = (name: string, category: string, coords: string, unitId: string | null) =>
    update((s) => ({
      ...s,
      artifacts: [...s.artifacts, { id: nextId("a"), name, category, coords, unitId, history: [] }],
    }));

  const resetAll = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(seedState);
    setSelectedId(seedState.units[0].id);
    setCycleBlock(null);
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{project.id} · port {project.port}</p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>整理台规则</span>
          <strong>关系成环即拦截 · 接口三项全对应才确认同期 · 修订必留原归属与原因</strong>
          <span className="autosave-note">更改自动保存在本机，重新打开可继续标注</span>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((m) => (
          <article className="metric-card" key={m.label}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            <em>{m.sub}</em>
          </article>
        ))}
      </section>

      {cycleBlock && (
        <section className="cycle-alert" role="alert">
          <div className="cycle-head">
            <strong>关系成环，已拦住保存</strong>
            <button onClick={() => setCycleBlock(null)}>知道了</button>
          </div>
          <p>
            拟保存：{fmtUnit(cycleBlock.attempted.aId)}
            <b className={`rel-tag rel-${cycleBlock.attempted.type}`}>
              {REL_LABEL[cycleBlock.attempted.type]}
            </b>
            {fmtUnit(cycleBlock.attempted.bId)}
          </p>
          <p className="cycle-reason">{cycleBlock.check.reason}，涉及以下探方、地层与原关系：</p>
          <ol className="cycle-steps">
            {cycleBlock.check.steps.map((s) => (
              <li key={s.relationId}>
                {fmtUnit(s.aId)}
                <b className={`rel-tag rel-${s.type}`}>{REL_LABEL[s.type]}</b>
                {fmtUnit(s.bId)}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="filter-bar panel">
        <label>
          <span>按探方查找</span>
          <select value={trenchFilter} onChange={(e) => setTrenchFilter(e.target.value)}>
            <option>全部</option>
            {trenches.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          <span>按状态查找</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option>全部</option>
            {UNIT_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <span className="filter-count">命中 {filteredUnits.length} 个单位</span>
        <button className="ghost-btn" onClick={resetAll}>重置为示例数据</button>
      </section>

      <section className="board">
        <aside className="panel narrow">
          <h2>单位名录</h2>
          <div className="unit-list">
            {filteredUnits.map((u) => (
              <div
                key={u.id}
                className={u.id === selectedId ? "unit-card active" : "unit-card"}
                onClick={() => setSelectedId(u.id)}
              >
                <div className="unit-card-top">
                  <strong>{u.label}</strong>
                  <span className={`status-chip ${STATUS_CLASS[u.status]}`}>{u.status}</span>
                </div>
                <p>{u.trench} · {u.kind === "layer" ? "地层" : u.featureType} · {u.depth}</p>
                <p className="unit-soil">{u.soil}｜{u.inclusions}｜{u.pottery}</p>
                <select
                  value={u.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setUnitStatus(u.id, e.target.value as UnitStatus)}
                >
                  {UNIT_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            ))}
            {filteredUnits.length === 0 && <p className="empty-hint">当前筛选下没有单位</p>}
          </div>
          <NewUnitForm trenches={trenches} onAdd={addUnit} />
        </aside>

        <section className="panel">
          {selected ? (
            <RelationPanel
              unit={selected}
              units={state.units}
              relations={state.relations}
              fmtUnit={fmtUnit}
              onAdd={addRelation}
              onRemove={removeRelation}
            />
          ) : (
            <p className="empty-hint">从左侧名录选择一个地层或遗迹单位</p>
          )}
        </section>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>跨探方接口</p>
            <h2>待核区（{pendingInterfaces.length}）</h2>
          </div>
        </div>
        <p className="panel-hint">土质、包含物、陶片组合三项全部对应才能确认同期，否则留在待核区。</p>
        <div className="iface-list">
          {pendingInterfaces.map((link) => (
            <InterfaceCard
              key={link.id}
              link={link}
              fmtUnit={fmtUnit}
              match={interfaceRows(link)}
              onConfirm={() => confirmInterface(link)}
              onReject={() => setInterfaceStatus(link.id, "rejected")}
            />
          ))}
          {pendingInterfaces.length === 0 && <p className="empty-hint">待核区已清空</p>}
        </div>
        <NewInterfaceForm units={state.units} onAdd={addInterface} />

        {(confirmedInterfaces.length > 0 || rejectedInterfaces.length > 0) && (
          <div className="iface-done">
            {confirmedInterfaces.length > 0 && (
              <div>
                <h3>已确认同期</h3>
                {confirmedInterfaces.map((i) => (
                  <p key={i.id} className="iface-line">
                    <span className="badge ok">同期</span> {fmtUnit(i.a)} ↔ {fmtUnit(i.b)}
                    <button className="ghost-btn" onClick={() => setInterfaceStatus(i.id, "pending")}>退回待核</button>
                  </p>
                ))}
              </div>
            )}
            {rejectedInterfaces.length > 0 && (
              <div>
                <h3>已排除</h3>
                {rejectedInterfaces.map((i) => (
                  <p key={i.id} className="iface-line">
                    <span className="badge no">排除</span> {fmtUnit(i.a)} ↔ {fmtUnit(i.b)}
                    <button className="ghost-btn" onClick={() => setInterfaceStatus(i.id, "pending")}>退回待核</button>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>出土物归层</p>
            <h2>出土物（{state.artifacts.length} 件，待归层 {unassignedArtifacts.length} 件）</h2>
          </div>
        </div>
        <p className="panel-hint">修订归属时必须填写更正原因，原归属会留在修订记录里。</p>
        <div className="artifact-list">
          {state.artifacts.map((a) => (
            <ArtifactRow
              key={a.id}
              artifact={a}
              units={state.units}
              fmtUnit={fmtUnit}
              onRevise={reviseArtifact}
            />
          ))}
        </div>
        <NewArtifactForm units={state.units} onAdd={addArtifact} />
      </section>
    </main>
  );
}

function RelationPanel({
  unit,
  units,
  relations,
  fmtUnit,
  onAdd,
  onRemove,
}: {
  unit: Unit;
  units: Unit[];
  relations: StratState["relations"];
  fmtUnit: (id: string | null) => string;
  onAdd: (type: RelType, targetId: string, note: string) => void;
  onRemove: (id: string) => void;
}) {
  const [type, setType] = useState<RelType>("overlies");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");

  const above = relations.filter((r) => r.type !== "coexists" && r.b === unit.id); // 更晚，在本单位之上
  const below = relations.filter((r) => r.type !== "coexists" && r.a === unit.id); // 更早，在本单位之下
  const coexists = relations.filter(
    (r) => r.type === "coexists" && (r.a === unit.id || r.b === unit.id)
  );

  const submit = () => {
    if (!target) return;
    onAdd(type, target, note.trim());
    setTarget("");
    setNote("");
  };

  const renderRow = (aId: string, t: RelType, bId: string, noteText: string, id: string) => (
    <li key={id} className="rel-row">
      <span className={aId === unit.id ? "rel-self" : ""}>{fmtUnit(aId)}</span>
      <b className={`rel-tag rel-${t}`}>{REL_LABEL[t]}</b>
      <span className={bId === unit.id ? "rel-self" : ""}>{fmtUnit(bId)}</span>
      {noteText && <em>{noteText}</em>}
      <button className="ghost-btn" onClick={() => onRemove(id)}>删除</button>
    </li>
  );

  return (
    <div>
      <div className="section-heading">
        <div>
          <p>{unit.trench} · {unit.kind === "layer" ? "地层" : unit.featureType}</p>
          <h2>{unit.label} 的层位关系</h2>
        </div>
        <span className={`status-chip ${STATUS_CLASS[unit.status]}`}>{unit.status}</span>
      </div>
      <p className="panel-hint">
        {unit.soil}｜{unit.inclusions}｜{unit.pottery}｜深度 {unit.depth}
      </p>

      <div className="rel-groups">
        <div className="rel-group">
          <h3>晚于本单位（叠压/打破本单位，在上方）</h3>
          <ul>
            {above.map((r) => renderRow(r.a, r.type, r.b, r.note, r.id))}
            {above.length === 0 && <li className="empty-hint">暂无记录</li>}
          </ul>
        </div>
        <div className="rel-group">
          <h3>早于本单位（被本单位叠压/打破，在下方）</h3>
          <ul>
            {below.map((r) => renderRow(r.a, r.type, r.b, r.note, r.id))}
            {below.length === 0 && <li className="empty-hint">暂无记录</li>}
          </ul>
        </div>
        <div className="rel-group">
          <h3>共存（同期）</h3>
          <ul>
            {coexists.map((r) =>
              renderRow(r.a, r.type, r.b, r.note, r.id)
            )}
            {coexists.length === 0 && <li className="empty-hint">暂无记录</li>}
          </ul>
        </div>
      </div>

      <div className="rel-form">
        <h3>新增关系</h3>
        <div className="rel-form-grid">
          <label>
            <span>关系类型</span>
            <select value={type} onChange={(e) => setType(e.target.value as RelType)}>
              {(Object.keys(REL_LABEL) as RelType[]).map((t) => (
                <option key={t} value={t}>{REL_LABEL[t]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>目标单位</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">请选择</option>
              {units
                .filter((u) => u.id !== unit.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.trench} · {u.label}</option>
                ))}
            </select>
          </label>
          <label>
            <span>备注</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="开口层位、剖面号等" />
          </label>
          <button className="primary-action" onClick={submit} disabled={!target}>
            保存关系
          </button>
        </div>
        <p className="panel-hint">{REL_HINT[type]}；保存前会自动检查是否成环。</p>
      </div>
    </div>
  );
}

function InterfaceCard({
  link,
  fmtUnit,
  match,
  onConfirm,
  onReject,
}: {
  link: InterfaceLink;
  fmtUnit: (id: string | null) => string;
  match: { rows: { key: string; va: string; vb: string; match: boolean }[]; all: boolean };
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <article className="iface-card">
      <div className="iface-head">
        <strong>{fmtUnit(link.a)} ↔ {fmtUnit(link.b)}</strong>
        <span className="badge pending">待核</span>
      </div>
      {link.note && <p className="iface-note">{link.note}</p>}
      <table className="iface-table">
        <thead>
          <tr><th>对比项</th><th>{fmtUnit(link.a)}</th><th>{fmtUnit(link.b)}</th><th>是否对应</th></tr>
        </thead>
        <tbody>
          {match.rows.map((r) => (
            <tr key={r.key}>
              <td>{r.key}</td>
              <td>{r.va || "—"}</td>
              <td>{r.vb || "—"}</td>
              <td>{r.match ? <span className="badge ok">对应</span> : <span className="badge no">不对应</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="iface-actions">
        <button
          className="primary-action"
          disabled={!match.all}
          title={match.all ? "三项全部对应，可确认同期" : "三项未全部对应，留在待核区"}
          onClick={onConfirm}
        >
          确认同期
        </button>
        <button onClick={onReject}>排除</button>
        {!match.all && <span className="panel-hint">存在不对应项，暂不能确认同期</span>}
      </div>
    </article>
  );
}

function ArtifactRow({
  artifact,
  units,
  fmtUnit,
  onRevise,
}: {
  artifact: Artifact;
  units: Unit[];
  fmtUnit: (id: string | null) => string;
  onRevise: (id: string, toId: string, reason: string) => void;
}) {
  const [toId, setToId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const submit = () => {
    if (!toId) return setError("请选择新归属地层/遗迹");
    if (toId === artifact.unitId) return setError("新归属与现归属相同");
    if (!reason.trim()) return setError("必须填写更正原因");
    onRevise(artifact.id, toId, reason.trim());
    setToId("");
    setReason("");
    setError("");
    setShowHistory(true);
  };

  return (
    <article className="artifact-card">
      <div className="artifact-main">
        <div className="artifact-head">
          <strong>{artifact.name}</strong>
          <span className="badge">{artifact.category}</span>
          <span className={artifact.unitId ? "badge ok" : "badge pending"}>
            {artifact.unitId ? "已归层" : "待归层"}
          </span>
        </div>
        <p>现归属：{fmtUnit(artifact.unitId)} ｜ 坐标：{artifact.coords || "—"}</p>
        {artifact.history.length > 0 && (
          <button className="ghost-btn" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? "收起" : "查看"}修订记录（{artifact.history.length}）
          </button>
        )}
        {showHistory && (
          <ul className="history-list">
            {artifact.history.map((h, i) => (
              <li key={i}>
                <span className="history-from">原归属 {fmtUnit(h.fromId)}</span>
                → 更正为 {fmtUnit(h.toId)} ｜ 原因：{h.reason} ｜ {h.time}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="artifact-revise">
        <select value={toId} onChange={(e) => setToId(e.target.value)}>
          <option value="">更正归属到…</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.trench} · {u.label}</option>
          ))}
        </select>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="更正原因（必填）"
        />
        <button onClick={submit}>提交修订</button>
        {error && <span className="form-error">{error}</span>}
      </div>
    </article>
  );
}

function NewUnitForm({
  trenches,
  onAdd,
}: {
  trenches: string[];
  onAdd: (unit: Omit<Unit, "id" | "status">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    trench: "",
    label: "",
    kind: "layer" as Unit["kind"],
    featureType: "灰坑",
    soil: "",
    inclusions: "",
    pottery: "",
    depth: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => {
    if (!form.trench.trim() || !form.label.trim()) return;
    onAdd({
      trench: form.trench.trim(),
      label: form.label.trim(),
      kind: form.kind,
      featureType: form.kind === "feature" ? form.featureType : undefined,
      soil: form.soil.trim(),
      inclusions: form.inclusions.trim(),
      pottery: form.pottery.trim(),
      depth: form.depth.trim(),
    });
    setForm({ trench: "", label: "", kind: "layer", featureType: "灰坑", soil: "", inclusions: "", pottery: "", depth: "" });
    setOpen(false);
  };

  if (!open) {
    return <button className="primary-action block-btn" onClick={() => setOpen(true)}>新增地层/遗迹单位</button>;
  }
  return (
    <div className="inline-form">
      <h3>新增单位</h3>
      <label>
        <span>探方</span>
        <input value={form.trench} onChange={set("trench")} placeholder="如 T0302" list="trench-list" />
        <datalist id="trench-list">
          {trenches.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <label><span>层位/编号</span><input value={form.label} onChange={set("label")} placeholder="如 第4层、H13 灰坑" /></label>
      <label>
        <span>类别</span>
        <select value={form.kind} onChange={set("kind")}>
          <option value="layer">地层</option>
          <option value="feature">遗迹单位</option>
        </select>
      </label>
      {form.kind === "feature" && (
        <label>
          <span>遗迹类型</span>
          <select value={form.featureType} onChange={set("featureType")}>
            {["灰坑", "墓葬", "房址", "沟状遗迹", "井", "灶"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      )}
      <label><span>土质土色</span><input value={form.soil} onChange={set("soil")} /></label>
      <label><span>包含物</span><input value={form.inclusions} onChange={set("inclusions")} /></label>
      <label><span>陶片组合</span><input value={form.pottery} onChange={set("pottery")} /></label>
      <label><span>深度</span><input value={form.depth} onChange={set("depth")} placeholder="如 0.5–0.9m" /></label>
      <div className="inline-form-actions">
        <button className="primary-action" onClick={submit}>保存单位</button>
        <button onClick={() => setOpen(false)}>取消</button>
      </div>
    </div>
  );
}

function NewInterfaceForm({
  units,
  onAdd,
}: {
  units: Unit[];
  onAdd: (a: string, b: string, note: string) => string | null;
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!a || !b) return setError("请选择两侧单位");
    if (a === b) return setError("两侧不能是同一单位");
    const err = onAdd(a, b, note.trim());
    if (err) return setError(err);
    setA("");
    setB("");
    setNote("");
    setError("");
  };

  return (
    <div className="inline-form">
      <h3>新增接口</h3>
      <div className="rel-form-grid">
        <label>
          <span>探方 A 侧单位</span>
          <select value={a} onChange={(e) => setA(e.target.value)}>
            <option value="">请选择</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.trench} · {u.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>探方 B 侧单位</span>
          <select value={b} onChange={(e) => setB(e.target.value)}>
            <option value="">请选择</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.trench} · {u.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>备注</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="剖面位置、对接情况" />
        </label>
        <button onClick={submit}>加入待核区</button>
      </div>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

function NewArtifactForm({
  units,
  onAdd,
}: {
  units: Unit[];
  onAdd: (name: string, category: string, coords: string, unitId: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("陶片");
  const [coords, setCoords] = useState("");
  const [unitId, setUnitId] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), category, coords.trim(), unitId || null);
    setName("");
    setCoords("");
    setUnitId("");
  };

  return (
    <div className="inline-form">
      <h3>登记出土物</h3>
      <div className="rel-form-grid">
        <label><span>名称</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 陶罐残片" /></label>
        <label>
          <span>类别</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {["陶片", "陶器", "瓷器", "石器", "骨器", "动物遗存", "金属器", "样品"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label><span>坐标点</span><input value={coords} onChange={(e) => setCoords(e.target.value)} placeholder="如 E3N4 深0.8m" /></label>
        <label>
          <span>归属地层/遗迹</span>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">待归层</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.trench} · {u.label}</option>
            ))}
          </select>
        </label>
        <button onClick={submit}>登记</button>
      </div>
    </div>
  );
}

export default App;
