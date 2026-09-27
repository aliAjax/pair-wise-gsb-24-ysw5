import type { ReactNode } from "react";
import type { UnitStatus } from "../types";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {hint ? <em className="field-hint">{hint}</em> : null}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full min-h-[40px] border border-[var(--border)] rounded-md px-3 py-2 bg-white";

export function StatusBadge({ status }: { status: UnitStatus | "待核" | "已确认同期" }) {
  const cls =
    status === "已定稿" || status === "已确认同期"
      ? "badge badge-ok"
      : status === "待核"
        ? "badge badge-watch"
        : "badge badge-edit";
  return <span className={cls}>{status}</span>;
}

export function Empty({ text }: { text: string }) {
  return <div className="empty-hint">{text}</div>;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
