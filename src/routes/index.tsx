import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Download,
  FileText,
  ImagePlus,
  Images,
  LoaderCircle,
  LogIn,
  LogOut,
  ScanLine,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PlateBadge } from "@/components/plate-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  isValidPlate,
  normalizePlate,
  type PlateColor,
  type PlateRecord,
} from "@/lib/parking";
import {
  enterVehicle,
  exitVehicle,
  getDashboard,
  recognizePlate,
} from "@/lib/parking.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  loader: () => getDashboard(),
  component: Home,
});

async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法处理图片");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

type RecognizeState = {
  preview: string;
  plate: string;
  confidence: number;
  color: PlateColor;
  alreadyParked: PlateRecord | null;
};

function Home() {
  const initialDash = Route.useLoaderData();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<RecognizeState | null>(null);
  const [manual, setManual] = useState("");
  const [exitTarget, setExitTarget] = useState<PlateRecord | null>(null);

  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    initialData: initialDash,
    refetchInterval: 20_000,
  });

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["records"] });
  }, [queryClient]);

  const recognize = useMutation({
    mutationFn: async (file: File) => {
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
      setResult(null);
      const res = await recognizePlate({ data: { imageDataUrl: dataUrl } });
      return { res, dataUrl };
    },
    onSuccess: ({ res, dataUrl }) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult({
        preview: dataUrl,
        plate: res.plate,
        confidence: res.confidence,
        color: res.color,
        alreadyParked: res.alreadyParked,
      });
      setManual(res.plate);
    },
    onError: () => toast.error("识别失败，请稍后重试"),
  });

  const enter = useMutation({
    mutationFn: async () => {
      const plate = normalizePlate(result?.plate || manual);
      const color = result?.color ?? "blue";
      const confidence = result?.confidence ?? 0.8;
      return enterVehicle({
        data: {
          plate,
          color,
          confidence,
          imageDataUrl: result?.preview ?? preview ?? undefined,
        },
      });
    },
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.record.plateNumber} 已入场`);
      setResult(null);
      setPreview(null);
      setManual("");
      await invalidate();
    },
    onError: () => toast.error("入场失败"),
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
      setResult(null);
      setPreview(null);
      await invalidate();
    },
    onError: () => toast.error("出场失败"),
  });

  const onFiles = (files: FileList | File[] | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }
    recognize.mutate(file);
  };

  const runSample = async () => {
    try {
      const res = await fetch("/samples/demo-plate.jpg");
      const blob = await res.blob();
      const file = new File([blob], "demo-plate.jpg", { type: "image/jpeg" });
      recognize.mutate(file);
    } catch {
      toast.error("示例图片加载失败");
    }
  };

  const occupancy = dash.data
    ? { parked: dash.data.parkedCount, capacity: dash.data.settings.capacity }
    : undefined;

  const canEnter =
    isValidPlate(result?.plate || manual) &&
    !result?.alreadyParked &&
    !enter.isPending;

  return (
    <AppShell occupancy={occupancy}>
      <div className="mb-6 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">项目源码压缩包</p>
            <p className="mt-1 text-xs text-muted">
              含完整源码、使用教程和示例图片（京A66666），约 1 MB。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/downloads/BoshiParking.zip"
              download="BoshiParking.zip"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-fg"
            >
              <Download className="size-4" />
              下载 ZIP
            </a>
            <a
              href="/downloads/使用教程.md"
              download="使用教程.md"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-surface-2 px-4 text-sm font-medium text-fg shadow-[var(--shadow-border)]"
            >
              <FileText className="size-4" />
              使用教程
            </a>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">道闸识别</h1>
        <p className="text-sm text-muted">
          上传车辆照片，识别车牌后确认入场；已在场车辆可直接结算出场。
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="overflow-hidden rounded-xl">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>抓拍识别</CardTitle>
            <Badge variant="primary">摄像头入口</Badge>
          </CardHeader>
          <CardContent className="pt-4">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                onFiles(e.dataTransfer.files);
              }}
              className={cn(
                "hud-corners relative flex min-h-[280px] w-full flex-col items-center justify-center overflow-hidden rounded-lg bg-bg p-4 text-left transition-[box-shadow] duration-150",
                dragOver && "shadow-[0_0_0_1px_var(--color-primary)]",
              )}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="待识别车辆"
                  className="max-h-[320px] w-full rounded-md object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="flex size-12 items-center justify-center rounded-lg bg-surface-2 text-primary">
                    <ImagePlus className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">拖入或选择车辆照片</p>
                    <p className="mt-1 text-xs text-muted">支持 JPG / PNG，建议包含完整车牌</p>
                  </div>
                </div>
              )}
              {recognize.isPending ? (
                <div className="absolute inset-0 overflow-hidden rounded-lg bg-bg/40">
                  <div className="scan-line absolute inset-x-6 top-0 h-px bg-primary shadow-[0_0_16px_var(--color-primary)]" />
                  <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2 text-xs text-primary">
                    <LoaderCircle className="size-3.5 animate-spin" />
                    正在定位车牌并识别字符
                  </div>
                </div>
              ) : null}
            </button>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={recognize.isPending}
              >
                <ScanLine className="size-4" />
                选择图片并识别
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={runSample}
                disabled={recognize.isPending}
              >
                <Images className="size-4" />
                试用示例图片
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>识别结果</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {recognize.isPending ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-11 w-full" />
              </div>
            ) : result ? (
              <>
                <div className="flex justify-center py-2">
                  <PlateBadge plate={result.plate} color={result.color} size="lg" />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md bg-surface-2 p-3">
                    <dt className="text-xs text-muted">置信度</dt>
                    <dd className="mt-1 font-mono tabular-nums">
                      {(result.confidence * 100).toFixed(1)}%
                    </dd>
                  </div>
                  <div className="rounded-md bg-surface-2 p-3">
                    <dt className="text-xs text-muted">状态</dt>
                    <dd className="mt-1">
                      {result.alreadyParked ? (
                        <Badge variant="warn">已在场</Badge>
                      ) : (
                        <Badge variant="success">可入场</Badge>
                      )}
                    </dd>
                  </div>
                </dl>
                {result.alreadyParked ? (
                  <p className="text-sm text-muted">
                    入场于{" "}
                    {new Date(result.alreadyParked.enterTime).toLocaleString("zh-CN", {
                      hour12: false,
                    })}
                    ，已停 {formatDuration(result.alreadyParked.enterTime)}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  {result.alreadyParked ? (
                    <Button
                      className="flex-1"
                      onClick={() => setExitTarget(result.alreadyParked)}
                    >
                      <LogOut className="size-4" />
                      结算出场
                    </Button>
                  ) : (
                    <Button
                      className="flex-1"
                      onClick={() => enter.mutate()}
                      disabled={!canEnter}
                    >
                      {enter.isPending ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <LogIn className="size-4" />
                      )}
                      确认入场
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted">
                  识别完成后会在这里显示车牌。也可以手动输入车牌号入场。
                </p>
                <Input
                  value={manual}
                  onChange={(e) => setManual(normalizePlate(e.target.value))}
                  placeholder="例如 京A66666"
                  maxLength={8}
                  aria-label="手动输入车牌"
                />
                <Button
                  onClick={() => {
                    if (!isValidPlate(manual)) {
                      toast.error("请输入有效的中国车牌号");
                      return;
                    }
                    setResult({
                      preview: preview ?? "",
                      plate: normalizePlate(manual),
                      confidence: 0.8,
                      color: "blue",
                      alreadyParked:
                        dash.data?.parked.find(
                          (r) => r.plateNumber === normalizePlate(manual),
                        ) ?? null,
                    });
                  }}
                  variant="secondary"
                >
                  使用该车牌
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">在场车辆</h2>
            <p className="text-xs text-muted">实时时长按入场时间计算</p>
          </div>
          <Badge>{occupancy ? `${occupancy.parked} 辆` : "…"}</Badge>
        </div>
        {dash.isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : dash.data?.parked.length ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dash.data.parked.map((rec) => (
              <li key={rec.id}>
                <ParkedCard record={rec} onExit={() => setExitTarget(rec)} />
              </li>
            ))}
          </ul>
        ) : (
          <Card className="rounded-xl">
            <CardContent className="py-10 text-center text-sm text-muted">
              当前场内没有车辆
            </CardContent>
          </Card>
        )}
      </section>

      <ExitDialog
        record={exitTarget}
        pending={exitMut.isPending}
        onClose={() => setExitTarget(null)}
        onConfirm={() => exitTarget && exitMut.mutate(exitTarget.id)}
      />
    </AppShell>
  );
}

function ParkedCard({
  record,
  onExit,
}: {
  record: PlateRecord;
  onExit: () => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Card className="rounded-xl">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <PlateBadge plate={record.plateNumber} color={record.plateColor} size="sm" />
          <p className="mt-2 text-xs text-muted">
            已停{" "}
            <span className="font-mono tabular-nums text-fg">
              {formatDuration(record.enterTime)}
            </span>
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onExit}>
          出场
        </Button>
      </CardContent>
    </Card>
  );
}

function ExitDialog({
  record,
  pending,
  onClose,
  onConfirm,
}: {
  record: PlateRecord | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const fee = record
    ? calcParkingFee(record.enterTime, new Date().toISOString())
    : 0;

  return (
    <Dialog open={!!record} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认出场结算</DialogTitle>
          <DialogDescription>
            免费 15 分钟，首小时 ¥5，之后每小时 ¥3，单日封顶 ¥40。
          </DialogDescription>
        </DialogHeader>
        {record ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex justify-center">
              <PlateBadge plate={record.plateNumber} color={record.plateColor} size="md" />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted">停车时长</dt>
                <dd className="mt-1 font-mono tabular-nums">
                  {formatDuration(record.enterTime)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">应收费用</dt>
                <dd className="mt-1 font-mono text-lg tabular-nums">{formatFee(fee)}</dd>
              </div>
            </dl>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={onClose}>
                取消
              </Button>
              <Button className="flex-1" onClick={onConfirm} disabled={pending}>
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
                确认结算
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
