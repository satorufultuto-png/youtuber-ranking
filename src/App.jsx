import { useState } from "react";

const STORAGE_KEY = "youtuber_ranking_v5";
const LAST_WEEK_KEY = "youtuber_lastweek_v5";
const IP_KEY = "youtuber_ip_limit_v5";
const MAX_COMMENT = 100;

const GENRES = [
  { id: "all", label: "総合" },
  { id: "car", label: "車・バイク" },
  { id: "gourmet", label: "グルメ・料理" },
  { id: "fashion", label: "ファッション・美容" },
  { id: "invest", label: "投資・お金" },
  { id: "pet", label: "ペット・動物" },
  { id: "sports", label: "スポーツ" },
  { id: "music", label: "音楽・演奏" },
  { id: "vlog", label: "くたばん・日常" },
  { id: "other", label: "その他" },
];

const TIERS = [
  { id: "egg",     label: "たまご部門",  desc: "〜100人",         color: "#c47d00", accent: "#fdf6e3", border: "#e8d49a" },
  { id: "sprout",  label: "新芽部門",    desc: "101〜1,000人",    color: "#cc0000", accent: "#fff0f0", border: "#ffbbbb" },
  { id: "growing", label: "成長中部門",  desc: "1,001〜10,000人", color: "#aa0000", accent: "#ffe8e8", border: "#ffaaaa" },
];

const RED = "#ff0000";
const RED_DARK = "#cc0000";
const RED_LIGHT = "#fff0f0";
const RED_BORDER = "#ffcccc";

function getTier(subs) {
  if (subs <= 100) return "egg";
  if (subs <= 1000) return "sprout";
  return "growing";
}

function getTierLabel(id) {
  return TIERS.find(t => t.id === id)?.label || "";
}

function getWeekKey() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

function isSunday() { return new Date().getDay() === 0; }

function getLastWeekLabel() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const lastMonday = new Date(monday); lastMonday.setDate(monday.getDate() - 7);
  const lastSunday = new Date(monday); lastSunday.setDate(monday.getDate() - 1);
  const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(lastMonday)} 〜 ${fmt(lastSunday)}`;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { weekKey: getWeekKey(), channels: {} };
    const data = JSON.parse(raw);
    if (data.weekKey !== getWeekKey()) {
      localStorage.setItem(LAST_WEEK_KEY, JSON.stringify({ weekKey: data.weekKey, channels: data.channels }));
      return { weekKey: getWeekKey(), channels: {} };
    }
    return data;
  } catch { return { weekKey: getWeekKey(), channels: {} }; }
}

function loadLastWeek() {
  try { return JSON.parse(localStorage.getItem(LAST_WEEK_KEY) || "null"); }
  catch { return null; }
}

function loadIpData() {
  try { return JSON.parse(localStorage.getItem(IP_KEY) || "{}"); }
  catch { return {}; }
}

const medals = ["🥇", "🥈", "🥉"];

const inputStyle = {
  background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8,
  padding: "12px 16px", color: "#222", fontSize: 15, outline: "none",
  width: "100%", fontFamily: "inherit",
};

const tabStyle = (active) => ({
  flex: 1, padding: "10px", borderRadius: "8px 8px 0 0", cursor: "pointer",
  border: "none", borderBottom: active ? `3px solid ${RED}` : "3px solid transparent",
  background: "none", color: active ? RED_DARK : "#aaa",
  fontWeight: active ? 900 : 400, fontSize: 14, fontFamily: "inherit",
  transition: "all 0.15s",
});

export default function App() {
  const [data, setData] = useState(loadData);
  const [lastWeek] = useState(loadLastWeek);
  const [handle, setHandle] = useState("");
  const [subCount, setSubCount] = useState("");
  const [genre, setGenre] = useState("");
  const [comment, setComment] = useState("");
  const [activeTier, setActiveTier] = useState("sprout");
  const [activeGenre, setActiveGenre] = useState("all");
  const [activeSection, setActiveSection] = useState("this");
  const [expandedChannel, setExpandedChannel] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [shake, setShake] = useState(false);

  const sunday = isSunday();
  const weekKey = getWeekKey();

  // 部門×ジャンルでランキング取得
  const getRanked = (channels, tierId, genreId) =>
    Object.entries(channels || {})
      .filter(([, info]) => getTier(info.subs) === tierId)
      .filter(([, info]) => genreId === "all" || info.genre === genreId)
      .sort((a, b) => b[1].votes - a[1].votes)
      .slice(0, 10);

  // 部門内での順位計算（ジャンル問わず）
  const getRankInTier = (channels, targetHandle) => {
    const tier = getTier(channels[targetHandle]?.subs || 0);
    const sorted = Object.entries(channels || {})
      .filter(([, info]) => getTier(info.subs) === tier)
      .sort((a, b) => b[1].votes - a[1].votes);
    const idx = sorted.findIndex(([ch]) => ch === targetHandle);
    return idx === -1 ? null : { rank: idx + 1, total: sorted.length };
  };

  const ranked = getRanked(data.channels, activeTier, activeGenre);
  const lastRanked = lastWeek ? getRanked(lastWeek.channels, activeTier, activeGenre) : [];

  function triggerError(msg) {
    setError(msg); setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  function handleSearch() {
    let q = searchQuery.trim();
    if (!q) return;
    if (!q.startsWith("@")) q = "@" + q;
    const info = data.channels[q];
    if (!info) { setSearchResult({ found: false, handle: q }); return; }
    const rankInfo = getRankInTier(data.channels, q);
    setSearchResult({ found: true, handle: q, info, rankInfo });
  }

  function handleSubmit() {
    setError(""); setSuccess("");
    let h = handle.trim();
    if (!h) return triggerError("@handleを入力してください");
    if (!h.startsWith("@")) h = "@" + h;
    if (!/^@[\w.-]+$/.test(h)) return triggerError("正しい@handle形式で（例: @channelname）");
    const subs = parseInt(subCount, 10);
    if (isNaN(subs) || subs < 0) return triggerError("登録者数を入力してください");
    if (subs > 10000) return triggerError("登録者10,000人以下のチャンネルのみ対象です");
    if (!genre) return triggerError("ジャンルを選択してください");
    if (comment.length > MAX_COMMENT) return triggerError(`コメントは${MAX_COMMENT}文字以内にしてください`);

    const ipData = loadIpData();
    const todayKey = new Date().toISOString().split("T")[0];
    if (ipData[todayKey]?.includes(h)) return triggerError("このチャンネルは本日すでに投稿済みです");

    const newData = { ...data, channels: { ...data.channels } };
    if (!newData.channels[h]) newData.channels[h] = { votes: 0, subs, genre, comments: [] };
    newData.channels[h].votes += 1;
    newData.channels[h].subs = subs;
    newData.channels[h].genre = genre;
    if (!newData.channels[h].comments) newData.channels[h].comments = [];
    if (comment.trim()) {
      newData.channels[h].comments.push({ text: comment.trim(), date: new Date().toLocaleDateString("ja-JP") });
    }
    setData(newData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));

    const newIpData = { ...ipData };
    if (!newIpData[todayKey]) newIpData[todayKey] = [];
    newIpData[todayKey].push(h);
    localStorage.setItem(IP_KEY, JSON.stringify(newIpData));

    setActiveTier(getTier(subs));
    setActiveGenre("all");
    setActiveSection("this");
    setHandle(""); setSubCount(""); setGenre(""); setComment("");
    setSuccess(`${h} を応援しました！`);
    setTimeout(() => setSuccess(""), 3000);
  }

  const genreLabel = (id) => GENRES.find(g => g.id === id)?.label || "";

  const tierPreview = (subs) => {
    if (subs <= 100)   return { text: "たまご部門に投稿されます",  bg: "#fdf6e3", border: "#e8d49a", color: "#c47d00" };
    if (subs <= 1000)  return { text: "新芽部門に投稿されます",    bg: RED_LIGHT, border: RED_BORDER, color: RED_DARK };
    if (subs <= 10000) return { text: "成長中部門に投稿されます",  bg: "#ffe8e8", border: "#ffaaaa", color: "#aa0000" };
    return { text: "10,000人以下のチャンネルのみ対象です", bg: "#fff0f0", border: "#ffbbbb", color: "#cc0000" };
  };

  const RankingList = ({ items, emptyMsg }) => (
    items.length === 0 ? (
      <div style={{ textAlign: "center", padding: "40px 20px", color: "#ccc", fontSize: 14, border: "1px dashed #e5e5e5", borderRadius: 10 }}>{emptyMsg}</div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map(([ch, info], i) => {
          const hasComments = info.comments && info.comments.length > 0;
          const isExpanded = expandedChannel === ch;
          return (
            <div key={ch}>
              <div style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 15px",
                background: i === 0 ? RED_LIGHT : i % 2 === 0 ? "#f9f9f9" : "#fff",
                border: i === 0 ? `1px solid ${RED_BORDER}` : "1px solid #f0f0f0",
                borderRadius: isExpanded && hasComments ? "10px 10px 0 0" : 10,
                transition: "box-shadow 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.07)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
              >
                <div style={{ width: 30, textAlign: "center", fontSize: i < 3 ? 20 : 13, color: i < 3 ? undefined : "#ccc", fontWeight: 700, flexShrink: 0 }}>
                  {i < 3 ? medals[i] : i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={`https://www.youtube.com/${ch}`} target="_blank" rel="noopener noreferrer" style={{
                    color: i === 0 ? RED_DARK : "#0f0f0f", textDecoration: "none",
                    fontSize: 14, fontWeight: 700, fontFamily: "monospace", letterSpacing: 0.3,
                  }}>{ch}</a>
                  <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center", flexWrap: "wrap" }}>
                    {activeGenre === "all" && (
                      <span style={{ fontSize: 11, color: RED_DARK, fontWeight: 600, background: RED_LIGHT, border: `1px solid ${RED_BORDER}`, borderRadius: 10, padding: "2px 8px" }}>{genreLabel(info.genre)}</span>
                    )}
                    <span style={{ fontSize: 11, color: "#aaa" }}>登録者 {info.subs.toLocaleString()}人</span>
                    {hasComments && (
                      <button onClick={() => setExpandedChannel(isExpanded ? null : ch)} style={{
                        fontSize: 11, color: "#888", background: "#f0f0f0", border: "none",
                        borderRadius: 10, padding: "2px 10px", cursor: "pointer", fontFamily: "inherit",
                      }}>{isExpanded ? "閉じる" : `コメント ${info.comments.length}件`}</button>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: i === 0 ? RED : "#ccc" }}>{info.votes}</div>
                    <div style={{ fontSize: 11, color: "#ccc" }}>票</div>
                  </div>
                  <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${ch} を応援中！登録者${info.subs.toLocaleString()}人の隠れた才能チャンネル。あなたも応援しよう！\nhttps://www.youtube.com/${ch}`)}&hashtags=応援ランキング`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-block", padding: "3px 9px", background: "#000", borderRadius: 20, fontSize: 11, color: "#fff", textDecoration: "none", fontWeight: 700, whiteSpace: "nowrap" }}>
                    X でシェア
                  </a>
                </div>
              </div>

              {isExpanded && hasComments && (
                <div style={{ background: "#fafafa", border: i === 0 ? `1px solid ${RED_BORDER}` : "1px solid #f0f0f0", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {info.comments.map((c, ci) => (
                    <div key={ci} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: RED_LIGHT, border: `1px solid ${RED_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: RED_DARK, flexShrink: 0, fontWeight: 700 }}>応</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}>{c.text}</div>
                        <div style={{ fontSize: 11, color: "#ccc", marginTop: 2 }}>{c.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    )
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f9", fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif", color: "#0f0f0f", margin: 0 }}>

      {/* ヘッダー */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e5e5", padding: "0 20px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <div style={{ maxWidth: 740, margin: "0 auto", padding: "12px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ background: RED, borderRadius: 6, padding: "4px 8px" }}>
              <span style={{ fontSize: 14, color: "#fff" }}>▶</span>
            </div>
            <span style={{ fontWeight: 900, fontSize: 17, color: "#0f0f0f", letterSpacing: -0.5 }}>応援ランキング</span>
          </div>
          <div style={{ padding: "4px 12px", background: RED_LIGHT, border: `1px solid ${RED_BORDER}`, borderRadius: 20, fontSize: 11, color: RED_DARK, fontWeight: 600 }}>
            {sunday ? "本日締め切り！集計中" : `${weekKey} 〜 毎週月曜リセット`}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 740, margin: "0 auto", padding: "24px 20px 80px" }}>

        {/* ヒーローバナー */}
        <div style={{ background: RED, borderRadius: 14, padding: "30px 28px", marginBottom: 20, color: "#fff", textAlign: "center", boxShadow: "0 4px 20px rgba(255,0,0,0.2)" }}>
          <div style={{ fontSize: 11, letterSpacing: 5, opacity: 0.75, marginBottom: 8, textTransform: "uppercase" }}>Weekly Ranking</div>
          <h1 style={{ fontSize: "clamp(22px, 6vw, 40px)", margin: "0 0 8px", fontWeight: 900, lineHeight: 1.15, letterSpacing: -0.5 }}>
            隠れた才能を発見して<br />みんなで応援しよう
          </h1>
          <p style={{ fontSize: 13, opacity: 0.8, margin: 0 }}>登録者10,000人以下限定のYouTuber応援ランキング</p>
        </div>

        {/* チャンネル検索 */}
        <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "18px 22px", marginBottom: 18, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 10, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>チャンネル順位を検索</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="@channelhandle" onKeyDown={e => e.key === "Enter" && handleSearch()}
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={handleSearch} style={{
              background: RED, border: "none", borderRadius: 8, padding: "12px 20px",
              color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            }}
              onMouseEnter={e => e.target.style.background = RED_DARK}
              onMouseLeave={e => e.target.style.background = RED}
            >検索</button>
          </div>
          {searchResult && (
            <div style={{ marginTop: 10 }}>
              {searchResult.found ? (
                <div style={{ padding: "14px 16px", background: RED_LIGHT, border: `1px solid ${RED_BORDER}`, borderRadius: 10 }}>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: RED_DARK, marginBottom: 8 }}>{searchResult.handle}</div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 13, color: "#555" }}>部門：<span style={{ fontWeight: 700, color: RED_DARK }}>{getTierLabel(getTier(searchResult.info.subs))}</span></div>
                    <div style={{ fontSize: 13, color: "#555" }}>部門内順位：<span style={{ fontWeight: 900, fontSize: 18, color: RED }}>{searchResult.rankInfo.rank}位</span><span style={{ fontSize: 11, color: "#aaa" }}> / {searchResult.rankInfo.total}チャンネル中</span></div>
                    <div style={{ fontSize: 13, color: "#555" }}>票数：<span style={{ fontWeight: 700, color: "#333" }}>{searchResult.info.votes}票</span></div>
                    <div style={{ fontSize: 13, color: "#555" }}>登録者：<span style={{ fontWeight: 700, color: "#333" }}>{searchResult.info.subs.toLocaleString()}人</span></div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, borderRadius: 8, padding: "4px 10px", display: "inline-block", background: searchResult.rankInfo.rank <= 10 ? "#e8f7f1" : "#f0f0f0", color: searchResult.rankInfo.rank <= 10 ? "#2a7a50" : "#888" }}>
                    {searchResult.rankInfo.rank <= 10 ? `ランキング表示中（${searchResult.rankInfo.rank}位）` : `現在${searchResult.rankInfo.rank}位（表示は10位まで）`}
                  </div>
                </div>
              ) : (
                <div style={{ padding: "12px 16px", background: "#f9f9f9", border: "1px solid #e5e5e5", borderRadius: 10, fontSize: 13, color: "#aaa" }}>
                  {searchResult.handle} は今週まだ投稿されていません
                </div>
              )}
            </div>
          )}
        </div>

        {/* 投稿フォーム */}
        <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "22px", marginBottom: 18, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 14, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>応援チャンネルを投稿</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@channelhandle" onKeyDown={e => e.key === "Enter" && handleSubmit()} style={inputStyle} />
            <input value={subCount} onChange={e => setSubCount(e.target.value)} placeholder="登録者数（10,000以下）" type="number" min={0} max={10000} style={inputStyle} />
            {subCount && !isNaN(parseInt(subCount)) && (() => { const p = tierPreview(parseInt(subCount)); return <div style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: p.bg, border: `1px solid ${p.border}`, color: p.color }}>{p.text}</div>; })()}
            <div>
              <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8, fontWeight: 600 }}>ジャンルを選択</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {GENRES.filter(g => g.id !== "all").map(g => (
                  <button key={g.id} onClick={() => setGenre(g.id)} style={{
                    padding: "6px 13px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                    border: genre === g.id ? `1px solid ${RED}` : "1px solid #e0e0e0",
                    background: genre === g.id ? RED_LIGHT : "#f9f9f9",
                    color: genre === g.id ? RED_DARK : "#666",
                    fontWeight: genre === g.id ? 700 : 400,
                    transition: "all 0.15s", fontFamily: "inherit",
                  }}>{g.label}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: "#aaa", fontWeight: 600 }}>応援コメント（任意・100文字以内）</div>
                <div style={{ fontSize: 11, color: comment.length > MAX_COMMENT ? RED : "#ccc" }}>{comment.length} / {MAX_COMMENT}</div>
              </div>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="このチャンネルのここが好き！という気持ちを一言どうぞ" rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, fontSize: 14 }} />
            </div>
            <button onClick={handleSubmit} style={{ background: RED, border: "none", borderRadius: 8, padding: "13px", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", letterSpacing: 0.5, fontFamily: "inherit", boxShadow: "0 3px 12px rgba(255,0,0,0.25)", transition: "background 0.15s" }}
              onMouseEnter={e => e.target.style.background = RED_DARK}
              onMouseLeave={e => e.target.style.background = RED}
            >応援する ▶</button>
          </div>
          {error && <div style={{ marginTop: 10, padding: "10px 14px", background: "#fff0f0", border: "1px solid #ffbbbb", borderRadius: 8, fontSize: 13, color: RED_DARK, animation: shake ? "shake 0.4s ease" : "none" }}>⚠ {error}</div>}
          {success && <div style={{ marginTop: 10, padding: "10px 14px", background: RED_LIGHT, border: `1px solid ${RED_BORDER}`, borderRadius: 8, fontSize: 13, color: RED_DARK, fontWeight: 600 }}>{success}</div>}
          <div style={{ marginTop: 10, fontSize: 11, color: "#ccc", lineHeight: 1.8 }}>※ 1日1チャンネルまで投稿可　※ 登録者数は自己申告制</div>
        </div>

        {/* ランキングセクション */}
        <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "22px", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>

          {/* 今週／先週タブ */}
          <div style={{ display: "flex", borderBottom: "1px solid #e5e5e5", marginBottom: 18 }}>
            <button style={tabStyle(activeSection === "this")} onClick={() => setActiveSection("this")}>今週のランキング{sunday && " （集計中）"}</button>
            <button style={tabStyle(activeSection === "last")} onClick={() => setActiveSection("last")}>先週の結果 {lastWeek ? `(${getLastWeekLabel()})` : ""}</button>
          </div>

          {sunday && activeSection === "this" && (
            <div style={{ padding: "14px 16px", marginBottom: 16, background: "#fff8f0", border: "1px solid #ffd0a0", borderRadius: 10, textAlign: "center", fontSize: 14, color: "#c47d00", fontWeight: 700 }}>
              本日は集計中です。結果は明日（月曜0時）に発表されます！
            </div>
          )}

          {/* 部門タブ */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {TIERS.map(t => (
              <button key={t.id} onClick={() => { setActiveTier(t.id); setActiveGenre("all"); }} style={{
                flex: 1, padding: "10px 6px", borderRadius: 10, cursor: "pointer",
                border: activeTier === t.id ? `2px solid ${RED}` : "2px solid #e5e5e5",
                background: activeTier === t.id ? RED_LIGHT : "#f9f9f9",
                color: activeTier === t.id ? RED_DARK : "#aaa",
                transition: "all 0.2s", textAlign: "center", fontFamily: "inherit",
              }}>
                <div style={{ fontSize: 13, marginBottom: 2, fontWeight: 700 }}>{t.label}</div>
                <div style={{ fontSize: 10 }}>{t.desc}</div>
              </button>
            ))}
          </div>

          {/* ジャンルタブ（横スクロール） */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18, overflowX: "auto", paddingBottom: 4 }}>
            {GENRES.map(g => (
              <button key={g.id} onClick={() => setActiveGenre(g.id)} style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                border: activeGenre === g.id ? `1px solid ${RED}` : "1px solid #e0e0e0",
                background: activeGenre === g.id ? RED : "#f9f9f9",
                color: activeGenre === g.id ? "#fff" : "#888",
                fontWeight: activeGenre === g.id ? 700 : 400,
                transition: "all 0.15s", fontFamily: "inherit", flexShrink: 0,
              }}>{g.label}</button>
            ))}
          </div>

          {/* ランキングタイトル */}
          <div style={{ fontSize: 13, fontWeight: 700, color: RED_DARK, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #f0f0f0" }}>
            {TIERS.find(t => t.id === activeTier)?.label} ／ {GENRES.find(g => g.id === activeGenre)?.label}ランキング
          </div>

          {activeSection === "this" ? (
            sunday ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#ccc", fontSize: 14, border: "1px dashed #e5e5e5", borderRadius: 10 }}>
                集計中のため表示できません。先週の結果はタブから確認できます。
              </div>
            ) : (
              <RankingList items={ranked} emptyMsg="まだ投稿がありません" />
            )
          ) : (
            lastWeek
              ? <RankingList items={lastRanked} emptyMsg="先週のデータがありません" />
              : <div style={{ textAlign: "center", padding: "40px 20px", color: "#ccc", fontSize: 14, border: "1px dashed #e5e5e5", borderRadius: 10 }}>先週のデータはまだありません</div>
          )}
        </div>

        {/* 殿堂入りティーザー */}
        <div style={{ marginTop: 16, padding: "14px 20px", background: "#fffbf0", border: "1px dashed #e8d49a", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 16, marginBottom: 4 }}>🏆 殿堂入り</div>
          <div style={{ fontSize: 12, color: "#b07d2a" }}>10,000人を突破したチャンネルはここで称えられます（近日公開）</div>
        </div>

        <div style={{ textAlign: "center", marginTop: 28, color: "#ccc", fontSize: 12 }}>毎週月曜日にランキングリセット</div>
      </div>

      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: #bbb; }
        input:focus, textarea:focus { border-color: ${RED} !important; outline: none; box-shadow: 0 0 0 3px rgba(255,0,0,0.08); }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
        body { margin: 0; }
        ::-webkit-scrollbar { height: 4px; } ::-webkit-scrollbar-track { background: #f0f0f0; } ::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }
      `}</style>
    </div>
  );
}
