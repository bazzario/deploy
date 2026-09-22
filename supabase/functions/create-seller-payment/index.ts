/**
 * Supabase Edge Function — create-seller-payment
 *
 * Deploy:  supabase functions deploy create-seller-payment
 *
 * Kya karta hai:
 *   1. Signed-in seller ka JWT verify karta hai (Authorization header).
 *   2. seller_payments mein ek PENDING row banata hai (service_role se).
 *   3. Chune hue gateway ka hosted-checkout URL banata hai aur wapas deta hai.
 *
 * Kya NAHI karta:
 *   - Kisi payment ko 'paid' nahi karta. Woh sirf callback function karta hai,
 *     gateway ka signature verify karne ke baad.
 *
 * SAARE secrets Supabase secrets se aate hain (never in the frontend):
 *   supabase secrets set SELLER_PLAN_PRICE=... SELLER_PLAN_MONTHS=12 \
 *     JAZZCASH_MERCHANT_ID=... JAZZCASH_PASSWORD=... JAZZCASH_INTEGRITY_SALT=... \
 *     JAZZCASH_RETURN_URL=... EASYPAISA_STORE_ID=... EASYPAISA_HASH_KEY=... \
 *     EASYPAISA_RETURN_URL=... CARD_GATEWAY_KEY=... CARD_GATEWAY_RETURN_URL=...
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PLAN_PRICE = Number(Deno.env.get("SELLER_PLAN_PRICE") ?? "");
const PLAN_MONTHS = Number(Deno.env.get("SELLER_PLAN_MONTHS") ?? "12");
const CURRENCY = Deno.env.get("SELLER_PLAN_CURRENCY") ?? "PKR";

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type Method = "card" | "jazzcash" | "easypaisa";

/**
 * Har gateway ke liye hosted checkout URL banayein.
 *
 * YAHAN APNA GATEWAY INTEGRATION LIKHEIN. Jab tak kisi method ke secrets set
 * nahi hain, yeh null return karta hai aur UI "Payment gateway not configured"
 * dikhati hai — koi fake success nahi.
 */
async function buildCheckoutUrl(
  method: Method,
  paymentId: string,
  amount: number,
): Promise<string | null> {
  if (method === "jazzcash") {
    const merchantId = Deno.env.get("JAZZCASH_MERCHANT_ID");
    const password = Deno.env.get("JAZZCASH_PASSWORD");
    const salt = Deno.env.get("JAZZCASH_INTEGRITY_SALT");
    const returnUrl = Deno.env.get("JAZZCASH_RETURN_URL");
    if (!merchantId || !password || !salt || !returnUrl) return null;

    // TODO: JazzCash HTTP/Hosted Checkout ke documented fields banayein
    // (pp_Amount paisa mein, pp_TxnRefNo, pp_TxnDateTime, pp_TxnExpiryDateTime,
    // pp_ReturnURL, pp_BillReference, pp_Description) aur pp_SecureHash =
    // HMAC-SHA256(salt, sorted-field-values) sign karein. Exact field list
    // aapke JazzCash merchant pack mein hoti hai.
    throw new Error("JazzCash request signing is not implemented yet.");
  }

  if (method === "easypaisa") {
    const storeId = Deno.env.get("EASYPAISA_STORE_ID");
    const hashKey = Deno.env.get("EASYPAISA_HASH_KEY");
    const returnUrl = Deno.env.get("EASYPAISA_RETURN_URL");
    if (!storeId || !hashKey || !returnUrl) return null;

    // TODO: Easypaisa Merchant (Telenor Microfinance) ke hosted checkout ke
    // documented fields + AES/HMAC hash banayein.
    throw new Error("Easypaisa request signing is not implemented yet.");
  }

  // Card — koi bhi card gateway (e.g. Safepay, PayFast PK, Stripe).
  const cardKey = Deno.env.get("CARD_GATEWAY_KEY");
  const cardReturn = Deno.env.get("CARD_GATEWAY_RETURN_URL");
  if (!cardKey || !cardReturn) return null;

  // TODO: apne card gateway ka "create checkout session" API call karein aur
  // uska hosted URL return karein. Amount aur paymentId yahan bhejein taake
  // callback par match ho sake.
  throw new Error("Card gateway session creation is not implemented yet.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Not signed in" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. User verify karein — client jo bhi bheje, seller_id hum khud nikalte hain.
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) return json({ error: "Not signed in" }, 401);
  const sellerId = userData.user.id;

  // 2. Method validate karein.
  let method: Method = "card";
  try {
    const body = await req.json();
    if (["card", "jazzcash", "easypaisa"].includes(body?.method)) method = body.method;
  } catch {
    // default card
  }

  // 3. Price server par tay hoti hai — client se amount kabhi na lein.
  if (!Number.isFinite(PLAN_PRICE) || PLAN_PRICE <= 0) {
    return json({ error: "Renewal pricing is not configured yet." }, 503);
  }

  // 4. Pending payment row.
  const { data: payment, error: insertError } = await admin
    .from("seller_payments")
    .insert({
      seller_id: sellerId,
      plan: "seller_listing_renewal",
      amount: PLAN_PRICE,
      currency: CURRENCY,
      payment_method: method,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    return json({ error: "Could not start the payment. Please try again." }, 500);
  }

  // 5. Gateway checkout URL.
  try {
    const redirectUrl = await buildCheckoutUrl(method, payment.id, PLAN_PRICE);
    if (!redirectUrl) {
      await admin
        .from("seller_payments")
        .update({ status: "cancelled" })
        .eq("id", payment.id);
      return json({ error: "Payment gateway not configured." }, 503);
    }
    return json({ payment_id: payment.id, redirect_url: redirectUrl, months: PLAN_MONTHS });
  } catch (err) {
    await admin.from("seller_payments").update({ status: "failed" }).eq("id", payment.id);
    return json({ error: (err as Error).message }, 500);
  }
});
