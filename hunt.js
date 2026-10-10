/* 蛙チョコカード・コレクション — 旅全体を 1 冊のカード図鑑にするメイン画面
 *
 * 流れ: プロローグ（ダンブルドアからの依頼）→ カード図鑑（セットごとのカード）／ふくろう便（謎）
 * カード = 撮影ミッション。写真（HP.media.put）を撮るとカードが表に返り、その写真がカードの絵になる。
 * ふくろう便の謎を解くと、写真のいらない「シークレットカード」が手に入る。
 *
 * 状態: HP.state.hunt = {
 *   prologueDone,
 *   letters: { L0..L5: { forced, openedAt, solved, gaveUp, hint, photoAt } },  // photoAt = 新幹線カードの解放
 *   horcrux: { diary..final: { doneAt, by } },   // ユニバのカードの解放記録（予言者新聞が読む。形を変えないこと）
 *   extra:   { house, group: ISO },              // おまけカードの解放記録
 *   shots:   { "nt-<id>" | "cm-<id>": ISO },     // 夜の談話室・自分たちのカードの解放記録
 *   cards:   { "<写真キー>": { by } },            // horcrux 以外のカードの「誰が撮った」
 *   custom:  [{ id, title, tip, group, createdAt }],
 *   clearSeen,
 * }
 * 写真のキー（HP.media）: lt-L0/L2/L3 / hx-<id> / ex-house / ex-group / nt-<id> / cm-<id>（変えないこと）
 * 公開 API: HP_HUNT.photoMissions() → [{ key, title, group, done }]（予言者新聞が使う。形を変えないこと）
 * 時刻判定は「今」を引数で受け取れる。window.HP_HUNT_NOW（Date）があればそれを今として使う。
 */
(function () {
  "use strict";
  const G = typeof window !== "undefined" ? window : globalThis;

  /* ================= データ ================= */
  const TRIP_DAY = "2026-10-11";
  const at = (hm) => new Date(TRIP_DAY + "T" + hm + ":00+09:00");

  const RARITY = {
    normal: { id: "normal", jp: "ノーマル" },
    rare:   { id: "rare",   jp: "レア" },
    legend: { id: "legend", jp: "伝説" },
  };

  const SETS = [
    { id: "shinkansen", label: "新幹線",       en: "SHINKANSEN",  note: "品川から新大阪まで。ふくろう便の指令がそのままカードになる。" },
    { id: "usj",        label: "ユニバ",       en: "UNIVERSAL",   note: "ホグズミード村で集める。順番は自由。どれも最初から撮れる。" },
    { id: "night",      label: "夜の談話室",   en: "COMMON ROOM", note: "民泊での打ち上げ。飲めない人はジュースで。寮の色もジュースでそろう。" },
    { id: "self",       label: "自分たち",     en: "OUR CARDS",   note: "撮りたいものを思いついたら、カードにして足せる。" },
    { id: "secret",     label: "シークレット", en: "SECRET",      note: "ふくろう便の謎を解くと手に入る。写真はいらない。" },
  ];

  /* ユニバのカード。hx-* は元の分霊箱（写真キーと horcrux の記録はそのまま）、ex-* は元のおまけ */
  const UNIBA = [
    { type: "hx", id: "diary", img: "diary", kind: "写真", rar: "rare",
      name: "嘆きのマートルの悲鳴",
      lore: "嘆きのマートル：ホグワーツの女子トイレに住みついている、女の子の幽霊。いつもめそめそ泣いていて、2作目『秘密の部屋』で大事な手がかりを握っている。",
      place: "嘆きのマートルのトイレ", placeNote: "ホグズミード村にある、しゃべるトイレ。",
      shot: "鏡の前でビビる4人", tip: "鏡に4人全員が映る位置に立ち、撮る人は鏡の端から。全員が同じ方向を向いて、目と口を大きく開ける。" },
    { type: "hx", id: "ring", img: "ring", kind: "写真", rar: "rare",
      name: "オリバンダーに選ばれし者",
      lore: "オリバンダーの店：魔法の杖の老舗。客は何本も振ってみて、手になじむ1本に出会うまで試す。ハリーも入学前にここで最初の杖を手に入れた。",
      place: "オリバンダーの店の前", placeNote: "杖を売る老舗。パークでも杖を選べる。",
      shot: "杖に選ばれた瞬間の顔", tip: "顔のアップで。杖を胸の前に構え、目を見開いた瞬間を連写でおさえる。" },
    { type: "hx", id: "locket", img: "locket", kind: "写真", rar: "legend",
      name: "城を仰ぐ4本の杖",
      lore: "大広間：ホグワーツ城でいちばん大きな部屋。全校生徒がここで食事をし、天井は魔法で本物の空のように見える。入学の日の組分けもここで行われる。",
      place: "ホグワーツ城が見える場所", placeNote: "村の奥にそびえる城。見上げられる場所ならどこでもいい。",
      shot: "真下から煽って、全員で杖を掲げる", tip: "スマホを地面すれすれに上向きで構える。4本の杖の先を画面の中央に集め、背景に城と空を入れる。" },
    { type: "hx", id: "cup", img: "cup", kind: "写真", rar: "normal",
      name: "バタービールの泡ひげ",
      lore: "バタービール：魔法界の定番ドリンク。ハリーたちがホグズミード村のパブ「三本の箒」で飲んでいた、甘くてクリーミーな飲み物。パークのものはお酒ではない。",
      place: "バタービール", placeNote: "村のワゴンや店で買える、泡の立つ飲み物。",
      shot: "泡ひげで4人とも真顔", tip: "横一列に並び、ひと口飲んで口のまわりに泡を残す。誰かが笑ったら撮り直し。" },
    { type: "hx", id: "diadem", img: "diadem", kind: "写真", rar: "normal",
      name: "ホグズミードの雪の行進",
      lore: "ホグズミード村：ホグワーツの近くにある、魔法使いだけが住む村。3年生になると週末に遊びに行ける。お菓子屋やいたずら専門店が並ぶ。",
      place: "雪の積もった屋根が続くホグズミードの通り", placeNote: "村のメインの通り。屋根の雪は一年中とけない。",
      shot: "4人で歩く後ろ姿", tip: "撮る人は数歩うしろで少ししゃがみ、縦向きで。4人の頭の上に雪の屋根が入るように。" },
    { type: "hx", id: "nagini", img: "snake", kind: "動画", rar: "rare",
      name: "エクスペリアームスの使い手",
      lore: "エクスペリアームス：相手の杖を手から弾き飛ばす「武装解除の呪文」。ハリーがいちばん得意な呪文で、ここぞという場面で何度も使う。",
      place: "どこでも", placeNote: "まわりの人にぶつからない、ひらけた場所で。",
      shot: "「エクスペリアームス！」で1人が吹っ飛ぶ", tip: "5秒ほどで十分。呪文の瞬間、吹っ飛ぶ人は後ろへ大きくのけぞる。まわりの人にぶつからない場所で。" },
    { type: "hx", id: "final", img: "final", kind: "写真", rar: "legend",
      name: "ホグワーツ特急の乗客",
      lore: "ホグワーツ特急：9と3/4番線から出る赤い蒸気機関車。新学期のたびに生徒を学校へ運ぶ。車内販売のお菓子の中に、蛙チョコもある。",
      place: "ホグワーツ特急の機関車の前", placeNote: "村の入口近くに停まっている、赤い蒸気機関車。",
      shot: "4人並んで呪文のポーズ", tip: "機関車の正面を背に、横一列。杖を前へ突き出し、全員で同じ呪文を唱える瞬間を。" },
    { type: "ex", id: "house", img: null, kind: "写真", rar: "normal",
      name: "寮の誇り",
      lore: "寮の紋章：グリフィンドールはライオン、スリザリンはヘビ、レイブンクローはワシ、ハッフルパフはアナグマ。生徒は寮で暮らし、1年かけて点数を競う。",
      place: "パークのどこでも", placeNote: null,
      shot: "4人それぞれが、自分の寮の動物になりきった決めポーズ", tip: "横一列に並び、ライオンは吠える、ヘビはくねる、ワシは翼を広げる、アナグマは丸くなる。全身が入るよう縦向きで。" },
    { type: "ex", id: "group", img: null, kind: "写真", rar: "rare",
      name: "城の前の4人組",
      lore: "ハリー、ロン、ハーマイオニー：物語の中心の仲良し3人組。勇気のハリー、明るいロン、勉強家のハーマイオニーが力を合わせて事件を解決していく。",
      place: "ホグワーツ城の前", placeNote: null,
      shot: "ホグワーツ城を背に、4人の集合写真", tip: "城のてっぺんまで入るよう、撮る人は少し離れてしゃがむ。近くの人に頼むか、セルフタイマーで4人とも入る。" },
  ];
  /* 旧 API 互換: ユニバのうち hx-* のもの */
  const HORCRUXES = UNIBA.filter((c) => c.type === "hx");

  const LETTERS = [
    { id: "L0", label: "出発の儀", hm: "06:40", time: "6:40", station: "品川発車", sub: "乗る前に、ホームで", immediate: true,
      title: "出発の儀",
      body: "諸君、おはよう。魔法界の列車は、柱の向こうの「9と3/4番線」から出ると決まっておる。今日きみたちを運ぶのは、青い線の入ったのぞみ号じゃ。乗り込む前に、ホームで最初のカードを手に入れておくれ。",
      photo: { key: "lt-L0", text: "ホームで「9と3/4番線」に突入するポーズを、乗る前に1枚。",
        tip: "柱や壁ぎわに立ち、1人が体を半分隠して片足を上げると、吸い込まれていくように見える。ほかの乗客の通り道はふさがないこと。",
        name: "9と3/4番線の突破者", rar: "rare",
        lore: "9と3/4番線：ロンドンのキングス・クロス駅にある秘密のホーム。9番線と10番線のあいだの柱に向かって走り込むと通り抜けられ、ホグワーツ行きの列車が待っている。" } },
    { id: "L1", label: "第1便", hm: "06:51", time: "6:51", station: "新横浜", sub: "謎1", arrive: "新横浜",
      title: "最初の手がかり",
      body: "列車が動きだしたな。さっそく最初の謎じゃ。解けば、シークレットカードが1枚手に入る。描かれておるのは、この物語の主人公じゃ。",
      riddle: { n: 1, kind: "なぞなぞ",
        q: "入るときは、ひとり。\n鍵をかけて、すわって待つ。\n紙はあるのに、だれも字を書かない。\nこの部屋はなに？",
        answers: ["トイレ", "おトイレ", "お手洗い", "手洗い", "便所", "化粧室", "厠", "かわや", "WC", "restroom", "toilet"],
        answer: "トイレ", hint: "家にも駅にも、この新幹線にもある。最後に水を流す。" } },
    { id: "L2", label: "第2便", hm: "07:15", time: "7:15ごろ", station: "富士山接近", sub: "進行方向の右側＝E席側の窓", arrive: "富士山のあたり",
      title: "日本一の山に杖を",
      body: "右の窓を見よ。E席の側じゃ。雲が晴れていれば、日本でいちばん高い山が姿を見せる。魔法使いの力は、杖を向けてこそ届く。山に杖を向けてカードを1枚。それから2つ目の謎じゃ。",
      photo: { key: "lt-L2", text: "車窓の富士山に、4人で杖を向けて1枚。",
        tip: "スマホを窓ガラスに近づけると映り込みが減る。杖の先は窓ぎわに集め、山は画面の上半分に。雲で見えなくても、山の方角へ杖を向ければ達成じゃ。",
        name: "霊峰に杖を向けし者", rar: "normal",
        lore: "呪文：魔法は、杖を相手に向けて決まった言葉を唱えて使う。物を浮かせる、明かりをともす、鍵を開けるなど、呪文ごとに効き目がちがう。" },
      riddle: { n: 2, kind: "あいうえお表の暗号",
        q: "あいうえお表を思い浮かべよ。\n\n「た行」の3番目\n「あ行」の4番目\n\nつなげて読むと、魔法使いが必ず持っているもの。",
        answers: ["つえ", "杖", "魔法の杖", "まほうのつえ", "wand"],
        answer: "つえ（杖）", hint: "た行は「た・ち・つ・て・と」、あ行は「あ・い・う・え・お」。順に数えてみよう。" } },
    { id: "L3", label: "第3便", hm: "08:12", time: "8:12", station: "名古屋", sub: "指令と謎3", arrive: "名古屋",
      title: "魔法薬の材料",
      body: "金のしゃちほこの城の町に着いた。そろそろ腹ぺこじゃろう。魔法薬の授業では、材料の並べ方ひとつで出来が変わる。駅弁も同じじゃ。3つ目の謎の答えは、きみたちが今日見上げる場所じゃ。",
      photo: { key: "lt-L3", text: "駅弁を「魔法薬の材料」っぽく並べて、真上から1枚。",
        tip: "ふたを外して田の字に並べ、すき間に杖を1本。スマホを水平に持ち、真上から自分の影が入らないように撮る。",
        name: "魔法薬学の優等生", rar: "normal",
        lore: "魔法薬学：ホグワーツの授業のひとつ。大鍋で材料を煮込んで薬を作る。担当は、いつも不機嫌で厳しいスネイプ先生。教室は城の地下にある。" },
      riddle: { n: 3, kind: "並べ替え",
        q: "6つの文字を並べ替えよ。\n\n「う・ろ・ま・ほ・の・し」\n\nできた言葉が、今日きみたちが見上げる場所を指す。",
        answers: ["まほうのしろ", "魔法の城", "まほうのおしろ", "魔法のお城"],
        answer: "まほうのしろ（魔法の城）", hint: "「ま」で始まり、「しろ」で終わる。" } },
    { id: "L4", label: "第4便", hm: "08:47", time: "8:47", station: "京都", sub: "謎4", arrive: "京都",
      title: "泡の立つ飲み物",
      body: "古都を過ぎるぞ。魔法界でいちばん人気の飲み物を当ててみよ。パークに着いたら、本物を味わえる。",
      riddle: { n: 4, kind: "選んで答える",
        q: "「パンに塗る黄色いもの」と\n「大人が乾杯する泡の飲み物」。\nこの2つをくっつけると、魔法界でいちばん人気の飲み物になる。それはどれ？",
        choices: ["かぼちゃジュース", "バタービール", "ミルクティー", "ジンジャーエール"],
        answers: ["バタービール", "バタビール", "butterbeer", "B"],
        answer: "バタービール", hint: "1つ目は「バター」。2つ目は「ビ」から始まる。" } },
    { id: "L5", label: "第5便", hm: "09:01", time: "9:01", station: "新大阪着", sub: "最後の心得と謎5", arrive: "新大阪",
      title: "カード集めの心得",
      body: "よくぞここまで来た。ここから先は魔法の村じゃ。カード集めの心得を授けよう。",
      orders: [
        "パークに入ったら、まずホグズミード村をめざせ。雪をかぶった屋根の村が目印じゃ。",
        "カード図鑑の「ユニバ」のカードを開き、撮れたものから写真に収めよ。順番は自由じゃ。",
        "「エクスペリアームスの使い手」は動画じゃ。手の空いたときに。",
        "夜は民泊の談話室で、残りのカードを集めるのじゃ。",
      ],
      riddle: { n: 5, kind: "ずらし暗号",
        q: "あいうえお表で、1文字ずつ「1つ前」にずらして読め。\n\n「よ　く」\n\n出てきた言葉が、ホグズミード村の屋根を一年じゅう白くおおっている。",
        answers: ["ゆき", "雪", "snow", "スノー"],
        answer: "ゆき（雪）", hint: "や行は「や・ゆ・よ」、か行は「か・き・く・け・こ」。「よ」の1つ前は「ゆ」。" } },
  ];
  const LT = {};
  LETTERS.forEach((l) => { LT[l.id] = l; });
  const ARRIVAL = "L5";

  /* 夜の談話室（民泊） */
  const NIGHT = [
    { id: "toast", title: "祝宴の乾杯", rar: "normal", kind: "写真", shot: "杖を交差させて、グラスを合わせる瞬間",
      tip: "グラスをテーブルの中央に寄せ、撮る人は椅子に立たず腕を伸ばして真上から。",
      lore: "寮杯：1年間に寮が集めた点数で優勝を決める。良いことをすれば加点、規則を破れば減点。年度末の宴で発表される。" },
    { id: "house", title: "4寮のゴブレット", rar: "normal", kind: "写真", shot: "自分の寮の色の飲み物を、横一列に並べる",
      tip: "赤・緑・青・黄をそろえて白いテーブルか床の上に。ジュースやお茶でも色はそろう。",
      lore: "寮の色：グリフィンドールは赤と金、スリザリンは緑と銀、レイブンクローは青とブロンズ、ハッフルパフは黄と黒。マフラーの色でどの寮かわかる。" },
    { id: "potion", title: "ポリジュース薬の調合師", rar: "rare", kind: "写真", shot: "缶やグラスを魔法薬の瓶に見立てて、杖でかき混ぜる",
      tip: "部屋の照明を落とし、別のスマホのライトを横から当てると怪しい実験室になる。",
      lore: "ポリジュース薬：飲むと1時間だけ別の人の姿に変身できる魔法薬。作るのに1か月かかる難しい薬を、ハーマイオニーは2年生で作ってしまう。" },
    { id: "speech", title: "校長の総括スピーチ", rar: "legend", kind: "動画", shot: "校長になりきって、今日1日を振り返る",
      tip: "「諸君……」から始めて30秒以内に。残りの3人は真顔でうなずく係。",
      lore: "年度末の宴：ホグワーツの1年は、大広間での宴と校長のあいさつで締めくくられる。この校長は、ちょっと変わった言葉をまぜるのが得意。" },
    { id: "tour", title: "談話室の案内人", rar: "normal", kind: "動画", shot: "泊まる部屋を、寮の談話室に見立てて案内する",
      tip: "ゆっくり歩いて1部屋ずつ。住所がわかる掲示や、ほかの人の荷物は映さない。",
      lore: "談話室：寮生だけが入れるくつろぎの部屋。入口は合言葉で開く。グリフィンドールの入口は、太った婦人の肖像画の裏にある。" },
    { id: "lounge", title: "暖炉の前の4人", rar: "rare", kind: "写真", shot: "ローブ姿でくつろぐ4人の集合写真",
      tip: "ソファや床に思い思いに座り、セルフタイマーで。撮る人も入ること。",
      lore: "煙突飛行粉（フルーパウダー）：暖炉に粉を投げ入れて行き先を言うと、炎の中を通ってよその暖炉へ移動できる。魔法界の交通手段のひとつ。" },
    { id: "sleeper", title: "眠れる魔法使い", rar: "rare", kind: "写真", shot: "いちばん最初に眠った魔法使いの寝顔",
      tip: "起こさない程度にそっと。フラッシュは切る。",
      note: "本人にあとでOKをもらってから見せる・新聞に載せること。ダメと言われたら消そう。",
      lore: "寮の寝室：天蓋つきのベッドが並ぶ、塔の上の部屋。ハリーとロンは同じ寝室で、学校生活の夜を過ごす。" },
    { id: "morning", title: "魔法が解けた朝", rar: "rare", kind: "写真", shot: "翌朝、ローブを脱いだ4人の集合写真",
      tip: "チェックアウト前に、窓ぎわの明るい場所で。寝ぐせはそのままが正解。",
      lore: "マグル：魔法を使えない、ふつうの人のこと。ハリーは11歳まで、自分が魔法使いだと知らずにマグルの親戚の家で育った。" },
  ];
  const CUSTOM_GROUPS = [
    { id: "shinkansen", label: "新幹線" },
    { id: "usj", label: "ユニバ" },
    { id: "night", label: "民泊" },
    { id: "other", label: "その他" },
  ];

  /* シークレットカード（謎 n を解くと解放。写真はいらない） */
  const SECRETS = [
    { n: 1, letter: "L1", img: "owl", rar: "legend", name: "ハリー・ポッター", imgCap: "ハリーの相棒、白ふくろうのヘドウィグ",
      lore: "この物語の主人公。額に稲妻の形の傷がある男の子。赤ちゃんのとき闇の魔法使いに襲われて生き残り、魔法界では「生き残った男の子」として有名。11歳でホグワーツに入学する。" },
    { n: 2, letter: "L2", img: "wizard", rar: "legend", name: "アルバス・ダンブルドア", imgCap: "長い白ひげの校長",
      lore: "ホグワーツの校長。長い白ひげの、史上もっとも偉大といわれる魔法使い。おだやかでお茶目だが、闇の魔法使いがただ1人恐れる人物でもある。" },
    { n: 3, letter: "L3", img: "castle", rar: "rare", name: "ホグワーツ魔法魔術学校", imgCap: "湖のほとりの城",
      lore: "イギリスにある魔法学校。11歳から7年間、城で寮生活をしながら呪文や魔法薬を学ぶ。階段が勝手に動いたり、肖像画が話したりする。" },
    { n: 4, letter: "L4", img: "diadem", rar: "rare", name: "組分け帽子", imgCap: "4つの寮のひとつ、レイブンクローの象徴",
      lore: "入学の日、新入生の頭にのせると、その子に合う寮を決めてくれる、しゃべる古い帽子。勇気・野心・知恵・やさしさのうち、何を大切にする子かを見抜く。" },
    { n: 5, letter: "L5", img: "snake", rar: "legend", name: "ヴォルデモート", imgCap: "ヘビと話せる闇の魔法使い",
      lore: "物語の悪役で、史上最悪の闇の魔法使い。恐ろしすぎて、魔法界の人は名前を口にすることさえ避ける。ハリーの両親の命を奪った相手で、ハリーと何度も対決する。" },
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

  /* ---------- カード ---------- */
  const groupId = (g) => (CUSTOM_GROUPS.some((x) => x.id === g) ? g : "other");
  const groupLabel = (g) => CUSTOM_GROUPS.find((x) => x.id === groupId(g)).label;
  function huntOf(H) {
    if (H && typeof H === "object") return H;
    const hp = G.HP;
    return (hp && hp.state && hp.state.hunt) || {};
  }
  function customList(H) { return Array.isArray(H.custom) ? H.custom.filter((c) => c && c.id) : []; }
  const solvedRec = (r) => !!(r && (r.solved || r.gaveUp));

  /* 図鑑の全カード。順番は SETS の順 */
  function cardList(huntState) {
    const H = huntOf(huntState);
    const L = H.letters || {}, X = H.horcrux || {}, E = H.extra || {}, S = H.shots || {};
    const out = [];
    const push = (set, o) => { o.set = set; o.no = out.filter((c) => c.set === set).length + 1; out.push(o); };
    LETTERS.forEach((l) => {
      if (!l.photo) return;
      const p = l.photo;
      push("shinkansen", { key: p.key, type: "lt", id: l.id, letter: l.id, name: p.name, rar: p.rar, lore: p.lore, kind: "写真",
        shot: p.text, tip: p.tip, place: l.station + "・" + l.time, placeNote: null, img: null,
        done: !!(L[l.id] && L[l.id].photoAt), photo: true });
    });
    UNIBA.forEach((c) => {
      const key = c.type + "-" + c.id;
      const done = c.type === "hx" ? !!X[c.id] : !!E[c.id];
      push("usj", { key, type: c.type, id: c.id, name: c.name, rar: c.rar, lore: c.lore, kind: c.kind, shot: c.shot, tip: c.tip,
        place: c.place, placeNote: c.placeNote, img: c.img, done, photo: true });
    });
    NIGHT.forEach((n) => {
      const key = "nt-" + n.id;
      push("night", { key, type: "nt", id: n.id, name: n.title, rar: n.rar, lore: n.lore, kind: n.kind, shot: n.shot, tip: n.tip,
        note: n.note || null, place: null, img: null, done: !!S[key], photo: true });
    });
    customList(H).forEach((c) => {
      const key = "cm-" + c.id;
      push("self", { key, type: "cm", id: c.id, name: String(c.title || ""), rar: "normal",
        lore: "4人で作ったオリジナルのカード（" + groupLabel(c.group) + "）。", kind: "写真", shot: String(c.title || ""),
        tip: String(c.tip || ""), place: null, img: null, done: !!S[key], photo: true, custom: c });
    });
    SECRETS.forEach((s) => {
      push("secret", { key: "sc-" + s.n, type: "sc", id: String(s.n), letter: s.letter, n: s.n, name: s.name, rar: s.rar, lore: s.lore,
        img: s.img, imgCap: s.imgCap, done: solvedRec(L[s.letter]), photo: false });
    });
    return out;
  }
  /* 進み具合: { sets: { id: { n, N } }, n, N, pct, complete } */
  function progress(huntState) {
    const cards = cardList(huntState);
    const sets = {};
    SETS.forEach((s) => { sets[s.id] = { n: 0, N: 0 }; });
    cards.forEach((c) => { sets[c.set].N++; if (c.done) sets[c.set].n++; });
    const N = cards.length, n = cards.filter((c) => c.done).length;
    return { sets, n, N, pct: N ? Math.floor((n / N) * 100) : 0, complete: N > 0 && n === N };
  }
  /* 全撮影ミッション（予言者新聞が紙面の写真を選ぶ）。形 [{ key, title, group, done }] は変えないこと */
  function photoMissions(huntState) {
    return cardList(huntState).filter((c) => c.photo).map((c) => ({
      key: c.key,
      title: c.name,
      group: c.type === "lt" ? "shinkansen" : c.set === "usj" ? "usj" : c.type === "nt" ? "night" : "custom-" + groupId(c.custom.group),
      done: c.done,
    }));
  }
  /* 追加カード: タイトル必須。成功なら追加した要素、失敗なら null */
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
  /* 追加カードを消す（解放の印も消す）。消せたら true。写真本体は画面側で HP.media.remove する */
  function removeCustom(H, id) {
    if (!Array.isArray(H.custom)) return false;
    const i = H.custom.findIndex((c) => c && c.id === id);
    if (i < 0) return false;
    H.custom.splice(i, 1);
    if (H.shots) delete H.shots["cm-" + id];
    if (H.cards) delete H.cards["cm-" + id];
    return true;
  }
  /* カードの解放を記録する（写真の保存は画面側）。初めての解放なら true */
  function markCard(H, card, iso) {
    const t = iso || new Date().toISOString();
    let first = !card.done;
    if (card.type === "lt") { if (!H.letters) H.letters = {}; const r = H.letters[card.id] || (H.letters[card.id] = {}); r.photoAt = t; }
    else if (card.type === "hx") { if (!H.horcrux) H.horcrux = {}; const was = H.horcrux[card.id]; H.horcrux[card.id] = { doneAt: t, by: was ? was.by || null : null }; }
    else if (card.type === "ex") { if (!H.extra) H.extra = {}; H.extra[card.id] = t; }
    else if (card.type === "nt" || card.type === "cm") { if (!H.shots) H.shots = {}; H.shots[card.key] = t; }
    else first = false;
    return first;
  }
  /* カードの解放を取り消す（写真の削除は画面側） */
  function unmarkCard(H, card) {
    if (card.type === "lt") { if (H.letters && H.letters[card.id]) delete H.letters[card.id].photoAt; }
    else if (card.type === "hx") { if (H.horcrux) delete H.horcrux[card.id]; }
    else if (card.type === "ex") { if (H.extra) delete H.extra[card.id]; }
    else if (card.type === "nt" || card.type === "cm") { if (H.shots) delete H.shots[card.key]; }
    if (H.cards) delete H.cards[card.key];
  }
  function cardBy(H, card) {
    if (card.type === "hx") return (H.horcrux && H.horcrux[card.id] && H.horcrux[card.id].by) || null;
    return (H.cards && H.cards[card.key] && H.cards[card.key].by) || null;
  }
  function setCardBy(H, card, by) {
    if (card.type === "hx") { if (H.horcrux && H.horcrux[card.id]) H.horcrux[card.id].by = by || null; return; }
    if (!H.cards || typeof H.cards !== "object") H.cards = {};
    if (by) H.cards[card.key] = { by }; else delete H.cards[card.key];
  }

  const api = { TRIP_DAY, LETTERS, HORCRUXES, UNIBA, NIGHT, SECRETS, SETS, RARITY, CUSTOM_GROUPS, at, nowOf, isDelivered, minutesUntil,
    etaText, fmtDur, normalize, checkAnswer, deliveredIds, cardList, progress, photoMissions, addCustom, removeCustom,
    markCard, unmarkCard, cardBy, setCardBy };
  if (typeof module === "object" && module.exports) module.exports = api;
  G.HP_HUNT = api;
  if (!G.HP || !G.document) return;

  /* ================= 画面 ================= */
  const HP = G.HP;
  const h = HP.h;
  const reduceMotion = () => G.matchMedia && G.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EASE_OUT = "cubic-bezier(.16,1,.3,1)"; // = --ease-out（Web Animations は CSS 変数を読めないので値を写す）

  const CSS = `
/* locore（Editorial Light / Locore Lime）。色はすべて index.html の :root トークンを参照する */
.hn { display: block; padding-bottom: 8px; }
.hn .eyebrow, .hn-panel .eyebrow, .hn-clear .eyebrow { display: block; font-size: 12px; line-height: 1.5; }
.hn-art { position: relative; overflow: hidden; display: block; width: 100%; max-width: 100%; background: var(--lc-muted); }
.hn-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.hn-art.hn-miss::after { content: "✦"; position: absolute; inset: 0; display: grid; place-items: center;
  font-size: 28px; color: var(--lc-border-strong); }
.hn-r45 { aspect-ratio: 4 / 5; }

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

/* 図鑑のヒーロー（写真は上、文字は下） */
.hn-hero { overflow: hidden; border-radius: var(--radius); border: 1px solid var(--lc-border); background: var(--lc-surface);
  box-shadow: var(--shadow-sm); margin-bottom: 20px; }
.hn-hero > .hn-art { aspect-ratio: 3 / 2; }
.hn-hero > .hn-art img { object-position: 50% 30%; }
.hn-hero-in { padding: 18px 18px 20px; }
.hn-count { margin: 4px 0 12px; font-weight: 700; font-size: 20px; line-height: 1.3; letter-spacing: -.015em; color: var(--lc-fg); }
.hn-count b { font-family: var(--font-latin); font-variant-numeric: tabular-nums; font-size: 44px; font-weight: 700;
  letter-spacing: -.02em; padding: 0 2px 0 6px; }
.hn-hero-bar { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; }
.hn-hero-bar > span { flex-shrink: 0; white-space: nowrap; font-family: var(--font-latin); font-variant-numeric: tabular-nums;
  font-size: 13px; font-weight: 600; color: var(--lc-fg-muted); }
.hn-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 16px; padding: 0; list-style: none; }
.hn-chips li { flex-shrink: 0; white-space: nowrap; padding: 3px 10px; border-radius: 9999px; border: 1px solid transparent;
  background: var(--lc-muted); font-size: 12px; font-weight: 600; color: var(--lc-fg-2); font-variant-numeric: tabular-nums; }
.hn-chips li[data-full] { background: var(--lime-50); border-color: var(--lime-100); color: var(--lime-900); }
.hn-hero-row { display: flex; flex-wrap: wrap; gap: 8px; }
.hn-bar { flex: 1 1 auto; min-width: 0; height: 6px; border-radius: 9999px; background: var(--lc-muted); overflow: hidden; }
.hn-bar i { display: block; height: 100%; border-radius: inherit; background: var(--lime); transition: width .36s var(--ease-out); }

/* 新着のふくろう便 */
.hn-new { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 0 0 20px; padding: 14px 16px;
  border-radius: var(--radius); border: 1px solid var(--lime-100); background: var(--lime-50); }
.hn-new-txt { flex: 1 1 180px; min-width: 0; }
.hn-new-txt strong { display: block; font-size: 17px; font-weight: 700; letter-spacing: -.015em; color: var(--lc-fg); line-height: 1.4; }
.hn-new-txt span { display: block; font-size: 13px; color: var(--lime-900); }

/* セクション */
.hn-sec { margin: 40px 0 0; }
.hn-sec:first-child { margin-top: 0; }
.hn-sec-h { margin: 2px 0 0; min-width: 0; font-weight: 700; font-size: 22px; line-height: 1.35; color: var(--lc-fg); letter-spacing: -.015em; }
.hn-sec-note { margin: 4px 0 14px; font-size: 13px; line-height: 1.6; color: var(--lc-fg-muted); }
.hn-set-head { display: flex; align-items: baseline; gap: 12px; }
.hn-set-num { flex-shrink: 0; margin-left: auto; white-space: nowrap; font-family: var(--font-latin); font-variant-numeric: tabular-nums;
  font-size: 14px; font-weight: 600; color: var(--lc-fg-muted); }
.hn-set-num b { font-size: 22px; font-weight: 700; color: var(--lc-fg); }
.hn-set-bar { display: flex; margin: 8px 0 0; }

/* カード（5:7） */
.hn-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.hn-tile { display: block; width: 100%; min-width: 0; padding: 0; border: 0; background: none; color: inherit; text-align: left;
  border-radius: 12px; cursor: pointer; transition: transform .2s var(--ease-out); }
.hn-tile:active { transform: scale(.97); }
.hn-cd { position: relative; display: flex; flex-direction: column; width: 100%; aspect-ratio: 5 / 7; min-width: 0; overflow: hidden;
  border-radius: 12px; border: 1px solid var(--lc-border-strong); background: var(--lc-surface); box-shadow: var(--shadow-sm); color: var(--lc-fg); }
.hn-cd[data-rar="rare"] { border: 2px solid var(--lime); }
.hn-cd[data-rar="legend"] { border: 4px solid var(--lime); }
.hn-cd-pic { position: relative; flex: 1 1 auto; min-height: 0; margin: 6px 6px 0; border-radius: 8px; overflow: hidden; background: var(--lc-muted); }
.hn-cd-pic > img, .hn-cd-pic > video, .hn-cd-pic > .hn-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.hn-cd-gone { position: absolute; inset: 0; display: grid; place-items: center; align-content: center; gap: 2px; padding: 8px;
  background: var(--lime-50); color: var(--lime-900); font-size: 12px; font-weight: 700; text-align: center; line-height: 1.4; }
.hn-cd-gone b { font-family: var(--font-latin); font-size: 22px; line-height: 1; }
.hn-cd-back { position: relative; flex: 1 1 auto; min-height: 0; margin: 6px 6px 0; border-radius: 8px; display: grid; place-items: center;
  background: var(--lime-50); border: 1px solid var(--lime-100); }
.hn-cd-back::before { content: ""; position: absolute; inset: 6px; border-radius: 4px; border: 1px dashed var(--lime-200); }
.hn-q-mark { position: relative; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
  background: var(--lime); color: var(--lc-fg); font-family: var(--font-latin); font-weight: 700; font-size: 22px; line-height: 1; }
.hn-cd-foot { flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 6px 8px 8px; }
.hn-cd-name { min-width: 0; min-height: 2.7em; font-size: 12px; font-weight: 700; line-height: 1.35; letter-spacing: -.01em;
  overflow: hidden; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.hn-cd-meta { display: flex; align-items: center; gap: 4px; min-width: 0; }
.hn-cd-no { flex: 1 1 auto; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-family: var(--font-latin); font-variant-numeric: tabular-nums; font-size: 12px; color: var(--lc-fg-subtle); text-align: right; }
.hn-rar { flex-shrink: 0; white-space: nowrap; padding: 0 8px; border-radius: 9999px; border: 1px solid var(--lc-border);
  background: var(--lc-muted); font-size: 12px; font-weight: 700; line-height: 1.6; color: var(--lc-fg-muted); }
.hn-rar[data-rar="rare"] { background: var(--lc-surface); border-color: var(--lime); color: var(--lime-900); }
.hn-rar[data-rar="legend"] { background: var(--lime); border-color: var(--lime); color: var(--lc-fg); }
.hn-cd[data-locked] .hn-cd-name { color: var(--lc-fg-2); }
.hn-cd-add { align-items: center; justify-content: center; gap: 8px; border: 1px dashed var(--lc-border-strong); box-shadow: none;
  background: var(--lc-bg); color: var(--lc-fg-2); font-size: 13px; font-weight: 700; }
.hn-cd-add b { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--lc-muted);
  font-family: var(--font-latin); font-size: 22px; line-height: 1; }
.hn-cd-big .hn-cd-pic, .hn-cd-big .hn-cd-back { margin: 8px 8px 0; border-radius: 10px; }
.hn-cd-big .hn-cd-foot { padding: 8px 12px 12px; }
.hn-cd-big .hn-cd-name { font-size: 15px; min-height: 0; }
.hn-cd-big .hn-q-mark { width: 64px; height: 64px; font-size: 32px; }
/* 裏返し（rotateY で表に返る） */
.hn-flip3d { perspective: 900px; }
.hn-flip { position: relative; transform-style: preserve-3d; -webkit-transform-style: preserve-3d; }
.hn-flip > .hn-cd { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.hn-flip > .hn-cd-rear { position: absolute; inset: 0; transform: rotateY(180deg); }

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
.hn-mission { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.hn-mission-cd { flex-shrink: 0; width: 64px; }
.hn-mission-cd .hn-cd { border-radius: 8px; }
.hn-mission-cd .hn-cd-foot { display: none; }
.hn-mission-cd .hn-cd-pic, .hn-mission-cd .hn-cd-back { margin: 4px; border-radius: 5px; }
.hn-mission-cd .hn-q-mark { width: 28px; height: 28px; font-size: 15px; }
.hn-mission-txt { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.hn-mission-txt b { font-size: 15px; line-height: 1.45; overflow-wrap: anywhere; }

/* 下から出るシート */
.hn-sheet { position: fixed; inset: 0; z-index: 30; display: flex; align-items: flex-end; justify-content: center;
  background: rgba(24,24,27,.4); }
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
.hn-sheet-card { width: min(220px, 58vw); max-width: 100%; }
.hn-sheet-body { padding: 12px 20px 0; }
.hn-sheet-title { margin: 2px 0 8px; font-weight: 700; font-size: 24px; line-height: 1.4; letter-spacing: -.015em; text-wrap: balance; overflow-wrap: anywhere; }
.hn-sheet-badges { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0 0 4px; }
.hn-lore { margin: 0; font-size: 15px; line-height: 1.8; color: var(--lc-fg); }
.hn-cap { margin: 8px 0 0; font-size: 12px; color: var(--lc-fg-muted); text-align: center; }
.hn-dl { margin: 16px 0 0; border-top: 1px solid var(--lc-border); }
.hn-dl dt { margin-top: 14px; font-size: 12px; font-weight: 700; letter-spacing: .04em; color: var(--lc-fg-muted); }
.hn-dl dd { margin: 2px 0 0; font-size: 15px; line-height: 1.7; color: var(--lc-fg); overflow-wrap: anywhere; }
.hn-dl dd small { display: block; font-size: 13px; color: var(--lc-fg-muted); }

.hn-media { position: relative; margin-top: 16px; }
.hn-file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.hn-prev { display: block; width: 100%; max-width: 100%; max-height: 50vh; object-fit: contain; border-radius: 16px; background: var(--lc-muted); }
.hn-note { margin: 8px 0 0; font-size: 13px; color: var(--lc-fg-muted); }
.hn-who { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
.hn-who button { flex-shrink: 0; max-width: 100%; min-height: 44px; padding: 6px 16px; border-radius: 9999px; border: 1px solid var(--lc-border-strong);
  background: var(--lc-surface); color: var(--lc-fg-2); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
.hn-who button[aria-pressed="true"] { background: var(--lime); border-color: var(--lime); color: var(--lc-fg); font-weight: 700; }

/* 全画面の演出（白地） */
.hn-fx { position: fixed; inset: 0; z-index: 40; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 24px; padding: 24px 16px; text-align: center; cursor: pointer; background: var(--lc-bg); animation: hn-fade .24s var(--ease-out); }
@keyframes hn-fade { from { opacity: 0; } }
.hn-fx-card { width: min(200px, 56vw); }
.hn-fx-txt { animation: hn-rise .36s .5s var(--ease-out) backwards; max-width: 100%; min-width: 0; }
.hn-fx-title { margin: 0; font-weight: 700; font-size: 24px; line-height: 1.4; letter-spacing: -.015em; color: var(--lc-fg); text-wrap: balance; }
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

/* 図鑑コンプリート（白い誌面に写真を 1 枚） */
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
  gap: 10px; padding: 16px; background: var(--lc-bg); }
.hn-mini { position: relative; width: 100%; max-width: 120px; justify-self: center; aspect-ratio: 5 / 7; overflow: hidden; border-radius: 8px;
  border: 1px solid var(--lc-border-strong); background: var(--lc-surface); box-shadow: var(--shadow-sm); }
.hn-mini[data-rar="rare"] { border: 2px solid var(--lime); }
.hn-mini[data-rar="legend"] { border: 3px solid var(--lime); }
.hn-mini > .hn-art { position: absolute; inset: 4px; width: auto; border-radius: 5px; }
.hn-mini > .hn-cd-back { position: absolute; inset: 4px; margin: 0; border-radius: 5px; }
.hn-mini .hn-q-mark { width: 28px; height: 28px; font-size: 15px; }
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
  .hn-env-flap, .hn-seal { display: none; }
  .hn-flip > .hn-cd-rear { display: none; }
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
    if (!H.cards || typeof H.cards !== "object") H.cards = {};
    if (!Array.isArray(H.custom)) H.custom = [];
    return H;
  }
  const rec = (id) => hunt().letters[id] || null;
  const recW = (id) => { const H = hunt(); return H.letters[id] || (H.letters[id] = {}); };
  const delivered = (L, now) => isDelivered(L, now, rec(L.id));
  const opened = (L) => !!(rec(L.id) && rec(L.id).openedAt);
  const arrived = (now) => delivered(LT[ARRIVAL], now);
  const cards = () => cardList(hunt());
  const cardOf = (key) => cards().find((c) => c.key === key) || null;
  const prog = () => progress(hunt());
  const secretOf = (letterId) => cards().find((c) => c.type === "sc" && c.letter === letterId) || null;
  const setOf = (id) => SETS.find((s) => s.id === id);

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
  function badge(text, tone) { return h("span", { class: "hn-badge", "data-tone": tone || null }, text); }
  function rarChip(rar) { return h("span", { class: "hn-rar", "data-rar": rar }, RARITY[rar].jp); }
  const noText = (c) => "No." + String(c.no).padStart(2, "0");
  const byName = (by) => (by === "all" ? "みんなで" : (by && HP.player(by) && HP.player(by).name) || "");

  /* カードの表（解放済み）。写真・動画が絵になる。シークレットは img/ のイラスト */
  function cardFront(c, big) {
    const pic = h("div", { class: "hn-cd-pic" });
    if (c.type === "sc") pic.append(art(c.img, "", c.imgCap || c.name));
    else {
      const m = HP.media.el(c.key, { alt: c.name + "の写真", "aria-hidden": big ? null : "true" });
      if (m) pic.append(m);
      else pic.append(h("span", { class: "hn-cd-gone" }, h("b", null, "✓"), "撮影済み"));
    }
    return h("div", { class: "hn-cd" + (big ? " hn-cd-big" : ""), "data-rar": c.rar }, pic,
      h("div", { class: "hn-cd-foot" }, h("span", { class: "hn-cd-name" }, c.name),
        h("span", { class: "hn-cd-meta" }, rarChip(c.rar), h("span", { class: "hn-cd-no" }, noText(c)))));
  }
  /* カードの裏（未解放）。白とライム、中央に「?」。カード名とレア度だけ見える */
  function cardBack(c, big, extraCls) {
    return h("div", { class: "hn-cd" + (big ? " hn-cd-big" : "") + (extraCls ? " " + extraCls : ""), "data-rar": c.rar, "data-locked": true },
      h("div", { class: "hn-cd-back" }, h("span", { class: "hn-q-mark", "aria-hidden": "true" }, "?")),
      h("div", { class: "hn-cd-foot" }, h("span", { class: "hn-cd-name" }, c.name),
        h("span", { class: "hn-cd-meta" }, rarChip(c.rar), h("span", { class: "hn-cd-no" }, noText(c)))));
  }
  const cardFace = (c, big) => (c.done ? cardFront(c, big) : cardBack(c, big));
  /* 表に返る演出つきのカード（rotateY。動きを減らす設定ならフェード）。delay は ms */
  function flipCard(c, big, delay) {
    const front = cardFront(c, big);
    const inner = h("div", { class: "hn-flip" }, front, cardBack(c, big, "hn-cd-rear"));
    const wrap = h("div", { class: "hn-flip3d" }, inner);
    G.requestAnimationFrame(() => {
      if (!inner.animate) return;
      if (reduceMotion()) inner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay: delay || 0, easing: EASE_OUT, fill: "backwards" });
      else inner.animate([{ transform: "rotateY(180deg)" }, { transform: "rotateY(0deg)" }], { duration: 560, delay: delay || 0, easing: EASE_OUT, fill: "backwards" });
    });
    return wrap;
  }

  let locks = 0;
  function lockScroll(on) {
    locks = Math.max(0, locks + (on ? 1 : -1));
    G.document.documentElement.style.overflow = locks ? "hidden" : "";
  }

  /* ---------- 画面の状態 ---------- */
  const ui = {
    view: "cards",       // cards | owl
    slide: 0, dir: null, replay: false,
    expanded: {},
    drafts: {}, wrong: {}, giveUp: null, confirmUndo: null,
    sheet: null,         // カードのキー | "add"
    flip: null,          // 次の描画で表に返すカードのキー
    confirmDel: null,
    add: { title: "", tip: "", group: "other", err: false },
  };
  let root = null, sheetHost = null, lastKey = "";

  function renderAll() { render(); renderSheet(); }
  function render() {
    if (!root) return;
    const H = hunt();
    if (!H.prologueDone || ui.replay) root.replaceChildren(h("div", { class: "hn" }, prologue()));
    else root.replaceChildren(h("div", { class: "hn" }, steps(), seg(), newLetter(), ui.view === "owl" ? owlView() : cardsView()));
  }

  function steps() {
    const H = hunt();
    const phase = !H.prologueDone ? 0 : !arrived() ? 1 : !prog().complete ? 2 : 3;
    const names = ["依頼", "ふくろう便", "カード集め", "図鑑完成"];
    return h("ol", { class: "hn-steps", "aria-label": "旅の進み具合" },
      names.map((n, i) => h("li", { "data-on": i === phase, "data-done": i < phase, "aria-current": i === phase ? "step" : null }, n)));
  }
  function seg() {
    const b = (v, label) => h("button", { type: "button", "aria-pressed": String(ui.view === v),
      onclick: () => { ui.view = v; render(); G.scrollTo(0, 0); } }, label);
    return h("div", { class: "hn-seg", role: "group", "aria-label": "表示の切り替え" }, b("cards", "カード図鑑"), b("owl", "ふくろう便"));
  }
  function newLetter() {
    const unopened = LETTERS.filter((L) => delivered(L) && !opened(L));
    if (!unopened.length) return null;
    const L = unopened[0];
    return h("div", { class: "hn-new", role: "status" },
      h("div", { class: "hn-new-txt" },
        h("strong", null, "ふくろう便が届いた！"),
        h("span", null, L.label + "・" + L.station + (unopened.length > 1 ? "　ほか" + (unopened.length - 1) + "通" : ""))),
      h("button", { type: "button", class: "btn", onclick: () => openLetter(L) }, "封を切る"));
  }

  /* ================= プロローグ ================= */
  const SLIDES = [
    { img: "castle", kicker: "ふくろう便 第0号", title: "ダンブルドアからの依頼",
      text: "親愛なる4人の魔法使いへ。\n頼みがある。蛙チョコカードを全部集めて、今日の旅の図鑑を完成させてほしい。\n明日の朝、品川から西へ向かう旅が、そのままカード集めになる。" },
    { img: "wizard", kicker: "依頼人", title: "ホグワーツの校長、ダンブルドア",
      text: "わしはアルバス・ダンブルドア。魔法使いの子どもが通う学校、ホグワーツの校長じゃ。\nこの物語の主人公は、ハリー・ポッターという男の子。11歳の誕生日に自分が魔法使いだと知り、ホグワーツに入学する。" },
    { cards: true, kicker: "魔法界のおまけ", title: "蛙チョコカード",
      text: "魔法界のお菓子「蛙チョコレート」には、有名な魔法使いのカードが1枚おまけで入っている。集めて交換するのが、魔法界の子どもの楽しみじゃ。\n今日は、きみたちの旅そのものをカードにする。" },
    { img: "owl", kicker: "今日の任務", title: "写真を撮って、カードを表に",
      text: "カードは最初、裏向きじゃ。お題の写真を撮れば表に返り、その写真がカードの絵になる。\n各カードには予習メモも付いておる。物語を観たことがなくても心配いらん。\n新幹線では、ふくろう便が謎を運んでくる。解けばシークレットカードが手に入る。" },
    { img: "train", kicker: "出発", title: "6時40分、品川",
      text: "乗るのは、のぞみ号。発車の前に、最初のカード「9と3/4番線の突破者」が待っている。\nホームに着いたら、ふくろう便を開くのじゃ。" },
    { form: true },
  ];
  const MINI = [["castle", "legend"], ["owl", "rare"], ["wizard", "legend"], [null, "normal"], ["cup", "normal"], [null, "rare"]];

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
      ui.replay ? h("button", { type: "button", class: "btn ghost hn-s", onclick: closeReplay }, "図鑑へ戻る") : null);

    let card;
    if (s.form) card = playersForm();
    else {
      const visual = s.cards
        ? h("div", { class: "hn-art hn-r45" }, h("div", { class: "hn-items6" },
            MINI.map(([img, rar]) => h("div", { class: "hn-mini", "data-rar": rar },
              img ? art(img, "", "") : h("div", { class: "hn-cd-back" }, h("span", { class: "hn-q-mark", "aria-hidden": "true" }, "?"))))))
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
      ui.replay ? "図鑑へ戻る" : "依頼を引き受ける");
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

  /* ================= カード図鑑 ================= */
  function cardsView() {
    const all = cards(), P = progress(hunt());
    const out = [];

    if (P.complete) {
      out.push(h("div", { class: "hn-won" }, art("final", "", "朝日が差す城"),
        h("div", { class: "hn-won-in" },
          h("strong", null, "図鑑コンプリート"),
          h("div", { class: "hn-row" },
            h("button", { type: "button", class: "btn", onclick: () => HP.go("paper") }, "号外を刷る"),
            h("button", { type: "button", class: "btn ghost", onclick: showClear }, "完成の瞬間をもう一度")))));
    }

    out.push(h("div", { class: "hn-hero" }, art("castle", "", ""),
      h("div", { class: "hn-hero-in" },
        h("span", { class: "eyebrow" }, "CARD COLLECTION"),
        h("p", { class: "hn-count" }, "図鑑完成率", h("b", null, String(P.pct)), "%"),
        h("div", { class: "hn-hero-bar" },
          h("div", { class: "hn-bar", "aria-hidden": "true" }, h("i", { style: { width: P.pct + "%" } })),
          h("span", { "aria-label": P.N + "枚中" + P.n + "枚を解放" }, P.n + " / " + P.N + " 枚")),
        h("ul", { class: "hn-chips", "aria-label": "セットごとの解放数" },
          SETS.filter((s) => P.sets[s.id].N).map((s) => h("li", { "data-full": P.sets[s.id].n === P.sets[s.id].N },
            s.label + " " + P.sets[s.id].n + "/" + P.sets[s.id].N))),
        h("div", { class: "hn-hero-row" },
          h("button", { type: "button", class: "btn ghost hn-s", onclick: openReplay }, "依頼を読み返す")))));

    SETS.forEach((s, k) => {
      const list = all.filter((c) => c.set === s.id), st = P.sets[s.id];
      const tiles = list.map((c) => h("button", { type: "button", class: "hn-tile",
        "aria-label": c.name + "（" + RARITY[c.rar].jp + "・" + (c.done ? "解放済み" : "未解放") + "）",
        onclick: () => openSheet(c.key) }, cardFace(c, false)));
      if (s.id === "self") {
        tiles.push(h("button", { type: "button", class: "hn-tile", onclick: openAdd },
          h("div", { class: "hn-cd hn-cd-add" }, h("b", { "aria-hidden": "true" }, "＋"), "カードを追加")));
      }
      out.push(h("section", { class: "hn-sec", "aria-labelledby": "hn-set-" + s.id },
        h("span", { class: "eyebrow", "aria-hidden": "true" }, "SET " + String(k + 1).padStart(2, "0") + " · " + s.en),
        h("div", { class: "hn-set-head" },
          h("h2", { class: "hn-sec-h", id: "hn-set-" + s.id }, s.label),
          h("span", { class: "hn-set-num", "aria-label": st.N + "枚中" + st.n + "枚" }, h("b", null, String(st.n)), " / " + st.N)),
        h("div", { class: "hn-set-bar", "aria-hidden": "true" },
          h("div", { class: "hn-bar" }, h("i", { style: { width: (st.N ? Math.round((st.n / st.N) * 100) : 0) + "%" } }))),
        h("p", { class: "hn-sec-note" }, s.note),
        h("div", { class: "hn-grid" }, tiles)));
    });
    return out;
  }

  /* ================= ふくろう便 ================= */
  function owlView() {
    return [h("section", { class: "hn-sec", "aria-labelledby": "hn-h-owl" },
      h("span", { class: "eyebrow", "aria-hidden": "true" }, "OWL POST"),
      h("h2", { class: "hn-sec-h", id: "hn-h-owl" }, "ふくろう便"),
      h("p", { class: "hn-sec-note" }, "品川から新大阪まで。時刻はおおよその予定。謎を解くとシークレットカードが手に入る。"),
      h("ol", { class: "hn-tl" }, LETTERS.map(letterItem)))];
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

  /* 手紙の中のカード（小さなカード＋開くボタン） */
  function missionRow(c, label, btnText) {
    return h("div", { class: "hn-mission" },
      h("div", { class: "hn-mission-cd", "aria-hidden": "true" }, cardFace(c, false)),
      h("div", { class: "hn-mission-txt" },
        h("span", { class: "hn-tip", style: { margin: 0 } }, label),
        h("b", null, c.name),
        h("button", { type: "button", class: "btn hn-s", onclick: () => openSheet(c.key) }, btnText)));
  }

  function letterContent(L) {
    const out = [h("div", { class: "parchment hn-paper" },
      h("span", { class: "eyebrow hn-kicker" }, "ふくろう便 " + L.label + "　" + L.station + " " + L.time),
      h("h3", null, L.title),
      h("p", null, L.body),
      L.orders ? h("ol", null, L.orders.map((o) => h("li", null, o))) : null,
      h("p", { class: "hn-sign" }, "— A. ダンブルドア"))];
    if (L.photo) {
      const c = cardOf(L.photo.key);
      out.push(h("div", { class: "hn-block" },
        h("span", { class: "hn-label" }, "指令"),
        h("p", { class: "hn-q" }, L.photo.text),
        missionRow(c, c.done ? "カード解放済み" : "撮るとカードが表に返る", c.done ? "カードを見る" : "カードを開いて撮る")));
    }
    if (L.riddle) out.push(riddleBlock(L));
    return out;
  }

  function riddleBlock(L) {
    const R = L.riddle, r = rec(L.id) || {}, sc = secretOf(L.id);
    const box = h("div", { class: "hn-block" }, h("span", { class: "hn-label" }, "謎" + R.n + "・" + R.kind), h("p", { class: "hn-q" }, R.q));
    if (r.solved || r.gaveUp) {
      box.append(h("div", { class: "hn-reveal" },
        h("p", { style: { margin: "0 0 4px" } }, (r.solved ? "正解！ 答えは「" : "答えは「") + R.answer + "」"),
        missionRow(sc, "シークレットカードを手に入れた", "カードを見る")));
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
        playSecret(secretOf(L.id), true);
      } else { ui.wrong[L.id] = 1; render(); ui.wrong[L.id] = 2; }
    } }, input, h("button", { type: "submit", class: "btn" }, "答える"));
    box.append(form);
    if (ui.wrong[L.id]) box.append(h("p", { class: "hn-msg", role: "alert" }, "ちがうようだ。もう一度考えてみよう。"));
    if (r.hint) box.append(h("p", { class: "hn-hint" }, "ヒント：" + R.hint));
    if (ui.giveUp === L.id) {
      box.append(h("div", { class: "hn-confirm" },
        h("p", null, "答えを見ると、自力で解いた印は付かない（カードは手に入る）。それでも見る？"),
        h("div", { class: "hn-row" },
          h("button", { type: "button", class: "btn hn-s", onclick: () => {
            recW(L.id).gaveUp = new Date().toISOString(); ui.giveUp = null; save(); render();
            playSecret(secretOf(L.id), false); } }, "答えを見る"),
          h("button", { type: "button", class: "btn ghost hn-s", onclick: () => { ui.giveUp = null; render(); } }, "やめる"))));
    } else {
      box.append(h("div", { class: "hn-row" },
        r.hint ? null : h("button", { type: "button", class: "btn ghost hn-s", onclick: () => { recW(L.id).hint = true; save(); render(); } }, "ヒント"),
        h("button", { type: "button", class: "btn ghost hn-s", onclick: () => { ui.giveUp = L.id; render(); } }, "降参（答えを見る）")));
    }
    return box;
  }

  /* ---------- 写真・動画の保存部品 ---------- */
  function mediaBlock(key, o) {
    const m = HP.media.get(key);
    const wrap = h("div", { class: "hn-media" });
    const input = h("input", { type: "file", accept: "image/*,video/*", class: "hn-file", tabindex: "-1", "aria-hidden": "true" });
    const pick = h("button", { type: "button", class: "btn", onclick: () => input.click() },
      o.done ? "撮り直す・選び直す" : o.kind === "動画" ? "動画を撮ってカードを解放" : "写真を撮ってカードを解放");
    input.addEventListener("change", async () => {
      const f = input.files && input.files[0];
      input.value = "";
      if (!f) return;
      pick.disabled = true; pick.textContent = "保存中…";
      try { await o.onFile(f); } finally { pick.disabled = false; }
    });
    if (m && m.kind === "video") wrap.append(HP.media.el(key, { class: "hn-prev", controls: true }),
      h("p", { class: "hn-note" }, "動画は同期していないと、この画面を閉じると消える。カメラロールにも残しておこう。"));
    if (o.done && !m) wrap.append(h("p", { class: "hn-note" }, "解放済み（写真はこの端末に残っていない）"));
    if (o.extra) wrap.append(o.extra);
    if (ui.confirmUndo === key) {
      wrap.append(h("div", { class: "hn-confirm" }, h("p", null, o.undoText),
        h("div", { class: "hn-row" },
          h("button", { type: "button", class: "btn hn-s", onclick: () => { ui.confirmUndo = null; o.onUndo(); } }, "取り消す"),
          h("button", { type: "button", class: "btn ghost hn-s", onclick: () => { ui.confirmUndo = null; renderAll(); } }, "やめる"))));
    } else {
      wrap.append(h("div", { class: "hn-row" }, pick,
        o.done ? h("button", { type: "button", class: "btn ghost", style: { color: "var(--danger)" },
          onclick: () => { ui.confirmUndo = key; renderAll(); } }, "取り消す") : null));
    }
    wrap.append(input);
    return wrap;
  }
  async function putMedia(key, file) {
    try { return await HP.media.put(key, file); }
    catch (e) { HP.toast("読み込めなかった。別の写真で試そう"); return null; }
  }
  async function shootCard(c, file) {
    const r = await putMedia(c.key, file);
    if (!r) return;
    const first = markCard(hunt(), c);
    if (first) ui.flip = c.key;
    save(); renderAll();
    const warn = !r.saved && r.kind === "image" ? "容量がいっぱい。写真はこの画面を閉じると消える" : null;
    HP.toast(warn || (first ? "カード解放！「" + c.name + "」" : "撮り直した"));
    if (first) afterUnlock(1400);
  }
  function undoCard(c) {
    const H = hunt();
    HP.media.remove(c.key);
    unmarkCard(H, c);
    if (!progress(H).complete) H.clearSeen = false;
    save(); renderAll();
    HP.toast("取り消した。カードは裏に戻った");
  }
  /* 全部そろったら、図鑑コンプリートを 1 度だけ出す */
  function afterUnlock(ms) {
    setTimeout(() => {
      const H = hunt();
      if (!progress(H).complete || H.clearSeen) return;
      if (G.document.querySelector(".hn-fx, .hn-clear")) return;
      if (ui.sheet) closeSheet();
      showClear();
    }, ms || 0);
  }
  function deleteCustom(c) {
    HP.media.remove(c.key);
    removeCustom(hunt(), c.custom.id);
    ui.confirmDel = null;
    save();
    closeSheet();
    HP.toast("カードを削除した");
  }
  function openAdd() {
    ui.add = { title: "", tip: "", group: (ui.add && ui.add.group) || "other", err: false };
    openSheet("add");
    G.requestAnimationFrame(() => { const t = sheetHost && sheetHost.querySelector("#hn-add-title"); if (t) t.focus({ preventScroll: true }); });
  }

  /* ---------- カードの詳細（下から出るシート） ---------- */
  function cardSheetBody(c) {
    const H = hunt(), set = setOf(c.set);
    const body = h("div", { class: "hn-sheet-body" },
      h("span", { class: "eyebrow hn-sheet-kicker" }, set.label + " · " + noText(c)),
      h("h2", { class: "hn-sheet-title", id: "hn-sheet-t" }, c.name),
      h("div", { class: "hn-sheet-badges" }, rarChip(c.rar), c.done ? badge("解放済み", "done") : badge("未解放")),
      h("div", { class: "hn-block" }, h("span", { class: "hn-label" }, "予習メモ"), h("p", { class: "hn-lore" }, c.lore)));

    if (c.type === "sc") {
      const L = LT[c.letter];
      body.append(h("dl", { class: "hn-dl" },
        h("dt", null, "手に入れ方"),
        h("dd", null, "ふくろう便の謎" + c.n + "（" + L.station + "）を解く", h("small", null, "写真はいらない。解いた時点で表に返る。"))));
      if (!c.done) body.append(h("div", { class: "hn-row" },
        h("button", { type: "button", class: "btn", onclick: () => { closeSheet(); gotoLetter(L.id); } }, "ふくろう便へ")));
      return body;
    }

    const dl = h("dl", { class: "hn-dl" });
    if (c.shot && c.type !== "cm") dl.append(h("dt", null, "撮る" + c.kind), h("dd", null, c.shot));
    if (c.tip) dl.append(h("dt", null, "撮り方のコツ"), h("dd", null, c.tip));
    if (c.place && c.set === "usj") dl.append(h("dt", null, "場所"), h("dd", null, c.place, c.placeNote ? h("small", null, c.placeNote) : null));
    if (c.type === "lt") dl.append(h("dt", null, "いつ"), h("dd", null, c.place));
    if (dl.childNodes.length) body.append(dl);
    if (c.note) body.append(h("p", { class: "hn-warn" }, c.note));
    if (c.type === "lt") body.append(h("div", { class: "hn-row" },
      h("button", { type: "button", class: "btn ghost hn-s", onclick: () => { closeSheet(); gotoLetter(c.letter); } }, "ふくろう便を読む")));

    let who = null;
    if (c.done) {
      const cur = cardBy(H, c);
      const opts = HP.activePlayers().map((p) => ({ id: p.id, name: p.name })).concat([{ id: "all", name: "みんなで" }]);
      who = h("div", { class: "hn-block" }, h("span", { class: "hn-label" }, "誰が撮った？（任意）"),
        h("div", { class: "hn-who" }, opts.map((o) => h("button", { type: "button", "aria-pressed": String(cur === o.id),
          onclick: () => { setCardBy(hunt(), c, cur === o.id ? null : o.id); save(); renderAll(); } }, o.name))));
    }
    body.append(mediaBlock(c.key, {
      done: c.done, kind: c.kind, extra: who,
      onFile: (f) => shootCard(cardOf(c.key) || c, f),
      onUndo: () => undoCard(cardOf(c.key) || c),
      undoText: "写真を消して、「" + c.name + "」を裏に戻す？",
    }));

    if (c.custom) {
      const del = h("div", { class: "hn-del" });
      if (ui.confirmDel === c.key) {
        del.append(h("div", { class: "hn-confirm", role: "alert" },
          h("p", null, "「" + c.name + "」を削除する？" + (c.done ? "撮った写真も消える。" : "")),
          h("div", { class: "hn-row" },
            h("button", { type: "button", class: "btn hn-s", onclick: () => deleteCustom(c) }, "削除する"),
            h("button", { type: "button", class: "btn ghost hn-s", onclick: () => { ui.confirmDel = null; renderSheet(); } }, "やめる"))));
      } else {
        del.append(h("button", { type: "button", class: "btn ghost hn-s hn-wide",
          onclick: () => { ui.confirmDel = c.key; ui.confirmUndo = null; renderSheet(); } }, "このカードを削除"));
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
    const groups = h("div", { class: "hn-groups", role: "group", "aria-label": "どこで撮る？" },
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
      hunt().clearSeen = false;
      save();
      closeSheet();
      HP.toast("カードを追加した：" + item.title);
    } },
      h("label", { class: "hn-field", for: "hn-add-title" }, h("span", null, "カード名＝撮るもの（必須）")),
      title,
      A.err ? h("p", { class: "hn-msg", id: "hn-add-err", role: "alert" }, "カード名を入れてね") : null,
      h("label", { class: "hn-field", for: "hn-add-tip" }, h("span", null, "撮り方のコツ（任意）")),
      tip,
      h("div", { class: "hn-field" }, h("span", null, "どこで撮る？")),
      groups,
      h("div", { class: "hn-row", style: { marginTop: "18px" } },
        h("button", { type: "submit", class: "btn" }, "追加する"),
        h("button", { type: "button", class: "btn ghost", onclick: closeSheet }, "やめる")));
    return h("div", { class: "hn-sheet-body" },
      h("span", { class: "eyebrow hn-sheet-kicker" }, "自分たち"),
      h("h2", { class: "hn-sheet-title", id: "hn-sheet-t" }, "カードを追加"),
      form);
  }

  function openSheet(id) { const was = !!ui.sheet; ui.sheet = id; ui.confirmUndo = null; ui.confirmDel = null; renderSheet(); if (!was) lockScroll(true); focusClose(); }
  function closeSheet() { if (!ui.sheet) return; ui.sheet = null; ui.flip = null; ui.confirmUndo = null; ui.confirmDel = null; renderSheet(); lockScroll(false); render(); }
  function focusClose() { const c = sheetHost && sheetHost.querySelector(".hn-close"); if (c) c.focus({ preventScroll: true }); }

  function renderSheet() {
    if (!sheetHost) return;
    const old = sheetHost.querySelector(".hn-panel"), keep = old ? old.scrollTop : 0;
    sheetHost.replaceChildren();
    if (!ui.sheet) { sheetHost.hidden = true; return; }
    const c = ui.sheet === "add" ? null : cardOf(ui.sheet);
    if (ui.sheet !== "add" && !c) { ui.sheet = null; ui.confirmDel = null; sheetHost.hidden = true; lockScroll(false); return; }
    sheetHost.hidden = false;
    let hero;
    if (c) {
      const flipping = ui.flip === c.key && c.done;
      ui.flip = null;
      hero = h("div", { class: "hn-sheet-hero" },
        h("div", { class: "hn-sheet-card" }, flipping ? flipCard(c, true, 80) : cardFace(c, true),
          c.type === "sc" && c.done && c.imgCap ? h("p", { class: "hn-cap" }, c.imgCap) : null));
    } else {
      hero = h("div", { class: "hn-sheet-hero" }, h("div", { class: "hn-sheet-card", style: { width: "min(120px, 36vw)" } },
        h("div", { class: "hn-cd hn-cd-add", "aria-hidden": "true" }, h("b", null, "＋"))));
    }
    const panel = h("div", { class: "hn-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "hn-sheet-t" },
      h("button", { type: "button", class: "hn-close", "aria-label": "閉じる", onclick: closeSheet }, "✕"),
      hero, c ? cardSheetBody(c) : addSheetBody());
    if (old) panel.style.animation = "none"; // 開き直し以外では下からの動きを繰り返さない
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

  /* シークレットカードが表に返る */
  function playSecret(c, solved) {
    if (!c) return;
    const P = prog();
    const txt = h("div", { class: "hn-fx-txt" },
      h("p", { class: "hn-fx-title" }, solved ? "正解！ シークレットカード" : "シークレットカードが図鑑に入った"),
      h("p", { class: "hn-fx-sub" }, "「" + c.name + "」　図鑑 " + P.n + " / " + P.N),
      h("p", { class: "hn-fx-tap" }, "タップで閉じる"));
    overlay("hn-fx", [h("div", { class: "hn-fx-card", "aria-hidden": "true" }, flipCard(c, true, 240)), txt],
      () => afterUnlock(0), reduceMotion() ? 2600 : 3600);
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
    ui.view = "owl"; ui.expanded[id] = true; render();
    G.requestAnimationFrame(() => {
      const el = root.querySelector('[data-letter="' + id + '"]');
      if (el) el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
    });
  }

  function showClear() {
    const H = hunt(), P = progress(H);
    H.clearSeen = true; save(); render();
    const names = HP.activePlayers().map((p) => h("span", { class: "hn-name" }, h("span", null, p.name), HP.houseChip(p.house)));
    const el = h("div", { class: "hn-clear", role: "dialog", "aria-modal": "true", "aria-labelledby": "hn-clear-t", tabindex: "-1" },
      h("div", { class: "hn-clear-in" },
        art("final", "", "朝日が差す城"),
        h("span", { class: "eyebrow hn-kicker" }, "2026年10月11日"),
        h("h2", { class: "hn-clear-title", id: "hn-clear-t" }, "図鑑コンプリート"),
        h("p", null, P.N + "枚の蛙チョコカードが、すべて表に返った。\n今日の旅は、まるごと1冊の図鑑になった。ダンブルドアも、さぞ喜んでおろう。"),
        names.length ? h("div", { class: "hn-names" }, names) : null,
        h("div", { class: "hn-col" },
          h("button", { type: "button", class: "btn", onclick: () => { close(); HP.go("paper"); } }, "予言者新聞・号外を刷る"),
          h("button", { type: "button", class: "btn ghost", onclick: () => close() }, "図鑑に戻る"))));
    function close() { el.remove(); lockScroll(false); G.document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    G.document.addEventListener("keydown", onKey);
    G.document.body.append(el);
    lockScroll(true);
    el.focus({ preventScroll: true });
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
