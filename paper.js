/* 魔法の旅のしおり — 日刊予言者新聞タブ
 *
 * 入力（写真・主役・キーワード・トーン）から、テンプレートとランダムな組み合わせで
 * 新聞紙面を刷る。サーバーも AI も使わない。
 * 最後に刷った記事（テキストのみ）は HP.state.paper.article に入れて HP.save()。
 * 写真・動画は HP.media に任せる。メインに選んだもののキーは HP.state.paper.photoKey。
 *   ハントで撮ったもの: "hx-<分霊箱id>", "lt-L0/L2/L3"。その場で選んだもの: "paper-photo"
 *   window.HP_HUNT.photoMissions() があれば、写真の候補はそこから作る（nt-: 民泊の夜、cm-: 追加ミッション）
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
    final:    { label: "決戦号外", desc: "分霊箱を壊した数で中身が変わる", kicker: "決戦号外", byline: "本紙従軍記者団（ホグワーツ特急より）" },
  };

  /* 分霊箱ハントの 7 つ。place は表示用、spot は文中に「{spot}で」と差し込む用 */
  const HX = [
    { id: "diary",  name: "トムの日記",             place: "嘆きのマートルのトイレ",           spot: "嘆きのマートルのトイレ" },
    { id: "ring",   name: "ゴーントの指輪",         place: "オリバンダーの店",                 spot: "オリバンダーの店" },
    { id: "locket", name: "スリザリンのロケット",   place: "ホグワーツ城",                     spot: "ホグワーツ城" },
    { id: "cup",    name: "ハッフルパフのカップ",   place: "バタービール",                     spot: "バタービールの売り場" },
    { id: "diadem", name: "レイブンクローの髪飾り", place: "ホグズミードの雪屋根の通り",       spot: "ホグズミードの雪屋根の通り" },
    { id: "nagini", name: "ナギニ",                 place: "どこでも（エクスペリアームスの動画）", spot: "エクスペリアームスの呪文が飛んだ現場" },
    { id: "final",  name: "最後の一撃",             place: "ホグワーツ特急の前",               spot: "ホグワーツ特急の前" },
  ];
  const LT = [
    { key: "lt-L0", name: "9と3/4番線" },
    { key: "lt-L2", name: "車窓の富士山" },
    { key: "lt-L3", name: "駅弁" },
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
        "関係者「まさか{name}が」 分霊箱ハントへの影響は不明",
        "現場の{city}は一時騒然、けが人なし",
        "魔法省は調査団を派遣する方針",
        "{house}寮監「{trait}の表れと信じたい」",
        "目撃した{wit}「一生忘れない」",
        "分霊箱ハントにも影響か 現在、{hunt}",
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
        "なお、{hunt}。今回の騒動がハントに響くかは不明だ。",
        "分霊箱ハントは、{hunt}。{mvpline}",
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
        "分霊箱ハントは、{hunt}。{mvpline}本紙はその笑顔の裏にも何かを嗅ぎつけている。",
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
        "分霊箱の破壊状況も公式記録に",
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
        "また、本日時点の公式集計では、{hunt}である。",
        "分霊箱ハントについて同省は「{hunt}。引き続き注視する」とした。",
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

  /* 決戦号外。壊した数で full（7 個すべて）/ part（途中）/ zero（まだ 0 個）を使い分ける */
  T.final = {
    full: {
      head: [
        "闇の帝王、ついに倒れる",
        "例のあの人、滅ぶ 分霊箱7つすべて破壊",
        "魔法界に夜明け 闇の帝王、ついに敗北",
        "{by}の最後の一撃 闇の帝王倒れる",
        "{spot}で決着 闇の帝王ついに倒れる",
        "号外 名前を言ってはいけないあの人、敗れる",
        "7つの魂すべて砕かれる 闇の時代の終わり",
        "祝 闇の帝王消滅 魔法界は三日三晩の祭りへ",
        "{name}ら一行、闇の帝王を討つ",
      ],
      sub: [
        "とどめを刺したのは{byfull}",
        "決戦の地は{spot}、目撃者多数",
        "魔法省「本日を臨時の祝日とする」",
        "目撃した{wit}「空が一瞬、金色に光った」",
        "分霊箱7つ、すべて破壊を確認",
      ],
      lead: [
        "ついにその時が来た。{spot}で放たれた{byfull}の最後の一撃により、闇の帝王が倒れた。",
        "魔法界は今日、歴史的な一日を迎えた。分霊箱はすべて破壊され、名前を言ってはいけないあの人は滅びた。とどめは{spot}、{byfull}によるものだ。",
        "{date}、{spot}にて闇の帝王の最期が確認された。最後の一撃を放ったのは{byfull}である。",
        "長い戦いが終わった。{byfull}が{spot}で杖を振り下ろした瞬間、闇の帝王の最後の魂が消え去った。",
      ],
      mid: [
        "{list}が次々と砕かれ、最後に{spot}で決着がついた。",
        "目撃した{wit}は「空が一瞬、金色に光った」と興奮気味に語った。",
        "魔法省は本日を臨時の祝日とし、全国のバタービールを無料にする方針だ。",
        "なお、決戦の直前には「{kw}」という出来事もあったという。",
        "喜びに沸く一行は、「{kw2}」の話で夜まで盛り上がった模様だ。",
        "周囲のマグルは、これをテーマパークの演出だと思い込んでいる。",
      ],
      extra: [
        "今回の殊勲者は、分霊箱を最も多く壊した{mvp}である。",
        "魔法省は、{mvp}に勲一等マーリン勲章を授与する方針を固めた。",
      ],
      close: [
        "闇の時代は終わった。旅は、まだ続く。",
        "本紙は今夜、全紙面を金色のインクで刷る。",
        "読者諸君、今夜は杖をしまって眠りたまえ。",
        "{name}たちの名は、魔法史の教科書に刻まれるだろう。",
      ],
    },
    part: {
      head: [
        "分霊箱{n}個目が破壊される",
        "「{hx}」破壊 分霊箱、残り{left}個",
        "{spot}で分霊箱破壊 {by}がやった",
        "{byfull}、「{hx}」を砕く",
        "闇の帝王に動揺 分霊箱{n}個目を失う",
        "分霊箱ハント{n}個目 残る{left}個の行方は",
        "速報 「{hx}」が{spot}で破壊",
        "闇の帝王、{n}つ目の魂を失う",
        "残り{left}個 闇の帝王、追い詰められる",
      ],
      sub: [
        "破壊したのは{byfull}",
        "残るは{left}個——闇の帝王の命運は",
        "目撃した{wit}「黒い煙が立ちのぼった」",
        "魔法省「ハント一行の安全を最優先に」",
        "現場は{spot}、けが人なし",
      ],
      lead: [
        "本日、{spot}で分霊箱「{hx}」が破壊された。破壊はこれで{n}個目、残りは{left}個となる。",
        "魔法界に朗報が届いた。{byfull}が{spot}にて「{hx}」を打ち砕いたのである。破壊はこれで{n}個目だ。",
        "{date}、分霊箱「{hx}」が{spot}で砕かれた。手を下したのは{byfull}である。",
        "闇の帝王の魂のかけらが、また一つ消えた。{spot}で「{hx}」を破壊したのは{byfull}だ。",
      ],
      mid: [
        "破壊の瞬間、{spot}には黒い煙が立ちのぼり、甲高い悲鳴が響いたという。",
        "これまでに破壊されたのは、{list}の{n}個である。",
        "目撃した{wit}は「杖を抜く暇もなかった」と興奮気味に語った。",
        "なお、現場付近では「{kw}」も目撃されており、関連を調べている。",
        "闇の帝王は沈黙を続けているが、側近は動揺を隠せない様子だという。",
        "{by}は取材に対し「まだ{left}個ある。気は抜けない」と語った。",
      ],
      extra: [
        "残る分霊箱は{left}個。一行は次の手がかりを追っている。",
        "闇の帝王が倒れるまで、あと{left}個。{mvpline}",
      ],
      close: [
        "本紙は引き続き、分霊箱ハントの行方を追う。",
        "次の号外が出るのは、次の分霊箱が砕けたときだ。",
        "読者は杖の手入れを怠らないように。",
        "{name}たちの旅は、まだ終わらない。",
      ],
    },
    zero: {
      head: [
        "分霊箱ハント、開幕へ 闇の帝王はまだ余裕",
        "7つの分霊箱、いまだ健在",
        "{name}ら一行、分霊箱探しの旅に出る",
        "闇の帝王「誰も見つけられまい」",
        "魔法省、分霊箱ハントを正式に承認",
        "分霊箱は7つ 決戦の地はユニバか",
        "{house}の{name}、闇の帝王に挑む",
        "嵐の前の静けさ 分霊箱ハント前夜",
      ],
      sub: [
        "破壊された分霊箱は、まだ0個",
        "目撃した{wit}「一行の目は本気だった」",
        "魔法省「ハント一行の安全を最優先に」",
      ],
      lead: [
        "闇の帝王の魂を宿した7つの分霊箱。そのすべてを壊す旅が、いま始まろうとしている。中心にいるのは{house}の{name}だ。",
        "{date}、{name}（{house}）ら一行が分霊箱ハントに名乗りを上げた。分霊箱は、まだひとつも壊れていない。",
      ],
      mid: [
        "最初の標的は、嘆きのマートルのトイレに眠る「トムの日記」とみられる。",
        "目撃した{wit}は「一行の目は本気だった」と語った。",
        "なお、出発前には「{kw}」という出来事もあったという。",
        "闇の帝王の側近は「7つすべてなど見つかるはずがない」と鼻で笑った。",
      ],
      extra: [
        "決戦の地は、ホグワーツ特急の前になるとの予言もある。",
      ],
      close: [
        "本紙は、最初の分霊箱が砕ける瞬間を待っている。",
        "続報は、最初の号外で。",
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

  /* 分霊箱ハントの現状。寮杯（HP.scores）は使わない */
  function huntInfo() {
    const hz = (HP.state.hunt && HP.state.hunt.horcrux) || {};
    const list = HX.map((x) => {
      const r = hz[x.id] || null;
      return Object.assign({}, x, { done: !!(r && r.doneAt), at: (r && r.doneAt) || "", by: (r && r.by) || null });
    });
    const done = list.filter((x) => x.done).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    const count = {};
    done.forEach((x) => { if (playerLabel(x.by)) count[x.by] = (count[x.by] || 0) + 1; });
    const top = Math.max(0, ...Object.values(count));
    const mvp = top > 0
      ? { count: top, players: Object.keys(count).filter((id) => count[id] === top).map(playerLabel) }
      : null;
    return { list, done, n: done.length, mvp };
  }

  function huntPhrase(n) {
    if (n === 0) return "分霊箱はまだ1つも壊れていない";
    if (n >= HX.length) return "分霊箱はすべて破壊済み";
    return "分霊箱は" + n + "個破壊、残り" + (HX.length - n) + "個";
  }

  function parseKeywords(text) {
    return String(text || "").split(/[\n、,，。]+/).map((s) => s.trim()).filter(Boolean);
  }

  function makeVars(input) {
    const players = HP.activePlayers();
    let hero = input.heroId ? HP.player(input.heroId) : null;
    const hunt = huntInfo();
    const n = hunt.n;
    // 決戦号外の「主な一撃」：7 個そろったら最後の一撃、途中なら最新の分霊箱（最後の一撃以外を優先）
    let key = null;
    if (n >= HX.length) key = hunt.list.find((x) => x.id === "final");
    else if (n > 0) {
      const objs = hunt.done.filter((x) => x.id !== "final");
      key = (objs.length ? objs : hunt.done)[(objs.length ? objs : hunt.done).length - 1];
    }
    const by = key ? playerLabel(key.by) : null;
    // 決戦号外で主役が「おまかせ」なら、壊した本人を主役にする
    if ((!hero || !hero.name.trim()) && input.tone === "final" && by) hero = HP.player(by.id);
    if (!hero || !hero.name.trim()) hero = players.length ? pick(players) : null;
    const house = hero && HP.HOUSES[hero.house];
    const others = players.filter((p) => !hero || p.id !== hero.id);
    const kws = parseKeywords(input.keywords);
    const kw = kws.length ? kws[0] : pick(FALLBACK_KW);
    const kw2 = kws.length > 1 ? pick(kws.slice(1)) : pick(FALLBACK_KW.filter((k) => k !== kw));
    const byHouse = by && HP.HOUSES[by.house];
    const mvpName = hunt.mvp ? hunt.mvp.players.map((p) => p.name).join("と") : "";
    const objs = hunt.done.filter((x) => x.id !== "final").map((x) => "「" + x.name + "」");
    return {
      vars: {
        name: hero ? hero.name.trim() : "ある魔法使い",
        house: house ? house.jp : "寮未定",
        trait: house ? house.trait : "好奇心",
        animal: house ? house.animal : "ふくろう",
        kw, kw2,
        city: pick(CITIES),
        wit: others.length && Math.random() < 0.5 ? pick(others).name.trim() : pick(WITNESSES),
        hunt: huntPhrase(n),
        mvp: mvpName || "一行の全員",
        mvpline: mvpName ? "目下の殊勲者は" + mvpName + "だ。" : "",
        n: String(n),
        left: String(HX.length - n),
        hx: key ? key.name : "分霊箱",
        place: key ? key.place : "不明",
        spot: key ? key.spot : "現場",
        by: by ? by.name : "一行の誰か",
        byfull: by ? (byHouse ? byHouse.jp + "の" + by.name : by.name) : "一行の誰か",
        list: objs.length ? objs.join("、") : "分霊箱",
        date: "本日",
      },
      heroId: hero ? hero.id : null,
      heroHouse: hero ? hero.house : null,
      hunt,
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

  function finalSet(n) { return n >= HX.length ? T.final.full : n > 0 ? T.final.part : T.final.zero; }

  function generate(input, prev) {
    const tone = TONES[input.tone] ? input.tone : "incident";
    const m = makeVars(Object.assign({}, input, { tone }));
    const n = m.hunt.n;
    const set = tone === "final" ? finalSet(n) : T[tone];
    let headline = fill(pick(set.head), m.vars);
    for (let i = 0; i < 5 && prev && headline === prev.headline; i++) headline = fill(pick(set.head), m.vars);
    const photoCaps = tone === "final" && n > 0
      ? ["▲ 動く写真：{spot}での決戦の瞬間（本紙カメラマン撮影）", "▲ 写真の中の{by}は、いまも杖を振り続けている"]
      : [
        "▲ 動く写真：「{kw}」の直後をとらえた一枚（本紙カメラマン撮影）",
        "▲ 写真の中の{name}は、いまも手を振り続けている",
        "▲ 現場写真。撮影後、カメラから紫の煙が出た",
      ];
    return {
      tone,
      kicker: tone === "final" && n >= HX.length ? "号外・闇の帝王討伐" : TONES[tone].kicker,
      byline: TONES[tone].byline,
      headline,
      sub: fill(pick(set.sub), m.vars),
      body: buildBody(set, m.vars),
      caption: fill(pick(photoCaps), m.vars),
      date: todayJp(),
      issue: "第" + (1000 + Math.floor(Math.random() * 9000)).toLocaleString("ja-JP") + "号",
      price: pick(PRICES),
      tagline: pick(TAGLINES),
      horcrux: m.hunt.list.map((x) => ({ id: x.id, name: x.name, done: x.done })),
      mvp: m.hunt.mvp,
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
  /* ハント側の全ミッション一覧。無い・壊れているときは null（旧来の固定一覧に戻る） */
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
.pp-wrap { display: grid; gap: 16px; min-width: 0; }
.pp-wrap [hidden] { display: none !important; }
.pp-vh { position: absolute !important; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

.pp-form {
  min-width: 0; display: grid; gap: 18px;
  padding: 18px 16px; border-radius: var(--radius);
  background: var(--night-2); border: 1px solid var(--line);
}
.pp-form-title { margin: 0; font-size: 20px; color: var(--gold); line-height: 1.4; }
.pp-lead { margin: 4px 0 0; font-size: 14px; }
.pp-field { display: grid; gap: 8px; min-width: 0; margin: 0; padding: 0; border: 0; }
.pp-label { font-weight: 700; font-size: 15px; color: var(--ink); padding: 0; }
.pp-hint { font-size: 13px; color: var(--ink-dim); margin: 0; }
.pp-input {
  width: 100%; max-width: 100%; min-height: 44px; min-width: 0;
  padding: 10px 12px; border-radius: 10px;
  background: var(--night); color: var(--ink);
  border: 1px solid var(--line); font: inherit; font-size: 16px; line-height: 1.5;
}
textarea.pp-input { min-height: 88px; resize: vertical; }
.pp-input:focus { border-color: var(--gold); outline: none; box-shadow: 0 0 0 2px rgba(217,180,90,.35); }

.pp-photo-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; min-width: 0; }
.pp-photo-row .btn { position: relative; }
.pp-photo-row .btn:has(input:focus-visible) { outline: 2px solid var(--gold); outline-offset: 2px; }

/* メイン写真の候補。折り返しのグリッド（402px で 3 列、320px で 2 列） */
.pp-pick { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; min-width: 0; }
.pp-pick-btn {
  display: grid; grid-template-rows: auto auto; gap: 4px; align-content: start;
  min-width: 0; min-height: 44px; padding: 4px 4px 6px; margin: 0;
  border-radius: 10px; border: 2px solid var(--line); background: rgba(0,0,0,.18);
  color: var(--ink); cursor: pointer; text-align: center; font: inherit;
}
.pp-pick-btn[aria-pressed="true"] { border-color: var(--gold); background: rgba(217,180,90,.16); }
.pp-pick-media {
  position: relative; display: block; width: 100%; aspect-ratio: 1; overflow: hidden;
  border-radius: 6px; background: #2a2620;
}
.pp-pick-media img, .pp-pick-media video {
  display: block; width: 100%; height: 100%; object-fit: cover; filter: sepia(.6) grayscale(.2);
}
.pp-pick-none { display: grid; place-items: center; font-size: 22px; color: var(--ink-dim); }
.pp-pick-check {
  position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border-radius: 50%;
  display: none; place-items: center; background: var(--gold); color: var(--parch-ink);
  font-size: 14px; font-weight: 700; line-height: 1;
}
.pp-pick-btn[aria-pressed="true"] .pp-pick-check { display: grid; }
.pp-pick-name {
  min-width: 0; font-size: 12px; line-height: 1.35; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}

.pp-tones { display: grid; gap: 8px; }
.pp-tone {
  display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 52px;
  padding: 10px 14px; border-radius: 12px; cursor: pointer;
  border: 1px solid var(--line); background: rgba(0,0,0,.18);
}
.pp-tone input { flex-shrink: 0; width: 22px; height: 22px; margin: 0; accent-color: var(--gold); }
.pp-tone-text { flex: 1; min-width: 0; display: grid; }
.pp-tone-name { font-weight: 700; font-size: 16px; line-height: 1.4; }
.pp-tone-desc { font-size: 13px; color: var(--ink-dim); line-height: 1.5; }
.pp-tone:has(input:checked) { border-color: var(--gold); background: rgba(217,180,90,.12); }

.pp-print { width: 100%; font-size: 17px; min-height: 52px; }

/* ---- 紙面 ---- */
.pp-out { display: grid; gap: 14px; min-width: 0; scroll-margin-top: 64px; }
.pp-out:empty { display: none; }
.pp-paper {
  container: pp / inline-size;
  min-width: 0; max-width: 100%;
  padding: 16px 14px 18px; border-radius: 6px;
  color: var(--parch-ink);
  background-color: var(--parch);
  background-image:
    radial-gradient(ellipse at 12% 8%, rgba(120,85,30,.18), transparent 45%),
    radial-gradient(ellipse at 88% 92%, rgba(120,85,30,.22), transparent 50%),
    radial-gradient(circle at 70% 30%, rgba(160,120,50,.08), transparent 30%),
    repeating-linear-gradient(0deg, rgba(90,60,20,.035) 0 1px, transparent 1px 3px);
  box-shadow: 0 12px 30px rgba(0,0,0,.45), inset 0 0 50px rgba(110,75,25,.28);
  font-family: var(--font-display);
}
.pp-mast { text-align: center; min-width: 0; }
.pp-topline {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 10px;
  font-family: var(--font-body); font-size: 12px; color: var(--parch-dim);
}
.pp-stamp {
  flex-shrink: 0; white-space: nowrap;
  padding: 1px 10px; border: 2px solid #8a1f1f; color: #8a1f1f; border-radius: 4px;
  font-family: var(--font-display); font-weight: 800; font-size: 13px; letter-spacing: .2em;
  transform: rotate(-3deg);
}
.pp-tag { min-width: 0; }
.pp-title-row {
  display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0;
  margin: 6px 0 4px;
}
.pp-orn { flex-shrink: 0; white-space: nowrap; font-size: clamp(14px, 4.5vw, 22px); color: var(--parch-dim); line-height: 1; }
.pp-title {
  min-width: 0; margin: 0; white-space: nowrap;
  font-family: var(--font-display); font-weight: 800;
  font-size: clamp(24px, 8.6vw, 46px); line-height: 1.15; letter-spacing: .06em;
  color: #1e160d;
  text-shadow: 1px 1px 0 rgba(255,255,255,.35), 0 0 1px rgba(0,0,0,.4);
}
.pp-meta {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 2px 12px;
  padding: 5px 2px; margin-top: 6px;
  border-top: 3px double var(--parch-ink); border-bottom: 3px double var(--parch-ink);
  font-family: var(--font-body); font-size: 12px; font-weight: 700; color: var(--parch-ink);
}
.pp-meta span { flex-shrink: 0; white-space: nowrap; }

.pp-grid { display: grid; gap: 16px; margin-top: 14px; min-width: 0; }
.pp-main, .pp-side { min-width: 0; }
.pp-kicker {
  display: inline-block; white-space: nowrap; max-width: 100%;
  padding: 2px 10px; background: var(--parch-ink); color: var(--parch);
  font-family: var(--font-body); font-weight: 700; font-size: 12px; letter-spacing: .12em;
}
.pp-headline {
  margin: 8px 0 6px; min-width: 0;
  font-weight: 800; font-size: clamp(22px, 7vw, 32px); line-height: 1.3; letter-spacing: .02em;
  text-wrap: balance; overflow-wrap: anywhere;
}
.pp-sub {
  margin: 0 0 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(43,33,22,.45);
  font-weight: 600; font-size: 16px; line-height: 1.5; color: #3d2f1f; overflow-wrap: anywhere;
}
.pp-fig { margin: 0 0 10px; max-width: 100%; }
.pp-frame {
  position: relative; overflow: hidden; aspect-ratio: 4 / 3; max-width: 100%;
  border: 3px solid #3b2d1c; outline: 1px solid #3b2d1c; outline-offset: 2px;
  background: #3a2f22;
}
.pp-frame img, .pp-frame video {
  display: block; width: 100%; height: 100%; object-fit: cover;
  filter: sepia(.85) grayscale(.35) contrast(1.15) brightness(.95);
  transform-origin: 50% 45%;
  animation: pp-move 9s ease-in-out infinite alternate;
}
.pp-frame::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 50%, rgba(30,20,10,.55) 100%);
  animation: pp-flicker 4s steps(2) infinite;
}
@keyframes pp-move {
  0%   { transform: scale(1.04) translate(0, 0) rotate(0deg); }
  35%  { transform: scale(1.09) translate(-1.5%, .8%) rotate(-.6deg); }
  70%  { transform: scale(1.06) translate(1.2%, -.6%) rotate(.5deg); }
  100% { transform: scale(1.12) translate(-.5%, 1%) rotate(-.3deg); }
}
@keyframes pp-flicker { 0%, 100% { opacity: 1; } 50% { opacity: .82; } }
.pp-cap { margin-top: 4px; font-family: var(--font-body); font-size: 12px; line-height: 1.5; color: var(--parch-dim); }
.pp-byline { font-family: var(--font-body); font-size: 12px; color: var(--parch-dim); margin-bottom: 6px; }
.pp-body p { margin: 0 0 .7em; font-size: 15px; line-height: 1.85; text-align: justify; overflow-wrap: anywhere; font-weight: 600; }
.pp-body p:first-child::first-letter {
  float: left; font-size: 2.7em; line-height: 1; font-weight: 800;
  margin: 4px 6px 0 0; padding: 2px 4px; border: 1px solid var(--parch-ink);
}

.pp-side { display: grid; gap: 12px; align-content: start; }
.pp-box { min-width: 0; padding: 10px 12px; border: 1px solid rgba(43,33,22,.55); background: rgba(255,250,235,.25); }
.pp-box-h {
  margin: 0 0 6px; padding-bottom: 4px; border-bottom: 2px solid var(--parch-ink);
  font-weight: 800; font-size: 15px; letter-spacing: .08em;
}
.pp-hx { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-family: var(--font-body); font-size: 14px; line-height: 1.5; }
.pp-hx li { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.pp-hx-name { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.pp-hx-mark { flex-shrink: 0; white-space: nowrap; font-weight: 700; min-width: 1.5em; text-align: center; }
.pp-hx li.is-done .pp-hx-mark { color: #8a1f1f; }
.pp-hx li:not(.is-done) .pp-hx-mark { color: var(--parch-dim); font-weight: 400; }
.pp-hx-sum { margin: 6px 0 0; font-family: var(--font-body); font-size: 13px; font-weight: 700; }
.pp-count { flex-shrink: 0; white-space: nowrap; font-weight: 700; font-variant-numeric: tabular-nums; }
.pp-mvp { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-family: var(--font-body); font-size: 14px; }
.pp-mvp-name { min-width: 0; font-family: var(--font-display); font-weight: 800; font-size: 18px; overflow-wrap: anywhere; }
.pp-small { font-family: var(--font-body); font-size: 13px; line-height: 1.6; margin: 0; overflow-wrap: anywhere; }
.pp-ad { text-align: center; border: 3px double var(--parch-ink); }
.pp-ad-title { font-weight: 800; font-size: 17px; line-height: 1.35; margin: 0 0 4px; overflow-wrap: anywhere; }
.pp-ad-foot { margin-top: 4px; font-family: var(--font-body); font-size: 12px; color: var(--parch-dim); }
/* 紙面の下：本日の動く写真 */
.pp-gallery { margin-top: 14px; padding-top: 8px; border-top: 3px double var(--parch-ink); min-width: 0; }
.pp-gallery-h { margin: 0 0 8px; text-align: center; font-weight: 800; font-size: 16px; letter-spacing: .1em; }
.pp-gal { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 10px; min-width: 0; }
.pp-gal li { min-width: 0; margin: 0; }
.pp-gal-frame { aspect-ratio: 1; overflow: hidden; border: 2px solid #3b2d1c; background: #3a2f22; }
.pp-gal-frame img, .pp-gal-frame video {
  display: block; width: 100%; height: 100%; object-fit: cover;
  filter: sepia(.85) grayscale(.35) contrast(1.1) brightness(.95);
}
.pp-gal-cap { margin-top: 3px; font-family: var(--font-body); font-size: 12px; line-height: 1.4; text-align: center; color: var(--parch-dim); overflow-wrap: anywhere; }
.pp-foot {
  margin-top: 12px; padding-top: 6px; border-top: 1px solid rgba(43,33,22,.45);
  text-align: center; font-family: var(--font-body); font-size: 12px; color: var(--parch-dim);
}

.pp-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; min-width: 0; }
.pp-actions .btn { flex-shrink: 0; white-space: nowrap; min-height: 44px; }
.pp-share {
  margin: 0; padding: 10px 14px; border-radius: 12px; border: 1px dashed var(--line);
  font-size: 14px; text-align: center; color: var(--ink); min-width: 0; overflow-wrap: anywhere;
}
/* 画像にした紙面（長押しで保存） */
.pp-shot { display: grid; gap: 8px; min-width: 0; margin: 0; }
.pp-shot-guide {
  margin: 0; padding: 10px 14px; border-radius: 12px; min-width: 0;
  background: rgba(217,180,90,.14); border: 1px solid var(--gold);
  font-size: 15px; font-weight: 700; line-height: 1.6; text-align: center; color: var(--ink); overflow-wrap: anywhere;
}
.pp-shot-img {
  display: block; width: 100%; max-width: 100%; height: auto; border-radius: 6px;
  -webkit-touch-callout: default; -webkit-user-select: auto; user-select: auto;
  box-shadow: 0 8px 24px rgba(0,0,0,.4);
}
/* 書き出し中だけ：動きを止め、焼き込んだ写真にはフィルタを重ねない */
.pp-snap .pp-frame img, .pp-snap .pp-frame video, .pp-snap .pp-frame::after { animation: none !important; transform: none !important; }
.pp-baked { filter: none !important; }
/* html2canvas は ::first-letter の回り込みを描けず字が離れるので、書き出し中は普通の字に */
.pp-snap .pp-body p:first-child::first-letter { float: none; font-size: inherit; margin: 0; padding: 0; border: 0; }
.pp-vid-ph {
  width: 100%; height: 100%; display: grid; place-items: center; padding: 8px; box-sizing: border-box;
  background: #3a2f22; color: var(--parch); text-align: center;
  font-family: var(--font-body); font-size: 14px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere;
}
.pp-gal-frame .pp-vid-ph { font-size: 12px; padding: 4px; }

@container pp (min-width: 460px) {
  .pp-grid { grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 18px; }
  .pp-side { border-left: 1px solid rgba(43,33,22,.45); padding-left: 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .pp-frame img, .pp-frame video, .pp-frame::after { animation: none !important; }
  .pp-frame img, .pp-frame video { transform: scale(1.04); }
}
`;

  /* ---------- 描画 ---------- */
  let els = {};
  let current = null; // 表示中の記事
  let pickSig = null; // 候補一覧が変わったときだけ作り直す
  let autoN = 0;      // 決戦号外を自動で選んだときの破壊数

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
        ? "ハントで撮った写真・動画から選べます"
        : "ハントで撮った写真・動画は、まだありません";
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
    // 寮杯時代の古い記事は、いまのハント状況で埋める
    const live = (!a.horcrux) ? huntInfo() : null;
    const hx = a.horcrux || live.list.map((x) => ({ id: x.id, name: x.name, done: x.done }));
    const mvpData = a.horcrux ? a.mvp : live.mvp;
    const nDone = hx.filter((x) => x.done).length;

    const hxList = h("ul", { class: "pp-hx" }, hx.map((x) =>
      h("li", { class: x.done ? "is-done" : null },
        h("span", { class: "pp-hx-name" }, x.name),
        h("span", { class: "pp-hx-mark", "aria-label": x.done ? "破壊済み" : "未破壊" }, x.done ? "✓" : "未"))));
    const mvp = mvpData && mvpData.players && mvpData.players.length
      ? h("div", { class: "pp-mvp" },
          mvpData.players.map((p) => [h("span", { class: "pp-mvp-name" }, p.name), HP.houseChip(p.house)]).flat(),
          h("span", { class: "pp-count" }, "分霊箱" + mvpData.count + "個"))
      : h("p", { class: "pp-small" }, "該当者なし");

    const key = mainKey();
    const hxMain = key && HX.find((x) => "hx-" + x.id === key);
    const caption = hxMain ? "▲ 動く写真：「" + hxMain.name + "」破壊の現場（" + hxMain.place + "）" : a.caption;

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
          h("span", { class: "pp-orn", "aria-hidden": "true" }, "❦"),
          h("h2", { class: "pp-title" }, "日刊予言者新聞"),
          h("span", { class: "pp-orn", "aria-hidden": "true" }, "❦")),
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
          box("分霊箱 破壊状況", hxList, h("p", { class: "pp-hx-sum" }, "7個中 " + nDone + "個 破壊")),
          box("今日のMVP", mvp),
          box("魔法界の天気", h("p", { class: "pp-small" }, a.weather)),
          h("section", { class: "pp-box pp-ad" },
            h("p", { class: "pp-ad-title" }, a.ad.title),
            h("p", { class: "pp-small" }, a.ad.body),
            h("div", { class: "pp-ad-foot" }, a.ad.foot)),
          box("お知らせ", h("p", { class: "pp-small" }, a.notice)),
          nightBox(a, nDone))),
      gallery,
      h("footer", { class: "pp-foot" }, "本紙の記事はすべて予言であり、事実とは限りません。")
    );

    const shot = h("div", { class: "pp-shot-area" },
      h("p", { class: "pp-share" }, "📸「号外を画像にする」で紙面が1枚の画像になります。長押しで保存して、LINE で4人に送ってね"));
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
    "民泊の談話室では今夜、一行がささやかな祝勝会を開き、「{hunt}」の話で夜更けまで盛り上がった。",
    "夜の談話室に集まった一行は、杖の代わりにグラスを掲げて今日の戦いをたたえ合った。",
    "談話室の暖炉の前で祝勝会。屋敷しもべ妖精が「もう寝てください」と三度注意したという。",
  ];
  function nightBox(a, nDone) {
    if (!choices().some((c) => c.key.indexOf("nt-") === 0)) return null;
    const seed = Array.from(String(a.at || a.issue || "")).reduce((n, ch) => n + ch.charCodeAt(0), 0);
    const line = fill(NIGHT[seed % NIGHT.length], { hunt: huntPhrase(nDone) });
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
      const canvas = await window.html2canvas(paper, { scale: 2, backgroundColor: "#efe3c4", useCORS: true, logging: false });
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
    const draft = Object.assign({}, input, { huntN: huntInfo().n });
    HP.state.paper = Object.assign({}, HP.state.paper, { article: a, draft });
    renderPaper(a);
    HP.save();
    HP.toast(again ? "刷り直しました" : "号外を刷りました！");
    els.out.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
  }

  /* 決戦号外の説明文と、分霊箱が新しく壊れたときの自動選択 */
  function syncTone() {
    const n = huntInfo().n;
    els.finalDesc.textContent = n >= HX.length
      ? "分霊箱7つすべて破壊。闇の帝王、ついに倒れる"
      : n > 0 ? "分霊箱 " + n + "/7 破壊。壊した場所と人が記事に" : "分霊箱を壊すと、ここが決戦の号外に";
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

    const n0 = huntInfo().n;
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
