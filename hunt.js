/* 分霊箱ハント — 旅全体を 1 本の冒険にするメイン画面
 *
 * 流れ: プロローグ（ダンブルドアからの依頼）→ ハント本部（ふくろう便と 7 つの分霊箱）→ 写真リスト
 * 状態: HP.state.hunt = {
 *   prologueDone,
 *   letters: { L0..L5: { forced, openedAt, solved, gaveUp, hint, photoAt } },
 *   horcrux: { diary..final: { doneAt, by } },   // by = プレイヤー id / "all" / null
 *   extra:   { house, group },                   // おまけの撮影（手動チェック）
 *   clearSeen,
 *   shots:   { "nt-<id>" | "cm-<id>": 撮影時刻 },  // 夜の談話室と追加ミッションの撮影済み印
 *   custom:  [{ id, title, tip, group, createdAt }] // 自分たちで追加したミッション（group: shinkansen|usj|night|other）
 * }
 * 写真のキー（HP.media）: lt-L0 / hx-diary / nt-toast / cm-<id>
 * 公開 API: HP_HUNT.photoMissions() → [{ key, title, group, done }]（予言者新聞が使う。形を変えないこと）
 * 時刻判定は「今」を引数で受け取れる。window.HP_HUNT_NOW（Date）があればそれを今として使う。
 */
(function () {
  "use strict";
  const G = typeof window !== "undefined" ? window : globalThis;

  /* ================= データ ================= */
  const TRIP_DAY = "2026-10-11";
  const at = (hm) => new Date(TRIP_DAY + "T" + hm + ":00+09:00");

  const HORCRUXES = [
    { id: "diary", n: 1, name: "トムの日記", img: "diary", letter: "L1",
      place: "嘆きのマートルのトイレ", placeNote: "ホグズミード村にある、しゃべるトイレ。",
      veil: "水の音がする、少女の幽霊の住みか", kind: "写真",
      shot: "鏡の前でビビる4人", tip: "鏡に4人全員が映る位置に立ち、撮る人は鏡の端から。全員が同じ方向を向いて、目と口を大きく開ける。" },
    { id: "ring", n: 2, name: "ゴーントの指輪", img: "ring", letter: "L2",
      place: "オリバンダーの店の前", placeNote: "杖を売る老舗。魔法使いはここで杖に選ばれる。",
      veil: "魔法使いが、最初の道具に選ばれる場所", kind: "写真",
      shot: "杖に選ばれた瞬間の顔", tip: "顔のアップで。杖を胸の前に構え、目を見開いた瞬間を連写でおさえる。" },
    { id: "locket", n: 3, name: "スリザリンのロケット", img: "locket", letter: "L3",
      place: "ホグワーツ城が見える場所", placeNote: "村の奥にそびえる城。見上げられる場所ならどこでもいい。",
      veil: "高い塔を見上げる場所", kind: "写真",
      shot: "真下から煽って、全員で杖を掲げる", tip: "スマホを地面すれすれに上向きで構える。4本の杖の先を画面の中央に集め、背景に城と空を入れる。" },
    { id: "cup", n: 4, name: "ハッフルパフのカップ", img: "cup", letter: "L4",
      place: "バタービール", placeNote: "村のワゴンや店で買える、金色の泡の飲み物。",
      veil: "金色の泡が立つところ", kind: "写真",
      shot: "泡ひげで4人とも真顔", tip: "横一列に並び、ひと口飲んで口のまわりに泡を残す。誰かが笑ったら撮り直し。" },
    { id: "diadem", n: 5, name: "レイブンクローの髪飾り", img: "diadem", letter: "L5",
      place: "雪の積もった屋根が続くホグズミードの通り", placeNote: "村のメインの通り。屋根の雪は一年中とけない。",
      veil: "一年じゅう冬の、村の通り", kind: "写真",
      shot: "4人で歩く後ろ姿", tip: "撮る人は数歩うしろで少ししゃがみ、縦向きで。4人の頭の上に雪の屋根が入るように。" },
    { id: "nagini", n: 6, name: "ナギニ", img: "snake", letter: null,
      place: "どこでも", placeNote: "ヴォルデモートが連れている大蛇。パークのどこにいても狩れる。",
      veil: "新大阪に着けば明かされる", kind: "動画",
      shot: "「エクスペリアームス！」で1人が吹っ飛ぶ", tip: "5秒ほどで十分。呪文の瞬間、吹っ飛ぶ人は後ろへ大きくのけぞる。まわりの人にぶつからない場所で。" },
    { id: "final", n: 7, name: "最後の一撃", img: "final", letter: null, final: true,
      place: "ホグワーツ特急の機関車の前", placeNote: "村の入口近くに停まっている、赤い蒸気機関車。",
      veil: "新大阪に着けば明かされる", kind: "写真",
      shot: "4人並んで呪文のポーズ", tip: "機関車の正面を背に、横一列。杖を前へ突き出し、全員で同じ呪文を唱える瞬間を。" },
  ];
  const HX = {};
  HORCRUXES.forEach((x) => { HX[x.id] = x; });

  const LETTERS = [
    { id: "L0", label: "出発の儀", hm: "06:40", time: "6:40", station: "品川発車", sub: "乗る前に、ホームで", immediate: true,
      title: "出発の儀",
      body: "諸君、おはよう。魔法界の列車は、柱の向こうの「9と3/4番線」から出ると決まっておる。今日きみたちを運ぶのは、青い光をまとったのぞみ号じゃ。乗り込む前に、ホームで出発の儀を済ませておくれ。",
      photo: { key: "lt-L0", title: "9と3/4番線に突入", text: "ホームで「9と3/4番線」に突入するポーズを、乗る前に1枚。",
        tip: "柱や壁ぎわに立ち、1人が体を半分隠して片足を上げると、吸い込まれていくように見える。ほかの乗客の通り道はふさがないこと。" } },
    { id: "L1", label: "第1便", hm: "06:51", time: "6:51", station: "新横浜", sub: "謎1", arrive: "新横浜",
      title: "最初の手がかり",
      body: "列車が動きだしたな。さっそく本題じゃ。最初の分霊箱は、ひとりの少女の幽霊が泣きながら暮らす場所に隠されておる。次の謎を解けば、その場所がわかるはずじゃ。",
      riddle: { n: 1, hx: "diary", kind: "なぞなぞ",
        q: "入るときは、ひとり。\n鍵をかけて、すわって待つ。\n紙はあるのに、だれも字を書かない。\nこの部屋はなに？",
        answers: ["トイレ", "おトイレ", "お手洗い", "手洗い", "便所", "化粧室", "厠", "かわや", "WC", "restroom", "toilet"],
        answer: "トイレ", hint: "家にも駅にも、この新幹線にもある。最後に水を流す。" } },
    { id: "L2", label: "第2便", hm: "07:15", time: "7:15ごろ", station: "富士山接近", sub: "進行方向の右側＝E席側の窓", arrive: "富士山のあたり",
      title: "日本一の山に杖を",
      body: "右の窓を見よ。E席の側じゃ。雲が晴れていれば、日本でいちばん高い山が姿を見せる。魔法使いの力は、杖を向けてこそ届く。2つ目の分霊箱は、その杖にまつわる場所に眠っておる。",
      photo: { key: "lt-L2", title: "車窓の富士山に杖を向ける", text: "車窓の富士山に、4人で杖を向けて1枚。",
        tip: "スマホを窓ガラスに近づけると映り込みが減る。杖の先は窓ぎわに集め、山は画面の上半分に。雲で見えなくても、山の方角へ杖を向ければ指令達成じゃ。" },
      riddle: { n: 2, hx: "ring", kind: "あいうえお表の暗号",
        q: "あいうえお表を思い浮かべよ。\n\n「た行」の3番目\n「あ行」の4番目\n\nつなげて読むと、魔法使いが必ず持っているもの。",
        answers: ["つえ", "杖", "魔法の杖", "まほうのつえ", "wand"],
        answer: "つえ（杖）", hint: "た行は「た・ち・つ・て・と」、あ行は「あ・い・う・え・お」。順に数えてみよう。" } },
    { id: "L3", label: "第3便", hm: "08:12", time: "8:12", station: "名古屋", sub: "指令と謎3", arrive: "名古屋",
      title: "魔法薬の材料",
      body: "金のしゃちほこの城の町に着いた。そろそろ腹ぺこじゃろう。魔法薬の授業では、材料の並べ方ひとつで出来が変わる。駅弁も同じじゃ。3つ目の分霊箱は、ある城を見上げる場所にある。",
      photo: { key: "lt-L3", title: "駅弁を魔法薬の材料に", text: "駅弁を「魔法薬の材料」っぽく並べて、真上から1枚。",
        tip: "ふたを外して田の字に並べ、すき間に杖を1本。スマホを水平に持ち、真上から自分の影が入らないように撮る。" },
      riddle: { n: 3, hx: "locket", kind: "並べ替え",
        q: "6つの文字を並べ替えよ。\n\n「う・ろ・ま・ほ・の・し」\n\nできた言葉が、3つ目の分霊箱のありかを指す。",
        answers: ["まほうのしろ", "魔法の城", "まほうのおしろ", "魔法のお城"],
        answer: "まほうのしろ（魔法の城）", hint: "「ま」で始まり、「しろ」で終わる。" } },
    { id: "L4", label: "第4便", hm: "08:47", time: "8:47", station: "京都", sub: "謎4", arrive: "京都",
      title: "金色の泡の杯",
      body: "古都を過ぎるぞ。4つ目は、ハッフルパフの小さな金の杯じゃ。杯にふさわしい飲み物を当てれば、その在りかがわかる。",
      riddle: { n: 4, hx: "cup", kind: "選んで答える",
        q: "「パンに塗る黄色いもの」と\n「大人が乾杯する泡の飲み物」。\nこの2つをくっつけると、魔法界でいちばん人気の飲み物になる。それはどれ？",
        choices: ["かぼちゃジュース", "バタービール", "ミルクティー", "ジンジャーエール"],
        answers: ["バタービール", "バタビール", "butterbeer", "B"],
        answer: "バタービール", hint: "1つ目は「バター」。2つ目は「ビ」から始まる。" } },
    { id: "L5", label: "第5便", hm: "09:01", time: "9:01", station: "新大阪着", sub: "最終指令と謎5", arrive: "新大阪",
      title: "最終指令",
      body: "よくぞここまで来た。ここから先は魔法の村じゃ。6つ目と最後の分霊箱の在りかも、今ここで明かそう。",
      orders: [
        "パークに入ったら、まずホグズミード村をめざせ。雪をかぶった屋根の村が目印じゃ。",
        "分霊箱カードを開き、見つけた順に写真で砕いていけ。順番は自由じゃ。",
        "大蛇ナギニはどこでも狩れる。手の空いたときに動画で。",
        "6つを砕いたら、最後はホグワーツ特急の機関車の前へ。4人そろって最後の一撃を。",
      ],
      riddle: { n: 5, hx: "diadem", kind: "ずらし暗号",
        q: "あいうえお表で、1文字ずつ「1つ前」にずらして読め。\n\n「よ　く」\n\n出てきた言葉が、5つ目の分霊箱の通りを白くおおっている。",
        answers: ["ゆき", "雪", "snow", "スノー"],
        answer: "ゆき（雪）", hint: "や行は「や・ゆ・よ」、か行は「か・き・く・け・こ」。「よ」の1つ前は「ゆ」。" } },
  ];
  const LT = {};
  LETTERS.forEach((l) => { LT[l.id] = l; });
  const ARRIVAL = "L5";

  /* 夜の談話室（民泊）— 分霊箱を倒したあとの祝勝会。ロックはしない */
  const NIGHT = [
    { id: "toast", title: "祝勝の乾杯", kind: "写真", shot: "杖を交差させて、グラスを合わせる瞬間",
      tip: "グラスをテーブルの中央に寄せ、撮る人は椅子に立たず腕を伸ばして真上から。" },
    { id: "house", title: "寮カラーの一杯", kind: "写真", shot: "自分の寮の色の飲み物を、横一列に並べる",
      tip: "赤・緑・青・黄をそろえて白いテーブルか床の上に。ジュースやお茶でも色はそろう。" },
    { id: "potion", title: "魔法薬調合中", kind: "写真", shot: "缶やグラスを魔法薬の瓶に見立てて、杖でかき混ぜる",
      tip: "部屋の照明を落とし、別のスマホのライトを横から当てると怪しい実験室になる。" },
    { id: "speech", title: "ダンブルドアの総括スピーチ", kind: "動画", shot: "吹替の口調で、今日1日を振り返る",
      tip: "「諸君……」から始めて30秒以内に。残りの3人は真顔でうなずく係。" },
    { id: "tour", title: "談話室ルームツアー", kind: "動画", shot: "泊まる部屋を、寮の談話室に見立てて案内する",
      tip: "ゆっくり歩いて1部屋ずつ。住所がわかる掲示や、ほかの人の荷物は映さない。" },
    { id: "lounge", title: "寮の談話室", kind: "写真", shot: "ローブ姿でくつろぐ4人の集合写真",
      tip: "ソファや床に思い思いに座り、セルフタイマーで。撮る人も入ること。" },
    { id: "sleeper", title: "最初に寝落ちした人", kind: "写真", shot: "いちばん最初に眠った魔法使いの寝顔",
      tip: "起こさない程度にそっと。フラッシュは切る。",
      note: "本人にあとでOKをもらってから見せる・新聞に載せること。ダメと言われたら消そう。" },
    { id: "morning", title: "魔法が解けた朝", kind: "写真", shot: "翌朝、ローブを脱いだ4人の集合写真",
      tip: "チェックアウト前に、窓ぎわの明るい場所で。寝ぐせはそのままが正解。" },
  ];
  const CUSTOM_GROUPS = [
    { id: "shinkansen", label: "新幹線" },
    { id: "usj", label: "ユニバ" },
    { id: "night", label: "民泊" },
    { id: "other", label: "その他" },
  ];

  const EXTRAS = [
    { id: "house", title: "寮ごとの決めポーズ", where: "パークのどこでも" },
    { id: "group", title: "ホグワーツ城を背に4人の集合写真", where: "ホグワーツ城の前" },
  ];

  /* ================= 純粋な関数（テスト可能） ================= */
  function nowOf(now) {
    if (now instanceof Date && !isNaN(now)) return now;
    const o = G.HP_HUNT_NOW;
    if (o instanceof Date && !isNaN(o)) return o;
    return new Date();
  }
  function dueAt(L) { return at(L.hm); }
  /* 届いているか: すぐ開ける便 / 「届いたことにする」済み / 予定時刻を過ぎた */
  function isDelivered(L, now, rec) {
    if (L.immediate) return true;
    if (rec && rec.forced) return true;
    return nowOf(now).getTime() >= dueAt(L).getTime();
  }
  function minutesUntil(L, now) { return Math.max(0, Math.ceil((dueAt(L).getTime() - nowOf(now).getTime()) / 60000)); }
  function fmtDur(min) {
    if (min < 60) return min + "分";
    const hh = Math.floor(min / 60), mm = min % 60;
    if (hh < 24) return hh + "時間" + (mm ? mm + "分" : "");
    const d = Math.floor(hh / 24), rh = hh % 24;
    return d + "日" + (rh ? rh + "時間" : "");
  }
  function ymdJST(d) { return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10); }
  function etaText(L, now) {
    const n = nowOf(now);
    const when = (ymdJST(n) === TRIP_DAY ? "" : "10/11 ") + L.time;
    return when + " " + (L.arrive || L.station) + "に届く予定（あと" + fmtDur(minutesUntil(L, n)) + "）";
  }
  /* 表記ゆれ: 全角半角・大小文字・カタカナ/ひらがな・空白・記号・長音を吸収 */
  function normalize(s) {
    let t = String(s == null ? "" : s).normalize("NFKC").toLowerCase();
    t = t.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
    t = t.replace(/[\s　・･、。,.!?！？「」『』()（）"'`~〜ー－\-_]/g, "");
    return t;
  }
  function checkAnswer(riddle, input) {
    const v = normalize(input);
    if (!v) return false;
    return riddle.answers.some((a) => normalize(a) === v);
  }
  function deliveredIds(now, letters) {
    return LETTERS.filter((L) => isDelivered(L, now, (letters || {})[L.id])).map((L) => L.id);
  }

  /* ---------- 撮影ミッション（夜の談話室・追加ミッション） ---------- */
  const groupId = (g) => (CUSTOM_GROUPS.some((x) => x.id === g) ? g : "other");
  const groupLabel = (g) => CUSTOM_GROUPS.find((x) => x.id === groupId(g)).label;
  function huntOf(H) {
    if (H && typeof H === "object") return H;
    const hp = G.HP;
    return (hp && hp.state && hp.state.hunt) || {};
  }
  function customList(H) { return Array.isArray(H.custom) ? H.custom.filter((c) => c && c.id) : []; }
  /* 全撮影ミッション（予言者新聞が紙面の写真を選ぶ）。形 [{ key, title, group, done }] は変えないこと */
  function photoMissions(huntState) {
    const H = huntOf(huntState);
    const L = H.letters || {}, X = H.horcrux || {}, S = H.shots || {};
    const out = [];
    LETTERS.forEach((l) => {
      if (l.photo) out.push({ key: l.photo.key, title: l.photo.title, group: "shinkansen", done: !!(L[l.id] && L[l.id].photoAt) });
    });
    HORCRUXES.forEach((x) => { out.push({ key: "hx-" + x.id, title: x.shot, group: "usj", done: !!X[x.id] }); });
    NIGHT.forEach((n) => { out.push({ key: "nt-" + n.id, title: n.title, group: "night", done: !!S["nt-" + n.id] }); });
    customList(H).forEach((c) => {
      out.push({ key: "cm-" + c.id, title: String(c.title || ""), group: "custom-" + groupId(c.group), done: !!S["cm-" + c.id] });
    });
    return out;
  }
  /* 追加ミッション: タイトル必須。成功なら追加した要素、失敗なら null */
  function addCustom(H, o, now) {
    const title = String((o && o.title) || "").trim().slice(0, 40);
    if (!title) return null;
    if (!Array.isArray(H.custom)) H.custom = [];
    let id;
    do { id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); } while (H.custom.some((c) => c && c.id === id));
    const item = { id, title, tip: String((o && o.tip) || "").trim().slice(0, 120), group: groupId(o && o.group),
      createdAt: nowOf(now).toISOString() };
    H.custom.push(item);
    return item;
  }
  /* 追加ミッションを消す（撮影済みの印も消す）。消せたら true。写真本体は画面側で HP.media.remove する */
  function removeCustom(H, id) {
    if (!Array.isArray(H.custom)) return false;
    const i = H.custom.findIndex((c) => c && c.id === id);
    if (i < 0) return false;
    H.custom.splice(i, 1);
    if (H.shots) delete H.shots["cm-" + id];
    return true;
  }

  const api = { TRIP_DAY, LETTERS, HORCRUXES, NIGHT, CUSTOM_GROUPS, at, nowOf, isDelivered, minutesUntil, etaText, fmtDur, normalize, checkAnswer,
    deliveredIds, photoMissions, addCustom, removeCustom };
  if (typeof module === "object" && module.exports) module.exports = api;
  G.HP_HUNT = api;
  if (!G.HP || !G.document) return;

  /* ================= 画面 ================= */
  const HP = G.HP;
  const h = HP.h;
  const reduceMotion = () => G.matchMedia && G.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CRACK = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    '<path pathLength="100" d="M50 50 L44 38 L49 27 L41 12 L45 0"/>' +
    '<path pathLength="100" d="M50 50 L63 44 L71 31 L86 24 L100 18"/>' +
    '<path pathLength="100" d="M50 50 L58 62 L55 74 L66 88 L72 100"/>' +
    '<path pathLength="100" d="M50 50 L37 57 L27 54 L15 66 L0 70"/>' +
    '<path pathLength="100" d="M44 38 L33 33 L22 36"/>' +
    '<path pathLength="100" d="M58 62 L70 66"/></svg>';

  const CSS = `
/* locore（Editorial Light / Locore Lime）。色はすべて index.html の :root トークンを参照する */
.hn { display: block; padding-bottom: 8px; }
.hn .eyebrow, .hn-panel .eyebrow, .hn-clear .eyebrow { display: block; font-size: 12px; line-height: 1.5; }
.hn-art { position: relative; overflow: hidden; display: block; width: 100%; max-width: 100%; background: var(--lc-muted); }
.hn-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.hn-art.hn-miss::after { content: "✦"; position: absolute; inset: 0; display: grid; place-items: center;
  font-size: 28px; color: var(--lc-border-strong); }
.hn-r45 { aspect-ratio: 4 / 5; }
.hn-r11 { aspect-ratio: 1; }
.hn-crack { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.hn-crack svg { width: 100%; height: 100%; display: block; }
.hn-crack path { fill: none; stroke: var(--lc-surface); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round;
  filter: drop-shadow(0 0 1px var(--lc-fg)); vector-effect: non-scaling-stroke; }

/* 進み具合・表示切り替え */
.hn-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 4px 0 20px; padding: 0; list-style: none; }
.hn-steps li { min-width: 0; padding-top: 8px; border-top: 3px solid var(--lc-border); font-size: 12px; line-height: 1.4;
  color: var(--lc-fg-subtle); text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hn-steps li[data-done] { border-top-color: var(--lime); color: var(--lc-fg-muted); }
.hn-steps li[data-on] { border-top-color: var(--lime); color: var(--lc-fg); font-weight: 700; }

.hn-seg { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 4px; margin: 0 0 24px;
  border-radius: 9999px; background: var(--lc-muted); }
.hn-seg button { min-width: 0; min-height: 44px; border: 0; border-radius: 9999px; background: none; color: var(--lc-fg-muted);
  font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer;
  transition: background .2s var(--ease-out), color .2s var(--ease-out); }
.hn-seg button[aria-pressed="true"] { background: var(--lime); color: var(--lc-fg); box-shadow: var(--shadow-xs); }

/* 本部のヒーロー（写真は上、文字は下） */
.hn-hero { overflow: hidden; border-radius: var(--radius); border: 1px solid var(--lc-border); background: var(--lc-surface);
  box-shadow: var(--shadow-sm); margin-bottom: 20px; }
.hn-hero > .hn-art { aspect-ratio: 3 / 2; }
.hn-hero > .hn-art img { object-position: 50% 30%; }
.hn-hero-in { padding: 18px 18px 20px; }
.hn-kicker { display: block; }
.hn-count { margin: 4px 0 12px; font-weight: 700; font-size: 24px; line-height: 1.3; letter-spacing: -.015em; color: var(--lc-fg); }
.hn-count b { font-family: var(--font-latin); font-variant-numeric: tabular-nums; font-size: 44px; font-weight: 700;
  letter-spacing: -.02em; padding: 0 4px; }
.hn-hero-bar { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; }
.hn-hero-bar span { flex-shrink: 0; white-space: nowrap; font-family: var(--font-latin); font-variant-numeric: tabular-nums;
  font-size: 13px; font-weight: 600; color: var(--lc-fg-muted); }
.hn-icons { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; max-width: 360px; margin: 0 0 16px; padding: 0; list-style: none; }
.hn-ico { position: relative; min-width: 0; aspect-ratio: 1; border-radius: 50%; overflow: hidden; border: 2px solid var(--lc-border); }
.hn-ico .hn-art { height: 100%; }
.hn-ico[data-done] { border-color: var(--lime); }
.hn-ico[data-done] img { filter: grayscale(1); opacity: .5; }
.hn-hero-row { display: flex; flex-wrap: wrap; gap: 8px; }

/* 新着のふくろう便 */
.hn-new { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 0 0 20px; padding: 14px 16px;
  border-radius: var(--radius); border: 1px solid var(--lime-100); background: var(--lime-50); }
.hn-new-txt { flex: 1 1 180px; min-width: 0; }
.hn-new-txt strong { display: block; font-size: 17px; font-weight: 700; letter-spacing: -.015em; color: var(--lc-fg); line-height: 1.4; }
.hn-new-txt span { display: block; font-size: 13px; color: var(--lime-900); }

/* セクション */
.hn-sec { margin: 44px 0 0; }
.hn-sec-h { margin: 2px 0 0; font-weight: 700; font-size: 22px; line-height: 1.35; color: var(--lc-fg); letter-spacing: -.015em; }
.hn-sec-note { margin: 4px 0 18px; font-size: 13px; line-height: 1.6; color: var(--lc-fg-muted); }

/* ふくろう便のタイムライン */
.hn-tl { position: relative; list-style: none; margin: 0; padding: 0; }
.hn-tl::before { content: ""; position: absolute; left: 7px; top: 14px; bottom: 14px; width: 1px; background: var(--lc-border); }
.hn-lt { position: relative; padding-left: 28px; margin-bottom: 12px; scroll-margin-top: 72px; }
.hn-lt::before { content: ""; position: absolute; left: 2px; top: 32px; width: 12px; height: 12px; border-radius: 50%;
  background: var(--lc-surface); border: 1px solid var(--lc-border-strong); box-sizing: border-box; }
.hn-lt[data-st="new"]::before { background: var(--lime); border-color: var(--lime); box-shadow: 0 0 0 4px var(--lime-100); }
.hn-lt[data-st="open"]::before { background: var(--lime-700); border-color: var(--lime-700); }
.hn-lt-card { border-radius: var(--radius); border: 1px solid var(--lc-border); background: var(--lc-surface); box-shadow: var(--shadow-sm); overflow: hidden; }
.hn-lt[data-st="wait"] .hn-lt-card { background: var(--lc-bg); border-style: dashed; box-shadow: none; }
.hn-lt-head { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 64px; padding: 12px 14px;
  border: 0; background: none; color: var(--lc-fg); text-align: left; }
button.hn-lt-head { cursor: pointer; }
.hn-time { flex-shrink: 0; white-space: nowrap; min-width: 3.2em; font-family: var(--font-latin); font-weight: 700; font-size: 17px;
  letter-spacing: -.01em; color: var(--lc-fg); font-variant-numeric: tabular-nums; }
.hn-lt[data-st="wait"] .hn-time { color: var(--lc-fg-subtle); }
.hn-lt-name { flex: 1 1 auto; min-width: 0; line-height: 1.35; }
.hn-lt-name .eyebrow { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hn-lt-name b { display: block; font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hn-lt-name small { display: block; font-size: 12px; color: var(--lc-fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hn-badge { flex-shrink: 0; white-space: nowrap; padding: 3px 10px; border-radius: 9999px; border: 1px solid transparent;
  background: var(--lc-muted); font-size: 12px; font-weight: 700; line-height: 1.5; color: var(--lc-fg-2); }
.hn-badge[data-tone="gold"] { background: var(--lime); border-color: var(--lime); color: var(--lc-fg); }
.hn-badge[data-tone="done"] { background: var(--lime-50); border-color: var(--lime-100); color: var(--lime-900); }
.hn-lt-body { padding: 0 14px 16px; }
.hn-eta { margin: 0 0 12px; font-size: 14px; color: var(--lc-fg-muted); }
.hn-sealed { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.hn-sealed p { flex: 1 1 auto; min-width: 0; margin: 0; font-size: 14px; color: var(--lc-fg-2); }
.hn-mini-seal { flex-shrink: 0; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
  background: var(--lime); color: var(--lc-fg); font-family: var(--font-latin); font-weight: 700; font-size: 18px; }
.hn-wide { width: 100%; }

/* 手紙の本文（白い誌面） */
.hn-paper.parchment { margin-bottom: 4px; border: 0; border-top: 1px solid var(--lc-border); border-radius: 0;
  box-shadow: none; background: none; padding-top: 16px; }
.hn-paper h3 { margin: 4px 0 10px; font-weight: 700; font-size: 21px; line-height: 1.45; letter-spacing: -.015em; text-wrap: balance; }
.hn-paper p { margin: 0; font-size: 15px; line-height: 1.85; color: var(--lc-fg-2); }
.hn-paper ol { margin: 12px 0 0; padding-left: 1.3em; font-size: 15px; color: var(--lc-fg-2); }
.hn-paper li { margin-bottom: 4px; }
.hn-paper li::marker { color: var(--lime-700); font-family: var(--font-latin); font-weight: 700; }
.hn-sign { margin-top: 12px !important; text-align: right; font-size: 14px; color: var(--lc-fg-muted) !important; }

.hn-block { position: relative; margin-top: 14px; padding: 16px; border-radius: 12px; border: 1px solid var(--lc-border); background: var(--lc-muted); }
.hn-label { display: block; margin-bottom: 6px; font-family: var(--font-mono); font-size: 12px; font-weight: 600;
  letter-spacing: .18em; text-transform: uppercase; color: var(--lime-700); }
.hn-q { margin: 0 0 12px; font-size: 16px; line-height: 1.75; white-space: pre-line; color: var(--lc-fg); }
.hn-tip { margin: 6px 0 0; font-size: 13px; color: var(--lc-fg-muted); }
.hn-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0 0 10px; }
.hn-choices button { min-width: 0; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--lc-border);
  background: var(--lc-surface); color: var(--lc-fg); font-size: 14px; line-height: 1.35; text-align: left; cursor: pointer; }
.hn-choices b { font-family: var(--font-latin); color: var(--lime-700); margin-right: 6px; }
.hn-ans { display: flex; flex-wrap: wrap; gap: 8px; }
.hn-ans .btn { flex-shrink: 0; }
.hn-input { flex: 1 1 150px; min-width: 0; max-width: 100%; min-height: 44px; padding: 8px 14px; border-radius: 12px;
  border: 1px solid var(--lc-border-strong); background: var(--lc-surface); color: var(--lc-fg); font: inherit; font-size: 16px; }
.hn-input::placeholder { color: var(--lc-fg-subtle); }
.hn-input:focus { outline: 2px solid var(--lime); outline-offset: 1px; border-color: var(--lime-700); }
.hn-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.hn-row > .btn { flex-shrink: 0; }
.hn-s { min-height: 44px; padding: 8px 16px; font-size: 14px; }
.hn-msg { margin: 8px 0 0; font-size: 14px; font-weight: 700; color: var(--danger); }
.hn-hint { margin: 10px 0 0; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--lc-border); background: var(--lc-surface);
  font-size: 14px; color: var(--lc-fg-2); }
.hn-reveal { margin-top: 12px; padding: 14px; border-radius: 12px; border: 1px solid var(--lime-100); background: var(--lime-50); }
.hn-reveal > p:first-child { font-size: 13px; color: var(--lime-900); }
.hn-reveal strong { display: block; font-size: 17px; font-weight: 700; line-height: 1.5; letter-spacing: -.01em; color: var(--lc-fg); }
.hn-reveal p { margin: 4px 0 0; font-size: 14px; color: var(--lc-fg-2); }
.hn-confirm { margin-top: 12px; padding: 14px; border-radius: 12px; border: 1px solid var(--danger); background: var(--lc-surface); }
.hn-confirm p { margin: 0; font-size: 14px; color: var(--lc-fg); }
.hn-shake { animation: hn-shake .32s var(--ease-out); }
@keyframes hn-shake { 0%,100% { transform: none; } 25% { transform: translateX(-5px); } 50% { transform: translateX(5px); }
  75% { transform: translateX(-3px); } }

/* 分霊箱カード */
.hn-hxlist { display: flex; flex-direction: column; gap: 12px; }
.hn-hx { display: flex; align-items: center; gap: 14px; width: 100%; padding: 12px; border-radius: var(--radius);
  border: 1px solid var(--lc-border); background: var(--lc-surface); box-shadow: var(--shadow-sm); color: var(--lc-fg);
  text-align: left; cursor: pointer; transition: transform .2s var(--ease-out); }
.hn-hx:active { transform: scale(.99); }
.hn-hx-pic { position: relative; flex-shrink: 0; width: 88px; aspect-ratio: 4 / 5; border-radius: 12px; overflow: hidden; }
.hn-hx-pic .hn-art { height: 100%; }
.hn-hx[data-done] .hn-hx-pic img { filter: grayscale(1); opacity: .55; }
.hn-hx-txt { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hn-hx-name { font-weight: 700; font-size: 16px; line-height: 1.4; letter-spacing: -.015em; }
.hn-hx-place { font-size: 13px; line-height: 1.55; color: var(--lc-fg-muted); }
.hn-hx-place b { color: var(--lc-fg); }
.hn-hx-txt .hn-badge { align-self: flex-start; margin-top: 6px; }
.hn-hx-final { display: block; padding: 0; overflow: hidden; }
.hn-hx-final .hn-hx-pic { width: 100%; height: auto; aspect-ratio: 3 / 2; border-radius: 0; }
.hn-hx-final .hn-hx-pic img { object-position: 50% 40%; }
.hn-hx-final .hn-hx-txt { padding: 14px 16px 16px; }
.hn-hx-final[data-locked] .hn-hx-pic img { filter: grayscale(1); opacity: .45; }
.hn-lock { font-size: 13px; font-weight: 700; color: var(--lc-fg-2); }

/* 下から出るシート */
.hn-sheet { position: fixed; inset: 0; z-index: 30; display: flex; align-items: flex-end; justify-content: center;
  background: color-mix(in srgb, var(--lc-fg) 40%, transparent); }
.hn-sheet[hidden] { display: none; }
.hn-panel { position: relative; width: 100%; max-width: 560px; max-height: 92vh; max-height: 92svh; overflow-y: auto; overscroll-behavior: contain;
  border-radius: 24px 24px 0 0; background: var(--lc-surface); box-shadow: var(--shadow-lg);
  padding-bottom: calc(28px + env(safe-area-inset-bottom, 0px)); animation: hn-up .32s var(--ease-out); }
.hn-panel::before { content: ""; display: block; width: 36px; height: 4px; margin: 10px auto 0; border-radius: 9999px; background: var(--lc-border-strong); }
@keyframes hn-up { from { transform: translateY(40px); opacity: 0; } }
.hn-close { position: absolute; top: 12px; right: 12px; z-index: 4; width: 44px; height: 44px; border-radius: 50%;
  border: 1px solid var(--lc-border); background: var(--lc-surface); color: var(--lc-fg-2); font-size: 18px; line-height: 1; cursor: pointer;
  box-shadow: var(--shadow-xs); }
.hn-sheet-hero { position: relative; display: grid; place-items: center; padding: 24px 20px 8px; }
.hn-sheet-pic { position: relative; width: min(200px, 52vw); max-width: 100%; aspect-ratio: 4 / 5; border-radius: 16px; overflow: hidden;
  box-shadow: var(--shadow-md); }
.hn-sheet-pic .hn-art { height: 100%; }
.hn-sheet-pic[data-wide] { width: 100%; aspect-ratio: 3 / 2; }
.hn-sheet-pic[data-done] img { filter: grayscale(1); opacity: .55; }
.hn-sheet-body { padding: 12px 20px 0; }
.hn-sheet-title { margin: 2px 0 12px; font-weight: 700; font-size: 24px; line-height: 1.4; letter-spacing: -.015em; text-wrap: balance; }
.hn-dl { margin: 0; border-top: 1px solid var(--lc-border); }
.hn-dl dt { margin-top: 14px; font-size: 12px; font-weight: 700; letter-spacing: .04em; color: var(--lc-fg-muted); }
.hn-dl dd { margin: 2px 0 0; font-size: 15px; line-height: 1.7; color: var(--lc-fg); }
.hn-dl dd small { display: block; font-size: 13px; color: var(--lc-fg-muted); }
.hn-veil { font-family: var(--font-latin); font-size: 20px; letter-spacing: .3em; color: var(--lc-fg-subtle); }

.hn-media { position: relative; margin-top: 16px; }
.hn-file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.hn-prev { display: block; width: 100%; max-width: 100%; max-height: 50vh; object-fit: contain; border-radius: 16px; background: var(--lc-muted); }
.hn-note { margin: 8px 0 0; font-size: 13px; color: var(--lc-fg-muted); }
.hn-who { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
.hn-who button { flex-shrink: 0; max-width: 100%; min-height: 44px; padding: 6px 16px; border-radius: 9999px; border: 1px solid var(--lc-border-strong);
  background: var(--lc-surface); color: var(--lc-fg-2); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
.hn-who button[aria-pressed="true"] { background: var(--lime); border-color: var(--lime); color: var(--lc-fg); font-weight: 700; }

/* 分霊箱が割れる演出（光は白とライム） */
.hn-fx { position: fixed; inset: 0; z-index: 40; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 24px; padding: 24px 16px; text-align: center; cursor: pointer; background: var(--lc-bg); animation: hn-fade .24s var(--ease-out); }
@keyframes hn-fade { from { opacity: 0; } }
.hn-stage { position: relative; width: min(200px, 60vw); aspect-ratio: 1; }
.hn-piece { position: absolute; inset: 0; border-radius: 16px; overflow: hidden;
  animation: hn-tremble .9s ease-in-out, hn-fly 1s 1.2s cubic-bezier(.2,.7,.3,1) forwards; }
.hn-piece .hn-art { height: 100%; }
@keyframes hn-tremble { 0%,100% { transform: none; } 15% { transform: translate(-2px,1px) rotate(-1deg); } 35% { transform: translate(3px,-1px) rotate(1deg); }
  55% { transform: translate(-3px,2px) rotate(-1.5deg); } 75% { transform: translate(3px,1px) rotate(1.5deg); } }
@keyframes hn-fly { to { transform: translate(var(--dx), var(--dy)) rotate(var(--r)) scale(.7); opacity: 0; } }
.hn-stage .hn-crack { z-index: 4; animation: hn-out .2s 1.2s forwards; }
.hn-stage .hn-crack path { stroke-width: 2.4; stroke-dasharray: 100; stroke-dashoffset: 100; animation: hn-draw .8s .15s ease-out forwards; }
@keyframes hn-draw { to { stroke-dashoffset: 0; } }
@keyframes hn-out { to { opacity: 0; } }
.hn-flash { position: absolute; inset: -45%; z-index: 5; border-radius: 50%; opacity: 0; pointer-events: none;
  background: radial-gradient(circle, var(--lc-surface) 0%, var(--lime-200) 30%, transparent 66%);
  animation: hn-flash 1s 1s var(--ease-out) forwards; }
@keyframes hn-flash { 0% { opacity: 0; transform: scale(.3); } 30% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.7); } }
.hn-fx-static { display: none; position: relative; width: min(200px, 60vw); aspect-ratio: 1; border-radius: 16px; overflow: hidden; }
.hn-fx-static .hn-art { height: 100%; }
.hn-fx-static img { filter: grayscale(1); opacity: .55; }
.hn-fx-txt { animation: hn-rise .36s 1.7s var(--ease-out) backwards; max-width: 100%; min-width: 0; }
.hn-fx-title { margin: 0; font-weight: 700; font-size: 26px; line-height: 1.4; letter-spacing: -.015em; color: var(--lc-fg); text-wrap: balance; }
.hn-fx-sub { margin: 6px 0 0; font-size: 15px; color: var(--lc-fg-2); }
.hn-fx-tap { margin: 14px 0 0; font-size: 12px; color: var(--lc-fg-subtle); }
@keyframes hn-rise { from { opacity: 0; transform: translateY(12px); } }

/* 手紙が届く演出（白い封筒＋ライムの封蝋） */
.hn-env { position: relative; width: min(280px, 78vw); aspect-ratio: 3 / 2; perspective: 700px; }
.hn-env-back, .hn-env-front, .hn-env-flap { position: absolute; left: 0; right: 0; }
.hn-env-back { inset: 0; border-radius: 12px; background: var(--lc-surface); border: 1px solid var(--lc-border); box-shadow: var(--shadow-lg); }
.hn-env-paper { position: absolute; left: 7%; right: 7%; top: 8%; height: 80%; z-index: 2; padding: 10px 12px; border-radius: 6px;
  background: var(--lc-surface); border: 1px solid var(--lc-border); color: var(--lc-fg); text-align: left;
  font-size: 14px; font-weight: 700; line-height: 1.5; animation: hn-paper .8s 1.15s var(--ease-out) forwards; }
.hn-env-front { inset: 0; z-index: 3; border-radius: 12px; background: var(--lc-muted);
  clip-path: polygon(0 30%, 50% 68%, 100% 30%, 100% 100%, 0 100%); }
.hn-env-flap { top: 0; height: 66%; z-index: 4; background: var(--lc-border); transform-origin: 50% 0;
  clip-path: polygon(0 0, 100% 0, 50% 100%); animation: hn-flap .55s .8s ease-in forwards; }
@keyframes hn-flap { to { transform: rotateX(180deg); opacity: 0; } }
@keyframes hn-paper { to { transform: translateY(-58%); } }
.hn-seal { position: absolute; left: 50%; top: 66%; z-index: 5; width: 56px; height: 56px; margin: -28px 0 0 -28px; }
.hn-seal i { position: absolute; inset: 0; border-radius: 50%; display: grid; place-items: center; font-style: normal;
  background: var(--lime); color: var(--lc-fg); font-family: var(--font-latin); font-weight: 700; font-size: 22px; }
.hn-seal i:first-child { clip-path: polygon(0 0, 52% 0, 44% 30%, 56% 55%, 46% 100%, 0 100%); animation: hn-seal-l .55s .35s ease-in forwards; }
.hn-seal i:last-child { clip-path: polygon(52% 0, 100% 0, 100% 100%, 46% 100%, 56% 55%, 44% 30%); animation: hn-seal-r .55s .35s ease-in forwards; }
@keyframes hn-seal-l { to { transform: translate(-34px, 26px) rotate(-35deg); opacity: 0; } }
@keyframes hn-seal-r { to { transform: translate(34px, 30px) rotate(30deg); opacity: 0; } }

/* クリア画面（白い誌面に写真を 1 枚） */
.hn-clear { position: fixed; inset: 0; z-index: 45; overflow-y: auto; background: var(--lc-bg); animation: hn-fade .36s var(--ease-out); }
.hn-clear-in { position: relative; min-height: 100%; max-width: 560px; margin: 0 auto; display: flex; flex-direction: column;
  justify-content: center; gap: 14px; padding: calc(32px + env(safe-area-inset-top, 0px)) 20px calc(32px + env(safe-area-inset-bottom, 0px)); text-align: left; }
.hn-clear-in > .hn-art { aspect-ratio: 3 / 2; border-radius: 16px; margin-bottom: 10px; box-shadow: var(--shadow-md); }
.hn-clear-in > .hn-art img { object-position: 50% 30%; animation: hn-dawn .36s var(--ease-out); }
@keyframes hn-dawn { from { opacity: 0; transform: scale(1.04); } }
.hn-clear-title { margin: 0; font-weight: 700; font-size: 30px; line-height: 1.35; letter-spacing: -.015em; color: var(--lc-fg);
  animation: hn-rise .36s .2s var(--ease-out) backwards; text-wrap: balance; }
.hn-clear-in p { margin: 0; font-size: 15px; line-height: 1.85; color: var(--lc-fg-2); white-space: pre-line; }
.hn-names { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0 10px; padding-top: 14px; border-top: 1px solid var(--lc-border); }
.hn-name { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-width: 0; padding: 4px 4px 4px 12px; border-radius: 9999px;
  background: var(--lc-muted); font-size: 14px; color: var(--lc-fg); }
.hn-name span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hn-col { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }

.hn-won { overflow: hidden; border-radius: var(--radius); border: 1px solid var(--lime-100); background: var(--lc-surface);
  box-shadow: var(--shadow-sm); margin-bottom: 20px; }
.hn-won > .hn-art { aspect-ratio: 3 / 2; }
.hn-won > .hn-art img { object-position: 50% 35%; }
.hn-won-in { padding: 16px 18px 18px; }
.hn-won-in strong { display: block; font-size: 22px; font-weight: 700; letter-spacing: -.015em; color: var(--lc-fg); line-height: 1.4; }

/* 写真リスト */
.hn-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.hn-list-h { margin: 36px 0 12px; padding-top: 16px; border-top: 1px solid var(--lc-border);
  font-size: 17px; font-weight: 700; letter-spacing: -.015em; color: var(--lc-fg); }
.hn-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 10px; border-radius: 12px;
  border: 1px solid var(--lc-border); background: var(--lc-surface); }
.hn-item[data-done] { background: var(--lc-surface); }
.hn-thumb { position: relative; flex-shrink: 0; width: 56px; height: 56px; border-radius: 12px; overflow: hidden;
  display: grid; place-items: center; background: var(--lc-muted); border: 1px dashed var(--lc-border-strong);
  color: var(--lc-fg-subtle); font-family: var(--font-latin); font-weight: 600; font-size: 18px; }
.hn-thumb img, .hn-thumb video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.hn-thumb[data-done] { border-style: solid; border-color: var(--lime-100); background: var(--lime-50); color: var(--lime-700); }
.hn-item-txt { flex: 1 1 auto; min-width: 0; line-height: 1.45; }
.hn-item-txt b { display: block; font-size: 15px; font-weight: 700; }
.hn-item-txt small { display: block; font-size: 12px; color: var(--lc-fg-muted); }
.hn-item[data-done] .hn-item-txt small { color: var(--lime-700); }
.hn-item .btn { flex-shrink: 0; }
.hn-check { flex-shrink: 0; width: 44px; height: 44px; border-radius: 9999px; border: 1px solid var(--lc-border-strong); background: var(--lc-surface);
  color: var(--lc-fg); font-size: 20px; font-weight: 700; cursor: pointer; transition: background .2s var(--ease-out); }
.hn-check[aria-pressed="true"] { background: var(--lime); border-color: var(--lime); color: var(--lc-fg); }
.hn-total { margin: 0 0 8px; font-size: 15px; font-weight: 700; color: var(--lc-fg-2); }
.hn-total b { font-family: var(--font-latin); font-variant-numeric: tabular-nums; color: var(--lc-fg); font-size: 34px; letter-spacing: -.02em; }
.hn-total-bar { margin: 0 0 12px; }

/* プロローグ */
.hn-pro-top { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; min-height: 44px; }
.hn-pro-top span { flex: 1 1 auto; min-width: 0; font-family: var(--font-latin); font-variant-numeric: tabular-nums; font-size: 13px; color: var(--lc-fg-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hn-pro-top .btn { flex-shrink: 0; }
.hn-slide { overflow: hidden; border-radius: var(--radius); border: 1px solid var(--lc-border); background: var(--lc-surface); box-shadow: var(--shadow-sm); touch-action: pan-y; }
.hn-slide[data-dir="next"] { animation: hn-in-r .32s var(--ease-out); }
.hn-slide[data-dir="prev"] { animation: hn-in-l .32s var(--ease-out); }
@keyframes hn-in-r { from { opacity: 0; transform: translateX(28px); } }
@keyframes hn-in-l { from { opacity: 0; transform: translateX(-28px); } }
.hn-slide-art { position: relative; padding: 12px 12px 0; }
.hn-slide-art > .hn-art { aspect-ratio: 4 / 5; max-height: 54vh; max-height: 54svh; border-radius: 12px; }
.hn-slide-cap { padding: 18px 8px 0; }
.hn-slide-cap h2, .hn-form h2 { margin: 4px 0 0; font-weight: 700; font-size: 24px; line-height: 1.4; letter-spacing: -.015em; text-wrap: balance; }
.hn-slide-txt { margin: 0; padding: 10px 20px 22px; font-size: 15px; line-height: 1.85; color: var(--lc-fg-2); white-space: pre-line; }
.hn-items6 { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-content: center;
  gap: 10px; padding: 16px; }
.hn-items6 .hn-art { aspect-ratio: 4 / 5; max-width: 200px; border-radius: 12px; border: 1px solid var(--lc-border); justify-self: center; }
.hn-nav { display: flex; align-items: center; gap: 10px; margin-top: 16px; }
.hn-nav > .btn { flex-shrink: 0; }
.hn-dots { flex: 1 1 auto; min-width: 0; display: flex; justify-content: center; gap: 6px; }
.hn-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--lc-border-strong); transition: width .24s var(--ease-out); }
.hn-dots i[data-on] { background: var(--lime); width: 20px; border-radius: 9999px; }

.hn-form { padding: 22px 18px; }
.hn-form > p { margin: 6px 0 16px; font-size: 14px; color: var(--lc-fg-muted); }
.hn-players { display: flex; flex-direction: column; gap: 12px; }
.hn-pl { padding: 14px; border-radius: 12px; border: 1px solid var(--lc-border); background: var(--lc-surface); }
.hn-pl label { display: block; margin-bottom: 6px; font-size: 12px; font-weight: 700; color: var(--lc-fg-muted); letter-spacing: .04em; }
.hn-pl .hn-input { width: 100%; }
.hn-houses { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
.hn-houses button { position: relative; min-width: 0; min-height: 48px; padding: 4px 8px 4px 22px; border-radius: 12px; border: 1px solid var(--lc-border);
  background: var(--lc-surface); color: var(--lc-fg-2); line-height: 1.25; text-align: left; cursor: pointer; }
.hn-houses button::before { content: ""; position: absolute; left: 9px; top: 50%; width: 7px; height: 7px; margin-top: -3.5px; border-radius: 50%;
  background: var(--lc-border-strong); }
.hn-houses b, .hn-houses small { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hn-houses b { font-size: 13px; }
.hn-houses small { font-size: 12px; color: var(--lc-fg-muted); }
.hn-houses button[aria-pressed="true"] { background: var(--lime-50); border-color: var(--lime-700); color: var(--lc-fg); box-shadow: inset 0 0 0 1px var(--lime-700); }
.hn-houses [aria-pressed="true"][data-house="gryffindor"]::before { background: var(--gry); }
.hn-houses [aria-pressed="true"][data-house="slytherin"]::before  { background: var(--sly); }
.hn-houses [aria-pressed="true"][data-house="ravenclaw"]::before  { background: var(--rav); }
.hn-houses [aria-pressed="true"][data-house="hufflepuff"]::before { background: var(--huf); }
.hn-start { margin-top: 18px; }
.hn-start .btn { width: 100%; }
.hn-start p { margin: 8px 0 0; font-size: 13px; text-align: center; color: var(--lc-fg-muted); }

.hn-list-h { scroll-margin-top: 72px; }
.hn-item-txt b, .hn-item-txt small { overflow-wrap: anywhere; }
.hn-add { width: 100%; margin: 6px 0 0; }

/* 夜の談話室 */
.hn-nt { border-radius: var(--radius); border: 1px solid var(--lc-border); overflow: hidden; background: var(--lc-surface);
  box-shadow: var(--shadow-sm); padding: 16px; }
.hn-nt-head { display: flex; align-items: center; gap: 12px; }
.hn-moon { flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center;
  color: var(--lc-fg-2); font-size: 22px; line-height: 1; background: var(--lc-muted); }
.hn-nt-txt { flex: 1 1 auto; min-width: 0; line-height: 1.4; }
.hn-nt-txt strong { display: block; font-size: 17px; font-weight: 700; letter-spacing: -.015em; color: var(--lc-fg); }
.hn-nt-txt span { display: block; font-size: 13px; color: var(--lc-fg-muted); }
.hn-nt-num { flex-shrink: 0; white-space: nowrap; font-family: var(--font-latin); font-variant-numeric: tabular-nums; font-weight: 600; font-size: 14px; color: var(--lc-fg-muted); }
.hn-nt-num b { font-size: 24px; font-weight: 700; color: var(--lc-fg); }
.hn-nt-prog { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.hn-bar { flex: 1 1 auto; min-width: 0; height: 6px; border-radius: 9999px; background: var(--lc-muted); overflow: hidden; }
.hn-bar i { display: block; height: 100%; border-radius: inherit; background: var(--lime); transition: width .36s var(--ease-out); }
.hn-nt-list { margin: 12px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
.hn-nt-list li { flex-shrink: 0; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  padding: 3px 10px; border-radius: 9999px; border: 1px solid transparent; background: var(--lc-muted); font-size: 12px; color: var(--lc-fg-2); }
.hn-nt-list li[data-done] { background: var(--lime-50); border-color: var(--lime-100); color: var(--lime-900); }
.hn-glyph { width: 80px; height: 80px; border-radius: 50%; display: grid; place-items: center; font-size: 34px; line-height: 1;
  color: var(--lime-900); background: var(--lime-50); border: 1px solid var(--lime-100); }
.hn-sheet-kicker { display: block; }
.hn-warn { margin: 14px 0 0; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--danger); background: var(--lc-surface); font-size: 14px; color: var(--lc-fg); }
.hn-field { display: block; margin-top: 16px; }
.hn-field > span { display: block; margin-bottom: 6px; font-size: 12px; font-weight: 700; letter-spacing: .04em; color: var(--lc-fg-muted); }
.hn-addform .hn-input { display: block; width: 100%; }
textarea.hn-input { min-height: 72px; resize: vertical; line-height: 1.5; }
.hn-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.hn-groups button { min-width: 0; min-height: 44px; padding: 4px 10px; border-radius: 9999px; border: 1px solid var(--lc-border-strong);
  background: var(--lc-surface); color: var(--lc-fg-2); font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; cursor: pointer; }
.hn-groups button[aria-pressed="true"] { background: var(--lime); border-color: var(--lime); color: var(--lc-fg); }
.hn-del { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--lc-border); }
.hn-del > .btn { color: var(--danger); }

@media (prefers-reduced-motion: reduce) {
  .hn-stage { display: none; }
  .hn-fx-static { display: block; }
  .hn-env-flap, .hn-seal { display: none; }
  .hn-panel, .hn-slide, .hn-fx, .hn-clear, .hn-clear-title, .hn-clear-in > .hn-art img, .hn-fx-txt { animation: none; }
}
`;

  /* ---------- 状態 ---------- */
  function hunt() {
    const s = HP.state;
    if (!s.hunt) s.hunt = {};
    const H = s.hunt;
    if (!H.letters) H.letters = {};
    if (!H.horcrux) H.horcrux = {};
    if (!H.extra) H.extra = {};
    if (!H.shots || typeof H.shots !== "object") H.shots = {};
    if (!Array.isArray(H.custom)) H.custom = [];
    return H;
  }
  const rec = (id) => hunt().letters[id] || null;
  const recW = (id) => { const H = hunt(); return H.letters[id] || (H.letters[id] = {}); };
  const delivered = (L, now) => isDelivered(L, now, rec(L.id));
  const opened = (L) => !!(rec(L.id) && rec(L.id).openedAt);
  const arrived = (now) => delivered(LT[ARRIVAL], now);
  const solvedOrGiven = (L) => { const r = rec(L.id); return !!(r && (r.solved || r.gaveUp)); };
  function revealed(x, now) {
    if (arrived(now)) return true;
    return !!(x.letter && solvedOrGiven(LT[x.letter]));
  }
  const isDone = (x) => !!hunt().horcrux[x.id];
  const doneCount = () => HORCRUXES.filter(isDone).length;
  const allDone = () => doneCount() === HORCRUXES.length;
  const finalLocked = () => HORCRUXES.filter((x) => !x.final && !isDone(x)).length > 0;
  const riddleOf = (hxId) => LETTERS.find((L) => L.riddle && L.riddle.hx === hxId);

  let selfSaving = false;
  function save() { selfSaving = true; try { HP.save(); } finally { selfSaving = false; } }

  /* ---------- 共通部品 ---------- */
  function art(name, cls, alt) {
    const wrap = h("div", { class: "hn-art" + (cls ? " " + cls : "") });
    const img = h("img", { src: "img/" + name + ".jpg", alt: alt || "", decoding: "async" });
    img.addEventListener("error", () => { img.remove(); wrap.classList.add("hn-miss"); });
    wrap.append(img);
    return wrap;
  }
  function crack() { const s = h("span", { class: "hn-crack" }); s.innerHTML = CRACK; return s; }
  function badge(text, tone) { return h("span", { class: "hn-badge", "data-tone": tone || null }, text); }

  let locks = 0;
  function lockScroll(on) {
    locks = Math.max(0, locks + (on ? 1 : -1));
    G.document.documentElement.style.overflow = locks ? "hidden" : "";
  }

  /* ---------- 画面の状態 ---------- */
  const ui = {
    view: "hq",          // hq | list
    slide: 0, dir: null, replay: false,
    expanded: {},
    drafts: {}, wrong: {}, giveUp: null, confirmUndo: null,
    sheet: null,         // 分霊箱 id | "nt-<id>" | "cm-<id>" | "add"
    confirmDel: null,
    add: { title: "", tip: "", group: "other", err: false },
  };
  let root = null, sheetHost = null, lastKey = "";

  function renderAll() { render(); renderSheet(); }
  function render() {
    if (!root) return;
    const H = hunt();
    if (!H.prologueDone || ui.replay) root.replaceChildren(h("div", { class: "hn" }, prologue()));
    else root.replaceChildren(h("div", { class: "hn" }, steps(), seg(), ui.view === "list" ? photoList() : hq()));
  }

  function steps() {
    const H = hunt();
    const phase = !H.prologueDone ? 0 : !arrived() ? 1 : !allDone() ? 2 : 3;
    const names = ["依頼", "ふくろう便", "分霊箱狩り", "決着"];
    return h("ol", { class: "hn-steps", "aria-label": "冒険の進み具合" },
      names.map((n, i) => h("li", { "data-on": i === phase, "data-done": i < phase, "aria-current": i === phase ? "step" : null }, n)));
  }
  function seg() {
    const b = (v, label) => h("button", { type: "button", "aria-pressed": String(ui.view === v),
      onclick: () => { ui.view = v; render(); G.scrollTo(0, 0); } }, label);
    return h("div", { class: "hn-seg", role: "group", "aria-label": "表示の切り替え" }, b("hq", "ハント本部"), b("list", "写真リスト"));
  }

  /* ================= プロローグ ================= */
  const SLIDES = [
    { img: "castle", kicker: "ふくろう便 第0号", title: "ダンブルドアからの依頼",
      text: "親愛なる4人の魔法使いへ。\n魔法界の運命をかけた仕事を、きみたちに頼みたい。明日の朝、品川から西へ向かう旅が、そのまま冒険になる。" },
    { img: "wizard", kicker: "依頼人と、闇の帝王", title: "名前を言ってはいけないあの人",
      text: "わしはアルバス・ダンブルドア。魔法学校ホグワーツの校長じゃ。\n敵の名はヴォルデモート。だれもが名前を口にするのを恐れる、史上最悪の闇の魔法使いじゃ。" },
    { items: true, kicker: "やつが死なない理由", title: "7つの分霊箱",
      text: "やつは自分の魂を7つに裂き、日記や指輪などの品物に隠した。これを分霊箱（ホークラックス）という。\n7つすべてを壊さないかぎり、やつは決して倒れない。" },
    { img: "owl", kicker: "今日の任務", title: "謎を解き、写真で砕け",
      text: "新幹線が駅を過ぎるたび、ふくろう便が謎を運んでくる。謎を解けば、分霊箱の隠し場所がわかる。\nユニバでそれを見つけて写真に収めよ。写した瞬間、分霊箱は砕け散る。" },
    { img: "train", kicker: "出発", title: "6時40分、品川",
      text: "乗るのは、のぞみ号。発車の前に、最初の指令「出発の儀」が待っている。\nホームに着いたら、ハント本部を開くのじゃ。" },
    { form: true },
  ];

  function go(i) {
    const n = Math.max(0, Math.min(SLIDES.length - 1, i));
    if (n === ui.slide) return;
    ui.dir = n > ui.slide ? "next" : "prev";
    ui.slide = n;
    render();
    G.scrollTo(0, 0);
  }

  function prologue() {
    const i = ui.slide, s = SLIDES[i];
    const top = h("div", { class: "hn-pro-top" },
      h("span", null, "プロローグ " + (i + 1) + " / " + SLIDES.length),
      ui.replay ? h("button", { type: "button", class: "btn ghost hn-s", onclick: closeReplay }, "本部へ戻る") : null);

    let card;
    if (s.form) card = playersForm();
    else {
      const visual = s.items
        ? h("div", { class: "hn-art hn-r45" }, h("div", { class: "hn-items6" },
            HORCRUXES.filter((x) => !x.final).map((x) => art(x.img, "", x.name))))
        : art(s.img, "", "");
      card = h("div", { class: "hn-slide" },
        h("div", { class: "hn-slide-art" }, visual,
          h("div", { class: "hn-slide-cap" }, h("span", { class: "eyebrow hn-kicker" }, s.kicker), h("h2", null, s.title))),
        h("p", { class: "hn-slide-txt" }, s.text));
    }
    card.classList.add("hn-slide");
    if (ui.dir) card.setAttribute("data-dir", ui.dir);
    ui.dir = null;

    if (!s.form) {
      let sx = 0, sy = 0;
      card.addEventListener("touchstart", (e) => { const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
      card.addEventListener("touchend", (e) => {
        const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) go(i + (dx < 0 ? 1 : -1));
      }, { passive: true });
    }

    const nav = h("div", { class: "hn-nav" },
      h("button", { type: "button", class: "btn ghost", disabled: i === 0, onclick: () => go(i - 1) }, "もどる"),
      h("div", { class: "hn-dots", "aria-hidden": "true" }, SLIDES.map((_, k) => h("i", { "data-on": k === i }))),
      s.form ? h("span", { style: { width: "84px", flexShrink: "0" } })
        : h("button", { type: "button", class: "btn", onclick: () => go(i + 1) }, "次へ"));
    return [top, card, nav];
  }

  function playersForm() {
    const H = hunt();
    const ready = () => HP.state.players.filter((p) => (p.name || "").trim()).length >= 2;
    let timer = null;
    const startBtn = h("button", { type: "button", class: "btn", disabled: !ready(), onclick: begin },
      ui.replay ? "本部へ戻る" : "依頼を引き受ける");
    const rows = HP.state.players.map((p, idx) => {
      const id = "hn-pl-" + p.id;
      const input = h("input", { id, class: "hn-input", type: "text", value: p.name || "", maxlength: "12",
        autocomplete: "off", enterkeyhint: "next", placeholder: "名前（あだ名でも）" });
      input.addEventListener("input", () => {
        p.name = input.value;
        startBtn.disabled = !ready();
        clearTimeout(timer); timer = setTimeout(save, 300);
      });
      const houses = h("div", { class: "hn-houses", role: "group", "aria-label": (idx + 1) + "人目の寮" },
        Object.values(HP.HOUSES).map((ho) => h("button", { type: "button", "data-house": ho.id, "aria-pressed": String(p.house === ho.id),
          onclick: () => { p.name = input.value; p.house = p.house === ho.id ? null : ho.id; save(); render(); } },
          h("b", null, ho.jp), h("small", null, ho.trait))));
      return h("div", { class: "hn-pl" }, h("label", { for: id }, (idx + 1) + "人目"), input, houses);
    });
    function begin() {
      if (!ready()) return;
      clearTimeout(timer);
      H.prologueDone = true;
      save();
      if (ui.replay) { closeReplay(); return; }
      ui.slide = 0;
      render();
      G.scrollTo(0, 0);
      HP.toast("最初のふくろう便が届いている");
    }
    return h("div", { class: "hn-form" },
      h("span", { class: "eyebrow hn-kicker" }, "最後に"),
      h("h2", null, "4人の名を記せ"),
      h("p", null, "寮は、ホグワーツの4つのチーム。直感で選べばいい。"),
      h("div", { class: "hn-players" }, rows),
      h("div", { class: "hn-start" }, startBtn, h("p", null, "2人以上の名前で始められる")));
  }
  function openReplay() { ui.replay = true; ui.slide = 0; ui.dir = null; render(); G.scrollTo(0, 0); }
  function closeReplay() { ui.replay = false; ui.slide = 0; render(); G.scrollTo(0, 0); }

  /* ================= ハント本部 ================= */
  function hq() {
    const H = hunt();
    const out = [];
    const left = HORCRUXES.length - doneCount();

    if (allDone()) {
      out.push(h("div", { class: "hn-won" }, art("final", "", "朝日が差す城"),
        h("div", { class: "hn-won-in" },
          h("strong", null, "闇の帝王は倒れた"),
          h("div", { class: "hn-row" },
            h("button", { type: "button", class: "btn", onclick: () => HP.go("paper") }, "号外を刷る"),
            h("button", { type: "button", class: "btn ghost", onclick: showClear }, "勝利の瞬間をもう一度")))));
    }

    out.push(h("div", { class: "hn-hero" }, art("castle", "", ""),
      h("div", { class: "hn-hero-in" },
        h("span", { class: "eyebrow hn-kicker" }, "残る分霊箱"),
        h("p", { class: "hn-count" }, left ? ["あと", h("b", null, String(left)), "つ"] : "すべて砕いた"),
        h("div", { class: "hn-hero-bar", "aria-hidden": "true" },
          h("div", { class: "hn-bar" }, h("i", { style: { width: Math.round((doneCount() / HORCRUXES.length) * 100) + "%" } })),
          h("span", null, doneCount() + " / " + HORCRUXES.length)),
        h("ul", { class: "hn-icons", "aria-label": "分霊箱 " + doneCount() + " / 7 を破壊" },
          HORCRUXES.map((x) => h("li", { class: "hn-ico", "data-done": isDone(x), title: x.name },
            art(x.img, "", x.name + (isDone(x) ? "（破壊済み）" : "")), isDone(x) ? crack() : null))),
        h("div", { class: "hn-hero-row" },
          h("button", { type: "button", class: "btn ghost hn-s", onclick: openReplay }, "依頼を読み返す")))));

    const unopened = LETTERS.filter((L) => delivered(L) && !opened(L));
    if (unopened.length) {
      const L = unopened[0];
      out.push(h("div", { class: "hn-new", role: "status" },
        h("div", { class: "hn-new-txt" },
          h("strong", null, "ふくろう便が届いた！"),
          h("span", null, L.label + "・" + L.station + (unopened.length > 1 ? "　ほか" + (unopened.length - 1) + "通" : ""))),
        h("button", { type: "button", class: "btn", onclick: () => openLetter(L) }, "封を切る")));
    }

    out.push(h("section", { class: "hn-sec", "aria-labelledby": "hn-h-owl" },
      h("span", { class: "eyebrow", "aria-hidden": "true" }, "OWL POST"),
      h("h2", { class: "hn-sec-h", id: "hn-h-owl" }, "ふくろう便"),
      h("p", { class: "hn-sec-note" }, "品川から新大阪まで。時刻はおおよその予定。"),
      h("ol", { class: "hn-tl" }, LETTERS.map(letterItem))));

    out.push(h("section", { class: "hn-sec", "aria-labelledby": "hn-h-hx" },
      h("span", { class: "eyebrow", "aria-hidden": "true" }, "HORCRUXES"),
      h("h2", { class: "hn-sec-h", id: "hn-h-hx" }, "分霊箱"),
      h("p", { class: "hn-sec-note" }, "謎を解くと隠し場所がわかる。見つけたら写真で砕け。"),
      h("div", { class: "hn-hxlist" }, HORCRUXES.map(hxCard))));

    out.push(h("section", { class: "hn-sec", "aria-labelledby": "hn-h-night" },
      h("span", { class: "eyebrow", "aria-hidden": "true" }, "COMMON ROOM"),
      h("h2", { class: "hn-sec-h", id: "hn-h-night" }, "夜の談話室（民泊）"),
      h("p", { class: "hn-sec-note" }, allDone()
        ? "闇の帝王は倒れた。今夜は民泊で祝勝会じゃ。"
        : "分霊箱をすべて砕いたあとの祝勝会。撮影はいつでもできる。"),
      nightCard()));

    const cs = customList(H), cDone = cs.filter((c) => !!H.shots["cm-" + c.id]).length;
    out.push(h("section", { class: "hn-sec", "aria-labelledby": "hn-h-custom" },
      h("span", { class: "eyebrow", "aria-hidden": "true" }, "MISSIONS"),
      h("h2", { class: "hn-sec-h", id: "hn-h-custom" }, "自分たちのミッション"),
      h("p", { class: "hn-sec-note" }, cs.length
        ? "追加したミッション " + cs.length + "件・撮影済み " + cDone + "件"
        : "撮りたいものを思いついたら、ミッションにして足せる。"),
      h("div", { class: "hn-row", style: { marginTop: 0 } },
        h("button", { type: "button", class: "btn ghost hn-s", onclick: openAdd }, "＋ ミッションを追加"),
        cs.length ? h("button", { type: "button", class: "btn ghost hn-s", onclick: () => gotoList("hn-l-top") }, "写真リストへ") : null)));
    return out;
  }

  function nightCard() {
    const H = hunt();
    const n = NIGHT.filter((m) => !!H.shots["nt-" + m.id]).length;
    return h("div", { class: "hn-nt" },
      h("div", { class: "hn-nt-head" },
        h("span", { class: "hn-moon", "aria-hidden": "true" }, "☾"),
        h("span", { class: "hn-nt-txt" }, h("strong", null, "祝勝会ミッション"), h("span", null, "お酒が苦手ならジュースで乾杯"))),
      h("div", { class: "hn-nt-prog" },
        h("div", { class: "hn-bar", "aria-hidden": "true" }, h("i", { style: { width: Math.round((n / NIGHT.length) * 100) + "%" } })),
        h("span", { class: "hn-nt-num", "aria-label": NIGHT.length + "個中" + n + "個撮影済み" }, h("b", null, String(n)), " / " + NIGHT.length)),
      h("ul", { class: "hn-nt-list", "aria-label": "ミッション一覧" },
        NIGHT.map((m) => h("li", { "data-done": !!H.shots["nt-" + m.id] }, (H.shots["nt-" + m.id] ? "✓ " : "") + m.title))),
      h("div", { class: "hn-row" },
        h("button", { type: "button", class: "btn hn-s", onclick: () => gotoList("hn-l-night") }, "談話室ミッションを見る")));
  }
  function gotoList(anchor) {
    ui.view = "list"; render();
    G.requestAnimationFrame(() => {
      const el = root && root.querySelector("#" + anchor);
      if (el) el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
      else G.scrollTo(0, 0);
    });
  }

  function letterStatus(L) {
    if (!delivered(L)) return ["wait", badge("未着")];
    if (!opened(L)) return ["new", badge("未開封", "gold")];
    const r = rec(L.id) || {};
    if (L.riddle && !(r.solved || r.gaveUp)) return ["open", badge("謎あり")];
    if (L.photo && !r.photoAt) return ["open", badge("指令あり")];
    return ["open", badge(r.solved || !L.riddle ? "達成" : "答えを見た", "done")];
  }

  function letterItem(L, idx) {
    const [st, b] = letterStatus(L);
    const name = h("span", { class: "hn-lt-name" }, h("span", { class: "eyebrow", "aria-hidden": "true" }, "LETTER " + String(idx).padStart(2, "0")),
      h("b", null, L.station), h("small", null, L.label + "・" + L.sub));
    const time = h("span", { class: "hn-time" }, L.time.replace("ごろ", "頃"));
    let head, body = null;
    if (st === "open") {
      const ex = !!ui.expanded[L.id];
      head = h("button", { type: "button", class: "hn-lt-head", "aria-expanded": String(ex),
        onclick: () => { ui.expanded[L.id] = !ex; render(); } }, time, name, b);
      if (ex) body = h("div", { class: "hn-lt-body" }, letterContent(L));
    } else {
      head = h("div", { class: "hn-lt-head" }, time, name, b);
      if (st === "wait") {
        body = h("div", { class: "hn-lt-body" },
          h("p", { class: "hn-eta", "data-eta": L.id }, etaText(L)),
          h("button", { type: "button", class: "btn ghost hn-s hn-wide", onclick: () => forceDeliver(L) }, "もう届いたことにする"));
      } else {
        body = h("div", { class: "hn-lt-body" },
          h("div", { class: "hn-sealed" }, h("span", { class: "hn-mini-seal", "aria-hidden": "true" }, "D"),
            h("p", null, "封蝋つきの手紙が届いている。")),
          h("button", { type: "button", class: "btn hn-wide", onclick: () => openLetter(L) }, "封を切る"));
      }
    }
    return h("li", { class: "hn-lt", "data-st": st, "data-letter": L.id }, h("div", { class: "hn-lt-card" }, head, body));
  }

  function letterContent(L) {
    const out = [h("div", { class: "parchment hn-paper" },
      h("span", { class: "eyebrow hn-kicker" }, "ふくろう便 " + L.label + "　" + L.station + " " + L.time),
      h("h3", null, L.title),
      h("p", null, L.body),
      L.orders ? h("ol", null, L.orders.map((o) => h("li", null, o))) : null,
      h("p", { class: "hn-sign" }, "— A. ダンブルドア"))];
    if (L.photo) {
      const r = rec(L.id) || {};
      out.push(h("div", { class: "hn-block" },
        h("span", { class: "hn-label" }, "指令"),
        h("p", { class: "hn-q" }, L.photo.text),
        h("p", { class: "hn-tip" }, "撮り方：" + L.photo.tip),
        mediaBlock(L.photo.key, {
          done: !!r.photoAt,
          onFile: (f) => shootLetter(L, f),
          onUndo: () => undoLetter(L),
          undoText: "この指令の写真を消して、未達成に戻す？",
        })));
    }
    if (L.riddle) out.push(riddleBlock(L));
    return out;
  }

  function riddleBlock(L) {
    const R = L.riddle, r = rec(L.id) || {}, x = HX[R.hx];
    const box = h("div", { class: "hn-block" }, h("span", { class: "hn-label" }, "謎" + R.n + "・" + R.kind), h("p", { class: "hn-q" }, R.q));
    if (r.solved || r.gaveUp) {
      box.append(h("div", { class: "hn-reveal" },
        h("p", { style: { margin: "0 0 4px" } }, (r.solved ? "正解！ 答えは「" : "答えは「") + R.answer + "」"),
        h("strong", null, x.name + "の隠し場所：" + x.place),
        h("p", null, x.placeNote),
        h("div", { class: "hn-row" }, h("button", { type: "button", class: "btn hn-s", onclick: () => openSheet(x.id) }, "分霊箱カードを開く"))));
      return box;
    }
    const input = h("input", { class: "hn-input", type: "text", value: ui.drafts[L.id] || "", autocomplete: "off",
      autocapitalize: "off", spellcheck: "false", enterkeyhint: "done", placeholder: "答えを入力", "aria-label": "謎" + R.n + "の答え" });
    input.addEventListener("input", () => { ui.drafts[L.id] = input.value; });
    if (R.choices) {
      box.append(h("div", { class: "hn-choices" }, R.choices.map((c, k) => h("button", { type: "button",
        onclick: () => { input.value = c; ui.drafts[L.id] = c; input.focus(); } }, h("b", null, "ABCD"[k]), c))));
    }
    const form = h("form", { class: "hn-ans" + (ui.wrong[L.id] === 1 ? " hn-shake" : ""), onsubmit: (e) => {
      e.preventDefault();
      if (!normalize(input.value)) { input.focus(); return; }
      if (checkAnswer(R, input.value)) {
        recW(L.id).solved = new Date().toISOString();
        delete ui.wrong[L.id];
        save(); render();
        HP.toast("正解！ " + x.name + "の隠し場所が明らかになった");
      } else { ui.wrong[L.id] = 1; render(); ui.wrong[L.id] = 2; }
    } }, input, h("button", { type: "submit", class: "btn" }, "答える"));
    box.append(form);
    if (ui.wrong[L.id]) box.append(h("p", { class: "hn-msg", role: "alert" }, "ちがうようだ。もう一度考えてみよう。"));
    if (r.hint) box.append(h("p", { class: "hn-hint" }, "ヒント：" + R.hint));
    if (ui.giveUp === L.id) {
      box.append(h("div", { class: "hn-confirm" },
        h("p", null, "答えを見ると、自力で解いた印は付かない。それでも見る？"),
        h("div", { class: "hn-row" },
          h("button", { type: "button", class: "btn hn-s", onclick: () => {
            recW(L.id).gaveUp = new Date().toISOString(); ui.giveUp = null; save(); render(); } }, "答えを見る"),
          h("button", { type: "button", class: "btn ghost hn-s", onclick: () => { ui.giveUp = null; render(); } }, "やめる"))));
    } else {
      box.append(h("div", { class: "hn-row" },
        r.hint ? null : h("button", { type: "button", class: "btn ghost hn-s", onclick: () => { recW(L.id).hint = true; save(); render(); } }, "ヒント"),
        h("button", { type: "button", class: "btn ghost hn-s", onclick: () => { ui.giveUp = L.id; render(); } }, "降参（答えを見る）")));
    }
    return box;
  }

  function hxCard(x) {
    const done = isDone(x), rev = revealed(x), locked = x.final && finalLocked();
    const H = hunt(), by = done && H.horcrux[x.id].by;
    const pic = h("div", { class: "hn-hx-pic" }, art(x.img, "", ""), done ? crack() : null);
    const place = rev ? h("span", { class: "hn-hx-place" }, h("b", null, x.place))
      : h("span", { class: "hn-hx-place" }, h("b", null, "？？？"), "　" + x.veil);
    const byTxt = by ? (by === "all" ? "みんなで" : (HP.player(by) && HP.player(by).name) || "") : "";
    const st = done ? badge("破壊済み" + (byTxt ? "・" + byTxt : ""), "done") : locked ? badge("封印中") : badge("未破壊");
    return h("button", { type: "button", class: "hn-hx" + (x.final ? " hn-hx-final" : ""), "data-done": done, "data-locked": locked,
      onclick: () => openSheet(x.id) }, pic, h("span", { class: "hn-hx-txt" },
        h("span", { class: "eyebrow" }, "HORCRUX " + x.n + "/" + HORCRUXES.length),
        h("span", { class: "hn-hx-name" }, x.name), place,
        locked ? h("span", { class: "hn-lock" }, "1〜6を砕くと解ける") : null, st));
  }

  /* ---------- 写真・動画の保存部品 ---------- */
  function mediaBlock(key, o) {
    const m = HP.media.get(key);
    const wrap = h("div", { class: "hn-media" });
    const input = h("input", { type: "file", accept: "image/*,video/*", class: "hn-file", tabindex: "-1", "aria-hidden": "true" });
    const pick = h("button", { type: "button", class: "btn", onclick: () => input.click() },
      o.done ? "撮り直す・選び直す" : "写真/動画を撮る・選ぶ");
    input.addEventListener("change", async () => {
      const f = input.files && input.files[0];
      input.value = "";
      if (!f) return;
      pick.disabled = true; pick.textContent = "保存中…";
      try { await o.onFile(f); } finally { pick.disabled = false; }
    });
    if (m) wrap.append(HP.media.el(key, m.kind === "video" ? { class: "hn-prev", controls: true } : { class: "hn-prev", alt: "撮った写真" }));
    if (m && m.kind === "video") wrap.append(h("p", { class: "hn-note" }, "動画はこの画面を閉じると消える。カメラロールにも残しておこう。"));
    if (o.done && !m) wrap.append(h("p", { class: "hn-note" }, "達成済み（写真はこの端末に残っていない）"));
    if (o.extra) wrap.append(o.extra);
    if (ui.confirmUndo === key) {
      wrap.append(h("div", { class: "hn-confirm" }, h("p", null, o.undoText),
        h("div", { class: "hn-row" },
          h("button", { type: "button", class: "btn hn-s", onclick: () => { ui.confirmUndo = null; o.onUndo(); } }, "取り消す"),
          h("button", { type: "button", class: "btn ghost hn-s", onclick: () => { ui.confirmUndo = null; renderAll(); } }, "やめる"))));
    } else {
      wrap.append(h("div", { class: "hn-row" }, pick,
        o.done ? h("button", { type: "button", class: "btn ghost", onclick: () => { ui.confirmUndo = key; renderAll(); } }, "取り消す") : null));
    }
    wrap.append(input);
    return wrap;
  }
  async function putMedia(key, file) {
    try { return await HP.media.put(key, file); }
    catch (e) { HP.toast("読み込めなかった。別の写真で試そう"); return null; }
  }
  async function shootLetter(L, file) {
    const r = await putMedia(L.photo.key, file);
    if (!r) return;
    const R = recW(L.id), first = !R.photoAt;
    R.photoAt = new Date().toISOString();
    save(); renderAll();
    HP.toast(!r.saved && r.kind === "image" ? "容量がいっぱい。写真はこの画面を閉じると消える" : first ? "指令達成！ " + L.photo.title : "撮り直した");
  }
  function undoLetter(L) {
    HP.media.remove(L.photo.key);
    delete recW(L.id).photoAt;
    save(); renderAll();
    HP.toast("取り消した");
  }
  async function shootHorcrux(x, file) {
    const r = await putMedia("hx-" + x.id, file);
    if (!r) return;
    const H = hunt(), was = H.horcrux[x.id];
    H.horcrux[x.id] = { doneAt: new Date().toISOString(), by: was ? was.by || null : null };
    save(); renderAll();
    const warn = !r.saved && r.kind === "image" ? "容量がいっぱい。写真はこの画面を閉じると消える" : null;
    if (was) HP.toast(warn || "撮り直した");
    else playBreak(x, warn);
  }
  function undoHorcrux(x) {
    const H = hunt();
    HP.media.remove("hx-" + x.id);
    delete H.horcrux[x.id];
    if (!allDone()) H.clearSeen = false;
    save(); renderAll();
    HP.toast("取り消した。分霊箱は元に戻った");
  }

  /* 夜の談話室・追加ミッションを 1 つの形で扱う */
  function missionOf(key) {
    if (typeof key !== "string") return null;
    if (key.indexOf("nt-") === 0) {
      const n = NIGHT.find((m) => "nt-" + m.id === key);
      return n ? { key, title: n.title, kind: n.kind, shot: n.shot, tip: n.tip, note: n.note || null,
        kicker: "夜の談話室（民泊）", glyph: "☾", custom: null } : null;
    }
    if (key.indexOf("cm-") === 0) {
      const c = customList(hunt()).find((x) => "cm-" + x.id === key);
      return c ? { key, title: c.title, kind: "写真", shot: null, tip: c.tip || "", note: null,
        kicker: "追加したミッション・" + groupLabel(c.group), glyph: "✦", custom: c } : null;
    }
    return null;
  }
  async function shootMission(m, file) {
    const r = await putMedia(m.key, file);
    if (!r) return;
    const H = hunt(), first = !H.shots[m.key];
    H.shots[m.key] = new Date().toISOString();
    save(); renderAll();
    HP.toast(!r.saved && r.kind === "image" ? "容量がいっぱい。写真はこの画面を閉じると消える" : first ? "撮影完了！ " + m.title : "撮り直した");
  }
  function undoMission(m) {
    HP.media.remove(m.key);
    delete hunt().shots[m.key];
    save(); renderAll();
    HP.toast("取り消した");
  }
  function deleteCustom(m) {
    HP.media.remove(m.key);
    removeCustom(hunt(), m.custom.id);
    ui.confirmDel = null;
    save();
    closeSheet();
    HP.toast("ミッションを削除した");
  }
  function openAdd() {
    ui.add = { title: "", tip: "", group: (ui.add && ui.add.group) || "other", err: false };
    openSheet("add");
    G.requestAnimationFrame(() => { const t = sheetHost && sheetHost.querySelector("#hn-add-title"); if (t) t.focus({ preventScroll: true }); });
  }

  function missionSheetBody(m) {
    const H = hunt(), done = !!H.shots[m.key];
    const body = h("div", { class: "hn-sheet-body" },
      h("span", { class: "eyebrow hn-sheet-kicker" }, m.kicker),
      h("h2", { class: "hn-sheet-title", id: "hn-sheet-t" }, m.title));
    const dl = h("dl", { class: "hn-dl" });
    if (m.shot) dl.append(h("dt", null, "撮る" + m.kind), h("dd", null, m.shot));
    if (m.tip) dl.append(h("dt", null, "撮影のコツ"), h("dd", null, m.tip));
    if (dl.childNodes.length) body.append(dl);
    if (m.note) body.append(h("p", { class: "hn-warn" }, m.note));
    body.append(mediaBlock(m.key, {
      done,
      onFile: (f) => shootMission(m, f),
      onUndo: () => undoMission(m),
      undoText: "この写真を消して、未撮影に戻す？",
    }));
    if (m.custom) {
      const del = h("div", { class: "hn-del" });
      if (ui.confirmDel === m.key) {
        del.append(h("div", { class: "hn-confirm", role: "alert" },
          h("p", null, "「" + m.title + "」を削除する？" + (done ? "撮った写真も消える。" : "")),
          h("div", { class: "hn-row" },
            h("button", { type: "button", class: "btn hn-s", onclick: () => deleteCustom(m) }, "削除する"),
            h("button", { type: "button", class: "btn ghost hn-s", onclick: () => { ui.confirmDel = null; renderSheet(); } }, "やめる"))));
      } else {
        del.append(h("button", { type: "button", class: "btn ghost hn-s hn-wide",
          onclick: () => { ui.confirmDel = m.key; ui.confirmUndo = null; renderSheet(); } }, "このミッションを削除"));
      }
      body.append(del);
    }
    return body;
  }

  function addSheetBody() {
    const A = ui.add;
    const title = h("input", { id: "hn-add-title", class: "hn-input", type: "text", value: A.title, maxlength: "40",
      autocomplete: "off", enterkeyhint: "next", placeholder: "例：ダイアゴン横丁で杖を交差", required: true,
      "aria-invalid": A.err ? "true" : null, "aria-describedby": A.err ? "hn-add-err" : null });
    title.addEventListener("input", () => { A.title = title.value; });
    const tip = h("textarea", { id: "hn-add-tip", class: "hn-input", maxlength: "120", rows: "2",
      placeholder: "例：杖の先を中央に集めて、下から煽る" });
    tip.value = A.tip;
    tip.addEventListener("input", () => { A.tip = tip.value; });
    const groups = h("div", { class: "hn-groups", role: "group", "aria-label": "セクション" },
      CUSTOM_GROUPS.map((g) => h("button", { type: "button", "data-g": g.id, "aria-pressed": String(A.group === g.id),
        onclick: () => {
          A.group = g.id;
          groups.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-g") === g.id)));
        } }, g.label)));
    const form = h("form", { class: "hn-addform", novalidate: true, onsubmit: (e) => {
      e.preventDefault();
      A.title = title.value; A.tip = tip.value;
      const item = addCustom(hunt(), { title: A.title, tip: A.tip, group: A.group });
      if (!item) { A.err = true; renderSheet(); const t = sheetHost.querySelector("#hn-add-title"); if (t) t.focus(); return; }
      ui.add = { title: "", tip: "", group: A.group, err: false };
      save();
      closeSheet();
      HP.toast("ミッションを追加した：" + item.title);
    } },
      h("label", { class: "hn-field", for: "hn-add-title" }, h("span", null, "タイトル（必須）")),
      title,
      A.err ? h("p", { class: "hn-msg", id: "hn-add-err", role: "alert" }, "タイトルを入れてね") : null,
      h("label", { class: "hn-field", for: "hn-add-tip" }, h("span", null, "撮影のコツ（任意）")),
      tip,
      h("div", { class: "hn-field" }, h("span", null, "セクション")),
      groups,
      h("div", { class: "hn-row", style: { marginTop: "18px" } },
        h("button", { type: "submit", class: "btn" }, "追加する"),
        h("button", { type: "button", class: "btn ghost", onclick: closeSheet }, "やめる")));
    return h("div", { class: "hn-sheet-body" },
      h("span", { class: "eyebrow hn-sheet-kicker" }, "写真リスト"),
      h("h2", { class: "hn-sheet-title", id: "hn-sheet-t" }, "ミッションを追加"),
      form);
  }

  /* ---------- 分霊箱カード（下から出るシート） ---------- */
  function openSheet(id) { const was = !!ui.sheet; ui.sheet = id; ui.confirmUndo = null; ui.confirmDel = null; renderSheet(); if (!was) lockScroll(true); focusClose(); }
  function closeSheet() { if (!ui.sheet) return; ui.sheet = null; ui.confirmUndo = null; ui.confirmDel = null; renderSheet(); lockScroll(false); render(); }
  function focusClose() { const c = sheetHost && sheetHost.querySelector(".hn-close"); if (c) c.focus({ preventScroll: true }); }

  function renderSheet() {
    if (!sheetHost) return;
    const old = sheetHost.querySelector(".hn-panel"), keep = old ? old.scrollTop : 0;
    const still = (panel) => { if (old) panel.style.animation = "none"; };  // 開き直し以外では下からの動きを繰り返さない
    sheetHost.replaceChildren();
    if (!ui.sheet) { sheetHost.hidden = true; return; }
    if (!HX[ui.sheet]) {
      // 夜の談話室・追加ミッション・追加フォーム
      const m = ui.sheet === "add" ? null : missionOf(ui.sheet);
      if (ui.sheet !== "add" && !m) { ui.sheet = null; ui.confirmDel = null; sheetHost.hidden = true; lockScroll(false); return; }
      sheetHost.hidden = false;
      const panel = h("div", { class: "hn-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "hn-sheet-t" },
        h("button", { type: "button", class: "hn-close", "aria-label": "閉じる", onclick: closeSheet }, "✕"),
        h("div", { class: "hn-sheet-hero" }, h("span", { class: "hn-glyph", "aria-hidden": "true" }, m ? m.glyph : "＋")),
        m ? missionSheetBody(m) : addSheetBody());
      still(panel);
      sheetHost.append(panel);
      panel.scrollTop = keep;
      return;
    }
    sheetHost.hidden = false;
    const x = HX[ui.sheet], done = isDone(x), rev = revealed(x), locked = x.final && finalLocked();
    const H = hunt();
    const body = h("div", { class: "hn-sheet-body" },
      h("span", { class: "eyebrow" }, "HORCRUX " + x.n + "/" + HORCRUXES.length),
      h("h2", { class: "hn-sheet-title", id: "hn-sheet-t" }, x.name));

    if (locked) {
      const n = HORCRUXES.filter((y) => !y.final && !isDone(y)).length;
      body.append(h("div", { class: "hn-block" }, h("span", { class: "hn-label" }, "封印中"),
        h("p", { class: "hn-q", style: { margin: 0 } }, "残り" + n + "つの分霊箱を砕くと、最後の一撃が放てる。"),
        rev ? h("p", { class: "hn-tip" }, "決戦の地：" + x.place) : null));
    } else if (!rev) {
      const L = riddleOf(x.id);
      body.append(h("dl", { class: "hn-dl" },
        h("dt", null, "隠し場所"), h("dd", null, h("span", { class: "hn-veil", "aria-label": "まだ分からない" }, "？？？"), h("small", null, x.veil))),
        h("div", { class: "hn-block" },
          h("p", { class: "hn-q", style: { margin: 0 } }, L
            ? "謎" + L.riddle.n + "（" + L.station + "のふくろう便）を解くと明らかになる。新大阪に着いたら、すべての隠し場所が明かされる。"
            : "新大阪に着いたら明かされる。"),
          L ? h("div", { class: "hn-row" }, h("button", { type: "button", class: "btn hn-s", onclick: () => { closeSheet(); gotoLetter(L.id); } }, "ふくろう便へ")) : null));
    } else {
      body.append(h("dl", { class: "hn-dl" },
        h("dt", null, "隠し場所"), h("dd", null, x.place, h("small", null, x.placeNote)),
        h("dt", null, "撮る" + x.kind), h("dd", null, x.shot),
        h("dt", null, "撮り方のコツ"), h("dd", null, x.tip)));
      let who = null;
      if (done) {
        const cur = H.horcrux[x.id].by || null;
        const opts = HP.activePlayers().map((p) => ({ id: p.id, name: p.name })).concat([{ id: "all", name: "みんなで" }]);
        who = h("div", { class: "hn-block" }, h("span", { class: "hn-label" }, "誰が砕いた？（任意）"),
          h("div", { class: "hn-who" }, opts.map((o) => h("button", { type: "button", "aria-pressed": String(cur === o.id),
            onclick: () => { H.horcrux[x.id].by = cur === o.id ? null : o.id; save(); renderAll(); } }, o.name))));
      }
      body.append(mediaBlock("hx-" + x.id, {
        done, extra: who,
        onFile: (f) => shootHorcrux(x, f),
        onUndo: () => undoHorcrux(x),
        undoText: "写真を消して、" + x.name + "を壊す前に戻す？",
      }));
    }

    const panel = h("div", { class: "hn-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "hn-sheet-t" },
      h("button", { type: "button", class: "hn-close", "aria-label": "閉じる", onclick: closeSheet }, "✕"),
      h("div", { class: "hn-sheet-hero" },
        h("div", { class: "hn-sheet-pic", "data-wide": !!x.final, "data-done": done }, art(x.img, "", x.name), done ? crack() : null)),
      body);
    still(panel);
    sheetHost.append(panel);
    panel.scrollTop = keep;
  }

  /* ---------- 演出 ---------- */
  function overlay(cls, children, onClose, ms) {
    const el = h("div", { class: cls, role: "dialog", "aria-modal": "true", tabindex: "-1" }, children);
    let closed = false, t = null;
    function close() {
      if (closed) return; closed = true; clearTimeout(t);
      el.remove(); lockScroll(false); G.document.removeEventListener("keydown", onKey);
      if (onClose) onClose();
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    el.addEventListener("click", close);
    G.document.addEventListener("keydown", onKey);
    G.document.body.append(el);
    lockScroll(true);
    el.focus({ preventScroll: true });
    if (ms) t = setTimeout(close, ms);
    return close;
  }

  const SHARDS = [
    ["50% 50%, 0 0, 55% 0", "-60px", "-150px", "-40deg"],
    ["50% 50%, 55% 0, 100% 0, 100% 35%", "140px", "-120px", "35deg"],
    ["50% 50%, 100% 35%, 100% 100%, 75% 100%", "160px", "90px", "60deg"],
    ["50% 50%, 75% 100%, 20% 100%", "10px", "180px", "-25deg"],
    ["50% 50%, 20% 100%, 0 100%, 0 60%", "-150px", "120px", "-55deg"],
    ["50% 50%, 0 60%, 0 0", "-170px", "-30px", "30deg"],
  ];
  function playBreak(x, afterMsg) {
    const left = HORCRUXES.length - doneCount();
    const stage = h("div", { class: "hn-stage", "aria-hidden": "true" },
      SHARDS.map(([poly, dx, dy, r]) => {
        const p = h("div", { class: "hn-piece" }, art(x.img, "", ""));
        p.style.clipPath = "polygon(" + poly + ")";
        p.style.webkitClipPath = "polygon(" + poly + ")";
        p.style.setProperty("--dx", dx); p.style.setProperty("--dy", dy); p.style.setProperty("--r", r);
        return p;
      }),
      crack(), h("div", { class: "hn-flash" }));
    const still = h("div", { class: "hn-fx-static", "aria-hidden": "true" }, art(x.img, "", ""), crack());
    const txt = h("div", { class: "hn-fx-txt" },
      h("p", { class: "hn-fx-title" }, x.name + "を破壊した！"),
      h("p", { class: "hn-fx-sub" }, left ? "残る分霊箱は、あと" + left + "つ" : "これで7つすべて砕けた"),
      h("p", { class: "hn-fx-tap" }, "タップで閉じる"));
    overlay("hn-fx", [stage, still, txt], () => {
      if (afterMsg) HP.toast(afterMsg);
      if (allDone() && !hunt().clearSeen) showClear();
    }, reduceMotion() ? 2600 : 4200);
  }

  function openLetter(L) {
    const R = recW(L.id);
    R.openedAt = R.openedAt || new Date().toISOString();
    ui.expanded[L.id] = true;
    save(); render();
    const env = h("div", { class: "hn-env", "aria-hidden": "true" },
      h("div", { class: "hn-env-back" }),
      h("div", { class: "hn-env-paper" }, L.station, h("br"), L.title),
      h("div", { class: "hn-env-front" }), h("div", { class: "hn-env-flap" }),
      h("div", { class: "hn-seal" }, h("i", null, "D"), h("i", null, "D")));
    const txt = h("div", { class: "hn-fx-txt" },
      h("p", { class: "hn-fx-title" }, "ふくろう便が届いた"),
      h("p", { class: "hn-fx-sub" }, L.time + "　" + L.station + "より"));
    overlay("hn-fx", [env, txt], () => gotoLetter(L.id), reduceMotion() ? 1200 : 2600);
  }
  function forceDeliver(L) {
    recW(L.id).forced = true;
    save();
    lastKey = deliveredIds(undefined, hunt().letters).join();
    openLetter(L);
  }
  function gotoLetter(id) {
    ui.view = "hq"; ui.expanded[id] = true; render();
    G.requestAnimationFrame(() => {
      const el = root.querySelector('[data-letter="' + id + '"]');
      if (el) el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
    });
  }

  function showClear() {
    const H = hunt();
    H.clearSeen = true; save(); render();
    const names = HP.activePlayers().map((p) => h("span", { class: "hn-name" }, h("span", null, p.name), HP.houseChip(p.house)));
    const el = h("div", { class: "hn-clear", role: "dialog", "aria-modal": "true", "aria-labelledby": "hn-clear-t", tabindex: "-1" },
      h("div", { class: "hn-clear-in" },
        art("final", "", "闇が晴れ、朝日が差す城"),
        h("span", { class: "eyebrow hn-kicker" }, "2026年10月11日"),
        h("h2", { class: "hn-clear-title", id: "hn-clear-t" }, "闇の帝王、ついに倒れる"),
        h("p", null, "7つの分霊箱は、すべて砕け散った。\n闇は晴れ、魔法界にふたたび朝が来た。"),
        names.length ? h("div", { class: "hn-names" }, names) : null,
        h("div", { class: "hn-col" },
          h("button", { type: "button", class: "btn", onclick: () => { close(); HP.go("paper"); } }, "日刊予言者新聞・号外を刷る"),
          h("button", { type: "button", class: "btn ghost", onclick: () => close() }, "本部に戻る"))));
    function close() { el.remove(); lockScroll(false); G.document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    G.document.addEventListener("keydown", onKey);
    G.document.body.append(el);
    lockScroll(true);
    el.focus({ preventScroll: true });
  }

  /* ================= 写真リスト ================= */
  function photoList() {
    const H = hunt();
    const items = [];
    const row = (o) => h("li", { class: "hn-item", "data-done": o.done },
      h("span", { class: "hn-thumb", "data-done": o.done, "aria-hidden": "true" }, (o.key && HP.media.el(o.key)) || (o.done ? "✓" : o.mark)),
      h("span", { class: "hn-item-txt" }, h("b", null, o.title), h("small", null, (o.done ? "撮影済み・" : "") + o.where)),
      o.action);

    const letterRows = LETTERS.filter((L) => L.photo).map((L) => {
      const done = !!(rec(L.id) && rec(L.id).photoAt);
      items.push(done);
      return row({ key: L.photo.key, done, mark: "✉", title: L.photo.title, where: L.station + "・" + L.time,
        action: h("button", { type: "button", class: "btn ghost hn-s", onclick: () => gotoLetter(L.id) }, "開く") });
    });
    const hxRows = HORCRUXES.map((x) => {
      const done = isDone(x);
      items.push(done);
      return row({ key: "hx-" + x.id, done, mark: String(x.n), title: x.shot + (x.kind === "動画" ? "（動画）" : ""),
        where: x.name + "・" + (revealed(x) ? x.place : "？？？"),
        action: h("button", { type: "button", class: "btn ghost hn-s", onclick: () => openSheet(x.id) }, "開く") });
    });
    const exRows = EXTRAS.map((e) => {
      const done = !!H.extra[e.id];
      items.push(done);
      return row({ done, mark: "＋", title: e.title, where: e.where,
        action: h("button", { type: "button", class: "hn-check", "aria-pressed": String(done), "aria-label": e.title + "を撮った",
          onclick: () => { if (done) delete H.extra[e.id]; else H.extra[e.id] = new Date().toISOString(); save(); render(); } }, done ? "✓" : "") });
    });
    const openBtn = (key) => h("button", { type: "button", class: "btn ghost hn-s", onclick: () => openSheet(key) }, "開く");
    const ntRows = NIGHT.map((m) => {
      const key = "nt-" + m.id, done = !!H.shots[key];
      items.push(done);
      return row({ key, done, mark: "☾", title: m.title + (m.kind === "動画" ? "（動画）" : ""), where: m.shot, action: openBtn(key) });
    });
    const cmRows = {};
    CUSTOM_GROUPS.forEach((g) => { cmRows[g.id] = []; });
    customList(H).forEach((c) => {
      const key = "cm-" + c.id, done = !!H.shots[key];
      items.push(done);
      cmRows[groupId(c.group)].push(row({ key, done, mark: "✦", title: c.title,
        where: "追加したミッション" + (c.tip ? "・" + c.tip : ""), action: openBtn(key) }));
    });
    const n = items.filter(Boolean).length;
    return [
      h("p", { class: "hn-total", id: "hn-l-top" }, "撮影ミッション ", h("b", null, String(n)), " / " + items.length),
      h("div", { class: "hn-bar hn-total-bar", "aria-hidden": "true" }, h("i", { style: { width: (items.length ? Math.round((n / items.length) * 100) : 0) + "%" } })),
      h("p", { class: "hn-sec-note" }, "旅のすべての撮影指令。撮ったものにはサムネイルが付く。"),
      h("button", { type: "button", class: "btn ghost hn-add", onclick: openAdd }, "＋ ミッションを追加"),
      h("h3", { class: "hn-list-h" }, "ふくろう便の指令"), h("ul", { class: "hn-list" }, letterRows, cmRows.shinkansen),
      h("h3", { class: "hn-list-h" }, "分霊箱"), h("ul", { class: "hn-list" }, hxRows, cmRows.usj),
      h("h3", { class: "hn-list-h" }, "おまけ（撮ったらチェック）"), h("ul", { class: "hn-list" }, exRows),
      h("h3", { class: "hn-list-h", id: "hn-l-night" }, "夜の談話室（民泊）"),
      h("p", { class: "hn-sec-note" }, "分霊箱を倒したあとの祝勝会。飲めない人はソフトドリンクで、寮の色はジュースでもそろう。"),
      h("ul", { class: "hn-list" }, ntRows, cmRows.night),
    ].concat(cmRows.other.length ? [h("h3", { class: "hn-list-h" }, "その他（追加したミッション）"), h("ul", { class: "hn-list" }, cmRows.other)] : []);
  }

  /* ================= 時刻の見張り ================= */
  function tick() {
    if (!root || root.hidden || G.document.hidden) return;
    const H = hunt();
    const key = deliveredIds(undefined, H.letters).join();
    if (key !== lastKey) {
      const before = lastKey ? lastKey.split(",") : [];
      const fresh = key.split(",").filter((id) => id && before.indexOf(id) < 0 && !opened(LT[id]));
      lastKey = key;
      if (H.prologueDone && fresh.length) HP.toast("ふくろう便が届いた：" + LT[fresh[fresh.length - 1]].station);
      if (!ui.replay) render();
      return;
    }
    root.querySelectorAll("[data-eta]").forEach((el) => { el.textContent = etaText(LT[el.getAttribute("data-eta")]); });
  }

  HP.register("hunt", {
    mount(r) {
      root = r;
      if (!G.document.getElementById("hn-style")) G.document.head.append(h("style", { id: "hn-style" }, CSS));
      sheetHost = h("div", { class: "hn-sheet", hidden: true });
      sheetHost.addEventListener("click", (e) => { if (e.target === sheetHost) closeSheet(); });
      G.document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.sheet && !G.document.querySelector(".hn-fx, .hn-clear")) closeSheet(); });
      G.document.body.append(sheetHost);
      // いちばん新しく開封した便を開いておく
      const last = LETTERS.filter((L) => opened(L)).pop();
      if (last) ui.expanded[last.id] = true;
      lastKey = deliveredIds(undefined, hunt().letters).join();
      HP.onChange(() => { if (selfSaving) return; if (root && !root.hidden) renderAll(); });
      setInterval(tick, 20000);
      G.document.addEventListener("visibilitychange", tick);
    },
    show() {
      lastKey = deliveredIds(undefined, hunt().letters).join();
      renderAll();
    },
  });
})();
