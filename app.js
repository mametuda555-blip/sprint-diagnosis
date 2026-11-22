import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

// Firebase 初期化
const firebaseConfig = {
  apiKey: "AIzaSyA3j5xxXks-SqWlmyXION_oZfLQ0uW9AXg",
  authDomain: "m-analysis-b6deb.firebaseapp.com",
  databaseURL: "https://m-analysis-b6deb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "m-analysis-b6deb",
  storageBucket: "m-analysis-b6deb.firebasestorage.app",
  messagingSenderId: "717075517863",
  appId: "1:717075517863:web:b30ce25e9cc2fa3b052682",
  measurementId: "G-3F1H0WF87Y"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Analytics 初期化（広告ブロッカー等でもエラーで止まらないよう安全に処理）
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (err) {
  console.warn("Analytics skipped:", err);
}

const trackEvent = (eventName, params = {}) => {
  if (!analytics) return;
  try {
    logEvent(analytics, eventName, params);
  } catch (err) {
    // 無視
  }
};

// タイプ定義（.jpg対応済み）
const TYPE_DATA = {
  rocket: {
    name: "🚀 ロケットスタート型",
    catchcopy: "最初の30mで勝負を決める、爆発加速スプリンター",
    description: "スタートからの立ち上がりと加速力が最大の武器。序盤でリードを奪い、そのまま逃げ切る展開が得意なタイプです。",
    image: "images/rocket.jpg",
    color: "#fb923c"
  },
  top_speed: {
    name: "⚡ トップスピード特化型",
    catchcopy: "中盤の伸びが異次元。最高速でぶち抜くスプリンター",
    description: "30m〜60mのトップスピード局面が圧倒的な強み。一度スピードに乗れば、並走するライバルを一気に置き去りにできるタイプです。",
    image: "images/top_speed.jpg",
    color: "#38bdf8"
  },
  stamina: {
    name: "🔥 後半粘り型",
    catchcopy: "60mからが本番。最後で差し切る驚異のスピード維持型",
    description: "後半の減速が極めて少ないスタミナとリラックス能力が武器。終盤に周りが失速する中、グングン追い上げられるタイプです。",
    image: "images/stamina.jpg",
    color: "#f43f5e"
  },
  balance: {
    name: "⚖️ バランス型",
    catchcopy: "弱点ゼロの完成度。全局面で戦えるオールラウンダー",
    description: "加速・最高速・維持のすべてが高水準でまとまっています。レース展開に左右されにくく、安定した記録を出せるタイプです。",
    image: "images/balance.jpg",
    color: "#4ade80"
  }
};

// 課題別アドバイス
const ADVICE_DATA = {
  phase1: {
    title: "伸びしろは「スタート〜1次加速」にあり",
    text: "最高速や後半に強みがある分、最初の30mを改善するだけでタイムが一気に跳ね上がります。低い前傾姿勢と、地面を強く後ろに押す意識を強化しましょう。",
    menus: ["10m〜30mのSDダッシュ", "坂ダッシュ・スレッド走", "立ち幅跳び・立ち五段跳び"]
  },
  phase2: {
    title: "伸びしろは「最高速度の引き上げ」にあり",
    text: "加速からトップスピードへの切り替えがカギです。30m以降でしっかり体を起こし、接地時間を短くして反発をもらう走りを身につけると全体が底上げされます。",
    menus: ["フライング30m（助走20m＋全力30m）", "ミニハードル走", "下り坂走（オーバースピード）"]
  },
  phase3: {
    title: "伸びしろは「60m以降の減速防止」にあり",
    text: "前半〜中盤で良いスピードが出ている分、後半の力みによる失速がもったいない状態です。肩や顎の力を抜き、腰の高さを保ったまま維持する練習が効果的です。",
    menus: ["80m〜120mのリラックス走（90〜95%）", "150mスピード持久走", "イン＆アウト走（力みを抜く練習）"]
  },
  balance: {
    title: "次のステージへは「武器を1つ作る」のが近道",
    text: "すでに理想的なレース配分で走れています。ここから目標タイムを突破するには、まずは最高速など1つの局面に絞って上限を引き上げるのが効果的です。",
    menus: ["フライング30m（スピード上限アップ）", "ウエイト・プライオメトリクスでの出力強化"]
  }
};

// スコア50の基準線を描画するChart.jsプラグイン
const line50Plugin = {
  id: "line50",
  afterDatasetsDraw(chart) {
    const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
    const xPos = x.getPixelForValue(50);
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.moveTo(xPos, top);
    ctx.lineTo(xPos, bottom);
    ctx.stroke();
    ctx.restore();
  }
};

let chartInstance = null;

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const round2 = (val) => Math.round(val * 100) / 100;

document.getElementById("diagnosis-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("error-msg");
  errorEl.classList.add("hidden");

  // 入力値取得
  const t30 = parseFloat(document.getElementById("t30").value);
  const t60 = parseFloat(document.getElementById("t60").value);
  const t100 = parseFloat(document.getElementById("t100").value);
  const target100 = parseFloat(document.getElementById("target100").value);
  const timing30_60 = document.getElementById("timing30_60").value;
  const start30_60 = document.getElementById("start30_60").value;
  const timing100 = document.getElementById("timing100").value;
  const wind100 = parseFloat(document.getElementById("wind100").value) || 0;

  // 補正値計算（自己計測: 0.00s / 計測員あり: +0.24s / 動き出し: +0.15s）
  const offset30_60 = (timing30_60 === "manual" ? 0.24 : 0) + (start30_60 === "self" ? 0.15 : 0);
  const offset100 = (timing100 === "manual" ? 0.24 : 0) + (0.05 * wind100);

  const n30 = round2(t30 + offset30_60);
  const n60 = round2(t60 + offset30_60);
  const n100 = round2(t100 + offset100);

  // 整合性チェック
  if (!(n30 < n60 && n60 < n100)) {
    errorEl.textContent = "30m < 60m < 100m になるようにタイムを入力してください。";
    errorEl.classList.remove("hidden");
    return;
  }

  // 区間タイム
  const actual1 = n30;
  const actual2 = n60 - n30;
  const actual3 = n100 - n60;

  // 標準タイム
  const std1 = 0.30 * n100 + 0.80;
  const std2 = 0.30 * n100 - 0.35;
  const std3 = 0.40 * n100 - 0.45;

  // スコア算出 (0-100)
  const score1 = Math.round(clamp(50 + ((std1 - actual1) / std1) * 500, 0, 100));
  const score2 = Math.round(clamp(50 + ((std2 - actual2) / std2) * 500, 0, 100));
  const score3 = Math.round(clamp(50 + ((std3 - actual3) / std3) * 500, 0, 100));

  // タイプ判定
  let typeKey = "balance";
  if (score1 < 47 || score1 > 53 || score2 < 47 || score2 > 53 || score3 < 47 || score3 > 53) {
    if (score1 >= score2 && score1 >= score3) typeKey = "rocket";
    else if (score2 >= score1 && score2 >= score3) typeKey = "top_speed";
    else typeKey = "stamina";
  }

  // 課題判定（最小スコア）
  let adviceKey = "balance";
  if (typeKey !== "balance") {
    if (score1 <= score2 && score1 <= score3) adviceKey = "phase1";
    else if (score2 <= score1 && score2 <= score3) adviceKey = "phase2";
    else adviceKey = "phase3";
  }

  // 画面描画
  renderResult({
    t100, n30, n60, n100, actual3, target100, offset30_60,
    score1, score2, score3, typeKey, adviceKey
  });

  // Analytics イベント送信
  trackEvent("diagnosis_complete", { sprint_type: typeKey });

  // Firebaseへ匿名保存（ルール準拠）
  try {
    await push(ref(db, "diagnostics"), {
      createdAt: serverTimestamp(),
      modelVersion: "v1.1",
      raw: {
        t30, t60, t100, target100,
        timing30_60, start30_60, timing100, wind100
      },
      normalized: {
        t30: n30, t60: n60, t100: n100
      },
      result: {
        score1, score2, score3, type: typeKey
      }
    });
  } catch (err) {
    console.warn("Firebase save skipped:", err);
  }
});

function renderResult(data) {
  const typeInfo = TYPE_DATA[data.typeKey];
  const adviceInfo = ADVICE_DATA[data.adviceKey];

  document.getElementById("type-name").textContent = typeInfo.name;
  document.getElementById("type-catchcopy").textContent = typeInfo.catchcopy;
  document.getElementById("type-desc").textContent = typeInfo.description;
  document.getElementById("type-image").src = typeInfo.image;

  // 入力タイムをそのまま表示（補正がある場合のみ併記）
  const timeText = data.t100 !== data.n100
    ? `100m: ${data.t100.toFixed(2)}s (換算:${data.n100.toFixed(2)}s) → 目標: ${data.target100.toFixed(2)}s`
    : `100m: ${data.t100.toFixed(2)}s → 目標: ${data.target100.toFixed(2)}s`;
  document.getElementById("card-summary-time").textContent = timeText;

  // グラフ描画
  const ctx = document.getElementById("scoreChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["前半 (0-30m)", "中盤 (30-60m)", "後半 (60-100m)"],
      datasets: [{
        data: [data.score1, data.score2, data.score3],
        backgroundColor: [typeInfo.color, typeInfo.color, typeInfo.color],
        borderRadius: 6,
        barThickness: 22
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          min: 0,
          max: 100,
          grid: { color: "rgba(255,255,255,0.08)" },
          ticks: {
            stepSize: 25,
            color: "#94a3b8"
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: "#f1f5f9", font: { size: 12, weight: "bold" } }
        }
      }
    },
    plugins: [line50Plugin]
  });

  // 目標テーブル描画
  const target30 = 0.30 * data.target100 + 0.80;
  const target60 = 0.60 * data.target100 + 0.45;
  const targetLast = 0.40 * data.target100 - 0.45;

  const rows = [
    { label: "30m", now: data.n30, target: target30, practice: target30 - data.offset30_60 },
    { label: "60m", now: data.n60, target: target60, practice: target60 - data.offset30_60 },
    { label: "後半(40m)", now: data.actual3, target: targetLast, practice: null }
  ];

  const tbody = document.getElementById("target-tbody");
  tbody.innerHTML = rows.map(r => {
    const diff = r.target - r.now;
    const diffStr = `${diff > 0 ? "+" : ""}${diff.toFixed(2)}s`;
    const diffClass = diff < 0 ? "diff-minus" : "diff-plus";
    const pracStr = r.practice !== null ? `${r.practice.toFixed(2)}s` : "—";
    return `
      <tr>
        <td><strong>${r.label}</strong></td>
        <td>${r.now.toFixed(2)}s</td>
        <td>${r.target.toFixed(2)}s</td>
        <td class="${diffClass}">${diffStr}</td>
        <td>${pracStr}</td>
      </tr>
    `;
  }).join("");

  // アドバイス描画
  document.getElementById("advice-title").textContent = adviceInfo.title;
  document.getElementById("advice-text").textContent = adviceInfo.text;
  document.getElementById("advice-menus").innerHTML =
    adviceInfo.menus.map(m => `<li>${m}</li>`).join("");

  // X・Threadsシェアリンク更新
  const rawShareText = `100mスプリント診断の結果は【${typeInfo.name}】でした！\n前半:${data.score1}点 / 中盤:${data.score2}点 / 後半:${data.score3}点\n#陸上 #100m #スプリント診断`;
  const shareText = encodeURIComponent(rawShareText);
  const shareUrl = encodeURIComponent(window.location.href);

  document.getElementById("btn-share-x").href =
    `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;

  document.getElementById("btn-share-threads").href =
    `https://www.threads.net/intent/post?text=${encodeURIComponent(rawShareText + "\n" + window.location.href)}`;

  // 表示＆スクロール
  const resultSec = document.getElementById("result-section");
  resultSec.classList.remove("hidden");
  resultSec.scrollIntoView({ behavior: "smooth" });
}

// X・Threads クリック計測
document.getElementById("btn-share-x").addEventListener("click", () => {
  trackEvent("share_click", { platform: "x" });
});

document.getElementById("btn-share-threads").addEventListener("click", () => {
  trackEvent("share_click", { platform: "threads" });
});

// 診断カードを画像保存
document.getElementById("btn-save-img").addEventListener("click", async () => {
  trackEvent("save_image");
  const card = document.getElementById("share-card");
  const canvas = await html2canvas(card, {
    backgroundColor: "#0b1020",
    scale: 2,
    useCORS: true
  });
  const link = document.createElement("a");
  link.download = "sprint-diagnosis.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// Instagramでシェア
document.getElementById("btn-share-ig").addEventListener("click", async (e) => {
  trackEvent("share_click", { platform: "instagram" });
  const btn = e.currentTarget;
  const originalText = btn.textContent;
  btn.textContent = "画像を作成中...";
  btn.disabled = true;

  try {
    const card = document.getElementById("share-card");
    const canvas = await html2canvas(card, {
      backgroundColor: "#0b1020",
      scale: 2,
      useCORS: true
    });

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const file = new File([blob], "sprint-diagnosis.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "100mスプリント診断",
          text: "100mスプリント診断の結果！ #陸上 #100m"
        });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }

    const link = document.createElement("a");
    link.download = "sprint-diagnosis.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    alert("診断カードの画像を保存しました！Instagramアプリを開いてストーリーズや投稿に選択してください。");
  } catch (err) {
    alert("画像の作成に失敗しました。スクリーンショットで保存してください。");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
});
