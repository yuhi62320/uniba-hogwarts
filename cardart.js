/* 蛙チョコカードの絵（Canvas）。
 * window.HP_CARDART = { render(card, opts) → Promise<HTMLCanvasElement>, toBlob(canvas), save(card, opts) }
 * 750×1050（5:7）を基準に描く。opts.width で縮小・拡大（サムネイル用）。
 * 写真は HP.media.get(card.key)、シークレットは img/<card.img>.jpg。読めなければ未解放の描き方（カエルの線画）にする。
 * アイコン（絵文字・記号）は使わない。飾りはすべて Canvas の線で描く。 */
(function () {
  "use strict";
  const G = typeof window !== "undefined" ? window : globalThis;
  const W = 750, H = 1050;

  const SETS = {
    shinkansen: { label: "新幹線", en: "SHINKANSEN", deep: "#0a1230", mid: "#1d2c62" },
    usj:        { label: "ユニバ", en: "UNIVERSAL", deep: "#2a060b", mid: "#701824" },
    night:      { label: "夜の談話室", en: "COMMON ROOM", deep: "#061f16", mid: "#175239" },
    secret:     { label: "シークレット", en: "SECRET", deep: "#170a29", mid: "#45216e" },
    self:       { label: "自分たち", en: "OUR CARDS", deep: "#221309", mid: "#5c3a1d" },
  };
  const RAR = {
    normal: { jp: "ノーマル", en: "COMMON" },
    rare:   { jp: "レア", en: "RARE" },
    legend: { jp: "伝説", en: "LEGENDARY" },
  };
  const BRONZE = ["#4a2a12", "#a8693a", "#f2c595", "#8a5426", "#d99c60", "#5a3417"];
  const GOLD = ["#6a4a14", "#c9a85c", "#fff1bd", "#a07a28", "#ecd17f", "#7a5a1c"];
  const CREAM = "#efe6d2";

  const F_DISP = '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", serif';
  const F_BODY = '"Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';
  const F_NUM = '"Cinzel", "Times New Roman", serif';

  /* ---------- フォント（間に合わなければシステムのフォント） ---------- */
  let fontsP = null;
  function fontsReady() {
    if (fontsP) return fontsP;
    const d = G.document;
    if (!d || !d.fonts || !d.fonts.load) return (fontsP = Promise.resolve());
    const all = Promise.all([
      d.fonts.load('700 40px "Shippori Mincho B1"', "蛙チョコ"),
      d.fonts.load('800 40px "Shippori Mincho B1"', "蛙チョコ"),
      d.fonts.load('600 40px "Cinzel"', "CHOCOLATE"),
      d.fonts.load('700 40px "Cinzel"', "No.0123456789"),
      d.fonts.load('500 26px "Zen Kaku Gothic New"', "予習メモ"),
      d.fonts.load('700 26px "Zen Kaku Gothic New"', "新幹線"),
    ]).catch(() => {});
    fontsP = Promise.race([all, new Promise((r) => setTimeout(r, 2500))]);
    return fontsP;
  }

  /* ---------- 絵の読み込み ---------- */
  const srcCache = new Map();
  function isRemote(url) {
    if (!/^https?:/i.test(url)) return false;
    try { return new URL(url).origin !== G.location.origin; } catch (e) { return true; }
  }
  function loadImg(url) {
    return new Promise((res) => {
      const im = new Image();
      if (isRemote(url)) im.crossOrigin = "anonymous";
      im.decoding = "async";
      const t = setTimeout(() => res(null), 15000);
      im.onload = () => { clearTimeout(t); res(im.naturalWidth ? im : null); };
      im.onerror = () => { clearTimeout(t); res(null); };
      im.src = url;
    });
  }
  function loadVideoFrame(url) {
    return new Promise((res) => {
      const v = G.document.createElement("video");
      if (isRemote(url)) v.crossOrigin = "anonymous";
      v.muted = true; v.playsInline = true; v.preload = "auto";
      v.setAttribute("playsinline", ""); v.setAttribute("muted", "");
      let done = false;
      const fin = (ok) => { if (done) return; done = true; clearTimeout(t); res(ok && v.videoWidth ? v : null); };
      const t = setTimeout(() => fin(v.readyState >= 2), 10000);
      v.addEventListener("loadeddata", () => {
        const d = isFinite(v.duration) ? v.duration : 1;
        try { v.currentTime = Math.min(0.6, d / 3); } catch (e) { fin(true); }
      }, { once: true });
      v.addEventListener("seeked", () => fin(true), { once: true });
      v.addEventListener("error", () => fin(false), { once: true });
      v.src = url;
      try { v.load(); } catch (e) {}
    });
  }
  /* カードの絵の URL と種類 */
  function sourceOf(card) {
    if (!card) return null;
    if (card.type === "sc") return card.done && card.img ? { kind: "image", url: "img/" + card.img + ".jpg" } : null;
    if (!card.done || !G.HP || !G.HP.media) return null;
    const m = G.HP.media.get(card.key);
    return m && m.url ? { kind: m.kind || "image", url: m.url } : null;
  }
  function loadSource(src) {
    if (!src) return Promise.resolve(null);
    const k = src.kind + "|" + src.url;
    if (!srcCache.has(k)) {
      const p = (src.kind === "video" ? loadVideoFrame(src.url) : loadImg(src.url));
      srcCache.set(k, p);
      p.then((x) => { if (!x) srcCache.delete(k); });
      if (srcCache.size > 60) srcCache.delete(srcCache.keys().next().value);
    }
    return srcCache.get(k);
  }

  /* ---------- 小道具 ---------- */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function metal(ctx, x0, y0, x1, y1, pal) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    [0, .22, .42, .6, .8, 1].forEach((s, i) => g.addColorStop(s, pal[i]));
    return g;
  }
  function rnd(seed) {
    let s = 0;
    for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    s = s || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  /* 4 方向に伸びるきらめき（小さな星） */
  function sparkle(ctx, x, y, r) {
    const k = r * 0.22;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + k, y - k, x + r, y);
    ctx.quadraticCurveTo(x + k, y + k, x, y + r);
    ctx.quadraticCurveTo(x - k, y + k, x - r, y);
    ctx.quadraticCurveTo(x - k, y - k, x, y - r);
    ctx.closePath();
    ctx.fill();
  }
  function diamond(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath();
  }
  /* 字間つきで中央ぞろえ */
  function spaced(ctx, text, cx, y, sp) {
    const chars = Array.from(text);
    const ws = chars.map((ch) => ctx.measureText(ch).width);
    const total = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
    let x = cx - total / 2;
    const align = ctx.textAlign;
    ctx.textAlign = "left";
    chars.forEach((ch, i) => { ctx.fillText(ch, x, y); x += ws[i] + sp; });
    ctx.textAlign = align;
    return total;
  }
  /* 日本語の折り返し（文字単位）。max 行を超えたら最後を「…」 */
  function wrap(ctx, text, maxW, maxLines) {
    const chars = Array.from(String(text || "").replace(/\s+/g, " ").trim());
    const lines = [];
    let cur = "";
    for (let i = 0; i < chars.length; i++) {
      const t = cur + chars[i];
      if (ctx.measureText(t).width > maxW && cur) {
        lines.push(cur);
        cur = chars[i] === " " ? "" : chars[i];
        if (lines.length === maxLines) {
          let last = lines[maxLines - 1];
          while (last && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
          lines[maxLines - 1] = last + "…";
          return lines;
        }
      } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, maxLines);
  }

  /* ---------- 部品 ---------- */
  function background(ctx, set, seed) {
    const g = ctx.createRadialGradient(W / 2, H * 0.38, 40, W / 2, H * 0.45, H * 0.75);
    g.addColorStop(0, set.mid);
    g.addColorStop(1, set.deep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 菱形の地紋
    ctx.save();
    ctx.strokeStyle = "rgba(255, 228, 170, .05)";
    ctx.lineWidth = 1;
    for (let d = -H; d < W + H; d += 34) {
      ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + H, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(d, H); ctx.lineTo(d + H, 0); ctx.stroke();
    }
    // 細かい粒（紙の風合い）
    const r = rnd(seed + "grain");
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = r() < .5 ? "rgba(255,240,210,.035)" : "rgba(0,0,0,.08)";
      ctx.fillRect(r() * W, r() * H, 1.6, 1.6);
    }
    ctx.restore();
  }

  function cornerOrn(ctx, x, y, sx, sy, stroke, fill) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;
    ctx.lineCap = "round";
    // 角の L 字の唐草
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(4, 118);
    ctx.bezierCurveTo(4, 50, 22, 22, 46, 14);
    ctx.bezierCurveTo(70, 6, 96, 4, 118, 4);
    ctx.stroke();
    // 内側のうず
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(14, 92);
    ctx.bezierCurveTo(14, 46, 46, 14, 92, 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(30, 66);
    ctx.bezierCurveTo(26, 40, 40, 28, 58, 30);
    ctx.bezierCurveTo(72, 32, 74, 50, 62, 54);
    ctx.bezierCurveTo(52, 57, 47, 47, 54, 43);
    ctx.stroke();
    // 葉
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(58, 30); ctx.quadraticCurveTo(84, 22, 104, 34); ctx.quadraticCurveTo(82, 40, 58, 30);
    ctx.moveTo(30, 58); ctx.quadraticCurveTo(22, 84, 34, 104); ctx.quadraticCurveTo(40, 82, 30, 58);
    ctx.stroke();
    ctx.globalAlpha = .55; ctx.fill(); ctx.globalAlpha = 1;
    // 長く伸びる細い線
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(104, 34); ctx.bezierCurveTo(130, 44, 150, 30, 176, 26);
    ctx.moveTo(34, 104); ctx.bezierCurveTo(44, 130, 30, 150, 26, 176);
    ctx.stroke();
    // 小さな星と玉
    sparkle(ctx, 30, 30, 11);
    ctx.beginPath(); ctx.arc(176, 26, 3, 0, Math.PI * 2); ctx.arc(26, 176, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function archPath(ctx, x0, x1, yt, yb, ry) {
    const rx = (x1 - x0) / 2, cx = (x0 + x1) / 2;
    ctx.beginPath();
    ctx.moveTo(x0, yb);
    ctx.lineTo(x0, yt + ry);
    ctx.ellipse(cx, yt + ry, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(x1, yb);
    ctx.closePath();
  }

  function drawCover(ctx, src, x, y, w, h) {
    const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
    const s = Math.max(w / sw, h / sh);
    const dw = sw * s, dh = sh * s;
    ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) * 0.35, dw, dh);
  }

  function frog(ctx, cx, cy, s, gold, dark) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = gold; ctx.lineWidth = 3.4 / s * 1.3;
    ctx.fillStyle = dark;
    // 後ろ足
    [-1, 1].forEach((d) => {
      ctx.beginPath();
      ctx.moveTo(d * 78, 30);
      ctx.bezierCurveTo(d * 140, 34, d * 146, 104, d * 92, 108);
      ctx.bezierCurveTo(d * 70, 110, d * 58, 100, d * 50, 92);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(d * 92, 108); ctx.lineTo(d * 120, 116);
      ctx.moveTo(d * 92, 108); ctx.lineTo(d * 112, 124);
      ctx.moveTo(d * 92, 108); ctx.lineTo(d * 98, 128);
      ctx.stroke();
    });
    // 体
    ctx.beginPath();
    ctx.moveTo(-60, -44);
    ctx.bezierCurveTo(-100, -30, -104, 50, -70, 86);
    ctx.bezierCurveTo(-40, 110, 40, 110, 70, 86);
    ctx.bezierCurveTo(104, 50, 100, -30, 60, -44);
    ctx.bezierCurveTo(30, -56, -30, -56, -60, -44);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // おなか
    ctx.beginPath();
    ctx.ellipse(0, 52, 44, 36, 0, Math.PI * 0.05, Math.PI * 0.95);
    ctx.stroke();
    // 前足
    [-1, 1].forEach((d) => {
      ctx.beginPath();
      ctx.moveTo(d * 40, 66); ctx.bezierCurveTo(d * 44, 86, d * 42, 100, d * 36, 112);
      ctx.moveTo(d * 36, 112); ctx.lineTo(d * 50, 118);
      ctx.moveTo(d * 36, 112); ctx.lineTo(d * 36, 124);
      ctx.moveTo(d * 36, 112); ctx.lineTo(d * 22, 120);
      ctx.stroke();
    });
    // 口
    ctx.beginPath();
    ctx.moveTo(-50, 0); ctx.quadraticCurveTo(0, 30, 50, 0);
    ctx.stroke();
    // 目
    [-1, 1].forEach((d) => {
      ctx.beginPath(); ctx.arc(d * 44, -54, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(d * 44, -54, 15, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = gold; ctx.beginPath(); ctx.ellipse(d * 44, -54, 4, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark;
    });
    ctx.restore();
  }

  function holo(ctx, seed) {
    ctx.save();
    // 斜めの虹（低い不透明度）
    ctx.globalCompositeOperation = "overlay";
    const g = ctx.createLinearGradient(0, 0, W, H);
    const hues = [0, 40, 60, 130, 190, 260, 310, 360];
    for (let rep = 0; rep < 2; rep++) hues.forEach((hh, i) => g.addColorStop(Math.min(1, (rep + i / hues.length) / 2), "hsla(" + hh + ", 90%, 62%, .34)"));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 光の筋
    ctx.globalCompositeOperation = "screen";
    [[0.22, 70, .22], [0.52, 26, .30], [0.74, 110, .14]].forEach(([p, w, a]) => {
      ctx.save();
      ctx.translate(W * p * 1.4 - 120, H / 2);
      ctx.rotate(-0.55);
      const sg = ctx.createLinearGradient(-w, 0, w, 0);
      sg.addColorStop(0, "rgba(255,255,255,0)");
      sg.addColorStop(.5, "rgba(255,250,225," + a + ")");
      sg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(-w, -H, w * 2, H * 2);
      ctx.restore();
    });
    ctx.restore();
    stars(ctx, seed, 28, true);
  }
  function stars(ctx, seed, n, bright) {
    const r = rnd(seed + "stars");
    ctx.save();
    for (let i = 0; i < n; i++) {
      const x = 50 + r() * (W - 100), y = 50 + r() * (H - 100), s = 4 + r() * (bright ? 12 : 8);
      ctx.fillStyle = r() < .5 ? "rgba(255,248,220," + (bright ? .9 : .7) + ")" : "rgba(236,209,127,.85)";
      sparkle(ctx, x, y, s);
      if (bright && s > 11) { ctx.globalAlpha = .35; sparkle(ctx, x, y, s * 2.2); ctx.globalAlpha = 1; }
    }
    ctx.restore();
  }

  /* ---------- 本体 ---------- */
  async function render(card, opts) {
    opts = opts || {};
    const width = Math.max(120, Math.round(opts.width || W));
    const k = width / W;
    const canvas = G.document.createElement("canvas");
    canvas.width = width; canvas.height = Math.round(H * k);
    const ctx = canvas.getContext("2d");
    await fontsReady();
    const src = await loadSource(sourceOf(card));

    const set = SETS[card.set] || SETS.self;
    const rar = RAR[card.rar] ? card.rar : "normal";
    const pal = rar === "normal" ? BRONZE : GOLD;
    const seed = String(card.key || card.name || "card");
    const noStr = String(card.no || 0).padStart(2, "0");

    ctx.scale(k, k);
    ctx.textBaseline = "alphabetic";
    // カードの形で切り抜く（角は透明）
    rr(ctx, 0, 0, W, H, 34);
    ctx.save();
    ctx.clip();
    background(ctx, set, seed);

    // 額縁
    const frameG = metal(ctx, 0, 0, W, H, pal);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 10;
    ctx.strokeStyle = frameG; ctx.lineWidth = 14;
    rr(ctx, 16, 16, W - 32, H - 32, 26); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 2;
    rr(ctx, 23, 23, W - 46, H - 46, 21); ctx.stroke();
    ctx.strokeStyle = frameG; ctx.lineWidth = 3;
    rr(ctx, 36, 36, W - 72, H - 72, 18); ctx.stroke();
    ctx.globalAlpha = .45; ctx.lineWidth = 1;
    rr(ctx, 45, 45, W - 90, H - 90, 12); ctx.stroke();
    ctx.globalAlpha = 1;
    // 四隅の唐草
    const ornG = metal(ctx, 0, 0, W, H, pal);
    cornerOrn(ctx, 45, 45, 1, 1, ornG, ornG);
    cornerOrn(ctx, W - 45, 45, -1, 1, ornG, ornG);
    cornerOrn(ctx, 45, H - 45, 1, -1, ornG, ornG);
    cornerOrn(ctx, W - 45, H - 45, -1, -1, ornG, ornG);

    // 上の帯
    ctx.fillStyle = metal(ctx, 0, 60, 0, 104, GOLD);
    ctx.font = "700 25px " + F_NUM;
    ctx.textAlign = "center";
    const tw = spaced(ctx, "CHOCOLATE FROG CARD", W / 2, 92, 5);
    ctx.fillStyle = metal(ctx, 0, 0, W, 0, pal);
    [-1, 1].forEach((d) => {
      const x = W / 2 + d * (tw / 2 + 18);
      diamond(ctx, x, 83, 5); ctx.fill();
      ctx.fillRect(d < 0 ? x - 60 : x + 10, 82, 50, 1.6);
    });

    // 肖像窓
    const x0 = 96, x1 = W - 96, yt = 128, yb = 640, ry = 148;
    ctx.save();
    archPath(ctx, x0, x1, yt, yb, ry);
    ctx.clip();
    if (src) {
      try {
        drawCover(ctx, src, x0, yt, x1 - x0, yb - yt);
        // 薄いセピア
        ctx.globalCompositeOperation = "color";
        ctx.fillStyle = "rgba(122, 78, 30, .26)";
        ctx.fillRect(x0, yt, x1 - x0, yb - yt);
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "rgba(250, 226, 180, .22)";
        ctx.fillRect(x0, yt, x1 - x0, yb - yt);
        ctx.globalCompositeOperation = "source-over";
      } catch (e) { /* 描けなければ地のまま */ }
      // 周辺減光
      const vg = ctx.createRadialGradient(W / 2, (yt + yb) / 2, 120, W / 2, (yt + yb) / 2, 360);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(10,5,0,.62)");
      ctx.fillStyle = vg;
      ctx.fillRect(x0, yt, x1 - x0, yb - yt);
    } else {
      const lg = ctx.createRadialGradient(W / 2, 380, 30, W / 2, 380, 340);
      lg.addColorStop(0, set.mid);
      lg.addColorStop(1, "#05040a");
      ctx.fillStyle = lg;
      ctx.fillRect(x0, yt, x1 - x0, yb - yt);
      ctx.globalAlpha = .5;
      stars(ctx, seed + "lock", 10, false);
      ctx.globalAlpha = 1;
      frog(ctx, W / 2, 380, 1.45, metal(ctx, W / 2 - 200, 250, W / 2 + 200, 560, GOLD), "rgba(8,6,14,.85)");
      ctx.fillStyle = "rgba(236, 209, 127, .75)";
      ctx.font = "600 20px " + F_NUM;
      spaced(ctx, "NOT YET FOUND", W / 2, 600, 6);
    }
    ctx.restore();
    // 窓の金縁
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 12;
    ctx.strokeStyle = metal(ctx, x0, yt, x1, yb, pal); ctx.lineWidth = 9;
    archPath(ctx, x0, x1, yt, yb, ry); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = metal(ctx, x1, yt, x0, yb, pal); ctx.lineWidth = 2;
    archPath(ctx, x0 - 12, x1 + 12, yt - 12, yb + 12, ry + 12); ctx.stroke();
    // 窓の上の番号メダル
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 10;
    ctx.fillStyle = metal(ctx, W / 2 - 36, yt - 36, W / 2 + 36, yt + 36, pal);
    ctx.beginPath(); ctx.arc(W / 2, yt, 36, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = set.deep;
    ctx.beginPath(); ctx.arc(W / 2, yt, 29, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = metal(ctx, W / 2 - 29, yt - 29, W / 2 + 29, yt + 29, pal); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(W / 2, yt, 25, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = metal(ctx, 0, yt - 14, 0, yt + 14, GOLD);
    ctx.font = "700 26px " + F_NUM; ctx.textAlign = "center";
    ctx.fillText(noStr, W / 2, yt + 9);
    // 窓の左右下の小さな星
    ctx.fillStyle = metal(ctx, 0, 0, W, H, pal);
    sparkle(ctx, x0 - 2, yb + 2, 13); sparkle(ctx, x1 + 2, yb + 2, 13);

    // リボンのネームプレート
    const ry0 = 660, ry1 = 750, rmid = (ry0 + ry1) / 2;
    const tailFill = "rgba(0,0,0,.35)";
    [-1, 1].forEach((d) => {
      const xe = d < 0 ? 52 : W - 52, xi = d < 0 ? 128 : W - 128;
      ctx.beginPath();
      ctx.moveTo(xi, ry0 + 18);
      ctx.lineTo(xe, ry0 + 18);
      ctx.lineTo(xe + d * -26, rmid + 18);
      ctx.lineTo(xe, ry1 + 18);
      ctx.lineTo(xi, ry1 + 18);
      ctx.closePath();
      ctx.fillStyle = set.deep; ctx.fill();
      ctx.fillStyle = tailFill; ctx.fill();
      ctx.strokeStyle = metal(ctx, 0, ry0, 0, ry1 + 18, pal); ctx.lineWidth = 2.5; ctx.stroke();
      // 折り返しの影
      ctx.beginPath();
      ctx.moveTo(xi - d * 32, ry1); ctx.lineTo(xi, ry1 + 18); ctx.lineTo(xi - d * 32, ry1 + 18);
      ctx.closePath(); ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fill();
    });
    const ribbon = () => {
      ctx.beginPath();
      ctx.moveTo(96, ry0);
      ctx.quadraticCurveTo(W / 2, ry0 - 16, W - 96, ry0);
      ctx.lineTo(W - 96, ry1);
      ctx.quadraticCurveTo(W / 2, ry1 - 16, 96, ry1);
      ctx.closePath();
    };
    ribbon();
    const rbg = ctx.createLinearGradient(0, ry0, 0, ry1);
    rbg.addColorStop(0, set.mid); rbg.addColorStop(.5, set.deep); rbg.addColorStop(1, set.mid);
    ctx.fillStyle = rbg; ctx.fill();
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 6;
    ctx.strokeStyle = metal(ctx, 96, ry0, W - 96, ry1, pal); ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(0, 0);
    ctx.strokeStyle = metal(ctx, W - 96, ry0, 96, ry1, pal); ctx.lineWidth = 1.2; ctx.globalAlpha = .7;
    ctx.beginPath(); ctx.moveTo(108, ry0 + 8); ctx.quadraticCurveTo(W / 2, ry0 - 8, W - 108, ry0 + 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(108, ry1 - 8); ctx.quadraticCurveTo(W / 2, ry1 - 24, W - 108, ry1 - 8); ctx.stroke();
    ctx.restore();

    // カード名（金・自動で縮める。入らなければ 2 行）
    const name = String(card.name || "");
    const maxW = W - 96 * 2 - 48;
    ctx.textAlign = "center";
    let size = 52, lines = [name];
    const setFont = (s) => { ctx.font = "800 " + s + "px " + F_DISP; };
    setFont(size);
    while (size > 34 && ctx.measureText(name).width > maxW) setFont(--size);
    if (ctx.measureText(name).width > maxW) {
      size = 34;
      do { setFont(size); lines = wrap(ctx, name, maxW, 2); } while (size-- > 24 && lines.length === 2 && /…$/.test(lines[1]));
      size++;
      setFont(size);
    }
    const nameG = metal(ctx, 0, rmid - size * 0.7 - (lines.length - 1) * size * 0.55, 0, rmid + size * 0.4 + (lines.length - 1) * size * 0.55, GOLD);
    const lh = size * 1.12;
    lines.forEach((ln, i) => {
      const y = rmid - 8 + size * 0.36 + (i - (lines.length - 1) / 2) * lh;
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillText(ln, W / 2 + 1.5, y + 2.5);
      ctx.fillStyle = nameG;
      ctx.fillText(ln, W / 2, y);
    });

    // 予習メモ
    ctx.font = "500 25px " + F_BODY;
    ctx.fillStyle = CREAM;
    ctx.globalAlpha = .92;
    const lore = wrap(ctx, card.lore || "", W - 2 * 98, 3);
    const loreTop = lore.length === 3 ? 808 : lore.length === 2 ? 826 : 846;
    lore.forEach((ln, i) => ctx.fillText(ln, W / 2, loreTop + i * 40));
    ctx.globalAlpha = 1;

    // 区切り線と下の行
    const lineG = metal(ctx, 90, 0, W - 90, 0, pal);
    ctx.fillStyle = lineG;
    ctx.fillRect(98, 922, W / 2 - 98 - 16, 1.5);
    ctx.fillRect(W / 2 + 16, 922, W / 2 - 98 - 16, 1.5);
    diamond(ctx, W / 2, 922.7, 6); ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = CREAM; ctx.globalAlpha = .9;
    ctx.font = "700 22px " + F_BODY;
    ctx.fillText(set.label, 98, 966);
    ctx.globalAlpha = 1;
    ctx.textAlign = "right";
    ctx.fillStyle = metal(ctx, 0, 944, 0, 972, GOLD);
    ctx.font = "700 26px " + F_NUM;
    ctx.fillText("No." + noStr, W - 98, 967);
    // レア度（中央。小さな菱形の宝石＋文字）
    ctx.textAlign = "center";
    ctx.font = "700 22px " + F_BODY;
    const rj = RAR[rar].jp, rjw = ctx.measureText(rj).width;
    ctx.fillStyle = metal(ctx, 0, 944, 0, 972, pal);
    const gemN = rar === "legend" ? 3 : rar === "rare" ? 2 : 1;
    const gemW = gemN * 16;
    const startX = W / 2 - (gemW + 10 + rjw) / 2;
    for (let i = 0; i < gemN; i++) { diamond(ctx, startX + 7 + i * 16, 958, 6.5); ctx.fill(); }
    ctx.textAlign = "left";
    ctx.fillText(rj, startX + gemW + 10, 966);
    ctx.textAlign = "center";
    ctx.font = "600 13px " + F_NUM;
    ctx.fillStyle = "rgba(236, 209, 127, .6)";
    spaced(ctx, RAR[rar].en + " · " + set.en + " · MMXXVI", W / 2, 995, 4);

    // レア度の仕上げ
    if (rar === "legend") holo(ctx, seed);
    else if (rar === "rare") stars(ctx, seed, 9, false);

    ctx.restore();
    // 外周の細い縁
    ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 2;
    rr(ctx, 1, 1, W - 2, H - 2, 34); ctx.stroke();
    canvas.dataset.photo = src ? "1" : "0";
    return canvas;
  }

  function toBlob(canvas, type, q) {
    return new Promise((res, rej) => {
      try {
        if (canvas.toBlob) canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), type || "image/png", q);
        else {
          const url = canvas.toDataURL(type || "image/png", q);
          const [head, b64] = url.split(",");
          const bin = atob(b64), buf = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
          res(new Blob([buf], { type: (head.match(/data:([^;]+)/) || [])[1] || "image/png" }));
        }
      } catch (e) { rej(e); }
    });
  }

  function fileName(card) {
    const no = String(card.no || 0).padStart(2, "0");
    const nm = String(card.name || "カード").replace(/[\\/:*?"<>|\s]+/g, "").slice(0, 40) || "カード";
    return "蛙チョコカード-No" + no + "-" + nm + ".png";
  }

  /* 画像で保存。戻り値 "shared" | "downloaded" | "opened" | "cancelled" | "failed" */
  async function save(card, opts) {
    opts = opts || {};
    let canvas = opts.canvas;
    if (!canvas) canvas = await render(card, { width: W });
    const blob = await toBlob(canvas);
    const name = fileName(card);
    const title = "蛙チョコカード「" + (card.name || "") + "」";
    let file = null;
    try { file = new File([blob], name, { type: "image/png" }); } catch (e) {}
    const nav = G.navigator;
    if (!opts.noShare && file && nav && nav.canShare && nav.share) {
      let can = false;
      try { can = nav.canShare({ files: [file] }); } catch (e) {}
      if (can) {
        try { await nav.share({ files: [file], title }); return "shared"; }
        catch (e) { if (e && e.name === "AbortError") return "cancelled"; /* ほかは下の方法へ */ }
      }
    }
    const url = URL.createObjectURL(blob);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    try {
      const a = G.document.createElement("a");
      if ("download" in a) {
        a.href = url; a.download = name; a.rel = "noopener";
        G.document.body.appendChild(a); a.click(); a.remove();
        return "downloaded";
      }
    } catch (e) {}
    try { const w = G.open(url, "_blank"); if (w) return "opened"; } catch (e) {}
    return "failed";
  }
  /* 共有の画面（1 回に 1 枚）が使えるか */
  function canShareFiles() {
    const nav = G.navigator;
    if (!nav || !nav.canShare || !nav.share) return false;
    try { return nav.canShare({ files: [new File([new Blob(["x"], { type: "image/png" })], "x.png", { type: "image/png" })] }); }
    catch (e) { return false; }
  }

  G.HP_CARDART = { render, toBlob, save, fileName, sourceOf, canShareFiles, fontsReady, W, H };
})();
