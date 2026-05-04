/**
 * notify/index.ts — Supabase Edge Function
 *
 * Receives contact form data and fans out notifications to:
 *  • WhatsApp via CallMeBot (one request per active recipient)
 *  • Discord via webhook
 *
 * Running server-side avoids the CORS restrictions that block both
 * CallMeBot and Discord webhooks when called directly from the browser.
 *
 * Deploy:
 *   supabase functions deploy notify
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, service, message } = await req.json();

    // Use the service-role key so we can read site_settings + recipients
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch recipients and settings in parallel
    const [{ data: recipients }, { data: settings }] = await Promise.all([
      supabase
        .from("whatsapp_notification_recipients")
        .select("phone_number, api_key")
        .eq("active", true),
      supabase.from("site_settings").select("key, value"),
    ]);

    const map: Record<string, string> = {};
    (settings ?? []).forEach((s: { key: string; value: string }) => {
      map[s.key] = s.value;
    });

    const waEnabled = (map["whatsapp_notifications_enabled"] ?? "true") === "true";
    const discordEnabled = (map["discord_notifications_enabled"] ?? "true") === "true";
    const discordWebhook = map["discord_webhook_url"] ?? "";

    const msgText =
      `🔔 *New Contact Form Submission*\n\n` +
      `👤 *Name:* ${name}\n` +
      `📧 *Email:* ${email}\n` +
      `🛠 *Service:* ${service}\n\n` +
      `💬 *Message:*\n${message}`;

    const promises: Promise<unknown>[] = [];

    // ── WhatsApp via CallMeBot ───────────────────────────────────────────────
    console.log("WA enabled:", waEnabled, "| recipients:", recipients?.length ?? 0);
    if (waEnabled && recipients && recipients.length > 0) {
      for (const r of recipients) {
        if (!r.phone_number || !r.api_key) continue;
        // Strip leading + — CallMeBot expects digits only
        const phone = r.phone_number.replace(/^\+/, "");
        const url =
          `https://api.callmebot.com/whatsapp.php` +
          `?phone=${encodeURIComponent(phone)}` +
          `&text=${encodeURIComponent(msgText)}` +
          `&apikey=${encodeURIComponent(r.api_key)}`;
        console.log("Calling CallMeBot for phone:", phone, "| api_key set:", !!r.api_key);
        promises.push(
          fetch(url).then(async (res) => {
            const body = await res.text();
            console.log("CallMeBot response:", res.status, body.slice(0, 200));
            return body;
          }).catch((err) => {
            console.error("CallMeBot fetch error:", err);
          })
        );
      }
    }

    // ── Discord webhook ──────────────────────────────────────────────────────
    if (discordEnabled && discordWebhook.startsWith("https://discord.com/api/webhooks/")) {
      promises.push(
        fetch(discordWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [
              {
                title: "📬 New Contact Form Submission",
                color: 0xe05555,
                fields: [
                  { name: "Name",    value: name,                    inline: true  },
                  { name: "Email",   value: email,                   inline: true  },
                  { name: "Service", value: service,                 inline: false },
                  { name: "Message", value: message.slice(0, 1024),  inline: false },
                ],
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        }),
      );
    }

    await Promise.allSettled(promises);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});