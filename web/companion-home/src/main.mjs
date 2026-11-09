import "./style.css";
import { createRoom } from "./room.mjs";
import { derivePresentation } from "./state.mjs";

const $ = (id) => document.getElementById(id);
let snapshot, presentation, config, room, activeRequest, timer;
const titles = {
  mood: "心情",
  energy: "精力",
  contact: "想联系你",
  life: "日常",
  memory: "记忆",
  people: "关系",
  switches: "开关",
  reading: "阅读与成长",
  about: "关于",
  reference: "角色三视图",
};
const glyphs = {
  mood: "◡",
  energy: "↟",
  contact: "♡",
  life: "⌂",
  memory: "▤",
  people: "♧",
  switches: "⚙",
  reading: "▥",
};

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function value(number) {
  return Number.isFinite(number) ? Math.round(number).toString() : "—";
}
function time(timestamp) {
  if (!Number.isFinite(timestamp)) return "未记录";
  return new Date(timestamp * 1000).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: snapshot.timezone || "Asia/Shanghai",
  });
}
function row(label, text) {
  const line = node("div", undefined, "detail-row");
  line.append(node("span", label), node("strong", text ?? "未记录"));
  $("detail-body").append(line);
}
function detail(key) {
  $("detail-title").textContent = titles[key] || key;
  $("detail-body").replaceChildren();
  if (!snapshot) return;
  if (key === "reference") {
    const image = node("img", undefined, "reference-image");
    image.src = config.referenceUrl;
    image.alt = "主人提供的角色正面、侧面与背面参考";
    $("detail-body").append(image);
  } else if (key === "mood") {
    for (const item of (snapshot.mood?.labels || [])
      .filter((item) => Number.isFinite(item.intensity))
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 48)) {
      row(item.label, Math.round(item.intensity * 100) + "%");
    }
    const stickerUrl = config.stickers?.[presentation.expression] || config.stickerUrl;
    if (stickerUrl) {
      const image = node("img", undefined, "reference-image");
      image.src = stickerUrl;
      image.alt = "当前心情表情包";
      $("detail-body").append(image);
    }
  } else if (key === "energy") {
    row(
      "身体精力",
      value(
        presentation.physical === null ? null : presentation.physical * 100,
      ),
    );
    row(
      "精神精力",
      value(presentation.mental === null ? null : presentation.mental * 100),
    );
    row("当前活动", presentation.activityName);
  } else if (key === "contact") {
    row("联系欲望", value(snapshot.companion?.contact_desire));
    for (const item of (snapshot.companion?.pending_expectations || []).slice(
      0,
      8,
    ))
      row(item.kind || "期待", item.summary || item.description || item.topic || "待回应");
  } else if (key === "life") {
    row("正在做", presentation.activityName);
    row(
      "当前阶段",
      snapshot.daily_scene?.scene?.stage ||
        snapshot.companion?.day_scene?.stage,
    );
    row(
      "地点",
      snapshot.daily_scene?.scene?.fields?.location ||
        snapshot.companion?.day_scene?.fields?.location,
    );
    row("状态时间", time(snapshot.generated_at));
    for (const item of (snapshot.activity_project?.visible_stages || []).slice(
      -8,
    ))
      row(time(item.occurred_at || item.occurred), item.description);
    for (const item of (snapshot.daily_scene?.execution || []).slice(0, 12)) {
      const states = { planned: "计划", waiting: "等待开始", active: "进行中", paused: "暂停", completed: "完成", missed: "错过", withdrawn: "撤销", awaiting_plan: "等待安排" };
      row(time(item.at), `${item.activity} · ${states[item.status] || item.status}`);
    }
    for (const item of (snapshot.life || []).slice(0, 12))
      row(time(item.occurred), item.description || item.activity);
  } else if (key === "memory") {
    row("记忆", value(snapshot.counts?.memories));
    row("原始事件", value(snapshot.counts?.source_events));
    row("摘要", value(snapshot.counts?.ct_summary));
    for (const item of snapshot.backup || []) row(time(item.at), item.status);
    for (const item of snapshot.summaries || []) row(item.key || "摘要", item.content);
  } else if (key === "people") {
    for (const person of (snapshot.people || []).slice(0, 100))
      row(
        person.name,
        "好感 " + value(person.affection) + " · 信任 " + value(person.trust),
      );
    for (const person of snapshot.people || []) {
      const score = person.affection;
      const level = typeof score !== "number" ? "尚未评估" : score >= 85 ? "很亲近" : score >= 65 ? "亲近" : score >= 45 ? "熟悉" : score >= 25 ? "有些距离" : "疏远";
      row(`${person.name} · ${level}`, `熟悉 ${value(person.familiarity)}${person.note ? ' · ' + person.note : ''}`);
    }
  } else if (key === "switches") {
    const settingsNames = { auto_memes: "自动查梗", banter_enabled: "主动串人", banter_level: "串子程度", counterattack_enabled: "反击", self_learning: "自主学习", emotion_gain: "情绪影响值", meme_sync_enabled: "梗库同步" };
    for (const [name, setting] of Object.entries(
      snapshot.expression_settings?.values || {},
    ))
      row(
        settingsNames[name] || name,
        typeof setting === "boolean"
          ? setting
            ? "开启"
            : "关闭"
          : String(setting),
      );
    row(
      "普通表情概率",
      Number.isFinite(snapshot.sticker_policy?.base_probability)
        ? value(snapshot.sticker_policy.base_probability * 100) + "%"
        : null,
    );
    row("刷手机比例", Number.isFinite(snapshot.life_routine?.phone_probability) ? value(snapshot.life_routine.phone_probability * 100) + "%" : null);
    row("生活琐事比例", Number.isFinite(snapshot.life_routine?.chores_probability) ? value(snapshot.life_routine.chores_probability * 100) + "%" : null);
    const camera = (snapshot.plugins?.items || []).find(item => item.id === "life-camera");
    if (camera) {
      row("生活相机", camera.status);
      row("主动照片", camera.settings?.automatic === true ? "开启" : "关闭");
      row("相机间隔", Number.isFinite(camera.settings?.cooldown_minutes) ? camera.settings.cooldown_minutes + " 分钟" : null);
      row("镜头偏好", camera.settings?.camera_preference);
      row("角色参考", camera.reference?.name);
      for (const item of camera.recent || []) row(item.caption || "生活照片", item.status);
    }
  } else if (key === "reading") {
    for (const item of snapshot.plugins?.items || [])
      row(item.name || item.id, item.status);
    const reading = (snapshot.plugins?.items || []).find(item => item.id === "social-reading");
    if (reading) {
      row("自动阅读", reading.settings?.auto_browse === true ? "开启" : "关闭");
      row("语言学习", reading.settings?.language_learning === true ? "开启" : "关闭");
      row("分享兴趣阈值", value(reading.settings?.share_threshold));
      for (const source of reading.sources || []) row(source.name, source.status);
      for (const item of reading.recent_readings || []) row(item.title, item.status);
    }
    const entries = reading?.habits || snapshot.reading_growth?.terms || [];
    const groups = node("select"), search = node("input"), chips = node("div", undefined, "chips");
    groups.setAttribute("aria-label", "口头禅阶段");
    search.setAttribute("aria-label", "搜索口头禅");
    search.placeholder = "搜索口头禅";
    for (const [value, label] of [["trial", "试用中"], ["mature", "已用熟"], ["reference", "仅理解"], ["candidate", "待理解"], ["rejected", "已停用"], ["", "全部"]]) {
      const option = node("option", label); option.value = value; groups.append(option);
    }
    let page = 0;
    const more = node("button", "下一页");
    function showTerms() {
      const filtered = entries.filter(entry => (!groups.value || entry.status === groups.value) &&
        String(entry.form || entry.pattern || entry.keyword || entry.term || "").includes(search.value));
      chips.replaceChildren(...filtered.slice(page * 24, (page + 1) * 24).map(entry =>
        node("span", entry.form || entry.pattern || entry.keyword || entry.term, "chip")));
      more.hidden = filtered.length <= 24;
      more.textContent = `${page + 1} / ${Math.max(1, Math.ceil(filtered.length / 24))} · 下一页`;
      more.onclick = () => { page = (page + 1) % Math.ceil(filtered.length / 24); showTerms(); };
    }
    for (const control of [groups, search]) control.oninput = () => { page = 0; showTerms(); };
    $("detail-body").append(groups, search, chips, more);
    showTerms();
    for (const item of [...(reading?.habit_personality || []), ...(reading?.personality_growth || [])])
      row(item.trait, item.interpretation || item.status);
  } else {
    row("状态时间", time(snapshot.generated_at));
    row("展示模式", snapshot.preview ? "角色与合成状态预览" : "私有状态");
    $("detail-body").append(
      node("p", "小屋动作展示已有的伙伴状态。", "detail-description"),
    );
  }
  if (!$("detail-body").children.length)
    $("detail-body").append(node("p", "暂未记录。", "detail-description"));
  if (!$("details").open) $("details").showModal();
}

function render(next) {
  if (snapshot && (next.generated_at < snapshot.generated_at ||
      (next.revision && snapshot.revision && BigInt(next.revision) < BigInt(snapshot.revision)))) return;
  const view = derivePresentation(next);
  snapshot = next;
  presentation = view;
  $("title").textContent = next.panel_profile?.title || "伙伴的小屋";
  document.title = $("title").textContent;
  $("preview-badge").hidden = !next.preview;
  $("preview-controls").hidden = !next.preview;
  $("updated").textContent = time(next.generated_at) + " 更新";
  $("updated").dateTime = new Date(next.generated_at * 1000).toISOString();
  $("presence").textContent = view.presenceText;
  document.querySelector(".home-card").dataset.period = view.period;
  document.querySelector(".home-card").dataset.presence = view.presence;
  $("away-title").textContent = view.presenceText;
  $("away-location").textContent = view.location;
  $("away-note").hidden = view.presence === "home" ||
    document.querySelector('[data-view="home"]').getAttribute("aria-pressed") !== "true";
  $("mood-label").textContent = view.leadingLabel;
  $("connection").textContent = next.preview
    ? "角色初稿 · 合成状态"
    : view.stale
      ? "显示上次状态"
      : "状态已同步";
  const plugin = (next.plugins?.items || []).find(
    (item) => item.id === "social-reading",
  );
  const cards = [
    [
      "mood",
      view.leadingLabel,
      view.emotions
        .slice(1)
        .map((item) => item.label)
        .join(" · ") || "此刻的心情",
    ],
    [
      "energy",
      value(view.energy === null ? null : view.energy * 100),
      "身体与精神",
    ],
    ["contact", value(next.companion?.contact_desire), "联系欲望"],
    ["life", view.activityName, next.companion?.day_scene?.stage || "当前活动"],
    ["memory", value(next.counts?.memories), "条记忆"],
    ["people", (next.people?.length ?? "—") + " 位", "关系与熟悉的人"],
    [
      "switches",
      "已开启 " +
        Object.values(next.expression_settings?.values || {}).filter(
          (item) => item === true,
        ).length +
        " 项",
      "表达与系统偏好",
    ],
    ["reading", plugin?.status || "未记录", "阅读与口头禅"],
  ];
  $("cards").replaceChildren(
    ...cards.map(([key, main, note]) => {
      const button = node("button", undefined, "state-card");
      button.dataset.detail = key;
      const label = node("div", titles[key], "card-label");
      label.append(node("span", glyphs[key]));
      button.append(
        label,
        node("div", main, "card-value"),
        node("div", note, "card-note"),
      );
      return button;
    }),
  );
  room?.setState(view);
}

async function refresh() {
  if (config.offline) {
    if (!snapshot) render(JSON.parse($("initial-state").textContent));
    return;
  }
  if (snapshot?.preview) return;
  if (document.hidden || activeRequest) return;
  activeRequest = new AbortController();
  const timeout = setTimeout(() => activeRequest?.abort(), 5000);
  try {
    const response = await fetch(config.stateUrl || "./state.json", {
      credentials: "same-origin",
      cache: "no-store",
      signal: activeRequest.signal,
    });
    if (!response.ok) throw new Error("state_unavailable");
    const raw = await response.text();
    if (raw.length > 256000) throw new Error("state_too_large");
    render(JSON.parse(raw));
  } catch {
    $("connection").textContent = snapshot
      ? "连接中断 · 显示上次状态"
      : "状态暂未载入";
  } finally {
    clearTimeout(timeout);
    activeRequest = null;
    clearTimeout(timer);
    if (!document.hidden && !snapshot?.preview)
      timer = setTimeout(refresh, 30000);
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-detail]");
  if (button) detail(button.dataset.detail);
});
$("close-detail").addEventListener("click", () => $("details").close());
$("details").addEventListener("click", (event) => {
  if (event.target === $("details")) $("details").close();
});
document.addEventListener("visibilitychange", () => {
  clearTimeout(timer);
  if (document.hidden) activeRequest?.abort();
  else refresh();
});

async function start() {
  const embedded = $("home-config");
  if (embedded) {
    config = JSON.parse(embedded.textContent);
  } else {
    const response = await fetch("./home-config.json", {
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("home_configuration_missing");
    config = await response.json();
  }
  if (config.referenceUrl) {
    $("reference").hidden = false;
    $("reference").onclick = () => detail("reference");
  }
  try {
    room = createRoom($("room"), {
      characterUrl: config.characterUrl,
      expressionAtlasUrl: config.expressionAtlasUrl,
      gardenUrl: config.gardenUrl,
      onSelect: detail,
      onStatus: (status) => {
        $("model-status").textContent = status === "ready" ? "" : status;
      },
    });
  } catch {
    $("model-status").textContent = "3D 暂不可用，状态卡片可正常查看";
  }
  for (const button of document.querySelectorAll("[data-view]"))
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      room?.setView(view);
      $("away-note").hidden = view !== "home" || presentation?.presence === "home";
      const reference = config.referenceViews?.[view];
      $("view-reference").hidden = !reference;
      $("model-comparison").classList.toggle("comparing", Boolean(reference));
      if (reference) {
        const label = { front: "正面原图", side: "侧面原图", back: "背面原图" }[view];
        $("view-reference-image").src = reference;
        $("view-reference-image").alt = label;
        $("view-reference-label").textContent = label;
      } else {
        $("view-reference-image").removeAttribute("src");
      }
      for (const tab of document.querySelectorAll("[data-view]"))
        tab.setAttribute("aria-pressed", String(tab === button));
    });
  $("turn-left").onclick = () => room?.rotate(-0.25);
  $("turn-right").onclick = () => room?.rotate(0.25);
  $("zoom-in").onclick = () => room?.zoom(-1);
  $("zoom-out").onclick = () => room?.zoom(1);
  $("reset").onclick = () =>
    document.querySelector('[data-view="home"]').click();
  for (const id of ["preview-action", "preview-mood", "preview-energy"])
    $(id).addEventListener("input", () => {
      if (!snapshot?.preview) return;
      const copy = structuredClone(snapshot),
        now = Date.now() / 1000;
      copy.generated_at = now;
      copy.companion.activity = {
        name: $("preview-action").value,
        started_at: now - 60,
        ends_at: now + 1200,
      };
      copy.mood.labels = [{ label: $("preview-mood").value, intensity: 0.5 }];
      copy.companion.energy = {
        physical: Number($("preview-energy").value),
        mental: Number($("preview-energy").value),
      };
      render(copy);
    });
  await refresh();
}
start().catch(() => {
  $("connection").textContent = "等待私有空间配置";
  $("model-status").textContent = "小屋配置暂未载入";
});
