/**
 * WhatsApp Cloud API Integration Routes
 *
 * Handles webhook verification, incoming messages, outbound messaging,
 * and connection status via Meta Graph API v21.0.
 */

import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WhatsAppBindings {
  AI: any;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_ID?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
}

interface IncomingMessage {
  from: string;
  text: string;
  timestamp: number;
  messageId: string;
}

interface QueuedMessage {
  id: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  text: string;
  timestamp: number;
  status: "received" | "sent" | "failed";
}

interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: { display_phone_number: string; phone_number_id: string };
      contacts?: Array<{ profile: { name: string }; wa_id: string }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        type: string;
        text?: { body: string };
      }>;
      statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
      }>;
    };
    field: string;
  }>;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

// ---------------------------------------------------------------------------
// In-memory message queue (recent messages tracker)
// ---------------------------------------------------------------------------

const MESSAGE_QUEUE_LIMIT = 200;
const messageQueue: QueuedMessage[] = [];

function pushMessage(msg: QueuedMessage): void {
  messageQueue.push(msg);
  if (messageQueue.length > MESSAGE_QUEUE_LIMIT) {
    messageQueue.splice(0, messageQueue.length - MESSAGE_QUEUE_LIMIT);
  }
}

// ---------------------------------------------------------------------------
// Meta Graph API helpers
// ---------------------------------------------------------------------------

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[WHATSAPP] Send failed (${res.status}): ${err}`);
      return { success: false, error: `HTTP ${res.status}: ${err}` };
    }

    const data = (await res.json()) as { messages?: Array<{ id: string }> };
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (e: any) {
    console.error(`[WHATSAPP] Send error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

async function generateHydraResponse(ai: any, userMessage: string): Promise<string> {
  try {
    const result = await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        {
          role: "system",
          content:
            "You are HYDRA, an advanced AI assistant communicating via WhatsApp. " +
            "Be helpful, concise, and friendly. Keep responses under 1000 characters " +
            "since this is a messaging platform. Use plain text without markdown.",
        },
        { role: "user", content: userMessage },
      ],
      max_tokens: 512,
    });
    return result.response || "I wasn't able to generate a response. Please try again.";
  } catch (e: any) {
    console.error(`[WHATSAPP] HYDRA generation error: ${e.message}`);
    return "Sorry, I'm having trouble processing your message right now. Please try again later.";
  }
}

// ---------------------------------------------------------------------------
// Extract text messages from webhook payload
// ---------------------------------------------------------------------------

function extractMessages(payload: WhatsAppWebhookPayload): IncomingMessage[] {
  const messages: IncomingMessage[] = [];

  if (payload.object !== "whatsapp_business_account") return messages;

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const value = change.value;
      if (!value.messages) continue;

      for (const msg of value.messages) {
        if (msg.type === "text" && msg.text?.body) {
          messages.push({
            from: msg.from,
            text: msg.text.body,
            timestamp: parseInt(msg.timestamp, 10) * 1000,
            messageId: msg.id,
          });
        }
      }
    }
  }

  return messages;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const whatsapp = new Hono<{ Bindings: WhatsAppBindings }>();

/**
 * GET /api/whatsapp/webhook
 * Webhook verification endpoint for Meta webhook subscription.
 */
whatsapp.get("/webhook", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  const verifyToken = c.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error("[WHATSAPP] WHATSAPP_VERIFY_TOKEN not configured");
    return c.text("Verify token not configured", 500);
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WHATSAPP] Webhook verified successfully");
    return c.text(challenge || "", 200);
  }

  console.warn(`[WHATSAPP] Webhook verification failed (mode=${mode})`);
  return c.text("Forbidden", 403);
});

/**
 * POST /api/whatsapp/webhook
 * Receives incoming messages from WhatsApp Cloud API.
 */
whatsapp.post("/webhook", async (c) => {
  const accessToken = c.env.WHATSAPP_TOKEN;
  const phoneNumberId = c.env.WHATSAPP_PHONE_ID;

  if (!accessToken || !phoneNumberId) {
    // Still return 200 so Meta doesn't retry endlessly
    console.error("[WHATSAPP] Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID");
    return c.text("OK", 200);
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = await c.req.json<WhatsAppWebhookPayload>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const incoming = extractMessages(payload);

  if (incoming.length === 0) {
    // Could be a status update or unsupported message type
    return c.text("OK", 200);
  }

  // Process messages asynchronously so we can return 200 quickly
  const processMessages = async () => {
    for (const msg of incoming) {
      pushMessage({
        id: msg.messageId,
        direction: "inbound",
        from: msg.from,
        to: phoneNumberId,
        text: msg.text,
        timestamp: msg.timestamp,
        status: "received",
      });

      console.log(`[WHATSAPP] Incoming from ${msg.from}: "${msg.text.slice(0, 100)}"`);

      // Generate AI response
      const reply = await generateHydraResponse(c.env.AI, msg.text);

      // Send reply
      const result = await sendWhatsAppMessage(phoneNumberId, accessToken, msg.from, reply);

      pushMessage({
        id: result.messageId || `out_${Date.now()}`,
        direction: "outbound",
        from: phoneNumberId,
        to: msg.from,
        text: reply,
        timestamp: Date.now(),
        status: result.success ? "sent" : "failed",
      });

      if (!result.success) {
        console.error(`[WHATSAPP] Failed to reply to ${msg.from}: ${result.error}`);
      }
    }
  };

  c.executionCtx.waitUntil(processMessages());

  return c.text("OK", 200);
});

/**
 * POST /api/whatsapp/send
 * Send a message to a WhatsApp number.
 *
 * Body: { to: string, message: string }
 */
whatsapp.post("/send", async (c) => {
  const accessToken = c.env.WHATSAPP_TOKEN;
  const phoneNumberId = c.env.WHATSAPP_PHONE_ID;

  if (!accessToken || !phoneNumberId) {
    return c.json(
      { error: "WhatsApp not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID." },
      503,
    );
  }

  let body: { to?: string; message?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { to, message } = body;

  if (!to || typeof to !== "string") {
    return c.json({ error: "to is required and must be a phone number string" }, 400);
  }

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return c.json({ error: "message is required and must be a non-empty string" }, 400);
  }

  if (message.length > 4096) {
    return c.json({ error: "message must be 4096 characters or less" }, 400);
  }

  const result = await sendWhatsAppMessage(phoneNumberId, accessToken, to, message);

  if (result.success) {
    pushMessage({
      id: result.messageId || `out_${Date.now()}`,
      direction: "outbound",
      from: phoneNumberId,
      to,
      text: message,
      timestamp: Date.now(),
      status: "sent",
    });
  }

  return c.json(
    {
      ok: result.success,
      messageId: result.messageId ?? null,
      error: result.error ?? null,
    },
    result.success ? 200 : 502,
  );
});

/**
 * GET /api/whatsapp/status
 * Check WhatsApp connection status and recent message stats.
 */
whatsapp.get("/status", (c) => {
  const configured =
    !!c.env.WHATSAPP_TOKEN && !!c.env.WHATSAPP_PHONE_ID && !!c.env.WHATSAPP_VERIFY_TOKEN;

  const recentInbound = messageQueue.filter((m) => m.direction === "inbound");
  const recentOutbound = messageQueue.filter((m) => m.direction === "outbound");
  const failedMessages = messageQueue.filter((m) => m.status === "failed");

  const lastMessage =
    messageQueue.length > 0 ? messageQueue[messageQueue.length - 1] : null;

  return c.json({
    configured,
    phoneNumberId: c.env.WHATSAPP_PHONE_ID ?? null,
    webhookVerifyTokenSet: !!c.env.WHATSAPP_VERIFY_TOKEN,
    stats: {
      queueSize: messageQueue.length,
      inbound: recentInbound.length,
      outbound: recentOutbound.length,
      failed: failedMessages.length,
      lastMessageAt: lastMessage?.timestamp ?? null,
    },
  });
});

/**
 * POST /api/whatsapp/setup
 * Save WhatsApp configuration.
 *
 * Body: { phoneNumberId: string, businessAccountId: string, accessToken: string, verifyToken: string }
 *
 * Note: In a Cloudflare Workers environment env vars are set via wrangler secrets,
 * so this endpoint validates the provided config and returns confirmation.
 * Actual secret persistence should be done via `wrangler secret put`.
 */
whatsapp.post("/setup", async (c) => {
  let body: {
    phoneNumberId?: string;
    businessAccountId?: string;
    accessToken?: string;
    verifyToken?: string;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { phoneNumberId, businessAccountId, accessToken, verifyToken } = body;

  const missing: string[] = [];
  if (!phoneNumberId) missing.push("phoneNumberId");
  if (!businessAccountId) missing.push("businessAccountId");
  if (!accessToken) missing.push("accessToken");
  if (!verifyToken) missing.push("verifyToken");

  if (missing.length > 0) {
    return c.json({ error: `Missing required fields: ${missing.join(", ")}` }, 400);
  }

  // Validate the token by calling the Graph API
  try {
    const testUrl = `${GRAPH_API_BASE}/${phoneNumberId}?access_token=${accessToken}`;
    const res = await fetch(testUrl);

    if (!res.ok) {
      const errBody = await res.text();
      return c.json(
        {
          error: "Token validation failed",
          detail: `Graph API returned ${res.status}: ${errBody.slice(0, 300)}`,
          hint: "Verify your access token and phone number ID are correct.",
        },
        422,
      );
    }
  } catch (e: any) {
    return c.json(
      { error: "Failed to validate config", detail: e.message },
      502,
    );
  }

  console.log(
    `[WHATSAPP] Setup validated for phone ${phoneNumberId} (business ${businessAccountId})`,
  );

  return c.json({
    ok: true,
    phoneNumberId,
    businessAccountId,
    hint: "Configuration validated. Set secrets via: wrangler secret put WHATSAPP_TOKEN / WHATSAPP_PHONE_ID / WHATSAPP_VERIFY_TOKEN",
  });
});

export { whatsapp };
