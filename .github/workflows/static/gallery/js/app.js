(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    mode: "projects",
    view: "all",
    domain: "all",
    query: "",
    recipesExpanded: false,
    projectLayout: "cards",
    projectPage: 1,
    caseLayout: "cards",
    casePage: 1,
    caseProject: "all",
    caseSlug: null,
    projectFocus: null,
    caseListScroll: 0,
    restoreCaseScroll: false,
    lastCaseSlug: null,
  };

  let data = null;
  let originById = new Map();
  let domainById = new Map();
  let kindById = new Map();
  let statusById = new Map();
  let allCards = [];
  let visibleCards = [];
  let allCases = [];
  let visibleCases = [];
  let caseBySlug = new Map();

  const els = {};

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function assetUrl(path) {
    const value = String(path || "");
    if (!value || /^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith("data:") || value.startsWith("#")) {
      return value;
    }
    const version = data?.site?.assetVersion;
    if (!version) return value;
    return `${value}${value.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
  }

  function getDomain(id) {
    return domainById.get(id) || { id, label: "未标注", color: "#94A3B8" };
  }

  function getKind(id) {
    return kindById.get(id) || { id, label: "未标注", short: id };
  }

  function getStatus(id) {
    return statusById.get(id) || { id, label: "未标注", color: "#94A3B8" };
  }

  function getOrigin(id) {
    return originById.get(id) || { id, label: "未标注", card: "project" };
  }

  function getProject(name) {
    return allCards.find((card) => card.name === name) || null;
  }

  function caseProjects(item) {
    const list = Array.isArray(item.projects)
      ? item.projects
      : item.project
        ? [item.project]
        : [];
    return [...new Set(list.filter(Boolean))];
  }

  function projectDisplayName(name) {
    return getProject(name)?.displayName || name;
  }

  function projectLabel(name) {
    const project = getProject(name);
    return `${project?.displayName || name}${project?.origin === "third-party" ? " · recipe" : ""}`;
  }

  function renderProjectChip(name, className = "case-project") {
    const project = getProject(name);
    const label = project?.displayName || name;
    const kind = project?.origin === "third-party" ? " · recipe" : "";
    const logo = project?.logo
      ? `<img src="${escapeHtml(assetUrl(project.logo))}" alt="" width="22" height="22" loading="lazy" decoding="async">`
      : `<span class="monogram mono-xs" style="--mono-color:${escapeHtml(project?.color || "#2563EB")}" aria-hidden="true">${escapeHtml(project?.monogram || label.slice(0, 2))}</span>`;
    return `<a class="${className}" href="${escapeHtml(projectHref(name))}"
      data-case-project="${escapeHtml(name)}" aria-label="查看 ${escapeHtml(label)}${kind}">
      ${logo}<span>${escapeHtml(label)}${escapeHtml(kind)} →</span>
    </a>`;
  }

  function domainLabels(card) {
    return (card.domains || []).map((id) => getDomain(id).label);
  }

  function viewMatches(card, view) {
    if (!view) return true;
    if (Array.isArray(view.excludeStatus) && view.excludeStatus.includes(card.status)) return false;
    if (Array.isArray(view.includeStatus) && !view.includeStatus.includes(card.status)) return false;
    if (Array.isArray(view.excludeOrigin) && view.excludeOrigin.includes(card.origin)) return false;
    if (Array.isArray(view.includeOrigin) && !view.includeOrigin.includes(card.origin)) return false;
    return true;
  }

  function baseCardsForView(viewId) {
    const view = (data.views || []).find((v) => v.id === viewId);
    return visibleCards.filter((card) => viewMatches(card, view));
  }

  function queryTokens() {
    return state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  }

  function matchesQuery(card, tokens) {
    if (!tokens.length) return true;
    const haystack = [
      card.name,
      card.displayName,
      card.summary,
      card.description,
      card.note,
      card.author,
      card.owner,
      card.upstream,
      card.upstreamVersion,
      card.recipeRef,
      card.remote,
      card.license,
      getKind(card.kind).label,
      getStatus(card.status).label,
      ...(card.tags || []),
      ...(card.highlights || []),
      ...domainLabels(card),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  }

  function matchesDomain(card, domainId) {
    if (domainId === "all") return true;
    return Array.isArray(card.domains) && card.domains.includes(domainId);
  }

  function filteredCards() {
    const tokens = queryTokens();
    return baseCardsForView(state.view).filter(
      (card) => matchesDomain(card, state.domain) && matchesQuery(card, tokens)
    );
  }

  function matchesCaseQuery(item, tokens) {
    if (!tokens.length) return true;
    const related = caseProjects(item).map(getProject).filter(Boolean);
    const haystack = [
      item.title,
      item.outcome,
      item.summary,
      ...caseProjects(item),
      ...related.map((project) => project.displayName),
      ...related.map((project) => project.summary),
      ...(item.tags || []),
      ...(item.audience || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  }

  function filteredCases() {
    const tokens = queryTokens();
    return visibleCases.filter(
      (item) =>
        (state.caseProject === "all" ||
          caseProjects(item).includes(state.caseProject)) &&
        matchesCaseQuery(item, tokens)
    );
  }

  function sortCases(cases) {
    return [...cases].sort((a, b) => {
      const featuredDelta = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      if (featuredDelta) return featuredDelta;
      const orderDelta = (a.order ?? 999) - (b.order ?? 999);
      if (orderDelta) return orderDelta;
      return String(a.title || a.slug).localeCompare(String(b.title || b.slug), "zh-CN");
    });
  }

  function paginate(items, page, pageSize) {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(Math.max(1, page), totalPages);
    const start = (current - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      page: current,
      totalPages,
      total,
      start,
    };
  }

  function renderPagination(container, pageData, dataAttr, label) {
    if (pageData.total <= pageData.items.length && pageData.totalPages === 1) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }
    const buttons = [];
    for (let page = 1; page <= pageData.totalPages; page += 1) {
      buttons.push(`<button class="page-btn${page === pageData.page ? " is-active" : ""}"
        type="button" data-${dataAttr}="${page}"
        aria-pressed="${page === pageData.page}" data-focus-key="${label}:${page}">
        ${page}
      </button>`);
    }
    container.hidden = false;
    container.innerHTML = `
      <span class="page-status">${pageData.start + 1}–${Math.min(
        pageData.start + pageData.items.length,
        pageData.total
      )} / ${pageData.total} ${label}</span>
      <div class="page-buttons">
        <button class="page-btn" type="button" data-${dataAttr}="${pageData.page - 1}"
          ${pageData.page <= 1 ? "disabled" : ""} aria-label="上一页">上一页</button>
        ${buttons.join("")}
        <button class="page-btn" type="button" data-${dataAttr}="${pageData.page + 1}"
          ${pageData.page >= pageData.totalPages ? "disabled" : ""} aria-label="下一页">下一页</button>
      </div>
    `;
  }

  function urlFor(params) {
    const search = new URLSearchParams(params).toString();
    return search ? `?${search}` : location.pathname;
  }

  function caseHref(slug) {
    return urlFor({ mode: "cases", case: slug });
  }

  function projectHref(name) {
    return urlFor({ mode: "projects", project: name });
  }

  function caseIndexHref() {
    return urlFor({ mode: "cases" });
  }

  function sortCards(cards) {
    return [...cards].sort((a, b) => {
      const featuredDelta = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      if (featuredDelta) return featuredDelta;
      const orderDelta = (a.order ?? 999) - (b.order ?? 999);
      if (orderDelta) return orderDelta;
      return String(a.displayName || a.name).localeCompare(String(b.displayName || b.name), "zh-CN");
    });
  }

  function captureFocusKey() {
    const el = document.activeElement;
    return el && el.dataset ? el.dataset.focusKey || null : null;
  }

  function restoreFocusKey(key) {
    if (!key) return;
    const el = document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`);
    if (el) el.focus({ preventScroll: true });
  }

  function renderHeaderStats() {
    if (state.mode === "cases") {
      const projects = new Set(visibleCases.flatMap(caseProjects));
      els.heroStats.innerHTML = [
        `<span class="stat"><strong>${visibleCases.length}</strong> 个案例</span>`,
        `<span class="stat"><strong>${projects.size}</strong> 个关联对象</span>`,
        `<span class="stat"><strong>${visibleCases.length}</strong> 份技术来源</span>`,
      ].join("");
      return;
    }

    const firstParty = visibleCards.filter((c) => c.origin === "first-party").length;
    const recipes = visibleCards.filter((c) => c.origin === "third-party").length;
    const pending = allCards.filter(
      (c) => c.origin === "third-party" && c.visible === false
    ).length;
    const archived = visibleCards.filter((c) => c.status === "deprecated").length;

    els.heroStats.innerHTML = [
      `<span class="stat"><strong>${firstParty}</strong> 个自研项目</span>`,
      `<span class="stat"><strong>${recipes}</strong> 个上架配方</span>`,
      `<span class="stat"><strong>${pending}</strong> 个配方待归档</span>`,
      `<span class="stat"><strong>${archived}</strong> 个已归档</span>`,
    ].join("");
  }

  function renderModeSwitch(focusKey) {
    $$("[data-mode]", els.modeSwitch).forEach((button) => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    restoreFocusKey(focusKey);
  }

  function renderLayoutToggles(focusKey) {
    const groups = [
      [els.projectLayoutToggle, "projectLayout", "data-project-layout"],
      [els.caseLayoutToggle, "caseLayout", "data-case-layout"],
    ];
    for (const [container, key, attr] of groups) {
      if (!container) continue;
      $$(`[${attr}]`, container).forEach((button) => {
        const active = button.getAttribute(attr) === state[key];
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }
    restoreFocusKey(focusKey);
  }

  function caseCountForProject(name) {
    return visibleCases.filter((item) => caseProjects(item).includes(name)).length;
  }

  function renderModeCopy() {
    const eyebrow = data.site?.eyebrow ?? "GALLERY INDEX";
    els.eyebrow.textContent = eyebrow;
    els.eyebrow.hidden = !eyebrow;
    const sections = data.site?.sections || {};
    const casesSection = sections.cases || {};
    const projectsSection = sections.projects || {};
    const cases = state.mode === "cases";
    const projects = new Set(visibleCases.flatMap(caseProjects));

    $$("[data-mode]", els.modeSwitch).forEach((button) => {
      const title = button.dataset.mode === "cases"
        ? casesSection.title
        : projectsSection.title;
      if (title) button.textContent = title;
    });

    if (cases) {
      const note = (casesSection.noteTemplate || "{caseCount} 个案例 · 来自 {projectCount} 个项目")
        .replace(/\{caseCount\}/g, String(visibleCases.length))
        .replace(/\{projectCount\}/g, String(projects.size));
      els.sectionSubtitle.innerHTML = `${escapeHtml(
        casesSection.subtitle || "从任务到结果：项目在真实机器上解决了什么"
      )}<span class="hero-note"> · ${escapeHtml(note)}</span>`;
      els.searchInput.placeholder = "搜索案例、任务或项目…";
      document.title = "轻舟 · 应用案例";
    } else {
      els.sectionSubtitle.innerHTML = `${escapeHtml(
        projectsSection.subtitle || "算法、模型与工程组件的统一入口"
      )}<span class="hero-note"> · ${escapeHtml(projectsSection.note || "分域与状态只是 seed，随时可改。")}</span>`;
      els.searchInput.placeholder = "搜索项目、分域或作者…";
      document.title = "轻舟 · AI Gallery";
    }
  }

  function renderCaseTabs(focusKey) {
    const projects = [...new Set(visibleCases.flatMap(caseProjects))].sort();
    const allActive = state.caseProject === "all";
    const tabs = [
      `<button class="tab${allActive ? " is-active" : ""}" type="button"
        aria-pressed="${allActive}" data-case-project="all" data-focus-key="case-project:all">
        全部案例<span class="tab-count">${visibleCases.length}</span>
      </button>`,
    ];
    for (const name of projects) {
      const project = getProject(name);
      const count = visibleCases.filter((item) => caseProjects(item).includes(name)).length;
      const active = state.caseProject === name;
      tabs.push(`<button class="tab${active ? " is-active" : ""}" type="button"
        aria-pressed="${active}" data-case-project="${escapeHtml(name)}"
        data-focus-key="case-project:${escapeHtml(name)}">
        ${escapeHtml(project?.displayName || name)}<span class="tab-count">${count}</span>
      </button>`);
    }
    els.caseTabs.innerHTML = tabs.join("");
    restoreFocusKey(focusKey);
  }

  function renderCaseCard(item) {
    const maxTags = data.caseSettings?.maxTags ?? 3;
    const tags = (item.tags || []).slice(0, maxTags);
    const related = caseProjects(item).map((name) => renderProjectChip(name)).join("");
    const classes = ["case-card", item.featured ? "is-featured" : ""].filter(Boolean).join(" ");
    return `<article class="${classes}" aria-label="${escapeHtml(item.title)}">
      <a class="case-card-main" href="${escapeHtml(caseHref(item.slug))}" data-case-link="${escapeHtml(item.slug)}">
        <div class="case-cover">
          <img src="${escapeHtml(assetUrl(item.cover || ""))}" alt="${escapeHtml(item.coverAlt || item.title)}"
            width="720" height="405" loading="lazy" decoding="async">
        </div>
        <div class="case-body">
          <h3 class="case-title">${escapeHtml(item.title)}</h3>
          <p class="case-outcome">${escapeHtml(item.outcome || item.summary || "")}</p>
          <div class="case-tags">${tags.map((tag) => `<span class="case-tag">${escapeHtml(tag)}</span>`).join("")}</div>
          <div class="case-related">${related}</div>
          <span class="case-more">查看案例 →</span>
        </div>
      </a>
    </article>`;
  }

  function renderCaseRow(item) {
    const maxTags = data.caseSettings?.maxTags ?? 3;
    const tags = (item.tags || []).slice(0, maxTags);
    const related = caseProjects(item).map((name) => renderProjectChip(name)).join("");
    return `<article class="case-row">
      <a class="case-row-main" href="${escapeHtml(caseHref(item.slug))}" data-case-link="${escapeHtml(item.slug)}">
        <span class="row-thumb">
          <img src="${escapeHtml(assetUrl(item.cover || ""))}" alt="${escapeHtml(item.coverAlt || item.title)}"
            width="96" height="54" loading="lazy" decoding="async">
        </span>
        <span class="row-main">
          <span class="row-title">${escapeHtml(item.title)}</span>
          <span class="row-summary">${escapeHtml(item.outcome || item.summary || "")}</span>
          <span class="case-tags">${tags.map((tag) => `<span class="case-tag">${escapeHtml(tag)}</span>`).join("")}</span>
        </span>
      </a>
      <span class="case-related">${related}</span>
    </article>`;
  }

  function renderCaseDetail(item) {
    const relatedNames = caseProjects(item);
    const related = relatedNames.map(getProject).filter(Boolean);
    const primary = related[0] || null;
    const heroProjects = relatedNames.map((name) => renderProjectChip(name, "case-hero-project")).join("");
    const projectCards = relatedNames.map((name) => {
      const project = getProject(name);
      const status = getStatus(project?.status);
      const label = project?.displayName || name;
      const isRecipe = project?.origin === "third-party";
      const logo = project?.logo
        ? `<img class="project-logo" src="${escapeHtml(assetUrl(project.logo))}" alt="" width="22" height="22" loading="lazy" decoding="async">`
        : `<span class="monogram mono-xs" style="--mono-color:${escapeHtml(project?.color || "#2563EB")}" aria-hidden="true">${escapeHtml(project?.monogram || label.slice(0, 2))}</span>`;
      return `<div class="case-project-card">
        <div class="case-project-head">
          ${logo}
          <span class="case-project-name">${escapeHtml(label)}</span>
          <span class="case-project-status">● ${escapeHtml(status.label)}${isRecipe ? " · recipe" : ""}</span>
        </div>
        <p class="case-project-summary">${escapeHtml(project?.summary || "关联对象简介待补")}</p>
        <a class="case-project-link" href="${escapeHtml(projectHref(name))}"
          data-case-project="${escapeHtml(name)}">${isRecipe ? "查看配方" : "在项目库中查看"} →</a>
        ${project?.url ? `<a class="case-project-doc" href="${escapeHtml(project.url)}" target="_blank" rel="noopener noreferrer">打开${isRecipe ? "配方" : "项目"}文档 ↗</a>` : ""}
        ${(project?.guides || []).map((guide) => `<a class="case-project-doc" href="${escapeHtml(guide.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(guide.label)} ↗</a>`).join("")}
      </div>`;
    }).join("");
    const tags = (item.tags || []).map((tag) => `<span class="case-tag">${escapeHtml(tag)}</span>`).join("");
    const audience = (item.audience || []).map((tag) => `<span class="case-tag">${escapeHtml(tag)}</span>`).join("");
    const approach = (item.sections?.approach || [])
      .map((step) => `<li>${escapeHtml(step)}</li>`)
      .join("");
    const sourceUrl = item.sourceUrl || primary?.url || "#";
    const sourceLabel = item.sourceLabel || "完整技术细节";

    els.caseDetail.innerHTML = `
      <nav class="case-breadcrumb" aria-label="面包屑">
        <a href="${escapeHtml(caseIndexHref())}" data-case-back>应用案例</a>
        <span aria-hidden="true">/</span>
        <span>${escapeHtml(item.title)}</span>
      </nav>
      <header class="case-detail-hero">
        <div class="case-detail-copy">
          <p class="eyebrow">APPLICATION CASE</p>
          <h2 class="case-detail-title">${escapeHtml(item.title)}</h2>
          <p class="case-detail-outcome">${escapeHtml(item.outcome || item.summary || "")}</p>
          <div class="case-detail-meta">${tags}${audience}</div>
        </div>
        <div class="case-hero-projects">${heroProjects}</div>
      </header>
      <div class="case-layout">
        <div class="case-article">
          <section class="case-section">
            <h2>场景</h2>
            <p>${escapeHtml(item.sections?.context || "")}</p>
          </section>
          <section class="case-section">
            <h2>问题</h2>
            <p>${escapeHtml(item.sections?.problem || "")}</p>
          </section>
          <section class="case-section">
            <h2>方案</h2>
            <ul>${approach}</ul>
          </section>
          <section class="case-section">
            <h2>结果</h2>
            <p>${escapeHtml(item.sections?.result || "")}</p>
          </section>
          <figure class="case-figure">
            <img src="${escapeHtml(assetUrl(item.cover || ""))}" alt="${escapeHtml(item.coverAlt || item.title)}"
              width="720" height="405" loading="lazy" decoding="async">
            <figcaption>${escapeHtml(item.figureCaption || "")}</figcaption>
          </figure>
          <section class="case-section">
            <h2>边界</h2>
            <p>${escapeHtml(item.sections?.boundary || "")}</p>
          </section>
          <div class="case-source">
            <div class="case-source-copy">
              <strong>完整技术细节</strong>
              <span>${escapeHtml(sourceLabel)} · Sphinx</span>
            </div>
            <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">打开技术页 ↗</a>
          </div>
          <a class="case-back-bottom" href="${escapeHtml(caseIndexHref())}" data-case-back>← 返回应用案例</a>
        </div>
        <aside class="case-aside">
          ${projectCards}
          <div class="case-facts">
            <h3>快速事实</h3>
            <div class="case-fact-row"><span>关联对象</span><strong>${escapeHtml(relatedNames.map(projectLabel).join(" / "))}</strong></div>
            <div class="case-fact-row"><span>技术来源</span><strong>${escapeHtml(sourceLabel)}</strong></div>
            <div class="case-fact-row"><span>复核日期</span><strong>${escapeHtml(item.reviewedAt || "未标注")}</strong></div>
            <div class="case-fact-row"><span>读者</span><strong>${escapeHtml((item.audience || []).join(" / ") || "通用")}</strong></div>
          </div>
        </aside>
      </div>
    `;
  }

  function renderCases(focusKey) {
    const cases = sortCases(filteredCases());
    const isDetail = Boolean(state.caseSlug);
    const item = isDetail ? caseBySlug.get(state.caseSlug) : null;

    if (isDetail && !item) {
      state.caseSlug = null;
      return renderCases(focusKey);
    }

    els.viewTabs.hidden = true;
    els.caseTabs.hidden = isDetail;
    els.domainChips.hidden = true;
    els.filterBar.hidden = isDetail;
    els.projectGrid.hidden = true;
    els.projectGrid.innerHTML = "";
    els.projectsHead.hidden = true;
    els.projectPagination.hidden = true;
    els.recipeShelf.hidden = true;
    els.emptyState.hidden = true;
    els.caseIndex.hidden = isDetail;
    els.caseDetail.hidden = !isDetail;
    els.casePagination.hidden = isDetail;

    if (isDetail) {
      renderCaseDetail(item);
      els.resultCount.textContent = "";
      document.title = `${item.title} · 轻舟应用案例`;
      return;
    }

    renderCaseTabs(focusKey);
    const sections = data.site?.sections || {};
    els.caseHeadTitle.textContent = sections.cases?.title || "应用案例";
    els.caseHeadNote.textContent = sections.cases?.subtitle || "从任务到结果：项目在真实机器上解决了什么";
    els.casesCount.textContent = `${cases.length} 个案例`;
    const pageSize = data.caseSettings?.directoryPageSize ?? 24;
    const pageData = paginate(cases, state.casePage, pageSize);
    state.casePage = pageData.page;
    els.caseGrid.classList.toggle("is-directory", state.caseLayout === "directory");
    if (state.caseLayout === "directory") {
      els.caseGrid.innerHTML = pageData.items.map(renderCaseRow).join("");
      renderPagination(els.casePagination, pageData, "case-page", "个案例");
    } else {
      els.caseGrid.innerHTML = cases.map(renderCaseCard).join("");
      els.casePagination.hidden = true;
      els.casePagination.innerHTML = "";
    }
    els.caseEmpty.hidden = cases.length > 0;
    els.caseGrid.hidden = cases.length === 0;
    if (!cases.length) {
      els.casePagination.hidden = true;
      els.casePagination.innerHTML = "";
    }
    const project = state.caseProject === "all" ? null : getProject(state.caseProject);
    els.resultCount.textContent = project
      ? `${cases.length} 个案例 · ${project.displayName || project.name}`
      : `${cases.length} 个案例`;
    document.title = "轻舟 · 应用案例";
    if (state.restoreCaseScroll) {
      state.restoreCaseScroll = false;
      window.scrollTo({ top: state.caseListScroll || 0, behavior: "auto" });
    }
  }

  function renderTabs(focusKey) {
    els.viewTabs.innerHTML = (data.views || [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((view) => {
        const count = baseCardsForView(view.id).length;
        const active = state.view === view.id;
        return `<button class="tab${active ? " is-active" : ""}" type="button"
          aria-pressed="${active}" data-view="${escapeHtml(view.id)}"
          data-focus-key="view:${escapeHtml(view.id)}">
          ${escapeHtml(view.label)}<span class="tab-count">${count}</span>
        </button>`;
      })
      .join("");
    restoreFocusKey(focusKey);
  }

  function renderDomains(focusKey) {
    const base = baseCardsForView(state.view);
    const counts = new Map();
    for (const card of base) {
      for (const id of card.domains || []) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }

    const allActive = state.domain === "all";
    const chips = [
      `<button class="chip${allActive ? " is-active" : ""}" type="button"
        aria-pressed="${allActive}" data-domain="all" data-focus-key="domain:all">
        全部分域<span class="chip-count">${base.length}</span>
      </button>`,
    ];

    for (const domain of (data.taxonomy.domains || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
      const count = counts.get(domain.id) || 0;
      const active = state.domain === domain.id;
      chips.push(`<button class="chip${active ? " is-active" : ""}" type="button"
        aria-pressed="${active}" data-domain="${escapeHtml(domain.id)}"
        style="--domain-color:${escapeHtml(domain.color || "#94A3B8")}"
        data-focus-key="domain:${escapeHtml(domain.id)}">
        <span class="chip-dot"></span>${escapeHtml(domain.label)}
        <span class="chip-count">${count}</span>
      </button>`);
    }

    els.domainChips.innerHTML = chips.join("");
    restoreFocusKey(focusKey);
  }

  function resolveBadges(card) {
    const registry = data.badgeRegistry || {};
    let entries = Array.isArray(card.badges) ? card.badges : null;

    if (!entries) {
      if (card.origin === "third-party") {
        entries = [
          { preset: "recipe", value: "by HeT-FTI" },
          {
            preset: "upstream",
            value: [card.upstream, card.upstreamVersion].filter(Boolean).join(" "),
          },
        ];
      } else {
        entries = [
          { preset: "author", value: card.author || card.owner },
          { preset: "version", value: card.version },
          { preset: "license", value: card.license },
        ].filter((item) => item.value);
      }
    }

    return entries
      .map((entry) => {
        const item = typeof entry === "string" ? { preset: entry } : entry;
        const preset = registry[item.preset] || {
          label: item.preset,
          labelColor: "#555555",
          valueColor: "#6C757D",
        };
        let value = item.value;
        if (value === undefined || value === null || value === "") {
          if (item.preset === "author") value = card.author || card.owner;
          else if (item.preset === "version") value = card.version;
          else if (item.preset === "license") value = card.license;
          else if (item.preset === "recipe") value = "by HeT-FTI";
          else if (item.preset === "upstream") {
            value = [card.upstream, card.upstreamVersion].filter(Boolean).join(" ");
          }
        }
        return {
          label: preset.label || item.preset,
          value: value == null ? "" : String(value),
          labelColor: preset.labelColor || "#555555",
          valueColor: preset.valueColor || "#6C757D",
          style: preset.style || "flat",
          href: String(item.url || item.href || "").trim(),
        };
      })
      .filter((badge) => badge.value);
  }

  function renderBadges(card) {
    const badges = resolveBadges(card);
    const max = data.card?.maxBadges ?? 4;
    const shown = badges.slice(0, max);
    const extra = badges.length - shown.length;
    return (
      shown
        .map((badge) => {
          const content = `
              <span class="shield-label" style="background-color:${escapeHtml(badge.labelColor)}">${escapeHtml(badge.label)}</span>
              <span class="shield-value" style="background-color:${escapeHtml(badge.valueColor)}">${escapeHtml(badge.value)}</span>`;
          const title = escapeHtml(`${badge.label}: ${badge.value}`);
          const style = ["flat", "flat-square", "plastic", "for-the-badge", "social"].includes(
            badge.style
          )
            ? badge.style
            : "flat";
          const cls = `shield is-style-${style}`;
          return badge.href
            ? `<a class="${cls} shield-link" href="${escapeHtml(badge.href)}" target="_blank" rel="noopener noreferrer" title="${title}">${content}</a>`
            : `<span class="${cls}" title="${title}">${content}</span>`;
        })
        .join("") + (extra > 0 ? `<span class="shield-more">+${extra}</span>` : "")
    );
  }

  function renderCardHit(card, label) {
    if (!card.url) return "";
    return `<a class="card-hit" href="${escapeHtml(card.url)}" aria-label="${escapeHtml(label)}"></a>`;
  }

  function renderProjectCard(card) {
    const status = getStatus(card.status);
    const kind = getKind(card.kind);
    const domains = domainLabels(card).join(" / ");
    const maxTags = data.card?.maxTags ?? 3;
    const tags = (card.tags || []).slice(0, maxTags);
    const highlights = (card.highlights || []).slice(0, 4);
    const archived = card.status === "deprecated";
    const summary = card.featured && card.description ? card.description : card.summary;
    const classes = [
      "project-card",
      card.featured ? "featured" : "",
      archived ? "is-archived" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const logo = card.logo
      ? `<img class="project-logo" src="${escapeHtml(assetUrl(card.logo))}" alt=""
          width="28" height="28" loading="lazy" decoding="async">`
      : `<span class="monogram mono-xs" style="--mono-color:${escapeHtml(card.color || "#2563EB")}"
          aria-hidden="true">${escapeHtml(card.monogram || (card.displayName || card.name).slice(0, 2))}</span>`;

    const cover = card.cover
      ? `<img class="card-cover-img" src="${escapeHtml(assetUrl(card.cover))}" alt=""
          width="320" height="320" loading="lazy" decoding="async">`
      : `<div class="card-cover is-fallback" style="--mono-color:${escapeHtml(card.color || "#2563EB")}"
          aria-hidden="true">
          <span class="fallback-mark">${escapeHtml(card.monogram || (card.displayName || card.name).slice(0, 2))}</span>
          <small>封面待补</small>
        </div>`;

    const inner = `
      <div class="card-media">${cover}</div>
      <div class="card-main">
        <div class="card-head">
          ${logo}
          <div class="card-title-wrap">
            <div class="card-title-row">
              <h3 class="card-title">${escapeHtml(card.displayName || card.name)}</h3>
              <span class="status" style="--status-color:${escapeHtml(status.color || "#94A3B8")}">
                <span class="status-dot"></span>${escapeHtml(status.label)}
              </span>
            </div>
            <div class="card-kicker">${escapeHtml(kind.label)}${domains ? ` · ${escapeHtml(domains)}` : ""}</div>
          </div>
        </div>
        <p class="card-summary">${escapeHtml(summary || data.fallbacks?.missingSummary || "简介待补充")}</p>
        ${card.note ? `<p class="card-note">${escapeHtml(card.note)}</p>` : ""}
        ${highlights.length ? `<div class="highlights">${highlights.map((h) => `<span class="highlight">${escapeHtml(h)}</span>`).join("")}</div>` : ""}
        <div class="card-foot">
          <div class="card-tags">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
          <div class="badges">${renderBadges(card)}</div>
        </div>
      </div>
    `;

    const hit = renderCardHit(
      card,
      `${card.displayName || card.name}，${status.label}，${kind.label}`
    );
    return `<article class="${classes}" data-project-name="${escapeHtml(card.name)}" aria-label="${escapeHtml(card.displayName || card.name)}">${hit}${inner}</article>`;
  }

  function renderProjectRow(card) {
    const status = getStatus(card.status);
    const kind = getKind(card.kind);
    const domains = domainLabels(card).join(" / ");
    const archived = card.status === "deprecated";
    const caseCount = caseCountForProject(card.name);
    const logo = card.logo
      ? `<img class="project-logo" src="${escapeHtml(assetUrl(card.logo))}" alt="" width="28" height="28" loading="lazy" decoding="async">`
      : `<span class="monogram mono-xs" style="--mono-color:${escapeHtml(card.color || "#2563EB")}" aria-hidden="true">${escapeHtml(card.monogram || (card.displayName || card.name).slice(0, 2))}</span>`;
    const content = `
      <span class="row-logo">${logo}</span>
      <span class="row-main">
        <span class="row-title-line">
          <span class="row-title">${escapeHtml(card.displayName || card.name)}</span>
          <span class="status" style="--status-color:${escapeHtml(status.color || "#94A3B8")}">
            <span class="status-dot"></span>${escapeHtml(status.label)}
          </span>
        </span>
        <span class="row-kicker">${escapeHtml(kind.label)}${domains ? ` · ${escapeHtml(domains)}` : ""}</span>
        <span class="row-summary">${escapeHtml(card.summary || data.fallbacks?.missingSummary || "简介待补充")}</span>
      </span>
      <span class="row-meta">
        ${caseCount ? `<span class="row-cases">${caseCount} 个案例</span>` : ""}
        <span class="row-badges">${renderBadges(card)}</span>
      </span>
    `;
    const classes = ["project-row", archived ? "is-archived" : ""].filter(Boolean).join(" ");
    const hit = renderCardHit(
      card,
      `${card.displayName || card.name}，${status.label}，${kind.label}`
    );
    return `<article class="${classes}" data-project-name="${escapeHtml(card.name)}">${hit}${content}</article>`;
  }

  function renderRecipeCard(card) {
    const maxPlatforms = data.card?.recipe?.maxPlatforms ?? 3;
    const platforms = (card.platforms || []).slice(0, maxPlatforms);
    const inner = `
      <div class="recipe-head">
        <span class="monogram mono-sm" style="--mono-color:${escapeHtml(card.color || "#2563EB")}"
          aria-hidden="true">${escapeHtml(card.monogram || "R")}</span>
        <span class="recipe-name">${escapeHtml(card.displayName || card.name)}</span>
        <span class="recipe-label">recipe</span>
      </div>
      <div class="recipe-upstream">上游：${escapeHtml(card.upstream || "未标注")}${card.upstreamVersion ? ` · ${escapeHtml(card.upstreamVersion)}` : ""}</div>
      <div class="recipe-summary">${escapeHtml(card.summary || "")}</div>
      <div class="recipe-meta">
        <span class="recipe-ref">${escapeHtml(card.recipeRef || data.fallbacks?.missingRecipeRef || "recipe ref 待补")}</span>
        ${card.remote ? `<span>·</span><span>${escapeHtml(card.remote)}</span>` : ""}
      </div>
      ${platforms.length ? `<div class="recipe-platforms">${platforms.map((p) => `<span class="platform">${escapeHtml(p)}</span>`).join("")}</div>` : ""}
      ${card.install ? `<div class="recipe-command" title="${escapeHtml(card.install)}">$ ${escapeHtml(card.install)}</div>` : ""}
      <div class="recipe-foot">
        <div class="badges">${renderBadges(card)}</div>
      </div>
    `;

    const hit = renderCardHit(card, `${card.displayName || card.name} Conan recipe`);
    return `<article class="recipe-card" data-project-name="${escapeHtml(card.name)}" aria-label="${escapeHtml(card.displayName || card.name)} recipe">${hit}${inner}</article>`;
  }

  function renderRecipeRow(card) {
    const maxPlatforms = data.card?.recipe?.maxPlatforms ?? 3;
    const platforms = (card.platforms || []).slice(0, maxPlatforms);
    const logo = `<span class="monogram mono-sm" style="--mono-color:${escapeHtml(card.color || "#2563EB")}"
      aria-hidden="true">${escapeHtml(card.monogram || "R")}</span>`;
    const inner = `
      <span class="recipe-row-logo">${logo}</span>
      <span class="recipe-row-main">
        <span class="recipe-row-title">
          <span class="recipe-name">${escapeHtml(card.displayName || card.name)}</span>
          <span class="recipe-label">recipe</span>
        </span>
        <span class="recipe-row-upstream">上游：${escapeHtml(card.upstream || "未标注")}${card.upstreamVersion ? ` · ${escapeHtml(card.upstreamVersion)}` : ""}${card.recipeRef ? ` · ${escapeHtml(card.recipeRef)}` : ""}</span>
        <span class="recipe-row-meta">${platforms.map((p) => `<span>${escapeHtml(p)}</span>`).join("<span>·</span>")}${card.remote ? `<span>·</span><span>${escapeHtml(card.remote)}</span>` : ""}</span>
      </span>
      <span class="recipe-row-side">
        ${card.install ? `<span class="recipe-row-install">$ ${escapeHtml(card.install)}</span>` : ""}
        <span class="badges">${renderBadges(card)}</span>
      </span>
    `;

    const hit = renderCardHit(card, `${card.displayName || card.name} Conan recipe`);
    return `<article class="recipe-row" data-project-name="${escapeHtml(card.name)}" aria-label="${escapeHtml(card.displayName || card.name)} recipe">${hit}${inner}</article>`;
  }

  function render() {
    const focusKey = captureFocusKey();
    document.documentElement.dataset.mode = state.mode;
    renderModeSwitch(focusKey);
    renderLayoutToggles(focusKey);
    renderModeCopy();
    renderHeaderStats();

    if (state.mode === "cases") {
      renderCases(focusKey);
      syncUrl();
      restoreFocusKey(focusKey);
      return;
    }

    els.caseTabs.hidden = true;
    els.caseIndex.hidden = true;
    els.caseDetail.hidden = true;
    els.filterBar.hidden = false;
    els.viewTabs.hidden = false;

    const filtered = filteredCards();
    const projectCards = sortCards(filtered.filter((card) => card.kind !== "recipe"));
    const recipeCards = sortCards(filtered.filter((card) => card.kind === "recipe"));
    const pending = allCards.filter(
      (card) => card.origin === "third-party" && card.visible === false
    ).length;

    renderTabs(focusKey);
    renderDomains(focusKey);

    const showProjects = state.view !== "recipes";
    const isArchiveView = state.view === "archive";
    const showRecipes = !isArchiveView && (state.view === "all" || state.view === "recipes");
    const recipeMatches = recipeCards.length > 0;
    const focusCard = state.projectFocus ? getProject(state.projectFocus) : null;
    if (focusCard?.origin === "third-party") state.recipesExpanded = true;
    const expanded = state.recipesExpanded || (queryTokens().length > 0 && recipeMatches);

    els.projectsHead.hidden = !showProjects || projectCards.length === 0;
    els.projectGrid.hidden = !showProjects || projectCards.length === 0;
    if (showProjects) {
      const pageSize = data.card?.directoryPageSize ?? 50;
      const pageData = paginate(projectCards, state.projectPage, pageSize);
      state.projectPage = pageData.page;
      els.projectsHead.querySelector("h2").textContent = isArchiveView ? "已归档" : "自研项目";
      els.projectsHead.querySelector("p").textContent = isArchiveView
        ? "保留入口与文档，等待整理或抽取核心"
        : "团队维护的库、SDK 与应用";
      els.projectsCount.textContent = `${projectCards.length} 个`;
      els.projectGrid.classList.toggle("is-directory", state.projectLayout === "directory");
      if (state.projectLayout === "directory") {
        els.projectGrid.innerHTML = pageData.items.map(renderProjectRow).join("");
        renderPagination(els.projectPagination, pageData, "project-page", "个项目");
      } else {
        els.projectGrid.innerHTML = projectCards.map(renderProjectCard).join("");
        els.projectPagination.hidden = true;
        els.projectPagination.innerHTML = "";
      }
    } else {
      els.projectGrid.innerHTML = "";
      els.projectPagination.hidden = true;
      els.projectPagination.innerHTML = "";
    }

    const shelfOrigin = (data.taxonomy.origins || []).find((o) => o.id === "third-party") || {};
    const shelfVisible = showRecipes && recipeCards.length > 0;
    els.recipeShelf.hidden = !shelfVisible;
    if (shelfVisible) {
      els.shelfTitle.textContent = shelfOrigin.label || "第三方 Conan 配方";
      els.shelfCount.textContent = String(recipeCards.length);
      els.shelfSub.textContent = shelfOrigin.description || "上游不是我们写的，配方由我们维护";
      els.shelfCta.textContent = expanded
        ? shelfOrigin.collapseLabel || "收起"
        : shelfOrigin.expandLabel || "展开配方";
      els.shelfPending.textContent = pending > 0 ? `另有 ${pending} 个待归档` : "";
      els.shelfToggle.setAttribute("aria-expanded", String(expanded));
      els.recipeGrid.hidden = !expanded;
      els.recipeGrid.classList.toggle("is-directory", state.projectLayout === "directory");
      els.recipeGrid.innerHTML = expanded
        ? recipeCards
            .map((card) =>
              state.projectLayout === "directory"
                ? renderRecipeRow(card)
                : renderRecipeCard(card)
            )
            .join("")
        : "";
    } else {
      els.recipeGrid.innerHTML = "";
      els.recipeGrid.classList.remove("is-directory");
      els.shelfToggle.setAttribute("aria-expanded", "false");
    }

    const showEmpty = filtered.length === 0;
    els.emptyState.hidden = !showEmpty;
    if (showEmpty) {
      els.projectGrid.hidden = true;
      els.projectPagination.hidden = true;
      els.projectsHead.hidden = true;
      els.recipeShelf.hidden = true;
    }

    let countText;
    if (isArchiveView) {
      countText = `${filtered.length} 个已归档`;
    } else if (state.view === "recipes") {
      countText = `${recipeCards.length} 个配方`;
    } else if (recipeCards.length) {
      countText = `${projectCards.length} 个项目 · ${recipeCards.length} 个配方`;
    } else {
      countText = `${projectCards.length} 个项目`;
    }
    els.resultCount.textContent = countText;

    syncUrl();
    restoreFocusKey(focusKey);
    focusProjectCard();
  }

  function focusProjectCard() {
    if (state.mode !== "projects" || !state.projectFocus) return;
    const name = state.projectFocus;
    state.projectFocus = null;
    const card = document.querySelector(`[data-project-name="${CSS.escape(name)}"]`);
    if (card) {
      card.scrollIntoView({ block: "center", behavior: "smooth" });
      card.focus({ preventScroll: true });
      card.classList.add("case-highlight");
      window.setTimeout(() => card.classList.remove("case-highlight"), 1700);
    }
  }

  function currentParams() {
    const params = new URLSearchParams();
    if (state.mode === "cases") {
      params.set("mode", "cases");
      if (state.caseSlug) params.set("case", state.caseSlug);
      if (state.caseProject !== "all") params.set("project", state.caseProject);
      if (state.caseLayout === "directory") params.set("layout", "directory");
      if (state.casePage > 1) params.set("page", String(state.casePage));
      if (state.query.trim()) params.set("q", state.query.trim());
    } else {
      if (state.view !== "all") params.set("view", state.view);
      if (state.domain !== "all") params.set("domain", state.domain);
      if (state.projectLayout === "directory") params.set("layout", "directory");
      if (state.projectPage > 1) params.set("page", String(state.projectPage));
      if (state.query.trim()) params.set("q", state.query.trim());
      if (state.projectFocus) params.set("project", state.projectFocus);
    }
    return params;
  }

  function syncUrl() {
    history.replaceState(null, "", urlFor(currentParams()));
  }

  function pushUrl() {
    history.pushState(null, "", urlFor(currentParams()));
  }

  function clearSearch() {
    state.query = "";
    els.searchInput.value = "";
  }

  function setMode(mode) {
    if (mode !== "projects" && mode !== "cases") return;
    if (state.mode === mode && !state.caseSlug) return;
    state.mode = mode;
    state.caseSlug = null;
    state.projectFocus = null;
    state.projectPage = 1;
    state.casePage = 1;
    state.caseProject = "all";
    clearSearch();
    pushUrl();
    render();
  }

  function openCase(slug) {
    const item = caseBySlug.get(slug);
    if (!item) return;
    state.caseListScroll = window.scrollY;
    state.lastCaseSlug = slug;
    state.mode = "cases";
    state.caseSlug = slug;
    state.projectFocus = null;
    clearSearch();
    pushUrl();
    render();
    window.scrollTo({ top: 0, behavior: "auto" });
    window.requestAnimationFrame(() => {
      document.querySelector("[data-case-back]")?.focus({ preventScroll: true });
    });
  }

  function backToCases() {
    state.caseSlug = null;
    state.restoreCaseScroll = true;
    pushUrl();
    render();
    window.requestAnimationFrame(() => {
      const selector = state.lastCaseSlug
        ? `[data-case-link="${CSS.escape(state.lastCaseSlug)}"]`
        : "[data-case-link]";
      document.querySelector(selector)?.focus({ preventScroll: true });
    });
  }

  function openProjectFromCase(name) {
    const project = getProject(name);
    if (!project) return;
    state.mode = "projects";
    state.caseSlug = null;
    state.view = "all";
    state.domain = "all";
    state.projectFocus = name;
    clearSearch();
    pushUrl();
    render();
  }

  function setCaseProject(project) {
    state.caseProject = project;
    state.casePage = 1;
    render();
  }

  function setView(viewId) {
    if (!(data.views || []).some((v) => v.id === viewId)) return;
    state.view = viewId;
    state.projectPage = 1;
    state.projectFocus = null;
    if (viewId === "recipes") state.recipesExpanded = true;
    render();
  }

  function setDomain(domainId) {
    state.domain = domainId;
    state.projectPage = 1;
    state.projectFocus = null;
    render();
  }

  function clearFilters() {
    if (state.mode === "cases") {
      state.caseProject = "all";
      state.casePage = 1;
      clearSearch();
      render();
      return;
    }
    state.view = "all";
    state.domain = "all";
    state.projectPage = 1;
    state.projectFocus = null;
    state.recipesExpanded = false;
    clearSearch();
    render();
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("gallery-theme", theme);
    } catch (error) {
      /* ignore */
    }
    els.themeToggle.setAttribute(
      "aria-label",
      theme === "dark" ? "切换到浅色模式" : "切换到深色模式"
    );
    els.themeToggle.title = theme === "dark" ? "切换到浅色模式" : "切换到深色模式";
  }

  function initTheme() {
    const current = document.documentElement.dataset.theme || "light";
    setTheme(current);
    els.themeToggle.addEventListener("click", () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
  }

  function initSearchShortcut() {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || "");
    const kbd = $(".search-kbd");
    if (kbd) kbd.textContent = isMac ? "⌘K" : "Ctrl K";

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        els.searchInput.focus();
        els.searchInput.select();
        return;
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        els.searchInput.focus();
        return;
      }
      if (event.key === "Escape" && target === els.searchInput) {
        els.searchInput.value = "";
        state.query = "";
        render();
        return;
      }
      if (event.key === "Escape" && !typing && state.mode === "cases" && state.caseSlug) {
        backToCases();
      }
    });
  }

  function initEvents() {
    els.modeSwitch.addEventListener("click", (event) => {
      const button = event.target.closest("[data-mode]");
      if (!button) return;
      setMode(button.dataset.mode);
    });

    els.viewTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view]");
      if (!button) return;
      setView(button.dataset.view);
    });

    els.caseTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-case-project]");
      if (!button) return;
      setCaseProject(button.dataset.caseProject);
    });

    els.projectLayoutToggle.addEventListener("click", (event) => {
      const button = event.target.closest("[data-project-layout]");
      if (!button) return;
      state.projectLayout = button.dataset.projectLayout;
      state.projectPage = 1;
      render();
    });

    els.caseLayoutToggle.addEventListener("click", (event) => {
      const button = event.target.closest("[data-case-layout]");
      if (!button) return;
      state.caseLayout = button.dataset.caseLayout;
      state.casePage = 1;
      render();
    });

    els.projectPagination.addEventListener("click", (event) => {
      const button = event.target.closest("[data-project-page]");
      if (!button || button.disabled) return;
      state.projectPage = Number(button.dataset.projectPage) || 1;
      render();
    });

    els.casePagination.addEventListener("click", (event) => {
      const button = event.target.closest("[data-case-page]");
      if (!button || button.disabled) return;
      state.casePage = Number(button.dataset.casePage) || 1;
      render();
    });

    els.domainChips.addEventListener("click", (event) => {
      const button = event.target.closest("[data-domain]");
      if (!button) return;
      setDomain(button.dataset.domain);
    });

    document.addEventListener("click", (event) => {
      const caseLink = event.target.closest("[data-case-link]");
      if (caseLink) {
        event.preventDefault();
        openCase(caseLink.dataset.caseLink);
        return;
      }
      const projectLink = event.target.closest("[data-case-project]");
      if (projectLink) {
        event.preventDefault();
        openProjectFromCase(projectLink.dataset.caseProject);
        return;
      }
      const back = event.target.closest("[data-case-back]");
      if (back) {
        event.preventDefault();
        backToCases();
      }
    });

    let searchTimer = 0;
    els.searchInput.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        state.query = els.searchInput.value;
        if (state.mode === "cases") {
          state.caseSlug = null;
          state.casePage = 1;
        } else {
          state.projectFocus = null;
          state.projectPage = 1;
        }
        render();
      }, 80);
    });

    els.shelfToggle.addEventListener("click", () => {
      state.recipesExpanded = !els.shelfToggle.getAttribute("aria-expanded")?.includes("true");
      render();
    });

    els.clearFilters.addEventListener("click", clearFilters);
    els.clearCaseFilters.addEventListener("click", clearFilters);
    window.addEventListener("popstate", () => {
      const previousSlug = state.caseSlug;
      applyUrlState();
      if (previousSlug && state.mode === "cases" && !state.caseSlug) {
        state.restoreCaseScroll = true;
      }
      render();
      if (previousSlug && state.mode === "cases" && !state.caseSlug) {
        window.requestAnimationFrame(() => {
          const selector = state.lastCaseSlug
            ? `[data-case-link="${CSS.escape(state.lastCaseSlug)}"]`
            : "[data-case-link]";
          document.querySelector(selector)?.focus({ preventScroll: true });
        });
      }
    });
  }

  function applyUrlState() {
    const params = new URLSearchParams(location.search);
    const caseParam = params.get("case");
    state.mode = params.get("mode") === "cases" || caseParam ? "cases" : "projects";
    state.query = params.get("q") || "";
    els.searchInput.value = state.query;
    state.projectFocus = null;

    if (state.mode === "cases") {
      state.caseSlug = caseParam && caseBySlug.has(caseParam) ? caseParam : null;
      state.caseProject = params.get("project") || "all";
      state.caseLayout = params.get("layout") === "directory" ? "directory" : "cards";
      state.casePage = Math.max(1, Number(params.get("page")) || 1);
      if (!visibleCases.some((item) => caseProjects(item).includes(state.caseProject))) {
        state.caseProject = "all";
      }
      return;
    }

    state.caseSlug = null;
    const view = params.get("view");
    state.view = view && (data.views || []).some((v) => v.id === view) ? view : "all";
    const domain = params.get("domain");
    state.domain =
      domain && (data.taxonomy.domains || []).some((d) => d.id === domain) ? domain : "all";
    state.projectLayout = params.get("layout") === "directory" ? "directory" : "cards";
    state.projectPage = Math.max(1, Number(params.get("page")) || 1);
    state.projectFocus = params.get("project") || null;
    if (state.view === "recipes") state.recipesExpanded = true;
  }

  function initEls() {
    els.brandMark = $("#brandMark");
    els.siteFavicon = $("#siteFavicon");
    els.heroStats = $("#heroStats");
    els.eyebrow = $("#pageEyebrow");
    els.modeSwitch = $("#modeSwitch");
    els.sectionSubtitle = $("#sectionSubtitle");
    els.filterBar = $(".filter-bar");
    els.viewTabs = $("#viewTabs");
    els.caseTabs = $("#caseTabs");
    els.domainChips = $("#domainChips");
    els.resultCount = $("#resultCount");
    els.projectsHead = $("#projectsHead");
    els.projectsCount = $("#projectsCount");
    els.projectGrid = $("#projectGrid");
    els.projectLayoutToggle = $("#projectLayoutToggle");
    els.projectPagination = $("#projectPagination");
    els.caseIndex = $("#caseIndex");
    els.caseGrid = $("#caseGrid");
    els.caseHeadTitle = $("#caseHeadTitle");
    els.casesCount = $("#casesCount");
    els.caseHeadNote = $("#caseHeadNote");
    els.caseLayoutToggle = $("#caseLayoutToggle");
    els.casePagination = $("#casePagination");
    els.caseEmpty = $("#caseEmpty");
    els.clearCaseFilters = $("#clearCaseFilters");
    els.caseDetail = $("#caseDetail");
    els.recipeShelf = $("#recipeShelf");
    els.shelfToggle = $("#shelfToggle");
    els.shelfTitle = $("#shelfTitle");
    els.shelfCount = $("#shelfCount");
    els.shelfSub = $("#shelfSub");
    els.shelfPending = $("#shelfPending");
    els.shelfCta = $("#shelfCta");
    els.recipeGrid = $("#recipeGrid");
    els.emptyState = $("#emptyState");
    els.clearFilters = $("#clearFilters");
    els.searchInput = $("#searchInput");
    els.themeToggle = $("#themeToggle");
    els.content = $("#content");
    els.footer = $("#siteFooter");
    els.footerLeft = $("#footerLeft");
    els.footerLinks = $("#footerLinks");
  }

  function renderBrand() {
    const logo = data.site?.logo;
    if (logo && els.brandMark) {
      els.brandMark.innerHTML = `<img class="brand-logo" src="${escapeHtml(
        assetUrl(logo)
      )}" alt="" width="44" height="44" decoding="async">`;
      els.brandMark.classList.add("has-logo");
    } else if (els.brandMark) {
      els.brandMark.textContent = data.site?.brandMark || "轻";
      els.brandMark.classList.remove("has-logo");
    }
    if (logo && els.siteFavicon) {
      els.siteFavicon.href = assetUrl(logo);
    }
  }

  function renderFooter() {
    const footer = data.footer;
    if (!footer || footer.show === false) {
      els.footer.hidden = true;
      return;
    }
    els.footer.hidden = false;
    const credits = (footer.credits || []).filter(Boolean);
    els.footerLeft.innerHTML = `
      <div class="footer-copy">${escapeHtml(footer.copyright || "")}</div>
      ${credits.length ? `<div class="footer-credits">${credits.map((c) => `<span>${escapeHtml(c)}</span>`).join("")}</div>` : ""}
    `;
    els.footerLinks.innerHTML = (footer.links || [])
      .map(
        (link) =>
          `<a href="${escapeHtml(link.href || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(
            link.label || link.href
          )}</a>`
      )
      .join("");
  }

  async function init() {
    initEls();
    initTheme();
    initSearchShortcut();

    try {
      if (window.__GALLERY_DATA__) {
        data = window.__GALLERY_DATA__;
      } else {
        const response = await fetch("_config/gallery.json", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        data = await response.json();
      }
    } catch (error) {
      console.error("Failed to load gallery manifest:", error);
      els.projectGrid.innerHTML = `<div class="empty-state"><h3>Gallery 数据加载失败</h3><p>请确认通过 HTTP 访问站点目录。</p></div>`;
      return;
    }

    allCards = data.cards || [];
    visibleCards = allCards.filter((card) => card.visible !== false);
    allCases = data.cases || [];
    visibleCases = allCases.filter((item) => item.visible !== false);
    caseBySlug = new Map(visibleCases.map((item) => [item.slug, item]));
    originById = new Map((data.taxonomy?.origins || []).map((item) => [item.id, item]));
    domainById = new Map((data.taxonomy?.domains || []).map((item) => [item.id, item]));
    kindById = new Map((data.taxonomy?.kinds || []).map((item) => [item.id, item]));
    statusById = new Map((data.taxonomy?.statuses || []).map((item) => [item.id, item]));

    // Keep the configured accent in one place; CSS variables remain the visual source of truth.
    if (data.theme?.accent) {
      document.documentElement.style.setProperty("--accent", data.theme.accent);
    }

    initEvents();
    applyUrlState();
    renderBrand();
    renderHeaderStats();
    renderFooter();
    render();

    document.documentElement.dataset.galleryReady = "true";
  }

  init();
})();
