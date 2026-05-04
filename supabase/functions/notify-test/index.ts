/**
 * notify-test/index.ts — Supabase Edge Function
 *
 * Sends a test WhatsApp message via CallMeBot for a single recipient.
 * Called from the admin dashboard "Test" button.
 *
 * Deploy:
 *   supabase functions deploy notify-test
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone_number, api_key } = await req.json();

    if (!phone_number || !api_key) {
      return new Response(JSON.stringify({ error: "phone_number and api_key are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = phone_number.replace(/^\+/, ""); // digits only for CallMeBot
    const text = encodeURIComponent(
      `🔔 *Test Notification*\nThis is a test from your RedSpark Digital admin dashboard.\n\n✅ WhatsApp alerts are working correctly for this number.`
    );
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${text}&apikey=${encodeURIComponent(api_key)}`;

    const res = await fetch(url);
    const body = await res.text();

    console.log("CallMeBot response:", res.status, body.slice(0, 200));

    if (body.toLowerCase().includes("error")) {
      throw new Error(body);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-test error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});