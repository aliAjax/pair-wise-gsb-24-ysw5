import type { Archive, Coexistence } from "./types";
import { uid } from "./logic";

const now = 1758900000000; // 2025-09-27 固定时间基准，保证示例数据排序稳定

/** 初次打开时载入的示例档案 */
export function seedArchive(): Archive {
  const u = {
    l3a: "u-t0203-l3",
    l4a: "u-t0203-l4",
    h12: "u-t0203-h12",
    l3b: "u-t0204-l3",
    f2: "u-t0204-f2",
    g1: "u-t0204-g1",
  } as const;

  const units = [
    {
      id: u.l3a,
      trench: "T0203",
      code: "第3层",
      kind: "地层" as const,
      depth: "0.62–0.95m",
      soilColor: "灰褐土",
      inclusions: "炭屑、红烧土颗粒",
      pottery: "夹砂灰陶为主，少量泥质黑皮陶",
      note: "层理平整，含陶片12件",
      status: "整理中" as const,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: u.l4a,
      trench: "T0203",
      code: "第4层",
      kind: "地层" as const,
      depth: "0.95–1.32m",
      soilColor: "黄褐土",
      inclusions: "少量料姜石",
      pottery: "泥质红陶残片",
      note: "土质较致密",
      status: "已定稿" as const,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: u.h12,
      trench: "T0203",
      code: "H12",
      kind: "灰坑" as const,
      depth: "0.95–1.48m",
      soilColor: "黑褐土",
      inclusions: "炭屑、动物骨骼",
      pottery: "夹砂褐陶、鼎足残件",
      note: "开口于第3层下，打破第4层",
      status: "整理中" as const,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: u.l3b,
      trench: "T0204",
      code: "第3层",
      kind: "地层" as const,
      depth: "0.58–0.92m",
      soilColor: "灰褐土",
      inclusions: "炭屑、红烧土颗粒",
      pottery: "夹砂灰陶为主，少量泥质黑皮陶",
      note: "与 T0203 第3层在隔梁下对接，待接口确认",
      status: "待核" as const,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: u.f2,
      trench: "T0204",
      code: "F2",
      kind: "房址" as const,
      depth: "0.90–1.10m",
      soilColor: "花斑夯土",
      inclusions: "柱洞、碎陶片",
      pottery: "夹砂灰陶板瓦残片",
      note: "柱洞关系需复核",
      status: "待核" as const,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: u.g1,
      trench: "T0204",
      code: "G1",
      kind: "沟状遗迹" as const,
      depth: "1.05–1.60m",
      soilColor: "黑褐土",
      inclusions: "淤土、碎石",
      pottery: "原始瓷片、釉陶",
      note: "填土与 H12 看似相近，陶片组合差异大",
      status: "待核" as const,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const relations = [
    {
      id: uid("r-"),
      kind: "叠压" as const,
      upperId: u.l3a,
      lowerId: u.l4a,
      note: "T0203 正常地层层序",
      createdAt: now,
    },
    {
      id: uid("r-"),
      kind: "叠压" as const,
      upperId: u.l3a,
      lowerId: u.h12,
      note: "H12 开口于第3层下",
      createdAt: now,
    },
    {
      id: uid("r-"),
      kind: "打破" as const,
      upperId: u.h12,
      lowerId: u.l4a,
      note: "H12 坑壁切入第4层",
      createdAt: now,
    },
  ];

  const coexistences: Coexistence[] = [];

  const interfaces = [
    {
      id: uid("i-"),
      unitAId: u.l3a,
      unitBId: u.l3b,
      status: "待核" as const,
      note: "隔梁下土色连续，待三项比对确认",
      createdAt: now,
    },
    {
      id: uid("i-"),
      unitAId: u.h12,
      unitBId: u.g1,
      status: "待核" as const,
      note: "填土颜色相近，整理员提出比对",
      createdAt: now,
    },
  ];

  const artifacts = [
    {
      id: uid("a-"),
      code: "TB-001",
      name: "夹砂灰陶罐口沿",
      coordinate: "T0203 E3N4",
      note: "第3层出土，共12片中的可复原件",
      currentUnitId: u.l3a,
      revisions: [
        { fromUnitId: null, toUnitId: u.l3a, reason: "初次登记", at: now },
      ],
    },
    {
      id: uid("a-"),
      code: "TB-002",
      name: "动物肩胛骨",
      coordinate: "T0203 E5N2",
      note: "原记坑口采集，复核为坑内填土出土",
      currentUnitId: u.h12,
      revisions: [
        { fromUnitId: null, toUnitId: u.l3a, reason: "初次登记", at: now },
        {
          fromUnitId: u.l3a,
          toUnitId: u.h12,
          reason: "坐标距 H12 坑壁 0.3m，且骨面附着黑褐填土，确认坑内出土",
          at: now + 3600_000,
        },
      ],
    },
  ];

  return {
    version: 1,
    units,
    relations,
    coexistences,
    interfaces,
    artifacts,
  };
}
