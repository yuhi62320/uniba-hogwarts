/* 魔法の旅のしおり — 4人のスマホを Supabase で同期する
 *
 * 状態（HP.state）を「項目」単位に平たくして trip_kv テーブルに 1 行ずつ持つ。
 *   例: players / hunt/horcrux/diary / hunt/letters/L1 / games/custom/talk / media/hx-diary
 * 同じ項目を 2 人が同時に変えたら、あとから書いた方が残る。
 * 写真・動画は Storage の trip バケットに上げ、URL を media/<キー> に入れる。
 * Supabase に届かないとき（オフラインなど）は、そのスマホの中だけで動き、つながったら送る。
 */
(function () {
  const SUPA_URL = "https://ndigebjndholijpphioc.supabase.co";
  const SUPA_KEY = "sb_publishable_IFHDQYA92vvRk_ycAoHSEw_IqDWR6Ig";
  const TABLE = "trip_kv";
  const BUCKET = "trip";
  const MAX_UPLOAD = 50 * 1024 * 1024;
  const DEPTH = 3; // これより深いものは 1 つの値として扱う
  const ROOM = HP.ROOM;
  const PENDING_KEY = HP.STORE_KEY + ":pending";

  /* 画面を開くたびに作る送り主の印。自分の送った変更が返ってきたのを見分けるのに使う */
  const me = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  /* ---------- 平たくする・戻す ---------- */
  function flatten(state) {
    const out = {};
    (function walk(obj, path, depth) {
      Object.keys(obj).forEach((k) => {
        const v = obj[k]; const p = path ? path + "/" + k : k;
        if (v && typeof v === "object" && !Array.isArray(v) && depth < DEPTH) walk(v, p, depth + 1); // 空の箱は送らない
        else if (v !== undefined) out[p] = JSON.stringify(v);
      });
    })(state, "", 1);
    return out;
  }
  function setPath(state, path, value) {
    const parts = path.split("/");
    let o = state;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!o[parts[i]] || typeof o[parts[i]] !== "object" || Array.isArray(o[parts[i]])) o[parts[i]] = {};
      o = o[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (value === null || value === undefined) delete o[last]; else o[last] = value;
  }

  /* ---------- 状態 ---------- */
  let client = null;
  let status = ROOM ? "connecting" : "solo"; // solo / connecting / online / offline
  let synced = {};      // 最後にサーバーと一致していた値（JSON 文字列）
  let pending = {};     // まだ送れていない項目
  let pushTimer = null;
  let lastSeen = null;  // ポーリング用
  let uploading = 0;
  let realtimeOk = false; // リアルタイム通知がつながっているか
  try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "{}"); } catch (e) {}

  function savePending() { try { localStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch (e) {} }
  function setStatus(s) { status = s; renderPill(); }

  /* 手元の変更を探して送る（少しまとめてから） */
  function push() {
    if (!ROOM) return;
    const flat = flatten(HP.state);
    Object.keys(flat).forEach((k) => { if (synced[k] !== flat[k]) pending[k] = flat[k]; });
    Object.keys(synced).forEach((k) => { if (!(k in flat) && synced[k] !== "null") pending[k] = "null"; });
    savePending();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(flush, 400);
  }

  async function flush() {
    if (!client) return;
    const keys = Object.keys(pending);
    if (!keys.length) return;
    const rows = keys.map((k) => ({ room: ROOM, key: k, value: JSON.parse(pending[k]), updated_by: me }));
    const sent = Object.assign({}, pending);
    const { error } = await client.from(TABLE).upsert(rows, { onConflict: "room,key" });
    if (error) { setStatus("offline"); clearTimeout(pushTimer); pushTimer = setTimeout(flush, 8000); return; }
    keys.forEach((k) => { synced[k] = sent[k]; if (pending[k] === sent[k]) delete pending[k]; });
    savePending();
    if (status !== "online") setStatus("online");
  }

  /* 届いた行を手元に反映する */
  function applyRows(rows, fromInitial) {
    let changed = false;
    rows.forEach((r) => {
      if (!r || r.room !== ROOM) return;
      if (r.updated_at && (!lastSeen || r.updated_at > lastSeen)) lastSeen = r.updated_at;
      const json = JSON.stringify(r.value === undefined ? null : r.value);
      if (!fromInitial && r.updated_by === me) { synced[r.key] = json; return; }
      if (pending[r.key] !== undefined) return; // 自分の未送信の変更を優先
      if (synced[r.key] === json) return;
      synced[r.key] = json;
      setPath(HP.state, r.key, r.value);
      changed = true;
    });
    if (changed) HP.save({ remote: true });
    return changed;
  }

  async function initialLoad() {
    const { data, error } = await client.from(TABLE).select("key,value,updated_at,updated_by,room").eq("room", ROOM);
    if (error) throw error;
    const local = flatten(HP.state);
    const remoteKeys = new Set((data || []).map((r) => r.key));
    applyRows(data || [], true);
    if (!remoteKeys.size) {
      // サーバーが空なら、このスマホの今の状態を最初の 1 台として送る
      Object.keys(local).forEach((k) => { if (pending[k] === undefined) pending[k] = local[k]; });
    } else {
      // すでに旅が始まっていれば、このスマホだけにある古いデータ（試し遊びなど）は捨てる
      let dropped = false;
      Object.keys(local).forEach((k) => { if (!remoteKeys.has(k) && pending[k] === undefined) { setPath(HP.state, k, null); dropped = true; } });
      if (dropped) HP.save({ remote: true });
    }
    // 平たくした結果、サーバーと同じになった項目は送らない
    const after = flatten(HP.state);
    Object.keys(after).forEach((k) => { if (remoteKeys.has(k) && pending[k] === undefined) synced[k] = after[k]; });
    savePending();
    await flush();
  }

  async function poll() {
    if (!client) return;
    try {
      let q = client.from(TABLE).select("key,value,updated_at,updated_by,room").eq("room", ROOM);
      if (lastSeen) q = q.gt("updated_at", lastSeen);
      const { data, error } = await q;
      if (error) throw error;
      applyRows(data || [], false);
      if (status === "offline") setStatus("online");
      if (Object.keys(pending).length) flush();
    } catch (e) { setStatus("offline"); }
  }

  async function start() {
    renderPill();
    if (!ROOM) { showJoin(false); return; }
    if (!window.supabase || !window.supabase.createClient) { setStatus("offline"); return; }
    client = window.supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
    try { await initialLoad(); setStatus("online"); }
    catch (e) { console.warn(e); setStatus("offline"); }
    try {
      client.channel("trip-" + ROOM)
        .on("postgres_changes", { event: "*", schema: "public", table: TABLE, filter: "room=eq." + ROOM }, (p) => applyRows([p.new], false))
        .subscribe((s) => {
          realtimeOk = s === "SUBSCRIBED";
          if (realtimeOk && status !== "online") setStatus("online");
        });
    } catch (e) { console.warn(e); }
    // リアルタイムがつながらない・切れたときも追いつけるように差分を読む。
    // つながっていない間は 4 秒おき、つながっていれば 20 秒おき。
    let ticks = 0;
    setInterval(() => { ticks++; if (!realtimeOk || ticks % 5 === 0) poll(); }, 4000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
    window.addEventListener("online", poll);
  }

  /* ---------- 写真・動画 ---------- */
  function upload(id, blob, kind) {
    if (!client) return false;
    if (blob.size > MAX_UPLOAD) { HP.toast("動画が大きすぎて共有できません（50MBまで）。短く切ってね"); return false; }
    const ext = kind === "video" ? ((blob.type.split("/")[1] || "mp4").replace("quicktime", "mov")) : "jpg";
    const path = ROOM + "/" + id + "-" + Date.now() + "." + ext;
    uploading++; renderPill();
    client.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || (kind === "video" ? "video/mp4" : "image/jpeg"), upsert: false })
      .then(({ error }) => {
        if (error) throw error;
        const url = client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        HP.media._shared(id, { kind, url, at: new Date().toISOString(), by: me });
        HP.toast(kind === "video" ? "動画をみんなに共有した" : "写真をみんなに共有した");
      })
      .catch((e) => { console.warn(e); HP.toast("写真を共有できなかった。電波のいい所でもう一度撮り直してね"); })
      .finally(() => { uploading--; renderPill(); });
    return true;
  }

  /* ---------- 画面: 同期の表示と合言葉 ---------- */
  const CSS = `
.sy-pill { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 4px 12px;
  border-radius: 9999px; border: 1px solid var(--lc-border); background: #fff; color: var(--lc-fg-2);
  font-size: 12px; font-weight: 600; white-space: nowrap; cursor: pointer; box-shadow: var(--shadow-xs); }
.sy-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--lc-border-strong); flex-shrink: 0; }
.sy-pill[data-s="online"] .sy-dot { background: var(--lime); box-shadow: 0 0 0 3px var(--lime-100); }
.sy-pill[data-s="offline"] .sy-dot { background: var(--danger); }
.sy-pill[data-s="connecting"] .sy-dot { background: var(--lime-200); }
.sy-back { position: fixed; inset: 0; z-index: 30; background: rgba(24,24,27,.4); display: grid; place-items: end center; padding: 0; }
@media (min-width: 600px) { .sy-back { place-items: center; padding: 16px; } }
.sy-card { width: 100%; max-width: 480px; display: grid; gap: 14px; background: #fff; color: var(--lc-fg);
  border-radius: 24px 24px 0 0; padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 0px)); box-shadow: var(--shadow-lg); }
@media (min-width: 600px) { .sy-card { border-radius: 24px; } }
.sy-card h2 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -.015em; }
.sy-card p { margin: 0; font-size: 14px; color: var(--lc-fg-2); }
.sy-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.sy-input { flex: 1 1 160px; min-width: 0; min-height: 44px; padding: 8px 14px; border-radius: 12px;
  border: 1px solid var(--lc-border-strong); background: #fff; color: var(--lc-fg); font: inherit; font-size: 16px; }
.sy-input:focus { outline: none; border-color: var(--lime-700); box-shadow: 0 0 0 3px var(--lime-100); }
.sy-link { display: block; min-width: 0; padding: 12px 14px; border-radius: 12px; background: var(--lc-muted); color: var(--lc-fg);
  font-family: var(--font-mono); font-size: 12px; overflow-wrap: anywhere; user-select: all; -webkit-user-select: all; }
.sy-note { font-size: 12px !important; color: var(--lc-fg-muted) !important; }
`;
  function css() { if (!document.getElementById("sy-style")) document.head.append(HP.h("style", { id: "sy-style" }, CSS)); }

  function label() {
    if (!ROOM) return "ひとりモード";
    if (uploading) return "共有中…" + uploading;
    return { online: "4人で同期中", offline: "オフライン", connecting: "接続中…" }[status] || "";
  }
  function renderPill() {
    css();
    let pill = document.getElementById("sy-pill");
    if (!pill) {
      const slot = document.getElementById("app-sub");
      if (!slot) return;
      pill = HP.h("button", { type: "button", id: "sy-pill", class: "sy-pill", onclick: () => showJoin(true) });
      slot.replaceWith(pill);
    }
    pill.dataset.s = ROOM ? status : "solo";
    pill.textContent = "";
    pill.append(HP.h("span", { class: "sy-dot" }), label());
  }

  function shareUrl(room) { return location.origin + location.pathname + "?trip=" + room; }
  function newRoom() {
    const a = "abcdefghjkmnpqrstuvwxyz23456789"; let s = "uniba-";
    for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }
  function go(room) { location.href = shareUrl(room); }

  function showJoin(closable) {
    css();
    const old = document.getElementById("sy-back"); if (old) old.remove();
    const back = HP.h("div", { class: "sy-back", id: "sy-back", onclick: (e) => { if (closable && e.target === back) back.remove(); } });
    const card = HP.h("div", { class: "sy-card", role: "dialog", "aria-label": "4人で同期" });
    if (ROOM) {
      const url = shareUrl(ROOM);
      const copy = HP.h("button", { type: "button", class: "btn", onclick: async () => {
        try { await navigator.clipboard.writeText(url); HP.toast("リンクをコピーした。LINE に貼ってね"); }
        catch (e) { const r = document.createRange(); r.selectNodeContents(link); const s = getSelection(); s.removeAllRanges(); s.addRange(r); HP.toast("選択したのでコピーしてね"); }
      } }, "リンクをコピー");
      const link = HP.h("span", { class: "sy-link" }, url);
      card.append(
        HP.h("span", { class: "eyebrow" }, "SYNC"), HP.h("h2", null, "4人で同期"),
        HP.h("p", null, "このリンクを LINE で3人に送ると、カード・ふくろう便・写真・新聞・飲みゲームのお題が全員のスマホで同じになります。"),
        link,
        HP.h("div", { class: "sy-row" }, copy,
          navigator.share ? HP.h("button", { type: "button", class: "btn ghost", onclick: () => navigator.share({ title: "魔法の旅のしおり", url }).catch(() => {}) }, "送る") : null),
        HP.h("p", { class: "sy-note" }, "合言葉：" + ROOM + "　／　状態：" + label() + (Object.keys(pending).length ? "（未送信 " + Object.keys(pending).length + " 件。つながったら送ります）" : "")),
        HP.h("div", { class: "sy-row" }, HP.h("button", { type: "button", class: "btn ghost", onclick: () => back.remove() }, "閉じる"))
      );
    } else {
      const input = HP.h("input", { class: "sy-input", id: "sy-code", type: "text", placeholder: "合言葉（例 uniba-7k3q9m）", autocomplete: "off", autocapitalize: "off" });
      card.append(
        HP.h("span", { class: "eyebrow" }, "START"), HP.h("h2", null, "4人で同期する"),
        HP.h("p", null, "1人が「旅をはじめる」を押して、出てきたリンクを LINE で3人に送ってください。届いたリンクを開けば、同じ旅に入れます。"),
        HP.h("div", { class: "sy-row" }, HP.h("button", { type: "button", class: "btn", onclick: () => go(newRoom()) }, "旅をはじめる")),
        HP.h("p", { class: "sy-note" }, "合言葉を聞いた人はここに入力"),
        HP.h("div", { class: "sy-row" }, input, HP.h("button", { type: "button", class: "btn ghost", onclick: () => {
          const v = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
          if (v.length < 6) { HP.toast("合言葉は6文字以上"); return; }
          go(v);
        } }, "入る")),
        HP.h("div", { class: "sy-row" }, HP.h("button", { type: "button", class: "btn ghost", onclick: () => back.remove() }, "ひとりで使う"))
      );
    }
    back.append(card);
    document.body.append(back);
  }

  HP.sync = {
    push, start, upload,
    canUpload() { return !!client; },
    status() { return status; },
    _flatten: flatten, _setPath: setPath,
  };
})();
