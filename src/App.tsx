import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { loadUiState, useArchive, type UiState } from "./store";
import type { UnitStatus } from "./types";
import { UnitsView } from "./components/UnitsView";
import { InterfacesView } from "./components/InterfacesView";
import { ArtifactsView } from "./components/ArtifactsView";
import { RelationsOverview } from "./components/RelationsOverview";

const project = {
  id: "hxwl-10",
  title: "考古探方记录 · 地层关系整理台",
  subtitle:
    "同一工作台登记上下叠压、打破与共存关系；时序成环自动拦截并回查原关系；跨探方接口经土质、包含物、陶片三项比对确认同期；出土物归入具体地层，修订全程留痕。",
};

const TABS = [
  { key: "units", label: "地层关系整理台" },
  { key: "interfaces", label: "跨探方接口" },
  { key: "artifacts", label: "出土物归属" },
  { key: "relations", label: "关系总览" },
] as const;

const STATUS_OPTIONS: (UnitStatus | "全部")[] = ["全部", "整理中", "待核", "已定稿"];

function App() {
  const api = useArchive();
  const { archive } = api;

  const [ui, setUi] = useState<UiState>(loadUiState);
  const patchUi = (patch: Partial<UiState>) =>
    setUi((prev) => {
      const next = { ...prev, ...patch };
      api.saveUi(next);
      return next;
    });

  // 选中单位被删后清空选择
  useEffect(() => {
    if (ui.selectedUnitId && !archive.units.some((u) => u.id === ui.selectedUnitId)) {
      patchUi({ selectedUnitId: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archive.units]);

  const trenches = useMemo(
    () => Array.from(new Set(archive.units.map((u) => u.trench))).sort(),
    [archive.units]
  );

  const pendingInterfaces = archive.interfaces.filter((i) => i.status === "待核").length;
  const metrics = [
    { label: "探方数", value: trenches.length, cls: "status-ok" },
    { label: "地层 / 遗迹单位", value: archive.units.length, cls: "status-ok" },
    { label: "时序关系", value: archive.relations.length, cls: "status-watch" },
    { label: "出土物", value: archive.artifacts.length, cls: "status-ok" },
    { label: "待核接口", value: pendingInterfaces, cls: pendingInterfaces ? "status-danger" : "status-ok" },
  ];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{project.id} · 资料整理工作台</p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>自动保存</span>
          <strong>本地档案实时落盘</strong>
          <p className="muted-text small">重新打开页面可继续上次标注，筛选与选中单位一并恢复。</p>
          <button
            className="ghost-btn"
            onClick={() => {
              if (window.confirm("恢复示例数据将覆盖当前全部整理成果，确定继续？")) {
                api.resetArchive();
              }
            }}
          >
            恢复示例数据
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((m) => (
          <article key={m.label} className="metric-card">
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            <i className={m.cls} />
          </article>
        ))}
      </section>

      <section className="filter-bar panel">
        <div className="filter-group">
          <span className="filter-label">按探方</span>
          <div className="chips">
            {["全部", ...trenches].map((t) => (
              <button
                key={t}
                className={ui.trenchFilter === t ? "chip-active" : ""}
                onClick={() => patchUi({ trenchFilter: t })}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <span className="filter-label">按状态</span>
          <div className="chips">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                className={ui.statusFilter === s ? "chip-active" : ""}
                onClick={() => patchUi({ statusFilter: s })}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={"tab" + (ui.tab === t.key ? " active" : "")}
            onClick={() => patchUi({ tab: t.key })}
          >
            {t.label}
            {t.key === "interfaces" && pendingInterfaces > 0 && (
              <span className="tab-badge">{pendingInterfaces}</span>
            )}
          </button>
        ))}
      </nav>

      {ui.tab === "units" && (
        <UnitsView
          api={api}
          trenchFilter={ui.trenchFilter}
          statusFilter={ui.statusFilter}
          selectedUnitId={ui.selectedUnitId}
          onSelect={(id) => patchUi({ selectedUnitId: id })}
        />
      )}
      {ui.tab === "interfaces" && <InterfacesView api={api} />}
      {ui.tab === "artifacts" && (
        <ArtifactsView api={api} trenchFilter={ui.trenchFilter} statusFilter={ui.statusFilter} />
      )}
      {ui.tab === "relations" && <RelationsOverview api={api} />}
    </main>
  );
}

export default App;
