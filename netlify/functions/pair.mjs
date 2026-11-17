import webpush from "web-push";

const pairs = new Map();

webpush.setVapidDetails(
  "mailto:divclass01@gmail.com",
  "BDWXZ5nZn12ucAKX68uebBm5J9Q77llfrAowDxwzxqAPPnyx5HRdaUdTVedIbUzbu2nt3RLXbUQWI2jM-WNwu0E",
  "ho13vMe5LLVO0n8AS1vVsY2LTNPhmEAmmYVLOntaK3w"
);

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
      const { type, payload, from, subscription } = body;

      if (!code) return new Response(JSON.stringify({ error: "missing code" }), { status: 400, headers });

      let pair = pairs.get(code) || { events: [], users: [], subs: {} };

      if (from && !pair.users.includes(from)) {
        if (pair.users.length >= 2) {
          return new Response(JSON.stringify({ error: "pair full" }), { status: 403, headers });
        }
        pair.users.push(from);
      }

      if (subscription && from) {
        pair.subs[from] = subscription;
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

        const otherId = pair.users.find(u => u !== from);
        if (otherId && pair.subs[otherId]) {
          const title = type === "heart" ? "I love you" : type === "mood" ? "Mood" : type === "rps" ? "RPS" : "OurHearts";
          const bodyText = type === "heart" ? "They sent a heart" : type === "mood" ? `Feeling ${payload?.mood || ""}` : type === "rps" ? "They want to play" : "New message";
          try {
            await webpush.sendNotification(pair.subs[otherId], JSON.stringify({ title, body: bodyText }));
          } catch (e) {}
        }
      }

      pairs.set(code, pair);
      return new Response(JSON.stringify({ ok: true, pair }), { headers });
    }

    if (req.method === "GET" && code) {
      const pair = pairs.get(code) || { events: [], users: [], subs: {} };
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

