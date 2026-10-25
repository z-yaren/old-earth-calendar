// Cloudflare Worker: /api/state (GET) and /api/me (PUT). Everything else is served from public/.
// Secrets (GROUP_PASSWORD, PLAYERS) live in Cloudflare as runtime secrets, not in the repo.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
        status,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
    });

async function sameSecret(a, b) {
    const enc = new TextEncoder();
    const [ha, hb] = await Promise.all([
        crypto.subtle.digest("SHA-256", enc.encode(a)),
        crypto.subtle.digest("SHA-256", enc.encode(b)),
    ]);
    const x = new Uint8Array(ha), y = new Uint8Array(hb);
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
    return diff === 0;
}

function cleanDays(raw) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (const k of Object.keys(raw)) {
        const v = raw[k];
        if (DATE_RE.test(k) && (v === "y" || v === "m" || v === "n")) out[k] = v;
    }
    return out;
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (!url.pathname.startsWith("/api/")) {
            return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
        }

        const missing = ["GROUP_PASSWORD", "PLAYERS", "DND_KV"].filter((k) => !env[k]);
        if (missing.length) {
            return json({ error: "Missing server settings: " + missing.join(", ") }, 500);
        }

        const key = request.headers.get("X-Group-Key") || "";
        if (!(await sameSecret(key, env.GROUP_PASSWORD))) {
            return json({ error: "unauthorized" }, 401);
        }

        const players = env.PLAYERS.split(",").map((s) => s.trim()).filter(Boolean);
        const route = url.pathname.slice("/api/".length);

        if (route === "state" && request.method === "GET") {
            const avail = {};
            await Promise.all(
                players.map(async (p) => {
                    let days = {};
                    try {
                        days = cleanDays(JSON.parse((await env.DND_KV.get("avail:" + p)) || "{}"));
                    } catch (e) {}
                    avail[p] = days;
                })
            );
            return json({ players, avail });
        }

        if (route === "me" && request.method === "PUT") {
            const text = await request.text();
            if (text.length > 20000) return json({ error: "Payload too large" }, 413);
            let body;
            try { body = JSON.parse(text); } catch (e) { return json({ error: "Invalid JSON" }, 400); }
            if (!body || !players.includes(body.player)) return json({ error: "Unknown player" }, 400);
            const days = cleanDays(body.days);
            if (Object.keys(days).length > 400) return json({ error: "Too many days" }, 400);
            await env.DND_KV.put("avail:" + body.player, JSON.stringify(days));
            return json({ ok: true });
        }

        return json({ error: "not found" }, 404);
    },
};