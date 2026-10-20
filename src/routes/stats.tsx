import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Car, Clock3, LogIn, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFee } from "@/lib/parking";
import { getDashboard } from "@/lib/parking.functions";

export const Route = createFileRoute("/stats")({
  loader: () => getDashboard(),
  component: StatsPage,
});

const CHART = {
  primary: "#3d7dff",
  muted: "#8b96a8",
  grid: "#242c3a",
  fg: "#e7ecf3",
  surface: "#141a24",
};

function StatsPage() {
  const initialDash = Route.useLoaderData();
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    initialData: initialDash,
  });

  const occupancy = dash.data
    ? { parked: dash.data.parkedCount, capacity: dash.data.settings.capacity }
    : undefined;

  const rate = dash.data
    ? Math.round((dash.data.parkedCount / dash.data.settings.capacity) * 100)
    : 0;

  return (
    <AppShell occupancy={occupancy}>
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">运营看板</h1>
        <p className="text-sm text-muted">
          {dash.data?.settings.lotName ?? "停车场"} · 今日入场与收费一览
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="当前在场"
          value={dash.isLoading ? null : String(dash.data?.parkedCount ?? 0)}
          hint={dash.data ? `占用 ${rate}%` : undefined}
          icon={Car}
        />
        <StatCard
          label="今日入场"
          value={dash.isLoading ? null : String(dash.data?.todayEntries ?? 0)}
          hint="按入场时间统计"
          icon={LogIn}
        />
        <StatCard
          label="今日实收"
          value={dash.isLoading ? null : formatFee(dash.data?.todayRevenue ?? 0)}
          hint="已结算订单"
          icon={Wallet}
        />
        <StatCard
          label="平均停时"
          value={
            dash.isLoading ? null : formatAvg(dash.data?.avgDurationMinutes ?? 0)
          }
          hint="已出场车辆"
          icon={Clock3}
        />
      </div>

      <Card className="mt-5 rounded-xl">
        <CardHeader>
          <CardTitle>近 7 日入场量</CardTitle>
        </CardHeader>
        <CardContent className="h-72 pt-2">
          {dash.isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dash.data?.last7Days ?? []} barSize={28}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: CHART.muted, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: CHART.muted, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "rgba(61,125,255,0.08)" }}
                  contentStyle={{
                    background: CHART.surface,
                    border: "1px solid #242c3a",
                    borderRadius: 8,
                    color: CHART.fg,
                    fontSize: 12,
                  }}
                  formatter={(value) => [String(value ?? 0), "入场"]}
                />
                <Bar dataKey="entries" fill={CHART.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="mt-5 rounded-xl">
        <CardHeader>
          <CardTitle>计费规则</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-4">
          <Rule label="免费时长" value="15 分钟" />
          <Rule label="首小时" value="¥5.00" />
          <Rule label="续时每小时" value="¥3.00" />
          <Rule label="单日封顶" value="¥40.00" />
        </CardContent>
      </Card>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  hint?: string;
  icon: typeof Car;
}) {
  return (
    <Card className="rounded-xl">
      <CardContent className="flex items-start gap-3 p-4">
        <span className="flex size-9 items-center justify-center rounded-md bg-surface-2 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted">{label}</p>
          {value == null ? (
            <Skeleton className="mt-2 h-6 w-16" />
          ) : (
            <p className="mt-1 font-mono text-xl tabular-nums tracking-tight">{value}</p>
          )}
          {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-mono tabular-nums">{value}</p>
    </div>
  );
}

function formatAvg(minutes: number): string {
  if (minutes < 60) return `${minutes} 分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} 时 ${m} 分` : `${h} 时`;
}
