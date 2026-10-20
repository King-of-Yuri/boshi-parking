import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PlateBadge } from "@/components/plate-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  calcParkingFee,
  formatDuration,
  formatFee,
  type PlateRecord,
} from "@/lib/parking";
import { exitVehicle, getDashboard, listRecords } from "@/lib/parking.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/records")({
  loader: () => getDashboard(),
  component: RecordsPage,
});

const FILTERS = [
  { id: "all" as const, label: "全部" },
  { id: "parked" as const, label: "在场" },
  { id: "exited" as const, label: "已出场" },
];

function RecordsPage() {
  const initialDash = Route.useLoaderData();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"all" | "parked" | "exited">("all");
  const [q, setQ] = useState("");
  const [exitTarget, setExitTarget] = useState<PlateRecord | null>(null);

  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    initialData: initialDash,
  });

  const records = useQuery({
    queryKey: ["records", status, q],
    queryFn: () => listRecords({ data: { status, q } }),
  });

  const exitMut = useMutation({
    mutationFn: async (id: number) => exitVehicle({ data: { id } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.record.plateNumber} 出场，费用 ${formatFee(res.record.fee)}`);
      setExitTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["records"] });
    },
  });

  const occupancy = dash.data
    ? { parked: dash.data.parkedCount, capacity: dash.data.settings.capacity }
    : undefined;

  const rows = records.data ?? [];
  const parkedCount = useMemo(
    () => rows.filter((r) => !r.exitTime).length,
    [rows],
  );

  return (
    <AppShell occupancy={occupancy}>
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">停车记录</h1>
        <p className="text-sm text-muted">按车牌检索，在场车辆可直接结算出场。</p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value.trim().toUpperCase())}
            placeholder="搜索车牌"
            className="pl-9"
            aria-label="搜索车牌"
          />
        </div>
        <div className="flex rounded-md bg-surface p-1 shadow-[var(--shadow-border)]">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatus(f.id)}
              className={cn(
                "h-9 rounded-sm px-3 text-sm transition-colors duration-150",
                status === f.id ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">车牌</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">入场</th>
                  <th className="px-4 py-3 font-medium">出场</th>
                  <th className="px-4 py-3 font-medium">时长</th>
                  <th className="px-4 py-3 font-medium">费用</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td colSpan={7} className="px-4 py-3">
                          <Skeleton className="h-6 w-full" />
                        </td>
                      </tr>
                    ))
                  : rows.map((row) => {
                      const parked = !row.exitTime;
                      return (
                        <tr key={row.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3">
                            <PlateBadge
                              plate={row.plateNumber}
                              color={row.plateColor}
                              size="sm"
                            />
                          </td>
                          <td className="px-4 py-3">
                            {parked ? (
                              <Badge variant="primary">在场</Badge>
                            ) : (
                              <Badge>已出场</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted">
                            {fmtTime(row.enterTime)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted">
                            {row.exitTime ? fmtTime(row.exitTime) : "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs tabular-nums">
                            {formatDuration(row.enterTime, row.exitTime)}
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums">
                            {parked ? "—" : formatFee(row.fee)}
                          </td>
                          <td className="px-4 py-3">
                            {parked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setExitTarget(row)}
                              >
                                出场
                              </Button>
                            ) : (
                              <span className="text-xs text-subtle">完成</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
          {!records.isLoading && rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">没有匹配的记录</p>
          ) : null}
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted">
        当前筛选 {rows.length} 条
        {status === "all" ? ` · 其中在场 ${parkedCount} 辆` : null}
      </p>

      <Dialog open={!!exitTarget} onOpenChange={(o) => !o && setExitTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认出场结算</DialogTitle>
            <DialogDescription>
              免费 15 分钟，首小时 ¥5，之后每小时 ¥3，单日封顶 ¥40。
            </DialogDescription>
          </DialogHeader>
          {exitTarget ? (
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex justify-center">
                <PlateBadge
                  plate={exitTarget.plateNumber}
                  color={exitTarget.plateColor}
                  size="md"
                />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">停车时长</dt>
                  <dd className="mt-1 font-mono tabular-nums">
                    {formatDuration(exitTarget.enterTime)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">应收费用</dt>
                  <dd className="mt-1 font-mono text-lg tabular-nums">
                    {formatFee(calcParkingFee(exitTarget.enterTime, new Date().toISOString()))}
                  </dd>
                </div>
              </dl>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setExitTarget(null)}
                >
                  取消
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => exitMut.mutate(exitTarget.id)}
                  disabled={exitMut.isPending}
                >
                  {exitMut.isPending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : null}
                  确认结算
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
