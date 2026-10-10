/* 飲みゲーム — 1 台のスマホを 4 人で囲んで遊ぶ
 *
 * 状態: HP.state.games = {
 *   mode: "drink" | "soft",
 *   cats: { categoryId: boolean },          // トークルーレットのカテゴリ ON/OFF
 *   custom: { talk: [], ng: [], match: [], pick: [] },  // 自分たちで追加したお題
 *   ng: { words: { playerId: word }, phase: "idle"|"pass"|"play", step, outs: { playerId: n } }
 * }
 */
(function () {
  "use strict";
  const h = (...a) => HP.h(...a);

  /* ---------- データ ---------- */
  const CATS = [
    { id: "yuru", jp: "ゆるい", list: [
      "最近ハマってる食べ物の話", "休みの日の過ごし方", "最近買ってよかったもの", "子どもの頃の夢",
      "好きなコンビニスイーツ", "一番好きな季節とその理由", "最近笑った話", "いつか行ってみたい国",
      "朝のルーティン", "無人島に1つ持っていくなら", "最近見た変な夢", "地元の自慢",
    ] },
    { id: "love", jp: "恋愛", list: [
      "初恋の話", "理想のデートプラン", "好きなタイプ（芸能人で例えると）", "告白した・された話",
      "恋人にされて嬉しかったこと", "一番キュンとした瞬間", "恋愛でやらかした話", "結婚するならどんな人",
      "付き合う前に必ずチェックすること", "忘れられない元恋人のクセ（名前は伏せてOK）",
      "好きな人へのLINEで悩んだ話", "恋愛映画・ドラマで好きなシーン",
    ] },
    { id: "kuro", jp: "黒歴史", list: [
      "最近やらかした話", "中学時代の黒歴史", "昔のSNSで消したい投稿", "人生で一番恥ずかしかった瞬間",
      "盛大に勘違いしてた話", "寝坊・遅刻の最高記録", "昔ハマってた痛い趣味", "はしゃぎすぎてやらかした話",
      "人の名前を間違えた話", "学校で怒られた一番の思い出", "ダサかった昔のファッション", "送信ミスしたLINE",
    ] },
    { id: "moshi", jp: "もしも", list: [
      "もし魔法が1つ使えたら", "もし1億円当たったら", "もし1日だけ透明人間になれたら", "もし動物に生まれ変わるなら",
      "もし過去に戻れるなら何歳に？", "もし明日世界が終わるなら", "もしこの4人でバンドを組むなら担当は？",
      "もし芸能人になるなら何の仕事？", "もし1日だけ誰かと入れ替われたら", "もし住む場所を自由に選べたら",
      "もし1つだけ才能をもらえるなら", "もし自分の映画が作られたらタイトルは？",
    ] },
    { id: "hp", jp: "ハリポタ", list: [
      "ハリポタで一番好きなシーン（観てない人は想像で）", "自分が入りたい寮とその理由", "自分の守護霊は何の動物っぽい？",
      "一番使いたい呪文", "このメンバーを登場人物に例えると", "欲しい魔法グッズ", "ホグワーツで受けたい授業",
      "百味ビーンズで引きたくない味", "ダンブルドアに相談したいこと", "今日のコスプレのこだわりポイント",
      "ユニバで一番楽しみなこと", "組分け帽子に言われそうなひとこと",
    ] },
    { id: "bakuro", jp: "暴露", list: [
      "このメンバーの第一印象", "人生で一番高い買い物", "スマホの中で一番見られたくないもの", "最近ついた小さなウソ",
      "メンバーの尊敬してるところ", "実はずっと苦手なもの", "内緒にしてた特技", "最近検索したちょっと恥ずかしいワード",
      "正直この旅行で一番楽しみなこと", "メンバーに言えてなかった感謝", "最近一番お金を使ったもの", "自分の直したいところ",
    ] },
  ];
  const CUSTOM_CAT = { id: "custom", jp: "自分たち" };

  const NG_WORDS = [
    "やばい", "たしかに", "え？", "ユニバ", "魔法", "かわいい", "まじで", "なるほど", "写真", "ハリー",
    "ちょっと", "ねえ", "待って", "すごい", "おいしい", "疲れた", "ほんとに", "行こう", "杖", "わかる",
    "楽しい", "それな", "いいね", "眠い", "ありがとう", "天才", "飲む", "うそ", "えー", "ガチ",
  ];

  const MATCH_TOPICS = [
    "ハリポタの登場人物といえば？", "コンビニで最初に買うものは？", "赤い食べ物といえば？", "ユニバのアトラクションといえば？",
    "夏といえば？", "魔法の呪文といえば？", "朝ごはんといえば？", "旅行の必需品といえば？", "好きなおにぎりの具は？",
    "動物園で最初に見たい動物は？", "寿司ネタといえば？", "白いものといえば？", "大阪といえば？",
    "新幹線で食べるものといえば？", "果物といえば？", "ホグワーツの寮といえば？", "丸いものといえば？",
    "学校の教科といえば？", "鍋の具といえば？", "ラーメンの味といえば？", "色といえば？", "お菓子といえば？",
    "冬といえば？", "アイスの味といえば？", "魔法動物といえば？", "カラオケの1曲目といえば？", "推しの寮カラーといえば？",
    "朝起きて最初にすることは？", "スポーツといえば？", "おでんの具といえば？",
  ];

  const PICK_PURPOSES = [
    "次に飲む人", "乾杯の音頭", "お題を決める人", "水を注ぐ人",
    "写真係", "王様・命令1つ", "次のゲーム決め", "決めポーズ係",
  ];

  const PEN = {
    drink: [
      "一口飲む", "指名した1人と乾杯して一口", "一口飲んで、水も一口", "両隣と乾杯して一口",
      "決めゼリフを言ってから一口", "好きな呪文を唱えてから一口",
    ],
    soft: [
      "変顔で1枚撮られる", "決めポーズで1枚撮られる", "モノマネを1つ披露", "次のターンまで語尾が「〜でござる」",
      "全員からひとことずつイジられる", "好きな呪文を小声で全力で唱える", "ソフドリを一口・感想を食レポ風に",
    ],
  };
  const MT = {
    pace: {
      drink: "一口ルール・一気はなし。1杯ごとに水も飲もう",
      soft: "新幹線ではソフドリで。声は控えめに",
    },
    cheers: { drink: "全員で乾杯！🍻", soft: "全員でソフドリ乾杯！🥤" },
  };

  const GAMES = [
    { id: "talk", ico: "🎰", title: "〇〇の話をしないといけない", sub: "トークルーレット・30秒しゃべり切れ", main: true },
    { id: "ng", ico: "🤐", title: "NGワード", sub: "名前を言ってはいけないあの言葉" },
    { id: "match", ico: "🙌", title: "せーので一致", sub: "1人だけズレたら罰" },
    { id: "pick", ico: "🎯", title: "指名ルーレット", sub: "次に飲む人・乾杯の音頭を決める", wide: true },
  ];

  /* ---------- 状態 ---------- */
  function G() {
    let g = HP.state.games;
    if (!g || typeof g !== "object") g = HP.state.games = {};
    if (g.mode !== "drink" && g.mode !== "soft") g.mode = "soft";
    if (!g.cats || typeof g.cats !== "object") g.cats = {};
    CATS.concat(CUSTOM_CAT).forEach((c) => { if (typeof g.cats[c.id] !== "boolean") g.cats[c.id] = true; });
    if (!g.custom || typeof g.custom !== "object") g.custom = {};
    ["talk", "ng", "match", "pick"].forEach((k) => { if (!Array.isArray(g.custom[k])) g.custom[k] = []; });
    if (!g.ng || typeof g.ng !== "object") g.ng = {};
    if (!g.ng.words || typeof g.ng.words !== "object") g.ng.words = {};
    if (!g.ng.outs || typeof g.ng.outs !== "object") g.ng.outs = {};
    if (!["idle", "pass", "play"].includes(g.ng.phase)) g.ng.phase = "idle";
    if (typeof g.ng.step !== "number") g.ng.step = 0;
    return g;
  }

  function players() {
    const src = Array.isArray(HP.state.players) ? HP.state.players : [];
    const n = Math.max(4, src.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = src[i] || {};
      out.push({ id: p.id || "p" + (i + 1), name: String(p.name || "").trim() || (i + 1) + "人目", house: p.house || null });
    }
    return out;
  }
  function houseColor(house) { const x = HP.HOUSES && HP.HOUSES[house]; return x ? x.color : "var(--gold)"; }

  const rand = (n) => Math.floor(Math.random() * n);
  const pickOne = (arr) => arr[rand(arr.length)];
  const RM = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

  /* 画面を切り替えたら止めるタイマー */
  const timers = new Set();
  function later(fn, ms) { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; }
  function every(fn, ms) { const t = setInterval(fn, ms); timers.add(t); return t; }
  function stopAll() { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers.clear(); }
  function stop(t) { clearTimeout(t); clearInterval(t); timers.delete(t); }

  /* ---------- CSS ---------- */
  const CSS = `
.gm { display: grid; grid-template-columns: minmax(0,1fr); gap: 14px; min-width: 0; }
.gm > *, .gm-p > * { min-width: 0; max-width: 100%; }
.gm-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.gm-title { margin: 0; min-width: 0; font-size: 24px; color: var(--gold); line-height: 1.3; }
.gm-lead { margin: 0; min-width: 0; font-size: 13px; }
.gm-mode { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 4px; padding: 4px;
  border: 1px solid var(--line); border-radius: 999px; background: var(--night-2); }
.gm-mode button { min-width: 0; min-height: 44px; border: 0; border-radius: 999px; background: transparent;
  color: var(--ink-dim); font-weight: 700; font-size: 15px; white-space: nowrap; cursor: pointer;
  overflow: hidden; text-overflow: ellipsis; padding: 0 8px; }
.gm-mode button[aria-pressed="true"] { background: var(--gold); color: var(--parch-ink); box-shadow: 0 0 14px rgba(217,180,90,.45); }
.gm-pace { margin: -6px 0 0; font-size: 12px; color: var(--ink-dim); text-align: center; line-height: 1.5; }

.gm-cards { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 10px; }
.gm-card { position: relative; min-width: 0; min-height: 44px; display: grid; gap: 4px; align-content: start;
  padding: 14px 12px; text-align: left; cursor: pointer; border-radius: var(--radius);
  background: var(--night-2); border: 1px solid var(--line); color: var(--ink);
  transition: transform .15s ease, border-color .15s ease; }
.gm-card.is-wide { grid-column: 1 / -1; }
.gm-card:active { transform: scale(.98); }
.gm-card.is-main { grid-column: 1 / -1; padding: 18px 16px; background: var(--parch); color: var(--parch-ink);
  border-color: transparent; box-shadow: 0 10px 30px rgba(0,0,0,.35), inset 0 0 40px rgba(120,85,30,.18); }
.gm-card-ico { font-size: 26px; line-height: 1; }
.gm-card-t { min-width: 0; font-family: var(--font-display); font-weight: 800; font-size: 16px; line-height: 1.35; overflow-wrap: anywhere; }
.gm-card.is-main .gm-card-t { font-size: 20px; }
.gm-card-s { min-width: 0; font-size: 12px; line-height: 1.5; color: var(--ink-dim); }
.gm-card.is-main .gm-card-s { color: var(--parch-dim); font-size: 13px; }
.gm-badge { display: inline-block; flex-shrink: 0; white-space: nowrap; justify-self: start; padding: 1px 10px;
  border-radius: 999px; font-size: 12px; font-weight: 700; background: var(--gry); color: var(--gry-2); }

.gm-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gm-bar .btn { min-height: 44px; padding: 8px 14px; }
.gm-bar-t { flex: 1 1 0; min-width: 0; margin: 0; font-size: 18px; line-height: 1.4; color: var(--gold); overflow-wrap: anywhere; }

.gm-p { display: grid; grid-template-columns: minmax(0,1fr); gap: 14px; min-width: 0; }
.gm-p .btn.ghost { color: var(--parch-ink); border-color: var(--gold-deep); }
.gm-p .btn.big { width: 100%; min-height: 54px; font-size: 18px; }
.gm-lbl { margin: 0 0 4px; font-size: 12px; font-weight: 700; color: var(--parch-dim); letter-spacing: .08em; }
.gm-note { margin: 0; font-size: 13px; color: var(--parch-dim); line-height: 1.6; }

.gm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.gm-chip { flex-shrink: 0; white-space: nowrap; min-height: 44px; padding: 6px 14px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--gold-deep); background: transparent; color: var(--parch-dim); font-size: 14px; font-weight: 700; }
.gm-chip[aria-pressed="true"] { background: var(--parch-ink); color: var(--gold); border-color: var(--parch-ink); }
.gm-grid2 { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
.gm-grid2 .gm-chip { min-width: 0; white-space: normal; line-height: 1.35; padding: 6px 10px; font-size: 13px; overflow-wrap: anywhere; }
.gm-chip small { font-size: 12px; opacity: .75; margin-left: 4px; }

/* スロット */
.gm-slot { --H: 96px; position: relative; height: var(--H); overflow: hidden; border-radius: 12px; max-width: 100%;
  background: linear-gradient(#1a1b2b, #262842 50%, #1a1b2b); color: var(--ink);
  border: 2px solid var(--gold-deep); box-shadow: inset 0 10px 14px -8px #000, inset 0 -10px 14px -8px #000; }
.gm-slot.sm { --H: 56px; }
.gm-slot::after { content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: 10px;
  background: linear-gradient(rgba(18,19,31,.7), transparent 28%, transparent 72%, rgba(18,19,31,.7)); }
.gm-slot.is-spin { animation: gm-glow .5s ease-in-out infinite alternate; }
.gm-slot.is-hit { animation: gm-hit .6s ease-out 1; border-color: var(--gold); }
.gm-reel { will-change: transform; }
.gm-item { height: var(--H); display: flex; align-items: center; justify-content: center; padding: 0 14px; text-align: center; }
.gm-item > span { min-width: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  font-family: var(--font-display); font-weight: 800; font-size: 18px; line-height: 1.35; overflow-wrap: anywhere; }
.gm-slot.sm .gm-item > span { font-size: 20px; -webkit-line-clamp: 1; }
.gm-item.is-ph > span { color: var(--ink-dim); font-size: 16px; }
@keyframes gm-glow { from { box-shadow: 0 0 6px var(--gold-deep), inset 0 10px 14px -8px #000; } to { box-shadow: 0 0 22px var(--gold), inset 0 10px 14px -8px #000; } }
@keyframes gm-hit { 0% { transform: scale(1); } 35% { transform: scale(1.04); box-shadow: 0 0 30px var(--gold); } 100% { transform: scale(1); } }
.gm-catb { display: inline-block; flex-shrink: 0; white-space: nowrap; padding: 1px 10px; border-radius: 999px; font-size: 12px;
  font-weight: 700; background: var(--parch-ink); color: var(--gold); }

/* タイマー */
.gm-timer { display: flex; align-items: center; gap: 14px; }
.gm-ring { --p: 1; flex-shrink: 0; width: 80px; height: 80px; max-width: 100%; border-radius: 50%; display: grid; place-items: center;
  background: conic-gradient(var(--gold-deep) calc(var(--p) * 360deg), rgba(43,33,22,.15) 0); position: relative; }
.gm-ring::before { content: ""; position: absolute; inset: 7px; border-radius: 50%; background: var(--parch); }
.gm-ring b { position: relative; white-space: nowrap; font-family: var(--font-display); font-size: 28px; line-height: 1; font-variant-numeric: tabular-nums; }
.gm-ring.is-hurry { background: conic-gradient(var(--gry) calc(var(--p) * 360deg), rgba(43,33,22,.15) 0); animation: gm-beat .5s ease-in-out infinite alternate; }
.gm-ring.is-hurry b { color: var(--gry); }
@keyframes gm-beat { to { transform: scale(1.07); } }
.gm-tside { flex: 1 1 0; min-width: 0; display: grid; gap: 8px; }
.gm-tmsg { margin: 0; min-width: 0; font-weight: 700; line-height: 1.5; }
.gm-btns { display: flex; flex-wrap: wrap; gap: 8px; }

/* 罰 */
.gm-pen { display: grid; gap: 6px; padding: 14px; border-radius: 12px; background: var(--parch-ink); color: var(--parch);
  animation: gm-drop .45s cubic-bezier(.2,1.4,.4,1) 1; }
.gm-pen-lead { margin: 0; min-width: 0; font-size: 13px; color: var(--ink-dim); }
.gm-pen-t { margin: 0; min-width: 0; font-family: var(--font-display); font-weight: 800; font-size: 20px; line-height: 1.4; color: var(--gold); overflow-wrap: anywhere; }
.gm-pen .btn.ghost { color: var(--gold); border-color: var(--gold); justify-self: start; }
.gm-pen.is-good { background: var(--sly); }
.gm-pen.is-good .gm-pen-t { color: var(--parch); }
@keyframes gm-drop { from { transform: translateY(-10px) scale(.96); opacity: 0; } to { transform: none; opacity: 1; } }

/* NG ワード */
.gm-cover { display: grid; gap: 10px; justify-items: center; text-align: center; padding: 18px 8px; border-radius: 12px;
  border: 2px dashed var(--gold-deep); }
.gm-cover-ico { font-size: 40px; line-height: 1; }
.gm-cover-t { margin: 0; min-width: 0; max-width: 100%; font-family: var(--font-display); font-weight: 800; font-size: 20px; line-height: 1.4; overflow-wrap: anywhere; }
.gm-rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.gm-row { display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 6px 10px; border-radius: 10px;
  background: rgba(43,33,22,.07); border-left: 4px solid var(--c, var(--gold)); }
.gm-row-n { flex: 1 1 0; min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gm-word { flex-shrink: 0; white-space: nowrap; max-width: 60%; overflow: hidden; text-overflow: ellipsis; padding: 4px 12px;
  border-radius: 999px; background: var(--parch-ink); color: var(--gold); font-family: var(--font-display); font-weight: 800; font-size: 18px; }
.gm-word.is-secret { background: transparent; color: var(--parch-dim); border: 1px dashed var(--parch-dim); font-family: var(--font-body); font-size: 14px; }
.gm-outs { flex-shrink: 0; white-space: nowrap; font-size: 12px; font-weight: 700; color: var(--parch-dim); }
.gm-row .btn { flex-shrink: 0; min-height: 44px; padding: 6px 14px; }
.gm-steps { display: flex; gap: 6px; justify-content: center; }
.gm-dot { flex-shrink: 0; width: 10px; height: 10px; border-radius: 50%; background: rgba(43,33,22,.2); }
.gm-dot.is-on { background: var(--gold-deep); }

/* せーので一致 */
.gm-topic { margin: 0; min-width: 0; text-align: center; font-family: var(--font-display); font-weight: 800; font-size: 24px;
  line-height: 1.4; text-wrap: balance; overflow-wrap: anywhere; padding: 10px 4px; }
.gm-count { display: grid; place-items: center; height: 96px; }
.gm-count b { font-family: var(--font-display); font-size: 56px; line-height: 1; color: var(--gry); white-space: nowrap;
  animation: gm-pop .6s cubic-bezier(.2,1.6,.4,1) 1; }
@keyframes gm-pop { from { transform: scale(.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.gm-who { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 8px; }
.gm-who .btn { min-width: 0; width: 100%; overflow: hidden; text-overflow: ellipsis; }

/* 指名ルーレット */
.gm-wheel { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 10px; }
.gm-tile { --c: var(--gold); min-width: 0; min-height: 88px; display: grid; place-items: center; gap: 4px; padding: 10px 4px;
  border-radius: 14px; text-align: center; background: var(--night-2); color: var(--ink); border: 2px solid rgba(217,180,90,.25);
  transition: box-shadow .12s ease, transform .12s ease, background .12s ease; }
.gm-tile-n { min-width: 0; max-width: 100%; font-weight: 700; font-size: 17px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gm-tile .house-chip { display: block; max-width: 100%; padding: 2px 6px; overflow: hidden; text-overflow: ellipsis; }
.gm-tile.is-lit { border-color: var(--c); box-shadow: 0 0 0 2px var(--c), 0 0 26px var(--c); transform: scale(1.03);
  background: color-mix(in srgb, var(--c) 35%, var(--night-2)); }
.gm-tile.is-win { border-color: var(--c); background: color-mix(in srgb, var(--c) 55%, var(--night-2));
  animation: gm-win .8s ease-in-out infinite alternate; }
@keyframes gm-win { from { box-shadow: 0 0 0 2px var(--c), 0 0 10px var(--c); } to { box-shadow: 0 0 0 3px var(--c), 0 0 36px var(--c); transform: scale(1.04); } }
.gm-result { margin: 0; min-width: 0; text-align: center; font-family: var(--font-display); font-weight: 800; font-size: 20px; line-height: 1.5; overflow-wrap: anywhere; }

/* 自分たちで追加 */
.gm-custom { border: 1px solid var(--line); border-radius: var(--radius); background: var(--night-2); }
.gm-custom > summary { list-style: none; display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 8px 14px;
  cursor: pointer; color: var(--gold); font-weight: 700; }
.gm-custom > summary::-webkit-details-marker { display: none; }
.gm-custom > summary span { min-width: 0; }
.gm-custom > summary::after { content: "▾"; margin-left: auto; flex-shrink: 0; transition: transform .15s; }
.gm-custom[open] > summary::after { transform: rotate(180deg); }
.gm-cbody { display: grid; grid-template-columns: minmax(0,1fr); gap: 10px; padding: 0 14px 14px; }
.gm-add { display: flex; gap: 8px; }
.gm-input { flex: 1 1 0; min-width: 0; max-width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 10px;
  border: 1px solid var(--line); background: var(--night); color: var(--ink); font: inherit; font-size: 16px; }
.gm-input::placeholder { color: var(--ink-dim); opacity: .8; }
.gm-clist { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.gm-citem { display: flex; align-items: center; gap: 8px; padding: 4px 4px 4px 12px; border-radius: 10px; background: rgba(255,255,255,.04); }
.gm-ctext { flex: 1 1 0; min-width: 0; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
.gm-del { flex-shrink: 0; white-space: nowrap; min-height: 44px; min-width: 56px; padding: 0 12px; border-radius: 999px;
  border: 1px solid rgba(227,177,74,.4); background: transparent; color: var(--ink-dim); font-size: 13px; cursor: pointer; }
.gm-empty { font-size: 13px; color: var(--ink-dim); }

@media (prefers-reduced-motion: reduce) {
  .gm-slot.is-spin, .gm-slot.is-hit, .gm-ring.is-hurry, .gm-tile.is-win, .gm-pen, .gm-count b { animation: none !important; }
  .gm-reel, .gm-tile, .gm-card { transition: none !important; }
}
`;
  function injectCSS() {
    if (document.getElementById("gm-style")) return;
    document.head.appendChild(h("style", { id: "gm-style" }, CSS));
  }

  /* ---------- 共通部品 ---------- */
  let rootEl = null;
  let cur = null;     // 開いているゲーム id（null で一覧）
  let bodyEl = null;

  function mode() { return G().mode; }
  function penText() { return pickOne(PEN[mode()]); }

  /* 罰カード。モードを切り替えると中身も入れ替わる */
  function penaltyBox(lead) {
    const t = h("p", { class: "gm-pen-t", "data-pen": "1" }, penText());
    return h("div", { class: "gm-pen", role: "status" },
      h("p", { class: "gm-pen-lead" }, lead),
      t,
      h("button", { type: "button", class: "btn ghost", onclick: () => { t.textContent = penText(); } }, "別の罰にする"));
  }
  function goodBox(lead, text, key) {
    return h("div", { class: "gm-pen is-good", role: "status" },
      h("p", { class: "gm-pen-lead", style: { color: "var(--sly-2)" } }, lead),
      h("p", { class: "gm-pen-t", "data-mt": key || null }, key ? MT[key][mode()] : text));
  }

  function customEditor(key, placeholder, onChange) {
    const list = () => G().custom[key];
    const sumText = h("span", null);
    const input = h("input", { type: "text", class: "gm-input", maxlength: "60", placeholder, enterkeyhint: "done", "aria-label": "追加するお題" });
    const ul = h("ul", { class: "gm-clist" });
    function draw() {
      sumText.textContent = "＋お題を追加（" + list().length + "）";
      if (!list().length) { ul.replaceChildren(h("li", { class: "gm-empty" }, "まだありません。追加したお題はこのスマホに保存されます")); return; }
      ul.replaceChildren(...list().map((t, i) => h("li", { class: "gm-citem" },
        h("span", { class: "gm-ctext" }, t),
        h("button", { type: "button", class: "gm-del", "aria-label": "「" + t + "」を削除", onclick: () => {
          list().splice(i, 1); HP.save(); draw(); if (onChange) onChange(); HP.toast("削除しました");
        } }, "削除"))));
    }
    const form = h("form", { class: "gm-add", onsubmit: (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      if (list().includes(v)) { HP.toast("同じお題があります"); return; }
      list().push(v); HP.save(); input.value = ""; draw(); if (onChange) onChange();
      HP.toast("追加しました");
    } }, input, h("button", { type: "submit", class: "btn" }, "追加"));
    draw();
    return h("details", { class: "gm-custom" }, h("summary", null, sumText), h("div", { class: "gm-cbody" }, form, ul));
  }

  /* リールを回して final で止める。H は 1 コマの高さ(px) */
  function spinReel(slot, reel, pool, final, H, dur, done) {
    const mk = (t) => h("div", { class: "gm-item" }, h("span", null, t));
    slot.classList.remove("is-hit");
    if (RM()) {
      reel.style.transition = "none"; reel.style.transform = "translateY(0)";
      reel.replaceChildren(mk(final));
      slot.classList.add("is-hit"); done(); return;
    }
    const seq = [];
    const first = reel.lastElementChild ? reel.lastElementChild.textContent : "？";
    seq.push(first);
    for (let i = 0; i < 16; i++) seq.push(pickOne(pool));
    seq.push(final);
    reel.style.transition = "none";
    reel.style.transform = "translateY(0)";
    reel.replaceChildren(...seq.map(mk));
    void reel.offsetHeight;
    slot.classList.add("is-spin");
    reel.style.transition = "transform " + dur + "ms cubic-bezier(.12,.72,.18,1)";
    reel.style.transform = "translateY(" + (-(seq.length - 1) * H) + "px)";
    later(() => {
      slot.classList.remove("is-spin"); slot.classList.add("is-hit");
      // 止まったら 1 コマだけ残して軽くする
      reel.style.transition = "none"; reel.style.transform = "translateY(0)";
      reel.replaceChildren(mk(final));
      buzz(30); done();
    }, dur + 80);
  }

  /* ---------- 1. トークルーレット ---------- */
  function talkView() {
    const g = G();
    const ps = players();
    const wrap = h("div", { class: "gm-p" });

    const chipsEl = h("div", { class: "gm-chips", role: "group", "aria-label": "カテゴリ" });
    function catsAll() {
      const list = CATS.slice();
      if (g.custom.talk.length) list.push({ id: CUSTOM_CAT.id, jp: CUSTOM_CAT.jp, list: g.custom.talk });
      return list;
    }
    function drawChips() {
      chipsEl.replaceChildren(...catsAll().map((c) => h("button", {
        type: "button", class: "gm-chip", "aria-pressed": String(!!g.cats[c.id]),
        onclick: () => {
          g.cats[c.id] = !g.cats[c.id];
          if (!catsAll().some((x) => g.cats[x.id])) { g.cats[c.id] = true; HP.toast("1つは ON にしてね"); }
          HP.save(); drawChips();
        },
      }, c.jp, h("small", null, String(c.list.length)))));
    }
    drawChips();

    const tSlot = h("div", { class: "gm-slot", "aria-live": "polite" });
    const tReel = h("div", { class: "gm-reel" }, h("div", { class: "gm-item is-ph" }, h("span", null, "？ お題はなにかな ？")));
    tSlot.append(tReel);
    const pSlot = h("div", { class: "gm-slot sm", "aria-live": "polite" });
    const pReel = h("div", { class: "gm-reel" }, h("div", { class: "gm-item is-ph" }, h("span", null, "？")));
    pSlot.append(pReel);
    const catLine = h("div", { style: { minHeight: "20px" } });

    const spinBtn = h("button", { type: "button", class: "btn big" }, "🎰 回す！");
    const ring = h("div", { class: "gm-ring", "aria-hidden": "true" }, h("b", null, "30"));
    const tmsg = h("p", { class: "gm-tmsg" }, "回すとお題と話す人が決まります");
    const tbtns = h("div", { class: "gm-btns" });
    const timerEl = h("div", { class: "gm-timer" }, ring, h("div", { class: "gm-tside" }, tmsg, tbtns));
    const resultEl = h("div", null);

    let who = null, tick = null;
    const LIMIT = 30;

    function setRing(left) {
      ring.style.setProperty("--p", String(Math.max(0, left) / LIMIT));
      ring.firstChild.textContent = String(Math.ceil(Math.max(0, left)));
      ring.classList.toggle("is-hurry", left > 0 && left <= 5);
    }
    function phase(p) {
      if (tick) { stop(tick); tick = null; }
      tbtns.replaceChildren();
      if (p === "idle") { setRing(LIMIT); tmsg.textContent = "回すとお題と話す人が決まります"; }
      if (p === "spinning") { setRing(LIMIT); tmsg.textContent = "ドゥルルルル……"; }
      if (p === "ready") {
        setRing(LIMIT);
        tmsg.textContent = who.name + " さん、準備はいい？";
        tbtns.append(
          h("button", { type: "button", class: "btn", onclick: () => phase("run") }, "30秒スタート"),
          h("button", { type: "button", class: "btn ghost", onclick: () => out("話せなかった…") }, "パス（罰）"));
      }
      if (p === "run") {
        const end = Date.now() + LIMIT * 1000;
        tmsg.textContent = "30秒しゃべり切れ！";
        tbtns.append(h("button", { type: "button", class: "btn ghost", onclick: () => out("止まっちゃった…") }, "止まった（罰）"));
        tick = every(() => {
          const left = (end - Date.now()) / 1000;
          setRing(left);
          if (left <= 0) {
            stop(tick); tick = null;
            buzz([60, 40, 60]);
            tbtns.replaceChildren(h("button", { type: "button", class: "btn", onclick: spin }, "次へ回す"));
            tmsg.textContent = "セーフ！";
            resultEl.replaceChildren(goodBox(who.name + " さん、30秒話し切った！", "拍手〜！👏 次の人へ"));
          }
        }, 200);
      }
    }
    function out(lead) {
      phase("idle");
      tmsg.textContent = "罰ゲーム！";
      tbtns.append(h("button", { type: "button", class: "btn", onclick: spin }, "次へ回す"));
      resultEl.replaceChildren(penaltyBox(who.name + " さん、" + lead));
    }
    function spin() {
      const cats = catsAll().filter((c) => g.cats[c.id]);
      const pool = [];
      cats.forEach((c) => c.list.forEach((t) => pool.push({ t, c })));
      if (!pool.length) { HP.toast("カテゴリを ON にしてね"); return; }
      stopAll(); // 前のタイマーやリールを止める
      const final = pickOne(pool);
      who = pickOne(ps);
      spinBtn.disabled = true;
      resultEl.replaceChildren();
      catLine.replaceChildren();
      phase("spinning");
      let n = 0;
      const fin = () => { if (++n < 2) return; spinBtn.disabled = false; spinBtn.textContent = "🎰 もう一回"; phase("ready"); };
      spinReel(tSlot, tReel, pool.map((x) => x.t), final.t, 96, 2300, () => {
        catLine.replaceChildren(h("span", { class: "gm-catb" }, final.c.jp));
        fin();
      });
      pSlot.style.setProperty("border-color", houseColor(who.house));
      spinReel(pSlot, pReel, ps.map((p) => p.name), who.name, 56, 3000, fin);
    }
    spinBtn.addEventListener("click", spin);
    phase("idle");

    wrap.append(
      h("div", null, h("p", { class: "gm-lbl" }, "カテゴリ（タップで ON/OFF）"), chipsEl),
      h("div", null, h("p", { class: "gm-lbl" }, "お題"), tSlot),
      catLine,
      h("div", null, h("p", { class: "gm-lbl" }, "話す人"), pSlot),
      spinBtn, timerEl, resultEl,
      h("p", { class: "gm-note" }, "止まったら30秒タイマー。話せなかったり、途中で止まったら罰。"));
    return {
      el: wrap,
      extra: customEditor("talk", "例：最近泣いた話", () => { drawChips(); }),
    };
  }

  /* ---------- 2. NG ワード ---------- */
  function ngView() {
    const g = G();
    const wrap = h("div", { class: "gm-p" });
    const ps = players();

    function deal() {
      const pool = NG_WORDS.concat(G().custom.ng).filter((w, i, a) => a.indexOf(w) === i);
      const words = {};
      const bag = pool.slice();
      ps.forEach((p) => { const i = rand(bag.length); words[p.id] = bag.length ? bag.splice(i, 1)[0] : pickOne(pool); });
      g.ng = { words, phase: "pass", step: 0, outs: {} };
      HP.save(); draw();
    }
    function wordOf(p) { return g.ng.words[p.id] || "？"; }

    function draw() {
      const ng = g.ng;
      // 人数が変わったなどで欠けていたら最初から
      if (ng.phase !== "idle" && ps.some((p) => !ng.words[p.id])) { ng.phase = "idle"; }
      wrap.replaceChildren();
      if (ng.phase === "idle") {
        wrap.append(
          h("p", { class: "gm-note" }, "1人ずつにNGワードを配ります。スマホを回して、自分以外の人のワードだけを見ます。自分のワードは最後まで秘密。会話の中で言ってしまったら罰！"),
          h("button", { type: "button", class: "btn big", onclick: deal }, "🤐 NGワードを配る"));
        return;
      }
      if (ng.phase === "pass") {
        const p = ps[ng.step];
        const dots = h("div", { class: "gm-steps", "aria-hidden": "true" }, ps.map((_, i) => h("span", { class: "gm-dot" + (i <= ng.step ? " is-on" : "") })));
        const cover = h("div", { class: "gm-cover" },
          h("div", { class: "gm-cover-ico", "aria-hidden": "true" }, "📱"),
          h("p", { class: "gm-cover-t" }, p.name + " さんに渡してね"),
          h("p", { class: "gm-note" }, "ほかの人の画面はのぞかないで"),
          h("button", { type: "button", class: "btn", onclick: () => reveal() }, p.name + " さん、見る"));
        wrap.append(dots, cover);
        function reveal() {
          const rows = h("ul", { class: "gm-rows" }, ps.map((q) => h("li", { class: "gm-row", style: { "--c": houseColor(q.house) } },
            h("span", { class: "gm-row-n" }, q.id === p.id ? q.name + "（あなた）" : q.name),
            q.id === p.id ? h("span", { class: "gm-word is-secret" }, "🤫 ひみつ") : h("span", { class: "gm-word" }, wordOf(q)))));
          const next = ng.step + 1 >= ps.length;
          cover.replaceWith(h("div", { class: "gm-p", style: { gap: "10px" } },
            h("p", { class: "gm-lbl" }, "みんなのNGワード（" + p.name + " さんだけ見てね）"),
            rows,
            h("button", { type: "button", class: "btn big", onclick: () => {
              if (next) { ng.phase = "play"; } else { ng.step++; }
              HP.save(); draw();
            } }, next ? "覚えた！ゲーム開始" : "覚えた！隠して次の人へ")));
        }
        return;
      }
      // play
      const res = h("div", null);
      const rows = h("ul", { class: "gm-rows" }, ps.map((p) => h("li", { class: "gm-row", style: { "--c": houseColor(p.house) } },
        h("span", { class: "gm-row-n" }, p.name),
        h("span", { class: "gm-outs" }, "×" + (ng.outs[p.id] || 0)),
        h("button", { type: "button", class: "btn", onclick: () => said(p, res) }, "言った！"))));
      wrap.append(
        h("p", { class: "gm-note" }, "普通におしゃべりしよう。だれかがNGワードを言ったら、気づいた人がその人の「言った！」を押してね。"),
        rows, res,
        h("div", { class: "gm-btns" },
          h("button", { type: "button", class: "btn ghost", onclick: () => spoil(res) }, "ネタばらし"),
          h("button", { type: "button", class: "btn ghost", onclick: deal }, "配り直す")));
    }
    function said(p, res) {
      const ng = g.ng;
      ng.outs[p.id] = (ng.outs[p.id] || 0) + 1;
      HP.save();
      buzz(80);
      const old = wordOf(p);
      const box = penaltyBox(p.name + " さんが「" + old + "」を言っちゃった！");
      const swap = h("button", { type: "button", class: "btn ghost", onclick: () => {
        const pool = NG_WORDS.concat(G().custom.ng).filter((w) => !Object.values(ng.words).includes(w));
        ng.words[p.id] = pool.length ? pickOne(pool) : pickOne(NG_WORDS);
        HP.save();
        // 本人以外が確認する
        const peek = h("button", { type: "button", class: "btn", onclick: () => { peek.replaceWith(h("span", { class: "gm-word" }, ng.words[p.id])); later(draw, 4000); } }, p.name + " さん以外がタップして確認");
        swap.replaceWith(h("div", { class: "gm-cover" }, h("p", { class: "gm-note" }, p.name + " さんは見ないで！新しいワードです（4秒で隠れます）"), peek));
      } }, "新しいワードに変える");
      box.append(swap);
      draw();
      // draw で res が作り直されるので、新しい res に入れる
      const r2 = wrap.querySelector(".gm-rows + div");
      if (r2) r2.replaceChildren(box);
    }
    function spoil(res) {
      res.replaceChildren(h("ul", { class: "gm-rows" }, ps.map((p) => h("li", { class: "gm-row", style: { "--c": houseColor(p.house) } },
        h("span", { class: "gm-row-n" }, p.name), h("span", { class: "gm-word" }, wordOf(p))))));
    }
    draw();
    return { el: wrap, extra: customEditor("ng", "例：ガチで", null) };
  }

  /* ---------- 3. せーので一致 ---------- */
  function matchView() {
    const wrap = h("div", { class: "gm-p" });
    const ps = players();
    let topic = null;
    const pool = () => MATCH_TOPICS.concat(G().custom.match);
    function next() { let t; const p = pool(); do { t = pickOne(p); } while (p.length > 1 && t === topic); topic = t; draw(); }
    function draw() {
      stopAll();
      const stage = h("div", null);
      const goBtn = h("button", { type: "button", class: "btn big", onclick: () => countdown(stage, goBtn) }, "🙌 せーの！");
      wrap.replaceChildren(
        h("p", { class: "gm-lbl", style: { textAlign: "center", margin: 0 } }, "お題"),
        h("p", { class: "gm-topic" }, topic),
        h("p", { class: "gm-note", style: { textAlign: "center" } }, "頭の中で答えを決めて、カウントの合図で全員同時に言おう"),
        goBtn, stage,
        h("button", { type: "button", class: "btn ghost", onclick: next }, "別のお題にする"));
    }
    function countdown(stage, goBtn) {
      goBtn.disabled = true;
      const steps = RM() ? ["せーの！"] : ["3", "2", "1", "せーの！"];
      let i = 0;
      const show = () => {
        stage.replaceChildren(h("div", { class: "gm-count", "aria-live": "assertive" }, h("b", null, steps[i])));
        buzz(20);
        if (++i < steps.length) later(show, 750); else later(() => judge(stage, goBtn), 900);
      };
      show();
    }
    function judge(stage, goBtn) {
      const res = h("div", null);
      stage.replaceChildren(h("div", { class: "gm-p", style: { gap: "10px" } },
        h("p", { class: "gm-lbl", style: { margin: 0 } }, "結果は？"),
        h("div", { class: "gm-btns" },
          h("button", { type: "button", class: "btn", onclick: () => { res.replaceChildren(goodBox("全員そろった！", null, "cheers")); after(); } }, "全員そろった！"),
          h("button", { type: "button", class: "btn ghost", onclick: () => pickOdd(res) }, "1人だけズレた"),
          h("button", { type: "button", class: "btn ghost", onclick: () => { res.replaceChildren(h("p", { class: "gm-note" }, "バラバラ！セーフ。次いこう")); after(); } }, "バラバラ")),
        res));
      function after() {
        goBtn.disabled = false;
        goBtn.textContent = "🙌 もう一回（同じお題）";
        if (!res.querySelector(".gm-next")) res.append(h("button", { type: "button", class: "btn gm-next", style: { marginTop: "10px", width: "100%" }, onclick: next }, "次のお題へ"));
      }
      function pickOdd(r) {
        r.replaceChildren(h("p", { class: "gm-lbl" }, "ズレたのはだれ？"),
          h("div", { class: "gm-who" }, ps.map((p) => h("button", { type: "button", class: "btn ghost", onclick: () => {
            r.replaceChildren(penaltyBox(p.name + " さんだけズレた！")); buzz(80); after();
          } }, p.name))));
      }
    }
    next();
    return { el: wrap, extra: customEditor("match", "例：USJの食べ物といえば？", null) };
  }

  /* ---------- 4. 指名ルーレット ---------- */
  function pickView() {
    const wrap = h("div", { class: "gm-p" });
    const ps = players();
    let purpose = PICK_PURPOSES[0];
    const chips = h("div", { class: "gm-chips gm-grid2", role: "group", "aria-label": "何を決める？" });
    function drawChips() {
      const all = PICK_PURPOSES.concat(G().custom.pick);
      if (!all.includes(purpose)) purpose = all[0];
      chips.replaceChildren(...all.map((t) => h("button", { type: "button", class: "gm-chip", "aria-pressed": String(t === purpose),
        onclick: () => { purpose = t; drawChips(); } }, t)));
    }
    drawChips();
    const tiles = ps.map((p) => h("div", { class: "gm-tile", style: { "--c": houseColor(p.house) } },
      h("span", { class: "gm-tile-n" }, p.name), p.house ? HP.houseChip(p.house) : null));
    const wheel = h("div", { class: "gm-wheel" }, tiles);
    const result = h("p", { class: "gm-result", "aria-live": "polite" }, "");
    const btn = h("button", { type: "button", class: "btn big" }, "🎯 ルーレットを回す");
    btn.addEventListener("click", () => {
      stopAll();
      btn.disabled = true;
      result.textContent = "";
      tiles.forEach((t) => t.classList.remove("is-lit", "is-win"));
      const win = rand(tiles.length);
      const finish = () => {
        tiles.forEach((t) => t.classList.remove("is-lit"));
        tiles[win].classList.add("is-win");
        result.textContent = "「" + purpose + "」は " + ps[win].name + " さん！";
        btn.disabled = false; btn.textContent = "🎯 もう一回";
        buzz([40, 30, 80]);
      };
      if (RM()) { finish(); return; }
      // 時計回り(左上→右上→右下→左下)にぐるぐる、だんだん遅く
      const order = tiles.length === 4 ? [0, 1, 3, 2] : tiles.map((_, i) => i);
      const winPos = order.indexOf(win);
      const total = order.length * (3 + rand(2)) + winPos;
      let i = 0;
      const step = () => {
        tiles.forEach((t) => t.classList.remove("is-lit"));
        tiles[order[i % order.length]].classList.add("is-lit");
        if (i >= total) { later(finish, 250); return; }
        const k = i / total;
        i++;
        later(step, 55 + Math.pow(k, 3) * 380);
      };
      step();
    });
    wrap.append(h("div", null, h("p", { class: "gm-lbl" }, "何を決める？"), chips), wheel, btn, result);
    return { el: wrap, extra: customEditor("pick", "例：買い出し係", drawChips) };
  }

  /* ---------- 画面 ---------- */
  function listView() {
    return h("div", { class: "gm-cards" }, GAMES.map((gm) => h("button", {
      type: "button", class: "gm-card" + (gm.main ? " is-main" : "") + (gm.wide ? " is-wide" : ""), onclick: () => open(gm.id),
    },
    h("span", { class: "gm-card-ico", "aria-hidden": "true" }, gm.ico),
    gm.main ? h("span", { class: "gm-badge" }, "メイン") : null,
    h("span", { class: "gm-card-t" }, gm.title),
    h("span", { class: "gm-card-s" }, gm.sub))));
  }

  function gameView(id) {
    const gm = GAMES.find((x) => x.id === id);
    const v = ({ talk: talkView, ng: ngView, match: matchView, pick: pickView })[id]();
    return h("div", { class: "gm" },
      h("div", { class: "gm-bar" },
        h("button", { type: "button", class: "btn ghost", onclick: () => open(null) }, "← 一覧"),
        h("h3", { class: "gm-bar-t h-display" }, gm.ico + " " + gm.title)),
      h("section", { class: "parchment" }, v.el),
      v.extra);
  }

  function open(id) {
    stopAll();
    cur = id;
    if (!bodyEl) return;
    bodyEl.replaceChildren(id ? gameView(id) : listView());
    if (rootEl) rootEl.scrollIntoView({ block: "start" });
    window.scrollTo(0, 0);
  }

  function modeBar() {
    const btns = {};
    const pace = h("p", { class: "gm-pace" }, MT.pace[mode()]);
    function set(m) {
      G().mode = m; HP.save();
      Object.keys(btns).forEach((k) => btns[k].setAttribute("aria-pressed", String(k === m)));
      pace.textContent = MT.pace[m];
      // 表示中の罰・乾杯の文言を新しいモードに入れ替える
      if (rootEl) {
        rootEl.querySelectorAll("[data-pen]").forEach((el) => { el.textContent = penText(); });
        rootEl.querySelectorAll("[data-mt]").forEach((el) => { el.textContent = MT[el.dataset.mt][m]; });
      }
      HP.toast(m === "drink" ? "🍺 飲みモード：罰は「一口」" : "🥤 ソフドリモード：罰は写真やモノマネ");
    }
    btns.drink = h("button", { type: "button", "aria-pressed": String(mode() === "drink"), onclick: () => set("drink") }, "🍺 飲み");
    btns.soft = h("button", { type: "button", "aria-pressed": String(mode() === "soft"), onclick: () => set("soft") }, "🥤 ソフドリ");
    return [h("div", { class: "gm-mode", role: "group", "aria-label": "飲みモード／ソフドリモード" }, btns.drink, btns.soft), pace];
  }

  function render(root) {
    stopAll();
    G();
    rootEl = root;
    bodyEl = h("div", null);
    root.replaceChildren(h("div", { class: "gm" },
      h("div", { class: "gm-head" },
        h("h2", { class: "gm-title h-display" }, "飲みゲーム"),
        h("p", { class: "gm-lead muted" }, "スマホ1台を4人で囲んで")),
      modeBar(),
      bodyEl));
    bodyEl.replaceChildren(cur ? gameView(cur) : listView());
  }

  HP.register("games", {
    mount(root) { injectCSS(); G(); rootEl = root; },
    show(root) { render(root); },
  });
})();
