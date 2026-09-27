import type { StratState } from "./types";

export const STORAGE_KEY = "hxwl-strata-workbench-v1";

export const seedState: StratState = {
  units: [
    { id: "u-t0203-1", trench: "T0203", label: "第1层", kind: "layer", soil: "灰褐色粉砂土", inclusions: "瓷片、砖渣", pottery: "青花瓷片", depth: "0–0.3m", status: "已确认" },
    { id: "u-t0203-2", trench: "T0203", label: "第2层", kind: "layer", soil: "黄褐色黏土", inclusions: "陶片、炭屑", pottery: "绳纹夹砂陶", depth: "0.3–0.8m", status: "整理中" },
    { id: "u-t0203-3", trench: "T0203", label: "第3层", kind: "layer", soil: "灰褐土", inclusions: "陶片、兽骨", pottery: "泥质灰陶豆、罐", depth: "0.8–1.4m", status: "整理中" },
    { id: "u-t0203-g5", trench: "T0203", label: "G5 沟", kind: "feature", featureType: "沟状遗迹", soil: "灰黑色淤土", inclusions: "陶片、草木灰", pottery: "绳纹灰陶", depth: "1.1–1.6m", status: "待复核" },
    { id: "u-t0204-2", trench: "T0204", label: "第2层", kind: "layer", soil: "黄褐色黏土", inclusions: "陶片、炭屑", pottery: "绳纹夹砂陶", depth: "0.25–0.75m", status: "整理中" },
    { id: "u-t0204-3", trench: "T0204", label: "第3层", kind: "layer", soil: "灰褐土", inclusions: "红烧土粒、陶片", pottery: "夹砂红陶釜", depth: "0.75–1.3m", status: "待复核" },
    { id: "u-t0204-h12", trench: "T0204", label: "H12 灰坑", kind: "feature", featureType: "灰坑", soil: "黑褐土", inclusions: "炭屑、动物骨", pottery: "绳纹灰陶", depth: "0.8–1.5m", status: "待复核" },
    { id: "u-t0301-2", trench: "T0301", label: "第2层", kind: "layer", soil: "黄褐色黏土", inclusions: "红烧土粒、炭屑", pottery: "绳纹夹砂陶", depth: "0.2–0.7m", status: "整理中" },
    { id: "u-t0301-f2", trench: "T0301", label: "F2 房址", kind: "feature", featureType: "房址", soil: "夯土面", inclusions: "柱洞、灶坑", pottery: "陶片极少", depth: "0.7–1.0m", status: "待复核" },
    { id: "u-t0301-m3", trench: "T0301", label: "M3 墓葬", kind: "feature", featureType: "墓葬", soil: "花土填土", inclusions: "人骨、随葬陶器", pottery: "泥质灰陶罐", depth: "0.9–1.8m", status: "整理中" },
  ],
  relations: [
    { id: "r1", a: "u-t0203-1", b: "u-t0203-2", type: "overlies", note: "表土层直接叠压②层" },
    { id: "r2", a: "u-t0203-2", b: "u-t0203-3", type: "overlies", note: "" },
    { id: "r3", a: "u-t0203-g5", b: "u-t0203-3", type: "cuts", note: "G5 开口于②层下，打破③层" },
    { id: "r4", a: "u-t0204-2", b: "u-t0204-h12", type: "overlies", note: "H12 开口于②层下" },
    { id: "r5", a: "u-t0204-h12", b: "u-t0204-3", type: "cuts", note: "H12 打破③层" },
    { id: "r6", a: "u-t0301-2", b: "u-t0301-m3", type: "overlies", note: "" },
    { id: "r7", a: "u-t0301-m3", b: "u-t0301-f2", type: "cuts", note: "M3 打破 F2 夯土面" },
  ],
  interfaces: [
    { id: "i1", a: "u-t0203-2", b: "u-t0204-2", status: "pending", note: "隔梁两侧②层对接" },
    { id: "i2", a: "u-t0203-3", b: "u-t0204-3", status: "pending", note: "③层土色接近，陶片组合待核" },
    { id: "i3", a: "u-t0203-2", b: "u-t0301-2", status: "pending", note: "②层跨探方对比" },
  ],
  artifacts: [
    {
      id: "a1",
      name: "泥质灰陶豆残片",
      category: "陶器",
      unitId: "u-t0203-3",
      coords: "E3N4 深1.1m",
      history: [
        { fromId: "u-t0203-2", toId: "u-t0203-3", reason: "复核出土深度与剖面，原归②层有误", time: "2026-09-25 10:20" },
      ],
    },
    { id: "a2", name: "猪下颌骨", category: "动物遗存", unitId: "u-t0204-h12", coords: "H12 中部", history: [] },
    { id: "a3", name: "绳纹陶片 12 件", category: "陶片", unitId: "u-t0203-3", coords: "E3N4", history: [] },
    { id: "a4", name: "青花瓷片", category: "瓷器", unitId: "u-t0203-1", coords: "E1N2", history: [] },
    { id: "a5", name: "石斧", category: "石器", unitId: null, coords: "E5N2 深0.9m", history: [] },
    { id: "a6", name: "炭屑样本", category: "样品", unitId: "u-t0204-h12", coords: "H12 底部", history: [] },
  ],
};
