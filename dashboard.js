(function () {
  const STORAGE_KEY = "taichiHarnoTracking";
  const FILTER_STORAGE_KEY = "taichiHarnoDashboardFilter";
  const TRACKING_API_URL = "/api/tracking/events";

  const els = {
    refreshBtn: document.getElementById("refreshDashboardBtn"),
    applyFilterBtn: document.getElementById("applyFilterBtn"),
    quickButtons: Array.from(document.querySelectorAll(".quick-btn")),
    startDate: document.getElementById("startDate"),
    endDate: document.getElementById("endDate"),
    currentPeriodLabel: document.getElementById("currentPeriodLabel"),

    kpiSessions: document.getElementById("kpiSessions"),
    kpiCompletes: document.getElementById("kpiCompletes"),
    kpiPitchViews: document.getElementById("kpiPitchViews"),
    kpiBuyClicks: document.getElementById("kpiBuyClicks"),
    kpiPitchRate: document.getElementById("kpiPitchRate"),
    kpiBuyRate: document.getElementById("kpiBuyRate"),

    stepsTableBody: document.getElementById("stepsTableBody"),
    campaignTableBody: document.getElementById("campaignTableBody"),
    creativeTableBody: document.getElementById("creativeTableBody"),
    insightsList: document.getElementById("insightsList")
  };

  let dashboardEventsCache = [];

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function getLocalEvents() {
    const data = safeParse(localStorage.getItem(STORAGE_KEY), []);
    return Array.isArray(data) ? data : [];
  }

  async function fetchBackendEvents() {
    try {
      const response = await fetch(TRACKING_API_URL, {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Falha ao buscar eventos do backend. HTTP ${response.status}`);
      }

      const json = await response.json();
      const items =
        (Array.isArray(json?.events) && json.events) ||
        (Array.isArray(json?.data) && json.data) ||
        (Array.isArray(json) && json) ||
        [];

      return items.map(normalizeBackendEvent).filter(Boolean);
    } catch (error) {
      console.warn("Não foi possível buscar eventos do backend. Usando fallback local.", error);
      return [];
    }
  }

  function normalizeBackendEvent(event) {
    if (!event || typeof event !== "object") return null;

    return {
      ...event,
      created_at:
        event.created_at ||
        event.event_time ||
        event.inserted_at ||
        event.received_at ||
        event.timestamp ||
        "",
      event_name:
        event.event_name ||
        event.event ||
        event.name ||
        "",
      lead_id:
        event.lead_id ||
        event.leadId ||
        "",
      session_id:
        event.session_id ||
        event.sessionId ||
        "",
      step_index:
        event.step_index ??
        event.stepIndex ??
        event.step_number ??
        null,
      utm_campaign:
        event.utm_campaign ||
        event.campaign ||
        "",
      utm_content:
        event.utm_content ||
        event.creative ||
        "",
      utm_term:
        event.utm_term ||
        "",
      page_type:
        event.page_type ||
        "",
      step_id:
        event.step_id ||
        "",
      checkout_url:
        event.checkout_url ||
        ""
    };
  }

  async function loadAllEvents() {
    const backendEvents = await fetchBackendEvents();
    const localEvents = getLocalEvents();

    const merged = [...backendEvents, ...localEvents];
    const deduped = dedupeEvents(merged);

    dashboardEventsCache = deduped;
    return deduped;
  }

  function dedupeEvents(events) {
    const map = new Map();

    events.forEach((event) => {
      if (!event || typeof event !== "object") return;

      const eventId = normalizeString(event.event_id);
      const eventName = normalizeEventName(event);
      const leadId = normalizeLeadId(event);
      const createdAt = normalizeString(event.created_at || event.event_time || event.timestamp);
      const stepIndex = normalizeStepNumber(event);
      const key = eventId || [eventName, leadId, createdAt, stepIndex].join("|");

      if (!key || key === "|||") return;
      if (!map.has(key)) {
        map.set(key, event);
      }
    });

    return Array.from(map.values());
  }

  function saveFilterState(filter) {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filter));
    } catch (error) {
      console.warn("Não foi possível salvar o filtro do dashboard.", error);
    }
  }

  function getSavedFilterState() {
    const saved = safeParse(localStorage.getItem(FILTER_STORAGE_KEY), null);
    if (!saved || typeof saved !== "object") return null;
    return saved;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatDateInput(date) {
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("-");
  }

  function parseDateInput(value, endOfDay = false) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;

    return endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  function formatDateBr(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "--";
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  function getTodayRange() {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    };
  }

  function getYesterdayRange() {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    return {
      start: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0),
      end: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999)
    };
  }

  function getLast7DaysRange() {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0),
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    };
  }

  function setActiveQuickButton(mode) {
    els.quickButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-range") === mode);
    });
  }

  function hydrateFilter(saved) {
    if (!saved) return null;

    const start = parseDateInput(saved.start, false);
    const end = parseDateInput(saved.end, true);

    if (!start || !end) return null;

    return {
      mode: saved.mode || "today",
      start,
      end
    };
  }

  function serializeFilter(filter) {
    return {
      mode: filter.mode,
      start: formatDateInput(filter.start),
      end: formatDateInput(filter.end)
    };
  }

  function applyFilterToInputs(filter) {
    if (!filter) {
      const today = getTodayRange();
      setActiveQuickButton("today");
      els.startDate.value = formatDateInput(today.start);
      els.endDate.value = formatDateInput(today.end);
      return;
    }

    setActiveQuickButton(filter.mode || "today");
    els.startDate.value = formatDateInput(filter.start);
    els.endDate.value = formatDateInput(filter.end);
  }

  function getCurrentFilter() {
    const activeBtn = els.quickButtons.find((btn) => btn.classList.contains("is-active"));
    const mode = activeBtn?.getAttribute("data-range") || "today";

    let range;

    if (mode === "today") {
      range = getTodayRange();
    } else if (mode === "yesterday") {
      range = getYesterdayRange();
    } else if (mode === "7days") {
      range = getLast7DaysRange();
    } else {
      const start = parseDateInput(els.startDate.value, false);
      const end = parseDateInput(els.endDate.value, true);

      range = {
        start: start || getTodayRange().start,
        end: end || getTodayRange().end
      };
    }

    return {
      mode,
      start: range.start,
      end: range.end
    };
  }

  function isEventInRange(event, filter) {
    const createdAt = new Date(event.created_at || event.timestamp || event.date || 0);
    if (Number.isNaN(createdAt.getTime())) return false;
    return createdAt >= filter.start && createdAt <= filter.end;
  }

  function normalizeString(value, fallback = "") {
    const text = String(value || "").trim();
    return text || fallback;
  }

  function normalizeEventName(event) {
    return normalizeString(
      event.event_name || event.event || event.name,
      ""
    ).toLowerCase();
  }

  function normalizeLeadId(event) {
    return normalizeString(
      event.lead_id ||
      event.leadId ||
      event.session_id ||
      event.sessionId ||
      event.external_id,
      ""
    );
  }

  function normalizeStepNumber(event) {
    const value = Number(
      event.step_number ??
      event.stepIndex ??
      event.step_index ??
      event.step ??
      event.params?.step_number
    );

    if (Number.isFinite(value) && value > 0) return value;
    return null;
  }

  function normalizeCampaign(event) {
    return normalizeString(
      event.utm_campaign ||
      event.campaign ||
      event.params?.utm_campaign ||
      event.params?.campaign,
      "Sem campanha"
    );
  }

  function normalizeCreative(event) {
    return normalizeString(
      event.utm_content ||
      event.creative ||
      event.params?.utm_content ||
      event.params?.creative ||
      event.utm_term,
      "Sem criativo"
    );
  }

  function percent(part, total) {
    if (!total || total <= 0) return 0;
    return (part / total) * 100;
  }

  function formatPercent(value) {
    return `${Number(value || 0).toFixed(1)}%`;
  }

  function getRatePillClass(value) {
    if (value >= 60) return "pill pill-green";
    if (value >= 30) return "pill pill-yellow";
    return "pill pill-red";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function isBuyIntentEvent(event) {
    const name = normalizeEventName(event);
    return name === "buy_click" || name === "initiate_checkout";
  }

  function getUniqueLeadIds(events, predicate) {
    const ids = new Set();

    events.forEach((event) => {
      if (!predicate(event)) return;
      const leadId = normalizeLeadId(event);
      if (!leadId) return;
      ids.add(leadId);
    });

    return ids;
  }

  function getSessionLeadIds(events) {
    return getUniqueLeadIds(events, (event) => {
      const name = normalizeEventName(event);
      return name === "session_start" || name === "quiz_start";
    });
  }

  function getQuizCompleteLeadIds(events) {
    return getUniqueLeadIds(events, (event) => normalizeEventName(event) === "quiz_complete");
  }

  function getPitchViewLeadIds(events) {
    return getUniqueLeadIds(events, (event) => normalizeEventName(event) === "pitch_view");
  }

  function getBuyClickLeadIds(events) {
    return getUniqueLeadIds(events, (event) => isBuyIntentEvent(event));
  }

  function getStepViewLeadIds(events, stepNumber) {
    return getUniqueLeadIds(events, (event) => {
      return normalizeEventName(event) === "step_view" && normalizeStepNumber(event) === stepNumber;
    });
  }

  function getStepAdvanceLeadIds(events, stepNumber) {
    return getUniqueLeadIds(events, (event) => {
      const name = normalizeEventName(event);
      const currentStep = normalizeStepNumber(event);

      if (name === "step_advance" && currentStep === stepNumber) return true;
      if (name === "step_view" && currentStep === stepNumber + 1) return true;

      return false;
    });
  }

  function buildStepRows(events) {
    const stepNumbers = new Set();

    events.forEach((event) => {
      const step = normalizeStepNumber(event);
      if (step) stepNumbers.add(step);
    });

    const sortedSteps = Array.from(stepNumbers).sort((a, b) => a - b);
    const rows = [];

    sortedSteps.forEach((stepNumber) => {
      const viewedIds = getStepViewLeadIds(events, stepNumber);
      const advancedIds = getStepAdvanceLeadIds(events, stepNumber);

      const views = viewedIds.size;
      const advances = advancedIds.size;
      const abandono = Math.max(views - advances, 0);
      const taxaAbandono = percent(abandono, views);

      rows.push({
        label: `Etapa ${stepNumber}`,
        views,
        advances,
        abandono,
        taxaAbandono
      });
    });

    const pitchViewedIds = getPitchViewLeadIds(events);
    const buyClickedIds = getBuyClickLeadIds(events);

    const pitchViews = pitchViewedIds.size;
    const pitchAdvances = buyClickedIds.size;
    const pitchAbandono = Math.max(pitchViews - pitchAdvances, 0);
    const pitchTaxaAbandono = percent(pitchAbandono, pitchViews);

    rows.push({
      label: "Etapa de venda",
      views: pitchViews,
      advances: pitchAdvances,
      abandono: pitchAbandono,
      taxaAbandono: pitchTaxaAbandono
    });

    rows.push({
      label: "Botão de compra",
      views: buyClickedIds.size,
      advances: buyClickedIds.size,
      abandono: 0,
      taxaAbandono: 0
    });

    return rows;
  }

  function groupByDimension(events, dimensionGetter) {
    const groups = new Map();

    events.forEach((event) => {
      const key = dimensionGetter(event);
      const leadId = normalizeLeadId(event);
      if (!leadId) return;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          leadIds: new Set(),
          completeIds: new Set(),
          pitchIds: new Set(),
          buyIds: new Set()
        });
      }

      const group = groups.get(key);
      const eventName = normalizeEventName(event);

      if (eventName === "session_start" || eventName === "quiz_start") {
        group.leadIds.add(leadId);
      }

      if (eventName === "quiz_complete") {
        group.completeIds.add(leadId);
      }

      if (eventName === "pitch_view") {
        group.pitchIds.add(leadId);
      }

      if (isBuyIntentEvent(event)) {
        group.buyIds.add(leadId);
      }
    });

    return Array.from(groups.values()).map((group) => {
      const leads = group.leadIds.size;
      const completos = group.completeIds.size;
      const venda = group.pitchIds.size;
      const clicks = group.buyIds.size;
      const ctr = percent(clicks, venda);

      return {
        key: group.key,
        leads,
        completos,
        venda,
        clicks,
        ctr
      };
    });
  }

  function sortDimensionRows(rows) {
    return rows.sort((a, b) => {
      if (b.leads !== a.leads) return b.leads - a.leads;
      if (b.clicks !== a.clicks) return b.clicks - a.clicks;
      if (b.venda !== a.venda) return b.venda - a.venda;
      return b.completos - a.completos;
    });
  }

  function buildDashboardData(filteredEvents) {
    const sessions = getSessionLeadIds(filteredEvents).size;
    const completes = getQuizCompleteLeadIds(filteredEvents).size;
    const pitchViews = getPitchViewLeadIds(filteredEvents).size;
    const buyClicks = getBuyClickLeadIds(filteredEvents).size;

    const pitchRate = percent(pitchViews, sessions);
    const buyRate = percent(buyClicks, pitchViews);

    const stepRows = buildStepRows(filteredEvents);
    const campaignRows = sortDimensionRows(groupByDimension(filteredEvents, normalizeCampaign));
    const creativeRows = sortDimensionRows(groupByDimension(filteredEvents, normalizeCreative));

    return {
      sessions,
      completes,
      pitchViews,
      buyClicks,
      pitchRate,
      buyRate,
      stepRows,
      campaignRows,
      creativeRows
    };
  }

  function renderKPIs(data) {
    els.kpiSessions.textContent = String(data.sessions);
    els.kpiCompletes.textContent = String(data.completes);
    els.kpiPitchViews.textContent = String(data.pitchViews);
    els.kpiBuyClicks.textContent = String(data.buyClicks);
    els.kpiPitchRate.textContent = formatPercent(data.pitchRate);
    els.kpiBuyRate.textContent = formatPercent(data.buyRate);
  }

  function renderStepsTable(rows) {
    if (!rows.length) {
      els.stepsTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="muted">Nenhum dado encontrado ainda.</td>
        </tr>
      `;
      return;
    }

    els.stepsTableBody.innerHTML = rows.map((row) => {
      const pillClass = getRatePillClass(100 - row.taxaAbandono);

      return `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          <td>${row.views}</td>
          <td>${row.advances}</td>
          <td>${row.abandono}</td>
          <td><span class="${pillClass}">${formatPercent(row.taxaAbandono)}</span></td>
        </tr>
      `;
    }).join("");
  }

  function renderDimensionTable(tbodyEl, rows) {
    if (!rows.length) {
      tbodyEl.innerHTML = `
        <tr>
          <td colspan="5" class="muted">Nenhum dado encontrado ainda.</td>
        </tr>
      `;
      return;
    }

    tbodyEl.innerHTML = rows.map((row) => {
      const pillClass = getRatePillClass(row.ctr);

      return `
        <tr>
          <td>${escapeHtml(row.key)}</td>
          <td>${row.leads}</td>
          <td>${row.venda}</td>
          <td>${row.clicks}</td>
          <td><span class="${pillClass}">${formatPercent(row.ctr)}</span></td>
        </tr>
      `;
    }).join("");
  }

  function findWorstStep(rows) {
    const valid = rows.filter((row) => row.label !== "Botão de compra");
    if (!valid.length) return null;
    return valid.slice().sort((a, b) => b.taxaAbandono - a.taxaAbandono)[0] || null;
  }

  function findBestCampaign(rows) {
    if (!rows.length) return null;
    return rows.slice().sort((a, b) => {
      if (b.leads !== a.leads) return b.leads - a.leads;
      if (b.clicks !== a.clicks) return b.clicks - a.clicks;
      if (b.ctr !== a.ctr) return b.ctr - a.ctr;
      return b.venda - a.venda;
    })[0] || null;
  }

  function findBestCreative(rows) {
    if (!rows.length) return null;
    return rows.slice().sort((a, b) => {
      if (b.leads !== a.leads) return b.leads - a.leads;
      if (b.clicks !== a.clicks) return b.clicks - a.clicks;
      if (b.venda !== a.venda) return b.venda - a.venda;
      return b.completos - a.completos;
    })[0] || null;
  }

  function renderInsights(data) {
    const cards = [];

    cards.push({
      title: "Leitura geral do funil",
      text: data.sessions > 0
        ? `O período selecionado trouxe ${data.sessions} lead(s), ${data.completes} quiz completo(s), ${data.pitchViews} chegada(s) na etapa de venda e ${data.buyClicks} clique(s) no botão de compra.`
        : "Ainda não existem leads suficientes no período selecionado para gerar leitura do funil."
    });

    const worstStep = findWorstStep(data.stepRows);
    if (worstStep) {
      cards.push({
        title: `Maior gargalo: ${worstStep.label}`,
        text: `Essa etapa está com abandono de ${formatPercent(worstStep.taxaAbandono)}. É o melhor ponto para testar copy, imagem, ordem ou simplificação do fluxo.`
      });
    }

    const bestCampaign = findBestCampaign(data.campaignRows);
    if (bestCampaign) {
      cards.push({
        title: `Campanha com mais entrada de leads: ${bestCampaign.key}`,
        text: `Essa campanha gerou ${bestCampaign.leads} lead(s), ${bestCampaign.venda} chegada(s) na venda e ${bestCampaign.clicks} clique(s) no botão, com CTR de ${formatPercent(bestCampaign.ctr)}.`
      });
    }

    const bestCreative = findBestCreative(data.creativeRows);
    if (bestCreative) {
      cards.push({
        title: `Criativo com mais leads: ${bestCreative.key}`,
        text: `Esse criativo trouxe ${bestCreative.leads} lead(s), ${bestCreative.completos} quiz completo(s), ${bestCreative.venda} chegada(s) na venda e ${bestCreative.clicks} clique(s) no botão.`
      });
    }

    if (!cards.length) {
      cards.push({
        title: "Aguardando dados",
        text: "Navegue pelo funil e depois clique em “Atualizar dashboard”."
      });
    }

    els.insightsList.innerHTML = cards.map((card) => `
      <div class="insight-card">
        <h3>${escapeHtml(card.title)}</h3>
        <p>${escapeHtml(card.text)}</p>
      </div>
    `).join("");
  }

  function updatePeriodLabel(filter) {
    els.currentPeriodLabel.textContent = `Período atual: ${formatDateBr(filter.start)} até ${formatDateBr(filter.end)}`;
  }

  async function runDashboard() {
    const filter = getCurrentFilter();
    updatePeriodLabel(filter);
    saveFilterState(serializeFilter(filter));

    const allEvents = dashboardEventsCache.length ? dashboardEventsCache : await loadAllEvents();
    const filteredEvents = allEvents.filter((event) => isEventInRange(event, filter));
    const data = buildDashboardData(filteredEvents);

    renderKPIs(data);
    renderStepsTable(data.stepRows);
    renderDimensionTable(els.campaignTableBody, data.campaignRows);
    renderDimensionTable(els.creativeTableBody, data.creativeRows);
    renderInsights(data);
  }

  function applyQuickRange(mode) {
    let range;

    if (mode === "today") {
      range = getTodayRange();
    } else if (mode === "yesterday") {
      range = getYesterdayRange();
    } else if (mode === "7days") {
      range = getLast7DaysRange();
    } else {
      range = getTodayRange();
    }

    setActiveQuickButton(mode);
    els.startDate.value = formatDateInput(range.start);
    els.endDate.value = formatDateInput(range.end);

    if (mode !== "custom") {
      runDashboard();
    }
  }

  function initEvents() {
    els.quickButtons.forEach((btn) => {
      btn.addEventListener("click", function () {
        const mode = btn.getAttribute("data-range") || "today";

        if (mode === "custom") {
          setActiveQuickButton("custom");
          return;
        }

        applyQuickRange(mode);
      });
    });

    els.applyFilterBtn.addEventListener("click", function () {
      if (!els.quickButtons.some((btn) => btn.classList.contains("is-active"))) {
        setActiveQuickButton("custom");
      }
      runDashboard();
    });

    els.refreshBtn.addEventListener("click", async function () {
      dashboardEventsCache = [];
      await loadAllEvents();
      runDashboard();
    });
  }

  async function init() {
    const savedFilter = hydrateFilter(getSavedFilterState());

    if (savedFilter) {
      applyFilterToInputs(savedFilter);
    } else {
      applyFilterToInputs({
        mode: "today",
        ...getTodayRange()
      });
    }

    initEvents();
    await loadAllEvents();
    await runDashboard();
  }

  init();
})();
