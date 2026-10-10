/* 魔法の旅のしおり — 日刊予言者新聞タブ
 *
 * 入力（写真・主役・キーワード・トーン）から、テンプレートとランダムな組み合わせで
 * 新聞紙面を刷る。サーバーも AI も使わない。
 * 最後に刷った記事（テキストのみ）は HP.state.paper.article に入れて HP.save()。
 * 写真・動画は HP.media に任せる。メインに選んだもののキーは HP.state.paper.photoKey。
 *   旅アプリで撮ったもの（1 枚 = 蛙チョコカード 1 枚）: "lt-L0/L2/L3", "hx-<id>", "nt-<id>", "cm-<id>"。
 *   その場で選んだもの: "paper-photo"
 *   window.HP_HUNT.photoMissions() があれば、写真の候補とカード図鑑はそこから作る（無い・壊れていれば固定の一覧）
 * 共有: 「号外を画像にする」で紙面を html2canvas（scale 2）で PNG にし、
 *   downloads 能力があれば保存を提案、無くても紙面の下に <img> を出して長押し保存してもらう。
 */
(function () {
  const h = (...a) => HP.h(...a);

  /* ---------- 小道具 ---------- */
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const len = (s) => Array.from(s).length;
  function fill(tpl, v) { return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)); }
  function todayJp() {
    const d = new Date();
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日（" + "日月火水木金土"[d.getDay()] + "）";
  }
  const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 文章の素材 ---------- */
  const TONES = {
    incident: { label: "大事件", desc: "号外級のニュースとして大げさに", kicker: "号外・大事件", byline: "本紙事件記者団（現地より）" },
    gossip:   { label: "ゴシップ", desc: "盛りに盛った、噂好き記者の独占記事", kicker: "独占スクープ", byline: "特派員 ベラ・ファブリカ（自動速記羽ペン使用）" },
    ministry: { label: "魔法省の公式発表", desc: "お堅い役所の言い回しで", kicker: "魔法省 公式発表", byline: "魔法省広報室 発表" },
    final:    { label: "コレクション号外", desc: "カード図鑑の完成率で中身が変わる", kicker: "コレクション号外", byline: "本紙カード担当記者団（ホグワーツ特急より）" },
  };

  /* ユニバのカード（写真キー hx-<id>）。photoMissions() が無いときの名前。place は表示用、spot は「{spot}で」用 */
  const HX = [
    { id: "diary",  name: "嘆きのマートルの悲鳴",   place: "嘆きのマートルのトイレ",           spot: "嘆きのマートルのトイレ" },
    { id: "ring",   name: "オリバンダーの杖えらび", place: "オリバンダーの店",                 spot: "オリバンダーの店" },
    { id: "locket", name: "ホグワーツ城を仰ぐ4人", place: "ホグワーツ城",                     spot: "ホグワーツ城の前" },
    { id: "cup",    name: "バタービールの泡ひげ",   place: "バタービール",                     spot: "バタービールの売り場" },
    { id: "diadem", name: "雪屋根のホグズミード",   place: "ホグズミードの雪屋根の通り",       spot: "ホグズミードの雪屋根の通り" },
    { id: "nagini", name: "エクスペリアームス！",   place: "どこでも（呪文の動画）",           spot: "エクスペリアームスの呪文が飛んだ現場" },
    { id: "final",  name: "ホグワーツ特急の旅立ち", place: "ホグワーツ特急の前",               spot: "ホグワーツ特急の前" },
  ];
  const LT = [
    { key: "lt-L0", name: "9と3/4番線への突入", letter: "L0" },
    { key: "lt-L2", name: "車窓の富士山と杖",   letter: "L2" },
    { key: "lt-L3", name: "駅弁の魔法薬",       letter: "L3" },
  ];
  /* カード図鑑のセット。spot は、そのセットのカードが出た場所として文中に差し込む */
  const SETS = [
    { id: "shinkansen", label: "新幹線",       spot: "新幹線の車内" },
    { id: "usj",        label: "ユニバ",       spot: "ユニバのホグズミード村" },
    { id: "night",      label: "夜の談話室",   spot: "夜の談話室" },
    { id: "self",       label: "自分たち",     spot: "旅の途中" },
    { id: "secret",     label: "シークレット", spot: "謎の向こう側" },
  ];

  const CITIES = ["新大阪駅", "ユニバーサル・シティ駅", "ホグズミード村", "新幹線のぞみ号の車内", "三本の箒の前", "ホグワーツ城の門前", "東京駅のホーム", "ホグワーツ特急の乗り場"];
  const WITNESSES = ["通りすがりの屋敷しもべ妖精", "匿名の肖像画", "売店のトロール", "車内販売の魔女", "迷子のふくろう", "城の首なし幽霊"];
  const FALLBACK_KW = ["バタービールで口ひげ", "新幹線で寝過ごしかけた", "杖をホテルに忘れかけた", "ローブで汗だく", "チュロスを3本食べた", "アトラクションで絶叫", "ふくろう便の誤配", "組分け帽子に二度見された"];

  const T = {
    incident: {
      head: [
        "{name}、「{kw}」の衝撃",
        "速報 「{kw}」——目撃者多数",
        "{house}に激震 {name}が「{kw}」",
        "前代未聞！「{kw}」事件の全貌",
        "{city}騒然 {name}の「{kw}」",
        "闇の魔術か？ 「{kw}」で関西に緊張",
        "{name}、ついにやる 「{kw}」",
        "歴史が動いた日 「{kw}」",
        "{animal}も震えた 「{kw}」の瞬間",
      ],
      sub: [
        "関係者「まさか{name}が」 カード集めへの影響は不明",
        "現場の{city}は一時騒然、けが人なし",
        "魔法省は調査団を派遣する方針",
        "{house}寮監「{trait}の表れと信じたい」",
        "目撃した{wit}「一生忘れない」",
        "カード集めにも影響か 現在、{hunt}",
        "専門家「百年に一度の珍事」",
      ],
      lead: [
        "本日、{city}で{house}の{name}が「{kw}」という前代未聞の事態を引き起こした。",
        "魔法界に衝撃が走った。{house}所属の{name}が、{city}にて「{kw}」をやってのけたのである。",
        "{date}、{city}付近で「{kw}」が発生した。中心にいたのは{house}の{name}だ。",
        "誰もが耳を疑った。あの{name}が「{kw}」——本紙記者は現場に急行した。",
        "{name}（{house}）が「{kw}」をしでかしたとの一報が、ふくろう便で本社に届いた。",
        "マグルの観光客でにぎわう{city}で、「{kw}」という怪事件が起きた。当事者は{house}の{name}である。",
      ],
      mid: [
        "目撃した{wit}は「杖を抜く暇もなかった」と興奮気味に語った。",
        "現場では一時、{animal}の守護霊のような光が見えたとの証言もある。",
        "専門家は「{trait}が強すぎる者に起こりやすい現象だ」と分析している。",
        "続報によれば、直前には「{kw2}」という前兆もあったという。",
        "魔法省の担当者は「現時点で忘却術の必要はない」とコメントした。",
        "周囲のマグルは、これをテーマパークの演出だと思い込んでいる模様だ。",
        "{name}本人は「計画どおり」と言い張っているが、真相は闇の中である。",
      ],
      extra: [
        "なお、{hunt}。今回の騒動がカード集めに響くかは不明だ。",
        "カード図鑑の話題もひとつ。{hunt}。{mvpline}",
      ],
      close: [
        "本紙は引き続き、この事件を追う。",
        "続報は次の号外で。読者は杖の手入れを怠らないように。",
        "事件の全容解明には、まだ時間がかかりそうだ。",
        "{house}の談話室は、今夜もこの話題で持ちきりだろう。",
        "なお、{name}は現在もバタービールを片手に元気である。",
      ],
    },
    gossip: {
      head: [
        "独占！{name}の隠された素顔 「{kw}」の真実",
        "{name}、「{kw}」の裏に秘めた野望",
        "涙と嘘と「{kw}」 {house}の問題児",
        "ショック！{name}が「{kw}」 友人が激白",
        "「{kw}」は計算だった？ {name}の危うい魅力",
        "{house}の星、{name}の転落",
        "{name}、{city}で「{kw}」 周囲は眉をひそめる",
        "本紙だけが知っている{name}の「{kw}」",
        "{name}の「{kw}」は恋の予感？",
      ],
      sub: [
        "自動速記羽ペンが見た、すべての瞬間",
        "「昔からそう」と語る匿名の友人",
        "{trait}の仮面の下に何が？",
        "{hunt}——だがそれは表の話にすぎない",
        "{wit}「私は何も言っていません」",
        "美容魔法の専門家も首をかしげる",
        "{house}の談話室で広がるささやき",
      ],
      lead: [
        "きらめく{city}の喧騒の中、ひとり「{kw}」に身をやつしていたのは、{house}の{name}その人である。",
        "本紙は掴んだ。{house}の{name}が、人目もはばからず「{kw}」に及んでいたことを。",
        "「{kw}」。それは偶然だったのか、計算だったのか。{name}の瞳は何も語らない。",
        "ごきげんよう、読者諸君。今日の主役は{house}の{name}。話題はもちろん「{kw}」だ。",
        "{name}——その名を聞いて心穏やかでいられる者がいるだろうか。今日の「{kw}」がすべてを物語っている。",
      ],
      mid: [
        "匿名を条件に取材に応じた友人は「昔から目立ちたがりで」と声をひそめた。",
        "{wit}は否定したが、その頬がわずかに引きつったのを本紙は見逃さなかった。",
        "一説には「{kw2}」の件でも陰で糸を引いていたとささやかれている。",
        "{animal}のように堂々としたその姿に、通りすがりの観光客は思わず振り返った。",
        "{trait}が売りの{house}らしからぬ振る舞いに、寮内からも驚きの声が上がる。",
        "本紙の羽ペンは、{name}が鏡の前で三度ポーズを練習するのを記録している。",
      ],
      extra: [
        "ちなみに{hunt}。だが真の主役は、話題をさらった{name}かもしれない。",
        "カード集めの話をすれば、{hunt}。{mvpline}本紙はその笑顔の裏にも何かを嗅ぎつけている。",
      ],
      close: [
        "真実はいつも、記事の行間にある。",
        "続きは次号で。羽ペンは、まだ乾いていない。",
        "本人のコメントは得られなかった。得るつもりもなかったが。",
        "読者諸君、くれぐれも本紙の記者に背を向けぬように。",
        "{name}の明日はどっちだ。",
      ],
    },
    ministry: {
      head: [
        "魔法省、「{kw}」を正式に認定",
        "【公式】「{kw}」に関する声明",
        "魔法省告示 「{kw}」は第一級の珍事と決定",
        "大臣談話 「{kw}」は国際問題に非ず",
        "魔法省、{name}に「{kw}」功労章を授与へ",
        "「{kw}」をめぐる調査報告 魔法省が発表",
        "魔法省より通達 {city}周辺の警戒レベル引き上げ",
        "{house}の{name}、魔法省の監視対象に",
        "魔法事故惨事部、「{kw}」の収束を宣言",
      ],
      sub: [
        "魔法法執行部「市民は落ち着いて行動を」",
        "忘却術師の出動は「現時点で不要」",
        "本件は機密等級「ふくろう便限り」に指定",
        "カード図鑑の集計も公式記録に",
        "国際魔法使い連盟へ報告済み",
        "マグル向けの説明文を準備中",
        "立会人に{wit}、記録は地下保管庫へ",
      ],
      lead: [
        "魔法省は本日、{city}において{house}所属の{name}による「{kw}」が確認されたと公式に発表した。",
        "魔法省広報室は{date}、「{kw}」に関する声明を発表した。当事者は{house}の{name}である。",
        "本日未明、魔法省に「{kw}」の報告が寄せられた。調査の結果、当事者は{name}（{house}）と判明した。",
        "魔法省は、{name}が引き起こした「{kw}」について、正式な調査結果を公表した。",
        "以下、魔法省の公式発表を掲載する。「{city}における『{kw}』について」。",
      ],
      mid: [
        "同省によれば、本件は魔法の不適切使用には当たらず、罰則は科されない。",
        "担当官は「{trait}に基づく行動であり、むしろ称賛に値する」と述べた。",
        "関連して報告された「{kw2}」についても、現在調査が進められている。",
        "現場付近のマグルには「テーマパークの演出」として説明済みである。",
        "同省は再発防止のため、全寮にバタービールの適量に関する通達を出す方針だ。",
        "立会人として{wit}が署名し、記録は魔法省地下の保管庫に収められた。",
      ],
      extra: [
        "また、本日時点の公式集計によれば、{hunt}。",
        "カード集めについて同省は「{hunt}。引き続き注視する」とした。",
      ],
      close: [
        "本件に関する問い合わせは、ふくろう便にて受け付ける。",
        "以上、魔法省広報室より。",
        "市民各位におかれては、引き続き冷静な対応を求める。",
        "なお、本発表は掲載後24時間で自動的に燃え尽きる。",
        "同省は今後も、魔法界の秩序維持に努めるとしている。",
      ],
    },
  };

  /* コレクション号外。図鑑の完成率で full（全部）/ part（途中）/ zero（まだ 0 枚）を使い分ける */
  T.final = {
    full: {
      head: [
        "一行、図鑑を完成させる",
        "蛙チョコカード全{total}枚、ついにコンプリート",
        "図鑑 {total}/{total} 枚 伝説の偉業",
        "{by}の最後の1枚 図鑑、ついに完成",
        "{spot}で最後のページ 図鑑完成",
        "号外 蛙チョコカード図鑑、全ページ埋まる",
        "祝 図鑑完成 魔法界は三日三晩の祭りへ",
        "{name}ら一行、全カードを手中に",
        "カード商も脱帽 前代未聞のコンプリート",
      ],
      sub: [
        "最後の1枚を引き当てたのは{byfull}",
        "最後のページは{spot}で埋まった",
        "魔法省「本日を臨時の祝日とする」",
        "目撃した{wit}「図鑑が一瞬、金色に光った」",
        "全{total}枚、すべて解放を確認",
      ],
      lead: [
        "ついにその時が来た。{spot}で{byfull}が最後のカード「{card}」を解放し、蛙チョコカード図鑑が完成した。",
        "魔法界は今日、歴史的な一日を迎えた。全{total}枚の蛙チョコカードがすべて解放され、図鑑の最後のページが埋まった。決め手は{spot}、{byfull}の1枚だ。",
        "{date}、{spot}にて図鑑の完成が確認された。最後の1枚「{card}」を手にしたのは{byfull}である。",
        "長い旅が報われた。{byfull}が{spot}でシャッターを切った瞬間、全{total}枚の図鑑が金色に輝いた。",
      ],
      mid: [
        "最後に並んだのは{list}。どのカードの肖像も、誇らしげに胸を張っている。",
        "目撃した{wit}は「図鑑が一瞬、金色に光った」と興奮気味に語った。",
        "魔法省は本日を臨時の祝日とし、全国の蛙チョコを半額にする方針だ。",
        "なお、完成の直前には「{kw}」という出来事もあったという。",
        "喜びに沸く一行は、「{kw2}」の話で夜まで盛り上がった模様だ。",
        "周囲のマグルは、これをテーマパークの演出だと思い込んでいる。",
      ],
      extra: [
        "今回の殊勲者は、最も多くのカードを解放した{mvp}である。",
        "魔法省は、{mvp}に勲一等マーリン勲章を授与する方針を固めた。",
        "{secretline}全{total}枚、1枚の取りこぼしもない。",
      ],
      close: [
        "図鑑は完成した。旅は、まだ続く。",
        "本紙は今夜、全紙面を金色のインクで刷る。",
        "読者諸君、今夜はカードを枕元に並べて眠りたまえ。",
        "{name}たちの名は、カードの裏の解説文に刻まれるだろう。",
      ],
    },
    part: {
      head: [
        "{by}が伝説のカードを入手",
        "図鑑 {n}/{total} 枚に到達",
        "{by}、「{card}」のカードを引き当てる",
        "速報 カード「{card}」、{spot}で解放",
        "図鑑、残り{left}枚 一行の勢い止まらず",
        "{byfull}、伝説の1枚「{card}」を手に",
        "蛙チョコカード{n}枚目 「{card}」が図鑑入り",
        "{set}のカードに新顔 「{card}」",
        "完成まであと{left}枚 図鑑 {n}/{total} 枚",
      ],
      sub: [
        "引き当てたのは{byfull}",
        "図鑑は{n}/{total}枚、完成率{pct}%",
        "目撃した{wit}「カードが金色に光った」",
        "カード商「相場が動くかもしれない」",
        "現場は{spot}、けが人なし",
      ],
      lead: [
        "本日、{spot}で蛙チョコカード「{card}」が解放された。図鑑はこれで{n}/{total}枚、完成まで残り{left}枚となる。",
        "魔法界に朗報が届いた。{byfull}が{spot}にて伝説のカード「{card}」を引き当てたのである。図鑑はこれで{n}枚目だ。",
        "{date}、カード「{card}」が図鑑の「{set}」のページに加わった。シャッターを切ったのは{byfull}である。",
        "跳ねる蛙チョコを、またひとつ捕まえた。{spot}で「{card}」を手にしたのは{byfull}だ。",
      ],
      mid: [
        "解放の瞬間、カードの肖像が{by}に向かってウインクしたという。",
        "最近の入手は{list}。図鑑の完成率は{pct}%に達した。",
        "目撃した{wit}は「カードが金色に光った」と興奮気味に語った。",
        "なお、現場付近では「{kw}」も目撃されており、関連を調べている。",
        "一行は、同じカードが二度と出ないことを早くも確かめ合っていた。",
        "{by}は取材に対し「あと{left}枚。気は抜けない」と語った。",
      ],
      extra: [
        "{secretline}残るカードは{left}枚。一行は次の被写体を探している。",
        "図鑑の完成まで、あと{left}枚。{mvpline}",
      ],
      close: [
        "本紙は引き続き、カード集めの行方を追う。",
        "次の号外が出るのは、次のカードが解放されたときだ。",
        "読者はカメラの電池切れに注意されたい。",
        "{name}たちの図鑑は、まだ埋まりきらない。",
      ],
    },
    zero: {
      head: [
        "蛙チョコカード争奪戦、開幕",
        "図鑑はまだ白紙 {name}ら一行、カード集めへ",
        "全{total}枚の図鑑 最初の1枚は誰の手に",
        "{house}の{name}、蛙チョコカード争奪戦に名乗り",
        "カードはまだ0枚 嵐の前の静けさ",
        "魔法省、蛙チョコカード争奪戦を正式に承認",
        "蛙チョコ、逃げ出す 一行は追跡態勢へ",
        "伝説のカードを求めて 一行、旅立つ",
      ],
      sub: [
        "図鑑の解放は、まだ0枚",
        "目撃した{wit}「一行の目は本気だった」",
        "シークレットカードの存在もささやかれる",
        "カードは撮影1枚ごとに1枚、全{total}枚",
      ],
      lead: [
        "写真を撮るたびに1枚ずつ解放される蛙チョコカード。全{total}枚の図鑑を埋める旅が、いま始まろうとしている。中心にいるのは{house}の{name}だ。",
        "{date}、{name}（{house}）ら一行が蛙チョコカード争奪戦に名乗りを上げた。図鑑は、まだ1枚も埋まっていない。",
        "開封された蛙チョコは、まだひとつもない。だが{house}の{name}の目は、すでに全{total}枚の図鑑を見据えている。",
      ],
      mid: [
        "最初の1枚は、新幹線の車内で解放されるとの見方が有力だ。",
        "目撃した{wit}は「一行の目は本気だった」と語った。",
        "なお、出発前には「{kw}」という出来事もあったという。",
        "カード商の老魔法使いは「全部そろえた者など見たことがない」と鼻で笑った。",
        "謎を解いた者だけが手にできるシークレットカードがある、とのうわさも流れている。",
      ],
      extra: [
        "図鑑の最後のページは、ホグワーツ特急の前で埋まるとの予言もある。",
        "蛙チョコは一度跳ねたら戻らない。シャッターは素早く切るのが鉄則だ。",
      ],
      close: [
        "本紙は、最初の1枚が解放される瞬間を待っている。",
        "続報は、最初のカードが出たときに。",
        "{name}たちの図鑑は、まだ白紙のままだ。",
      ],
    },
  };

  const WEATHER = [
    "近畿地方は晴れ時々ふくろう。午後はところにより吸魂鬼。念のため守護霊の準備を。",
    "降水確率30%。ただしバタービールの泡が降る可能性あり。口ひげに注意。",
    "大阪はくもり。吸魂鬼の接近で体感温度は−5度。チョコレートの携帯を推奨。",
    "夕方から箒日和。追い風、高度制限なし。ただしマグルの目には気をつけて。",
    "晴れ。ローブの中は真夏。乾燥呪文の使いすぎに注意。",
    "ホグズミード方面は粉雪。帰りの新幹線は暖かい模様。",
  ];
  const ADS = [
    { title: "トリック＆ニブル いたずら商会", body: "しゃっくり飴、逆さ歩きソックス、鳴くメモ帳。友達の顔を見る前にどうぞ。", foot: "ダイアゴン横丁 裏通り7番地" },
    { title: "ふくろう急便 関西出張所", body: "スクショ1枚から運びます。翌朝着。ふくろうの機嫌しだい。", foot: "ご用命は窓辺にて" },
    { title: "マダム・ポプリの口ひげ取り", body: "バタービールの泡ひげ、ひと拭きで消えます。消えなければそれは魔法です。", foot: "1本 3シックル" },
    { title: "なんでも味キャンディ", body: "今季の新味：新幹線の座席の味、帰りたくない味、寝過ごしの味。", foot: "当たり外れは自己責任" },
    { title: "ローブ速乾サービス", body: "10月でも汗だくのあなたへ。乾燥呪文を1回5クヌートで。", foot: "駅前 魔法クリーニング" },
    { title: "反転羽ペン", body: "書いた悪口がすべて褒め言葉に変わる。友情を守る一本。", foot: "文具の店 カリグラ堂" },
  ];
  const NOTICES = [
    "【尋ね人】{wit}の片方の靴下。見つけた方はふくろう便で。",
    "【落とし物】杖1本（{house}カラー）。持ち主は名乗り出ること。",
    "【求む】帰りの新幹線で起こしてくれる係。報酬はチョコレート。",
    "【読者の声】「旅行中の記事が毎回わたしのことばかりなのはなぜですか」——{name}",
    "【訂正】前号で「魔法使い」とあったのは「よく食べる魔法使い」の誤りでした。",
  ];
  const TAGLINES = ["魔法界随一の日刊紙", "ふくろう便で毎朝お届け", "真実と、少しの誇張を"];
  const PRICES = ["1クヌート", "1クヌート（ふくろう代別）", "号外につき1クヌート"];

  /* ---------- データから差し込み値を作る ---------- */
  function playerLabel(id) {
    const p = id ? HP.player(id) : null;
    if (!p || !p.name.trim()) return null;
    return { id: p.id, name: p.name.trim(), house: p.house || null };
  }

  /* ---------- カード図鑑の現状。寮杯（HP.scores）は使わない ---------- */
  const setLabel = (id) => (SETS.find((x) => x.id === id) || SETS[3]).label;
  const setSpot = (id) => (SETS.find((x) => x.id === id) || SETS[3]).spot;
  /* ハント側の group をセットに寄せる。custom-* など知らないものは「自分たち」 */
  function setOf(group, key) {
    const g = String(group || "").toLowerCase();
    if (g.indexOf("secret") >= 0) return "secret";
    if (g === "shinkansen" || g === "usj" || g === "night") return g;
    if (g) return "self";
    if (/^lt-/.test(key)) return "shinkansen";
    if (/^hx-/.test(key)) return "usj";
    if (/^nt-/.test(key)) return "night";
    return "self";
  }
  function toTime(v) {
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string" && v) { const t = Date.parse(v); return isNaN(t) ? 0 : t; }
    return 0;
  }
  /* 解放の記録（いつ・誰が）。hx は horcrux[id]、それ以外は shots[key]（時刻 or { at, by }）、lt は letters[L].photoAt */
  function recordOf(key, H) {
    let at = 0, by = null, has = false;
    const X = H.horcrux || {}, S = H.shots || {}, L = H.letters || {};
    if (key.indexOf("hx-") === 0) {
      const r = X[key.slice(3)];
      if (r && typeof r === "object") { has = !!r.doneAt; at = toTime(r.doneAt); by = r.by || null; }
      else if (r) has = true;
    }
    const sh = S[key];
    if (sh) {
      has = true;
      if (typeof sh === "object") { at = at || toTime(sh.at || sh.doneAt); by = by || sh.by || null; }
      else at = at || toTime(sh);
    }
    const lt = LT.find((x) => x.key === key);
    if (lt) {
      const r = L[lt.letter];
      if (r && r.photoAt) { has = true; at = at || toTime(r.photoAt); }
      if (r && r.by) by = by || r.by;
    }
    return { has, at, by };
  }
  function fixedName(key) {
    const x = HX.find((y) => "hx-" + y.id === key);
    if (x) return x.name;
    const l = LT.find((y) => y.key === key);
    return l ? l.name : "";
  }
  function byLabel(by) {
    if (by === "all") return { name: "一行全員", full: "一行全員" };
    const p = playerLabel(by);
    if (!p) return null;
    const hs = p.house && HP.HOUSES[p.house];
    return { name: p.name, full: hs ? hs.jp + "の" + p.name : p.name, player: p };
  }
  function cardInfo() {
    const H = (HP.state && HP.state.hunt) || {};
    let src = missionList();
    if (!src || !src.length) {
      src = LT.map((x) => ({ key: x.key, title: x.name, group: "shinkansen", done: null }))
        .concat(HX.map((x) => ({ key: "hx-" + x.id, title: x.name, group: "usj", done: null })));
    }
    const seen = {};
    const cards = [];
    src.forEach((m, i) => {
      if (!m || typeof m.key !== "string" || seen[m.key]) return;
      seen[m.key] = true;
      const rec = recordOf(m.key, H);
      const set = setOf(m.group, m.key);
      const hx = HX.find((y) => "hx-" + y.id === m.key);
      cards.push({
        key: m.key, i, set, setLabel: setLabel(set),
        name: String(m.title || "").trim() || fixedName(m.key) || "名もなきカード",
        spot: hx ? hx.spot : setSpot(set),
        done: m.done == null ? rec.has : !!m.done,
        at: rec.at, by: rec.by,
      });
    });
    const done = cards.filter((c) => c.done).sort((a, b) => (a.at - b.at) || (a.i - b.i));
    const sets = SETS.map((st) => {
      const cs = cards.filter((c) => c.set === st.id);
      return { id: st.id, label: st.label, n: cs.filter((c) => c.done).length, total: cs.length };
    }).filter((x) => x.total > 0);
    const count = {};
    done.forEach((c) => { if (playerLabel(c.by)) count[c.by] = (count[c.by] || 0) + 1; });
    const top = Math.max(0, ...Object.values(count));
    const mvp = top > 0
      ? { count: top, players: Object.keys(count).filter((id) => count[id] === top).map(playerLabel) }
      : null;
    const n = done.length, total = cards.length;
    return { cards, done, n, total, full: total > 0 && n >= total, sets, mvp };
  }
  /* 記事に残す図鑑の要約（最近解放したカードは新しい順に 3 枚） */
  function cardSummary(info) {
    return {
      n: info.n, total: info.total,
      sets: info.sets.map((x) => ({ label: x.label, n: x.n, total: x.total })),
      recent: info.done.slice(-3).reverse().map((c) => {
        const b = byLabel(c.by);
        return { name: c.name, set: c.setLabel, by: b ? b.name : "" };
      }),
    };
  }

  function huntPhrase(n, total) {
    if (n <= 0) return "蛙チョコカードはまだ1枚も解放されていない";
    if (total > 0 && n >= total) return "蛙チョコカード図鑑は全" + total + "枚コンプリート済み";
    return "蛙チョコカード図鑑は" + n + "/" + total + "枚";
  }

  function parseKeywords(text) {
    return String(text || "").split(/[\n、,，。]+/).map((s) => s.trim()).filter(Boolean);
  }

  function makeVars(input) {
    const players = HP.activePlayers();
    let hero = input.heroId ? HP.player(input.heroId) : null;
    const info = cardInfo();
    const n = info.n, total = info.total;
    // コレクション号外の「主なカード」：最近 3 枚にシークレットがあればそれ、なければいちばん新しい 1 枚
    const last3 = info.done.slice(-3);
    const secret = last3.filter((c) => c.set === "secret");
    const key = n ? (secret.length ? secret[secret.length - 1] : info.done[n - 1]) : null;
    const b = key ? byLabel(key.by) : null;
    // コレクション号外で主役が「おまかせ」なら、カードを出した本人を主役にする
    if ((!hero || !hero.name.trim()) && input.tone === "final" && b && b.player) hero = HP.player(b.player.id);
    if (!hero || !hero.name.trim()) hero = players.length ? pick(players) : null;
    const house = hero && HP.HOUSES[hero.house];
    const others = players.filter((p) => !hero || p.id !== hero.id);
    const kws = parseKeywords(input.keywords);
    const kw = kws.length ? kws[0] : pick(FALLBACK_KW);
    const kw2 = kws.length > 1 ? pick(kws.slice(1)) : pick(FALLBACK_KW.filter((k) => k !== kw));
    const mvpName = info.mvp ? info.mvp.players.map((p) => p.name).join("と") : "";
    const recent = info.done.slice(-3).reverse().map((c) => "「" + c.name + "」");
    const sDone = info.done.filter((c) => c.set === "secret");
    return {
      vars: {
        name: hero ? hero.name.trim() : "ある魔法使い",
        house: house ? house.jp : "寮未定",
        trait: house ? house.trait : "好奇心",
        animal: house ? house.animal : "ふくろう",
        kw, kw2,
        city: pick(CITIES),
        wit: others.length && Math.random() < 0.5 ? pick(others).name.trim() : pick(WITNESSES),
        hunt: huntPhrase(n, total),
        mvp: mvpName || "一行の全員",
        mvpline: mvpName ? "カード集めの首位は" + mvpName + "（" + info.mvp.count + "枚）だ。" : "",
        n: String(n),
        total: String(total),
        left: String(Math.max(0, total - n)),
        pct: String(total ? Math.floor((n / total) * 100) : 0),
        card: key ? key.name : "蛙チョコカード",
        set: key ? key.setLabel : "図鑑",
        spot: key ? key.spot : "現場",
        by: b ? b.name : "一行",
        byfull: b ? b.full : "一行のひとり",
        list: recent.length ? recent.join("、") : "蛙チョコカード",
        secretline: sDone.length ? "謎を解いた者だけが手にするシークレットカード「" + sDone[sDone.length - 1].name + "」も図鑑に収まった。" : "",
        date: "本日",
      },
      heroId: hero ? hero.id : null,
      heroHouse: hero ? hero.house : null,
      info,
    };
  }

  /* 本文を 150〜250 字に収める */
  function buildBody(set, v) {
    for (let tries = 0; tries < 12; tries++) {
      const lead = fill(pick(set.lead), v);
      const mids = shuffle(set.mid).map((m) => fill(m, v));
      const extra = fill(pick(set.extra), v);
      const close = fill(pick(set.close), v);
      let useMid = mids.slice(0, 2);
      let useExtra = true;
      const total = () => len(lead) + useMid.reduce((n, s) => n + len(s), 0) + (useExtra ? len(extra) : 0) + len(close);
      while (total() < 150 && useMid.length < mids.length) useMid.push(mids[useMid.length]);
      while (total() > 250 && useMid.length > 1) useMid.pop();
      if (total() > 250) useExtra = false;
      if (total() > 250 && useMid.length) useMid = [];
      const n = total();
      if ((n >= 150 && n <= 250) || tries === 11) {
        const paras = [lead + (useMid[0] || "")];
        const second = useMid.slice(1).join("") + (useExtra ? extra : "");
        if (second) paras.push(second);
        paras.push(close);
        return paras;
      }
    }
  }

  function finalSet(info) { return info.full ? T.final.full : info.n > 0 ? T.final.part : T.final.zero; }

  function generate(input, prev) {
    const tone = TONES[input.tone] ? input.tone : "incident";
    const m = makeVars(Object.assign({}, input, { tone }));
    const info = m.info, n = info.n;
    const set = tone === "final" ? finalSet(info) : T[tone];
    let headline = fill(pick(set.head), m.vars);
    for (let i = 0; i < 5 && prev && headline === prev.headline; i++) headline = fill(pick(set.head), m.vars);
    const photoCaps = tone === "final" && n > 0
      ? ["▲ 動く写真：カード「{card}」が解放された瞬間（{spot}）", "▲ 写真の中の{by}は、いまもカードを掲げ続けている"]
      : [
        "▲ 動く写真：「{kw}」の直後をとらえた一枚（本紙カメラマン撮影）",
        "▲ 写真の中の{name}は、いまも手を振り続けている",
        "▲ 現場写真。撮影後、カメラから紫の煙が出た",
      ];
    return {
      tone,
      kicker: tone === "final" && info.full ? "号外・図鑑コンプリート" : TONES[tone].kicker,
      byline: TONES[tone].byline,
      headline,
      sub: fill(pick(set.sub), m.vars),
      body: buildBody(set, m.vars),
      caption: fill(pick(photoCaps), m.vars),
      date: todayJp(),
      issue: "第" + (1000 + Math.floor(Math.random() * 9000)).toLocaleString("ja-JP") + "号",
      price: pick(PRICES),
      tagline: pick(TAGLINES),
      cards: cardSummary(info),
      mvp: info.mvp,
      weather: pick(WEATHER),
      ad: pick(ADS),
      notice: fill(pick(NOTICES), m.vars),
      heroId: m.heroId,
      heroName: m.vars.name,
      heroHouse: m.heroHouse,
      at: new Date().toISOString(),
    };
  }

  /* ---------- 写真・動画（保存は HP.media） ---------- */
  const OWN = "paper-photo";
  /* ハント側の全撮影ミッション（= カード）一覧。無い・壊れているときは null（固定の一覧に戻る） */
  function missionList() {
    const H = window.HP_HUNT;
    if (!H || typeof H.photoMissions !== "function") return null;
    try { const r = H.photoMissions(); return Array.isArray(r) ? r : null; } catch (e) { return null; }
  }
  function choices() {
    const out = [];
    if (HP.media.get(OWN)) out.push({ key: OWN, name: "選んだ写真" });
    const ms = missionList();
    if (ms) {
      const seen = { [OWN]: true };
      ms.forEach((m) => {
        if (!m || typeof m.key !== "string" || seen[m.key] || !HP.media.get(m.key)) return;
        seen[m.key] = true;
        out.push({ key: m.key, name: String(m.title || "").trim() || "ミッションの写真", group: m.group || "" });
      });
      return out;
    }
    HX.forEach((x) => { const k = "hx-" + x.id; if (HP.media.get(k)) out.push({ key: k, name: x.name }); });
    LT.forEach((x) => { if (HP.media.get(x.key)) out.push({ key: x.key, name: x.name }); });
    return out;
  }
  function nameOf(key) {
    if (key === OWN) return "選んだ写真";
    const c = choices().find((y) => y.key === key);
    if (c) return c.name;
    const x = HX.find((y) => "hx-" + y.id === key);
    if (x) return x.name;
    const l = LT.find((y) => y.key === key);
    return l ? l.name : "";
  }
  function mainKey() {
    const k = HP.state.paper && HP.state.paper.photoKey;
    return k && HP.media.get(k) ? k : null;
  }
  function setMainKey(k) {
    HP.state.paper = Object.assign({}, HP.state.paper, { photoKey: k || null });
    HP.save();
  }
  /* 写真なら <img>、動画なら無音ループの <video>。動きを減らす設定なら動画は止めて置く */
  function mediaEl(key, cls, label, controls) {
    const m = HP.media.get(key);
    if (!m) return null;
    const attrs = { class: cls || null };
    if (m.kind === "video") attrs["aria-label"] = label; else attrs.alt = label;
    const el = HP.media.el(key, attrs);
    if (el && m.kind === "video") {
      el.setAttribute("preload", "metadata");
      if (reduceMotion()) {
        el.autoplay = false; el.removeAttribute("autoplay");
        try { el.pause(); } catch (e) {}
        if (controls) el.controls = true;
      }
    }
    return el;
  }
  /* 旧版が独自キーに入れていた写真を HP.media へ移す（1 回だけ） */
  async function migrateOld() {
    const OLD = "hp-trip-v1:paper-photo";
    let url = null;
    try { url = localStorage.getItem(OLD); } catch (e) {}
    if (!url) return;
    try {
      const blob = await (await fetch(url)).blob();
      const r = await HP.media.put(OWN, new File([blob], "paper.jpg", { type: blob.type || "image/jpeg" }));
      if (r.saved) { try { localStorage.removeItem(OLD); } catch (e) {} }
      if (!(HP.state.paper && HP.state.paper.photoKey)) setMainKey(OWN);
    } catch (e) {}
  }

  /* ---------- CSS ---------- */
  const CSS = `
/* 紙面の外側は locore の白い UI（index.html のトークン）。
 * 紙面（.pp-paper）だけは生成りの紙とインクの黒。飾りは罫線と文字の階層で出す。
 * 紙面の中は html2canvas で画像にするので、border・background-color・font だけで組む */
.pp-wrap { display: grid; gap: 16px; min-width: 0; }
.pp-wrap [hidden] { display: none !important; }
.pp-vh { position: absolute !important; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

/* ---- 入力フォーム（白いカード） ---- */
.pp-form {
  min-width: 0; display: grid; gap: 20px;
  padding: 20px 18px; border-radius: var(--radius);
  background: var(--lc-surface); border: 1px solid var(--lc-border); box-shadow: var(--shadow-sm);
}
.pp-form .eyebrow { margin: 0 0 4px; }
.pp-form-title { margin: 0; font-size: 20px; font-weight: 700; color: var(--lc-fg); line-height: 1.4; min-width: 0; }
.pp-lead { margin: 6px 0 0; font-size: 14px; line-height: 1.7; }
.pp-field { display: grid; gap: 8px; min-width: 0; margin: 0; padding: 0; border: 0; }
.pp-label { font-weight: 700; font-size: 14px; color: var(--lc-fg); padding: 0; }
.pp-hint { font-size: 12px; line-height: 1.6; color: var(--lc-fg-muted); margin: 0; }
.pp-input {
  width: 100%; max-width: 100%; min-height: 44px; min-width: 0;
  padding: 10px 14px; border-radius: 12px;
  background: #fff; color: var(--lc-fg);
  border: 1px solid var(--lc-border-strong); font: inherit; font-size: 16px; line-height: 1.5;
  transition: border-color .2s var(--ease-out), box-shadow .2s var(--ease-out);
}
textarea.pp-input { min-height: 88px; resize: vertical; }
.pp-input::placeholder { color: var(--lc-fg-subtle); }
.pp-input:focus { border-color: var(--lime-700); outline: none; box-shadow: 0 0 0 3px var(--lime-100); }

.pp-photo-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
.pp-photo-row .btn { position: relative; }
.pp-photo-row .btn:has(input:focus-visible) { outline: 2px solid var(--lime); outline-offset: 2px; }

/* メイン写真の候補。折り返しのグリッド（402px で 3 列、320px で 2 列） */
.pp-pick { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; min-width: 0; }
.pp-pick-btn {
  display: grid; grid-template-rows: auto auto; gap: 6px; align-content: start;
  min-width: 0; min-height: 44px; padding: 4px 4px 8px; margin: 0;
  border-radius: 12px; border: 1px solid var(--lc-border); background: #fff;
  color: var(--lc-fg-2); cursor: pointer; text-align: center; font: inherit;
  transition: border-color .2s var(--ease-out), background-color .2s var(--ease-out), transform .12s var(--ease-out);
}
.pp-pick-btn:active { transform: scale(.97); }
.pp-pick-btn[aria-pressed="true"] { border-color: var(--lime); background: var(--lime-50); box-shadow: 0 0 0 1px var(--lime); color: var(--lc-fg); }
.pp-pick-media {
  position: relative; display: block; width: 100%; aspect-ratio: 1; overflow: hidden;
  border-radius: 8px; background: var(--lc-muted);
}
.pp-pick-media img, .pp-pick-media video { display: block; width: 100%; height: 100%; object-fit: cover; }
.pp-pick-none { display: grid; place-items: center; font-size: 20px; color: var(--lc-fg-subtle); }
.pp-pick-check {
  position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border-radius: 50%;
  display: none; place-items: center; background: var(--lime); color: #0e0e0f;
  font-size: 13px; font-weight: 700; line-height: 1; box-shadow: var(--shadow-sm);
}
.pp-pick-btn[aria-pressed="true"] .pp-pick-check { display: grid; }
.pp-pick-name {
  min-width: 0; font-size: 12px; font-weight: 500; line-height: 1.4; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}

/* トーン（ラジオのカード） */
.pp-tones { display: grid; gap: 8px; }
.pp-tone {
  display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 56px;
  padding: 10px 14px; border-radius: 12px; cursor: pointer;
  border: 1px solid var(--lc-border); background: #fff;
  transition: border-color .2s var(--ease-out), background-color .2s var(--ease-out);
}
.pp-tone input { flex-shrink: 0; width: 20px; height: 20px; margin: 0; accent-color: var(--lime-700); }
.pp-tone-text { flex: 1; min-width: 0; display: grid; }
.pp-tone-name { font-weight: 700; font-size: 15px; line-height: 1.45; color: var(--lc-fg); }
.pp-tone-desc { font-size: 12px; color: var(--lc-fg-muted); line-height: 1.55; }
.pp-tone:has(input:checked) { border-color: var(--lime); background: var(--lime-50); box-shadow: 0 0 0 1px var(--lime); }

.pp-print { width: 100%; font-size: 16px; min-height: 52px; }

/* ---- 紙面 ---- */
.pp-out { display: grid; gap: 14px; min-width: 0; scroll-margin-top: 64px; }
.pp-out:empty { display: none; }
.pp-paper {
  --pp-ink: #1b1a17;
  --pp-ink-2: #3b3833;
  --pp-dim: #6a655b;
  --pp-hair: #cdc6b6;
  --pp-red: #a3241c;
  --pp-paper: #f4f0e6;
  --pp-serif: "Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", YuMincho, "Noto Serif JP", serif;
  container: pp / inline-size;
  min-width: 0; max-width: 100%;
  padding: 16px 14px 14px; border-radius: 0;
  color: var(--pp-ink);
  background-color: var(--pp-paper);
  border: 1px solid #e2dccd;
  box-shadow: var(--shadow-md);
  font-family: var(--pp-serif);
}
.pp-mast { text-align: center; min-width: 0; }
.pp-topline {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 10px;
  padding-bottom: 6px; border-bottom: 1px solid var(--pp-ink);
  font-family: var(--font-jp); font-size: 12px; color: var(--pp-dim); text-align: left;
}
.pp-stamp {
  flex-shrink: 0; white-space: nowrap;
  padding: 0 8px; border: 1px solid var(--pp-red); color: var(--pp-red);
  font-family: var(--font-jp); font-weight: 700; font-size: 12px; line-height: 1.6; letter-spacing: .2em;
}
.pp-tag { min-width: 0; letter-spacing: .04em; }
.pp-title-row {
  display: flex; align-items: center; justify-content: center; min-width: 0;
  margin: 10px 0 8px;
}
/* 320px 幅（紙面の内側 約 258px）でも 1 行に収まる大きさ */
.pp-title {
  min-width: 0; margin: 0; white-space: nowrap;
  font-family: var(--pp-serif); font-weight: 800;
  font-size: clamp(26px, 9.2vw, 46px); line-height: 1.1; letter-spacing: .04em;
  color: var(--pp-ink);
}
.pp-meta {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 2px 12px;
  padding: 5px 0; margin-top: 4px;
  border-top: 3px solid var(--pp-ink); border-bottom: 1px solid var(--pp-ink);
  font-family: var(--font-jp); font-size: 12px; font-weight: 500; color: var(--pp-ink-2);
  font-variant-numeric: tabular-nums;
}
.pp-meta span { flex-shrink: 0; white-space: nowrap; }

.pp-grid { display: grid; gap: 18px; margin-top: 16px; min-width: 0; }
.pp-main, .pp-side { min-width: 0; }
.pp-kicker {
  display: inline-block; white-space: nowrap; max-width: 100%;
  padding: 0 0 2px; border-bottom: 2px solid var(--pp-red); color: var(--pp-red);
  font-family: var(--font-jp); font-weight: 700; font-size: 12px; letter-spacing: .14em;
}
.pp-headline {
  margin: 10px 0 8px; min-width: 0;
  font-family: var(--pp-serif); font-weight: 800;
  font-size: clamp(24px, 7.4vw, 34px); line-height: 1.32; letter-spacing: .01em;
  text-wrap: balance; overflow-wrap: anywhere; color: var(--pp-ink);
}
.pp-sub {
  margin: 0 0 12px; padding-bottom: 10px; border-bottom: 1px solid var(--pp-hair);
  font-family: var(--font-jp); font-weight: 500; font-size: 15px; line-height: 1.6; color: var(--pp-ink-2); overflow-wrap: anywhere;
}
.pp-fig { margin: 0 0 12px; max-width: 100%; }
.pp-frame {
  position: relative; overflow: hidden; aspect-ratio: 4 / 3; max-width: 100%;
  background-color: #2b2925;
}
.pp-frame img, .pp-frame video {
  display: block; width: 100%; height: 100%; object-fit: cover;
  filter: sepia(.75) grayscale(.3) contrast(1.08);
  transform-origin: 50% 45%;
  animation: pp-move 12s ease-in-out infinite alternate;
}
@keyframes pp-move {
  0%   { transform: scale(1.03) translate(0, 0); }
  50%  { transform: scale(1.07) translate(-1%, .6%); }
  100% { transform: scale(1.09) translate(.8%, -.4%); }
}
.pp-cap {
  margin-top: 6px; padding-bottom: 6px; border-bottom: 1px solid var(--pp-hair);
  font-family: var(--font-jp); font-size: 12px; line-height: 1.55; color: var(--pp-dim);
}
.pp-byline {
  margin-bottom: 8px; font-family: var(--font-jp); font-size: 12px; font-weight: 700; color: var(--pp-ink-2);
  letter-spacing: .04em;
}
.pp-body p {
  margin: 0 0 .8em; font-family: var(--pp-serif); font-weight: 500;
  font-size: 15px; line-height: 1.9; text-align: justify; overflow-wrap: anywhere; color: var(--pp-ink);
}
.pp-body p:last-child { margin-bottom: 0; }

/* サイド欄：枠で囲まず、上の罫線と小見出しで区切る */
.pp-side { display: grid; gap: 16px; align-content: start; }
.pp-box { min-width: 0; padding-top: 8px; border-top: 2px solid var(--pp-ink); }
.pp-box-h {
  margin: 0 0 6px;
  font-family: var(--font-jp); font-weight: 700; font-size: 13px; letter-spacing: .1em; color: var(--pp-ink);
}
.pp-hx { list-style: none; margin: 0; padding: 0; display: grid; font-family: var(--font-jp); font-size: 13px; line-height: 1.5; }
.pp-hx li { display: flex; align-items: baseline; gap: 8px; min-width: 0; padding: 4px 0; border-bottom: 1px solid var(--pp-hair); }
.pp-hx-name { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; color: var(--pp-ink-2); }
.pp-hx-mark { flex-shrink: 0; white-space: nowrap; font-weight: 700; min-width: 1.5em; text-align: center; }
.pp-hx li.is-done .pp-hx-name { color: var(--pp-ink); font-weight: 500; }
.pp-hx li.is-done .pp-hx-mark { color: var(--pp-red); }
.pp-hx li:not(.is-done) .pp-hx-mark { color: var(--pp-dim); font-weight: 400; }
.pp-hx-sum { margin: 8px 0 0; font-family: var(--font-jp); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.pp-count { flex-shrink: 0; white-space: nowrap; font-family: var(--font-jp); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--pp-ink-2); }
.pp-mvp { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-family: var(--font-jp); font-size: 14px; }
.pp-mvp-name { min-width: 0; font-family: var(--pp-serif); font-weight: 800; font-size: 19px; line-height: 1.35; overflow-wrap: anywhere; }
.pp-small { font-family: var(--font-jp); font-size: 13px; line-height: 1.7; margin: 0; overflow-wrap: anywhere; color: var(--pp-ink-2); }
/* 広告だけは枠で囲む（紙面の中の「別もの」） */
.pp-ad { text-align: center; padding: 12px; border: 1px solid var(--pp-ink); }
.pp-ad-title { font-family: var(--pp-serif); font-weight: 800; font-size: 17px; line-height: 1.4; margin: 0 0 6px; overflow-wrap: anywhere; }
.pp-ad-foot { margin-top: 6px; font-family: var(--font-jp); font-size: 12px; color: var(--pp-dim); }
/* 紙面の下：本日の動く写真 */
.pp-gallery { margin-top: 18px; padding-top: 8px; border-top: 3px solid var(--pp-ink); min-width: 0; }
.pp-gallery-h { margin: 0 0 10px; font-family: var(--font-jp); font-weight: 700; font-size: 13px; letter-spacing: .1em; }
.pp-gal { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 10px; min-width: 0; }
.pp-gal li { min-width: 0; margin: 0; }
.pp-gal-frame { aspect-ratio: 1; overflow: hidden; background-color: #2b2925; }
.pp-gal-frame img, .pp-gal-frame video {
  display: block; width: 100%; height: 100%; object-fit: cover;
  filter: sepia(.75) grayscale(.3) contrast(1.06);
}
.pp-gal-cap { margin-top: 4px; font-family: var(--font-jp); font-size: 12px; line-height: 1.4; color: var(--pp-dim); overflow-wrap: anywhere; }
.pp-foot {
  margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--pp-ink);
  text-align: center; font-family: var(--font-jp); font-size: 12px; color: var(--pp-dim);
}

/* ---- 紙面の下（白い UI） ---- */
.pp-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; min-width: 0; }
.pp-actions .btn { flex-shrink: 0; white-space: nowrap; min-height: 44px; }
.pp-share {
  margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--lc-muted);
  font-size: 13px; line-height: 1.6; text-align: center; color: var(--lc-fg-muted); min-width: 0; overflow-wrap: anywhere;
}
/* 画像にした紙面（長押しで保存） */
.pp-shot { display: grid; gap: 10px; min-width: 0; margin: 0; }
.pp-shot-guide {
  margin: 0; padding: 10px 14px; border-radius: 12px; min-width: 0;
  background: var(--lime-50); border: 1px solid var(--lime-100); color: var(--lime-900);
  font-size: 14px; font-weight: 700; line-height: 1.6; text-align: center; overflow-wrap: anywhere;
}
.pp-shot-img {
  display: block; width: 100%; max-width: 100%; height: auto; border-radius: 4px;
  border: 1px solid var(--lc-border);
  -webkit-touch-callout: default; -webkit-user-select: auto; user-select: auto;
  box-shadow: var(--shadow-md);
}
/* 書き出し中だけ：動きを止め、焼き込んだ写真にはフィルタを重ねない */
.pp-snap .pp-frame img, .pp-snap .pp-frame video { animation: none !important; transform: none !important; }
.pp-baked { filter: none !important; }
.pp-vid-ph {
  width: 100%; height: 100%; display: grid; place-items: center; padding: 8px; box-sizing: border-box;
  background-color: #2b2925; color: #f4f0e6; text-align: center;
  font-family: var(--font-jp); font-size: 14px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere;
}
.pp-gal-frame .pp-vid-ph { font-size: 12px; padding: 4px; }

@container pp (min-width: 460px) {
  .pp-grid { grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 20px; }
  .pp-side { border-left: 1px solid var(--pp-hair); padding-left: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .pp-frame img, .pp-frame video { animation: none !important; transform: scale(1.03); }
}
`;

  /* ---------- 描画 ---------- */
  let els = {};
  let current = null; // 表示中の記事
  let pickSig = null; // 候補一覧が変わったときだけ作り直す
  let autoN = 0;      // コレクション号外を自動で選んだときの解放枚数

  let heroInit = false;
  function heroOptions(select) {
    let keep = select.value;
    if (!heroInit) { heroInit = true; keep = (HP.state.paper && HP.state.paper.draft && HP.state.paper.draft.heroId) || ""; }
    select.textContent = "";
    select.append(h("option", { value: "" }, "おまかせ（ランダム）"));
    HP.activePlayers().forEach((p) => {
      const house = HP.HOUSES[p.house];
      select.append(h("option", { value: p.id }, p.name.trim() + (house ? "（" + house.jp + "）" : "")));
    });
    select.value = keep && HP.player(keep) && HP.player(keep).name.trim() ? keep : "";
  }

  function readForm() {
    const t = els.form.querySelector('input[name="pp-tone"]:checked');
    return { heroId: els.hero.value || "", keywords: els.kw.value, tone: t ? t.value : "incident" };
  }

  function signature() {
    return choices().map((c) => { const m = HP.media.get(c.key); return c.key + "|" + m.kind + "|" + m.url.length + m.url.slice(-24); }).join(",");
  }

  /* メイン写真の候補グリッド。タップで選ぶ／もう一度タップで外す */
  function renderPicker(force) {
    const sel = mainKey();
    const sig = signature();
    if (force || sig !== pickSig) {
      pickSig = sig;
      const list = choices();
      els.pick.textContent = "";
      const tile = (key, label, inner) => h("button", {
        type: "button", class: "pp-pick-btn", "data-key": key, "aria-pressed": "false",
        onclick: () => {
          const next = key && key !== mainKey() ? key : null;
          setMainKey(next);
          renderPicker();
          if (current) renderPaper(current);
        },
      },
        h("span", { class: "pp-pick-media" + (inner ? "" : " pp-pick-none") }, inner || "—", h("span", { class: "pp-pick-check", "aria-hidden": "true" }, "✓")),
        h("span", { class: "pp-pick-name" }, label));
      els.pick.append(tile("", "写真なし", null));
      list.forEach((c) => els.pick.append(tile(c.key, c.name, mediaEl(c.key, null, c.name))));
      els.pickHint.textContent = list.some((c) => c.key !== OWN)
        ? "カード集めで撮った写真・動画から選べます"
        : "カード集めで撮った写真・動画は、まだありません";
      els.ownRemove.hidden = !HP.media.get(OWN);
      els.photoBtnText.textContent = HP.media.get(OWN) ? "写真・動画を変える" : "写真・動画を選ぶ";
    }
    els.pick.querySelectorAll(".pp-pick-btn").forEach((b) => {
      b.setAttribute("aria-pressed", (b.dataset.key || null) === sel ? "true" : "false");
    });
  }

  function box(title, ...kids) {
    return h("section", { class: "pp-box" }, h("h4", { class: "pp-box-h" }, title), ...kids);
  }

  function renderPaper(a) {
    current = a;
    // 図鑑の要約が無い古い記事（寮杯・分霊箱の時代）は、いまの図鑑で埋める
    const live = a.cards ? null : cardInfo();
    const cs = a.cards || cardSummary(live);
    const mvpData = a.cards ? a.mvp : live.mvp;

    const setList = h("ul", { class: "pp-hx" }, cs.sets.map((x) =>
      h("li", { class: x.total && x.n >= x.total ? "is-done" : null },
        h("span", { class: "pp-hx-name" }, x.label),
        h("span", { class: "pp-hx-mark", "aria-label": x.total + "枚中" + x.n + "枚" }, x.n + "/" + x.total))));
    const recent = cs.recent.length ? [
      h("p", { class: "pp-hx-sum" }, "最近解放したカード"),
      h("ul", { class: "pp-hx" }, cs.recent.map((c) =>
        h("li", { class: "is-done" },
          h("span", { class: "pp-hx-name" }, c.name + (c.by ? "（" + c.by + "）" : "")),
          h("span", { class: "pp-hx-mark", "aria-label": "解放済み" }, "✓")))),
    ] : [h("p", { class: "pp-small" }, "まだ1枚も解放されていない")];
    const mvp = mvpData && mvpData.players && mvpData.players.length
      ? h("div", { class: "pp-mvp" },
          mvpData.players.map((p) => [h("span", { class: "pp-mvp-name" }, p.name), HP.houseChip(p.house)]).flat(),
          h("span", { class: "pp-count" }, "カード" + mvpData.count + "枚"))
      : h("p", { class: "pp-small" }, "該当者なし");

    const key = mainKey();
    const card = key && key !== OWN ? (live || cardInfo()).cards.find((c) => c.key === key) : null;
    const caption = card ? "▲ 動く写真：蛙チョコカード「" + card.name + "」の一枚（" + card.setLabel + "）" : a.caption;

    const gal = choices().filter((c) => c.key !== OWN && c.key !== key).slice(0, 6);
    const gallery = gal.length ? h("section", { class: "pp-gallery" },
      h("h4", { class: "pp-gallery-h" }, "本日の動く写真"),
      h("ul", { class: "pp-gal" }, gal.map((c) =>
        h("li", null,
          h("figure", { style: { margin: "0" } },
            h("div", { class: "pp-gal-frame" }, mediaEl(c.key, null, c.name)),
            h("figcaption", { class: "pp-gal-cap" }, c.name)))))) : null;

    const paper = h("article", { class: "pp-paper", "aria-label": "日刊予言者新聞 " + a.date },
      h("header", { class: "pp-mast" },
        h("div", { class: "pp-topline" }, h("span", { class: "pp-stamp" }, "号外"), h("span", { class: "pp-tag" }, a.tagline)),
        h("div", { class: "pp-title-row" },
          h("h2", { class: "pp-title" }, "日刊予言者新聞")),
        h("div", { class: "pp-meta" }, h("span", null, a.date), h("span", null, a.issue), h("span", null, "定価 " + a.price))),
      h("div", { class: "pp-grid" },
        h("div", { class: "pp-main" },
          h("span", { class: "pp-kicker" }, a.kicker),
          h("h3", { class: "pp-headline" }, a.headline),
          h("p", { class: "pp-sub" }, a.sub),
          key ? h("figure", { class: "pp-fig" },
            h("div", { class: "pp-frame" }, mediaEl(key, null, "動く写真（" + (nameOf(key) || a.heroName) + "）", true)),
            h("figcaption", { class: "pp-cap" }, caption)) : null,
          h("div", { class: "pp-byline" }, a.byline),
          h("div", { class: "pp-body" }, a.body.map((p) => h("p", null, p)))),
        h("aside", { class: "pp-side" },
          box("カード図鑑", setList, h("p", { class: "pp-hx-sum" }, "全" + cs.total + "枚中 " + cs.n + "枚 解放"), ...recent),
          box("今日のMVP", mvp),
          box("魔法界の天気", h("p", { class: "pp-small" }, a.weather)),
          h("section", { class: "pp-box pp-ad" },
            h("p", { class: "pp-ad-title" }, a.ad.title),
            h("p", { class: "pp-small" }, a.ad.body),
            h("div", { class: "pp-ad-foot" }, a.ad.foot)),
          box("お知らせ", h("p", { class: "pp-small" }, a.notice)),
          nightBox(a, huntPhrase(cs.n, cs.total)))),
      gallery,
      h("footer", { class: "pp-foot" }, "本紙の記事はすべて予言であり、事実とは限りません。")
    );

    const shot = h("div", { class: "pp-shot-area" },
      h("p", { class: "pp-share" }, "「号外を画像にする」で紙面が1枚の画像になります。長押しで保存して、LINE で4人に送ってね"));
    const shotBtn = h("button", { type: "button", class: "btn", onclick: () => exportImage(paper, shotBtn, shot) }, "号外を画像にする");

    els.out.textContent = "";
    els.out.append(
      paper,
      h("div", { class: "pp-actions" },
        shotBtn,
        h("button", { type: "button", class: "btn ghost", onclick: () => print(true) }, "別の記事にする（刷り直し）")),
      shot
    );
  }

  /* 民泊の夜の写真があるときだけ出す小ネタ。記事ごとに文は固定（刷った時刻から選ぶ） */
  const NIGHT = [
    "民泊の談話室では今夜、一行がカードを並べて品評会を開いた。{hunt}だという。",
    "夜の談話室に集まった一行は、杖の代わりにグラスを掲げて今日のカードをたたえ合った。",
    "談話室の暖炉の前で祝勝会。屋敷しもべ妖精が「もう寝てください」と三度注意したという。",
  ];
  function nightBox(a, phrase) {
    if (!choices().some((c) => c.key.indexOf("nt-") === 0)) return null;
    const seed = Array.from(String(a.at || a.issue || "")).reduce((n, ch) => n + ch.charCodeAt(0), 0);
    const line = fill(NIGHT[seed % NIGHT.length], { hunt: phrase });
    return box("夜の談話室より", h("p", { class: "pp-small" }, line));
  }

  /* ---------- 紙面を画像に ---------- */
  /* downloads 能力。use() は応答が無いと 10 秒待つので、開いた時に先に取りにいっておく */
  let dlPromise = null;
  function getDownloads() {
    if (!dlPromise) {
      try {
        const c = window.claude;
        const p = c && typeof c.use === "function" ? c.use("downloads") : null;
        dlPromise = Promise.resolve(p).catch(() => null);
      } catch (e) { dlPromise = Promise.resolve(null); }
    }
    return Promise.race([dlPromise, new Promise((r) => setTimeout(() => r(null), 1500))]);
  }

  function ymd(d) {
    const z = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  }

  /* 写真・動画の今のフレームを、枠の大きさに cover で切り抜き、セピアを焼き込む。
   * html2canvas は <video> も object-fit も CSS filter も描けないため。失敗したら null */
  function bake(src, w, hgt) {
    const sw = src.videoWidth || src.naturalWidth || 0;
    const sh = src.videoHeight || src.naturalHeight || 0;
    if (!sw || !sh || !w || !hgt) return null;
    if (src.tagName === "VIDEO" && src.readyState < 2) return null;
    try {
      const k = Math.min(2, 1600 / Math.max(w, hgt));
      const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(hgt * k));
      const c = document.createElement("canvas");
      c.width = cw; c.height = ch;
      const ctx = c.getContext("2d");
      const s = Math.max(cw / sw, ch / sh);
      const dw = sw * s, dh = sh * s;
      ctx.drawImage(src, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      const img = ctx.getImageData(0, 0, cw, ch);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let nr = r * .393 + g * .769 + b * .189, ng = r * .349 + g * .686 + b * .168, nb = r * .272 + g * .534 + b * .131;
        nr = (nr - 128) * 1.1 + 128 - 6; ng = (ng - 128) * 1.1 + 128 - 6; nb = (nb - 128) * 1.1 + 128 - 6;
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb; // Uint8ClampedArray が 0〜255 に丸める
      }
      ctx.putImageData(img, 0, 0);
      return c.toDataURL("image/jpeg", 0.9);
    } catch (e) { return null; }
  }

  /* 紙面の写真・動画を一時的に焼き込み画像へ差し替える。戻り値は元に戻す関数 */
  async function swapMedia(paper) {
    const undo = [];
    const items = paper.querySelectorAll(".pp-frame img, .pp-frame video, .pp-gal-frame img, .pp-gal-frame video");
    for (const el of items) {
      const isVideo = el.tagName === "VIDEO";
      const wasPlaying = isVideo && !el.paused;
      const url = bake(el, el.clientWidth, el.clientHeight);
      let rep = null;
      if (url) {
        rep = h("img", { src: url, alt: el.getAttribute("alt") || el.getAttribute("aria-label") || "", class: "pp-baked" });
        rep.style.cssText = "display:block;width:100%;height:100%";
        try { await rep.decode(); } catch (e) {}
      } else if (isVideo) {
        rep = h("div", { class: "pp-vid-ph" }, "動く写真（動画）");
      }
      if (!rep) continue;
      el.replaceWith(rep);
      undo.push(() => {
        rep.replaceWith(el);
        if (wasPlaying && el.play) el.play().catch(() => {});
      });
    }
    return () => undo.reverse().forEach((f) => { try { f(); } catch (e) {} });
  }

  function blobToDataURL(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error("read"));
      r.readAsDataURL(blob);
    });
  }

  const DL_MSG = {
    declined: "保存はやめました。下の画像を長押しでも保存できます",
    rate_limited: "保存の確認がもう開いています。少し待ってからどうぞ",
    too_large: "画像が大きすぎて保存できません。下の画像を長押しで保存してね",
  };

  let busy = false;
  async function exportImage(paper, btn, shot) {
    if (busy) return;
    if (typeof window.html2canvas !== "function") {
      HP.toast("画像にする部品を読み込めませんでした。スクショで共有してね");
      return;
    }
    busy = true;
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "刷っています…";
    paper.classList.add("pp-snap");
    let restore = () => {};
    let blob = null;
    try {
      restore = await swapMedia(paper);
      const canvas = await window.html2canvas(paper, { scale: 2, backgroundColor: "#f4f0e6", useCORS: true, logging: false });
      blob = await new Promise((res) => {
        if (canvas.toBlob) canvas.toBlob((b) => res(b), "image/png");
        else res(null);
      });
      if (!blob) blob = await (await fetch(canvas.toDataURL("image/png"))).blob();
    } catch (e) {
      console.error(e);
      blob = null;
    } finally {
      restore();
      paper.classList.remove("pp-snap");
      btn.disabled = false; btn.textContent = label;
      busy = false;
    }
    if (!blob) { HP.toast("画像にできませんでした。スクショで共有してね"); return; }

    // 2. 紙面の下に画像を出す（iPhone ではこちらが確実）
    if (shot.isConnected) {
      try {
        const url = await blobToDataURL(blob);
        shot.textContent = "";
        shot.append(h("figure", { class: "pp-shot" },
          h("p", { class: "pp-shot-guide" }, "長押しで写真に保存 → LINE で4人に送ってね"),
          h("img", { class: "pp-shot-img", src: url, alt: "日刊予言者新聞の紙面（画像）" })));
        shot.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
      } catch (e) {}
    }

    // 1. 保存の提案（使える環境だけ。断られても自動でやり直さない）
    let dl = null;
    try { dl = await getDownloads(); } catch (e) { dl = null; }
    if (!dl || typeof dl.save !== "function") { HP.toast("画像ができました！"); return; }
    try {
      await dl.save({ filename: "日刊予言者新聞-" + ymd(new Date()) + ".png", data: blob });
      HP.toast("画像を保存しました");
    } catch (e) {
      const code = e && e.code;
      HP.toast(DL_MSG[code] || "保存できませんでした。下の画像を長押しで保存してね");
    }
  }

  function print(again) {
    const input = readForm();
    const a = generate(input, current);
    const draft = Object.assign({}, input, { huntN: cardInfo().n });
    HP.state.paper = Object.assign({}, HP.state.paper, { article: a, draft });
    renderPaper(a);
    HP.save();
    HP.toast(again ? "刷り直しました" : "号外を刷りました！");
    els.out.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
  }

  /* コレクション号外の説明文と、カードが新しく解放されたときの自動選択 */
  function syncTone() {
    const info = cardInfo(), n = info.n;
    els.finalDesc.textContent = info.full
      ? "図鑑 " + n + "/" + info.total + " 枚、コンプリート。一行の偉業を報じる"
      : n > 0 ? "図鑑 " + n + "/" + info.total + " 枚。最新のカードと撮った人が記事に" : "カードを解放すると、ここが図鑑の号外に";
    if (n > 0 && n > autoN) {
      autoN = n;
      const r = els.form.querySelector('input[name="pp-tone"][value="final"]');
      if (r) r.checked = true;
    }
  }

  function mount(root) {
    if (!document.getElementById("pp-style")) {
      document.head.append(h("style", { id: "pp-style" }, CSS));
    }
    // 紙面の中だけ明朝の Web フォント（読めなければシステムの明朝に任せる）
    if (!document.getElementById("pp-font")) {
      document.head.append(h("link", { id: "pp-font", rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;700;800&display=swap" }));
    }
    const draft = (HP.state.paper && HP.state.paper.draft) || {};

    els.hero = h("select", { class: "pp-input", id: "pp-hero" });
    els.kw = h("textarea", { class: "pp-input", id: "pp-kw", rows: "3", placeholder: "例：バタービールで口ひげ、新幹線で寝過ごしかけた" });
    els.kw.value = draft.keywords || "";
    els.pick = h("div", { class: "pp-pick", role: "group", "aria-label": "紙面のメイン写真" });
    els.pickHint = h("p", { class: "pp-hint" });
    els.photoBtnText = h("span", null, "写真・動画を選ぶ");
    els.ownRemove = h("button", {
      type: "button", class: "btn ghost", hidden: true,
      onclick: () => {
        HP.media.remove(OWN);
        if ((HP.state.paper && HP.state.paper.photoKey) === OWN) setMainKey(null);
        renderPicker(true);
        if (current) renderPaper(current);
      },
    }, "選んだ写真を消す");
    const file = h("input", { type: "file", accept: "image/*,video/*", class: "pp-vh" });
    file.addEventListener("change", async () => {
      const f = file.files && file.files[0];
      file.value = "";
      if (!f) return;
      try {
        const r = await HP.media.put(OWN, f);
        setMainKey(OWN);
        renderPicker(true);
        if (current) renderPaper(current);
        if (!r.saved) HP.toast(r.kind === "video" ? "動画は保存されません。この画面を開いている間だけ使えます" : "写真は保存できないので、この画面を開いている間だけ使います");
      } catch (e) {
        HP.toast("写真を読み込めませんでした");
      }
    });

    const n0 = cardInfo().n;
    let tone = TONES[draft.tone] ? draft.tone : (n0 > 0 ? "final" : "incident");
    if (n0 > 0 && n0 > (draft.huntN || 0)) tone = "final";
    autoN = Math.max(draft.huntN || 0, n0);
    const toneList = h("div", { class: "pp-tones" }, Object.keys(TONES).map((k) => {
      const desc = h("span", { class: "pp-tone-desc" }, TONES[k].desc);
      if (k === "final") els.finalDesc = desc;
      return h("label", { class: "pp-tone" },
        h("input", { type: "radio", name: "pp-tone", value: k, checked: k === tone }),
        h("span", { class: "pp-tone-text" },
          h("span", { class: "pp-tone-name" }, TONES[k].label),
          desc));
    }));

    els.form = h("form", { class: "pp-form", onsubmit: (e) => { e.preventDefault(); print(false); } },
      h("div", null,
        h("p", { class: "eyebrow" }, "Daily Prophet"),
        h("h2", { class: "pp-form-title h-display" }, "日刊予言者新聞 号外"),
        h("p", { class: "pp-lead muted" }, "今日の出来事を、魔法界の新聞にします。どれも空のままで大丈夫。")),
      h("div", { class: "pp-field" },
        h("span", { class: "pp-label" }, "紙面の写真・動画"),
        els.pick,
        els.pickHint,
        h("div", { class: "pp-photo-row" },
          h("label", { class: "btn ghost" }, file, els.photoBtnText),
          els.ownRemove),
        h("p", { class: "pp-hint" }, "紙面ではセピア色の「動く写真」になります")),
      h("div", { class: "pp-field" },
        h("label", { class: "pp-label", for: "pp-hero" }, "主役"),
        els.hero),
      h("div", { class: "pp-field" },
        h("label", { class: "pp-label", for: "pp-kw" }, "今日の出来事"),
        els.kw,
        h("p", { class: "pp-hint" }, "「、」や改行で区切ると、2つ目以降も記事に出てきます")),
      h("fieldset", { class: "pp-field" },
        h("legend", { class: "pp-label" }, "記事のトーン"),
        toneList),
      h("button", { type: "submit", class: "btn pp-print" }, "号外を刷る")
    );

    els.out = h("div", { class: "pp-out", "aria-live": "polite" });
    getDownloads().catch(() => {});
    root.append(h("div", { class: "pp-wrap" }, els.form, els.out));

    heroOptions(els.hero);
    renderPicker(true);
    syncTone();
    migrateOld().then(() => { renderPicker(); if (current) renderPaper(current); });

    HP.onChange(() => {
      heroOptions(els.hero);
      const before = pickSig;
      renderPicker();
      syncTone();
      const a = HP.state.paper && HP.state.paper.article;
      if (!a) { current = null; els.out.textContent = ""; }
      else if (current && before !== pickSig) renderPaper(current);
    });
  }

  function show() {
    heroOptions(els.hero);
    renderPicker();
    syncTone();
    const a = HP.state.paper && HP.state.paper.article;
    if (a && a !== current) renderPaper(a);
    else if (!a && current) { current = null; els.out.textContent = ""; }
  }

  HP.register("paper", { mount, show });
})();
