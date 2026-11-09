const ACTIONS = new Map([
  ["阅读", "reading"],
  ["学习", "reading"],
  ["阅读学习", "reading"],
  ["写小故事", "writing"],
  ["画画写日记", "writing"],
  ["整理房间", "cleaning"],
  ["照顾小植物", "tending"],
  ["刷手机", "phone"],
  ["做饭吃饭", "eating"],
  ["做小点心", "eating"],
  ["午睡", "sleeping"],
  ["睡觉", "sleeping"],
  ["睡觉休息", "sleeping"],
  ["休息发呆", "resting"],
  ["听音乐", "resting"],
  ["看虚拟电影", "resting"],
  ["玩小游戏", "phone"],
  ["散步", "outside"],
  ["跑步", "outside"],
]);

const EXPRESSIONS = {
  smug: ["得意"],
  surprised: ["惊讶", "震惊"],
  sad: [
    "难过",
    "失落",
    "委屈",
    "孤单",
    "沮丧",
    "失望",
    "遗憾",
    "内疚",
    "后悔",
    "羞愧",
  ],
  angry: ["生气", "烦躁", "不满", "懊恼"],
  worried: ["害怕", "不安", "紧张", "担忧"],
  affection: [
    "喜爱",
    "亲近",
    "想念",
    "依恋",
    "关切",
    "心疼",
    "害羞",
    "受宠若惊",
    "感动",
    "感激",
  ],
  curious: ["好奇", "期待", "兴奋", "困惑", "纠结"],
  happy: ["欣喜", "愉快", "满足", "自豪"],
};

function fraction(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value / 100))
    : null;
}

export function derivePresentation(snapshot, now = Date.now() / 1000) {
  if (
    !Number.isFinite(snapshot?.generated_at) ||
    snapshot.generated_at > now + 60
  ) {
    throw new Error("invalid_snapshot_time");
  }
  const companion = snapshot.companion || {};
  const physical = fraction(companion.energy?.physical);
  const mental = fraction(companion.energy?.mental);
  const energy =
    physical === null || mental === null ? null : (physical + mental) / 2;
  const activity = companion.activity;
  const started = activity?.started_at ?? activity?.started;
  const ended = activity?.ends_at ?? activity?.ends;
  const validActivity =
    activity &&
    Number.isFinite(started) &&
    started <= snapshot.generated_at &&
    (!activity.status || ["active", "paused"].includes(activity.status)) &&
    (!activity.subject || activity.subject === "companion");
  const scene = snapshot.daily_scene?.scene || companion.day_scene;
  const validScene = scene &&
    (!scene.subject || scene.subject === "companion") &&
    Number.isFinite(scene.occurred) && scene.occurred <= snapshot.generated_at &&
    ["started", "progress", "completed"].includes(scene.stage);
  const activityName = validActivity
    ? activity.activity || activity.name || ""
    : validScene ? scene.activity || "" : "";
  const action = ACTIONS.get(activityName) || "idle";
  const sceneMatches = validScene && scene.activity === activityName &&
    (!validActivity || scene.occurred >= started);
  const location = sceneMatches ? scene.fields?.location || "" : "";
  const locationType = snapshot.home_state?.presence;
  const explicitPresence = ["home", "away"].includes(locationType) &&
    snapshot.home_state.subject === "companion" &&
    Number.isFinite(snapshot.home_state.occurred) &&
    snapshot.home_state.occurred <= snapshot.generated_at &&
    snapshot.home_state.occurred >= (validActivity ? started : scene?.occurred || 0);
  const completed = !validActivity && validScene && scene.stage === "completed";
  const homeLocations = snapshot.home_locations || ["小屋", "云端小屋", "家里", "家中", "家"];
  const locationUnconfirmed = Boolean(location) && !homeLocations.includes(location);
  const presence = explicitPresence ? locationType :
    action === "outside" ? completed ? "unknown" : "away" :
      action !== "idle" && !locationUnconfirmed ? "home" : "unknown";
  const presenceText = presence === "away"
    ? activityName === "散步" ? "出去散步了" : activityName === "跑步" ? "出去跑步了" : "外出了"
    : presence === "unknown" ? completed ? `${activityName}结束，位置待确认` : "位置待同步"
      : activityName || "在小屋里";
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: snapshot.timezone || "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date(now * 1000));
  } catch {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date(now * 1000));
  }
  const hour = Number(parts.find(part => part.type === "hour").value);
  const minute = Number(parts.find(part => part.type === "minute").value);
  const active = (snapshot.mood?.labels || [])
    .filter((item) => Number.isFinite(item.intensity) && item.intensity > 0.02)
    .sort((a, b) => b.intensity - a.intensity);
  const leading = active[0];
  const expression =
    Object.entries(EXPRESSIONS).find(([, labels]) =>
      labels.includes(leading?.label),
    )?.[0] || "relaxed";
  return {
    action: completed ? "idle" : action,
    activityName: activityName || "当前活动未记录",
    presence,
    presenceText,
    location,
    period: hour >= 19 || hour < 6 ? "night" : hour >= 17 ? "dusk" : hour < 10 ? "morning" : "day",
    hour,
    minute,
    expression,
    expressionStrength: Math.min(1, leading?.intensity || 0),
    leadingLabel: leading?.label || ((snapshot.mood?.labels || []).some(item => Number.isFinite(item.intensity)) ? "平静" : "未记录"),
    emotions: active.slice(0, 3),
    energy,
    physical,
    mental,
    contact: fraction(companion.contact_desire),
    awaitingUpdate: Boolean(
      validActivity && Number.isFinite(ended) && ended < now,
    ),
    stale: now - snapshot.generated_at > 1200,
    generatedAt: snapshot.generated_at,
  };
}
