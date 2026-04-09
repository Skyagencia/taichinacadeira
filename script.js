(function () {
  const funnel = window.FUNNEL_DATA;

  if (!funnel || !Array.isArray(funnel.steps) || funnel.steps.length === 0) {
    console.error("FUNNEL_DATA não encontrado ou inválido.");
    return;
  }

  const stageEl = document.getElementById("funnelStage");
  const progressBarEl = document.getElementById("topProgressBar");
  const progressTextEl = document.getElementById("topProgressText");

  const TRACKING_STORAGE_KEY = "taichiHarnoTracking";
  const SALES_STORAGE_KEY = "taichiHarnoSalesData";
  const ANSWERS_STORAGE_KEY = "taichiHarnoAnswers";
  const TRACKING_CONTEXT_STORAGE_KEY = "taichiHarnoTrackingContext";
  const LEAD_STORAGE_KEY = "taichiHarnoLeadId";
  const SESSION_STORAGE_KEY = "taichiHarnoSessionId";
  const SESSION_STARTED_KEY = "taichiHarnoSessionStarted";
  const PAGE_VIEW_KEY = "taichiHarnoPageViewed";
  const VIEW_CONTENT_KEY = "taichiHarnoViewContentViewed";
  const QUIZ_START_KEY = "taichiHarnoQuizStarted";

  const state = {
    currentStepId: funnel.steps[0].id,
    answers: {},
    timeouts: [],
    intervals: [],
    tracking: null
  };

  function clearPendingTimeouts() {
    state.timeouts.forEach((id) => clearTimeout(id));
    state.intervals.forEach((id) => clearInterval(id));
    state.timeouts = [];
    state.intervals = [];
  }

  function schedule(fn, delay) {
    const id = setTimeout(fn, delay);
    state.timeouts.push(id);
    return id;
  }

  function scheduleInterval(fn, delay) {
    const id = setInterval(fn, delay);
    state.intervals.push(id);
    return id;
  }

  function getStepById(stepId) {
    return funnel.steps.find((step) => step.id === stepId) || null;
  }

  function getCurrentStep() {
    return getStepById(state.currentStepId);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function interpolate(text) {
    return String(text || "").replace(/\{\{(.*?)\}\}/g, (_, key) => {
      const cleanKey = String(key || "").trim();
      const value = state.answers[cleanKey];
      if (Array.isArray(value)) return value.join(", ");
      return value != null ? String(value) : "";
    });
  }

  function nl2br(text) {
    return escapeHtml(interpolate(text)).replace(/\n/g, "<br>");
  }

  function setProgress(step) {
    const total = funnel.meta?.totalSteps || funnel.steps.length;
    const current = step.index || 1;
    const percent = Math.max(0, Math.min(100, (current / total) * 100));

    progressBarEl.style.width = `${percent}%`;

    if (progressTextEl) {
      progressTextEl.textContent = "";
      progressTextEl.style.display = "none";
    }
  }

  function generateId(prefix) {
    const random = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36);
    return `${prefix}_${time}_${random}`;
  }

  function getOrCreateStorageValue(storage, key, prefix) {
    try {
      const existing = storage.getItem(key);
      if (existing) return existing;

      const created = generateId(prefix);
      storage.setItem(key, created);
      return created;
    } catch (error) {
      console.warn(`Não foi possível acessar ${key}.`, error);
      return generateId(prefix);
    }
  }

  function getOrCreateLocalStorageValue(key, prefix) {
    return getOrCreateStorageValue(window.localStorage, key, prefix);
  }

  function getOrCreateSessionStorageValue(key, prefix) {
    return getOrCreateStorageValue(window.sessionStorage, key, prefix);
  }

  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      utm_term: params.get("utm_term") || "",
      fbp: params.get("fbp") || "",
      fbc: params.get("fbc") || ""
    };
  }

  function normalizeTrackingValue(value) {
    return String(value || "").trim();
  }

  function getStoredTrackingContext() {
    try {
      const raw = window.localStorage.getItem(TRACKING_CONTEXT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      console.warn("Não foi possível ler o contexto de tracking salvo.", error);
      return {};
    }
  }

  function saveTrackingContext(context) {
    try {
      window.localStorage.setItem(
        TRACKING_CONTEXT_STORAGE_KEY,
        JSON.stringify(context || {})
      );
    } catch (error) {
      console.warn("Não foi possível salvar o contexto de tracking.", error);
    }
  }

  function buildTrackingContext() {
    const urlData = getUrlParams();
    const storedTracking = getStoredTrackingContext();

    const leadId =
      normalizeTrackingValue(storedTracking.lead_id) ||
      getOrCreateLocalStorageValue(LEAD_STORAGE_KEY, "lead");

    const sessionId = getOrCreateSessionStorageValue(SESSION_STORAGE_KEY, "sess");

    return {
      lead_id: leadId,
      session_id: sessionId,
      utm_source:
        normalizeTrackingValue(urlData.utm_source) ||
        normalizeTrackingValue(storedTracking.utm_source),
      utm_medium:
        normalizeTrackingValue(urlData.utm_medium) ||
        normalizeTrackingValue(storedTracking.utm_medium),
      utm_campaign:
        normalizeTrackingValue(urlData.utm_campaign) ||
        normalizeTrackingValue(storedTracking.utm_campaign),
      utm_content:
        normalizeTrackingValue(urlData.utm_content) ||
        normalizeTrackingValue(storedTracking.utm_content),
      utm_term:
        normalizeTrackingValue(urlData.utm_term) ||
        normalizeTrackingValue(storedTracking.utm_term),
      fbp:
        normalizeTrackingValue(urlData.fbp) ||
        normalizeTrackingValue(storedTracking.fbp),
      fbc:
        normalizeTrackingValue(urlData.fbc) ||
        normalizeTrackingValue(storedTracking.fbc)
    };
  }

  function loadTrackingContext() {
    state.tracking = buildTrackingContext();
    saveTrackingContext(state.tracking);
  }

  function getStoredEvents() {
    try {
      const raw = window.localStorage.getItem(TRACKING_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Não foi possível ler os eventos do tracking.", error);
      return [];
    }
  }

  function saveStoredEvents(events) {
    try {
      window.localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(events));
    } catch (error) {
      console.warn("Não foi possível salvar os eventos do tracking.", error);
    }
  }

  function getTrackingEndpoint() {
    return "/track-event";
  }

  function buildBackendTrackingPayload(event) {
    return {
      event_time: event.created_at || new Date().toISOString(),
      funnel_id: event.quiz_id || funnel.meta?.id || "taichi-harno-funil",
      funnel_name: event.quiz_name || funnel.meta?.name || "Tai Chi para Iniciantes",
      page_type: event.page_type || "quiz",
      page_url: event.page_url || window.location.href,
      page_path: event.page_path || window.location.pathname,
      referrer: document.referrer || "",
      event_name: event.event_name || "",
      event_id: event.event_id || "",
      event_source: "website",
      lead_id: event.lead_id || "",
      session_id: event.session_id || "",
      step_id: event.step_id || "",
      step_index:
        event.step_index ??
        event.step_number ??
        (Number.isFinite(Number(event.destination_step_number))
          ? Number(event.destination_step_number)
          : null),
      step_name: event.step_label || "",
      step_type: event.step_type || "",
      button_id: event.button_id || "",
      button_text: event.button_text || event.button_label || "",
      checkout_url: event.checkout_url || "",
      utm_source: event.utm_source || "",
      utm_medium: event.utm_medium || "",
      utm_campaign: event.utm_campaign || "",
      utm_content: event.utm_content || "",
      utm_term: event.utm_term || "",
      fbp: event.fbp || "",
      fbc: event.fbc || "",
      payload: event
    };
  }

  function sendEventToBackend(event) {
    const payload = buildBackendTrackingPayload(event);
    const body = JSON.stringify(payload);
    const endpoint = getTrackingEndpoint();

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        const queued = navigator.sendBeacon(endpoint, blob);
        if (queued) return;
      }
    } catch (error) {
      console.warn("Falha no sendBeacon do tracking.", error);
    }

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body,
      keepalive: true
    }).catch((error) => {
      console.warn("Falha ao enviar evento para o backend.", error);
    });
  }

  function buildEventId(eventName, extra = {}) {
    if (!state.tracking) loadTrackingContext();

    const safeEventName = String(eventName || "event")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_");

    if (safeEventName === "page_view" && window.__TAICHI_META_EVENT_IDS__?.page_view) {
      return window.__TAICHI_META_EVENT_IDS__.page_view;
    }

    if (safeEventName === "view_content" && window.__TAICHI_META_EVENT_IDS__?.view_content) {
      return window.__TAICHI_META_EVENT_IDS__.view_content;
    }

    const stepId = String(extra.step_id || extra.destination_step_id || state.currentStepId || "step")
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "_");

    return [
      safeEventName,
      state.tracking?.lead_id || "lead",
      state.tracking?.session_id || "session",
      stepId,
      Date.now()
    ].join("_");
  }

  function trackEvent(eventName, extra = {}) {
    if (!state.tracking) loadTrackingContext();

    const event = {
      event_name: String(eventName || "").trim(),
      event_id: buildEventId(eventName, extra),
      created_at: new Date().toISOString(),
      page_url: window.location.href,
      page_path: window.location.pathname,
      page_type: "quiz",
      quiz_id: funnel.meta?.id || "taichi-harno-funil",
      quiz_name: funnel.meta?.name || "Tai Chi para Iniciantes",
      lead_id: state.tracking.lead_id,
      session_id: state.tracking.session_id,
      utm_source: state.tracking.utm_source,
      utm_medium: state.tracking.utm_medium,
      utm_campaign: state.tracking.utm_campaign,
      utm_content: state.tracking.utm_content,
      utm_term: state.tracking.utm_term,
      fbp: state.tracking.fbp,
      fbc: state.tracking.fbc,
      ...extra
    };

    const events = getStoredEvents();
    events.push(event);
    saveStoredEvents(events);
    sendEventToBackend(event);
  }

  function trackPageEntryOnce() {
    try {
      if (!window.sessionStorage.getItem(PAGE_VIEW_KEY)) {
        trackEvent("page_view");
        window.sessionStorage.setItem(PAGE_VIEW_KEY, "1");
      }

      if (!window.sessionStorage.getItem(VIEW_CONTENT_KEY)) {
        trackEvent("view_content", {
          content_name: funnel.meta?.name || "Tai Chi para Iniciantes",
          content_category: "Funil",
          content_type: "product"
        });
        window.sessionStorage.setItem(VIEW_CONTENT_KEY, "1");
      }

      if (!window.sessionStorage.getItem(SESSION_STARTED_KEY)) {
        trackEvent("session_start");
        window.sessionStorage.setItem(SESSION_STARTED_KEY, "1");
      }

      if (!window.sessionStorage.getItem(QUIZ_START_KEY)) {
        trackEvent("quiz_start");
        window.sessionStorage.setItem(QUIZ_START_KEY, "1");
      }
    } catch (error) {
      console.warn("Não foi possível marcar eventos iniciais.", error);
    }
  }

  function trackStepView(step) {
    if (!step) return;

    trackEvent("step_view", {
      step_id: step.id || "",
      step_number: Number(step.index || 0),
      step_type: step.stepType || "",
      step_label: step.index ? `Etapa ${step.index}` : ""
    });
  }

  function trackStepAdvance(step, destinationStepId) {
    if (!step) return;

    const destination = destinationStepId ? getStepById(destinationStepId) : null;

    trackEvent("step_advance", {
      step_id: step.id || "",
      step_number: Number(step.index || 0),
      step_type: step.stepType || "",
      step_label: step.index ? `Etapa ${step.index}` : "",
      destination_step_id: destination?.id || destinationStepId || "",
      destination_step_number: Number(destination?.index || 0)
    });
  }

  function trackQuizComplete(step) {
    const current = step || getCurrentStep();
    trackEvent("quiz_complete", {
      step_id: current?.id || "",
      step_number: Number(current?.index || 0),
      step_label: current?.index ? `Etapa ${current.index}` : ""
    });
  }

  function goToStep(stepId) {
    if (!stepId) return;
    const next = getStepById(stepId);
    if (!next) {
      console.warn("Etapa não encontrada:", stepId);
      return;
    }

    clearPendingTimeouts();
    state.currentStepId = stepId;
    renderCurrentStep();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goNext(step) {
    if (!step || !step.next) return;
    trackStepAdvance(step, step.next);
    goToStep(step.next);
  }

  function normalizeLabel(value, fallback = "—") {
    const text = String(value || "").trim();
    return text || fallback;
  }

  function formatKg(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return "-- kg";
    return `${num} kg`;
  }

  function getNumericAnswer(key, fallback = 0) {
    const value = Number(state.answers[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function getArrayAnswer(key) {
    const value = state.answers[key];
    return Array.isArray(value) ? value : [];
  }

  function getStringAnswer(key, fallback = "") {
    const value = state.answers[key];
    return value != null ? String(value) : fallback;
  }

  function normalizeSleepScore(label) {
    if (/menos de 5/i.test(label)) return 2;
    if (/5\s*-\s*6/i.test(label)) return 5;
    if (/7\s*-\s*8/i.test(label)) return 8;
    if (/mais de 8/i.test(label)) return 7;
    return 5;
  }

  function normalizeEnergyScore(label) {
    if (/exausto/i.test(label)) return 2;
    if (/variam/i.test(label)) return 5;
    if (/enérgico|ener[gé]tico|ativo/i.test(label)) return 8;
    return 5;
  }

  function calculateTrainingIntensity() {
    const preferencia = getStringAnswer("preferencia_inicio_treino", "");
    const dores = getArrayAnswer("areas_desconforto");
    const energyLabel = getStringAnswer("nivel_energia", "");
    const rotinaLabel = getStringAnswer("dia_normal", "");
    const subirEscadasLabel = getStringAnswer("subir_escadas", "");
    const rigidezLabel = getStringAnswer("rigidez_pescoco", "");
    const idadeLabel = getStringAnswer("faixa_etaria", "50 - 59 anos");
    const tipoCorpo = getStringAnswer("tipo_corpo_atual", "");

    let score = 0;

    if (/bem leve/i.test(preferencia)) score -= 2;
    else if (/intermedi[áa]rio/i.test(preferencia)) score += 0;
    else if (/mais ativo/i.test(preferencia)) score += 2;
    else if (/voc[êe]s decidam/i.test(preferencia)) score += 0;

    if (dores.length >= 3) score -= 3;
    else if (dores.length === 2) score -= 2;
    else if (dores.length === 1) score -= 1;

    if (/exausto/i.test(energyLabel)) score -= 2;
    else if (/variam/i.test(energyLabel)) score -= 1;
    else if (/enérgico|ener[gé]tico|ativo/i.test(energyLabel)) score += 1;

    if (/maior parte do tempo parado/i.test(rotinaLabel)) score -= 2;
    else if (/movimento pouco/i.test(rotinaLabel)) score -= 1;
    else if (/ativo na maior parte do tempo/i.test(rotinaLabel)) score += 1;

    if (/não consigo subir/i.test(subirEscadasLabel)) score -= 2;
    else if (/sem fôlego/i.test(subirEscadasLabel)) score -= 1;
    else if (/com tranquilidade/i.test(subirEscadasLabel)) score += 1;

    if (/sim/i.test(rigidezLabel)) score -= 1;
    if (/bem acima do peso/i.test(tipoCorpo)) score -= 2;
    else if (/acima do peso/i.test(tipoCorpo)) score -= 1;
    if (/\+70/.test(idadeLabel)) score -= 1;

    if (score <= -3) return "Leve";
    if (score >= 2) return "Alta";
    return "Média";
  }

  function getPrimaryObjectiveLabel() {
    const objetivo = getStringAnswer("objetivo_principal", "");
    return normalizeLabel(objetivo, "Melhorar condicionamento e mobilidade");
  }

  function getObjectiveCategory() {
    const objetivo = getPrimaryObjectiveLabel().toLowerCase();

    if (objetivo.includes("perder barriga") || objetivo.includes("emagrecer")) {
      return "emagrecimento";
    }
    if (objetivo.includes("dor")) {
      return "dores";
    }
    if (objetivo.includes("força") || objetivo.includes("músculo")) {
      return "fortalecimento";
    }
    if (objetivo.includes("testosterona")) {
      return "vitalidade";
    }
    return "longevidade";
  }

  function getProfileName(profile) {
    const objectiveCategory = getObjectiveCategory();

    if (objectiveCategory === "emagrecimento") {
      return profile.doresCount > 0
        ? "Queima de gordura com proteção articular"
        : "Queima de gordura progressiva 40+";
    }

    if (objectiveCategory === "dores") {
      return "Recuperação articular e mobilidade";
    }

    if (objectiveCategory === "fortalecimento") {
      return profile.intensityLabel === "Alta"
        ? "Fortalecimento progressivo e definição"
        : "Fortalecimento com baixo impacto";
    }

    if (objectiveCategory === "vitalidade") {
      return "Vitalidade masculina com ativação segura";
    }

    return "Longevidade ativa com mobilidade";
  }

  function getInitialFocus(profile) {
    const objectiveCategory = getObjectiveCategory();

    if (objectiveCategory === "emagrecimento") {
      return profile.doresCount > 0
        ? "destravar o corpo, reduzir sobrecarga e aumentar constância"
        : "ativar a queima de gordura com progressão segura";
    }

    if (objectiveCategory === "dores") {
      return "reduzir travamento, recuperar mobilidade e proteger articulações";
    }

    if (objectiveCategory === "fortalecimento") {
      return "ganhar firmeza corporal sem sobrecarregar articulações";
    }

    if (objectiveCategory === "vitalidade") {
      return "acordar o corpo, melhorar disposição e recuperar presença física";
    }

    return "criar consistência, mobilidade e energia para envelhecer bem";
  }

  function getInitialRestriction(profile) {
    if (profile.doresCount >= 2) {
      return "sem impacto e sem sobrecarga nas articulações mais sensíveis";
    }
    if (profile.intensityLabel === "Leve") {
      return "começar sem excesso de esforço para evitar travamento e desistência";
    }
    if (/exausto/i.test(profile.energiaLabel) || /5\s*-\s*6|menos de 5/i.test(profile.sonoLabel)) {
      return "priorizar constância antes de aumentar intensidade";
    }
    return "evoluir com segurança antes de avançar para estímulos mais fortes";
  }

  function getDurationRecommendation(profile) {
    const preferencia = getStringAnswer("duracao_rotina", "");

    if (profile.intensityLabel === "Leve") {
      return "7 minutos por dia nas primeiras 2 semanas";
    }

    if (/30 minutos/i.test(preferencia) && profile.intensityLabel !== "Alta") {
      return "começar com 15 minutos por dia e subir depois";
    }

    if (/15 minutos/i.test(preferencia)) {
      return "15 minutos por dia com progressão gradual";
    }

    if (/30 minutos/i.test(preferencia) && profile.intensityLabel === "Alta") {
      return "30 minutos por dia com progressão controlada";
    }

    return "7 minutos por dia para consolidar constância";
  }

  function getWhyPlanItems(profile) {
    const items = [
      `seu objetivo principal é ${getPrimaryObjectiveLabel().toLowerCase()}`,
      `sua intensidade inicial ideal hoje é ${profile.intensityLabel.toLowerCase()}`
    ];

    if (profile.doresCount > 0) {
      items.push(`você relatou desconforto em ${profile.doresCount} área(s) do corpo`);
    }

    if (profile.energyScore <= 5) {
      items.push("seu nível de energia pede um começo mais inteligente e progressivo");
    }

    if (profile.sleepScore <= 5) {
      items.push("seu sono atual indica que o corpo precisa de constância antes de intensidade");
    }

    items.push(`sua meta atual é sair de ${formatKg(profile.pesoAtual)} em direção a ${formatKg(profile.pesoMeta)}`);

    return items.slice(0, 5);
  }

  function getTimeline(profile) {
    const objectiveCategory = getObjectiveCategory();

    if (objectiveCategory === "dores") {
      return [
        "Semana 1-2: menos travamento e mais confiança para se mover",
        "Semana 3-4: melhora de mobilidade e redução de desconfortos",
        "Semana 5-6: mais estabilidade corporal e menos rigidez",
        "Semana 7-8: sensação de corpo mais solto, seguro e funcional"
      ];
    }

    if (objectiveCategory === "fortalecimento") {
      return [
        "Semana 1-2: ativação corporal e retomada do ritmo",
        "Semana 3-4: mais firmeza e controle dos movimentos",
        "Semana 5-6: evolução visível em postura e consistência",
        "Semana 7-8: corpo mais forte, definido e responsivo"
      ];
    }

    if (objectiveCategory === "vitalidade") {
      return [
        "Semana 1-2: corpo mais desperto e menos cansaço no dia a dia",
        "Semana 3-4: melhora na disposição e na presença física",
        "Semana 5-6: mais vigor, ritmo e sensação de controle",
        "Semana 7-8: energia mais estável e corpo mais firme"
      ];
    }

    if (objectiveCategory === "longevidade") {
      return [
        "Semana 1-2: criação do hábito sem sofrimento",
        "Semana 3-4: mais leveza e segurança nos movimentos",
        "Semana 5-6: ganho perceptível de mobilidade e equilíbrio",
        "Semana 7-8: rotina sustentável para manter o corpo ativo"
      ];
    }

    return [
      "Semana 1-2: destravar o corpo e criar constância",
      "Semana 3-4: reduzir retenção, sobrecarga e sensação de peso",
      "Semana 5-6: notar cintura mais leve e mais disposição",
      "Semana 7-8: consolidar perda de medidas com segurança"
    ];
  }

  function buildDynamicHeadline(profile, nomeLead) {
    const prefixo = nomeLead ? `${nomeLead}, ` : "";
    return `${prefixo}com base nas suas respostas, identificamos que seu foco principal é ${getPrimaryObjectiveLabel().toLowerCase()}, com intensidade ${profile.intensityLabel.toLowerCase()} e um início pensado para ${profile.focusInitial}.`;
  }

  function buildDynamicResumo(profile, nomeLead) {
    const prefixo = nomeLead ? `${nomeLead}, ` : "";
    const partes = [
      `${prefixo}seu perfil mostra que o melhor caminho para você hoje é começar com um plano ${profile.intensityLabel.toLowerCase()}, ${profile.restrictionInitial}.`,
      `O foco inicial será ${profile.focusInitial}.`,
      `Sua recomendação de ritmo é ${profile.durationRecommendation}.`
    ];

    if (profile.doresCount > 0) {
      partes.push(`Como você relatou desconforto em ${profile.doresCount} área(s), seu plano foi configurado para proteger essas regiões enquanto você evolui.`);
    }

    return partes.join(" ");
  }

  function getCompatibilityPercent(profile) {
    let percent = 89;
    if (profile.intensityLabel === "Leve") percent += 2;
    if (profile.doresCount > 0) percent += 1;
    if (profile.energyScore <= 5) percent += 1;
    return Math.min(97, Math.max(88, percent));
  }

  function calculateProfile() {
    const idadeLabel = getStringAnswer("faixa_etaria", "50 - 59 anos");
    const alturaCm = getNumericAnswer("altura_cm", 170);
    const pesoAtual = getNumericAnswer("peso_atual", 82);
    const pesoMeta = getNumericAnswer("peso_meta", Math.max(70, pesoAtual - 8));
    const alturaM = alturaCm / 100;

    const imc = +(pesoAtual / (alturaM * alturaM)).toFixed(1);
    const targetImc = +(pesoMeta / (alturaM * alturaM)).toFixed(1);

    let faixa = "Normal";
    let faixaColor = "#16a34a";
    let faixaPercent = 40;

    if (imc < 18.5) {
      faixa = "Abaixo do peso";
      faixaColor = "#0ea5e9";
      faixaPercent = 10;
    } else if (imc < 25) {
      faixa = "Normal";
      faixaColor = "#16a34a";
      faixaPercent = 35;
    } else if (imc < 30) {
      faixa = "Sobrepeso";
      faixaColor = "#f59e0b";
      faixaPercent = 67;
    } else {
      faixa = "Obesidade";
      faixaColor = "#ef4444";
      faixaPercent = 87;
    }

    const sonoLabel = getStringAnswer("horas_sono", "5 - 6 horas");
    const energiaLabel = getStringAnswer("nivel_energia", "Meus níveis de energia variam ao longo do dia");
    const dores = getArrayAnswer("areas_desconforto");
    const incomodos = getArrayAnswer("incomodos_hoje");
    const gorduraFreq = getStringAnswer("alimentos_gordurosos", "3 - 5 vezes por semana");

    const sleepScore = normalizeSleepScore(sonoLabel);
    const energyScore = normalizeEnergyScore(energiaLabel);
    const dorScore = dores.length >= 3 ? 3 : dores.length === 2 ? 5 : dores.length === 1 ? 7 : 8;
    const mobilityScore =
      getStringAnswer("rigidez_pescoco").includes("Sim") || getStringAnswer("aguenta_bracos").includes("Não") ? 4 : 7;
    const metabolismoScore = /quase todos/i.test(gorduraFreq) ? 4 : /3\s*-\s*5/i.test(gorduraFreq) ? 6 : 8;

    const diferencaPeso = Math.max(0, +(pesoAtual - pesoMeta).toFixed(1));
    const objetivo = diferencaPeso > 0 ? `${diferencaPeso} kg até a meta` : "manutenção e definição";
    const motivacao = incomodos.length >= 3 ? "Alta" : incomodos.length === 2 ? "Boa" : "Moderada";

    let resumo = "";
    if (imc >= 30) {
      resumo =
        "Seu resultado indica uma faixa de obesidade, com tendência maior a sobrecarga articular, fadiga e dificuldade para manter constância em treinos comuns.";
    } else if (imc >= 25) {
      resumo =
        "Seu resultado indica sobrepeso, o que já costuma aumentar cansaço, rigidez e desconfortos articulares no dia a dia.";
    } else {
      resumo =
        "Seu resultado está fora da faixa de sobrepeso, mas ainda mostra espaço claro para melhorar mobilidade, disposição e composição corporal.";
    }

    if (sleepScore <= 5) {
      resumo += " Seu sono também parece estar abaixo do ideal, o que reduz recuperação, energia e controle do apetite.";
    }

    if (energyScore <= 5) {
      resumo += " Além disso, seu nível de energia sugere que o corpo está trabalhando com mais desgaste do que deveria.";
    }

    if (dores.length > 0) {
      resumo += ` Como você relatou desconforto em ${dores.length} área(s), a estratégia precisa respeitar articulações e focar progresso sem impacto excessivo.`;
    }

    const ageText = idadeLabel.replace(/\s+/g, " ").trim();
    const intensityLabel = calculateTrainingIntensity();
    const objectiveCategory = getObjectiveCategory();

    const profileBase = {
      idadeLabel: ageText,
      alturaCm,
      pesoAtual,
      pesoMeta,
      imc,
      targetImc,
      faixa,
      faixaColor,
      faixaPercent,
      objetivo,
      motivacao,
      sonoLabel,
      energiaLabel,
      resumo,
      doresCount: dores.length,
      sleepScore,
      energyScore,
      intensityLabel,
      objectiveCategory
    };

    const profileName = getProfileName(profileBase);
    const focusInitial = getInitialFocus({ ...profileBase, profileName });
    const restrictionInitial = getInitialRestriction({ ...profileBase, profileName, focusInitial });
    const durationRecommendation = getDurationRecommendation({
      ...profileBase,
      profileName,
      focusInitial,
      restrictionInitial
    });
    const compatibilityPercent = getCompatibilityPercent({
      ...profileBase,
      profileName,
      focusInitial,
      restrictionInitial,
      durationRecommendation
    });
    const whyPlanItems = getWhyPlanItems({
      ...profileBase,
      profileName,
      focusInitial,
      restrictionInitial,
      durationRecommendation,
      compatibilityPercent
    });
    const timeline = getTimeline({
      ...profileBase,
      profileName,
      focusInitial,
      restrictionInitial,
      durationRecommendation,
      compatibilityPercent
    });
    const planWhy = `Seu plano foi escolhido porque seu objetivo hoje é ${getPrimaryObjectiveLabel().toLowerCase()}, sua intensidade ideal de entrada é ${intensityLabel.toLowerCase()} e o melhor caminho para o seu corpo neste momento é ${focusInitial}.`;

    return {
      idadeLabel: ageText,
      alturaCm,
      pesoAtual,
      pesoMeta,
      imc,
      targetImc,
      faixa,
      faixaColor,
      faixaPercent,
      objetivo,
      motivacao,
      sonoLabel,
      energiaLabel,
      resumo,
      doresCount: dores.length,
      sleepScore,
      energyScore,
      intensityLabel,
      objectiveCategory,
      profileName,
      focusInitial,
      restrictionInitial,
      durationRecommendation,
      compatibilityPercent,
      whyPlanItems,
      timeline,
      planWhy,
      scores: {
        energia: energyScore,
        sono: sleepScore,
        dor: dorScore,
        mobilidade: mobilityScore,
        metabolismo: metabolismoScore
      }
    };
  }

  function buildSalesPayload() {
    const profile = calculateProfile();
    const nomeLead = normalizeLabel(state.answers.nome || "", "");

    return {
      generatedAt: new Date().toISOString(),
      answers: { ...state.answers },
      tracking: {
        lead_id: state.tracking?.lead_id || "",
        session_id: state.tracking?.session_id || "",
        utm_source: state.tracking?.utm_source || "",
        utm_medium: state.tracking?.utm_medium || "",
        utm_campaign: state.tracking?.utm_campaign || "",
        utm_content: state.tracking?.utm_content || "",
        utm_term: state.tracking?.utm_term || "",
        fbp: state.tracking?.fbp || "",
        fbc: state.tracking?.fbc || ""
      },
      profile: {
        nome: nomeLead,
        idadeLabel: profile.idadeLabel,
        alturaCm: profile.alturaCm,
        pesoAtual: profile.pesoAtual,
        pesoMeta: profile.pesoMeta,
        imc: profile.imc,
        targetImc: profile.targetImc,
        faixa: profile.faixa,
        faixaColor: profile.faixaColor,
        faixaPercent: profile.faixaPercent,
        objetivoResumo: profile.objetivo,
        motivacao: profile.motivacao,
        sonoLabel: profile.sonoLabel,
        energiaLabel: profile.energiaLabel,
        resumo: profile.resumo,
        profileName: profile.profileName,
        focusInitial: profile.focusInitial,
        restrictionInitial: profile.restrictionInitial,
        durationRecommendation: profile.durationRecommendation,
        compatibilityPercent: profile.compatibilityPercent,
        whyPlanItems: profile.whyPlanItems,
        timeline: profile.timeline,
        planWhy: profile.planWhy,
        doresCount: profile.doresCount,
        intensityLabel: profile.intensityLabel,
        objectiveCategory: profile.objectiveCategory,
        scores: profile.scores
      },
      salesView: {
        nome: nomeLead,
        saudacaoNome: nomeLead ? `${nomeLead},` : "",
        objetivo: getPrimaryObjectiveLabel(),
        intensidade: profile.intensityLabel,
        pesoAtual: formatKg(profile.pesoAtual),
        pesoMeta: formatKg(profile.pesoMeta),
        imc: String(profile.imc),
        faixaImc: profile.faixa,
        motivacao: profile.motivacao,
        energia: profile.energiaLabel,
        sono: profile.sonoLabel,
        headlineResumo: buildDynamicHeadline(profile, nomeLead),
        resumo: buildDynamicResumo(profile, nomeLead),
        profileName: profile.profileName,
        focusInitial: profile.focusInitial,
        restrictionInitial: profile.restrictionInitial,
        durationRecommendation: profile.durationRecommendation,
        compatibilityPercent: String(profile.compatibilityPercent),
        whyPlanItems: profile.whyPlanItems,
        timeline: profile.timeline,
        planWhy: profile.planWhy
      }
    };
  }

  function persistSalesPayload() {
    try {
      const payload = buildSalesPayload();
      window.localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(payload));
      window.localStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(state.answers));
    } catch (error) {
      console.warn("Não foi possível salvar os dados do pitch:", error);
    }
  }

  function renderLogo(step) {
    if (!step.logo) return "";
    return `
      <div class="brand-wrap">
        <img class="brand-logo" src="${escapeHtml(step.logo)}" alt="Logo" />
      </div>
    `;
  }

  function renderTopNote(step) {
    if (!step.topNote) return "";
    return `<div class="top-note">${nl2br(step.topNote)}</div>`;
  }

  function renderTexts(step) {
    const texts = Array.isArray(step.texts) ? step.texts : [];
    if (!texts.length) return "";

    let html = "";
    if (texts[0]) {
      html += `<h2 class="stage-title">${nl2br(texts[0])}</h2>`;
    }
    for (let i = 1; i < texts.length; i++) {
      html += `<p class="stage-subtitle">${nl2br(texts[i])}</p>`;
    }
    return html;
  }

  function renderSingleImage(image, alt) {
    if (!image) return "";
    return `
      <div class="stage-media">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(alt || "Imagem")}" />
      </div>
    `;
  }

  function renderImages(step) {
    const images = Array.isArray(step.images) ? step.images : [];
    if (!images.length) return "";

    if (step.layout === "split-left-image") return "";

    return images.map((img) => renderSingleImage(img, step.texts?.[0] || "Imagem")).join("");
  }

  function renderButtons(step) {
    const buttons = Array.isArray(step.buttons) ? step.buttons : [];
    if (!buttons.length) return "";

    return `
      <div class="stage-actions">
        ${buttons
          .map(
            (button, index) => `
          <button
            type="button"
            class="${index === 0 ? "primary-btn" : "secondary-btn"} action-btn"
            data-destination="${escapeHtml(button.destination || "")}"
            data-kind="${escapeHtml(button.kind || "next")}"
          >
            ${escapeHtml(button.label || "Continuar")}
          </button>
        `
          )
          .join("")}
      </div>
    `;
  }

  function bindActionButtons(step) {
    const buttons = Array.from(stageEl.querySelectorAll(".action-btn"));

    buttons.forEach((btn) => {
      btn.addEventListener("click", function () {
        const destination = btn.getAttribute("data-destination") || "";
        const kind = btn.getAttribute("data-kind") || "next";

        if (kind === "redirect" && destination) {
          trackQuizComplete(step);
          persistSalesPayload();
          window.location.href = destination;
          return;
        }

        if (destination && destination !== "next") {
          trackStepAdvance(step, destination);
          goToStep(destination);
          return;
        }

        goNext(step);
      });
    });
  }

  function isRealImagePath(value) {
    if (!value) return false;
    const str = String(value).trim();
    if (!str) return false;
    return (
      !/^[\u{1F300}-\u{1FAFF}]/u.test(str) &&
      !/^(✅|🚫|❌|☝️|👉|📊|🔥|⚡|🔵|🔴|🟡|🟠|🟢|😎|🍗|😋|😩|🏃|😐|🥱|🌙|😴|⏰|🏆|💪)/u.test(str)
    );
  }

  function renderChoiceCard(option, selected, optionIndex, multiple) {
    const visual = option.image;
    const hasImage = isRealImagePath(visual);
    const icon = !hasImage ? visual || "" : "";
    const value = option.value || option.label || `option_${optionIndex + 1}`;

    return `
      <button
        type="button"
        class="option-btn ${selected ? "is-selected" : ""}"
        data-value="${escapeHtml(value)}"
      >
        <div class="option-left">
          ${
            hasImage
              ? `
            <div class="option-icon-wrap">
              <img class="option-icon-img" src="${escapeHtml(visual)}" alt="${escapeHtml(option.label || "Opção")}" />
            </div>
          `
              : icon
                ? `
            <div class="option-emoji">${escapeHtml(icon)}</div>
          `
                : ""
          }
          <div class="option-label">${escapeHtml(option.label || "")}</div>
        </div>

        ${
          multiple
            ? `<div class="option-check">${selected ? "✓" : ""}</div>`
            : `<div class="option-arrow">›</div>`
        }
      </button>
    `;
  }

  function renderImageOptionsGrid(step, set, storedValue) {
    const multiple = !!set.multiple;

    return `
      <div class="image-options-grid">
        ${set.options
          .map((option, index) => {
            const value = option.value || option.label || `option_${index + 1}`;
            const selected = multiple
              ? Array.isArray(storedValue) && storedValue.includes(value)
              : storedValue === value;

            return `
            <button
              type="button"
              class="image-option-card ${selected ? "is-selected" : ""}"
              data-value="${escapeHtml(value)}"
            >
              ${
                option.image
                  ? `
                <div class="image-option-media">
                  <img src="${escapeHtml(option.image)}" alt="${escapeHtml(option.label || "Opção")}" />
                </div>
              `
                  : ""
              }
              <div class="image-option-footer">
                <span class="image-option-label">${escapeHtml(option.label || "")}</span>
                <span class="image-option-arrow">${multiple ? (selected ? "✓" : "□") : "›"}</span>
              </div>
            </button>
          `;
          })
          .join("")}
      </div>
    `;
  }

  function renderSplitStep(step, set, storedValue) {
    const image = Array.isArray(step.images) ? step.images[0] : "";
    const multiple = !!set.multiple;

    return `
      ${renderLogo(step)}
      ${renderTopNote(step)}
      ${renderTexts(step)}
      <div class="split-layout">
        <div class="split-col split-col-options">
          <div class="options-grid">
            ${set.options
              .map((option, index) => {
                const value = option.value || option.label || `option_${index + 1}`;
                const selected = multiple
                  ? Array.isArray(storedValue) && storedValue.includes(value)
                  : storedValue === value;

                return renderChoiceCard(option, selected, index, multiple);
              })
              .join("")}
          </div>
          ${
            multiple
              ? `
            <div class="stage-actions">
              <button type="button" class="primary-btn" id="continueMultiBtn">Continuar</button>
            </div>
          `
              : ""
          }
        </div>
        <div class="split-col split-col-image">
          ${renderSingleImage(image, step.texts?.[0] || "Imagem")}
        </div>
      </div>
    `;
  }

  function renderQuestionStep(step) {
    const set = Array.isArray(step.optionSets) && step.optionSets[0] ? step.optionSets[0] : null;
    if (!set) {
      stageEl.innerHTML = `
        ${renderLogo(step)}
        ${renderTopNote(step)}
        ${renderImages(step)}
        ${renderTexts(step)}
        ${renderButtons(step)}
      `;
      bindActionButtons(step);
      return;
    }

    const fieldName = set.name || step.id;
    const storedValue = state.answers[fieldName] || (set.multiple ? [] : "");
    const multiple = !!set.multiple;

    if (step.layout === "split-left-image") {
      stageEl.innerHTML = renderSplitStep(step, set, storedValue);
      bindQuestionEvents(step, set, fieldName, multiple);
      return;
    }

    if (step.layout === "image-grid") {
      stageEl.innerHTML = `
        ${renderLogo(step)}
        ${renderTopNote(step)}
        ${renderTexts(step)}
        ${renderImageOptionsGrid(step, set, storedValue)}
        ${
          multiple
            ? `
          <div class="stage-actions">
            <button type="button" class="primary-btn" id="continueMultiBtn">Continuar</button>
          </div>
        `
            : ""
        }
      `;
      bindQuestionEvents(step, set, fieldName, multiple);
      return;
    }

    stageEl.innerHTML = `
      ${renderLogo(step)}
      ${renderTopNote(step)}
      ${renderImages(step)}
      ${renderTexts(step)}
      <div class="options-grid">
        ${set.options
          .map((option, index) => {
            const value = option.value || option.label || `option_${index + 1}`;
            const selected = multiple
              ? Array.isArray(storedValue) && storedValue.includes(value)
              : storedValue === value;

            return renderChoiceCard(option, selected, index, multiple);
          })
          .join("")}
      </div>
      ${
        multiple
          ? `
        <div class="stage-actions">
          <button type="button" class="primary-btn" id="continueMultiBtn">Continuar</button>
        </div>
      `
          : ""
      }
    `;

    bindQuestionEvents(step, set, fieldName, multiple);
  }

  function bindQuestionEvents(step, set, fieldName, multiple) {
    const buttons = Array.from(stageEl.querySelectorAll("[data-value]"));

    if (multiple) {
      let currentValues = Array.isArray(state.answers[fieldName]) ? [...state.answers[fieldName]] : [];
      const continueBtn = document.getElementById("continueMultiBtn");

      buttons.forEach((btn) => {
        btn.addEventListener("click", function () {
          const value = btn.getAttribute("data-value");
          const exists = currentValues.includes(value);
          const check = btn.querySelector(".option-check, .image-option-arrow");

          if (exists) {
            currentValues = currentValues.filter((item) => item !== value);
            btn.classList.remove("is-selected");
            if (check) check.textContent = btn.classList.contains("image-option-card") ? "□" : "";
          } else {
            currentValues.push(value);
            btn.classList.add("is-selected");
            if (check) check.textContent = "✓";
          }
        });
      });

      if (continueBtn) {
        continueBtn.addEventListener("click", function () {
          state.answers[fieldName] = currentValues;
          persistSalesPayload();
          goNext(step);
        });
      }

      return;
    }

    buttons.forEach((btn) => {
      btn.addEventListener("click", function () {
        const value = btn.getAttribute("data-value");
        state.answers[fieldName] = value;
        persistSalesPayload();
        goNext(step);
      });
    });
  }

  function renderTextInputStep(step) {
    const fieldName = step.field || step.id;
    const value = state.answers[fieldName] ?? "";
    const inputType = step.inputType || "text";

    stageEl.innerHTML = `
      ${renderLogo(step)}
      ${renderTopNote(step)}
      ${renderTexts(step)}
      <div class="text-input-wrap">
        <input
          id="textInput"
          class="text-input"
          type="${escapeHtml(inputType)}"
          placeholder="${escapeHtml(step.placeholder || "")}"
          value="${escapeHtml(value)}"
        >
        <div class="text-input-error hidden" id="textInputError">Preencha corretamente para continuar.</div>
      </div>
      <div class="stage-actions">
        <button type="button" class="primary-btn" id="saveTextBtn">
          ${escapeHtml(step.buttonLabel || "Continuar")}
        </button>
      </div>
    `;

    const input = document.getElementById("textInput");
    const button = document.getElementById("saveTextBtn");
    const error = document.getElementById("textInputError");

    function submit() {
      const current = String(input.value || "").trim();

      if (!current) {
        error.classList.remove("hidden");
        return;
      }

      error.classList.add("hidden");
      state.answers[fieldName] = current;
      persistSalesPayload();
      goNext(step);
    }

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    });

    button.addEventListener("click", submit);
  }

  function renderRangeStep(step) {
    const fieldName = step.field || step.id;
    const min = Number(step.min ?? 140);
    const max = Number(step.max ?? 220);
    const value = Number(state.answers[fieldName] ?? step.defaultValue ?? min);
    const unit = step.unit || "";

    stageEl.innerHTML = `
      ${renderLogo(step)}
      ${renderTopNote(step)}
      ${renderTexts(step)}
      <div class="range-wrap">
        <div class="range-value"><span id="rangeValueText">${value}</span>${escapeHtml(unit)}</div>
        <input id="rangeInput" class="range-input" type="range" min="${min}" max="${max}" value="${value}">
      </div>
      <div class="stage-actions">
        <button type="button" class="primary-btn" id="saveRangeBtn">
          ${escapeHtml(step.buttonLabel || "Próximo passo")}
        </button>
      </div>
    `;

    const input = document.getElementById("rangeInput");
    const text = document.getElementById("rangeValueText");
    const button = document.getElementById("saveRangeBtn");

    input.addEventListener("input", function () {
      text.textContent = input.value;
    });

    button.addEventListener("click", function () {
      state.answers[fieldName] = Number(input.value);
      persistSalesPayload();
      goNext(step);
    });
  }

  function renderMetricInputStep(step) {
    const fieldName = step.field || step.id;
    const value = state.answers[fieldName] ?? step.defaultValue ?? 0;
    const unit = step.unit || "";

    stageEl.innerHTML = `
      ${renderLogo(step)}
      ${renderTopNote(step)}
      ${renderTexts(step)}
      <div class="metric-input-wrap">
        <input id="metricInput" class="metric-number-input" type="number" value="${escapeHtml(value)}" min="0" step="1">
        <div class="metric-unit">${escapeHtml(unit)}</div>
      </div>
      <div class="stage-actions">
        <button type="button" class="primary-btn" id="saveMetricBtn">
          ${escapeHtml(step.buttonLabel || "Próximo passo")}
        </button>
      </div>
    `;

    const input = document.getElementById("metricInput");
    const button = document.getElementById("saveMetricBtn");

    button.addEventListener("click", function () {
      state.answers[fieldName] = Number(input.value || 0);
      persistSalesPayload();
      goNext(step);
    });
  }

  function renderSimpleLoadingBar(label, percent, id) {
    return `
      <div class="analysis-progress-row" data-progress-id="${escapeHtml(id || "")}" data-target="${Number(percent || 0)}">
        <div class="analysis-progress-head">
          <span>${escapeHtml(label || "")}</span>
          <strong>0%</strong>
        </div>
        <div class="analysis-progress-bar">
          <div class="analysis-progress-fill"></div>
        </div>
      </div>
    `;
  }

  function animateProgressRow(row, target, duration, onComplete) {
    if (!row) {
      if (typeof onComplete === "function") onComplete();
      return;
    }

    const fill = row.querySelector(".analysis-progress-fill");
    const value = row.querySelector(".analysis-progress-head strong");
    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const current = Math.round(target * progress);

      if (fill) fill.style.width = `${current}%`;
      if (value) value.textContent = `${current}%`;

      if (progress < 1) {
        requestAnimationFrame(frame);
        return;
      }

      if (typeof onComplete === "function") onComplete();
    }

    requestAnimationFrame(frame);
  }

  function renderAnalysisStep(step) {
    stageEl.innerHTML = `
      ${renderLogo(step)}
      <h2 class="stage-title">Estamos analisando suas respostas</h2>
      <p class="stage-subtitle">Em instantes vamos mostrar o plano mais indicado para você.</p>
      <div style="max-width:420px;margin:0 auto;">
        ${renderSimpleLoadingBar("Avaliando seu perfil", 100, "analise_1")}
        ${renderSimpleLoadingBar("Calculando sequência ideal", 100, "analise_2")}
        ${renderSimpleLoadingBar("Ajustando ritmo das aulas", 100, "analise_3")}
      </div>
    `;

    const rows = Array.from(stageEl.querySelectorAll(".analysis-progress-row"));
    if (!rows.length) return;

    animateProgressRow(rows[0], 100, 1200, () => {
      animateProgressRow(rows[1], 100, 1000, () => {
        animateProgressRow(rows[2], 100, 900, () => {
          schedule(() => {
            const current = getCurrentStep();
            if (current && current.id === step.id) goNext(step);
          }, Number(step.delay || 700));
        });
      });
    });
  }

  function animateProgressSequence(onComplete) {
    const rows = Array.from(stageEl.querySelectorAll(".analysis-progress-row"));
    if (!rows.length) {
      if (typeof onComplete === "function") onComplete();
      return;
    }

    const configs = [
      { target: 100, duration: 1100 },
      { target: 82, duration: 900 },
      { target: 91, duration: 850 },
      { target: 100, duration: 950 }
    ];

    function run(index) {
      if (!rows[index]) {
        if (typeof onComplete === "function") onComplete();
        return;
      }

      const cfg = configs[index] || { target: 100, duration: 900 };

      animateProgressRow(rows[index], cfg.target, cfg.duration, () => {
        if (rows[index + 1]) {
          schedule(() => run(index + 1), 180);
        } else if (typeof onComplete === "function") {
          onComplete();
        }
      });
    }

    run(0);
  }

  function renderLoadingStep(step) {
    if (step.id === "step_35") {
      stageEl.innerHTML = `
        ${renderLogo(step)}
        <div style="padding-top:120px;">
          <h2 class="stage-title">Criando seu perfil de condicionamento...</h2>
          <div style="max-width:380px;margin:0 auto;">
            ${renderSimpleLoadingBar("Carregando...", 46, "perfil-loading")}
          </div>
        </div>
      `;

      const row = stageEl.querySelector(".analysis-progress-row");
      animateProgressRow(row, 46, 1800);

      schedule(() => {
        const current = getCurrentStep();
        if (current && current.id === step.id) goNext(step);
      }, Number(step.delay || 2200));
      return;
    }

    stageEl.innerHTML = `
      ${renderLogo(step)}
      ${renderTopNote(step)}
      ${renderTexts(step)}
      <div class="loading-wrap">
        <div class="spinner"></div>
      </div>
    `;

    schedule(() => {
      const current = getCurrentStep();
      if (current && current.id === step.id) goNext(step);
    }, Number(step.delay || 1800));
  }

  function renderCarousel(step) {
    const images = Array.isArray(step.carouselImages) ? step.carouselImages : [];
    if (!images.length) return "";

    return `
      <div style="margin:18px 0 12px;">
        <div style="display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px;">
          ${images
            .map(
              (src, i) => `
            <div style="min-width:260px;max-width:260px;scroll-snap-align:center;background:#fff;border:1px solid #dfe5e7;border-radius:16px;padding:6px;">
              <img src="${escapeHtml(src)}" alt="Depoimento ${i + 1}" style="width:100%;display:block;border-radius:12px;">
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderTransformationBuildStep(step) {
    stageEl.innerHTML = `
      ${renderLogo(step)}
      <h2 class="stage-title">Seu treino <span style="color:#18a84a;">personalizado</span> de Tai Chi está sendo criado!</h2>

      <div style="max-width:420px;margin:0 auto 16px;">
        ${renderSimpleLoadingBar("Analisando suas respostas", 100, "analise")}
        ${renderSimpleLoadingBar("Organizando sequência das aulas", 82, "sequencia")}
        ${renderSimpleLoadingBar("Ajustando o nível de intensidade", 91, "intensidade")}
        ${renderSimpleLoadingBar("Finalizando seu plano", 100, "final")}
      </div>

      <div style="background:#fff;border:1px solid #dfe5e7;border-radius:18px;padding:16px;margin-bottom:16px;box-shadow:0 10px 24px rgba(0,0,0,.05);">
        <p style="font-size:15px;line-height:1.65;color:#243042;margin:0;">
          Com base no seu peso atual, no objetivo informado e no nível de energia que você descreveu, a projeção indica espaço real para reduzir medidas e sobrecarga corporal nas próximas semanas, desde que você siga um plano progressivo e consistente.
        </p>
      </div>

      ${renderButtons(step)}
    `;

    animateProgressSequence(() => {
      bindActionButtons(step);
    });
  }

  function createProjectionSvg(currentWeight, targetWeight) {
    const maxWeight = Math.max(currentWeight + 4, targetWeight + 8);
    const minWeight = Math.min(targetWeight - 4, currentWeight - 6, 55);
    const yScale = (weight) => {
      const ratio = (weight - minWeight) / (maxWeight - minWeight || 1);
      return 178 - ratio * 120;
    };

    const points = [
      { x: 64, y: yScale(currentWeight) },
      { x: 134, y: yScale(currentWeight - (currentWeight - targetWeight) * 0.35) },
      { x: 204, y: yScale(currentWeight - (currentWeight - targetWeight) * 0.65) },
      { x: 274, y: yScale(targetWeight) }
    ];

    const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

    return `
      <svg viewBox="0 0 340 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="340" height="220" rx="18" fill="#ffffff" />
        <line x1="42" y1="26" x2="42" y2="188" stroke="#cbd5e1" stroke-width="2" />
        <line x1="42" y1="188" x2="304" y2="188" stroke="#cbd5e1" stroke-width="2" />

        <polyline
          fill="none"
          stroke="#18a84a"
          stroke-width="6"
          stroke-linecap="round"
          stroke-linejoin="round"
          points="${polyline}"
        />

        ${points
          .map(
            (point) => `
          <circle cx="${point.x}" cy="${point.y}" r="7" fill="#18a84a" />
        `
          )
          .join("")}

        <text x="${points[0].x}" y="${points[0].y - 18}" fill="#111827" font-size="14" text-anchor="middle" font-weight="800">${currentWeight}</text>
        <text x="${points[3].x}" y="${points[3].y - 18}" fill="#111827" font-size="14" text-anchor="middle" font-weight="800">${targetWeight}</text>

        <text x="64" y="212" font-size="12" fill="#374151">Sem 1</text>
        <text x="134" y="212" font-size="12" fill="#374151">Sem 4</text>
        <text x="204" y="212" font-size="12" fill="#374151">Sem 6</text>
        <text x="274" y="212" font-size="12" fill="#374151">Sem 8</text>
      </svg>
    `;
  }

  function renderProjectionStep(step) {
    const profile = calculateProfile();
    const currentWeight = profile.pesoAtual;
    const targetWeight = profile.pesoMeta > 0 ? profile.pesoMeta : Math.max(60, currentWeight - 8);

    stageEl.innerHTML = `
      ${renderLogo(step)}
      <h2 class="stage-title">Prevemos que você alcance <span style="color:#18a84a;">${targetWeight}</span> em 8 semanas</h2>
      <p class="stage-subtitle">com seu treino personalizado de Tai Chi</p>

      <div style="background:#fff;border:1px solid #dfe5e7;border-radius:18px;padding:12px;margin:0 0 16px;box-shadow:0 10px 24px rgba(0,0,0,.05);">
        <div style="width:100%;aspect-ratio:360/220;">
          ${createProjectionSvg(currentWeight, targetWeight)}
        </div>
      </div>

      <div style="background:#fff;border:1px solid #dfe5e7;border-radius:18px;padding:16px;margin-bottom:16px;box-shadow:0 10px 24px rgba(0,0,0,.05);">
        <p style="font-size:15px;line-height:1.65;color:#243042;margin:0;">
          Com base no seu peso atual, no objetivo informado e no nível de energia que você descreveu, a projeção indica espaço real para reduzir medidas e sobrecarga corporal nas próximas semanas, desde que você siga um plano progressivo e consistente.
        </p>
      </div>

      ${renderButtons(step)}
    `;

    bindActionButtons(step);
  }

  function renderContentStep(step) {
    if (step.id === "step_36") {
      renderAnalysisStep(step);
      return;
    }

    if (step.id === "step_38") {
      renderTransformationBuildStep(step);
      return;
    }

    if (step.id === "step_39") {
      renderProjectionStep(step);
      return;
    }

    stageEl.innerHTML = `
      ${renderLogo(step)}
      ${renderTopNote(step)}
      ${renderImages(step)}
      ${renderTexts(step)}
      ${renderCarousel(step)}
      ${renderButtons(step)}
    `;
    bindActionButtons(step);
  }

  function renderCurrentStep() {
    const step = getCurrentStep();

    if (!step) {
      stageEl.innerHTML = `<div class="stage-alert">Etapa não encontrada.</div>`;
      return;
    }

    setProgress(step);
    trackStepView(step);

    switch (step.stepType) {
      case "question":
        renderQuestionStep(step);
        break;
      case "text_input":
        renderTextInputStep(step);
        break;
      case "range":
        renderRangeStep(step);
        break;
      case "metric_input":
        renderMetricInputStep(step);
        break;
      case "loading":
        renderLoadingStep(step);
        break;
      case "content":
      case "offer":
      default:
        renderContentStep(step);
        break;
    }
  }

  function init() {
    loadTrackingContext();
    trackPageEntryOnce();
    persistSalesPayload();
    renderCurrentStep();
  }

  init();
})();
