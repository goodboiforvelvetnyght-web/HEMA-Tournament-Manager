import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Swords,
  Trophy,
  ArrowUpRight,
  ArrowRight,
  Plus,
  X,
  Check,
  ChevronRight,
  Clock3,
  Users,
  CalendarDays,
  LayoutGrid,
  ListOrdered,
  GitBranch,
  Shield,
  LogOut,
  Download,
  Play,
  Pause,
  RotateCcw,
  Minus,
  AlertCircle,
  CheckCircle2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Shuffle,
} from "lucide-react";
import {
  elapsed,
  standings,
  suggestedSeeds,
  winner,
  penalty,
  type Match,
  type Tournament,
  type Command,
} from "../shared/domain";
import { practice, useTournaments } from "./data";
const poolName = (n: number) => String.fromCharCode(65 + n);
const nameOf = (t: Tournament, id: string | null) =>
  t.participants.find((p) => p.id === id)?.name || "Bye";
const formatTime = (ms: number) =>
  `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0")}:${Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, "0")}`;
function tournamentStatus(t: Tournament) {
  const last = t.matches.filter(
    (m) => m.stage === "bracket" && m.round === t.bracketRound,
  );
  return last.length === 1 && last[0].status === "finished"
    ? "Complete"
    : t.bracketRound
      ? "Elimination"
      : "Round robin";
}
function Status({ status }: { status: Match["status"] }) {
  return (
    <span className={`status ${status}`}>
      <i />
      {status === "upcoming"
        ? "Upcoming"
        : status === "finished"
          ? "Final"
          : status === "bye"
            ? "Bye"
            : "Live"}
    </span>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Message({ children }: { children: ReactNode }) {
  return (
    <div className="message" role="alert">
      <AlertCircle size={18} />
      <span>{children}</span>
    </div>
  );
}
export default function App() {
  const store = useTournaments();
  const [selected, setSelected] = useState(location.hash.slice(1));
  const [tab, setTab] = useState("overview");
  const [loginOpen, setLoginOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const t = store.tournaments.find((t) => t.id === selected);
  const match = t?.matches.find((m) => m.id === matchId);
  useEffect(() => {
    const listener = () => setSelected(location.hash.slice(1));
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  function select(id: string) {
    location.hash = id;
    setSelected(id);
    setTab("overview");
    setError("");
  }
  async function execute(command: Command) {
    if (!t) return;
    setBusy(true);
    setError("");
    try {
      await store.mutate(t, command);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  function run(command: Command) {
    void execute(command).catch(() => {});
  }
  function exportTournament() {
    if (!t) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(t, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t.name.replace(/[^a-z0-9]/gi, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("Tournament backup downloaded");
  }
  return (
    <>
      <header className="topbar">
        <a className="brand" href="#" onClick={() => select("")}>
          <span className="brand-mark">
            <Swords size={22} />
          </span>
          <span>
            en garde<span className="brand-dot">.</span>
          </span>
        </a>
        <nav>
          <button className={!t ? "nav-active" : ""} onClick={() => select("")}>
            Tournaments
          </button>
          <span className="nav-note">THE ART OF THE BOUT</span>
        </nav>
        <span className="header-mode">
          <span className="connection-dot" />
          {store.admin ? "Admin desk" : "Public scoreboard"}
        </span>
      </header>
      {practice && (
        <div className="practice-banner">
          Practice mode · Sample data is saved on this device only.{" "}
          <a href={location.pathname}>
            Return to live tournaments <ArrowUpRight size={13} />
          </a>
        </div>
      )}
      <main>
        {!t ? (
          <>
            <section className="landing-hero">
              <div>
                <span className="eyebrow">
                  HISTORICAL FENCING. MODERN COMPETITION.
                </span>
                <h1>
                  Every exchange.
                  <br />
                  <em>Every victory.</em>
                </h1>
                <p>
                  A clear view of the competition, from the first pool bout
                  <br className="desktop" /> to the final salute.
                </p>
                <div className="hero-actions">
                  {store.admin ? (
                    <button
                      className="primary"
                      onClick={() => setCreateOpen(true)}
                    >
                      <Plus size={18} />
                      Create tournament
                    </button>
                  ) : (
                    <a
                      className="primary"
                      href="#tournaments"
                      onClick={(e) => {
                        e.preventDefault();
                        document
                          .getElementById("tournaments")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Explore tournaments <ArrowRight size={17} />
                    </a>
                  )}
                  <span className="live-caption">
                    <span className="connection-dot" />
                    Scores update live
                  </span>
                </div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="art-ring outer" />
                <div className="art-ring inner" />
                <span className="art-top">PRECISION / RESPECT / RESOLVE</span>
                <Swords strokeWidth={0.7} />
                <span className="art-bottom">MEET ON THE FIELD.</span>
                <span className="art-star">✦</span>
              </div>
            </section>
            <section id="tournaments" className="tournament-list">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">ON THE FIELD</span>
                  <h2>
                    Tournaments{" "}
                    <span className="count">{store.tournaments.length}</span>
                  </h2>
                </div>
                <span className="muted small">
                  Round robin & single elimination
                </span>
              </div>
              {store.error && (
                <Message>
                  {store.error} <a href="?practice=1">Explore practice mode</a>
                </Message>
              )}
              {store.loading ? (
                <div className="empty">
                  <div className="spinner" />
                  Connecting to the scoreboard…
                </div>
              ) : store.tournaments.length ? (
                <div className="tournament-grid">
                  {store.tournaments.map((item) => (
                    <button
                      className="tournament-card"
                      key={item.id}
                      onClick={() => select(item.id)}
                    >
                      <div className="card-top">
                        <span className="weapon">
                          <Swords size={15} />
                          {item.weapon}
                        </span>
                        <ArrowUpRight size={19} />
                      </div>
                      <h3>{item.name}</h3>
                      <div className="card-meta">
                        <span>
                          <CalendarDays size={15} />
                          {new Date(item.date + "T12:00:00").toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </span>
                        <span>
                          <Users size={15} />
                          {item.participants.length} fencers
                        </span>
                      </div>
                      <div className="card-progress">
                        <div
                          style={{
                            width: `${(100 * item.matches.filter((m) => m.status === "finished" || m.status === "bye").length) / item.matches.length}%`,
                          }}
                        />
                      </div>
                      <div className="card-bottom">
                        <span>{tournamentStatus(item)}</span>
                        <span>
                          {
                            item.matches.filter((m) => m.status === "finished")
                              .length
                          }{" "}
                          bouts completed <ChevronRight size={14} />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                !store.error && (
                  <div className="empty">
                    <Swords size={35} />
                    <h3>The field is yours.</h3>
                    <p>
                      The first tournament will appear here when an admin
                      creates it.
                    </p>
                    {store.admin ? (
                      <button
                        className="primary"
                        onClick={() => setCreateOpen(true)}
                      >
                        Create tournament <Plus size={16} />
                      </button>
                    ) : (
                      <a className="text-link" href="?practice=1">
                        Explore a practice tournament <ArrowUpRight size={15} />
                      </a>
                    )}
                  </div>
                )
              )}
            </section>
            <div className="principles">
              <span>
                <Swords size={20} />
                From pools to the podium
              </span>
              <span>
                <Clock3 size={20} />
                Follow every exchange
              </span>
              <span>
                <Trophy size={20} />
                Let the fencing decide
              </span>
            </div>
          </>
        ) : (
          <>
            <button className="breadcrumb" onClick={() => select("")}>
              Tournaments <ChevronRight size={13} />
              <span>{t.name}</span>
            </button>
            <div className="tournament-heading">
              <div>
                <div className="eyebrow">
                  {t.weapon} <span> / </span> {tournamentStatus(t)}
                </div>
                <h1>{t.name}</h1>
                <div className="detail-meta">
                  <span>
                    <CalendarDays size={15} />
                    {t.date}
                  </span>
                  <span>
                    <Users size={15} />
                    {t.participants.length} fencers
                  </span>
                  <span>{t.poolCount} pools</span>
                </div>
              </div>
              {store.admin && (
                <button className="secondary" onClick={exportTournament}>
                  <Download size={16} />
                  Export backup
                </button>
              )}
            </div>
            <div className="tabs" role="tablist" aria-label="Tournament views">
              {[
                { id: "overview", label: "Overview", icon: LayoutGrid },
                { id: "matches", label: "Matches", icon: Swords },
                { id: "standings", label: "Standings", icon: ListOrdered },
                { id: "bracket", label: "Bracket", icon: GitBranch },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? "active" : ""}
                  onClick={() => setTab(id)}
                >
                  <Icon size={17} />
                  {label}
                </button>
              ))}
              <span className="tabs-note">
                <span className="connection-dot" />
                {practice ? "Practice scoreboard" : "Live updates"}
              </span>
            </div>
            {error && !match && <Message>{error}</Message>}
            {tab === "overview" && (
              <Overview t={t} onMatch={setMatchId} onTab={setTab} />
            )}
            {tab === "matches" && (
              <Matches
                t={t}
                admin={store.admin}
                busy={busy}
                onMatch={setMatchId}
                run={run}
              />
            )}
            {tab === "standings" && <Standings t={t} />}
            {tab === "bracket" && (
              <Bracket
                t={t}
                admin={store.admin}
                busy={busy}
                run={run}
                onMatch={setMatchId}
              />
            )}
          </>
        )}
      </main>
      <footer>
        <div className="footer-brand">
          <Swords size={16} /> en garde.{" "}
          <span>Made for the fencing community.</span>
        </div>
        {store.admin ? (
          <button className="footer-login" onClick={() => void store.logout()}>
            <LogOut size={14} />
            Leave admin desk
          </button>
        ) : (
          <button className="footer-login" onClick={() => setLoginOpen(true)}>
            <Shield size={14} />
            Admin login
          </button>
        )}
      </footer>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {loginOpen && (
        <Login onClose={() => setLoginOpen(false)} login={store.login} />
      )}
      {createOpen && store.admin && (
        <Create
          onClose={() => setCreateOpen(false)}
          onCreate={async (input) => {
            const id = await store.mutate(null, input);
            setCreateOpen(false);
            select(id);
            setToast("Tournament created. The field is ready.");
          }}
        />
      )}
      {match && t && (
        <Scoring
          t={t}
          m={match}
          admin={store.admin}
          busy={busy}
          error={error}
          onClose={() => {
            setMatchId(null);
            setError("");
          }}
          execute={execute}
        />
      )}
    </>
  );
}
function Overview({
  t,
  onMatch,
  onTab,
}: {
  t: Tournament;
  onMatch: (id: string) => void;
  onTab: (tab: string) => void;
}) {
  const complete = t.matches.filter(
    (m) => m.status === "finished" || m.status === "bye",
  ).length;
  const next = t.matches
    .filter((m) => m.status !== "finished" && m.status !== "bye")
    .slice(0, 3);
  const rows = standings(t);
  const final = t.matches.find(
    (m) =>
      m.stage === "bracket" &&
      m.round === Math.log2(t.bracketSeeds.length) &&
      m.status === "finished",
  );
  return (
    <>
      <div className="stats-grid">
        <Stat
          label="Fencers on the field"
          value={t.participants.length}
          icon={<Users />}
        />
        <Stat
          label="Bouts completed"
          value={`${complete} / ${t.matches.length}`}
          icon={<Swords />}
        />
        <Stat
          label="Current stage"
          value={tournamentStatus(t)}
          icon={<GitBranch />}
        />
        <Stat
          label="Doubles recorded"
          value={t.matches.reduce((sum, m) => sum + m.doubles, 0)}
          icon={<Shield />}
        />
      </div>
      {final && (
        <div className="champion">
          <Trophy size={38} />
          <div>
            <span className="eyebrow">THE FINAL SALUTE</span>
            <h2>{nameOf(t, winner(final))}</h2>
            <p>{t.name} champion</p>
          </div>
        </div>
      )}
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">THE MATCH QUEUE</span>
              <h2>Next on the field</h2>
            </div>
            <button className="text-link" onClick={() => onTab("matches")}>
              All matches <ArrowRight size={15} />
            </button>
          </div>
          {next.length ? (
            next.map((m) => (
              <MatchRow key={m.id} t={t} m={m} onClick={() => onMatch(m.id)} />
            ))
          ) : (
            <div className="empty compact">
              <CheckCircle2 />
              <h3>All scheduled bouts complete.</h3>
              <p>
                {t.bracketRound
                  ? "Visit the bracket to continue."
                  : "Review standings and select your qualifiers."}
              </p>
              <button className="text-link" onClick={() => onTab("bracket")}>
                Open bracket <ArrowRight size={15} />
              </button>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ROUND ROBIN</span>
              <h2>At the top</h2>
            </div>
            <button className="text-link" onClick={() => onTab("standings")}>
              Standings <ArrowRight size={15} />
            </button>
          </div>
          <div className="leader-label">
            <span>FENCER</span>
            <span>RANKING SCORE</span>
          </div>
          {rows.slice(0, 5).map((r, i) => (
            <div className="leader" key={r.id}>
              <span className={`rank ${i === 0 ? "first" : ""}`}>
                {rows.findIndex((x) => x.ranking === r.ranking) + 1}
              </span>
              <span className="leader-name">
                {r.name}
                <small>
                  Pool {poolName(r.pool)} · {r.played} bouts
                </small>
              </span>
              <strong>{r.ranking}</strong>
            </div>
          ))}
        </section>
      </div>
      <div className="stage-strip">
        <span className="stage-number">01</span>
        <div>
          <strong>Round robin</strong>
          <span>Every pairing. Every point counts.</span>
        </div>
        <ArrowRight />
        <span className="stage-number">02</span>
        <div>
          <strong>Single elimination</strong>
          <span>Admin-selected qualifiers. One champion.</span>
        </div>
      </div>
    </>
  );
}
function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span className="stat-icon">{icon}</span>
    </div>
  );
}
function MatchRow({
  t,
  m,
  onClick,
}: {
  t: Tournament;
  m: Match;
  onClick: () => void;
}) {
  return (
    <button className="match-row" onClick={onClick}>
      <div className="match-row-top">
        <span>
          {m.stage === "pools"
            ? `Pool ${poolName(m.pool)}`
            : `Elimination · Round ${m.round}`}
        </span>
        <Status status={m.status} />
      </div>
      <div className="match-pair">
        <span className={m.result === "a" ? "winner-name" : ""}>
          {nameOf(t, m.a)}
        </span>
        <strong>{m.status === "upcoming" ? "—" : m.scoreA}</strong>
      </div>
      <div className="match-pair">
        <span className={m.result === "b" ? "winner-name" : ""}>
          {nameOf(t, m.b)}
        </span>
        <strong>{m.status === "upcoming" ? "—" : m.scoreB}</strong>
      </div>
      <div className="match-row-bottom">
        <span>{m.doubles} doubles</span>
        <span>
          View bout <ArrowUpRight size={13} />
        </span>
      </div>
    </button>
  );
}
function Matches({
  t,
  admin,
  busy,
  onMatch,
  run,
}: {
  t: Tournament;
  admin: boolean;
  busy: boolean;
  onMatch: (id: string) => void;
  run: (c: Command) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [pool, setPool] = useState("all");
  const rows = t.matches.filter(
    (m) =>
      (filter === "all" ||
        (filter === "upcoming"
          ? m.status === "upcoming" || m.status === "live"
          : m.status === "finished" || m.status === "bye")) &&
      (pool === "all" ||
        (pool === "bracket"
          ? m.stage === "bracket"
          : m.stage === "pools" && m.pool === Number(pool))),
  );
  function move(m: Match, delta: number) {
    const ids = t.matches.map((m) => m.id);
    const i = ids.indexOf(m.id);
    if (i + delta < 0 || i + delta >= ids.length) return;
    [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
    run({ type: "reorder", matchIds: ids });
  }
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>The match queue</h2>
          <p className="muted">
            {admin
              ? "Open a bout to score live. Use the arrows to adjust the running order."
              : "Follow the action, one exchange at a time."}
          </p>
        </div>
        <div className="filters">
          <select
            aria-label="Filter match status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All matches</option>
            <option value="upcoming">Upcoming & live</option>
            <option value="finished">Completed</option>
          </select>
          <select
            aria-label="Filter match pool"
            value={pool}
            onChange={(e) => setPool(e.target.value)}
          >
            <option value="all">All stages</option>
            {Array.from({ length: t.poolCount }, (_, i) => (
              <option key={i} value={i}>
                Pool {poolName(i)}
              </option>
            ))}
            <option value="bracket">Elimination</option>
          </select>
        </div>
      </div>
      <div className="match-grid">
        {rows.map((m) => (
          <div key={m.id} className="queue-card">
            {admin && (
              <div className="queue-order">
                <span>
                  <GripVertical size={14} />
                  Bout {t.matches.indexOf(m) + 1}
                </span>
                <div>
                  <button
                    className="icon-button"
                    disabled={busy || t.matches.indexOf(m) === 0}
                    aria-label={`Move bout ${t.matches.indexOf(m) + 1} up`}
                    onClick={() => move(m, -1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={
                      busy || t.matches.indexOf(m) === t.matches.length - 1
                    }
                    aria-label={`Move bout ${t.matches.indexOf(m) + 1} down`}
                    onClick={() => move(m, 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                </div>
              </div>
            )}
            <MatchRow t={t} m={m} onClick={() => onMatch(m.id)} />
          </div>
        ))}
      </div>
      {!rows.length && <div className="empty">No matches in this view.</div>}
    </section>
  );
}
function Standings({ t }: { t: Tournament }) {
  const [pool, setPool] = useState("all");
  const all = standings(t);
  const rows = all.filter((r) => pool === "all" || r.pool === Number(pool));
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Every point counts.</h2>
          <p className="muted">
            Official standings from submitted round-robin results.
          </p>
        </div>
        <select
          aria-label="Standings pool"
          value={pool}
          onChange={(e) => setPool(e.target.value)}
        >
          <option value="all">Overall scoreboard</option>
          {Array.from({ length: t.poolCount }, (_, i) => (
            <option key={i} value={i}>
              Pool {poolName(i)}
            </option>
          ))}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {[
                "Rank",
                "Fencer",
                "Pool",
                "Played",
                "Wins",
                "Draws",
                "Scored",
                "Against",
                "Doubles",
                "Penalty",
                "Ranking score",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="rank">
                    {rows.findIndex((x) => x.ranking === r.ranking) + 1}
                    {rows.filter((x) => x.ranking === r.ranking).length > 1
                      ? "="
                      : ""}
                  </span>
                </td>
                <td className="fencer-cell">{r.name}</td>
                <td>{poolName(r.pool)}</td>
                <td>{r.played}</td>
                <td>{r.wins}</td>
                <td>{r.draws}</td>
                <td>{r.for}</td>
                <td>{r.against}</td>
                <td>{r.doubles}</td>
                <td>{penalty(r.doubles)}</td>
                <td className="ranking-cell">{r.ranking}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="formula">
        <span>
          <ListOrdered size={18} />
          <strong>The ranking formula</strong>
        </span>
        <code>3 × wins + scored − against − D(D − 1)/2</code>
        <p>
          Doubles accumulate across the stage. Equal scores share a rank; admin
          decides qualification and seeding. Compare matches played when pools
          differ in size.
        </p>
      </div>
    </section>
  );
}
function Bracket({
  t,
  admin,
  busy,
  run,
  onMatch,
}: {
  t: Tournament;
  admin: boolean;
  busy: boolean;
  run: (c: Command) => void;
  onMatch: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [seeds, setSeeds] = useState<(string | null)[]>([]);
  const [pool, setPool] = useState("all");
  const complete = t.matches
    .filter((m) => m.stage === "pools")
    .every((m) => m.status === "finished");
  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    setSelected(next);
    setSeeds(suggestedSeeds(next));
  }
  function swap(index: number, id: string | null) {
    const next = [...seeds];
    const other = next.findIndex((s, i) => i !== index && s === id);
    if (other >= 0) next[other] = next[index];
    next[index] = id;
    setSeeds(next);
  }
  if (!t.bracketRound)
    return (
      <section>
        <div className="section-heading">
          <div>
            <h2>The road to the final</h2>
            <p className="muted">
              Qualifiers are chosen by the admin. Every tournament can take its
              own path.
            </p>
          </div>
          <span className="tag">Awaiting qualifiers</span>
        </div>
        {admin ? (
          <>
            <div className="notice">
              <Shield size={19} />
              <span>
                {complete
                  ? "Round robin is complete. Select qualifiers, arrange pairings, and confirm the bracket."
                  : "You can plan your qualifiers now. Finish all round-robin bouts before confirming the bracket."}
              </span>
            </div>
            <div className="qualification-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h3>1. Select qualifiers</h3>
                  <select
                    aria-label="Qualifier pool"
                    value={pool}
                    onChange={(e) => setPool(e.target.value)}
                  >
                    <option value="all">Overall scoreboard</option>
                    {Array.from({ length: t.poolCount }, (_, i) => (
                      <option key={i} value={i}>
                        Pool {poolName(i)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="qualifier-header">
                  <span>FENCER / POOL / BOUTS</span>
                  <span>SCORE</span>
                </div>
                {standings(t)
                  .filter((r) => pool === "all" || r.pool === Number(pool))
                  .map((r) => (
                    <label
                      className={`qualifier ${selected.includes(r.id) ? "selected" : ""}`}
                      key={r.id}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                      <span>
                        {r.name}
                        <small>
                          Pool {poolName(r.pool)} · {r.played} bouts
                        </small>
                      </span>
                      <strong>{r.ranking}</strong>
                    </label>
                  ))}
              </section>
              <section className="panel seed-panel">
                <div className="panel-heading">
                  <h3>2. Arrange opening pairings</h3>
                </div>
                {seeds.length ? (
                  <>
                    <p className="muted small seed-note">
                      {selected.length} qualifiers · {seeds.length} slots ·{" "}
                      {seeds.length - selected.length} byes. Changing a slot
                      swaps its occupant.
                    </p>
                    {Array.from({ length: seeds.length / 2 }, (_, i) => (
                      <div className="seed-pair" key={i}>
                        <span className="eyebrow">PAIRING {i + 1}</span>
                        {[i * 2, i * 2 + 1].map((index) => (
                          <select
                            key={index}
                            aria-label={`Bracket slot ${index + 1}`}
                            value={seeds[index] ?? ""}
                            onChange={(e) =>
                              swap(index, e.target.value || null)
                            }
                          >
                            {seeds.length > selected.length && (
                              <option value="">
                                Bye — automatic advancement
                              </option>
                            )}
                            {selected.map((id) => (
                              <option key={id} value={id}>
                                {nameOf(t, id)}
                              </option>
                            ))}
                          </select>
                        ))}
                      </div>
                    ))}
                    <div className="seed-confirm">
                      <p className="muted small">
                        Confirming locks qualifiers and pairings. Byes advance
                        automatically.
                      </p>
                      <button
                        className="primary full"
                        disabled={
                          busy ||
                          !complete ||
                          seeds.some(
                            (s, i) => i % 2 === 0 && !s && !seeds[i + 1],
                          )
                        }
                        onClick={() => run({ type: "bracket", seeds })}
                      >
                        <Check size={17} />
                        Confirm bracket
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="empty compact">
                    <GitBranch size={32} />
                    <h3>Choose your field.</h3>
                    <p>Select at least two fencers to preview the bracket.</p>
                  </div>
                )}
              </section>
            </div>
          </>
        ) : (
          <div className="empty">
            <GitBranch size={40} />
            <h3>The next chapter is taking shape.</h3>
            <p>
              The admin will select qualifiers and publish the bracket after
              round robin.
            </p>
          </div>
        )}
      </section>
    );
  const rounds = Math.log2(t.bracketSeeds.length);
  const opening = t.bracketSeeds.length / 2;
  const height = opening * 136;
  const current = t.matches.filter(
    (m) => m.stage === "bracket" && m.round === t.bracketRound,
  );
  const ready = current.every(
    (m) => m.status === "finished" || m.status === "bye",
  );
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>The road to the final</h2>
          <p className="muted">
            {t.bracketSeeds.filter(Boolean).length} qualifiers · Single
            elimination
          </p>
        </div>
        {admin && t.bracketRound < rounds && (
          <button
            className="primary"
            disabled={busy || !ready}
            onClick={() => run({ type: "nextRound" })}
          >
            Generate next round <ArrowRight size={17} />
          </button>
        )}
      </div>
      <div className="bracket-scroll">
        <div className="bracket-board" style={{ width: rounds * 280 }}>
          {Array.from({ length: rounds }, (_, r) => (
            <div className="bracket-column" key={r}>
              <div className="bracket-round-label">
                {r === rounds - 1
                  ? "Final"
                  : r === rounds - 2
                    ? "Semifinals"
                    : r === rounds - 3
                      ? "Quarterfinals"
                      : `Round ${r + 1}`}
              </div>
              <div className="bracket-round" style={{ height }}>
                {Array.from({ length: opening / 2 ** r }, (_, i) => {
                  const m = t.matches.find(
                    (m) =>
                      m.stage === "bracket" &&
                      m.round === r + 1 &&
                      m.slot === i,
                  );
                  const center = 2 ** r * (i + 0.5) * 136;
                  const prior = (slot: number) =>
                    t.matches.find(
                      (m) =>
                        m.stage === "bracket" &&
                        m.round === r &&
                        m.slot === slot,
                    );
                  const placeholder = (side: number) => {
                    const parent = prior(i * 2 + side);
                    return parent && winner(parent)
                      ? nameOf(t, winner(parent))
                      : `Winner of ${r}.${i * 2 + side + 1}`;
                  };
                  return (
                    <div key={i}>
                      <button
                        className={`bracket-match ${m ? "" : "placeholder"}`}
                        style={{ top: center - 49 }}
                        disabled={!m || m.status === "bye"}
                        onClick={() => m && onMatch(m.id)}
                      >
                        <div className="bracket-match-heading">
                          <span>
                            {r + 1}.{i + 1}
                          </span>
                          {m ? (
                            <Status status={m.status} />
                          ) : (
                            <span>Awaiting round</span>
                          )}
                        </div>
                        {[0, 1].map((side) => (
                          <div
                            key={side}
                            className={`bracket-fencer ${m?.result === (side ? "b" : "a") ? "victor" : ""}`}
                          >
                            <span>
                              {m
                                ? nameOf(t, side ? m.b : m.a)
                                : placeholder(side)}
                            </span>
                            <strong>
                              {m &&
                              m.status !== "upcoming" &&
                              m.status !== "bye"
                                ? side
                                  ? m.scoreB
                                  : m.scoreA
                                : "—"}
                            </strong>
                          </div>
                        ))}
                      </button>
                      {r < rounds - 1 && (
                        <svg
                          className="bracket-line"
                          width="40"
                          height={height}
                          aria-hidden="true"
                        >
                          <path
                            d={`M0 ${center} H20 V${2 ** (r + 1) * (Math.floor(i / 2) + 0.5) * 136} H40`}
                          />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="muted small">
        Tap a match to view its scores. Byes advance without a bout. Future
        rounds become available after the admin generates them.
      </p>
    </section>
  );
}
function Login({
  onClose,
  login,
}: {
  onClose: () => void;
  login: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title={practice ? "Practice admin desk" : "Welcome to the admin desk"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await login(password);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to sign in.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="muted">
          {practice
            ? "Try scoring, create tournaments, and arrange brackets. Changes stay on this device."
            : "Enter the shared admin password to manage tournaments and score bouts."}
        </p>
        {!practice && (
          <label className="field">
            Admin password
            <input
              autoFocus
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {error && <Message>{error}</Message>}
        <button className="primary full" disabled={busy}>
          {busy ? "Signing in…" : practice ? "Enter practice desk" : "Sign in"}
          <ArrowRight size={17} />
        </button>
      </form>
    </Modal>
  );
}
function Create({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: unknown) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [weapon, setWeapon] = useState("Longsword");
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [names, setNames] = useState("");
  const [count, setCount] = useState(1);
  const [people, setPeople] = useState<{ name: string; pool: number }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function next() {
    const list = names
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!name.trim() || !date || !weapon.trim()) {
      setError("Enter a tournament name, weapon, and date.");
      return;
    }
    if (list.length < 2 || list.length > 24) {
      setError("Enter between 2 and 24 participant names, one per line.");
      return;
    }
    if (list.some((n) => n.length > 60)) {
      setError("Participant names must be 60 characters or fewer.");
      return;
    }
    setPeople(list.map((name) => ({ name, pool: 0 })));
    setCount(1);
    setError("");
    setStep(2);
  }
  function assign(n: number, shuffle = false) {
    const updated = [...people];
    if (shuffle)
      for (let i = updated.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [updated[i], updated[j]] = [updated[j], updated[i]];
      }
    setCount(n);
    setPeople(updated.map((p, i) => ({ ...p, pool: i % n })));
  }
  const sizes = Array.from(
    { length: count },
    (_, i) => people.filter((p) => p.pool === i).length,
  );
  const bouts = sizes.reduce((s, n) => s + (n * (n - 1)) / 2, 0);
  return (
    <Modal title="Create a tournament" onClose={onClose} wide>
      <div className="wizard-steps">
        <span className={step === 1 ? "active" : ""}>01 · The field</span>
        <span className={step === 2 ? "active" : ""}>
          02 · Pools & pairings
        </span>
      </div>
      {step === 1 ? (
        <>
          <div className="form-grid">
            <label className="field span-two">
              Tournament name
              <input
                autoFocus
                placeholder="e.g. Autumn Longsword Open"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              Weapon
              <input
                maxLength={60}
                value={weapon}
                onChange={(e) => setWeapon(e.target.value)}
              />
            </label>
            <label className="field">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <label className="field">
            Participants{" "}
            <span className="muted small">
              One name per line · 2–24 fencers
            </span>
            <textarea
              rows={8}
              placeholder={"Alex Morgan\nJordan Lee\nSasha Reyes"}
              value={names}
              onChange={(e) => setNames(e.target.value)}
            />
          </label>
          {error && <Message>{error}</Message>}
          <button className="primary full" onClick={next}>
            Arrange pools <ArrowRight size={17} />
          </button>
        </>
      ) : (
        <>
          <div className="section-heading">
            <label className="field">
              Number of pools
              <select
                value={count}
                onChange={(e) => assign(Number(e.target.value))}
              >
                {Array.from(
                  { length: Math.floor(people.length / 2) },
                  (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1} {i ? "pools" : "pool"}
                    </option>
                  ),
                )}
              </select>
            </label>
            <button className="secondary" onClick={() => assign(count, true)}>
              <Shuffle size={16} />
              Shuffle assignments
            </button>
          </div>
          <div className="assignment-list">
            {people.map((p, i) => (
              <label key={i} className="assignment">
                <span>{p.name}</span>
                <select
                  aria-label={`Pool for ${p.name}`}
                  value={p.pool}
                  onChange={(e) =>
                    setPeople(
                      people.map((person, j) =>
                        j === i
                          ? { ...person, pool: Number(e.target.value) }
                          : person,
                      ),
                    )
                  }
                >
                  {Array.from({ length: count }, (_, n) => (
                    <option key={n} value={n}>
                      Pool {poolName(n)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="notice">
            <Swords size={20} />
            <span>
              <strong>
                {people.length} fencers · {count} pools · {bouts} round-robin
                bouts
              </strong>
              <br />
              Each fencer meets everyone in their pool. Choose elimination
              qualifiers later.
            </span>
          </div>
          {sizes.some((n) => n < 2) && (
            <Message>Each pool needs at least two fencers.</Message>
          )}
          {error && <Message>{error}</Message>}
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              className="primary"
              disabled={busy || sizes.some((n) => n < 2)}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await onCreate({
                    name,
                    weapon,
                    date,
                    participants: people,
                    poolCount: count,
                  });
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Unable to create.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Creating…" : "Create & generate matches"}
              <Check size={17} />
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
function Scoring({
  t,
  m,
  admin,
  busy,
  error,
  onClose,
  execute,
}: {
  t: Tournament;
  m: Match;
  admin: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  execute: (c: Command) => Promise<void>;
}) {
  const [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState(false);
  const [seconds, setSeconds] = useState("");
  const [adjust, setAdjust] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const editable = admin && m.status !== "finished" && m.status !== "bye";
  const result =
    m.scoreA === m.scoreB ? "draw" : m.scoreA > m.scoreB ? "a" : "b";
  const send = (c: Command) => void execute(c).catch(() => {});
  return (
    <Modal
      title={
        m.stage === "pools"
          ? `Pool ${poolName(m.pool)} · Bout ${t.matches.indexOf(m) + 1}`
          : `Elimination · Round ${m.round}`
      }
      onClose={onClose}
      wide
    >
      <div className="score-meta">
        <Status status={m.status} />
        <span className="muted small">
          {t.weapon} / {t.name}
        </span>
      </div>
      <div className="scoreboard">
        {(["a", "b"] as const).map((side) => (
          <div className={`score-side ${side}`} key={side}>
            <span className="competitor-label">
              {side === "a" ? "BURGUNDY" : "BLUE"}
            </span>
            <h3>{nameOf(t, m[side])}</h3>
            <strong className="big-score">
              {side === "a" ? m.scoreA : m.scoreB}
            </strong>
            {editable && (
              <div className="score-controls">
                <button
                  aria-label={`Subtract point from ${nameOf(t, m[side])}`}
                  disabled={busy || (side === "a" ? m.scoreA : m.scoreB) === 0}
                  onClick={() =>
                    send({ type: "score", matchId: m.id, side, delta: -1 })
                  }
                >
                  <Minus size={16} />
                </button>
                {[1, 2, 3].map((delta) => (
                  <button
                    key={delta}
                    aria-label={`Add ${delta} to ${nameOf(t, m[side])}`}
                    disabled={busy}
                    onClick={() =>
                      send({ type: "score", matchId: m.id, side, delta })
                    }
                  >
                    +{delta}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="timer-block">
        <span className="eyebrow">ELAPSED TIME</span>
        <div className="timer-number">
          {formatTime(elapsed(m, now))}
          {m.startedAt !== null && <span className="timer-running" />}
        </div>
        {editable && (
          <div className="timer-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                send({
                  type: "timer",
                  matchId: m.id,
                  action: m.startedAt === null ? "start" : "pause",
                })
              }
            >
              {m.startedAt === null ? <Play size={15} /> : <Pause size={15} />}{" "}
              {m.startedAt === null ? "Start timer" : "Pause timer"}
            </button>
            <button
              className="text-link"
              onClick={() => {
                setSeconds(String(Math.floor(elapsed(m, now) / 1000)));
                setAdjust(!adjust);
              }}
            >
              Adjust time
            </button>
          </div>
        )}
        {adjust && editable && (
          <form
            className="time-adjust"
            onSubmit={(e) => {
              e.preventDefault();
              send({
                type: "timer",
                matchId: m.id,
                action: "adjust",
                seconds: Number(seconds),
              });
              setAdjust(false);
            }}
          >
            <label>
              Elapsed seconds
              <input
                aria-label="Elapsed seconds"
                type="number"
                min="0"
                max="86400"
                required
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
              />
            </label>
            <button className="secondary" disabled={busy}>
              Set & pause
            </button>
          </form>
        )}
      </div>
      <div className="double-bar">
        <div>
          <span className="double-value">{m.doubles}</span>
          <span>
            <strong>Double hits</strong>
            <small>Counted against both fencers</small>
          </span>
        </div>
        {editable && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => send({ type: "double", matchId: m.id })}
          >
            <Plus size={17} />
            Record double
          </button>
        )}
      </div>
      {error && <Message>{error}</Message>}
      {editable && (
        <>
          <div className="scoring-actions">
            <button
              className="text-link"
              disabled={busy || !m.events.length}
              onClick={() => send({ type: "undo", matchId: m.id })}
            >
              <RotateCcw size={15} />
              Undo last score action
            </button>
            <span className="save-state">
              {busy ? (
                "Saving…"
              ) : (
                <>
                  <Check size={14} />
                  Saved
                </>
              )}
            </span>
          </div>
          {confirm ? (
            <div className="confirm-result">
              <h3>
                {result === "draw"
                  ? "Confirm draw"
                  : `${nameOf(t, result === "a" ? m.a : m.b)} wins`}
              </h3>
              <p>
                {m.scoreA} – {m.scoreB} · {m.doubles} doubles. Submit to make
                this result official.
              </p>
              {m.stage === "bracket" && result === "draw" ? (
                <Message>
                  Elimination needs a winner. Continue scoring or adjust the
                  scores before submitting.
                </Message>
              ) : (
                <button
                  className="primary full"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await execute({ type: "submit", matchId: m.id, result });
                      setConfirm(false);
                    } catch {}
                  }}
                >
                  Confirm & submit result <Check size={17} />
                </button>
              )}
              <button className="text-link" onClick={() => setConfirm(false)}>
                Continue scoring
              </button>
            </div>
          ) : (
            <button
              className="primary full"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              Finish match <ArrowRight size={17} />
            </button>
          )}
        </>
      )}
      {m.status === "finished" && (
        <div className="result-banner">
          <Trophy size={23} />
          <strong>
            {m.result === "draw"
              ? "Match drawn"
              : `${nameOf(t, winner(m))} wins`}
          </strong>
          {admin && (m.stage === "pools" || m.round === t.bracketRound) && (
            <button
              className="text-link"
              disabled={busy}
              onClick={() => send({ type: "reopen", matchId: m.id })}
            >
              Reopen to correct
            </button>
          )}
        </div>
      )}
      {m.events.length > 0 && (
        <details className="event-history">
          <summary>
            Recent scoring history · last {m.events.length} actions
          </summary>
          <ol>
            {[...m.events].reverse().map((e, i) => (
              <li key={i}>
                <span>
                  {e.kind === "double"
                    ? "Double hit · both fencers"
                    : `${e.delta > 0 ? "+" : ""}${e.delta} · ${nameOf(t, e.side === "a" ? m.a : m.b)}`}
                </span>
                <time>
                  {new Date(e.at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ol>
        </details>
      )}
      {!admin && (
        <p className="muted small centered">
          Live scores update automatically. Only submitted results count in
          standings.
        </p>
      )}
    </Modal>
  );
}
