import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Archive,
  Artifact,
  Coexistence,
  DirectedKind,
  DirectedRelation,
  InterfaceLink,
  Unit,
  UnitStatus,
} from "./types";
import {
  compareUnits,
  type CycleResult,
  detectCycle,
  findRelation,
  uid,
} from "./logic";
import { seedArchive } from "./seed";

const STORAGE_KEY = "hxwl-10.archive.v1";
const UI_KEY = "hxwl-10.ui.v1";

function loadArchive(): Archive {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Archive;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.units)) {
        return parsed;
      }
    }
  } catch {
    /* 存档损坏时回退到示例数据 */
  }
  return seedArchive();
}

export interface UiState {
  selectedUnitId: string | null;
  trenchFilter: string;
  statusFilter: UnitStatus | "全部";
  tab: string;
}

const defaultUiState: UiState = {
  selectedUnitId: null,
  trenchFilter: "全部",
  statusFilter: "全部",
  tab: "units",
};

export function loadUiState(): UiState {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) return { ...defaultUiState, ...(JSON.parse(raw) as Partial<UiState>) };
  } catch {
    /* ignore */
  }
  return defaultUiState;
}

export interface SaveResult {
  ok: boolean;
  cycle?: CycleResult;
  error?: string;
}

export function useArchive() {
  const [archive, setArchive] = useState<Archive>(loadArchive);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(archive));
    }, 150);
    return () => window.clearTimeout(timer.current);
  }, [archive]);

  const saveUi = useCallback((state: UiState) => {
    localStorage.setItem(UI_KEY, JSON.stringify(state));
  }, []);

  // ---- 地层 / 遗迹单位 ----
  const addUnit = useCallback(
    (data: Omit<Unit, "id" | "createdAt" | "updatedAt">) => {
      const id = uid("u-");
      const ts = Date.now();
      const unit: Unit = { ...data, id, createdAt: ts, updatedAt: ts };
      setArchive((a) => ({ ...a, units: [...a.units, unit] }));
      return id;
    },
    []
  );

  const updateUnit = useCallback((id: string, patch: Partial<Unit>) => {
    setArchive((a) => ({
      ...a,
      units: a.units.map((u) =>
        u.id === id ? { ...u, ...patch, updatedAt: Date.now() } : u
      ),
    }));
  }, []);

  // ---- 叠压 / 打破（保存前强制成环检测）----
  const addRelation = useCallback(
    (kind: DirectedKind, upperId: string, lowerId: string, note: string): SaveResult => {
      if (upperId === lowerId) return { ok: false, error: "不能与本单位建立关系" };
      if (findRelation(archive, kind, upperId, lowerId)) {
        return { ok: false, error: "该方向的关系已登记" };
      }
      // 在“拟保存”状态下检测时序环
      const cycle = detectCycle(archive.relations, { upperId, lowerId });
      if (cycle.hasCycle) return { ok: false, cycle }; // 拦住保存
      const rel: DirectedRelation = {
        id: uid("r-"),
        kind,
        upperId,
        lowerId,
        note,
        createdAt: Date.now(),
      };
      setArchive((a) => ({ ...a, relations: [...a.relations, rel] }));
      return { ok: true };
    },
    [archive]
  );

  const deleteRelation = useCallback((id: string) => {
    setArchive((a) => ({
      ...a,
      relations: a.relations.filter((r) => r.id !== id),
    }));
  }, []);

  // ---- 共存（同期）----
  const addCoexistence = useCallback(
    (unitAId: string, unitBId: string, note: string): SaveResult => {
      if (unitAId === unitBId) return { ok: false, error: "不能与本单位共存" };
      if (findRelation(archive, "共存", unitAId, unitBId)) {
        return { ok: false, error: "共存关系已登记" };
      }
      const co: Coexistence = {
        id: uid("c-"),
        unitAId,
        unitBId,
        source: "manual",
        note,
        createdAt: Date.now(),
      };
      setArchive((a) => ({ ...a, coexistences: [...a.coexistences, co] }));
      return { ok: true };
    },
    [archive]
  );

  const deleteCoexistence = useCallback((id: string) => {
    setArchive((a) => ({
      ...a,
      coexistences: a.coexistences.filter((c) => c.id !== id),
      // 由接口自动确认生成的共存被删后，接口退回待核区
      interfaces: a.interfaces.map((i) =>
        i.coexistenceId === id
          ? { ...i, coexistenceId: undefined, status: "待核" as const, checkedAt: undefined }
          : i
      ),
    }));
  }, []);

  // ---- 跨探方接口 ----
  const addInterface = useCallback(
    (unitAId: string, unitBId: string, note: string): SaveResult => {
      if (unitAId === unitBId) return { ok: false, error: "请选择两个不同单位" };
      const ua = archive.units.find((u) => u.id === unitAId);
      const ub = archive.units.find((u) => u.id === unitBId);
      if (!ua || !ub) return { ok: false, error: "单位不存在" };
      if (ua.trench === ub.trench) {
        return { ok: false, error: "跨探方接口必须分属不同探方" };
      }
      if (
        archive.interfaces.some(
          (i) =>
            (i.unitAId === unitAId && i.unitBId === unitBId) ||
            (i.unitAId === unitBId && i.unitBId === unitAId)
        )
      ) {
        return { ok: false, error: "这两个单位的接口已登记" };
      }
      const link: InterfaceLink = {
        id: uid("i-"),
        unitAId,
        unitBId,
        status: "待核",
        note,
        createdAt: Date.now(),
      };
      setArchive((a) => ({ ...a, interfaces: [...a.interfaces, link] }));
      return { ok: true };
    },
    [archive]
  );

  /** 三项比对：土质土色、包含物、陶片组合全部对应才确认同期，否则留在待核区 */
  const checkInterface = useCallback(
    (id: string): SaveResult => {
      const link = archive.interfaces.find((i) => i.id === id);
      if (!link) return { ok: false, error: "接口不存在" };
      const ua = archive.units.find((u) => u.id === link.unitAId);
      const ub = archive.units.find((u) => u.id === link.unitBId);
      if (!ua || !ub) return { ok: false, error: "接口两端单位缺失" };
      const cmp = compareUnits(ua, ub);
      if (!cmp.matched) {
        // 不满足三项一致：不确认，留在待核区，仅记录核查动作
        setArchive((a) => ({
          ...a,
          interfaces: a.interfaces.map((i) =>
            i.id === id ? { ...i, status: "待核", checkedAt: Date.now() } : i
          ),
        }));
        return { ok: false, error: cmp.reasons.join("；") };
      }
      const existing = archive.coexistences.find(
        (c) =>
          (c.unitAId === ua.id && c.unitBId === ub.id) ||
          (c.unitAId === ub.id && c.unitBId === ua.id)
      );
      const coId = existing?.id ?? uid("c-");
      const coexistences: Coexistence[] = existing
        ? archive.coexistences
        : [
            ...archive.coexistences,
            {
              id: coId,
              unitAId: ua.id,
              unitBId: ub.id,
              source: "interface" as const,
              interfaceId: link.id,
              note: "跨探方接口三项比对一致，自动确认同期",
              createdAt: Date.now(),
            },
          ];
      setArchive((a) => ({
        ...a,
        coexistences: a.coexistences.some((c) => c.id === coId)
          ? a.coexistences
          : coexistences,
        interfaces: a.interfaces.map((i) =>
          i.id === id
            ? { ...i, status: "已确认同期" as const, coexistenceId: coId, checkedAt: Date.now() }
            : i
        ),
      }));
      return { ok: true };
    },
    [archive]
  );

  const deleteInterface = useCallback((id: string) => {
    setArchive((a) => ({
      ...a,
      interfaces: a.interfaces.filter((i) => i.id !== id),
    }));
  }, []);

  // ---- 出土物（归入具体地层，修订留痕）----
  const addArtifact = useCallback(
    (data: {
      code: string;
      name: string;
      coordinate: string;
      note: string;
      currentUnitId: string;
      reason?: string;
    }) => {
      const id = uid("a-");
      const ts = Date.now();
      const artifact: Artifact = {
        id,
        code: data.code,
        name: data.name,
        coordinate: data.coordinate,
        note: data.note,
        currentUnitId: data.currentUnitId,
        revisions: [
          {
            fromUnitId: null,
            toUnitId: data.currentUnitId,
            reason: data.reason || "初次登记",
            at: ts,
          },
        ],
      };
      setArchive((a) => ({ ...a, artifacts: [...a.artifacts, artifact] }));
      return id;
    },
    []
  );

  const reassignArtifact = useCallback(
    (artifactId: string, toUnitId: string, reason: string): SaveResult => {
      if (!reason.trim()) return { ok: false, error: "修订必须填写更正原因" };
      const art = archive.artifacts.find((x) => x.id === artifactId);
      if (!art) return { ok: false, error: "出土物不存在" };
      if (art.currentUnitId === toUnitId) {
        return { ok: false, error: "新归属与当前归属相同" };
      }
      const revision = { fromUnitId: art.currentUnitId, toUnitId, reason, at: Date.now() };
      setArchive((a) => ({
        ...a,
        artifacts: a.artifacts.map((x) =>
          x.id === artifactId
            ? { ...x, currentUnitId: toUnitId, revisions: [...x.revisions, revision] }
            : x
        ),
      }));
      return { ok: true };
    },
    [archive]
  );

  const deleteArtifact = useCallback((id: string) => {
    setArchive((a) => ({
      ...a,
      artifacts: a.artifacts.filter((x) => x.id !== id),
    }));
  }, []);

  const resetArchive = useCallback(() => {
    setArchive(seedArchive());
  }, []);

  return {
    archive,
    saveUi,
    addUnit,
    updateUnit,
    addRelation,
    deleteRelation,
    addCoexistence,
    deleteCoexistence,
    addInterface,
    checkInterface,
    deleteInterface,
    addArtifact,
    reassignArtifact,
    deleteArtifact,
    resetArchive,
  };
}

export type ArchiveApi = ReturnType<typeof useArchive>;
