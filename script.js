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
    progressTextEl.textContent = `Etapa ${current} de ${total}`;
  }

  function generateId(prefix) {
    const random = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36);
    return `${prefix}_${time}_${random}`;
  }

  function getOrCreateLocalStorageValue(key, prefix) {
    try {
      const existing = window.localStorage.getItem(key);
      if (existing) return existing;
      const created = generateId(prefix);
      window.localStorage.setItem(key, created);
      return created;
    } catch (error) {
      console.warn(`Não foi possível acessar ${key}.`, error);
      return generateId(prefix);
    }
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
    const sessionId =
      normalizeTrackingValue(storedTracking.session_id) ||
      getOrCreateLocalStorageValue(SESSION_STORAGE_KEY, "sess");

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

  function trackEvent(eventName, extra = {}) {
    if (!state.tracking) loadTrackingContext();

    const event = {
      event_name: String(eventName || "").trim(),
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
  }

  function trackPageEntryOnce() {
    try {
      if (!window.localStorage.getItem(PAGE_VIEW_KEY)) {
        trackEvent("page_view");
        window.localStorage.setItem(PAGE_VIEW_KEY, "1");
      }

      if (!window.localStorage.getItem(SESSION_STARTED_KEY)) {
        trackEvent("session_start");
        window.localStorage.setItem(SESSION_STARTED_KEY, "1");
      }

      if (!window.localStorage.getItem(QUIZ_START_KEY)) {
        trackEvent("quiz_start");
        window.localStorage.setItem(QUIZ_START_KEY, "1");
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

  function calculateTrainingIntensity() {
    const preferencia = getStringAnswer("preferencia_inicio_treino", "");

    if (/bem leve/i.test(preferencia)) return "Leve";
    if (/intermedi[áa]rio/i.test(preferencia)) return "Média";
    if (/mais ativo/i.test(preferencia)) return "Alta";
    if (/voc[êe]s decidam/i.test(preferencia)) return "Média";

    return "Média";
  }

  function getPrimaryObjectiveLabel() {
    const objetivo = getStringAnswer("objetivo_principal", "");
    return normalizeLabel(objetivo, "Melhorar condicionamento e mobilidade");
  }

  function buildSalesPayload() {
    const profile = calculateProfile();

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
        scores: profile.scores
      },
      salesView: {
        objetivo: getPrimaryObjectiveLabel(),
        intensidade: calculateTrainingIntensity(),
        pesoAtual: formatKg(profile.pesoAtual),
        pesoMeta: formatKg(profile.pesoMeta),
        imc: String(profile.imc),
        faixaImc: profile.faixa,
        motivacao: profile.motivacao,
        energia: profile.energiaLabel,
        sono: profile.sonoLabel,
        headlineResumo: `Com base nas suas respostas, identificamos que seu foco principal é ${getPrimaryObjectiveLabel().toLowerCase()} com uma intensidade ${calculateTrainingIntensity().toLowerCase()} e um plano progressivo para sair de ${formatKg(profile.pesoAtual).replace(" kg", "kg")} em direção a ${formatKg(profile.pesoMeta).replace(" kg", "kg")} com segurança.`,
        resumo: profile.resumo
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
          goNext(step);
        });
      }

      return;
    }

    buttons.forEach((btn) => {
      btn.addEventListener("click", function () {
        const value = btn.getAttribute("data-value");
        state.answers[fieldName] = value;
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
      goNext(step);
    });
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
      scores: {
        energia: energyScore,
        mobilidade: mobilityScore,
        sono: sleepScore,
        dores: dorScore,
        metabolismo: metabolismoScore
      }
    };
  }

  function scoreBar(label, score, color) {
    const percent = Math.max(0, Math.min(100, score * 10));
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;gap:12px;font-weight:700;font-size:14px;margin-bottom:6px;">
          <span>${escapeHtml(label)}</span>
          <span>${score}/10</span>
        </div>
        <div style="height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
          <div style="width:${percent}%;height:100%;background:${color};border-radius:999px;"></div>
        </div>
      </div>
    `;
  }

  function renderAnalysisStep(step) {
    const profile = calculateProfile();

    stageEl.innerHTML = `
      ${renderLogo(step)}
      ${renderTopNote(step)}
      <h2 class="stage-title">Seu perfil com base em suas respostas:</h2>

      <div style="background:#fff;border:1px solid #dfe5e7;border-radius:18px;padding:18px 16px;margin-bottom:16px;box-shadow:0 10px 24px rgba(0,0,0,.05);">
        <div style="display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:10px;">
          <div>
            <div style="font-size:14px;color:#5f6b7a;">Índice de Massa Corporal</div>
            <div style="font-size:28px;font-weight:800;line-height:1.1;">IMC: ${profile.imc}</div>
          </div>
          <div style="font-size:14px;font-weight:800;color:${profile.faixaColor};">${escapeHtml(profile.faixa)}</div>
        </div>

        <div style="position:relative;margin:12px 0 8px;">
          <div style="height:12px;border-radius:999px;background:linear-gradient(90deg,#60a5fa 0 20%,#22c55e 20% 50%,#f59e0b 50% 75%,#ef4444 75% 100%);"></div>
          <div style="position:absolute;left:calc(${profile.faixaPercent}% - 9px);top:-4px;width:18px;height:18px;background:#fff;border:3px solid ${profile.faixaColor};border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,.18);"></div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;font-size:12px;font-weight:700;color:#374151;">
          <div>Abaixo</div>
          <div>Normal</div>
          <div>Sobrepeso</div>
          <div>Obesidade</div>
        </div>
      </div>

      <div style="background:#fff;border:1px solid #dfe5e7;border-radius:18px;padding:18px 16px;margin-bottom:16px;box-shadow:0 10px 24px rgba(0,0,0,.05);">
        <div style="font-size:18px;font-weight:800;margin-bottom:10px;">Leitura do seu cenário atual</div>
        <p style="font-size:15px;line-height:1.65;color:#243042;margin-bottom:14px;">
          ${escapeHtml(profile.resumo)}
        </p>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
          <div style="background:#f8fafc;border-radius:14px;padding:12px;">
            <div style="font-size:12px;color:#64748b;">Faixa etária</div>
            <div style="font-weight:800;">${escapeHtml(profile.idadeLabel)}</div>
          </div>
          <div style="background:#f8fafc;border-radius:14px;padding:12px;">
            <div style="font-size:12px;color:#64748b;">Objetivo atual</div>
            <div style="font-weight:800;">${escapeHtml(profile.objetivo)}</div>
          </div>
          <div style="background:#f8fafc;border-radius:14px;padding:12px;">
            <div style="font-size:12px;color:#64748b;">Energia</div>
            <div style="font-weight:800;">${escapeHtml(profile.energiaLabel)}</div>
          </div>
          <div style="background:#f8fafc;border-radius:14px;padding:12px;">
            <div style="font-size:12px;color:#64748b;">Motivação</div>
            <div style="font-weight:800;">${escapeHtml(profile.motivacao)}</div>
          </div>
        </div>
      </div>

      <div style="background:#fff;border:1px solid #dfe5e7;border-radius:18px;padding:18px 16px;margin-bottom:16px;box-shadow:0 10px 24px rgba(0,0,0,.05);">
        <div style="font-size:18px;font-weight:800;margin-bottom:14px;">Indicadores visuais do seu perfil</div>
        ${scoreBar("Energia", profile.scores.energia, "#2563eb")}
        ${scoreBar("Mobilidade", profile.scores.mobilidade, "#0f766e")}
        ${scoreBar("Sono", profile.scores.sono, "#7c3aed")}
        ${scoreBar("Conforto articular", profile.scores.dores, "#dc2626")}
        ${scoreBar("Metabolismo", profile.scores.metabolismo, "#ea580c")}
      </div>

      ${renderButtons(step)}
    `;

    bindActionButtons(step);
  }

  function renderSimpleLoadingBar(label, percentValue, key) {
    return `
      <div class="analysis-progress-row" data-progress-key="${escapeHtml(key || label)}" data-target="${percentValue}">
        <div style="display:flex;justify-content:space-between;gap:12px;font-size:14px;font-weight:700;margin-bottom:6px;">
          <span>${escapeHtml(label)}</span>
          <span class="analysis-progress-value">0%</span>
        </div>
        <div style="height:10px;background:#dfe5e7;border-radius:999px;overflow:hidden;">
          <div
            class="analysis-progress-fill"
            style="width:0%;height:100%;background:#0f6158;border-radius:999px;transition:none;"
          ></div>
        </div>
      </div>
    `;
  }

  function animateProgressRow(rowEl, targetPercent, duration, onComplete) {
    if (!rowEl) return;

    const fillEl = rowEl.querySelector(".analysis-progress-fill");
    const valueEl = rowEl.querySelector(".analysis-progress-value");
    const safeTarget = Math.max(0, Math.min(100, Number(targetPercent) || 0));
    const totalSteps = Math.max(1, Math.round(duration / 30));
    let currentStep = 0;

    const intervalId = scheduleInterval(() => {
      currentStep += 1;
      const progress = currentStep / totalSteps;
      const currentPercent = Math.round(safeTarget * progress);

      if (fillEl) fillEl.style.width = `${currentPercent}%`;
      if (valueEl) valueEl.textContent = `${currentPercent}%`;

      if (currentStep >= totalSteps) {
        clearInterval(intervalId);
        state.intervals = state.intervals.filter((id) => id !== intervalId);

        if (fillEl) fillEl.style.width = `${safeTarget}%`;
        if (valueEl) valueEl.textContent = `${safeTarget}%`;

        if (typeof onComplete === "function") onComplete();
      }
    }, 30);
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
        ${renderSimpleLoadingBar("Criando seu treino personalizado", 100, "treino")}
      </div>

      <p style="text-align:center;font-size:30px;font-weight:900;line-height:1.15;margin-bottom:4px;">O corpo muda por completo.</p>
      <p style="text-align:center;font-size:28px;font-weight:900;line-height:1.15;color:#18a84a;margin-bottom:12px;">Emagrecer é só o começo.</p>
      <p style="text-align:center;font-size:22px;letter-spacing:3px;margin-bottom:8px;">⭐ ⭐ ⭐ ⭐ ⭐</p>
      <p style="text-align:center;font-weight:700;margin-bottom:14px;">Nota 4,9 baseada em 42.489 avaliações</p>

      ${renderCarousel(step)}

      <div class="stage-actions">
        <button type="button" class="primary-btn action-btn" id="analysisContinueBtn" data-destination="next" data-kind="next" disabled style="opacity:.65;cursor:not-allowed;">
          Continuar
        </button>
      </div>
    `;

    animateProgressSequence(() => {
      const btn = document.getElementById("analysisContinueBtn");
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
      }
    });

    bindActionButtons(step);
  }

  function createProjectionSvg(currentWeight, targetWeight) {
    const w = 360;
    const h = 220;
    const padding = 24;
    const points = [
      { x: padding, y: 44 },
      { x: 110, y: 92 },
      { x: 185, y: 152 },
      { x: 260, y: 168 },
      { x: 320, y: 166 }
    ];

    const path = `
      M ${points[0].x} ${points[0].y}
      C 80 60, 92 88, ${points[1].x} ${points[1].y}
      S 160 156, ${points[2].x} ${points[2].y}
      S 236 170, ${points[3].x} ${points[3].y}
      S 300 170, ${points[4].x} ${points[4].y}
    `;

    return `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" aria-label="Gráfico de projeção">
        <defs>
          <linearGradient id="areaFill" x1="0" x2="1">
            <stop offset="0%" stop-color="#ef4444" stop-opacity=".35"></stop>
            <stop offset="55%" stop-color="#f59e0b" stop-opacity=".28"></stop>
            <stop offset="100%" stop-color="#22c55e" stop-opacity=".22"></stop>
          </linearGradient>
          <linearGradient id="lineStroke" x1="0" x2="1">
            <stop offset="0%" stop-color="#ef4444"></stop>
            <stop offset="55%" stop-color="#f59e0b"></stop>
            <stop offset="100%" stop-color="#22c55e"></stop>
          </linearGradient>
        </defs>

        <g stroke="#d1d5db" stroke-dasharray="4 4">
          <line x1="24" y1="44" x2="336" y2="44"></line>
          <line x1="24" y1="88" x2="336" y2="88"></line>
          <line x1="24" y1="132" x2="336" y2="132"></line>
          <line x1="24" y1="176" x2="336" y2="176"></line>
          <line x1="80" y1="24" x2="80" y2="190"></line>
          <line x1="150" y1="24" x2="150" y2="190"></line>
          <line x1="220" y1="24" x2="220" y2="190"></line>
          <line x1="290" y1="24" x2="290" y2="190"></line>
        </g>

        <path d="${path} L 320 190 L 24 190 Z" fill="url(#areaFill)"></path>
        <path d="${path}" fill="none" stroke="url(#lineStroke)" stroke-width="4" stroke-linecap="round"></path>

        <circle cx="${points[0].x}" cy="${points[0].y}" r="7" fill="#ef4444"></circle>
        <circle cx="${points[3].x}" cy="${points[3].y}" r="7" fill="#eab308"></circle>

        <rect x="${points[0].x - 12}" y="${points[0].y - 38}" rx="8" ry="8" width="72" height="28" fill="#ef4444"></rect>
        <text x="${points[0].x + 24}" y="${points[0].y - 19}" fill="#fff" font-size="14" text-anchor="middle" font-weight="700">Agora ${currentWeight}</text>

        <rect x="${points[3].x - 14}" y="${points[3].y - 40}" rx="8" ry="8" width="42" height="28" fill="#facc15"></rect>
        <text x="${points[3].x + 7}" y="${points[3].y - 21}" fill="#111827" font-size="14" text-anchor="middle" font-weight="800">${targetWeight}</text>

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
    renderCurrentStep();
  }

  init();
})();