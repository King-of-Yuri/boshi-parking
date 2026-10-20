import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Camera, ClipboardList, Download } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "入口识别", icon: Camera },
  { to: "/records", label: "停车记录", icon: ClipboardList },
  { to: "/stats", label: "运营看板", icon: BarChart3 },
] as const;

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!now) {
    return <div className="hidden h-4 w-36 sm:block" aria-hidden="true" />;
  }
  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  const ss = now.getSeconds().toString().padStart(2, "0");
  const date = `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  return (
    <div className="hidden items-baseline gap-2 font-mono text-xs tabular-nums text-muted sm:flex">
      <span>{date}</span>
      <span className="text-fg">
        {hh}:{mm}
        <span className="text-subtle">:{ss}</span>
      </span>
    </div>
  );
}

export function AppShell({
  children,
  occupancy,
}: {
  children: ReactNode;
  occupancy?: { parked: number; capacity: number };
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="bg-grid min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-fg">
              <Camera className="size-4" strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium tracking-tight">泊识停车</span>
              <span className="block text-xs text-muted">车牌识别停车场</span>
              <span className="block text-xs text-subtle">作者 艾丝妲的狗</span>
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 sm:ml-8 sm:mr-auto">
            {NAV.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm transition-colors duration-150",
                    active
                      ? "bg-surface-2 text-fg"
                      : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            {occupancy ? (
              <div className="hidden items-center gap-2 md:flex">
                <span className="text-xs text-muted">在场</span>
                <span className="font-mono text-sm tabular-nums text-fg">
                  {occupancy.parked}
                  <span className="text-subtle"> / {occupancy.capacity}</span>
                </span>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.min(100, (occupancy.parked / occupancy.capacity) * 100)}%`,
                    }}
                  />
                </span>
              </div>
            ) : null}
            <Clock />
            <a
              href="/downloads/BoshiParking.zip"
              download="BoshiParking.zip"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-fg transition-opacity duration-150 hover:opacity-90"
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">下载源码包</span>
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-muted sm:px-6">
        作者：艾丝妲的狗
      </footer>
    </div>
  );
}
