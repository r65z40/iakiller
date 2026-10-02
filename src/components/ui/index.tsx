import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark disabled:opacity-60",
  secondary: "bg-white text-ink ring-1 ring-line hover:bg-surface disabled:opacity-60",
  ghost: "text-ink hover:bg-surface",
  danger: "bg-danger text-white hover:brightness-95 disabled:opacity-60",
};

export function buttonClass(variant: Variant = "primary", size: "sm" | "md" = "md") {
  return `inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition ${size === "sm" ? "min-h-9 px-3 text-sm" : "min-h-11 px-4 text-[15px]"} ${variants[variant]}`;
}

export function Button({ variant = "primary", size = "md", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button {...props} className={`${buttonClass(variant, size)} ${className}`} />;
}

export function ButtonLink({ variant = "primary", size = "md", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link {...props} className={`${buttonClass(variant, size)} ${className}`} />;
}

export const inputClass =
  "mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand disabled:bg-surface disabled:text-muted";

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${inputClass} py-2 ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Panel({ title, description, actions, children, className = "" }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl bg-white p-5 ring-1 ring-line ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-bold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Alert({ tone = "info", children, title }: { tone?: "info" | "warning" | "danger" | "success"; children: ReactNode; title?: string }) {
  const tones = {
    info: "bg-brand-soft text-ink ring-brand/20",
    warning: "bg-[#fff6e6] text-[#7a3d00] ring-[#f5c27a]",
    danger: "bg-[#fdecea] text-[#7a1a12] ring-[#f3b4ad]",
    success: "bg-[#e7f6ee] text-[#05502f] ring-[#9fd8b8]",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ring-1 ${tones[tone]}`}>
      {title && <p className="font-bold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "brand" }) {
  const tones = {
    neutral: "bg-surface text-muted ring-line",
    success: "bg-[#e7f6ee] text-success ring-[#9fd8b8]",
    warning: "bg-[#fff6e6] text-warning ring-[#f5c27a]",
    danger: "bg-[#fdecea] text-danger ring-[#f3b4ad]",
    brand: "bg-brand-soft text-brand ring-brand/20",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${tones[tone]}`}>{children}</span>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center">
      <p className="font-bold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
