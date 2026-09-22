/**
 * Supabase Edge Function — seller-payment-callback
 *
 * Deploy (JWT verification OFF, kyunke gateway JWT nahi bhejta):
 *   supabase functions deploy seller-payment-callback --no-verify-jwt
 *
 * Yeh woh single jagah hai jahan payment "paid" hoti hai. Flow:
 *   1. Gateway apna callback/webhook yahan bhejta hai.
 *   2. Hum uska signature/hash apne Integrity Salt se KHUD verify karte hain.
 *   3. Amount + status match hone par apply_verified_seller_payment() chalta hai,
 *      jo payment ko 'paid' karta hai aur profiles.seller_plan_paid_until barhata hai.
 *
 * Signature verify na ho to kuch bhi update NAHI hota.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PLAN_MONTHS = Number(Deno.env.get("SELLER_PLAN_MONTHS") ?? "12");
const SITE_ORIGIN = Deno.env.get("SITE_ORIGIN") ?? "";

/**
 * Gateway ke callback ka signature verify karein.
 *
 * YAHAN APNA VERIFICATION LIKHEIN:
 *  - JazzCash: pp_SecureHash = HMAC-SHA256(Integrity Salt, sorted pp_* values).
 *    Wahi hash dobara banayein aur compare karein.
 *  - Easypaisa: documented hash/checksum ko store ke hash key se verify karein.
 *  - Card gateway: webhook signature header ko provider ke SDK/secret se verify karein.
 *
 * Jab tak yeh implement nahi hota, function false return karta hai — yani
 * koi payment kabhi paid nahi hogi (fake verification se behtar hai).
 */
async function verifySignature(
  _method: string,
  _payload: Record<string, string>,
): Promise<boolean> {
  // TODO: implement per-gateway verification. Do NOT return true blindly.
  return false;
}

/** Example helper: HMAC-SHA256 hex (JazzCash/Easypaisa dono isi tarah sign karte hain). */
export async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function redirect(path: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: `${SITE_ORIGIN}${path}` },
  });
}

Deno.serve(async (req) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Gateways form-encoded POST ya query string bhejte hain — dono handle karein.
  const payload: Record<string, string> = {};
  const url = new URL(req.url);
  url.searchParams.forEach((v, k) => (payload[k] = v));
  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") ?? "";
    try {
      if (contentType.includes("application/json")) {
        Object.assign(payload, await req.json());
      } else {
        const form = await req.formData();
        form.forEach((v, k) => (payload[k] = String(v)));
      }
    } catch {
      // khaali body — payload sirf query se
    }
  }

  // Hamara apna payment id gateway ko bhejte waqt pass hota hai (bill reference /
  // order id / metadata). Usi se row dhoondein.
  const paymentId = payload.payment_id ?? payload.pp_BillReference ?? payload.orderRefNum ?? "";
  if (!paymentId) return redirect("/seller/renew?payment=unknown");

  const { data: payment } = await admin
    .from("seller_payments")
    .select("id, payment_method, amount, status")
    .eq("id", paymentId)
    .single();

  if (!payment) return redirect("/seller/renew?payment=unknown");

  const ok = await verifySignature(payment.payment_method, payload);

  if (!ok) {
    await admin
      .from("seller_payments")
      .update({ status: "failed", gateway_response: payload })
      .eq("id", payment.id)
      .eq("status", "pending");
    return redirect("/seller/renew?payment=failed");
  }

  // TODO: yahan gateway ke response code (e.g. pp_ResponseCode === "000") aur
  // amount ko payment.amount se match karein, phir hi aage barhein.

  const transactionId =
    payload.pp_TxnRefNo ?? payload.transactionId ?? payload.txn_id ?? null;

  const { error } = await admin.rpc("apply_verified_seller_payment", {
    p_payment_id: payment.id,
    p_transaction_id: transactionId,
    p_months: PLAN_MONTHS,
    p_gateway_response: payload,
  });

  if (error) return redirect("/seller/renew?payment=error");
  return redirect("/seller/renew?payment=success");
});
