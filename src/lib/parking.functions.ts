import { createServerFn } from "@tanstack/react-start";
import {
  asPlateColor,
  calcParkingFee,
  isValidPlate,
  normalizePlate,
  type Dashboard,
  type DayStat,
  type LotSettings,
  type PlateColor,
  type PlateRecord,
} from "@/lib/parking";

type RecordRow = {
  id: number;
  plate_number: string;
  confidence: number;
  plate_color: string;
  enter_time: string;
  exit_time: string | null;
  fee: string | number;
  image_thumb: string | null;
};

function isoFromDb(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

function isoOrNull(value: unknown): string | null {
  if (value == null) return null;
  const iso = isoFromDb(value);
  return iso && iso !== "null" ? iso : null;
}

function mapRecord(row: RecordRow): PlateRecord {
  return {
    id: Number(row.id),
    plateNumber: row.plate_number,
    confidence: Number(row.confidence) || 0,
    plateColor: asPlateColor(row.plate_color),
    enterTime: isoFromDb(row.enter_time),
    exitTime: isoOrNull(row.exit_time),
    fee: Number(row.fee) || 0,
    imageThumb: row.image_thumb,
  };
}

const SELECT_RECORD = `
  id,
  plate_number,
  confidence,
  plate_color,
  enter_time::text as enter_time,
  exit_time::text as exit_time,
  fee::text as fee,
  image_thumb
`;

function shrinkDataUrl(dataUrl: string, maxChars = 120_000): string | null {
  if (!dataUrl.startsWith("data:image/")) return null;
  if (dataUrl.length <= maxChars) return dataUrl;
  return null;
}

export const listRecords = createServerFn({ method: "GET" })
  .validator((input: { status?: "all" | "parked" | "exited"; q?: string } | undefined) => input ?? {})
  .handler(async ({ data }): Promise<PlateRecord[]> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const status = data.status ?? "all";
    const q = (data.q ?? "").trim().toUpperCase();

    let rows: RecordRow[];
    if (status === "parked" && q) {
      rows = await sql.query<RecordRow>(
        `select ${SELECT_RECORD} from plate_records
         where exit_time is null and plate_number like $1
         order by enter_time desc`,
        [`%${q}%`],
      );
    } else if (status === "exited" && q) {
      rows = await sql.query<RecordRow>(
        `select ${SELECT_RECORD} from plate_records
         where exit_time is not null and plate_number like $1
         order by enter_time desc`,
        [`%${q}%`],
      );
    } else if (status === "parked") {
      rows = await sql.query<RecordRow>(
        `select ${SELECT_RECORD} from plate_records
         where exit_time is null
         order by enter_time desc`,
      );
    } else if (status === "exited") {
      rows = await sql.query<RecordRow>(
        `select ${SELECT_RECORD} from plate_records
         where exit_time is not null
         order by enter_time desc`,
      );
    } else if (q) {
      rows = await sql.query<RecordRow>(
        `select ${SELECT_RECORD} from plate_records
         where plate_number like $1
         order by enter_time desc`,
        [`%${q}%`],
      );
    } else {
      rows = await sql.query<RecordRow>(
        `select ${SELECT_RECORD} from plate_records
         order by enter_time desc
         limit 200`,
      );
    }
    return rows.map(mapRecord);
  });

export const getDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<Dashboard> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();

    const settingsRows = await sql.query<LotSettings & { lot_name: string }>(
      `select lot_name, capacity from lot_settings where id = 1`,
    );
    const settings: LotSettings = {
      lotName: settingsRows[0]?.lot_name ?? "泊识示范停车场",
      capacity: Number(settingsRows[0]?.capacity) || 80,
    };

    const parkedRows = await sql.query<RecordRow>(
      `select ${SELECT_RECORD} from plate_records
       where exit_time is null
       order by enter_time desc`,
    );

    const today = await sql.query<{ entries: number; revenue: string | number }>(
      `select
         count(*)::int as entries,
         coalesce(sum(case when exit_time is not null then fee else 0 end), 0)::text as revenue
       from plate_records
       where enter_time >= date_trunc('day', now())`,
    );

    const avg = await sql.query<{ avg_min: string | number | null }>(
      `select avg(extract(epoch from (exit_time - enter_time)) / 60)::text as avg_min
       from plate_records
       where exit_time is not null`,
    );

    const days = await sql.query<{
      day: string;
      entries: number;
      revenue: string | number;
    }>(
      `select
         to_char(d, 'MM-DD') as day,
         count(r.id)::int as entries,
         coalesce(sum(case when r.exit_time is not null then r.fee else 0 end), 0)::text as revenue
       from generate_series(date_trunc('day', now()) - interval '6 days', date_trunc('day', now()), interval '1 day') as d
       left join plate_records r
         on r.enter_time >= d and r.enter_time < d + interval '1 day'
       group by d
       order by d`,
    );

    const last7Days: DayStat[] = days.map((row) => ({
      date: row.day,
      entries: Number(row.entries) || 0,
      revenue: Number(row.revenue) || 0,
    }));

    return {
      settings,
      parkedCount: parkedRows.length,
      todayEntries: Number(today[0]?.entries) || 0,
      todayRevenue: Number(today[0]?.revenue) || 0,
      avgDurationMinutes: Math.round(Number(avg[0]?.avg_min) || 0),
      last7Days,
      parked: parkedRows.map(mapRecord),
    };
  },
);

type RecognizeOk = {
  ok: true;
  plate: string;
  confidence: number;
  color: PlateColor;
  alreadyParked: PlateRecord | null;
};

type RecognizeErr = { ok: false; error: string };

export const recognizePlate = createServerFn({ method: "POST" })
  .validator((input: { imageDataUrl: string }) => input)
  .handler(async ({ data }): Promise<RecognizeOk | RecognizeErr> => {
    const imageDataUrl = data.imageDataUrl ?? "";
    if (!imageDataUrl.startsWith("data:image/")) {
      return { ok: false, error: "请上传 JPG 或 PNG 车辆图片" };
    }
    if (imageDataUrl.length > 1_600_000) {
      return { ok: false, error: "图片过大，请换一张更小的照片" };
    }

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "识别服务暂不可用" };
    }

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 220,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are a Chinese vehicle license-plate OCR engine at a parking barrier. Read the plate exactly. Never invent characters. Reply with JSON only.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageDataUrl, detail: "high" },
              },
              {
                type: "text",
                text: `Read the Chinese license plate in this photo.
Return ONLY JSON:
{"plate":"京A12345" or null,"confidence":0.0-1.0,"color":"blue"|"green"|"yellow"|"white"|"black"|"unknown"}
Rules:
- plate uses a province abbreviation (京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼) + letter + 5 or 6 alphanumerics
- standard blue plates are 7 chars; new-energy green plates are 8
- do not invent a plate if you cannot read it clearly
- ignore watermarks and website URLs`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[recognize] xAI error", res.status, detail.slice(0, 400));
      return { ok: false, error: `识别服务异常（${res.status}）` };
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    let parsed: { plate?: string | null; confidence?: number; color?: string };
    try {
      parsed = extractJson(text) as typeof parsed;
    } catch {
      console.error("[recognize] bad JSON", text.slice(0, 400));
      return { ok: false, error: "未能解析识别结果，请换一张更清晰的照片" };
    }

    const plate = normalizePlate(String(parsed.plate ?? ""));
    if (!plate || !isValidPlate(plate)) {
      return { ok: false, error: "未检测到有效车牌，请换一张包含车牌的车辆照片" };
    }

    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const open = await sql.query<RecordRow>(
      `select ${SELECT_RECORD} from plate_records
       where plate_number = $1 and exit_time is null
       limit 1`,
      [plate],
    );

    return {
      ok: true,
      plate,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.9)),
      color: asPlateColor(parsed.color),
      alreadyParked: open[0] ? mapRecord(open[0]) : null,
    };
  });

export const enterVehicle = createServerFn({ method: "POST" })
  .validator(
    (input: {
      plate: string;
      confidence: number;
      color: PlateColor;
      imageDataUrl?: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<{ ok: true; record: PlateRecord } | RecognizeErr> => {
    const plate = normalizePlate(data.plate);
    if (!isValidPlate(plate)) {
      return { ok: false, error: "车牌号格式不正确" };
    }

    const { getSql } = await import("@/lib/db");
    const sql = await getSql();

    const settings = await sql.query<{ capacity: number }>(
      `select capacity from lot_settings where id = 1`,
    );
    const capacity = Number(settings[0]?.capacity) || 80;
    const parked = await sql.query<{ n: number }>(
      `select count(*)::int as n from plate_records where exit_time is null`,
    );
    if ((parked[0]?.n ?? 0) >= capacity) {
      return { ok: false, error: "车位已满，暂不能入场" };
    }

    const open = await sql.query<RecordRow>(
      `select ${SELECT_RECORD} from plate_records
       where plate_number = $1 and exit_time is null
       limit 1`,
      [plate],
    );
    if (open[0]) {
      return { ok: false, error: `${plate} 已在场内，请先做出场结算` };
    }

    const thumb = data.imageDataUrl ? shrinkDataUrl(data.imageDataUrl) : null;
    const inserted = await sql.query<RecordRow>(
      `insert into plate_records (plate_number, confidence, plate_color, image_thumb)
       values ($1, $2, $3, $4)
       returning ${SELECT_RECORD}`,
      [plate, data.confidence, asPlateColor(data.color), thumb],
    );
    return { ok: true, record: mapRecord(inserted[0]) };
  });

export const exitVehicle = createServerFn({ method: "POST" })
  .validator((input: { id: number }) => input)
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; record: PlateRecord } | RecognizeErr> => {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      const open = await sql.query<RecordRow>(
        `select ${SELECT_RECORD} from plate_records
         where id = $1 and exit_time is null
         limit 1`,
        [data.id],
      );
      if (!open[0]) {
        return { ok: false, error: "未找到在场记录，可能已经出场" };
      }
      const record = mapRecord(open[0]);
      const exitIso = new Date().toISOString();
      const fee = calcParkingFee(record.enterTime, exitIso);
      const updated = await sql.query<RecordRow>(
        `update plate_records
         set exit_time = now(), fee = $2
         where id = $1 and exit_time is null
         returning ${SELECT_RECORD}`,
        [data.id, fee],
      );
      if (!updated[0]) {
        return { ok: false, error: "出场失败，请重试" };
      }
      return { ok: true, record: mapRecord(updated[0]) };
    },
  );

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(raw.slice(start, end + 1));
}
