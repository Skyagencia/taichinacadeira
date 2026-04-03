require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

const LASTLINK_WEBHOOK_TOKEN = String(process.env.LASTLINK_WEBHOOK_TOKEN || "").trim();
const LASTLINK_SKIP_TOKEN_VALIDATION =
  String(process.env.LASTLINK_SKIP_TOKEN_VALIDATION || "true").trim().toLowerCase() === "true";

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const META_PIXEL_ID = String(process.env.META_PIXEL_ID || "").trim();
const META_ACCESS_TOKEN = String(process.env.META_ACCESS_TOKEN || "").trim();
const META_TEST_EVENT_CODE = String(process.env.META_TEST_EVENT_CODE || "").trim();
const META_ALLOW_TEST_EVENTS =
  String(process.env.META_ALLOW_TEST_EVENTS || "true").trim().toLowerCase() === "true";
const META_CURRENCY = String(process.env.META_CURRENCY || "BRL").trim().toUpperCase();

const WEBHOOK_LOG_DIR = path.join(ROOT_DIR, "data");
const WEBHOOK_LOG_FILE = path.join(WEBHOOK_LOG_DIR, "lastlink-webhooks.jsonl");

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function captureRawBody(req, res, buffer) {
  req.rawBody = buffer && buffer.length ? buffer.toString("utf8") : "";
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
  if (LASTLINK_SKIP_TOKEN_VALIDATION) return true;
  if (!LASTLINK_WEBHOOK_TOKEN) return true;

  const incomingToken = getRequestToken(req);
  if (!incomingToken) return false;

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

function normalizeDocument(value) {
  return String(value || "").replace(/\D+/g, "");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeNullableString(value) {
  const clean = normalizeString(value);
  return clean || null;
}

function normalizeInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.trunc(num);
}

function normalizeIsoDateTime(value, fallback = null) {
  const clean = normalizeString(value);
  if (!clean) return fallback;
  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value || "").trim().toLowerCase()).digest("hex");
}

function splitName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ")
  };
}

function addHashedField(target, field, rawValue) {
  const clean = String(rawValue || "").trim();
  if (!clean) return;
  target[field] = [sha256Hex(clean)];
}

function getFirstProduct(data) {
  return Array.isArray(data?.Products) && data.Products.length > 0 ? data.Products[0] || {} : {};
}

function getFirstSubscription(data) {
  return Array.isArray(data?.Subscriptions) && data.Subscriptions.length > 0
    ? data.Subscriptions[0] || {}
    : {};
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
  const data = body.Data && typeof data === "object" ? body.Data : body.Data;
  const safeData = data && typeof data === "object" ? data : {};

  const product = getFirstProduct(safeData);
  const buyer = safeData.Buyer && typeof safeData.Buyer === "object" ? safeData.Buyer : {};
  const seller = safeData.Seller && typeof safeData.Seller === "object" ? safeData.Seller : {};
  const purchase = safeData.Purchase && typeof safeData.Purchase === "object" ? safeData.Purchase : {};
  const payment = purchase.Payment && typeof purchase.Payment === "object" ? purchase.Payment : {};
  const affiliate = purchase.Affiliate && typeof purchase.Affiliate === "object" ? purchase.Affiliate : {};
  const offer = safeData.Offer && typeof safeData.Offer === "object" ? safeData.Offer : {};
  const utm = safeData.Utm && typeof safeData.Utm === "object" ? safeData.Utm : {};
  const deviceInfo =
    safeData.DeviceInfo && typeof safeData.DeviceInfo === "object" ? safeData.DeviceInfo : {};
  const subscription = getFirstSubscription(safeData);
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
    buyer_document: normalizeDocument(buyer.Document),

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

    buyer_city: summary.buyer_city,
    buyer_state: summary.buyer_state,
    buyer_zipcode: summary.buyer_zipcode,

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
  const lines = fileContent.split("\n").map((line) => line.trim()).filter(Boolean);

  return lines
    .slice(-limit)
    .reverse()
    .map((line) => safeJsonParse(line, null))
    .filter(Boolean);
}

async function saveEventToSupabase(record) {
  if (!supabase) {
    return { ok: false, skipped: true, reason: "Supabase não configurado." };
  }

  const normalized = record.normalized || {};
  const summary = record.summary || {};
  const request = record.request || {};

  const row = {
    source: String(record.source || "lastlink"),
    accepted: Boolean(record.accepted),
    received_at: record.received_at || new Date().toISOString(),

    event_id: normalized.event_id || null,
    event_name: normalized.event_name || null,
    event_status: normalized.event_status || null,
    is_test: normalized.is_test === true,
    created_at: normalized.created_at || null,

    product_id: normalized.product_id || null,
    product_name: normalized.product_name || null,
    offer_id: normalized.offer_id || null,
    offer_name: normalized.offer_name || null,
    offer_url: normalized.offer_url || null,

    buyer_id: normalized.buyer_id || null,
    buyer_name: normalized.buyer_name || null,
    buyer_email: normalized.buyer_email || null,
    buyer_phone: normalized.buyer_phone || null,
    buyer_document: normalized.buyer_document || null,

    payment_id: normalized.payment_id || null,
    payment_date: normalized.payment_date || null,
    chargeback_date: normalized.chargeback_date || null,
    recurrency: normalized.recurrency,
    price_value: normalized.price_value,
    original_price_value: normalized.original_price_value,
    payment_method: normalized.payment_method || null,
    installments: normalized.installments,

    affiliate_id: normalized.affiliate_id || null,
    affiliate_email: normalized.affiliate_email || null,

    subscription_id: normalized.subscription_id || null,
    subscription_product_id: normalized.subscription_product_id || null,
    canceled_date: normalized.canceled_date || null,
    cancellation_reason: normalized.cancellation_reason || null,

    utm_source: normalized.utm_source || null,
    utm_medium: normalized.utm_medium || null,
    utm_campaign: normalized.utm_campaign || null,
    utm_term: normalized.utm_term || null,
    utm_content: normalized.utm_content || null,

    device_ip: normalized.device_ip || null,
    device_user_agent: normalized.device_user_agent || null,

    lead_id: normalized.lead_id || null,
    session_id: normalized.session_id || null,

    request_ip: normalized.request_ip || null,
    request_token_present: Boolean(normalized.request_token_present),
    request_signature_present: Boolean(normalized.request_signature_present),

    raw_payload: record.payload || {},
    normalized_payload: {
      summary,
      normalized
    },
    request_meta: {
      method: request.method || "",
      original_url: request.original_url || "",
      ip: request.ip || "",
      user_agent: request.user_agent || "",
      content_type: request.content_type || "",
      token_present: Boolean(request.token_present),
      token_preview: request.token_preview || "",
      signature_present: Boolean(request.signature_present),
      signature_preview: request.signature_preview || "",
      headers: request.headers || {}
    }
  };

  const { data, error } = await supabase
    .from("lastlink_webhook_events")
    .upsert(row, { onConflict: "event_id" })
    .select("id, event_id, event_name, event_status")
    .single();

  if (error) {
    return { ok: false, skipped: false, error };
  }

  return { ok: true, skipped: false, data };
}

function buildFrontendTrackingRecord(req) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const requestIp = getClientIp(req);
  const receivedAt = new Date().toISOString();

  const payload = {
    ...body,
    request_meta: {
      method: req.method,
      original_url: req.originalUrl,
      ip: requestIp,
      user_agent: String(req.headers["user-agent"] || ""),
      content_type: String(req.headers["content-type"] || ""),
      headers: sanitizeHeaders(req.headers),
      received_at: receivedAt
    }
  };

  const record = {
    created_at: receivedAt,
    event_time: normalizeIsoDateTime(body.event_time, receivedAt),

    funnel_id: normalizeNullableString(body.funnel_id),
    funnel_name: normalizeNullableString(body.funnel_name),
    page_type: normalizeNullableString(body.page_type),
    page_url: normalizeNullableString(body.page_url),
    page_path: normalizeNullableString(body.page_path),
    referrer: normalizeNullableString(body.referrer),

    event_name: normalizeString(body.event_name),
    event_id: normalizeNullableString(body.event_id),
    event_source: normalizeNullableString(body.event_source) || "website",

    lead_id: normalizeNullableString(body.lead_id),
    session_id: normalizeNullableString(body.session_id),

    step_id: normalizeNullableString(body.step_id),
    step_index: normalizeInteger(body.step_index),
    step_name: normalizeNullableString(body.step_name),
    step_type: normalizeNullableString(body.step_type),

    button_id: normalizeNullableString(body.button_id),
    button_text: normalizeNullableString(body.button_text),

    checkout_url: normalizeNullableString(body.checkout_url),

    utm_source: normalizeNullableString(body.utm_source),
    utm_medium: normalizeNullableString(body.utm_medium),
    utm_campaign: normalizeNullableString(body.utm_campaign),
    utm_content: normalizeNullableString(body.utm_content),
    utm_term: normalizeNullableString(body.utm_term),

    fbp: normalizeNullableString(body.fbp),
    fbc: normalizeNullableString(body.fbc),
    user_agent: String(req.headers["user-agent"] || ""),
    ip_address: requestIp,

    payload
  };

  return record;
}

function validateFrontendTrackingRecord(record) {
  if (!record.event_name) {
    return "event_name é obrigatório.";
  }

  return null;
}

async function saveFrontendTrackingEventToSupabase(record) {
  if (!supabase) {
    return { ok: false, skipped: true, reason: "Supabase não configurado." };
  }

  const row = {
    created_at: record.created_at,
    event_time: record.event_time,

    funnel_id: record.funnel_id,
    funnel_name: record.funnel_name,
    page_type: record.page_type,
    page_url: record.page_url,
    page_path: record.page_path,
    referrer: record.referrer,

    event_name: record.event_name,
    event_id: record.event_id,
    event_source: record.event_source,

    lead_id: record.lead_id,
    session_id: record.session_id,

    step_id: record.step_id,
    step_index: record.step_index,
    step_name: record.step_name,
    step_type: record.step_type,

    button_id: record.button_id,
    button_text: record.button_text,

    checkout_url: record.checkout_url,

    utm_source: record.utm_source,
    utm_medium: record.utm_medium,
    utm_campaign: record.utm_campaign,
    utm_content: record.utm_content,
    utm_term: record.utm_term,

    fbp: record.fbp,
    fbc: record.fbc,
    user_agent: record.user_agent,
    ip_address: record.ip_address,

    payload: record.payload || {}
  };

  let query = supabase.from("frontend_tracking_events");

  if (row.event_id) {
    query = query.upsert(row, { onConflict: "event_id" });
  } else {
    query = query.insert(row);
  }

  const { data, error } = await query
    .select("id, created_at, event_time, event_name, event_id, lead_id, session_id")
    .single();

  if (error) {
    return { ok: false, skipped: false, error };
  }

  return { ok: true, skipped: false, data };
}

function getMetaEventTime(normalized) {
  const candidates = [
    normalized.payment_date,
    normalized.created_at,
    normalized.received_at
  ];

  for (const value of candidates) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return Math.floor(parsed.getTime() / 1000);
    }
  }

  return Math.floor(Date.now() / 1000);
}

function buildMetaUserData(normalized) {
  const userData = {};
  const { firstName, lastName } = splitName(normalized.buyer_name);

  addHashedField(userData, "em", normalizeText(normalized.buyer_email));
  addHashedField(userData, "ph", normalizePhone(normalized.buyer_phone));
  addHashedField(userData, "fn", normalizeText(firstName));
  addHashedField(userData, "ln", normalizeText(lastName));
  addHashedField(userData, "zp", normalizeDocument(normalized.buyer_zipcode));
  addHashedField(userData, "ct", normalizeText(normalized.buyer_city));
  addHashedField(userData, "st", normalizeText(normalized.buyer_state));

  const externalBase =
    normalized.lead_id ||
    normalized.session_id ||
    normalized.payment_id ||
    normalized.event_id ||
    normalized.buyer_document ||
    normalized.buyer_id;

  addHashedField(userData, "external_id", externalBase);

  if (normalized.request_ip || normalized.device_ip) {
    userData.client_ip_address = normalized.request_ip || normalized.device_ip;
  }

  if (normalized.device_user_agent) {
    userData.client_user_agent = normalized.device_user_agent;
  }

  return userData;
}

function shouldSendPurchaseToMeta(normalized) {
  if (!META_PIXEL_ID || !META_ACCESS_TOKEN) {
    return { ok: false, skipped: true, reason: "Meta não configurada." };
  }

  if (normalized.event_name !== "Purchase_Order_Confirmed") {
    return { ok: false, skipped: true, reason: "Evento não é compra confirmada." };
  }

  if (normalized.is_test && !META_ALLOW_TEST_EVENTS) {
    return { ok: false, skipped: true, reason: "Eventos de teste estão desativados para Meta." };
  }

  return { ok: true, skipped: false };
}

async function sendPurchaseToMeta(normalized) {
  const validation = shouldSendPurchaseToMeta(normalized);
  if (!validation.ok) {
    return validation;
  }

  const eventId = `lastlink_purchase_${normalized.payment_id || normalized.event_id}`;
  const eventTime = getMetaEventTime(normalized);
  const userData = buildMetaUserData(normalized);

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: eventTime,
        event_id: eventId,
        action_source: "website",
        event_source_url: normalized.offer_url || "https://lastlink.com",
        user_data: userData,
        custom_data: {
          currency: META_CURRENCY,
          value: normalized.price_value != null ? Number(normalized.price_value) : 0,
          content_name: normalized.product_name || normalized.offer_name || "Produto Lastlink",
          content_type: "product",
          content_ids: normalized.product_id ? [normalized.product_id] : [],
          order_id: normalized.payment_id || normalized.event_id,
          num_items: 1
        }
      }
    ]
  };

  if (normalized.is_test && META_TEST_EVENT_CODE) {
    payload.test_event_code = META_TEST_EVENT_CODE;
  }

  const url = `https://graph.facebook.com/v23.0/${encodeURIComponent(
    META_PIXEL_ID
  )}/events?access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    const responseJson = safeJsonParse(responseText, { raw: responseText });

    if (!response.ok) {
      return {
        ok: false,
        skipped: false,
        status: response.status,
        error: responseJson
      };
    }

    return {
      ok: true,
      skipped: false,
      status: response.status,
      event_id: eventId,
      payload,
      response: responseJson
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error: {
        message: error.message || "Erro desconhecido ao enviar para Meta."
      }
    };
  }
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
    },
    tracking: {
      route: "/track-event"
    },
    supabase: {
      configured: Boolean(supabase)
    },
    meta: {
      configured: Boolean(META_PIXEL_ID && META_ACCESS_TOKEN),
      allow_test_events: META_ALLOW_TEST_EVENTS,
      has_test_event_code: Boolean(META_TEST_EVENT_CODE)
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

app.post("/track-event", async (req, res) => {
  try {
    const record = buildFrontendTrackingRecord(req);
    const validationError = validateFrontendTrackingRecord(record);

    if (validationError) {
      return res.status(400).json({
        ok: false,
        error: validationError
      });
    }

    const supabaseResult = await saveFrontendTrackingEventToSupabase(record);

    console.log("[FRONT TRACKING] Evento recebido:", {
      event_name: record.event_name,
      event_id: record.event_id,
      lead_id: record.lead_id,
      session_id: record.session_id,
      step_id: record.step_id,
      step_index: record.step_index,
      page_type: record.page_type,
      utm_campaign: record.utm_campaign,
      supabase_ok: supabaseResult.ok,
      supabase_skipped: supabaseResult.skipped || false,
      supabase_error: supabaseResult.error || null
    });

    if (!supabaseResult.ok) {
      return res.status(500).json({
        ok: false,
        error: "Não foi possível salvar o evento no Supabase.",
        supabase: supabaseResult
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Evento de tracking recebido com sucesso.",
      event: {
        event_name: record.event_name,
        event_id: record.event_id,
        lead_id: record.lead_id,
        session_id: record.session_id
      },
      supabase: supabaseResult
    });
  } catch (error) {
    console.error("[FRONT TRACKING] Erro ao processar evento:", error);

    return res.status(500).json({
      ok: false,
      error: "Erro interno ao processar tracking."
    });
  }
});

app.get("/api/tracking/events", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        ok: false,
        error: "Supabase não configurado."
      });
    }

    const limitRaw = Number(req.query.limit || 20);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 20;

    const { data, error } = await supabase
      .from("frontend_tracking_events")
      .select(
        "id, created_at, event_time, event_name, event_id, lead_id, session_id, step_id, step_index, page_type, utm_campaign"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({
        ok: false,
        error: "Erro ao listar eventos de tracking.",
        details: error
      });
    }

    return res.status(200).json({
      ok: true,
      total: Array.isArray(data) ? data.length : 0,
      events: data || []
    });
  } catch (error) {
    console.error("[FRONT TRACKING] Erro ao listar eventos:", error);

    return res.status(500).json({
      ok: false,
      error: "Erro interno ao listar tracking."
    });
  }
});

app.post("/webhooks/lastlink", async (req, res) => {
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

    const supabaseResult = await saveEventToSupabase(record);
    const metaResult = await sendPurchaseToMeta(normalized);

    console.log("[LASTLINK WEBHOOK] Evento recebido:", {
      accepted: tokenIsValid,
      event_name: normalized.event_name,
      event_status: normalized.event_status,
      payment_id: normalized.payment_id,
      buyer_email: normalized.buyer_email,
      payment_method: normalized.payment_method,
      price_value: normalized.price_value,
      is_test: normalized.is_test,
      supabase_ok: supabaseResult.ok,
      supabase_skipped: supabaseResult.skipped || false,
      meta_ok: metaResult.ok,
      meta_skipped: metaResult.skipped || false,
      meta_reason: metaResult.reason || "",
      meta_status: metaResult.status || null,
      meta_error: metaResult.error || null,
      meta_response: metaResult.response || null
    });

    if (!tokenIsValid) {
      return res.status(401).json({
        ok: false,
        error: "Token do webhook inválido ou ausente.",
        debug: {
          token_present: Boolean(requestToken),
          signature_present: Boolean(signature)
        },
        supabase: supabaseResult,
        meta: metaResult
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Webhook recebido com sucesso.",
      normalized,
      supabase: supabaseResult,
      meta: metaResult
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
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 20;

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
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 20;

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
  console.log(`Tracking POST: http://localhost:${PORT}/track-event`);
  console.log(`Tracking GET: http://localhost:${PORT}/api/tracking/events`);
  console.log(`Webhook GET: http://localhost:${PORT}/webhooks/lastlink`);
  console.log(`Webhook POST: http://localhost:${PORT}/webhooks/lastlink`);
  console.log(`Eventos recebidos: http://localhost:${PORT}/api/webhooks/lastlink/events`);
  console.log(`Eventos normalizados: http://localhost:${PORT}/api/webhooks/lastlink/normalized`);
  console.log(`LASTLINK_SKIP_TOKEN_VALIDATION=${LASTLINK_SKIP_TOKEN_VALIDATION}`);
  console.log(`SUPABASE_CONFIGURED=${Boolean(supabase)}`);
  console.log(`META_CONFIGURED=${Boolean(META_PIXEL_ID && META_ACCESS_TOKEN)}`);
  console.log(`META_ALLOW_TEST_EVENTS=${META_ALLOW_TEST_EVENTS}`);
  console.log(`META_HAS_TEST_EVENT_CODE=${Boolean(META_TEST_EVENT_CODE)}`);
});
