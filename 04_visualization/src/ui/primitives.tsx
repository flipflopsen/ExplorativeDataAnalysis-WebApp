// Lightweight shadcn-inspired primitives.
// We stay on plain CSS-in-JS (no Tailwind dependency) so they pick up the
// active theme through `useAppStore.currentTheme()` and feel native to this app.

import { type CSSProperties, type ReactNode, forwardRef } from "react";
import { currentTheme } from "../state/appStore";

function t() {
  return (
    currentTheme() ?? {
      background: "#0f1419",
      panel: "#14191f",
      border: "#2a2f3a",
      text: "#e6e1cf",
      accent: "#39bae6",
      node: "#ffb454",
      link: "#3d4751",
      label: "",
    }
  );
}

// ── Card ─────────────────────────────────────────────────────────────────
export function Card({
  children,
  title,
  actions,
  style,
  padded = true,
}: {
  children: ReactNode;
  title?: ReactNode;
  actions?: ReactNode;
  style?: CSSProperties;
  padded?: boolean;
}) {
  const th = t();
  return (
    <div
      style={{
        background: `${th.panel}`,
        border: `1px solid ${th.border}`,
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.15)",
        ...style,
      }}
    >
      {(title || actions) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            borderBottom: `1px solid ${th.border}`,
            color: th.text,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.2,
            textTransform: "uppercase",
            opacity: 0.85,
          }}
        >
          <span>{title}</span>
          {actions}
        </div>
      )}
      <div style={{ padding: padded ? 12 : 0 }}>{children}</div>
    </div>
  );
}

// ── Button ───────────────────────────────────────────────────────────────
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "sm", style, children, ...rest },
  ref,
) {
  const th = t();
  const padY = size === "sm" ? 4 : 6;
  const padX = size === "sm" ? 10 : 14;
  const variants: Record<string, CSSProperties> = {
    default: { background: th.background, color: th.text, border: `1px solid ${th.border}` },
    primary: { background: th.accent, color: "#ffffff", border: `1px solid ${th.accent}` },
    ghost: { background: "transparent", color: th.text, border: `1px solid transparent` },
    outline: { background: "transparent", color: th.text, border: `1px solid ${th.border}` },
    danger: { background: "transparent", color: "#ff6b6b", border: `1px solid #ff6b6b66` },
  };
  return (
    <button
      ref={ref}
      {...rest}
      style={{
        padding: `${padY}px ${padX}px`,
        borderRadius: 6,
        fontSize: size === "sm" ? 12 : 13,
        cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.5 : 1,
        transition: "background 0.15s, border-color 0.15s, color 0.15s",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
});

// ── Select (native, themed) ──────────────────────────────────────────────
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ style, children, ...rest }, ref) {
    const th = t();
    return (
      <select
        ref={ref}
        {...rest}
        style={{
          width: "100%",
          padding: "5px 8px",
          borderRadius: 6,
          background: th.background,
          color: th.text,
          border: `1px solid ${th.border}`,
          fontSize: 12,
          outline: "none",
          ...style,
        }}
      >
        {children}
      </select>
    );
  },
);

// ── Input (text/number) ──────────────────────────────────────────────────
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ style, ...rest }, ref) {
    const th = t();
    return (
      <input
        ref={ref}
        {...rest}
        style={{
          width: "100%",
          padding: "5px 8px",
          borderRadius: 6,
          background: th.background,
          color: th.text,
          border: `1px solid ${th.border}`,
          fontSize: 12,
          outline: "none",
          ...style,
        }}
      />
    );
  },
);

// ── Label ────────────────────────────────────────────────────────────────
export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const th = t();
  return (
    <div
      style={{
        fontSize: 11,
        color: th.text,
        opacity: 0.7,
        marginBottom: 3,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Segmented control ────────────────────────────────────────────────────
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: CSSProperties;
}) {
  const th = t();
  return (
    <div
      style={{
        display: "inline-flex",
        background: th.background,
        border: `1px solid ${th.border}`,
        borderRadius: 6,
        padding: 2,
        ...style,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              background: active ? th.accent : "transparent",
              color: active ? "#ffffff" : th.text,
              transition: "background 0.15s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Color swatch input (native color picker) ─────────────────────────────
export function ColorSwatch({
  value,
  onChange,
  size = 20,
}: {
  value: string;
  onChange: (v: string) => void;
  size?: number;
}) {
  const th = t();
  return (
    <label
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: 4,
        background: value,
        border: `1px solid ${th.border}`,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ opacity: 0, width: "100%", height: "100%", cursor: "pointer", border: "none" }}
      />
    </label>
  );
}
