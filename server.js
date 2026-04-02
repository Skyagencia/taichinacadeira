require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

const LASTLINK_WEBHOOK_TOKEN = String(process.env.LASTLINK_WEBHOOK_TOKEN || "").trim();
const LASTLINK_SKIP_TOKEN_VALIDATION =
  String(process.env.LASTLINK_SKIP_TOKEN_VALIDATION || "true").trim().toLowerCase() === "true";

const WEBHOOK_LOG_DIR = path.join(ROOT_DIR, "data");
const WEBHOOK_LOG_FILE = path.join(WEBHOOK_LOG_DIR, "lastlink-webhooks.jsonl");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function captureRawBody(req, res, buffer) {
  if (buffer && buffer.length) {
    req.rawBody = buffer.toString("utf8");
  } else {
    req.rawBody = "";
  }
}

app.use(
  express.json({
    limit: "3mb",
    verify: captureRawBody
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "3mb",
    verify: captureRawBody
  })
);

app.use(express.static(ROOT_DIR));

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }

  return req.socket?.remoteAddress || "";
}

function maskValue(value, visibleStart = 6, visibleEnd = 4) {
  const clean = String(value || "");
  if (!clean) return "";
  if (clean.length <= visibleStart + visibleEnd) {
    return `${clean.slice(0, 2)}***${clean.slice(-2)}`;
  }
  return `${clean.slice(0, visibleStart)}***${clean.slice(-visibleEnd)}`;
}

function getRequestToken(req) {
  const authHeader = String(req.headers.authorization || "").trim();
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  return (
    String(req.headers["x-lastlink-token"] || "").trim() ||
    String(req.headers["lastlink-token"] || "").trim() ||
    String(req.headers["x-webhook-token"] || "").trim() ||
    String(req.headers["x-api-key"] || "").trim() ||
    String(req.headers["x-api-token"] || "").trim() ||
    String(req.headers["token"] || "").trim() ||
    String(req.query.token || "").trim() ||
    String(req.body?.token || "").trim() ||
    String(req.body?.webhook_token || "").trim() ||
    (bearerMatch ? String(bearerMatch[1] || "").trim() : "")
  );
}

function getRequestSignature(req) {
  return (
    String(req.headers["x-lastlink-signature"] || "").trim() ||
    String(req.headers["lastlink-signature"] || "").trim() ||
    String(req.headers["x-signature"] || "").trim() ||
    String(req.headers["signature"] || "").trim()
  );
}

function secureCompare(a, b) {
  const valueA = Buffer.from(String(a || ""), "utf8");
  const valueB = Buffer.from(String(b || ""), "utf8");

  if (valueA.length !== valueB.length) return false;
  return crypto.timingSafeEqual(valueA, valueB);
}

function isTokenValid(req) {
  if (LASTLINK_SKIP_TOKEN_VALIDATION) {
    return true;
  }

  if (!LASTLINK_WEBHOOK_TOKEN) {
    return true;
  }

  const incomingToken = getRequestToken(req);
  if (!incomingToken) {
    return false;
  }

  return secureCompare(incomingToken, LASTLINK_WEBHOOK_TOKEN);
}

function sanitizeHeaders(headers) {
  const result = {};

  Object.entries(headers || {}).forEach(([key, value]) => {
    const normalizedKey = String(key || "").toLowerCase();

    if (
      normalizedKey === "authorization" ||
      normalizedKey === "x-lastlink-token" ||
      normalizedKey === "lastlink-token" ||
      normalizedKey === "x-webhook-token" ||
      normalizedKey === "x-api-key" ||
      normalizedKey === "x-api-token" ||
      normalizedKey === "token" ||
      normalizedKey === "cookie"
    ) {
      result[normalizedKey] = value ? "[redacted]" : "";
      return;
    }

    result[normalizedKey] = value;
  });

  return result;
}

function normalizePhone(value) {
  return String(value || "").replace(/\D+/g, "");
}

function getFirstProduct(data) {
  if (Array.isArray(data?.Products) && data.Products.length > 0) {
    return data.Products[0] || {};
  }
  return {};
}

function getFirstSubscription(data) {
  if (Array.isArray(data?.Subscriptions) && data.Subscriptions.length > 0) {
    return data.Subscriptions[0] || {};
  }
  return {};
}

function mapEventStatus(eventName) {
  const event = String(eventName || "").trim();

  if (event === "Purchase_Order_Confirmed") return "confirmed";
  if (event === "Purchase_Request_Canceled") return "canceled";
  if (event === "Payment_Refund") return "refunded";
  if (event === "Payment_Chargeback") return "chargeback";

  return "unknown";
}

function buildEventSummary(payload) {
  const body = payload && typeof payload === "object" ? payload : {};
  const data = body.Data && typeof body.Data === "object" ? body.Data : {};

  const product = getFirstProduct(data);
  const buyer = data.Buyer && typeof data.Buyer === "object" ? data.Buyer : {};
  const seller = data.Seller && typeof data.Seller === "object" ? data.Seller : {};
  const purchase = data.Purchase && typeof data.Purchase === "object" ? data.Purchase : {};
  const payment = purchase.Payment && typeof purchase.Payment === "object" ? purchase.Payment : {};
  const affiliate = purchase.Affiliate && typeof purchase.Affiliate === "object" ? purchase.Affiliate : {};
  const offer = data.Offer && typeof data.Offer === "object" ? data.Offer : {};
  const utm = data.Utm && typeof data.Utm === "object" ? data.Utm : {};
  const deviceInfo = data.DeviceInfo && typeof data.DeviceInfo === "object" ? data.DeviceInfo : {};
  const subscription = getFirstSubscription(data);
  const address = buyer.Address && typeof buyer.Address === "object" ? buyer.Address : {};
  const bankSlip = purchase.BankSlip && typeof purchase.BankSlip === "object" ? purchase.BankSlip : {};
  const pix = purchase.Pix && typeof purchase.Pix === "object" ? purchase.Pix : {};

  const eventName = String(body.Event || "").trim();

  return {
    raw_event_keys: Object.keys(body || {}),
    event_id: String(body.Id || ""),
    event_name: eventName,
    event_status: mapEventStatus(eventName),
    is_test: Boolean(body.IsTest),
    created_at: String(body.CreatedAt || ""),

    product_id: String(product.Id || ""),
    product_name: String(product.Name || ""),

    offer_id: String(offer.Id || ""),
    offer_name: String(offer.Name || ""),
    offer_url: String(offer.Url || ""),

    buyer_id: String(buyer.Id || ""),
    buyer_name: String(buyer.Name || ""),
    buyer_email: String(buyer.Email || ""),
    buyer_phone: normalizePhone(buyer.PhoneNumber),
    buyer_document: String(buyer.Document || ""),

    buyer_zipcode: String(address.ZipCode || ""),
    buyer_street: String(address.Street || ""),
    buyer_street_number: String(address.StreetNumber || ""),
    buyer_complement: String(address.Complement || ""),
    buyer_district: String(address.District || ""),
    buyer_city: String(address.City || ""),
    buyer_state: String(address.State || ""),

    seller_id: String(seller.Id || ""),
    seller_email: String(seller.Email || ""),

    payment_id: String(purchase.PaymentId || ""),
    payment_date: String(purchase.PaymentDate || ""),
    chargeback_date: String(purchase.ChargebackDate || ""),
    recurrency: purchase.Recurrency != null ? Number(purchase.Recurrency) : null,
    price_value: purchase.Price?.Value != null ? Number(purchase.Price.Value) : null,
    original_price_value:
      purchase.OriginalPrice?.Value != null ? Number(purchase.OriginalPrice.Value) : null,

    payment_method: String(payment.PaymentMethod || ""),
    installments:
      payment.NumberOfInstallments != null ? Number(payment.NumberOfInstallments) : null,

    affiliate_id: String(affiliate.Id || ""),
    affiliate_email: String(affiliate.Email || ""),

    subscription_id: String(subscription.Id || ""),
    subscription_product_id: String(subscription.ProductId || ""),
    canceled_date: String(subscription.CanceledDate || ""),
    cancellation_reason: String(subscription.CancellationReason || ""),

    utm_source: String(utm.UtmSource || ""),
    utm_medium: String(utm.UtmMedium || ""),
    utm_campaign: String(utm.UtmCampaign || ""),
    utm_term: String(utm.UtmTerm || ""),
    utm_content: String(utm.UtmContent || ""),

    device_ip: String(deviceInfo.ip || ""),
    device_user_agent: String(deviceInfo.UserAgent || ""),

    bankslip_digitable_line: String(bankSlip.DigitableLine || ""),
    bankslip_barcode_data: String(bankSlip.BarCodeData || ""),
    bankslip_barcode: String(bankSlip.BarCode || ""),

    pix_qrcode: String(pix.QrCode || ""),
    pix_qrcode_text: String(pix.QrCodeText || ""),

    lead_id: "",
    session_id: ""
  };
}

function buildNormalizedEvent(payload, requestMeta = {}) {
  const summary = buildEventSummary(payload);

  return {
    source: "lastlink",
    accepted: Boolean(requestMeta.accepted),
    received_at: String(requestMeta.received_at || new Date().toISOString()),

    event_id: summary.event_id,
    event_name: summary.event_name,
    event_status: summary.event_status,
    is_test: summary.is_test,
    created_at: summary.created_at,

    product_id: summary.product_id,
    product_name: summary.product_name,
    offer_id: summary.offer_id,
    offer_name: summary.offer_name,
    offer_url: summary.offer_url,

    buyer_id: summary.buyer_id,
    buyer_name: summary.buyer_name,
    buyer_email: summary.buyer_email,
    buyer_phone: summary.buyer_phone,
    buyer_document: summary.buyer_document,

    payment_id: summary.payment_id,
    payment_date: summary.payment_date,
    chargeback_date: summary.chargeback_date,
    recurrency: summary.recurrency,
    price_value: summary.price_value,
    original_price_value: summary.original_price_value,
    payment_method: summary.payment_method,
    installments: summary.installments,

    affiliate_id: summary.affiliate_id,
    affiliate_email: summary.affiliate_email,

    subscription_id: summary.subscription_id,
    subscription_product_id: summary.subscription_product_id,
    canceled_date: summary.canceled_date,
    cancellation_reason: summary.cancellation_reason,

    utm_source: summary.utm_source,
    utm_medium: summary.utm_medium,
    utm_campaign: summary.utm_campaign,
    utm_term: summary.utm_term,
    utm_content: summary.utm_content,

    device_ip: summary.device_ip,
    device_user_agent: summary.device_user_agent,

    lead_id: summary.lead_id,
    session_id: summary.session_id,

    request_ip: String(requestMeta.ip || ""),
    request_token_present: Boolean(requestMeta.token_present),
    request_signature_present: Boolean(requestMeta.signature_present)
  };
}

function saveWebhookEvent(record) {
  ensureDir(WEBHOOK_LOG_DIR);
  fs.appendFileSync(WEBHOOK_LOG_FILE, `${JSON.stringify(record)}\n`, "utf8");
}

function readWebhookEvents(limit = 50) {
  if (!fs.existsSync(WEBHOOK_LOG_FILE)) {
    return [];
  }

  const fileContent = fs.readFileSync(WEBHOOK_LOG_FILE, "utf8");
  const lines = fileContent
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .slice(-limit)
    .reverse()
    .map((line) => safeJsonParse(line, null))
    .filter(Boolean);
}

app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    app: "taichi-funil-node",
    time: new Date().toISOString(),
    webhook: {
      route: "/webhooks/lastlink",
      token_configured: Boolean(LASTLINK_WEBHOOK_TOKEN),
      skip_token_validation: LASTLINK_SKIP_TOKEN_VALIDATION
    }
  });
});

app.get("/webhooks/lastlink", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Webhook da Lastlink disponível. Use POST para enviar eventos.",
    route: "/webhooks/lastlink",
    token_configured: Boolean(LASTLINK_WEBHOOK_TOKEN),
    skip_token_validation: LASTLINK_SKIP_TOKEN_VALIDATION
  });
});

app.post("/webhooks/lastlink", (req, res) => {
  try {
    const requestToken = getRequestToken(req);
    const signature = getRequestSignature(req);
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const tokenIsValid = isTokenValid(req);
    const receivedAt = new Date().toISOString();
    const requestIp = getClientIp(req);
    const summary = buildEventSummary(payload);
    const normalized = buildNormalizedEvent(payload, {
      accepted: tokenIsValid,
      received_at: receivedAt,
      ip: requestIp,
      token_present: Boolean(requestToken),
      signature_present: Boolean(signature)
    });

    const record = {
      received_at: receivedAt,
      source: "lastlink",
      accepted: tokenIsValid,
      request: {
        method: req.method,
        original_url: req.originalUrl,
        ip: requestIp,
        user_agent: String(req.headers["user-agent"] || ""),
        content_type: String(req.headers["content-type"] || ""),
        headers: sanitizeHeaders(req.headers),
        token_present: Boolean(requestToken),
        token_preview: requestToken ? maskValue(requestToken) : "",
        signature_present: Boolean(signature),
        signature_preview: signature ? maskValue(signature) : "",
        raw_body: req.rawBody || ""
      },
      summary,
      normalized,
      payload
    };

    saveWebhookEvent(record);

    console.log("[LASTLINK WEBHOOK] Evento recebido:", {
      accepted: tokenIsValid,
      received_at: receivedAt,
      event_name: normalized.event_name,
      event_status: normalized.event_status,
      payment_id: normalized.payment_id,
      buyer_email: normalized.buyer_email,
      payment_method: normalized.payment_method,
      price_value: normalized.price_value,
      is_test: normalized.is_test
    });

    if (!tokenIsValid) {
      return res.status(401).json({
        ok: false,
        error: "Token do webhook inválido ou ausente.",
        debug: {
          token_present: Boolean(requestToken),
          signature_present: Boolean(signature)
        }
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Webhook recebido com sucesso.",
      normalized
    });
  } catch (error) {
    console.error("[LASTLINK WEBHOOK] Erro ao processar:", error);

    return res.status(500).json({
      ok: false,
      error: "Erro interno ao processar webhook."
    });
  }
});

app.get("/api/webhooks/lastlink/events", (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 20);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(limitRaw, 200))
      : 20;

    const events = readWebhookEvents(limit).map((item) => ({
      received_at: item.received_at,
      source: item.source,
      accepted: Boolean(item.accepted),
      request: {
        method: item.request?.method || "",
        ip: item.request?.ip || "",
        content_type: item.request?.content_type || "",
        token_present: Boolean(item.request?.token_present),
        token_preview: item.request?.token_preview || "",
        signature_present: Boolean(item.request?.signature_present),
        signature_preview: item.request?.signature_preview || ""
      },
      summary: item.summary || {},
      normalized: item.normalized || {},
      payload: item.payload || {}
    }));

    return res.status(200).json({
      ok: true,
      total: events.length,
      events
    });
  } catch (error) {
    console.error("[LASTLINK WEBHOOK] Erro ao listar eventos:", error);

    return res.status(500).json({
      ok: false,
      error: "Erro ao listar eventos do webhook."
    });
  }
});

app.get("/api/webhooks/lastlink/normalized", (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 20);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(limitRaw, 200))
      : 20;

    const events = readWebhookEvents(limit).map((item) => item.normalized || {}).filter(Boolean);

    return res.status(200).json({
      ok: true,
      total: events.length,
      events
    });
  } catch (error) {
    console.error("[LASTLINK WEBHOOK] Erro ao listar normalizados:", error);

    return res.status(500).json({
      ok: false,
      error: "Erro ao listar eventos normalizados."
    });
  }
});

app.use((req, res) => {
  res.status(404).send("Página não encontrada.");
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Healthcheck: http://localhost:${PORT}/health`);
  console.log(`Webhook GET: http://localhost:${PORT}/webhooks/lastlink`);
  console.log(`Webhook POST: http://localhost:${PORT}/webhooks/lastlink`);
  console.log(`Eventos recebidos: http://localhost:${PORT}/api/webhooks/lastlink/events`);
  console.log(`Eventos normalizados: http://localhost:${PORT}/api/webhooks/lastlink/normalized`);
  console.log(`LASTLINK_SKIP_TOKEN_VALIDATION=${LASTLINK_SKIP_TOKEN_VALIDATION}`);
});
