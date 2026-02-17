const FPL_BASE = "https://fantasy.premierleague.com/api";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export default async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Extract the FPL API path from the query string
  const url = new URL(req.url);
  const path = url.searchParams.get("path");

  if (!path) {
    return Response.json(
      { error: "Missing ?path= parameter" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Only allow FPL API paths (prevent open-relay abuse)
  const allowed = /^(bootstrap-static|fixtures|entry|event|leagues-classic)\b/;
  if (!allowed.test(path)) {
    return Response.json(
      { error: "Path not allowed" },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  try {
    const res = await fetch(`${FPL_BASE}/${path}`, {
      headers: { "User-Agent": "FF2026/1.0" },
    });

    if (!res.ok) {
      return Response.json(
        { error: `FPL API returned ${res.status}` },
        { status: res.status, headers: CORS_HEADERS }
      );
    }

    const data = await res.json();

    return Response.json(data, {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=120",
      },
    });
  } catch (err) {
    return Response.json(
      { error: `Proxy fetch failed: ${err.message}` },
      { status: 502, headers: CORS_HEADERS }
    );
  }
};

export const config = {
  path: "/api/fpl-proxy",
};
