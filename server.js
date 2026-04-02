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
    limit: "2mb",
    verify: captureRawBody
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
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

function buildEventSummary(payload) {
  const body = payload && typeof payload === "object" ? payload : {};

  const customer = body.customer || body.client || body.buyer || body.Customer || {};
  const product = body.product || body.offer || body.Products || body.Product || {};
  const transaction = body.transaction || body.purchase || body.payment || body.Payment || {};

  return {
    raw_event_keys: Object.keys(body || {}),
    event_name:
      body.event ||
      body.event_name ||
      body.type ||
      body.status ||
      body.Event ||
      body.Type ||
      "unknown",
    event_id:
      body.id ||
      body.event_id ||
      transaction.id ||
      transaction.transaction_id ||
      body.EventId ||
      "",
    order_id:
      body.order_id ||
      transaction.order_id ||
      transaction.id ||
      body.OrderId ||
      "",
    transaction_id:
      transaction.transaction_id ||
      transaction.id ||
      body.transaction_id ||
      body.TransactionId ||
      "",
    status:
      body.status ||
      transaction.status ||
      body.payment_status ||
      body.Status ||
      "",
    product_id:
      product.id ||
      product.product_id ||
      body.product_id ||
      product.ID ||
      "",
    product_name:
      product.name ||
      product.title ||
      body.product_name ||
      product.Name ||
      "",
    customer_name:
      customer.name ||
      customer.full_name ||
      body.customer_name ||
      customer.Name ||
      "",
    customer_email:
      customer.email ||
      body.customer_email ||
      customer.Email ||
      "",
    customer_phone:
      customer.phone ||
      customer.mobile ||
      body.customer_phone ||
      customer.Phone ||
      "",
    lead_id:
      body.lead_id ||
      body.external_id ||
      body.metadata?.lead_id ||
      body.custom_fields?.lead_id ||
      "",
    session_id:
      body.session_id ||
      body.metadata?.session_id ||
      body.custom_fields?.session_id ||
      "",
    utm_source:
      body.utm_source ||
      body.metadata?.utm_source ||
      "",
    utm_medium:
      body.utm_medium ||
      body.metadata?.utm_medium ||
      "",
    utm_campaign:
      body.utm_campaign ||
      body.metadata?.utm_campaign ||
      "",
    utm_content:
      body.utm_content ||
      body.metadata?.utm_content ||
      "",
    utm_term:
      body.utm_term ||
      body.metadata?.utm_term ||
      ""
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
    const summary = buildEventSummary(payload);
    const tokenIsValid = isTokenValid(req);

    const record = {
      received_at: new Date().toISOString(),
      source: "lastlink",
      accepted: tokenIsValid,
      request: {
        method: req.method,
        original_url: req.originalUrl,
        ip: getClientIp(req),
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
      payload
    };

    saveWebhookEvent(record);

    console.log("[LASTLINK WEBHOOK] Evento recebido:", {
      accepted: tokenIsValid,
      received_at: record.received_at,
      event_name: summary.event_name,
      status: summary.status,
      transaction_id: summary.transaction_id,
      lead_id: summary.lead_id,
      session_id: summary.session_id,
      token_present: Boolean(requestToken),
      signature_present: Boolean(signature)
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
      summary
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
        signature_preview: item.request?.signature_preview || "",
        headers: item.request?.headers || {}
      },
      summary: item.summary || {},
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

app.use((req, res) => {
  res.status(404).send("Página não encontrada.");
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Healthcheck: http://localhost:${PORT}/health`);
  console.log(`Webhook GET: http://localhost:${PORT}/webhooks/lastlink`);
  console.log(`Webhook POST: http://localhost:${PORT}/webhooks/lastlink`);
  console.log(`Eventos recebidos: http://localhost:${PORT}/api/webhooks/lastlink/events`);
  console.log(`LASTLINK_SKIP_TOKEN_VALIDATION=${LASTLINK_SKIP_TOKEN_VALIDATION}`);
});
