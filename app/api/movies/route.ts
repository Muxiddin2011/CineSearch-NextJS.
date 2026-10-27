import { NextResponse } from "next/server";

const API_BASE = "https://api.themoviedb.org/3";

export async function GET(request: Request): Promise<NextResponse> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "TMDB API token is missing. Add TMDB_READ_TOKEN to .env.local." },
      { status: 503 }
    );
  }

  const params = new URL(request.url).searchParams;
  const type = params.get("type") || "trending";
  const page = Math.max(1, Math.min(500, Number(params.get("page") || 1)));
  const language = params.get("language") || "en-US";
  let path;

  if (type === "details") {
    const id = params.get("id");
    const media = params.get("media") === "tv" ? "tv" : "movie";
    if (!id || !/^\d+$/.test(id)) {
      return NextResponse.json({ error: "A valid movie ID is required." }, { status: 400 });
    }
    path = `/${media}/${id}?language=${encodeURIComponent(language)}&append_to_response=credits,videos,release_dates`;
  } else if (type === "genres") {
    path = `/genre/movie/list?language=${encodeURIComponent(language)}`;
  } else if (type === "search") {
    const q = (params.get("q") || "").trim();
    if (!q) return NextResponse.json({ page: 1, results: [], total_pages: 0 });
    path = `/search/multi?query=${encodeURIComponent(q)}&include_adult=false&language=${encodeURIComponent(language)}&page=${page}`;
  } else if (type === "discover") {
    const query = new URLSearchParams({
      language,
      page: String(page),
      sort_by: params.get("sort") || "popularity.desc",
      include_adult: "false",
      include_video: "false",
    });
    const genre = params.get("genre");
    const year = params.get("year");
    if (genre) query.set("with_genres", genre);
    if (year && /^\d{4}$/.test(year)) query.set("primary_release_year", year);
    path = `/discover/movie?${query.toString()}`;
  } else if (type === "popular") {
    path = `/movie/popular?language=${encodeURIComponent(language)}&page=${page}`;
  } else if (type === "upcoming") {
    path = `/movie/upcoming?language=${encodeURIComponent(language)}&page=${page}`;
  } else {
    path = `/trending/all/day?language=${encodeURIComponent(language)}&page=${page}`;
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      next: { revalidate: type === "details" ? 3600 : 300 },
    });
    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: data.status_message || `TMDB returned ${response.status}.` },
        { status: response.status }
      );
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    return NextResponse.json({ error: "Could not connect to TMDB. Check your connection and try again." }, { status: 502 });
  }
}
