/* 魔法の旅のしおり — 共通の土台
 *
 * 各画面は HP.register(tab, { mount(root), show?(root) }) で登録する。
 *   mount: 最初に 1 回だけ呼ばれる。root は <main data-tab=...>
 *   show:  そのタブが表示されるたびに呼ばれる（任意）
 * 状態は HP.state に 1 つだけ持ち、変えたら HP.save() を呼ぶ。
 * HP.onChange(fn) で、誰かが save() したときに再描画できる。
 */
(function () {
  const BASE_KEY = "hp-trip-v1";
  /* 合言葉（部屋）。?trip=xxxx が URL にあればそれ、無ければ前回のもの */
  const ROOM = (function () {
    let r = "";
    try { r = new URLSearchParams(location.search).get("trip") || ""; } catch (e) {}
    r = r.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
    if (!r) { try { r = localStorage.getItem(BASE_KEY + ":room") || ""; } catch (e) {} }
    if (r) { try { localStorage.setItem(BASE_KEY + ":room", r); } catch (e) {} }
    return r;
  })();
  const KEY = ROOM ? BASE_KEY + ":r:" + ROOM : BASE_KEY;

  const HOUSES = {
    gryffindor: { id: "gryffindor", jp: "グリフィンドール", animal: "ライオン", trait: "勇気", color: "var(--gry)", color2: "var(--gry-2)" },
    slytherin:  { id: "slytherin",  jp: "スリザリン",       animal: "ヘビ",     trait: "野心", color: "var(--sly)", color2: "var(--sly-2)" },
    ravenclaw:  { id: "ravenclaw",  jp: "レイブンクロー",   animal: "ワシ",     trait: "知恵", color: "var(--rav)", color2: "var(--rav-2)" },
    hufflepuff: { id: "hufflepuff", jp: "ハッフルパフ",     animal: "アナグマ", trait: "やさしさ", color: "var(--huf)", color2: "var(--huf-2)" },
  };

  function blankState() {
    return {
      players: [1, 2, 3, 4].map((n) => ({ id: "p" + n, name: "", house: null })),
      // rounds: [{ id, mission, votes: { voterId: targetId }, at: ISO文字列 }]
      rounds: [],
      paper: {},   // 予言者新聞モジュールが自由に使う
      // 分霊箱ハント: { prologueDone, letters: { id: { openedAt, solved, gaveUp } }, horcrux: { id: { doneAt, by } } }
      hunt: { prologueDone: false, letters: {}, horcrux: {} },
    };
  }

  function load() {
    try {
      // 部屋に入った最初の 1 回は、同期前に遊んでいたデータを引き継ぐ
      const raw = localStorage.getItem(KEY) || localStorage.getItem(BASE_KEY);
      if (raw) return Object.assign(blankState(), JSON.parse(raw));
    } catch (e) {}
    return blankState();
  }

  /* 写真・動画の置き場。写真は縮めた JPEG の dataURL を localStorage に、
   * 動画は大きいので blob URL でメモリにだけ持つ（画面を閉じると消える）。 */
  const memMedia = {};
  const MEDIA_KEY = KEY + ":media:";
  const media = {
    get(id) {
      if (memMedia[id]) return memMedia[id];
      const shared = HP.state.media && HP.state.media[id];
      if (shared && shared.url) return { kind: shared.kind || "image", url: shared.url };
      try { const url = localStorage.getItem(MEDIA_KEY + id); if (url) return { kind: "image", url }; } catch (e) {}
      return null;
    },
    /* file から保存する。戻り値 { kind, url, saved } */
    async put(id, file) {
      media.remove(id, true);
      const uploader = HP.sync && HP.sync.canUpload() ? HP.sync : null;
      if (file.type.startsWith("video/")) {
        memMedia[id] = { kind: "video", url: URL.createObjectURL(file) };
        const ok = uploader ? uploader.upload(id, file, "video") : false;
        return Object.assign({ saved: !!ok }, memMedia[id]);
      }
      const url = await shrinkImage(file);
      if (uploader) {
        memMedia[id] = { kind: "image", url };
        uploader.upload(id, dataUrlToBlob(url), "image");
        return { kind: "image", url, saved: true };
      }
      try { localStorage.setItem(MEDIA_KEY + id, url); return { kind: "image", url, saved: true }; }
      catch (e) { memMedia[id] = { kind: "image", url }; return { kind: "image", url, saved: false }; }
    },
    /* keepShared: 撮り直しの途中など、同期中の写真を消さないとき */
    remove(id, keepShared) {
      if (memMedia[id] && memMedia[id].kind === "video") { try { URL.revokeObjectURL(memMedia[id].url); } catch (e) {} }
      delete memMedia[id];
      try { localStorage.removeItem(MEDIA_KEY + id); } catch (e) {}
      if (!keepShared && HP.state.media && HP.state.media[id]) { delete HP.state.media[id]; HP.save(); }
    },
    /* アップロードが終わったら共有の URL に切り替える */
    _shared(id, info) {
      if (!HP.state.media) HP.state.media = {};
      HP.state.media[id] = info;
      HP.save();
    },
    /* 写真なら <img>、動画なら自動再生・無音・ループの <video> を返す */
    el(id, attrs) {
      const m = media.get(id);
      if (!m) return null;
      if (m.kind === "video") {
        const v = HP.h("video", Object.assign({ crossorigin: /^https?:/.test(m.url) ? "anonymous" : null, src: m.url, autoplay: true, muted: true, loop: true, playsinline: true }, attrs || {}));
        v.muted = true; v.defaultMuted = true;
        if (v.play) v.play().catch(() => {});
        return v;
      }
      return HP.h("img", Object.assign({ crossorigin: /^https?:/.test(m.url) ? "anonymous" : null, src: m.url, alt: "" }, attrs || {}));
    },
  };
  function dataUrlToBlob(url) {
    const [head, b64] = url.split(",");
    const bin = atob(b64); const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return new Blob([buf], { type: (head.match(/data:([^;]+)/) || [])[1] || "image/jpeg" });
  }
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("read"));
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
            const c = document.createElement("canvas");
            c.width = Math.max(1, Math.round(img.naturalWidth * k));
            c.height = Math.max(1, Math.round(img.naturalHeight * k));
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL("image/jpeg", 0.8));
          } catch (e) { resolve(String(r.result)); }
        };
        img.onerror = () => resolve(String(r.result));
        img.src = String(r.result);
      };
      r.readAsDataURL(file);
    });
  }

  const listeners = [];
  const modules = {};
  const mounted = {};

  const HP = {
    HOUSES,
    media,
    ROOM,
    STORE_KEY: KEY,
    state: load(),
    POINTS_PER_VOTE: 10,
    WINNER_BONUS: 20,

    save(opts) {
      try { localStorage.setItem(KEY, JSON.stringify(HP.state)); } catch (e) {}
      if (HP.sync && !(opts && opts.remote)) HP.sync.push();
      listeners.forEach((fn) => { try { fn(HP.state); } catch (e) { console.error(e); } });
    },
    onChange(fn) { listeners.push(fn); },
    reset() { HP.state = blankState(); HP.save(); },

    register(tab, mod) { modules[tab] = mod; },

    go(tab) {
      document.querySelectorAll("main.view").forEach((m) => { m.hidden = m.dataset.tab !== tab; });
      document.querySelectorAll(".tabbar [data-go]").forEach((b) => {
        if (b.dataset.go === tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
      });
      const root = document.querySelector('main.view[data-tab="' + tab + '"]');
      const mod = modules[tab];
      if (mod && root) {
        if (!mounted[tab]) { mounted[tab] = true; mod.mount(root); }
        if (mod.show) mod.show(root);
      }
      window.scrollTo(0, 0);
      try { localStorage.setItem(KEY + ":tab", tab); } catch (e) {}
    },

    /* 名前と寮が入っているプレイヤーだけ */
    activePlayers() { return HP.state.players.filter((p) => p.name.trim()); },
    player(id) { return HP.state.players.find((p) => p.id === id); },
    playersReady() { return HP.activePlayers().length >= 2; },

    /* 1 票 = 10 点。各お題の最多得票者（同票なら全員）に +20 点 */
    roundWinners(round) {
      const count = {};
      Object.values(round.votes || {}).forEach((t) => { count[t] = (count[t] || 0) + 1; });
      const max = Math.max(0, ...Object.values(count));
      return max === 0 ? [] : Object.keys(count).filter((id) => count[id] === max);
    },
    scores() {
      const byPlayer = {};
      HP.state.players.forEach((p) => { byPlayer[p.id] = 0; });
      HP.state.rounds.forEach((r) => {
        Object.values(r.votes || {}).forEach((t) => { if (t in byPlayer) byPlayer[t] += HP.POINTS_PER_VOTE; });
        HP.roundWinners(r).forEach((id) => { if (id in byPlayer) byPlayer[id] += HP.WINNER_BONUS; });
      });
      const byHouse = {};
      Object.keys(HOUSES).forEach((h) => { byHouse[h] = 0; });
      HP.state.players.forEach((p) => { if (p.house) byHouse[p.house] += byPlayer[p.id]; });
      return { byPlayer, byHouse };
    },

    /* 小さな DOM ヘルパ */
    h(tag, attrs, ...children) {
      const el = document.createElement(tag);
      Object.entries(attrs || {}).forEach(([k, v]) => {
        if (v == null || v === false) return;
        if (k === "class") el.className = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else el.setAttribute(k, v === true ? "" : v);
      });
      children.flat().forEach((c) => {
        if (c == null || c === false) return;
        el.append(c instanceof Node ? c : document.createTextNode(String(c)));
      });
      return el;
    },
    houseChip(houseId) {
      const h = HOUSES[houseId];
      return h ? HP.h("span", { class: "house-chip", "data-house": houseId }, h.jp) : null;
    },
    toast(msg) {
      const t = document.getElementById("toast");
      t.textContent = msg; t.hidden = false;
      clearTimeout(HP._toastTimer);
      HP._toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
    },

    start() {
      document.querySelectorAll(".tabbar [data-go]").forEach((b) => b.addEventListener("click", () => HP.go(b.dataset.go)));
      let tab = "hunt";
      try { tab = localStorage.getItem(KEY + ":tab") || "hunt"; } catch (e) {}
      if (!modules[tab]) tab = "hunt";
      HP.go(tab);
      if (HP.sync) HP.sync.start();
    },
  };

  /* 標準の replaceChildren / append は null を「null」という文字で描いてしまう。
   * HP.h と同じく、null・false・入れ子の配列を読み飛ばすようにそろえる。 */
  ["replaceChildren", "append"].forEach((name) => {
    const orig = Element.prototype[name];
    if (!orig) return;
    Element.prototype[name] = function (...nodes) {
      return orig.apply(this, nodes.flat(Infinity).filter((n) => n != null && n !== false));
    };
  });

  window.HP = HP;
})();
