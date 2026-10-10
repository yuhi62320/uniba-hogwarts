/* 呪文 — 旅で唱えたい呪文の図鑑
 *
 * 状態: HP.state.spells = { fav: [spellId, ...] }   // お気に入り（同期されて 4 人で共通）
 * 「今日の呪文」は端末ごと（同期しない）。日付で決まり、ボタンで引き直せる。
 */
(function () {
  "use strict";
  const h = (...a) => HP.h(...a);

  /* ---------- データ ---------- */
  const CATS = [
    { id: "basic", jp: "基本" },
    { id: "battle", jp: "攻撃・防御" },
    { id: "life", jp: "便利・生活" },
    { id: "dark", jp: "闇の呪文" },
    { id: "famous", jp: "その他の有名な呪文" },
  ];

  // jp / en / effect / scene / trip / wand(任意)
  const SPELLS = [
    // 基本
    { id: "leviosa", cat: "basic", jp: "ウィンガーディアム・レヴィオーサ", en: "Wingardium Leviosa",
      effect: "物を宙に浮かせる浮遊呪文。1年生が最初の授業で習う。",
      scene: "呪文の授業で、ハーマイオニーが発音を正して羽根を浮かせた場面。",
      trip: "誰かが荷物を持ち上げるとき、全員で唱えて応援する。発音は「レヴィ『オー』サ」で。",
      wand: "ビューン、ヒョイ" },
    { id: "lumos", cat: "basic", jp: "ルーモス", en: "Lumos",
      effect: "杖の先に明かりをともす。暗い場所で道を照らす基本の呪文。",
      scene: "暗い森や廊下を歩くとき、ハリーたちが何度も使う。",
      trip: "暗い夜道でスマホのライトをつけるときに唱える。",
      wand: "杖先を上に向けて軽く振る" },
    { id: "nox", cat: "basic", jp: "ノックス", en: "Nox",
      effect: "ルーモスでつけた明かりを消す。ルーモスと対になる呪文。",
      scene: "隠れて移動するときに明かりを消す場面で使われる。",
      trip: "ライトを消すとき、宿の消灯の合図に。「ルーモス」とセットで使うと決まる。" },
    { id: "alohomora", cat: "basic", jp: "アロホモーラ", en: "Alohomora",
      effect: "鍵のかかった扉や窓を開ける解錠呪文。",
      scene: "1年生のハリーたちが、立ち入り禁止の廊下の扉を開けた場面。",
      trip: "民泊の鍵を開けるとき。暗証番号を押しながら唱える。",
      wand: "鍵穴に向けて軽くトン" },
    { id: "reparo", cat: "basic", jp: "レパロ", en: "Reparo",
      effect: "壊れた物を元どおりに直す修復呪文。",
      scene: "ハーマイオニーが割れたメガネを直してあげる場面が有名。",
      trip: "ほつれたローブやずれた眼鏡を直すときに。直らなくても唱えれば気分は直る。" },
    { id: "accio", cat: "basic", jp: "アクシオ", en: "Accio",
      effect: "呼び寄せ呪文。物の名前と一緒に唱えると、手元に飛んでくる。",
      scene: "三大魔法学校対抗試合で、ハリーが自分の箒を呼び寄せた場面。",
      trip: "「それ取って」と言うかわりに。「アクシオ、モバイルバッテリー！」" },
    { id: "scourgify", cat: "basic", jp: "スコージファイ", en: "Scourgify",
      effect: "汚れをきれいに落とす清め呪文。",
      scene: "からかい半分に使われることもある、身近な掃除の呪文。",
      trip: "食べこぼしをおしぼりで拭くとき。チュロスの砂糖が付いたら出番。" },

    // 攻撃・防御
    { id: "expelliarmus", cat: "battle", jp: "エクスペリアームス", en: "Expelliarmus",
      effect: "武装解除の呪文。相手の杖をはじき飛ばす。ハリーの得意技。",
      scene: "決闘クラブや最終決戦で、ハリーが何度も使う代名詞の呪文。",
      trip: "写真で吹っ飛ぶ役を決めるときに。唱えた人以外が全力でのけぞる。",
      wand: "相手に向けて鋭く突き出す" },
    { id: "protego", cat: "battle", jp: "プロテゴ", en: "Protego",
      effect: "盾の呪文。見えない壁を作って、相手の呪文をはね返す。",
      scene: "ハリーが仲間に教える練習や、城を守る戦いの場面で使われる。",
      trip: "エクスペリアームスの写真で、受ける側が唱える。日差しよけの帽子をかぶるときにも。" },
    { id: "stupefy", cat: "battle", jp: "ステューピファイ", en: "Stupefy",
      effect: "失神呪文。赤い光で相手を気絶させ、動けなくする。",
      scene: "戦いの場面で、魔法使いたちが一斉に放つことが多い。",
      trip: "疲れて寝落ちしそうな人に。言われた人は 3 秒だけ固まるルール。" },
    { id: "petrificus", cat: "battle", jp: "ペトリフィカス・トタルス", en: "Petrificus Totalus",
      effect: "全身金縛り術。体がピンと固まって倒れる。",
      scene: "1年生の終わり、ハーマイオニーがネビルを止めるためにかけた場面。",
      trip: "集合写真で全員を静止させたいときに。「はい、止まって」のかわりに。" },
    { id: "expecto", cat: "battle", jp: "エクスペクト・パトローナム", en: "Expecto Patronum",
      effect: "守護霊を呼び出す呪文。幸せな記憶を思い浮かべて、銀色の守り手を出す。",
      scene: "3年生のハリーが、湖のほとりで大きな牡鹿の守護霊を出した場面。",
      trip: "長い待ち列で元気がなくなったときに。全員で一番楽しかった思い出を言い合う。",
      wand: "幸せな記憶を思い浮かべて、ぐるっと回す" },
    { id: "riddikulus", cat: "battle", jp: "リディクラス", en: "Riddikulus",
      effect: "まね妖怪ボガートを退治する呪文。怖いものを笑えるものに変える。",
      scene: "ルーピン先生の授業で、生徒たちが順番にボガートに挑んだ場面。",
      trip: "絶叫系に乗る前、怖がっている人に。怖いものの面白い姿を想像して笑う。" },
    { id: "impedimenta", cat: "battle", jp: "インペディメンタ", en: "Impedimenta",
      effect: "妨害の呪文。相手の動きを遅くしたり止めたりする。",
      scene: "追いかけてくる相手を足止めするときに使われる。",
      trip: "先に歩き出した人を呼び止めるときに。「ちょっと待って」の魔法版。" },
    { id: "finite", cat: "battle", jp: "フィニート・インカンターテム", en: "Finite Incantatem",
      effect: "かかっている呪文を止める、呪文終了の呪文。",
      scene: "騒ぎが起きた教室で、先生がまとめて呪文を解く場面がある。",
      trip: "ステューピファイやペトリフィカスで固まった人を解くときに。写真撮影の終わりの合図にも。" },

    // 便利・生活
    { id: "sonorus", cat: "life", jp: "ソノーラス", en: "Sonorus",
      effect: "声を大きくする拡声呪文。喉に杖を当てて唱える。",
      scene: "クィディッチ・ワールドカップの実況で使われた。",
      trip: "人混みで「こっちー！」と呼ぶ前に。叫びすぎには注意。" },
    { id: "quietus", cat: "life", jp: "クワイエタス", en: "Quietus",
      effect: "ソノーラスで大きくした声を元に戻す。",
      scene: "実況が終わったあと、声を元に戻すときに使われる。",
      trip: "夜の宿で盛り上がりすぎたときに。近所迷惑になる前に唱える。" },
    { id: "pointme", cat: "life", jp: "ポイント・ミー", en: "Point Me",
      effect: "方角を示す呪文。杖が北を指す、魔法のコンパス。",
      scene: "対抗試合の迷路で、ハリーが進む方向を確かめた場面。",
      trip: "パーク内で迷ったとき、地図アプリを開きながら唱える。" },
    { id: "aguamenti", cat: "life", jp: "アグアメンティ", en: "Aguamenti",
      effect: "杖の先から水を出す呪文。",
      scene: "炎に囲まれたときや、喉が渇いたときに使われる。",
      trip: "ペットボトルの水を注ぐときに。暑い日は水分補給の合図。" },
    { id: "incendio", cat: "life", jp: "インセンディオ", en: "Incendio",
      effect: "火をつける呪文。暖炉に火を起こすときにも使う。",
      scene: "暖炉に火を入れたり、たき火をつけたりする場面で使われる。",
      trip: "焼き肉やBBQで火がついた瞬間に。※本物の火のそばでふざけないこと。" },
    { id: "muffliato", cat: "life", jp: "マフリアート", en: "Muffliato",
      effect: "周りの人の耳にブーンという音を流し、内緒話を聞こえなくする。",
      scene: "「半純血のプリンス」が考えた呪文として、ハリーが教科書で知った。",
      trip: "サプライズの相談をするときに。本人の前で唱えると逆にバレる。" },
    { id: "episkey", cat: "life", jp: "エピスキー", en: "Episkey",
      effect: "ちょっとしたけがを治す応急手当の呪文。",
      scene: "鼻を折られたハリーを、ルーナがこの呪文で治した場面。",
      trip: "靴ずれに絆創膏を貼るときに。痛い人をいたわる一言として。" },
    { id: "engorgio", cat: "life", jp: "エンゴージオ", en: "Engorgio",
      effect: "物を大きくする肥大呪文。",
      scene: "ハグリッドの大きなかぼちゃが育った秘密とうわさされる呪文。",
      trip: "ポップコーンを大盛りにしてほしいときに心の中で。写真のズームにも。" },
    { id: "reducio", cat: "life", jp: "レデュシオ", en: "Reducio",
      effect: "大きくした物を元の大きさに縮める。エンゴージオと対の呪文。",
      scene: "授業で大きくなったクモを元の大きさに戻した場面。",
      trip: "パンパンのリュックに荷物を詰めるときに。おみやげを買いすぎた帰り道に。" },
    { id: "tergeo", cat: "life", jp: "テルジオ", en: "Tergeo",
      effect: "汚れや液体を吸い取ってきれいにする呪文。",
      scene: "顔についた血や汚れをぬぐうときに使われた。",
      trip: "メイクのよれを直すとき、こぼした飲み物を拭くときに。" },

    // 闇の呪文（許されざる呪文。紹介だけ）
    { id: "avada", cat: "dark", jp: "アバダ・ケダブラ", en: "Avada Kedavra",
      effect: "許されざる呪文のひとつ。命を奪う死の呪い。防ぐ方法はないとされる。",
      scene: "物語のはじまりにつながる、ヴォルデモートがハリーの家族を襲った夜。",
      trip: "紹介だけ。旅では使い道なし。" },
    { id: "crucio", cat: "dark", jp: "クルーシオ", en: "Crucio",
      effect: "許されざる呪文のひとつ。相手に激しい苦痛を与える磔の呪い。",
      scene: "授業でこの呪文の恐ろしさが示され、ネビルが青ざめた場面。",
      trip: "紹介だけ。旅では使い道なし。" },
    { id: "imperio", cat: "dark", jp: "インペリオ", en: "Imperio",
      effect: "許されざる呪文のひとつ。相手を意のままにあやつる服従の呪い。",
      scene: "授業で、ハリーがこの呪いに抵抗してみせた場面。",
      trip: "紹介だけ。旅では使い道なし。" },
    { id: "sectumsempra", cat: "dark", jp: "セクタムセンプラ", en: "Sectumsempra",
      effect: "見えない刃で切りつける闇の呪文。許されざる呪文ではないが危険。",
      scene: "ハリーが意味を知らずに使ってしまい、深く後悔した場面。",
      trip: "紹介だけ。旅では使い道なし。" },
    { id: "morsmordre", cat: "dark", jp: "モースモードル", en: "Morsmordre",
      effect: "空に「闇の印」を打ち上げる呪文。闇の勢力のしるし。",
      scene: "ワールドカップの夜、森の上空に闇の印が現れた場面。",
      trip: "紹介だけ。旅では使い道なし。" },

    // その他の有名な呪文
    { id: "obliviate", cat: "famous", jp: "オブリビエイト", en: "Obliviate",
      effect: "忘却術。相手の記憶を消したり、書き換えたりする。",
      scene: "ロックハートが自分にかけてしまった場面や、ハーマイオニーの旅立ちの場面。",
      trip: "誰かが恥ずかしい失敗をしたとき、やさしく「なかったこと」にしてあげる。" },
    { id: "mischief", cat: "famous", jp: "いたずら完了", en: "Mischief Managed",
      effect: "忍びの地図を白紙に戻す合言葉。地図を開くときの合言葉と対になる。",
      scene: "フレッドとジョージから受け継いだ地図を、ハリーが閉じるときの決まり文句。",
      trip: "1日の終わり、全員で宿に帰ってきたときの締めの一言に。" },
    { id: "solemnly", cat: "famous", jp: "われ、ここに誓う", en: "I solemnly swear…",
      effect: "忍びの地図を開く合言葉。「よからぬことをたくらむ者なり」と続く。",
      scene: "ハリーが初めて地図の使い方を教わった場面。",
      trip: "パークの地図を広げるとき、悪だくみ（ルート作戦会議）の始まりに。" },
    { id: "serpensortia", cat: "famous", jp: "サーペンソーティア", en: "Serpensortia",
      effect: "杖の先からヘビを出す呪文。",
      scene: "決闘クラブでマルフォイがヘビを出し、ハリーがヘビ語を話した場面。",
      trip: "スリザリン担当の決めポーズに。おみやげのヘビグッズを出すときにも。" },
    { id: "rictusempra", cat: "famous", jp: "リクタスセンプラ", en: "Rictusempra",
      effect: "くすぐりの呪文。相手を笑いころげさせる。",
      scene: "決闘クラブで、ハリーがマルフォイに向けて放った。",
      trip: "写真の前に唱えて、全員を笑顔にする。「はい、チーズ」のかわりに。" },
    { id: "tarantallegra", cat: "famous", jp: "タラントアレグラ", en: "Tarantallegra",
      effect: "相手の足を勝手に踊らせる呪文。",
      scene: "決闘クラブで、マルフォイがハリーにかけた呪文。",
      trip: "パレードやショーの音楽が流れたら唱えて、みんなで踊る。" },
  ];

  /* ---------- 状態 ---------- */
  function favs() {
    const s = HP.state.spells;
    return s && Array.isArray(s.fav) ? s.fav.filter((id) => SPELLS.some((x) => x.id === id)) : [];
  }
  function toggleFav(id) {
    if (!HP.state.spells || typeof HP.state.spells !== "object") HP.state.spells = {};
    const list = favs();
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.unshift(id);
    HP.state.spells.fav = list;
    HP.save();
    HP.toast(i >= 0 ? "お気に入りから外しました" : "お気に入りに追加しました");
  }

  const ui = { q: "", cat: "all", open: {}, todayId: null };

  function dayPick() {
    const d = new Date();
    const n = d.getFullYear() * 400 + (d.getMonth() + 1) * 31 + d.getDate();
    const pool = SPELLS.filter((s) => s.cat !== "dark");
    return pool[n % pool.length].id;
  }
  function randomPick() {
    const pool = SPELLS.filter((s) => s.cat !== "dark" && s.id !== ui.todayId);
    return pool[Math.floor(Math.random() * pool.length)].id;
  }
  const byId = (id) => SPELLS.find((s) => s.id === id);
  const catName = (id) => (CATS.find((c) => c.id === id) || {}).jp || "";

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFKC")
      .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
      .replace(/[\s・･\-—…]/g, "");
  }
  function matches(sp, q) {
    if (!q) return true;
    return norm([sp.jp, sp.en, sp.effect, sp.scene, sp.trip, sp.wand, catName(sp.cat)].join(" ")).includes(q);
  }

  /* ---------- CSS ---------- */
  const CSS = `
.sp-wrap { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.sp-wrap > * { min-width: 0; }
.sp-head { min-width: 0; }
.sp-head h2 { margin: 4px 0 4px; min-width: 0; font-family: var(--font-display); font-size: 24px; line-height: 1.35; font-weight: 800; letter-spacing: .04em; color: var(--hw-on-night); }
.sp-head p { margin: 0; min-width: 0; font-size: 14px; color: var(--hw-on-night-dim); }

.sp-today { display: flex; flex-direction: column; gap: 10px; padding: 20px 18px; color: var(--hw-ink); }
.sp-today-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sp-today-top .eyebrow { min-width: 0; color: var(--hw-gold-deep); }
.sp-cat-tag { flex-shrink: 0; white-space: nowrap; padding: 2px 10px; border-radius: 4px; background: transparent; border: 1px solid var(--hw-gold-deep); color: var(--hw-gold-deep); font-size: 12px; font-weight: 700; }
.sp-today-name { margin: 0; min-width: 0; font-family: var(--font-display); font-size: 28px; line-height: 1.35; font-weight: 800; letter-spacing: .04em; color: var(--hw-ink); overflow-wrap: anywhere; }
.sp-today-en { font-family: var(--font-num); font-size: 13px; letter-spacing: .14em; text-transform: uppercase; color: var(--hw-gold-deep); overflow-wrap: anywhere; }
.sp-today-effect { margin: 0; min-width: 0; font-size: 15px; color: var(--hw-ink); }
.sp-today .sp-roll { width: 100%; }
.sp-pop { animation: sp-pop .32s var(--ease-out); }
@keyframes sp-pop { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.sp-search { position: relative; display: block; }
.sp-search input {
  width: 100%; max-width: 100%; min-height: 48px; padding: 10px 16px 10px 42px;
  border: 1px solid var(--hw-rule); border-radius: 6px; background: transparent;
  font: inherit; font-size: 16px; color: var(--hw-on-night); outline: none;
  -webkit-appearance: none; appearance: none;
}
.sp-search input::placeholder { color: var(--hw-on-night-dim); }
.sp-search input:focus { border-color: var(--hw-gold); box-shadow: 0 0 0 1px var(--hw-gold); }
.sp-search::before {
  content: ""; position: absolute; left: 17px; top: 50%; width: 12px; height: 12px; margin-top: -8px;
  border: 1.5px solid var(--hw-gold); border-radius: 50%; pointer-events: none;
}
.sp-search::after {
  content: ""; position: absolute; left: 29px; top: 50%; width: 1.5px; height: 7px; margin-top: 2px;
  background: var(--hw-gold); transform: rotate(-45deg); pointer-events: none;
}

.sp-chips { display: flex; gap: 8px; overflow-x: auto; margin: 0 -16px; padding: 2px 16px 4px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.sp-chips::-webkit-scrollbar { display: none; }
.sp-chip {
  flex-shrink: 0; white-space: nowrap; min-height: 44px; padding: 8px 16px;
  border-radius: 6px; border: 1px solid var(--hw-rule); background: transparent;
  color: var(--hw-on-night-dim); font-size: 14px; font-weight: 500; cursor: pointer;
}
.sp-chip[aria-pressed="true"] { background: var(--hw-gold); border-color: var(--hw-gold); color: var(--hw-night); font-weight: 700; }
.sp-chip .sp-n { margin-left: 6px; font-family: var(--font-num); font-variant-numeric: tabular-nums; font-size: 12px; opacity: .8; }

.sp-section-title { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: 8px 2px 0; padding-bottom: 8px; border-bottom: 1px solid var(--hw-rule); }
.sp-section-title h3 { margin: 0; min-width: 0; font-family: var(--font-display); font-size: 17px; font-weight: 700; letter-spacing: .04em; color: var(--hw-on-night); }
.sp-section-title .sp-count { flex-shrink: 0; white-space: nowrap; font-size: 12px; color: var(--hw-on-night-dim); font-family: var(--font-num); font-variant-numeric: tabular-nums; }
.sp-list { display: flex; flex-direction: column; gap: 10px; }

.sp-card { background: var(--hw-parch); border: 1px solid var(--hw-rule-parch); border-radius: 10px; overflow: hidden; color: var(--hw-ink); }
.sp-card.sp-is-fav { border-color: var(--hw-gold); }
.sp-card-head { display: flex; align-items: center; min-width: 0; }
.sp-toggle {
  flex: 1 1 0; min-width: 0; min-height: 64px; display: flex; flex-direction: column; justify-content: center; gap: 2px;
  padding: 12px 6px 12px 16px; background: none; border: 0; text-align: left; cursor: pointer; color: inherit;
}
.sp-name { min-width: 0; font-family: var(--font-display); font-size: 18px; line-height: 1.4; font-weight: 700; letter-spacing: .04em; color: var(--hw-ink); overflow-wrap: anywhere; }
.sp-en { min-width: 0; font-family: var(--font-num); font-size: 12px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--hw-gold-deep); overflow-wrap: anywhere; line-height: 1.5; }
.sp-card[data-cat="dark"] .sp-en { color: var(--hw-crimson); }
.sp-fav {
  flex-shrink: 0; white-space: nowrap; min-height: 44px; margin-right: 10px; padding: 0 10px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid var(--hw-rule-parch); border-radius: 6px; cursor: pointer;
  font: inherit; font-size: 12px; font-weight: 700; line-height: 1; color: var(--hw-ink-dim);
  transition: transform .2s var(--ease-out);
}
.sp-fav:active { transform: scale(.94); }
.sp-fav[aria-pressed="true"] { background: var(--hw-gold); border-color: var(--hw-gold-deep); color: var(--hw-ink); }
.sp-caret { flex-shrink: 0; width: 28px; align-self: stretch; display: flex; align-items: center; justify-content: center; color: var(--hw-gold-deep); pointer-events: none; }
.sp-caret::before { content: ""; width: 8px; height: 8px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: translateY(-2px) rotate(45deg); transition: transform .24s var(--ease-out); }
.sp-card.sp-open .sp-caret::before { transform: translateY(2px) rotate(-135deg); }

.sp-body { display: flex; flex-direction: column; gap: 12px; padding: 12px 16px 16px; min-width: 0; border-top: 1px solid var(--hw-rule-parch); }
.sp-card.sp-open .sp-body { animation: sp-pop .28s var(--ease-out); }
.sp-effect { margin: 0; font-size: 15px; color: var(--hw-ink); min-width: 0; }
.sp-row { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sp-label { font-size: 12px; font-weight: 700; color: var(--hw-ink-dim); letter-spacing: .04em; }
.sp-row p { margin: 0; font-size: 14px; color: var(--hw-ink); min-width: 0; }
.sp-use {
  display: flex; gap: 10px; align-items: flex-start; min-width: 0;
  padding: 10px 14px; border-radius: 8px;
  background: transparent; border: 1px solid var(--hw-gold-deep); color: var(--hw-ink);
}
.sp-use-tag { flex-shrink: 0; white-space: nowrap; padding: 1px 10px; border-radius: 4px; background: var(--hw-gold); color: var(--hw-ink); font-size: 12px; font-weight: 700; line-height: 1.8; }
.sp-use p { margin: 0; min-width: 0; font-size: 14px; font-weight: 500; }
.sp-wand { display: inline-flex; align-self: flex-start; align-items: center; gap: 8px; max-width: 100%; padding: 4px 12px; border-radius: 6px; border: 1px solid var(--hw-rule-parch); font-size: 13px; color: var(--hw-ink); }
.sp-wand b { flex-shrink: 0; white-space: nowrap; font-size: 12px; color: var(--hw-ink-dim); font-weight: 700; }
.sp-wand span { min-width: 0; }
.sp-warn { margin: 0; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--hw-crimson); border-left-width: 4px; background: transparent; font-size: 13px; font-weight: 700; color: var(--hw-crimson); }
.sp-dark-note { margin: 0 2px; padding-left: 10px; border-left: 3px solid var(--hw-crimson); font-size: 13px; color: var(--hw-on-night); font-weight: 700; }

.sp-empty { padding: 28px 16px; text-align: center; font-size: 14px; color: var(--hw-ink-dim); }
`;

  function injectCss() {
    if (document.getElementById("sp-style")) return;
    const st = document.createElement("style");
    st.id = "sp-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ---------- 描画 ---------- */
  let els = null;

  function renderToday(animate) {
    const sp = byId(ui.todayId);
    const box = els.today;
    box.replaceChildren(
      h("div", { class: "sp-today-top" },
        h("span", { class: "eyebrow" }, "SPELL OF THE DAY"),
        h("span", { class: "sp-cat-tag" }, catName(sp.cat))),
      h("div", { class: animate ? "sp-pop" : null },
        h("p", { class: "sp-today-name" }, sp.jp),
        h("div", { class: "sp-today-en" }, sp.en)),
      h("p", { class: "sp-today-effect" }, sp.effect),
      h("div", { class: "sp-use" }, h("span", { class: "sp-use-tag" }, "旅で"), h("p", null, sp.trip)),
      sp.wand ? h("div", { class: "sp-wand" }, h("b", null, "杖の振り方"), h("span", null, sp.wand)) : null,
      h("button", { type: "button", class: "btn sp-roll", onclick: () => {
        ui.todayId = randomPick();
        renderToday(true);
        HP.toast(byId(ui.todayId).jp + "！");
      } }, "ランダムに1つ唱える"),
    );
  }

  function renderChips() {
    const q = norm(ui.q);
    const all = [{ id: "all", jp: "すべて" }, { id: "fav", jp: "お気に入り" }].concat(CATS);
    const fav = favs();
    els.chips.replaceChildren(...all.map((c) => {
      const n = SPELLS.filter((s) => matches(s, q) && (c.id === "all" || (c.id === "fav" ? fav.includes(s.id) : s.cat === c.id))).length;
      return h("button", { type: "button", class: "sp-chip", "aria-pressed": ui.cat === c.id ? "true" : "false",
        onclick: () => { ui.cat = c.id; renderChips(); renderList(); } },
        c.jp, h("span", { class: "sp-n" }, n));
    }));
  }

  function card(sp, fav) {
    const open = !!ui.open[sp.id];
    const isFav = fav.includes(sp.id);
    const bodyId = "sp-body-" + sp.id;
    return h("article", { class: "sp-card" + (open ? " sp-open" : "") + (isFav ? " sp-is-fav" : ""), "data-cat": sp.cat },
      h("div", { class: "sp-card-head" },
        h("button", { type: "button", class: "sp-toggle", "aria-expanded": open ? "true" : "false", "aria-controls": bodyId,
          onclick: () => { ui.open[sp.id] = !open; renderList(); } },
          h("span", { class: "sp-name" }, sp.jp),
          h("span", { class: "sp-en" }, sp.en)),
        h("span", { class: "sp-caret", "aria-hidden": "true" }),
        h("button", { type: "button", class: "sp-fav", "aria-pressed": isFav ? "true" : "false",
          "aria-label": isFav ? sp.jp + " をお気に入りから外す" : sp.jp + " をお気に入りに追加",
          onclick: () => toggleFav(sp.id) }, isFav ? "登録済" : "お気に入り")),
      open ? h("div", { class: "sp-body", id: bodyId },
        h("p", { class: "sp-effect" }, sp.effect),
        h("div", { class: "sp-row" }, h("span", { class: "sp-label" }, "有名な場面"), h("p", null, sp.scene)),
        sp.cat === "dark"
          ? h("p", { class: "sp-warn" }, "人に向けて唱えるのは冗談でもやめよう。")
          : h("div", { class: "sp-use" }, h("span", { class: "sp-use-tag" }, "旅で"), h("p", null, sp.trip)),
        sp.wand ? h("div", { class: "sp-wand" }, h("b", null, "杖の振り方"), h("span", null, sp.wand)) : null,
      ) : null);
  }

  function section(title, list, fav, note) {
    return [
      h("div", { class: "sp-section-title" }, h("h3", null, title), h("span", { class: "sp-count" }, list.length + " 個")),
      note ? h("p", { class: "sp-dark-note" }, note) : null,
      h("div", { class: "sp-list" }, list.map((s) => card(s, fav))),
    ];
  }

  function renderList() {
    const q = norm(ui.q);
    const fav = favs();
    const hits = SPELLS.filter((s) => matches(s, q));
    const out = [];
    const DARK_NOTE = "紹介だけです。人に向けて唱えるのは冗談でもやめよう。";

    if (ui.cat === "fav") {
      const list = fav.map(byId).filter((s) => s && matches(s, q));
      if (list.length) out.push(...section("お気に入り", list, fav));
    } else {
      // お気に入りは上に固定
      const pinned = fav.map(byId).filter((s) => s && hits.includes(s) && (ui.cat === "all" || s.cat === ui.cat));
      if (pinned.length) out.push(...section("お気に入り", pinned, fav));
      CATS.filter((c) => ui.cat === "all" || ui.cat === c.id).forEach((c) => {
        const list = hits.filter((s) => s.cat === c.id && !fav.includes(s.id));
        if (list.length) out.push(...section(c.jp, list, fav, c.id === "dark" ? DARK_NOTE : null));
      });
    }

    if (!out.length) {
      out.push(h("div", { class: "parchment sp-empty muted" },
        ui.cat === "fav" && !q ? "まだお気に入りがありません。「お気に入り」を押すと、ここに集まります。" : "見つかりませんでした。別のことばで探してみてください。"));
    }
    els.list.replaceChildren(...out);
  }

  function renderAll() { renderChips(); renderList(); }

  HP.register("spells", {
    mount(root) {
      injectCss();
      ui.todayId = dayPick();
      const input = h("input", { type: "search", placeholder: "呪文名や効果でさがす（例: 明かり）", "aria-label": "呪文をさがす",
        autocomplete: "off", enterkeyhint: "search",
        oninput: (e) => { ui.q = e.target.value; renderAll(); } });
      els = {
        today: h("section", { class: "parchment sp-today", "aria-label": "今日の呪文" }),
        chips: h("div", { class: "sp-chips", role: "group", "aria-label": "カテゴリ" }),
        list: h("div", { class: "sp-wrap" }),
      };
      root.replaceChildren(h("div", { class: "sp-wrap" },
        h("header", { class: "sp-head" },
          h("span", { class: "eyebrow" }, "SPELLS " + SPELLS.length),
          h("h2", null, "呪文図鑑"),
          h("p", { class: "muted" }, "旅の途中で唱えたい呪文を集めました。お気に入りは 4 人で共有されます。")),
        els.today,
        h("label", { class: "sp-search" }, input),
        els.chips,
        els.list));
      renderToday(false);
      renderAll();
      HP.onChange(() => { if (els) renderAll(); });
    },
    show() { if (els) renderAll(); },
  });
})();
