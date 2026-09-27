// 地层关系整理台领域模型

export type UnitKind =
  | "地层"
  | "灰坑"
  | "墓葬"
  | "房址"
  | "沟状遗迹"
  | "柱洞"
  | "其他";

export type UnitStatus = "整理中" | "待核" | "已定稿";

export type DirectedKind = "叠压" | "打破";
export type RelationKind = DirectedKind | "共存";

export interface Unit {
  id: string;
  trench: string; // 探方编号，如 T0203
  code: string; // 地层/遗迹单位编号，如 第3层、H12
  kind: UnitKind;
  depth: string; // 深度
  soilColor: string; // 土质土色
  inclusions: string; // 包含物
  pottery: string; // 陶片组合
  note: string;
  status: UnitStatus;
  createdAt: number;
  updatedAt: number;
}

/** 上下叠压 / 打破：有向关系，upper 早于 lower 的反向时序（上层晚、打破者晚） */
export interface DirectedRelation {
  id: string;
  kind: DirectedKind;
  upperId: string; // 上层单位 / 打破者
  lowerId: string; // 下层单位 / 被打破者
  note: string;
  createdAt: number;
}

/** 共存（同期）：无向 */
export interface Coexistence {
  id: string;
  unitAId: string;
  unitBId: string;
  source: "manual" | "interface"; // 手工登记 / 跨探方接口确认后生成
  interfaceId?: string;
  note: string;
  createdAt: number;
}

export type InterfaceStatus = "待核" | "已确认同期";

export interface InterfaceLink {
  id: string;
  unitAId: string;
  unitBId: string; // 必须分属不同探方
  status: InterfaceStatus;
  note: string;
  coexistenceId?: string;
  createdAt: number;
  checkedAt?: number;
}

export interface ArtifactRevision {
  fromUnitId: string | null; // null 表示初次登记
  toUnitId: string;
  reason: string;
  at: number;
}

export interface Artifact {
  id: string;
  code: string; // 出土物编号
  name: string;
  coordinate: string; // 坐标点
  note: string;
  currentUnitId: string;
  revisions: ArtifactRevision[];
}

export interface Archive {
  version: 1;
  units: Unit[];
  relations: DirectedRelation[];
  coexistences: Coexistence[];
  interfaces: InterfaceLink[];
  artifacts: Artifact[];
}
