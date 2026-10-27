 "use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent, MouseEvent } from "react";

type Movie = {
  [key: string]: any;
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  overview?: string;
};
type Genre = { id: number; name: string };
type HomeData = { trending: Movie[]; popular: Movie[]; upcoming: Movie[] };
type PageName = "home" | "discover" | "search" | "watchlist" | "favorites";
type ListKind = "watch" | "favorite";

const IMG = "https://image.tmdb.org/t/p/";
const posterUrl = (path: string | null | undefined, size = "w500"): string => path ? `${IMG}${size}${path}` : "";
const titleOf = (m: Movie | null | undefined): string => m?.title || m?.name || "Untitled";
const yearOf = (m: Movie | null | undefined): string => (m?.release_date || m?.first_air_date || "").slice(0, 4) || "—";
const ratingOf = (m: Movie | null | undefined): string => Number(m?.vote_average || 0).toFixed(1);
const money = (n: number | null | undefined): string => n ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n) : "Not available";
const readStore = (key: string): Movie[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
};

async function requestMovies(params: Record<string, string> = {}): Promise<any> {
  const query = new URLSearchParams(params);
  const res = await fetch(`/api/movies?${query.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load movies.");
  return data;
}

export default function Home() {
  const [page, setPage] = useState<PageName>("home");
  const [homeData, setHomeData] = useState<HomeData>({ trending: [], popular: [], upcoming: [] });
  const [heroIndex, setHeroIndex] = useState(0);
  const [discover, setDiscover] = useState<Movie[]>([]);
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState("popularity.desc");
  const [year, setYear] = useState("");
  const [discoverPage, setDiscoverPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [watchlist, setWatchlist] = useState<Movie[]>([]);
  const [favorites, setFavorites] = useState<Movie[]>([]);
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null);
  const [details, setDetails] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    setWatchlist(readStore("cinesearch_watchlist"));
    setFavorites(readStore("cinesearch_favorites"));
    requestMovies({ type: "genres" }).then(d => setGenres(d.genres || [])).catch(() => {});
    Promise.all([
      requestMovies({ type: "trending" }),
      requestMovies({ type: "popular" }),
      requestMovies({ type: "upcoming" }),
    ]).then(([trending, popular, upcoming]) => {
      setHomeData({
        trending: (trending.results || []).filter(x => x.media_type !== "person"),
        popular: popular.results || [],
        upcoming: upcoming.results || [],
      });
    }).catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (page !== "discover") return;
    setLoading(true); setError("");
    requestMovies({ type: "discover", page: String(discoverPage), sort, ...(genre ? { genre } : {}), ...(year ? { year } : {}) })
      .then(d => { setDiscover(d.results || []); setTotalPages(Math.min(d.total_pages || 1, 500)); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, discoverPage, sort, genre, year]);

  useEffect(() => {
    if (!activeMovie) { setDetails(null); return; }
    let cancelled = false;
    setDetails(null);
    requestMovies({ type: "details", id: String(activeMovie.id), media: activeMovie.media_type === "tv" ? "tv" : "movie" })
      .then(d => { if (!cancelled) setDetails(d); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [activeMovie]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const heroItems = useMemo(() => homeData.trending.filter(x => x.backdrop_path).slice(0, 5), [homeData.trending]);
  const hero = heroItems[heroIndex] || heroItems[0];

  const navigate = useCallback((next: PageName) => {
    setPage(next);
    setError("");
    if (next === "discover") setDiscoverPage(1);
    if (typeof window !== "undefined") window.history.replaceState(null, "", next === "home" ? "/" : `/#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const persistLists = (nextWatch: Movie[], nextFav: Movie[]) => {
    setWatchlist(nextWatch); setFavorites(nextFav);
    localStorage.setItem("cinesearch_watchlist", JSON.stringify(nextWatch));
    localStorage.setItem("cinesearch_favorites", JSON.stringify(nextFav));
  };

  const toggleList = (movie: Movie, kind: ListKind) => {
    const list = kind === "watch" ? watchlist : favorites;
    const exists = list.some(item => item.id === movie.id && (item.media_type || "movie") === (movie.media_type || "movie"));
    const normalized = { ...movie, media_type: movie.media_type || "movie" };
    const next = exists
      ? list.filter(item => !(item.id === movie.id && (item.media_type || "movie") === normalized.media_type))
      : [normalized, ...list];
    persistLists(kind === "watch" ? next : watchlist, kind === "favorite" ? next : favorites);
    setToast(exists ? "Removed from your list" : kind === "watch" ? "Added to watchlist" : "Added to favorites");
  };

  const search = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const q = query.trim();
    setPage("search"); setSubmittedQuery(q); setError("");
    if (!q) { setSearchResults([]); return; }
    setLoading(true);
    try {
      const data = await requestMovies({ type: "search", q });
      setSearchResults((data.results || []).filter(x => x.media_type !== "person"));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openMovie = (movie: Movie) => {
    setActiveMovie({ ...movie, media_type: movie.media_type || "movie" });
    setError("");
  };

  const MovieGrid = ({ items }: { items: Movie[] }) => (
    <div className="movie-grid">
      {items.map(movie => {
        const isWatch = watchlist.some(x => x.id === movie.id && (x.media_type || "movie") === (movie.media_type || "movie"));
        const isFav = favorites.some(x => x.id === movie.id && (x.media_type || "movie") === (movie.media_type || "movie"));
        return <article className="movie-card" key={`${movie.media_type || "movie"}-${movie.id}`}>
          <div className="poster-wrap" role="button" tabIndex={0} onClick={() => openMovie(movie)} onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => e.key === "Enter" && openMovie(movie)} aria-label={`View ${titleOf(movie)}`}>
            {movie.poster_path ? <img loading="lazy" src={posterUrl(movie.poster_path)} alt={`${titleOf(movie)} poster`} onError={e => { e.currentTarget.style.display = "none"; }} /> : <div className="poster-placeholder">NO POSTER<br/>AVAILABLE</div>}
            <span className="poster-badge">{movie.media_type === "tv" ? "SERIES" : "MOVIE"}</span>
          </div>
          <div className="poster-actions">
            <button className={`round-btn ${isWatch ? "saved" : ""}`} onClick={() => toggleList(movie, "watch")} title="Toggle watchlist" aria-label="Toggle watchlist">{isWatch ? "✓" : "+"}</button>
            <button className={`round-btn ${isFav ? "saved" : ""}`} onClick={() => toggleList(movie, "favorite")} title="Toggle favorites" aria-label="Toggle favorites">{isFav ? "♥" : "♡"}</button>
          </div>
          <h3 role="button" tabIndex={0} onClick={() => openMovie(movie)} onKeyDown={(e: KeyboardEvent<HTMLHeadingElement>) => e.key === "Enter" && openMovie(movie)}>{titleOf(movie)}</h3>
          <div className="movie-info"><span>{yearOf(movie)}</span><span className="rating">★ {ratingOf(movie)}</span></div>
        </article>;
      })}
      {!items.length && <div className="empty-state"><div className="empty-icon">⌁</div><h3>Nothing to show yet</h3><p>Try another search or change your filters. Saved movies will appear in your personal lists.</p></div>}
    </div>
  );

  const Section = ({ kicker, title, accent, items, onExplore }: { kicker: string; title: string; accent: string; items: Movie[]; onExplore?: () => void }) => (
    <section className="section"><div className="section-head"><div><p className="kicker">{kicker}</p><h2>{title} <span>{accent}</span></h2></div>{onExplore && <button className="text-link" onClick={onExplore}>Explore all ↗</button>}</div><MovieGrid items={items.slice(0, 12)} /></section>
  );

  return <>
    <header className="topbar">
      <button className="brand" onClick={() => navigate("home")} aria-label="CineSearch home"><span className="brand-mark">C</span>CINE<span>SEARCH</span></button>
      <nav className="nav" aria-label="Main navigation">
        {([
          { id: "home", label: "Home" },
          { id: "discover", label: "Discover" },
          { id: "search", label: "Search" },
          { id: "watchlist", label: "Watchlist" },
          { id: "favorites", label: "Favorites" },
        ] as { id: PageName; label: string }[]).map(({ id, label }) =>
          <button key={id} className={page === id ? "active" : ""} onClick={() => navigate(id)}>{label}{id === "watchlist" ? <b>{watchlist.length}</b> : id === "favorites" ? <b>{favorites.length}</b> : null}</button>
        )}
      </nav>
      <button className="profile" title="CineSearch">CS</button>
    </header>

    {page === "home" && <>
      <section className="hero" id="hero">
        <div className="hero-backdrop" style={hero?.backdrop_path ? { backgroundImage: `linear-gradient(90deg,#08090d 0%,#08090de8 25%,#08090d66 62%,#08090d20 100%),linear-gradient(0deg,#08090d 0%,transparent 38%),url(${posterUrl(hero.backdrop_path,"original")})` } : {}} />
        <div className="hero-overlay" />
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> TRENDING TODAY <span className="eyebrow-line" /></div>
          <h1>{hero ? titleOf(hero) : <>Discover your<br/>next favorite.</>}</h1>
          <div className="hero-meta">{hero && <><span className="rating">★ {ratingOf(hero)}</span><span>{yearOf(hero)}</span><span className="pill">{hero.media_type === "tv" ? "TV SERIES" : "MOVIE"}</span></>}</div>
          <p>{hero?.overview || "Explore trending movies, timeless favorites, and hidden gems from around the world."}</p>
          <div className="hero-actions"><button className="btn btn-red" onClick={() => hero && openMovie(hero)}>ⓘ &nbsp; More Info</button><button className="btn btn-glass" onClick={() => hero && toggleList(hero, "watch")}>＋ &nbsp; Watchlist</button></div>
        </div>
        <div className="hero-bottom"><span>CURATED FOR YOU</span><div className="dots">{heroItems.map((item,i)=><button aria-label={`Show featured movie ${i+1}`} key={item.id} className={`dot ${i === heroIndex ? "active" : ""}`} onClick={() => setHeroIndex(i)} />)}</div></div>
      </section>
      {error && <div className="error-state"><h3>Could not connect to TMDB</h3><p>{error}</p></div>}
      <Section kicker="WHAT'S HOT" title="Trending" accent="today" items={homeData.trending} onExplore={() => navigate("discover")} />
      <Section kicker="THE CROWD HAS SPOKEN" title="Popular" accent="movies" items={homeData.popular} onExplore={() => navigate("discover")} />
      <Section kicker="NEXT UP" title="Coming" accent="soon" items={homeData.upcoming} onExplore={() => navigate("discover")} />
    </>}

    {page === "discover" && <main className="content-page">
      <div className="page-title"><p className="kicker">FIND YOUR NEXT OBSESSION</p><h1>Discover <span>movies</span></h1><p className="subline">Browse the catalog and find something worth watching.</p></div>
      <div className="filters">
        <label>Genre<select value={genre} onChange={e => {setGenre(e.target.value);setDiscoverPage(1);}}><option value="">All genres</option>{genres.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select></label>
        <label>Sort by<select value={sort} onChange={e => {setSort(e.target.value);setDiscoverPage(1);}}><option value="popularity.desc">Most popular</option><option value="vote_average.desc">Top rated</option><option value="primary_release_date.desc">Newest</option><option value="revenue.desc">Highest grossing</option></select></label>
        <label>Year<input type="number" min="1900" max="2035" placeholder="Any year" value={year} onChange={e => {setYear(e.target.value);setDiscoverPage(1);}} /></label>
      </div>
      {loading ? <div className="loading">Loading movies…</div> : error ? <div className="error-state"><h3>Could not load movies</h3><p>{error}</p></div> : <MovieGrid items={discover} />}
      <div className="pagination"><button className="btn btn-glass" disabled={discoverPage <= 1} onClick={() => {setDiscoverPage(p=>p-1);window.scrollTo({top:0,behavior:"smooth"});}}>← Previous</button><span>Page {discoverPage} of {totalPages}</span><button className="btn btn-glass" disabled={discoverPage >= totalPages} onClick={() => {setDiscoverPage(p=>p+1);window.scrollTo({top:0,behavior:"smooth"});}}>Next →</button></div>
    </main>}

    {page === "search" && <main className="content-page">
      <div className="page-title"><p className="kicker">IT STARTS WITH A TITLE</p><h1>Search <span>movies</span></h1><p className="subline">Search by title, keyword, or a favorite actor's movie.</p></div>
      <form className="search-form" onSubmit={search}><span>⌕</span><input type="search" placeholder="Search movies..." value={query} onChange={e=>setQuery(e.target.value)} autoComplete="off" /><button className="btn btn-red">Search</button></form>
      <div className="hint">{submittedQuery ? `Results for “${submittedQuery}”` : "Try “Interstellar”, “Dune”, or “Spider-Man”."}</div>
      {loading ? <div className="loading">Searching TMDB…</div> : error ? <div className="error-state"><h3>Search failed</h3><p>{error}</p></div> : <MovieGrid items={searchResults} />}
    </main>}

    {page === "watchlist" && <main className="content-page"><div className="page-title"><p className="kicker">SAVE IT FOR LATER</p><h1>My <span>watchlist</span></h1><p className="subline">Your personal list of movies and shows to watch next.</p></div><MovieGrid items={watchlist} /></main>}
    {page === "favorites" && <main className="content-page"><div className="page-title"><p className="kicker">YOUR PERSONAL PICKS</p><h1>My <span>favorites</span></h1><p className="subline">All the movies and shows you love, in one place.</p></div><MovieGrid items={favorites} /></main>}

    <footer className="site-footer"><span><strong>CINESEARCH</strong> · Discover something worth watching.</span><span>Movie data and images provided by TMDB.</span></footer>

    {activeMovie && <div className="modal-backdrop" role="presentation" onClick={(e: MouseEvent<HTMLDivElement>) => {if (e.target === e.currentTarget) setActiveMovie(null);}}>
      <section className="movie-modal" role="dialog" aria-modal="true" aria-label={`${titleOf(activeMovie)} details`}>
        <button className="modal-close" onClick={() => setActiveMovie(null)} aria-label="Close details">×</button>
        <div className="modal-backdrop-image" style={details?.backdrop_path || activeMovie.backdrop_path ? {backgroundImage:`linear-gradient(0deg,#11131a,transparent),url(${posterUrl(details?.backdrop_path || activeMovie.backdrop_path,"original")})`} : {}}><h2>{titleOf(details || activeMovie)}</h2></div>
        <div className="modal-content">
          {!details ? <div className="loading">Loading movie details…</div> : <>
            <div className="modal-meta"><span className="rating">★ {ratingOf(details)}</span><span>{yearOf(details)}</span>{details.runtime ? <span>{details.runtime} min</span> : details.episode_run_time?.[0] ? <span>{details.episode_run_time[0]} min/episode</span> : null}<span className="pill">{details.status || "Details"}</span></div>
            <div className="genre-tags">{(details.genres || []).map(g=><span key={g.id}>{g.name}</span>)}</div>
            <p>{details.overview || "No overview is available for this title."}</p>
            <div className="modal-stats"><div className="stat"><span>Budget</span><strong>{money(details.budget)}</strong></div><div className="stat"><span>Box office</span><strong>{money(details.revenue)}</strong></div><div className="stat"><span>Popularity</span><strong>{Number(details.popularity || 0).toFixed(1)}</strong></div></div>
            {details.credits?.cast?.length > 0 && <><p className="kicker">FEATURED CAST</p><p>{details.credits.cast.slice(0,8).map(x=>x.name).join(" · ")}</p></>}
            <div className="modal-actions"><button className="btn btn-red" onClick={() => toggleList(activeMovie!,"watch")}>{watchlist.some(x=>x.id===activeMovie.id) ? "✓ In Watchlist" : "＋ Add to Watchlist"}</button><button className="btn btn-glass" onClick={() => toggleList(activeMovie!,"favorite")}>{favorites.some(x=>x.id===activeMovie.id) ? "♥ Favorited" : "♡ Add to Favorites"}</button></div>
            <div className="status-note">Data provided by TMDB. Box-office and budget information may not be available for every title.</div>
          </>}
        </div>
      </section>
    </div>}
    {toast && <div className="toast show" role="status" style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:150,background:"#191b24",border:"1px solid #ffffff22",borderRadius:8,padding:"12px 18px",boxShadow:"0 10px 30px #0008",fontSize:13}}>{toast}</div>}
  </>;
}
