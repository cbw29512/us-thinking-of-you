import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

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
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const config = {
  path: "/api/checkout",
};