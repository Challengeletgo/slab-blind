// 슬랩 블라인드 · 사진 자동 인식 (Supabase Edge Function)
// 앞면·뒷면 사진을 받아 Claude에게 라벨과 카드 상태를 읽게 하고 JSON으로 돌려줍니다.
// 필요한 비밀 값: ANTHROPIC_API_KEY  (Supabase → Edge Functions → Secrets)

const MODEL = Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-5-5";
const MAX_B64 = 2_000_000;          // 이미지 한 장당 base64 최대 길이 (~1.5MB)
const PER_IP_PER_HOUR = 20;         // 같은 IP에서 한 시간에 허용하는 인식 횟수

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(), list = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  list.push(now); hits.set(ip, list);
  return list.length > PER_IP_PER_HOUR;
}

const PROMPT = `Image 1 is the FRONT and image 2 is the BACK of one graded trading-card slab (a card sealed in a plastic case with a printed label).
Answer ONLY with JSON, no prose:
{"isSlab":boolean,"company":"PSA"|"CGC"|"BRG"|"BGS"|"SGC"|"TAG"|"OTHER","grade":number|null,"pristine":boolean,"cardName":string,
 "sameSlab":boolean|null,
 "front":{"gradeBox":[x0,y0,x1,y1],"serialBoxes":[[x0,y0,x1,y1]]},
 "back":{"serialBoxes":[[x0,y0,x1,y1]]},
 "condition":{"centering":string,"corners":string,"edges":string,"surface":string,"summary":string},
 "tier":0|1|2,"tierReason":string}
Rules:
- Coordinates are fractions 0-1 of that image's width/height.
- front.gradeBox tightly covers the printed numeric grade AND its word descriptor (e.g. "9" + "MINT", "10" + "GEM MT", "PRISTINE 10").
- serialBoxes cover EVERY certification/serial number, barcode and QR code visible on that side's label.
- sameSlab: true if the certification numbers on front and back match, false if they differ, null if unreadable.
- pristine is true only for a CGC "Pristine 10".
- condition: judge the CARD (not the case) from what is visible: centering (e.g. "좌우 55/45 정도"), corners, edges, surface. Every condition string in Korean, short. summary: one Korean sentence.
- tier: 0 = defects a non-expert can see, or grade 8 or lower. 1 = grade 9-10 where the main question is whether it is a 10. 2 = subtle differences needing close inspection, half grades, or CGC Pristine. tierReason: one short Korean sentence.
- cardName: short English name like "Mew VMAX · 2023 S12a Korean" from the label, or "".
- If the front is not a graded slab, set isSlab false.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "recognition_disabled" }, 503);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (limited(ip)) return json({ error: "rate_limited" }, 429);

    const { front, back } = await req.json();
    if (typeof front !== "string" || typeof back !== "string") return json({ error: "bad_request" }, 400);
    if (front.length > MAX_B64 || back.length > MAX_B64) return json({ error: "too_large" }, 413);

    const img = (data: string) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        messages: [{ role: "user", content: [img(front), img(back), { type: "text", text: PROMPT }] }],
      }),
    });
    if (!r.ok) return json({ error: "upstream", status: r.status, detail: (await r.text()).slice(0, 300) }, 502);
    const out = await r.json();
    const text: string = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return json({ error: "unparseable" }, 502);
    return json(JSON.parse(m[0]));
  } catch (e) {
    return json({ error: "server", detail: String(e).slice(0, 200) }, 500);
  }
});
