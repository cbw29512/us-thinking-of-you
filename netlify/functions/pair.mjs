import { getStore } from "@netlify/blobs";

const store = getStore("us-pairs");

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (req.method === "POST") {
      const body = await req.json();
      const { type, payload, from } = body;

      if (!code) return new Response(JSON.stringify({ error: "missing code" }), { status: 400, headers });

      const key = `pair:${code}`;
      let pair = await store.get(key, { type: "json" }) || { events: [], users: [] };

      if (from && !pair.users.includes(from)) {
        pair.users.push(from);
      }

      if (type) {
        pair.events = pair.events || [];
        pair.events.push({
          id: Date.now(),
          type,
          payload,
          from,
          at: Date.now(),
        });
        if (pair.events.length > 20) pair.events = pair.events.slice(-20);
      }

      await store.setJSON(key, pair);
      return new Response(JSON.stringify({ ok: true, pair }), { headers });
    }

    if (req.method === "GET" && code) {
      const key = `pair:${code}`;
      const pair = await store.get(key, { type: "json" }) || { events: [], users: [] };
      return new Response(JSON.stringify(pair), { headers });
    }

    return new Response(JSON.stringify({ error: "bad request" }), { status: 400, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

export const config = {
  path: "/api/pair",
};