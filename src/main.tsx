import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  Search,
  LayoutDashboard,
  Compass,
  Bookmark,
  MapPin,
  History,
  Settings,
  ArrowUpRight,
  Download,
  Plus,
  Check,
  X,
  Globe,
  Phone,
  Mail,
  SlidersHorizontal,
  List,
  Grid2X2,
  Menu,
  ArrowRight,
  Leaf,
  RefreshCw,
} from "lucide-react";
import categories from "./categories.json";
import {
  type Business,
  type Lead,
  newLead,
  statuses,
  verificationStatuses,
  verifyLink,
  normalizeUrl,
  csv,
} from "./model";
import { OpenStreetMapProvider } from "./provider";
import { BusinessMap } from "./Map";
import { read, write, supabase, syncLeads, loadCloud } from "./storage";
import "./style.css";
type SearchRecord = {
  id: string;
  location: string;
  category: string;
  limit: number;
  radius: number;
  date: string;
  count: number;
  without: number;
  hot: number;
};
const provider = new OpenStreetMapProvider();
const NA = "Not Available";
function App() {
  const [page, setPage] = useState("Find Businesses"),
    [menu, setMenu] = useState(false);
  const [leads, setLeads] = useState<Lead[]>(() => read("leads", [])),
    [history, setHistory] = useState<SearchRecord[]>(() => read("history", [])),
    [results, setResults] = useState<Business[]>(() => read("results", [])),
    [ignored, setIgnored] = useState<string[]>(() => read("ignored", []));
  const [location, setLocation] = useState("Akure, Ondo State, Nigeria"),
    [category, setCategory] = useState("Restaurant"),
    [limit, setLimit] = useState(50),
    [radius, setRadius] = useState(3000),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [searched, setSearched] = useState(results.length > 0),
    [resolved, setResolved] = useState(""),
    [cached, setCached] = useState(false);
  const [view, setView] = useState("table"),
    [detail, setDetail] = useState<Business | null>(null),
    [filters, setFilters] = useState(false),
    [website, setWebsite] = useState("All"),
    [phone, setPhone] = useState("All"),
    [email, setEmail] = useState("All"),
    [quality, setQuality] = useState("All"),
    [classification, setClassification] = useState("All"),
    [savedFilter, setSavedFilter] = useState("All"),
    [status, setStatus] = useState("All"),
    [categoryFilter, setCategoryFilter] = useState("All"),
    [sort, setSort] = useState("Highest Lead Score"),
    [text, setText] = useState(""),
    [selected, setSelected] = useState<string[]>([]);
  const [authEmail, setAuthEmail] = useState(""),
    [authPassword, setAuthPassword] = useState("");
  useEffect(() => {
    try {
      write("leads", leads);
      write("history", history);
      write("results", results);
      write("ignored", ignored);
    } catch {
      setError(
        "Browser storage is full or unavailable. Export a backup before closing this page.",
      );
    }
  }, [leads, history, results, ignored]);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  const leadFor = (b: Business) => leads.find((l) => l.business.id === b.id);
  const save = (b: Business) => {
    setLeads((prev) =>
      prev.some((l) => l.business.id === b.id) ? prev : [newLead(b), ...prev],
    );
    setMessage("Lead saved to your workspace");
  };
  const update = (b: Business, patch: Partial<Lead>) =>
    setLeads((prev) => {
      const existing = prev.find((l) => l.business.id === b.id);
      return existing
        ? prev.map((l) => (l.business.id === b.id ? { ...l, ...patch } : l))
        : [{ ...newLead(b), ...patch }, ...prev];
    });
  async function search(refresh = false, record?: SearchRecord) {
    const q = record || { location, category, limit, radius };
    if (record) {
      setLocation(record.location);
      setCategory(record.category);
      setLimit(record.limit);
      setRadius(record.radius);
      setPage("Find Businesses");
    }
    setLoading(true);
    setError("");
    setSelected([]);
    try {
      const data = await provider.searchBusinesses({ ...q, refresh });
      setResults(data.businesses);
      setResolved(data.location);
      setCached(data.cached);
      setSearched(true);
      setHistory((prev) =>
        [
          {
            id: crypto.randomUUID(),
            ...q,
            date: new Date().toISOString(),
            count: data.businesses.length,
            without: data.businesses.filter(
              (b) => b.websiteStatus === "No Website Found",
            ).length,
            hot: data.businesses.filter((b) => b.leadScore >= 80).length,
          },
          ...prev,
        ].slice(0, 100),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  const source = page === "Leads" ? leads.map((l) => l.business) : results;
  const filtered = source
    .filter(
      (b) =>
        !ignored.includes(b.id) &&
        (!text ||
          `${b.name} ${b.address} ${b.category}`
            .toLowerCase()
            .includes(text.toLowerCase())) &&
        (website === "All" || b.websiteStatus === website) &&
        (phone === "All" || Boolean(b.phone) === (phone === "Has Phone")) &&
        (email === "All" || Boolean(b.email) === (email === "Has Email")) &&
        (quality === "All" || b.contactQuality === quality) &&
        (classification === "All" || b.leadClassification === classification) &&
        (savedFilter === "All" ||
          Boolean(leadFor(b)) === (savedFilter === "Saved")) &&
        (status === "All" || leadFor(b)?.status === status) &&
        (categoryFilter === "All" || b.category === categoryFilter),
    )
    .sort((a, b) =>
      sort === "Lowest Lead Score"
        ? a.leadScore - b.leadScore
        : sort === "Business Name"
          ? a.name.localeCompare(b.name)
          : sort === "Category"
            ? a.category.localeCompare(b.category)
            : sort === "No Website First"
              ? Number(b.websiteStatus === "No Website Found") -
                  Number(a.websiteStatus === "No Website Found") ||
                b.leadScore - a.leadScore
              : sort === "Has Phone First"
                ? Number(Boolean(b.phone)) - Number(Boolean(a.phone))
                : sort === "Has Email First"
                  ? Number(Boolean(b.email)) - Number(Boolean(a.email))
                  : sort === "Recently Found"
                    ? b.foundAt.localeCompare(a.foundAt)
                    : b.leadScore - a.leadScore,
    );
  function exportRows(items: Business[]) {
    const blob = new Blob(
      ["\ufeff" + csv(items.map((b) => leadFor(b) || newLead(b)))],
      { type: "text/csv;charset=utf-8;" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leadfind-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`${items.length} leads exported`);
  }
  const openDetail = useCallback((b: Business) => setDetail(b), []);
  const nav = [
    ["Dashboard", LayoutDashboard],
    ["Find Businesses", Compass],
    ["Leads", Bookmark],
    ["Map", MapPin],
    ["Search History", History],
    ["Settings", Settings],
  ] as const;
  const badge = (b: Business) => (
    <span
      className={`badge ${b.websiteStatus === "No Website Found" ? "amber" : b.websiteStatus === "Website Found" ? "green" : "neutral"}`}
    >
      {b.websiteStatus === "No Website Found" ? (
        <Globe size={12} />
      ) : (
        <Check size={12} />
      )}{" "}
      {b.websiteStatus}
    </span>
  );
  const actions = (b: Business) => (
    <div className="actions">
      <button
        className="icon-btn"
        aria-label={`Save ${b.name}`}
        title="Save Lead"
        onClick={() => save(b)}
      >
        {leadFor(b) ? <Check size={17} /> : <Bookmark size={17} />}
      </button>
      <button
        className="icon-btn"
        aria-label={`View ${b.name}`}
        title="View Details"
        onClick={() => setDetail(b)}
      >
        <ArrowUpRight size={18} />
      </button>
    </div>
  );
  const stat = (label: string, value: number, sub: string) => (
    <div className="stat">
      <span>{label}</span>
      <strong>
        {value}
        <small>{sub}</small>
      </strong>
    </div>
  );
  const renderResults = () =>
    loading ? (
      <div className="loading">
        <RefreshCw className="spin" />
        <h3>Searching local business data...</h3>
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    ) : !filtered.length ? (
      <div className="empty">
        <Search size={30} />
        <h3>
          {page === "Leads"
            ? "No saved leads yet"
            : searched
              ? "No businesses found"
              : "Your next client could be around the corner"}
        </h3>
        <p>
          {page === "Leads"
            ? "Search for local businesses and save promising website opportunities."
            : searched
              ? "Try changing the location, category, filters, or search radius."
              : "Choose a location and category to discover real local businesses."}
        </p>
      </div>
    ) : view === "map" || page === "Map" ? (
      <BusinessMap businesses={filtered} onView={openDetail} />
    ) : (
      <>
        <div className={view === "cards" ? "cards" : "mobile-cards"}>
          {filtered.map((b) => (
            <article className="business-card" key={b.id}>
              <div className="card-top">
                <span className="category-icon">
                  <Globe size={21} />
                </span>
                <span className="score">
                  {b.leadScore}
                  <small>/100</small>
                </span>
              </div>
              <button className="name-button" onClick={() => setDetail(b)}>
                {b.name || NA}
              </button>
              <p className="muted">
                {b.category} · {b.leadClassification}
              </p>
              {badge(b)}
              <p>
                <MapPin size={14} /> {b.address || NA}
              </p>
              <p>
                <Phone size={14} /> {b.phone || NA}
              </p>
              <p>
                <Mail size={14} /> {b.email || NA}
              </p>
              <p className="muted">Opening hours: {b.openingHours || NA}</p>
              <div className="card-footer">
                <a
                  className="verify"
                  href={verifyLink(b)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Verify Online <ArrowUpRight size={14} />
                </a>
                {actions(b)}
              </div>
            </article>
          ))}
        </div>
        {view === "table" && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all filtered leads"
                      checked={
                        filtered.length > 0 &&
                        filtered.every((b) => selected.includes(b.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? filtered.map((b) => b.id) : [],
                        )
                      }
                    />
                  </th>
                  <th>Score</th>
                  <th>Business</th>
                  <th>Location</th>
                  <th>Contact</th>
                  <th>Website</th>
                  <th>Quality / Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${b.name}`}
                        checked={selected.includes(b.id)}
                        onChange={(e) =>
                          setSelected((prev) =>
                            e.target.checked
                              ? [...prev, b.id]
                              : prev.filter((id) => id !== b.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <span
                        className={`score-box ${b.leadScore >= 80 ? "hot" : ""}`}
                      >
                        {b.leadScore}
                      </span>
                      <span className="tiny">
                        {b.leadClassification.replace(" LEAD", "")}
                      </span>
                    </td>
                    <td>
                      <button
                        className="name-button"
                        onClick={() => setDetail(b)}
                      >
                        {b.name || NA}
                      </button>
                      <span className="tiny">{b.category}</span>
                    </td>
                    <td className="location-cell">
                      {b.city || b.address || NA}
                      <span className="tiny">
                        {b.region || b.country || NA}
                      </span>
                    </td>
                    <td>
                      <span className="contact-line">
                        <Phone size={12} />
                        {b.phone || NA}
                      </span>
                      <span className="tiny">{b.email || NA}</span>
                    </td>
                    <td>
                      {badge(b)}
                      <a
                        className="verify"
                        href={verifyLink(b)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Verify online <ArrowUpRight size={12} />
                      </a>
                    </td>
                    <td>
                      {b.contactQuality}
                      <span className="tiny">
                        {leadFor(b)?.status || "Not saved"}
                      </span>
                    </td>
                    <td>{actions(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  return (
    <div className="app">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Dashboard");
          }}
        >
          <span>
            <Compass size={23} />
          </span>
          LEADFIND<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="avatar">B</span>
          <div>
            My workspace<small>Personal prospecting</small>
          </div>
          <span className="online-dot" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={page === label ? "active" : ""}
              onClick={() => {
                setPage(label);
                setMenu(false);
              }}
            >
              <Icon size={19} />
              {label}
              {label === "Leads" && (
                <span className="nav-count">{leads.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="free-tag">
            <Leaf size={17} />
            <strong>Built for a $0 start</strong>
            <p>
              Open data. Real opportunities.
              <br />
              No paid APIs required.
            </p>
          </div>
          <div className="user">
            <span className="avatar">ME</span>
            <div>
              Your workspace<small>Local-first · Private</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-btn"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle navigation"
          >
            <Menu />
          </button>
          <span>
            Workspace <span className="slash">/</span> <strong>{page}</strong>
          </span>
          <span className="top-right">
            <span className="online-dot" /> Free & open data{" "}
            <span className="avatar small">ME</span>
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR NEXT OPPORTUNITY STARTS HERE</div>
              <h1>
                {page === "Find Businesses"
                  ? "Find local businesses"
                  : page === "Leads"
                    ? "Your lead workspace"
                    : page === "Dashboard"
                      ? "A clearer path to your next client"
                      : page === "Map"
                        ? "Explore your opportunities"
                        : page}
              </h1>
              <p>
                {page === "Find Businesses"
                  ? "Discover local businesses that may need a professional website."
                  : page === "Leads"
                    ? "Research, verify, and turn promising businesses into clients."
                    : "Find local businesses that may need a website."}
              </p>
            </div>
            {page !== "Settings" && (
              <button
                className="button secondary"
                onClick={() =>
                  exportRows(
                    page === "Leads" || page === "Dashboard"
                      ? leads.map((l) => l.business)
                      : filtered,
                  )
                }
              >
                <Download size={16} /> Export{" "}
                {page === "Leads" ? "leads" : "CSV"}
              </button>
            )}
          </div>
          {error && (
            <div className="alert" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {page === "Find Businesses" && (
            <>
              <section className="search-panel">
                <div className="section-title">
                  <span className="round-icon">
                    <Search size={18} />
                  </span>
                  <div>
                    <h2>Find your next website client</h2>
                    <p>Search a specific area. Find a real opportunity.</p>
                  </div>
                  <span className="source-tag">Powered by OpenStreetMap</span>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    search();
                  }}
                >
                  <label className="location-input">
                    Location
                    <div className="input-icon">
                      <MapPin size={18} />
                      <input
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="City, neighbourhood, or area"
                      />
                    </div>
                  </label>
                  <label>
                    Business category
                    <input
                      list="categories"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                    />
                    <datalist id="categories">
                      {Object.keys(categories).map((c) => (
                        <option key={c} value={c} />
                      ))}
                      <option value="shop=books" />
                    </datalist>
                  </label>
                  <label>
                    Results
                    <select
                      aria-label="Results"
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                    >
                      {[25, 50, 100].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Radius
                    <select
                      aria-label="Radius"
                      value={radius}
                      onChange={(e) => setRadius(Number(e.target.value))}
                    >
                      {[1000, 3000, 5000, 10000].map((v) => (
                        <option key={v} value={v}>
                          {v / 1000} km
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="button primary" disabled={loading}>
                    <Search size={17} />
                    {loading ? "Searching..." : "Search businesses"}
                  </button>
                </form>
                <div className="search-foot">
                  <span>
                    <span className="online-dot" /> Public business data. No
                    paid APIs. No mass scraping.
                  </span>
                  <span>Custom category: e.g. shop=books</span>
                </div>
              </section>
              <div className="tip">
                <span className="tip-icon">
                  <Globe size={19} />
                </span>
                <p>
                  <strong>
                    A missing website is a starting point, not a certainty.
                  </strong>{" "}
                  Always use Verify Online before reaching out.
                </p>
                <ArrowUpRight size={18} />
              </div>
            </>
          )}
          {page === "Dashboard" && (
            <>
              <div className="stats dashboard-stats">
                {stat("Saved leads", leads.length, "in your pipeline")}
                {stat(
                  "Website opportunities",
                  leads.filter(
                    (l) => l.business.websiteStatus === "No Website Found",
                  ).length,
                  "no website listed",
                )}
                {stat(
                  "Hot leads",
                  leads.filter((l) => l.business.leadScore >= 80).length,
                  "ready to research",
                )}
                {stat(
                  "Clients won",
                  leads.filter((l) => l.status === "Client").length,
                  "relationships built",
                )}
              </div>
              <section className="dashboard-callout">
                <div className="eyebrow">
                  FIND → FILTER → VERIFY → SAVE → CONTACT
                </div>
                <h2>
                  Good businesses deserve
                  <br />a great online presence.
                </h2>
                <p>
                  Start with one neighbourhood. Find businesses.
                  <br />
                  Build relationships. Create something valuable.
                </p>
                <button
                  className="button primary"
                  onClick={() => setPage("Find Businesses")}
                >
                  Find businesses <ArrowRight size={16} />
                </button>
              </section>
              <div className="stats">
                {stat(
                  "With phone numbers",
                  leads.filter((l) => l.business.phone).length,
                  "contactable leads",
                )}
                {stat(
                  "Verified",
                  leads.filter((l) => l.verification.startsWith("Verified"))
                    .length,
                  "manually reviewed",
                )}
                {stat(
                  "Contacted",
                  leads.filter((l) => l.status === "Contacted").length,
                  "conversations started",
                )}
                {stat(
                  "Interested",
                  leads.filter((l) => l.status === "Interested").length,
                  "potential clients",
                )}
              </div>
              <div className="dashboard-columns">
                <section className="panel">
                  <h2>Recent saved leads</h2>
                  {leads.slice(0, 5).map((l) => (
                    <button
                      className="recent-row"
                      key={l.business.id}
                      onClick={() => setDetail(l.business)}
                    >
                      <span>
                        {l.business.name || NA}
                        <small>
                          {l.business.category} · {l.status}
                        </small>
                      </span>
                      <span className="score-box">{l.business.leadScore}</span>
                    </button>
                  ))}
                  {!leads.length && (
                    <p className="muted">
                      No saved leads yet. Your pipeline starts with a search.
                    </p>
                  )}
                </section>
                <section className="panel">
                  <h2>Recent searches</h2>
                  {history.slice(0, 5).map((h) => (
                    <button
                      className="recent-row"
                      key={h.id}
                      onClick={() => search(false, h)}
                    >
                      <span>
                        {h.location}
                        <small>
                          {h.category} · {h.count} businesses
                        </small>
                      </span>
                      <ArrowUpRight size={17} />
                    </button>
                  ))}
                  {!history.length && (
                    <p className="muted">Your searches will appear here.</p>
                  )}
                </section>
              </div>
            </>
          )}
          {["Find Businesses", "Leads", "Map"].includes(page) && (
            <>
              {(searched || page === "Leads") && (
                <div className="stats">
                  {stat(
                    "Businesses found",
                    source.length,
                    "available businesses",
                  )}
                  {stat(
                    "No website listed",
                    source.filter((b) => b.websiteStatus === "No Website Found")
                      .length,
                    "potential opportunities",
                  )}
                  {stat(
                    "With phone numbers",
                    source.filter((b) => b.phone).length,
                    `${source.filter((b) => b.email).length} also have email`,
                  )}
                  {stat(
                    "Hot leads",
                    source.filter((b) => b.leadScore >= 80).length,
                    `${source.filter((b) => b.facebook || b.instagram).length} with social profiles`,
                  )}
                </div>
              )}
              <section className="results-panel">
                <div className="results-heading">
                  <div>
                    <h2>
                      {page === "Leads" ? "Saved leads" : "Business results"}{" "}
                      <span className="count-pill">{filtered.length}</span>
                    </h2>
                    <p>
                      {resolved
                        ? `${resolved.split(",").slice(0, 3).join(", ")} · ${cached ? "Cached results" : "OpenStreetMap data"}`
                        : "Real businesses. Better possibilities."}
                    </p>
                  </div>
                  <div className="view-toggle">
                    {[
                      ["table", List],
                      ["cards", Grid2X2],
                      ["map", MapPin],
                    ].map(([v, Icon]: any) => (
                      <button
                        key={v}
                        className={view === v ? "active" : ""}
                        onClick={() => setView(v)}
                        title={`${v} view`}
                        aria-label={`${v} view`}
                      >
                        <Icon size={17} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="toolbar">
                  <div className="input-icon">
                    <Search size={16} />
                    <input
                      placeholder="Search results..."
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Website status"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  >
                    {[
                      "All",
                      "No Website Found",
                      "Website Found",
                      "Unknown",
                    ].map((v) => (
                      <option key={v} value={v}>
                        {v === "All" ? "All website statuses" : v}
                      </option>
                    ))}
                  </select>
                  <button
                    className={`button secondary ${filters ? "selected" : ""}`}
                    onClick={() => setFilters(!filters)}
                  >
                    <SlidersHorizontal size={15} /> Filters
                  </button>
                  <select
                    aria-label="Sort results"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    {[
                      "Highest Lead Score",
                      "Lowest Lead Score",
                      "No Website First",
                      "Has Phone First",
                      "Has Email First",
                      "Business Name",
                      "Category",
                      "Recently Found",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  {page === "Find Businesses" && (
                    <button
                      className="icon-btn"
                      title="Refresh Data"
                      aria-label="Refresh Data"
                      disabled={loading}
                      onClick={() => search(true)}
                    >
                      <RefreshCw size={17} />
                    </button>
                  )}
                </div>
                {filters && (
                  <div className="filters">
                    {[
                      [
                        "Phone",
                        phone,
                        setPhone,
                        ["All", "Has Phone", "No Phone"],
                      ],
                      [
                        "Email",
                        email,
                        setEmail,
                        ["All", "Has Email", "No Email"],
                      ],
                      [
                        "Contact quality",
                        quality,
                        setQuality,
                        ["All", "Excellent", "Good", "Medium", "Low"],
                      ],
                      [
                        "Lead score",
                        classification,
                        setClassification,
                        [
                          "All",
                          "HOT LEAD",
                          "GOOD LEAD",
                          "POSSIBLE LEAD",
                          "LOW DATA",
                        ],
                      ],
                      [
                        "Saved",
                        savedFilter,
                        setSavedFilter,
                        ["All", "Saved", "Not Saved"],
                      ],
                      ["Lead status", status, setStatus, ["All", ...statuses]],
                      [
                        "Category",
                        categoryFilter,
                        setCategoryFilter,
                        ["All", ...new Set(source.map((b) => b.category))],
                      ],
                    ].map(([label, value, set, options]: any) => (
                      <label key={label}>
                        {label}
                        <select
                          value={value}
                          onChange={(e) => set(e.target.value)}
                        >
                          {options.map((v: string) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
                <div className="export-strip">
                  <span>
                    {selected.length
                      ? `${selected.length} selected`
                      : "Review the data. Verify the opportunity."}
                  </span>
                  <button onClick={() => exportRows(source)}>Export all</button>
                  <button onClick={() => exportRows(filtered)}>
                    Export filtered
                  </button>
                  <button
                    disabled={!selected.length}
                    onClick={() =>
                      exportRows(source.filter((b) => selected.includes(b.id)))
                    }
                  >
                    Export selected
                  </button>
                </div>
                {renderResults()}
                <div className="results-footer">
                  <span>
                    Showing {filtered.length} businesses · Maximum {limit} per
                    search
                  </span>
                  <span>© OpenStreetMap contributors</span>
                </div>
              </section>
            </>
          )}
          {page === "Search History" && (
            <section className="panel">
              <h2>Your recent searches</h2>
              {!history.length && (
                <div className="empty">
                  <History size={30} />
                  <h3>No searches yet</h3>
                  <p>Run a targeted search to start your research history.</p>
                </div>
              )}
              {history.map((h) => (
                <div className="history-row" key={h.id}>
                  <span className="category-icon">
                    <Search size={20} />
                  </span>
                  <div>
                    <strong>{h.location}</strong>
                    <p>
                      {h.category} · {h.radius / 1000} km ·{" "}
                      {new Date(h.date).toLocaleString()}
                    </p>
                    <small>
                      {h.count} businesses · {h.without} without websites ·{" "}
                      {h.hot} hot leads
                    </small>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => search(false, h)}
                  >
                    Run again <ArrowRight size={14} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Delete search"
                    onClick={() =>
                      setHistory((prev) => prev.filter((x) => x.id !== h.id))
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </section>
          )}
          {page === "Settings" && (
            <div className="settings-grid">
              <section className="panel">
                <h2>Your data, your workspace</h2>
                <p>
                  Leads, notes, verification, and search history are saved in
                  this browser. No account or credit card is needed.
                </p>
                <p className="muted">
                  Browser data does not automatically transfer between devices.
                  Export a backup regularly.
                </p>
                <button
                  className="button secondary"
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob(
                        [JSON.stringify({ leads, history, ignored }, null, 2)],
                        { type: "application/json" },
                      ),
                    );
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "leadfind-backup.json";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  <Download size={16} /> Download full backup
                </button>
                <label className="backup-input">
                  Restore backup
                  <input
                    type="file"
                    accept="application/json"
                    onChange={async (e) => {
                      try {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const data = JSON.parse(await f.text());
                        if (
                          !Array.isArray(data.leads) ||
                          !data.leads.every(
                            (l: any) =>
                              l.business?.id &&
                              Array.isArray(l.history) &&
                              l.verified &&
                              typeof l.notes === "string",
                          )
                        )
                          throw new Error("Invalid backup file");
                        setLeads((prev) => [
                          ...prev,
                          ...data.leads.filter(
                            (l: Lead) =>
                              !prev.some(
                                (p) => p.business.id === l.business.id,
                              ),
                          ),
                        ]);
                        setMessage("Backup restored; existing leads preserved");
                      } catch {
                        setError("This file is not a valid LEADFIND backup.");
                      }
                    }}
                  />
                </label>
                <h3>Ignored businesses</h3>
                <p>{ignored.length} businesses hidden from results.</p>
                <button
                  className="button secondary"
                  onClick={() => setIgnored([])}
                >
                  Restore ignored businesses
                </button>
              </section>
              <section className="panel">
                <h2>Optional cloud sync</h2>
                <p>
                  Connect a free Supabase project to keep your saved leads
                  across devices. Local mode always remains available.
                </p>
                <span className="badge neutral">
                  {supabase ? "Supabase configured" : "Local mode active"}
                </span>
                {supabase ? (
                  <>
                    <label>
                      Email
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                      />
                    </label>
                    <div className="button-row">
                      <button
                        className="button secondary"
                        onClick={async () => {
                          const { error } =
                            await supabase!.auth.signInWithPassword({
                              email: authEmail,
                              password: authPassword,
                            });
                          error
                            ? setError(error.message)
                            : setMessage("Signed in");
                        }}
                      >
                        Sign in
                      </button>
                      <button
                        className="button secondary"
                        onClick={async () => {
                          const { error } = await supabase!.auth.signUp({
                            email: authEmail,
                            password: authPassword,
                          });
                          error
                            ? setError(error.message)
                            : setMessage(
                                "Account created. Check your email for confirmation.",
                              );
                        }}
                      >
                        Create account
                      </button>
                      <button
                        className="button secondary"
                        onClick={async () => {
                          await supabase!.auth.signOut();
                          setMessage("Signed out");
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                    <div className="button-row">
                      <button
                        className="button primary"
                        onClick={async () => {
                          try {
                            await syncLeads(leads);
                            setMessage("Leads synced to Supabase");
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Upload leads
                      </button>
                      <button
                        className="button secondary"
                        onClick={async () => {
                          try {
                            const cloud = await loadCloud();
                            setLeads((prev) => [
                              ...prev,
                              ...cloud.filter(
                                (l) =>
                                  !prev.some(
                                    (p) => p.business.id === l.business.id,
                                  ),
                              ),
                            ]);
                            setMessage("Cloud leads merged");
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Merge cloud leads
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="muted">
                    See README.md for the free-tier schema and configuration
                    instructions.
                  </p>
                )}
              </section>
              <section className="panel">
                <h2>Responsible research</h2>
                <p>
                  Searches are manual, capped at 100 businesses and a 10 km
                  radius, and cached for 30 minutes. The server enforces a
                  10-second cooldown.
                </p>
                <p>
                  No Google Maps scraping, automated outreach, background
                  crawling, or paid services.
                </p>
                <p>
                  “No Website Found” means no valid website was listed in
                  available OSM data. Always verify manually.
                </p>
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenStreetMap attribution & ODbL license ↗
                </a>
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>LEADFIND · Make local connections.</span>
            <span>Find. Filter. Verify. Save. Contact.</span>
          </footer>
        </main>
      </div>
      {message && (
        <div className="toast" role="status">
          <Check size={17} />
          {message}
        </div>
      )}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <section
            className="detail-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Business details"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close icon-btn"
              aria-label="Close details"
              onClick={() => setDetail(null)}
            >
              <X />
            </button>
            <div className="eyebrow">BUSINESS OVERVIEW</div>
            <h2>{detail.name || NA}</h2>
            <p className="muted">
              {detail.category} · {detail.provider}
            </p>
            <div className="detail-score">
              <span className="score-box hot">{detail.leadScore}</span>
              <div>
                <strong>{detail.leadClassification}</strong>
                <p>{detail.contactQuality} contact quality</p>
              </div>
            </div>
            {badge(detail)}
            <p className="muted">
              {detail.websiteStatus === "No Website Found"
                ? "No website found in available business data."
                : detail.websiteStatus === "Unknown"
                  ? "A website value exists but could not be validated. Verify manually."
                  : "A website is listed in available business data."}
            </p>
            <div className="button-row">
              <button className="button primary" onClick={() => save(detail)}>
                {leadFor(detail) ? <Check size={16} /> : <Plus size={16} />}{" "}
                {leadFor(detail) ? "Saved lead" : "Save lead"}
              </button>
              <a
                className="button secondary"
                href={verifyLink(detail)}
                target="_blank"
                rel="noreferrer"
              >
                Verify Online <ArrowUpRight size={16} />
              </a>
              <button
                className="button secondary"
                onClick={() => {
                  setIgnored((prev) => [...prev, detail.id]);
                  setDetail(null);
                  setMessage("Business ignored. Restore it in Settings.");
                }}
              >
                Ignore
              </button>
            </div>
            <h3>Original contact information</h3>
            {[
              ["Address", detail.address],
              ["Phone", detail.phone],
              ["Mobile", detail.mobile],
              ["Email", detail.email],
              ["Opening hours", detail.openingHours],
              ["Facebook", detail.facebook],
              ["Instagram", detail.instagram],
              ["Coordinates", `${detail.latitude}, ${detail.longitude}`],
            ].map(([k, v]) => (
              <div className="detail-row" key={k}>
                <span>{k}</span>
                <strong>{v || NA}</strong>
                {v && ["Phone", "Email"].includes(k) && (
                  <button
                    className="text-button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(v);
                        setMessage(`${k} copied`);
                      } catch {
                        setError(
                          "Clipboard access is unavailable. Select and copy the displayed value.",
                        );
                      }
                    }}
                  >
                    Copy
                  </button>
                )}
              </div>
            ))}
            {detail.website && (
              <a
                className="button secondary"
                href={detail.website}
                target="_blank"
                rel="noreferrer"
              >
                Visit website <ArrowUpRight size={14} />
              </a>
            )}
            <div className="button-row">
              <a href={detail.osmLink} target="_blank" rel="noreferrer">
                Open in OpenStreetMap ↗
              </a>
              <a
                href={verifyLink(detail, "social media Instagram Facebook")}
                target="_blank"
                rel="noreferrer"
              >
                Search social media ↗
              </a>
            </div>
            <BusinessMap businesses={[detail]} onView={openDetail} />
            <h3>Lead management & manual verification</h3>
            <p className="muted">
              Changes save this lead automatically. Original OSM data stays
              separate.
            </p>
            <div className="form-grid">
              <label>
                Lead status
                <select
                  value={leadFor(detail)?.status || "New"}
                  onChange={(e) => update(detail, { status: e.target.value })}
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Verification status
                <select
                  value={leadFor(detail)?.verification || "Not Verified"}
                  onChange={(e) =>
                    update(detail, { verification: e.target.value })
                  }
                >
                  {verificationStatuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {["website", "phone", "email", "instagram", "facebook"].map(
                (key) => (
                  <label key={key}>
                    Verified {key}
                    <input
                      value={leadFor(detail)?.verified[key] || ""}
                      onChange={(e) =>
                        update(detail, {
                          verified: {
                            ...leadFor(detail)?.verified,
                            [key]: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                ),
              )}
            </div>
            {leadFor(detail)?.verified.website &&
              normalizeUrl(leadFor(detail)!.verified.website) && (
                <a
                  href={normalizeUrl(leadFor(detail)!.verified.website)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open verified website ↗
                </a>
              )}
            <label>
              Research notes
              <textarea
                rows={4}
                value={leadFor(detail)?.notes || ""}
                onChange={(e) => update(detail, { notes: e.target.value })}
                placeholder="What did you learn? What should happen next?"
              />
            </label>
            <h3>Contact history</h3>
            <form
              className="contact-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const data = new FormData(form);
                update(detail, {
                  history: [
                    {
                      date: String(data.get("date")),
                      method: String(data.get("method")),
                      notes: String(data.get("notes")),
                    },
                    ...(leadFor(detail)?.history || []),
                  ],
                });
                form.reset();
                setMessage("Contact recorded");
              }}
            >
              <div className="form-grid">
                <label>
                  Date
                  <input
                    name="date"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </label>
                <label>
                  Method
                  <select name="method">
                    {[
                      "Phone",
                      "WhatsApp",
                      "Email",
                      "Instagram",
                      "Facebook",
                      "In Person",
                      "Other",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Contact notes
                <textarea name="notes" required rows={2} />
              </label>
              <button className="button secondary">
                <Plus size={16} /> Record contact
              </button>
            </form>
            {leadFor(detail)?.history.map((h, i) => (
              <div className="contact-entry" key={i}>
                <strong>
                  {h.method} · {h.date}
                </strong>
                <p>{h.notes}</p>
              </div>
            ))}
            <details>
              <summary>Original OSM data</summary>
              <pre>{JSON.stringify(detail.rawData, null, 2)}</pre>
            </details>
            <p className="muted">
              Score: no website +40 · phone +20 · email +15 · social +10 ·
              complete address +5 · hours +5 · name +5.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
