export type PlateColor = "blue" | "green" | "yellow" | "white" | "black";

export type PlateRecord = {
  id: number;
  plateNumber: string;
  confidence: number;
  plateColor: PlateColor;
  enterTime: string;
  exitTime: string | null;
  fee: number;
  imageThumb: string | null;
};

export type LotSettings = {
  lotName: string;
  capacity: number;
};

export type DayStat = {
  date: string;
  entries: number;
  revenue: number;
};

export type Dashboard = {
  settings: LotSettings;
  parkedCount: number;
  todayEntries: number;
  todayRevenue: number;
  avgDurationMinutes: number;
  last7Days: DayStat[];
  parked: PlateRecord[];
};

export const FREE_MINUTES = 15;
export const FIRST_HOUR_FEE = 5;
export const EXTRA_HOUR_FEE = 3;
export const DAILY_CAP = 40;

const PLATE_RE =
  /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z][A-Z0-9]{5,6}$/;

export function isValidPlate(plate: string): boolean {
  return PLATE_RE.test(plate.trim().toUpperCase().replace(/\s|·/g, ""));
}

export function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/\s|·/g, "");
}

export function calcParkingFee(enterIso: string, exitIso: string): number {
  const enter = new Date(enterIso).getTime();
  const exit = new Date(exitIso).getTime();
  if (!Number.isFinite(enter) || !Number.isFinite(exit) || exit <= enter) {
    return 0;
  }
  const minutes = (exit - enter) / 60_000;
  if (minutes <= FREE_MINUTES) return 0;
  const hours = Math.ceil(minutes / 60);
  const fee = FIRST_HOUR_FEE + Math.max(0, hours - 1) * EXTRA_HOUR_FEE;
  return Math.min(fee, DAILY_CAP);
}

export function durationMinutes(enterIso: string, exitIso?: string | null): number {
  const end = exitIso ? new Date(exitIso).getTime() : Date.now();
  const start = new Date(enterIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.floor((end - start) / 60_000);
}

export function formatDuration(enterIso: string, exitIso?: string | null): string {
  const minutes = durationMinutes(enterIso, exitIso);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分钟`;
}

export function formatFee(fee: number): string {
  return `¥${fee.toFixed(2)}`;
}

export const PLATE_COLORS: PlateColor[] = [
  "blue",
  "green",
  "yellow",
  "white",
  "black",
];

export function asPlateColor(value: string | null | undefined): PlateColor {
  return PLATE_COLORS.includes(value as PlateColor)
    ? (value as PlateColor)
    : "blue";
}
