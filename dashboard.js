(function () {
  const FILTER_STORAGE_KEY = "taichiHarnoDashboardFilter";
  const TRACKING_API_URL = "/api/tracking/events?limit=10000";

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

  async function fetchBackendEvents() {
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
  }

  function normalizeBackendEvent(event) {
    if (!event || typeof event !== "object") return null;

    return {
      id: event.id || null,
      created_at:
        event.created_at ||
        event.event_time ||
        event.inserted_at ||
        event.received_at ||
        event.timestamp ||
        "",
      event_time:
        event.event_time ||
        event.created_at ||
        event.timestamp ||
        "",
      event_name:
        event.event_name ||
        event.event ||
        event.name ||
        "",
      event_id:
        event.event_id ||
        "",
      lead_id:
        event.lead_id ||
        event.leadId ||
        "",
      session_id:
        event.session_id ||
        event.sessionId ||
        "",
      step_id:
        event.step_id ||
        "",
      step_index:
        event.step_index ??
        event.stepIndex ??
        event.step_number ??
        null,
      step_name:
        event.step_name ||
        event.step_label ||
        "",
      step_type:
        event.step_type ||
        "",
      page_type:
        event.page_type ||
        "",
      utm_source:
        event.utm_source ||
        "",
      utm_medium:
        event.utm_medium ||
        "",
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
      button_id:
        event.button_id ||
        "",
      button_text:
        event.button_text ||
        "",
      checkout_url:
        event.checkout_url ||
        "",
      funnel_id:
        event.funnel_id ||
        "",
      funnel_name:
        event.funnel_name ||
        ""
    };
  }

  async function loadAllEvents() {
    const backendEvents = await fetchBackendEvents();
    const deduped = dedupeEvents(backendEvents)
      .sort((a, b) => getEventTime(a) - getEventTime(b));

    dashboardEventsCache = deduped;
    return deduped;
  }

  function dedupeEvents(events) {
    const map = new Map();

    events.forEach((event) => {
      if (!event || typeof event !== "object") return;

      const primaryKey = normalizeString(event.event_id);
      const fallbackKey = [
        normalizeEventName(event),
        normalizeSessionId(event),
        normalizeString(event.step_id),
        normalizeStepNumber(event),
        normalizeString(event.button_id),
        normalizeString(event.button_text),
        normalizeString(event.created_at)
      ].join("|");

      const key = primaryKey || fallbackKey;
      if (!key || key === "||||||") return;

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

  function getEventTime(event) {
    const value = event?.event_time || event?.created_at || "";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

  function isEventInRange(event, filter) {
    const createdAt = getEventTime(event);
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

  function normalizeSessionId(event) {
    return normalizeString(
      event.session_id || event.sessionId,
      ""
    );
  }

  function normalizeLeadId(event) {
    return normalizeString(
      event.lead_id || event.leadId,
      ""
    );
  }

  function normalizeStepNumber(event) {
    const value = Number(
      event.step_index ??
      event.stepIndex ??
      event.step_number ??
      event.step ??
      null
    );

    if (Number.isFinite(value) && value > 0) return value;
    return null;
  }

  function normalizeCampaign(event) {
    return normalizeString(
      event.utm_campaign ||
      event.campaign,
      "Sem campanha"
    );
  }

  function normalizeCreative(event) {
    return normalizeString(
      event.utm_content ||
      event.creative ||
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

  function isSessionStartEvent(eventName) {
    return eventName === "session_start" || eventName === "quiz_start";
  }

  function isBuyClickEvent(eventName) {
    return eventName === "buy_click";
  }

  function isPitchViewEvent(eventName) {
    return eventName === "pitch_view";
  }

  function isQuizCompleteEvent(eventName) {
    return eventName === "quiz_complete";
  }

  function buildJourneys(events) {
    const sessions = new Map();

    events.forEach((event) => {
      const sessionId = normalizeSessionId(event);
      if (!sessionId) return;

      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
          sessionId,
          leadId: normalizeLeadId(event),
          campaign: normalizeCampaign(event),
          creative: normalizeCreative(event),
          utmSource: normalizeString(event.utm_source),
          utmMedium: normalizeString(event.utm_medium),
          started: false,
          completed: false,
          pitchViewed: false,
          buyClicked: false,
          stepViews: new Set(),
          rawEvents: []
        });
      }

      const journey = sessions.get(sessionId);
      const eventName = normalizeEventName(event);
      const stepNumber = normalizeStepNumber(event);

      if (!journey.leadId) {
        journey.leadId = normalizeLeadId(event);
      }

      if (
        journey.campaign === "Sem campanha" &&
        normalizeCampaign(event) !== "Sem campanha"
      ) {
        journey.campaign = normalizeCampaign(event);
      }

      if (
        journey.creative === "Sem criativo" &&
        normalizeCreative(event) !== "Sem criativo"
      ) {
        journey.creative = normalizeCreative(event);
      }

      journey.rawEvents.push(event);

      if (isSessionStartEvent(eventName)) {
        journey.started = true;
      }

      if (eventName === "step_view" && stepNumber) {
        journey.stepViews.add(stepNumber);
      }

      if (isQuizCompleteEvent(eventName)) {
        journey.completed = true;
      }

      if (isPitchViewEvent(eventName)) {
        journey.pitchViewed = true;
      }

      if (isBuyClickEvent(eventName)) {
        journey.buyClicked = true;
      }
    });

    return Array.from(sessions.values()).map((journey) => {
      journey.rawEvents.sort((a, b) => getEventTime(a) - getEventTime(b));
      return journey;
    });
  }

  function buildStepRowsFromJourneys(journeys) {
    const maxStep = journeys.reduce((acc, journey) => {
      const highest = Math.max(0, ...Array.from(journey.stepViews));
      return Math.max(acc, highest);
    }, 0);

    const rows = [];

    for (let stepNumber = 1; stepNumber <= maxStep; stepNumber += 1) {
      let views = 0;
      let advances = 0;

      journeys.forEach((journey) => {
        const hasCurrent = journey.stepViews.has(stepNumber);
        if (!hasCurrent) return;

        views += 1;

        const hasAdvance =
          journey.stepViews.has(stepNumber + 1) ||
          (stepNumber === maxStep && journey.completed) ||
          (journey.completed && stepNumber < maxStep);

        if (hasAdvance) {
          advances += 1;
        }
      });

      const abandono = Math.max(views - advances, 0);
      const taxaAbandono = percent(abandono, views);

      rows.push({
        label: `Etapa ${stepNumber}`,
        views,
        advances,
        abandono,
        taxaAbandono
      });
    }

    const pitchViews = journeys.filter((journey) => journey.pitchViewed).length;
    const pitchAdvances = journeys.filter((journey) => journey.buyClicked).length;
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
      views: pitchAdvances,
      advances: pitchAdvances,
      abandono: 0,
      taxaAbandono: 0
    });

    return rows;
  }

  function groupJourneysByDimension(journeys, getter) {
    const groups = new Map();

    journeys.forEach((journey) => {
      const key = getter(journey);

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          leads: 0,
          completos: 0,
          venda: 0,
          clicks: 0
        });
      }

      const group = groups.get(key);

      group.leads += 1;
      if (journey.completed) group.completos += 1;
      if (journey.pitchViewed) group.venda += 1;
      if (journey.buyClicked) group.clicks += 1;
    });

    return Array.from(groups.values()).map((group) => ({
      ...group,
      ctr: percent(group.clicks, group.venda)
    }));
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
    const journeys = buildJourneys(filteredEvents);

    const sessions = journeys.length;
    const completes = journeys.filter((journey) => journey.completed).length;
    const pitchViews = journeys.filter((journey) => journey.pitchViewed).length;
    const buyClicks = journeys.filter((journey) => journey.buyClicked).length;

    const pitchRate = percent(pitchViews, sessions);
    const buyRate = percent(buyClicks, pitchViews);

    const stepRows = buildStepRowsFromJourneys(journeys);
    const campaignRows = sortDimensionRows(
      groupJourneysByDimension(journeys, (journey) => journey.campaign || "Sem campanha")
    );
    const creativeRows = sortDimensionRows(
      groupJourneysByDimension(journeys, (journey) => journey.creative || "Sem criativo")
    );

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
      title: "Resumo do período",
      text: data.sessions > 0
        ? `O período selecionado trouxe ${data.sessions} sessão(ões), ${data.completes} quiz completo(s), ${data.pitchViews} chegada(s) na etapa de venda e ${data.buyClicks} clique(s) reais no botão de compra.`
        : "Ainda não existem sessões suficientes no período selecionado para gerar leitura do funil."
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
        title: `Campanha com mais entrada de sessões: ${bestCampaign.key}`,
        text: `Essa campanha gerou ${bestCampaign.leads} sessão(ões), ${bestCampaign.venda} chegada(s) na venda e ${bestCampaign.clicks} clique(s) reais no botão, com CTR de ${formatPercent(bestCampaign.ctr)}.`
      });
    }

    const bestCreative = findBestCreative(data.creativeRows);
    if (bestCreative) {
      cards.push({
        title: `Criativo com mais sessões: ${bestCreative.key}`,
        text: `Esse criativo trouxe ${bestCreative.leads} sessão(ões), ${bestCreative.completos} quiz completo(s), ${bestCreative.venda} chegada(s) na venda e ${bestCreative.clicks} clique(s) reais no botão.`
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

    const allEvents = dashboardEventsCache.length
      ? dashboardEventsCache
      : await loadAllEvents();

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
      await runDashboard();
    });
  }

  async function init() {
    const savedFilter = hydrateFilter(getSavedFilterState());

    if (savedFilter) {
      applyFilterToInputs(savedFilter);
    } else {
      const today = getTodayRange();
      applyFilterToInputs({
        mode: "today",
        start: today.start,
        end: today.end
      });
    }

    initEvents();
    await loadAllEvents();
    await runDashboard();
  }

  init();
})();
