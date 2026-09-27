export type UnitKind = "layer" | "feature";
export type UnitStatus = "整理中" | "已确认" | "待复核";

/** 地层或遗迹单位 */
export interface Unit {
  id: string;
  trench: string; // 探方
  label: string; // 层位 / 遗迹编号，如 第2层、H12 灰坑
  kind: UnitKind;
  featureType?: string; // 灰坑 / 墓葬 / 房址 / 沟状遗迹
  soil: string; // 土质土色
  inclusions: string; // 包含物
  pottery: string; // 陶片组合
  depth: string;
  status: UnitStatus;
}

/** overlies: a 叠压 b（a 更晚）；cuts: a 打破 b（a 更晚）；coexists: 同期共存 */
export type RelType = "overlies" | "cuts" | "coexists";

export interface Relation {
  id: string;
  a: string;
  b: string;
  type: RelType;
  note: string;
}

export type InterfaceStatus = "pending" | "confirmed" | "rejected";

/** 跨探方接口：两个不同探方的单位是否同期 */
export interface InterfaceLink {
  id: string;
  a: string;
  b: string;
  status: InterfaceStatus;
  note: string;
}

export interface ArtifactRevision {
  fromId: string | null; // 原归属（null = 未归层）
  toId: string;
  reason: string; // 更正原因
  time: string;
}

export interface Artifact {
  id: string;
  name: string;
  category: string;
  unitId: string | null; // 现归属地层/遗迹
  coords: string;
  history: ArtifactRevision[];
}

export interface StratState {
  units: Unit[];
  relations: Relation[];
  interfaces: InterfaceLink[];
  artifacts: Artifact[];
}
