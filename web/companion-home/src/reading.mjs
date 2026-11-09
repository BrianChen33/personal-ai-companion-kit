const DAY = 86400;
const phases = [['trial', '试用中'], ['mature', '已用熟'], ['reference', '仅理解'],
  ['candidate', '待理解'], ['rejected', '已停用'], ['', '全部']];
const statuses = { ready: '已就绪', verified: '已验证', awaiting_sources: '等待添加来源',
  awaiting_verification: '等待验证', blocked: '暂不可读', login_required: '需要登录',
  unavailable: '暂不可用', failed: '读取失败', revoked: '已停用', proposed: '待验证' };

function element(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}
function threadKey(item) {
  try {
    const url = new URL(item.url);
    return item.source + ':' + url.origin + url.pathname.replace(/\/$/, '');
  } catch { return item.source + ':' + (item.url || item.id); }
}
export function currentPosts(reading, now = Date.now() / 1000) {
  const latest = new Map();
  for (const item of reading.continuations ?? reading.recent_readings ?? []) {
    const at = item.last_read_at ?? item.last_seen ?? item.created;
    if (!Number.isFinite(at)) continue;
    const key = threadKey(item);
    if (!latest.has(key) || latest.get(key).last_read_at < at)
      latest.set(key, { ...item, last_read_at: at });
  }
  return [...latest.values()].filter(item => item.status === 'partial' &&
    item.last_read_at >= now - DAY).sort((a, b) => b.last_read_at - a.last_read_at).slice(0, 24);
}

export function renderReading(host, reading = {}, legacyTerms = [], timezone = 'Asia/Shanghai') {
  const tabs = element('div', undefined, 'reading-tabs');
  tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '阅读与成长');
  const panels = [], buttons = [];
  for (const [key, label] of [['terms', '口头禅'], ['posts', '正在阅读'], ['settings', '来源与设置']]) {
    const button = element('button', label), panel = element('section', undefined, 'reading-panel');
    button.id = 'reading-tab-' + key; panel.id = 'reading-panel-' + key;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', button.id);
    button.onclick = () => select(buttons.indexOf(button));
    button.onkeydown = event => {
      const index = buttons.indexOf(button);
      const target = { ArrowRight: (index + 1) % 3, ArrowLeft: (index + 2) % 3, Home: 0, End: 2 }[event.key];
      if (target !== undefined) { event.preventDefault(); select(target); buttons[target].focus(); }
    };
    tabs.append(button); buttons.push(button); panels.push(panel);
  }
  function select(index) {
    buttons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index)); button.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
  }
  host.append(tabs, ...panels); select(0);

  const entries = reading.habits || legacyTerms;
  const tools = element('div', undefined, 'reading-tools');
  const groups = element('select'), search = element('input'), chips = element('div', undefined, 'chips');
  groups.setAttribute('aria-label', '口头禅阶段'); search.setAttribute('aria-label', '搜索口头禅');
  search.type = 'search'; search.placeholder = '搜索口头禅';
  for (const [value, label] of phases) {
    const option = element('option', label); option.value = value; groups.append(option);
  }
  let page = 0;
  const paging = element('div', undefined, 'reading-paging');
  const previous = element('button', '上一页'), count = element('span'), next = element('button', '下一页');
  previous.onclick = () => { page--; showTerms(); }; next.onclick = () => { page++; showTerms(); };
  paging.append(previous, count, next);
  function showTerms() {
    const query = search.value.trim().toLocaleLowerCase();
    const filtered = entries.filter(entry => (!groups.value || entry.status === groups.value) &&
      String(entry.form || entry.pattern || entry.keyword || entry.term || '').toLocaleLowerCase().includes(query));
    chips.replaceChildren(...filtered.slice(page * 24, (page + 1) * 24).map(entry =>
      element('span', entry.form || entry.pattern || entry.keyword || entry.term, 'chip')));
    if (!filtered.length) chips.append(element('p', '暂无口头禅', 'reading-empty'));
    paging.hidden = filtered.length <= 24; previous.disabled = page === 0;
    next.disabled = (page + 1) * 24 >= filtered.length;
    count.textContent = `${page + 1} / ${Math.max(1, Math.ceil(filtered.length / 24))}`;
  }
  groups.onchange = search.oninput = () => { page = 0; showTerms(); };
  tools.append(groups, search); panels[0].append(tools, chips, paging); showTerms();
  const growth = [...(reading.habit_personality || []), ...(reading.personality_growth || [])].slice(0, 12);
  if (growth.length) {
    const details = element('details', undefined, 'reading-growth');
    details.append(element('summary', '逐渐形成的习惯'));
    for (const item of growth) details.append(element('p', item.trait));
    panels[0].append(details);
  }

  const posts = currentPosts(reading);
  let postPage = 0;
  const postList = element('div', undefined, 'reading-posts'), more = element('button', '更多帖子');
  function showPosts() {
    postList.replaceChildren();
    for (const item of posts.slice(postPage * 6, (postPage + 1) * 6)) {
      const card = element('article', undefined, 'reading-post');
      card.append(element('h3', item.title || '未命名帖子'));
      const date = new Intl.DateTimeFormat('zh-CN', { timeZone: timezone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
      const pages = item.coverage?.pages_seen;
      const progress = pages?.length ? ` · 已读 ${pages.length} 页` : '';
      card.append(element('p', date.format(new Date(item.last_read_at * 1000)) + progress));
      postList.append(card);
    }
    if (!posts.length) postList.append(element('p', '暂无正在续读的帖子', 'reading-empty'));
    more.hidden = posts.length <= 6; more.textContent = `${postPage + 1} / ${Math.ceil(posts.length / 6)} · 下一页`;
  }
  more.onclick = () => { postPage = (postPage + 1) % Math.ceil(posts.length / 6); showPosts(); };
  panels[1].append(postList, more); showPosts();

  function setting(label, value) {
    const line = element('div', undefined, 'detail-row');
    line.append(element('span', label), element('strong', value)); panels[2].append(line);
  }
  setting('阅读状态', statuses[reading.status] || reading.status || '未安装');
  for (const [key, label] of [['auto_browse', '自动阅读'], ['language_learning', '语言学习'], ['personality_growth', '人格成长']])
    setting(label, reading.settings?.[key] === true ? '开启' : '关闭');
  const threshold = reading.settings?.share_threshold;
  if (Number.isFinite(threshold)) setting('分享兴趣阈值', String(threshold));
  const sources = reading.sources || [];
  panels[2].append(element('h3', '允许的来源', 'reading-heading'));
  for (const source of sources) setting(source.name, source.active === false || source.active === 0 ? '已停用' : statuses[source.status] || source.status);
  if (!sources.length) panels[2].append(element('p', '尚未添加来源', 'reading-empty'));
}
