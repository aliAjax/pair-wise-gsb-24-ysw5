import type {
  Archive,
  Coexistence,
  DirectedKind,
  DirectedRelation,
  InterfaceLink,
  RelationKind,
  Unit,
} from "./types";

export function uid(prefix = ""): string {
  return (
    prefix +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

export function unitLabel(unit: Unit | undefined): string {
  if (!unit) return "（已删除单位）";
  return `${unit.trench} · ${unit.code}`;
}

export function fullLabel(unit: Unit | undefined): string {
  if (!unit) return "（已删除单位）";
  return `${unit.trench} · ${unit.code}（${unit.kind}）`;
}

/**
 * 时序边：later 晚于 earlier。
 * 叠压：upper（上层）晚于 lower（下层）。
 * 打破：upper（打破者）晚于 lower（被打破者）。
 */
export function temporalEdges(relations: DirectedRelation[]): Map<string, Set<string>> {
  const edges = new Map<string, Set<string>>();
  for (const r of relations) {
    if (!edges.has(r.upperId)) edges.set(r.upperId, new Set());
    edges.get(r.upperId)!.add(r.lowerId);
  }
  return edges;
}

export interface CycleResult {
  hasCycle: boolean;
  /** 成环的单位 id（按环上顺序） */
  path: string[];
}

/** 深度优先检测有向时序图中的环，返回首个环路径 */
export function detectCycle(
  relations: DirectedRelation[],
  candidate?: { upperId: string; lowerId: string }
): CycleResult {
  const edges = temporalEdges(relations);
  if (candidate) {
    if (!edges.has(candidate.upperId)) edges.set(candidate.upperId, new Set());
    edges.get(candidate.upperId)!.add(candidate.lowerId);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];

  const dfs = (node: string): string[] | null => {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      if (color.get(next) === GRAY) {
        const start = stack.indexOf(next);
        return stack.slice(start).concat(next);
      }
      if (color.get(next) !== BLACK) {
        const found = dfs(next);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return null;
  };

  for (const node of edges.keys()) {
    if (color.get(node) !== BLACK) {
      const found = dfs(node);
      if (found) return { hasCycle: true, path: found };
    }
  }
  return { hasCycle: false, path: [] };
}

/** 找出沿某条有向路径上的全部原始关系（用于成环时回查） */
export function relationsAlongPath(
  relations: DirectedRelation[],
  path: string[]
): DirectedRelation[] {
  const result: DirectedRelation[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const hit = relations.find(
      (r) => r.upperId === path[i] && r.lowerId === path[i + 1]
    );
    if (hit) result.push(hit);
  }
  return result;
}

export function findRelation(
  archive: Archive,
  kind: RelationKind,
  a: string,
  b: string
): DirectedRelation | Coexistence | undefined {
  if (kind === "共存") {
    return archive.coexistences.find(
      (c) =>
        (c.unitAId === a && c.unitBId === b) ||
        (c.unitAId === b && c.unitBId === a)
    );
  }
  return archive.relations.find(
    (r) =>
      r.kind === kind &&
      ((r.upperId === a && r.lowerId === b) ||
        (r.upperId === b && r.lowerId === a))
  );
}

/** 跨探方接口同期确认：土质土色、包含物、陶片组合三项必须全部对应 */
export interface CompareResult {
  soilMatch: boolean;
  inclusionMatch: boolean;
  potteryMatch: boolean;
  matched: boolean;
  reasons: string[];
}

export function compareUnits(a: Unit, b: Unit): CompareResult {
  const norm = (s: string) => s.replace(/[\s,，、;；.。]+/g, "").trim();
  const same = (x: string, y: string) => norm(x) !== "" && norm(x) === norm(y);
  const soilMatch = same(a.soilColor, b.soilColor);
  const inclusionMatch = same(a.inclusions, b.inclusions);
  const potteryMatch = same(a.pottery, b.pottery);
  const reasons: string[] = [];
  if (!soilMatch) reasons.push("土质土色不一致");
  if (!inclusionMatch) reasons.push("包含物不一致");
  if (!potteryMatch) reasons.push("陶片组合不一致");
  return {
    soilMatch,
    inclusionMatch,
    potteryMatch,
    matched: soilMatch && inclusionMatch && potteryMatch,
    reasons,
  };
}

export function interfaceUnitIds(link: InterfaceLink): [string, string] {
  return [link.unitAId, link.unitBId];
}

export const directedKindLabel: Record<DirectedKind, string> = {
  叠压: "叠压（上层晚于下层）",
  打破: "打破（打破者晚于被打破者）",
};

/** 关系类型对应的安全 CSS 类名 */
export function directedKindClass(kind: DirectedKind): string {
  return kind === "叠压" ? "rel-over" : "rel-break";
}

export function coSourceClass(source: Coexistence["source"]): string {
  return source === "interface" ? "rel-co-interface" : "rel-co-manual";
}
