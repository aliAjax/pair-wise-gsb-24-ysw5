import type { Relation, RelType, StratState } from "./types";

/** 成环路径上的一步（一条既有关系） */
export interface CycleStep {
  aId: string;
  bId: string;
  type: RelType;
  relationId: string;
}

export interface CycleCheck {
  ok: boolean;
  reason: string;
  /** 与拟保存关系构成冲突的既有关系链 */
  steps: CycleStep[];
}

interface DirEdge {
  from: string;
  to: string;
  step: CycleStep;
}

const OK: CycleCheck = { ok: true, reason: "", steps: [] };

function makeFinder(ids: string[]) {
  const parent = new Map<string, string>();
  ids.forEach((id) => parent.set(id, id));
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== cur) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (x: string, y: string) => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  };
  return { find, union };
}

/**
 * 校验拟新增关系是否会成环。
 * 共存关系视为同期等价组（并查集），叠压/打破是组间有向边（晚 → 早）。
 * 有向边成环、或与共存组矛盾，都拦住保存并给出涉及的原关系链。
 */
export function checkRelation(
  state: StratState,
  aId: string,
  bId: string,
  type: RelType
): CycleCheck {
  if (aId === bId) {
    return { ok: false, reason: "不能与自身建立关系", steps: [] };
  }

  const { find, union } = makeFinder(state.units.map((u) => u.id));
  const coexistRels = state.relations.filter((r) => r.type === "coexists");
  coexistRels.forEach((r) => union(r.a, r.b));

  const dirEdges: DirEdge[] = state.relations
    .filter((r) => r.type !== "coexists")
    .map((r) => ({
      from: find(r.a),
      to: find(r.b),
      step: { aId: r.a, bId: r.b, type: r.type, relationId: r.id },
    }));

  const ra = find(aId);
  const rb = find(bId);

  if (type === "coexists") {
    if (ra === rb) return OK; // 本就在同一共存组
    const path = findDirPath(dirEdges, ra, rb) ?? findDirPath(dirEdges, rb, ra);
    if (path) {
      return {
        ok: false,
        reason: "两单位之间已存在叠压/打破的早晚关系链，再记共存会自相矛盾",
        steps: path,
      };
    }
    return OK;
  }

  // 叠压 / 打破：a 晚于 b
  if (ra === rb) {
    return {
      ok: false,
      reason: "两单位已记为共存（同期），不能再记叠压/打破等早晚关系",
      steps: findCoexistChain(coexistRels, aId, bId),
    };
  }
  const back = findDirPath(dirEdges, rb, ra);
  if (back) {
    return {
      ok: false,
      reason: "保存后将与以下既有关系构成环路，早晚关系互相矛盾",
      steps: back,
    };
  }
  return OK;
}

/** 在有向组图上找 start → target 的一条路径，返回经过的既有关系 */
function findDirPath(edges: DirEdge[], start: string, target: string): CycleStep[] | null {
  if (start === target) return [];
  const adj = new Map<string, DirEdge[]>();
  edges.forEach((e) => {
    const list = adj.get(e.from) ?? [];
    list.push(e);
    adj.set(e.from, list);
  });
  const prev = new Map<string, { from: string; edge: DirEdge }>();
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of adj.get(cur) ?? []) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      prev.set(e.to, { from: cur, edge: e });
      if (e.to === target) {
        const path: CycleStep[] = [];
        let node = target;
        while (node !== start) {
          const p = prev.get(node)!;
          path.unshift(p.edge.step);
          node = p.from;
        }
        return path;
      }
      queue.push(e.to);
    }
  }
  return null;
}

/** 在共存关系（无向）上找 aId 与 bId 之间的链 */
function findCoexistChain(rels: Relation[], aId: string, bId: string): CycleStep[] {
  const adj = new Map<string, { to: string; rel: Relation }[]>();
  rels.forEach((r) => {
    [
      { from: r.a, to: r.b },
      { from: r.b, to: r.a },
    ].forEach(({ from, to }) => {
      const list = adj.get(from) ?? [];
      list.push({ to, rel: r });
      adj.set(from, list);
    });
  });
  const prev = new Map<string, { from: string; rel: Relation }>();
  const seen = new Set([aId]);
  const queue = [aId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const { to, rel } of adj.get(cur) ?? []) {
      if (seen.has(to)) continue;
      seen.add(to);
      prev.set(to, { from: cur, rel });
      if (to === bId) {
        const path: CycleStep[] = [];
        let node = bId;
        while (node !== aId) {
          const p = prev.get(node)!;
          path.unshift({ aId: p.rel.a, bId: p.rel.b, type: "coexists", relationId: p.rel.id });
          node = p.from;
        }
        return path;
      }
      queue.push(to);
    }
  }
  return [];
}
