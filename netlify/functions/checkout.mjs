import Stripe from "stripe";

export default async (req) => {
  const key = process.env.STRIPE_SECRET_KEY || "";
  const keyInfo = {
    exists: !!key,
    length: key.length,
    startsWith: key.slice(0, 3),
    endsWith: key.slice(-4)
  };

  if (!key) {
    return new Response(JSON.stringify({ error: "No key set", keyInfo }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const stripe = new Stripe(key);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const origin = new URL(req.url).origin;

    const prices = await stripe.prices.list({ limit: 10, active: true });
    let priceId;
    const existing = prices.data.find(p => p.unit_amount === 199 && p.recurring?.interval === "month");
    if (existing) {
      priceId = existing.id;
    } else {
      const product = await stripe.products.create({ name: "Us — Monthly" });
      const price = await stripe.prices.create({
        unit_amount: 199,
        currency: "usd",
        recurring: { interval: "month" },
        product: product.id,
      });
      priceId = price.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?paid=1`,
      cancel_url: `${origin}/`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, keyInfo }), { status: 500 });
  }
};

export const config = {
  path: "/api/checkout",
};