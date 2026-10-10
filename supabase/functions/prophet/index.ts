// 日刊予言者新聞の記事を Claude に書いてもらう Edge Function。
// ブラウザ（GitHub Pages）から呼ばれ、ANTHROPIC_API_KEY はこのサーバー側にだけ置く。
import Anthropic from "npm:@anthropic-ai/sdk@0.128.0";

const MODEL = "claude-opus-5-5";
const MAX_IMAGE_CHARS = 1_500_000; // base64 で約 1.1MB まで

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `あなたは魔法界の新聞「日刊予言者新聞」の記者です。ハリー・ポッターが好きな友達4人が、コスプレをして東京からユニバ（USJ）へ旅をしています。その1日を、号外の記事として日本語で書いてください。

- 4人の思い出になる、笑えて温かい記事にする。誰かを本気でけなしたり、からかいすぎたりしない
- 魔法界の言い回し（ふくろう便、マグル、魔法省、クヌート など）を自然に混ぜる。ただし原作の文章や映画の台詞をそのまま引用しない
- 渡された事実（名前、寮、出来事のキーワード、集めたカード、写真）を必ず記事に織り込む。写真があれば、写っているものを具体的に書く
- 書いていない事実をでっち上げすぎない。盛るのは言い回しと大げさな比喩で
- トーンの指定に従う。大事件＝号外の大騒ぎ、ゴシップ＝噂好き記者の盛った独占記事、魔法省＝お堅い役所の発表文、コレクション号外＝カード図鑑の進み具合が主役
- 長さ：見出し 12〜22字、小見出し 15〜30字、本文は 3 段落で合計 180〜260字、写真説明 20〜40字`;

const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "大見出し" },
    sub: { type: "string", description: "小見出し" },
    body: { type: "array", items: { type: "string" }, description: "本文の段落（3つ）" },
    caption: { type: "string", description: "写真の説明。先頭に ▲ を付ける" },
    weather: { type: "string", description: "魔法界の天気予報（40字以内）" },
    ad: {
      type: "object",
      properties: {
        title: { type: "string", description: "架空の魔法グッズ・店の名前" },
        body: { type: "string", description: "広告文（50字以内）" },
        foot: { type: "string", description: "店の所在地や値段（20字以内）" },
      },
      required: ["title", "body", "foot"],
      additionalProperties: false,
    },
    notice: { type: "string", description: "お知らせ欄の小ネタ（50字以内）" },
  },
  required: ["headline", "sub", "body", "caption", "weather", "ad", "notice"],
  additionalProperties: false,
};

type Input = {
  room?: string;
  tone?: string;
  toneLabel?: string;
  hero?: { name?: string; house?: string };
  players?: { name?: string; house?: string }[];
  keywords?: string[];
  cards?: { n?: number; total?: number; recent?: { name?: string; set?: string; by?: string }[]; sets?: { label?: string; n?: number; total?: number }[] };
  mvp?: string;
  image?: { media_type?: string; data?: string } | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let input: Input;
  try { input = await req.json(); } catch { return json(400, { error: "bad_json" }); }
  const room = String(input.room || "");
  if (room.length < 6 || room.length > 64) return json(400, { error: "bad_room" });

  const facts = {
    トーン: input.toneLabel || input.tone || "大事件",
    主役: input.hero || null,
    メンバー: (input.players || []).slice(0, 6),
    今日の出来事: (input.keywords || []).slice(0, 8).map((k) => String(k).slice(0, 60)),
    カード図鑑: input.cards || null,
    カード集めのMVP: input.mvp || null,
    日付: new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short" }),
  };

  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  const img = input.image;
  const mediaTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
  if (img && img.data && img.data.length <= MAX_IMAGE_CHARS && mediaTypes.includes(img.media_type as typeof mediaTypes[number])) {
    content.push({ type: "image", source: { type: "base64", media_type: img.media_type as typeof mediaTypes[number], data: img.data } });
    content.push({ type: "text", text: "↑ 紙面のメイン写真です。写っているものを記事と写真説明に反映してください。" });
  }
  content.push({ type: "text", text: "次の事実をもとに、号外の記事を書いてください。\n\n" + JSON.stringify(facts, null, 2) });

  const client = new Anthropic(); // ANTHROPIC_API_KEY を環境変数から読む
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (res.stop_reason === "refusal") return json(422, { error: "refused" });
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const article = JSON.parse(text);
    return json(200, { article });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: "rate_limited" });
    if (err instanceof Anthropic.AuthenticationError) return json(500, { error: "bad_api_key" });
    if (err instanceof Anthropic.BadRequestError) return json(400, { error: "bad_request", message: err.message });
    if (err instanceof Anthropic.APIError) return json(502, { error: "upstream", status: err.status });
    if (err instanceof SyntaxError) return json(502, { error: "bad_output" });
    return json(500, { error: "internal" });
  }
});
