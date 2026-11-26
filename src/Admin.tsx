import { useState } from "react";
import { ArrowRight, CalendarDays, Plus, Search, Users } from "lucide-react";
import {
  formatLabels,
  poolMembershipLocked,
  type FencerProfile,
  type ProfileMutation,
  type Tournament,
} from "../shared/domain";

export function adminTournamentAction(t: Tournament) {
  if (t.archivedAt)
    return { stage: "Archived", action: "View results", tab: "overview" };
  const final = t.matches.find(
    (m) =>
      m.stage === "bracket" && m.round === Math.log2(t.bracketSeeds.length),
  );
  if (
    final?.status === "finished" ||
    (t.format === "pools-only" &&
      t.matches.length > 0 &&
      t.matches.every((m) => m.status === "finished"))
  )
    return { stage: "Completed", action: "View results", tab: "standings" };
  if (!t.matches.length)
    return t.poolCount > 0
      ? { stage: "Pools saved", action: "Review pools", tab: "preparation" }
      : { stage: "Draft", action: "Continue preparation", tab: "preparation" };
  if (!t.bracketRound && t.matches.every((m) => m.status === "finished"))
    return {
      stage: "Pools complete",
      action: "Select qualifiers",
      tab: "bracket",
    };
  return poolMembershipLocked(t)
    ? { stage: "In progress", action: "Open matches", tab: "matches" }
    : { stage: "Scheduled", action: "Open matches", tab: "matches" };
}

export function AdminDashboard({
  tournaments,
  loading,
  error,
  onCreate,
  onOpen,
}: {
  tournaments: Tournament[];
  loading: boolean;
  error: string;
  onCreate: () => void;
  onOpen: (id: string, tab: string) => void;
}) {
  const [archiveView, setArchiveView] = useState("active");
  const [search, setSearch] = useState("");
  const rows = tournaments.filter(
    (t) =>
      (archiveView === "archived" ? !!t.archivedAt : !t.archivedAt) &&
      t.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <section className="admin-workspace">
      <div className="section-heading admin-heading">
        <div>
          <span className="eyebrow">ADMIN DESK</span>
          <h1>Tournaments</h1>
          <p className="muted">
            Prepare the field and keep the competition moving.
          </p>
        </div>
        <button className="primary" onClick={onCreate}>
          <Plus size={18} />
          Create tournament
        </button>
      </div>
      <div className="admin-toolbar">
        <label className="admin-search">
          <Search size={18} />
          <input
            aria-label="Search tournaments"
            placeholder="Search tournaments"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Tournament archive view"
          value={archiveView}
          onChange={(e) => setArchiveView(e.target.value)}
        >
          <option value="active">Active tournaments</option>
          <option value="archived">Archived tournaments</option>
        </select>
      </div>
      {error && (
        <p className="message" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="empty" role="status">
          Loading tournaments…
        </div>
      ) : rows.length ? (
        <div className="admin-event-list">
          {rows.map((t) => {
            const next = adminTournamentAction(t);
            const completed = t.matches.filter(
              (m) => m.status === "finished" || m.status === "bye",
            ).length;
            return (
              <article className="panel admin-event" key={t.id}>
                <div className="admin-event-details">
                  <span className="admin-stage">{next.stage}</span>
                  <h2>{t.name}</h2>
                  <div className="card-meta">
                    <span>
                      <CalendarDays size={15} />
                      {t.date}
                    </span>
                    <span>
                      <Users size={15} />
                      {t.participants.length}{" "}
                      {t.participants.length === 1 ? "fencer" : "fencers"}
                    </span>
                  </div>
                  <p className="muted small">
                    {t.weapon} ·{" "}
                    {formatLabels[t.format ?? "pools-and-elimination"]}
                  </p>
                </div>
                <div className="admin-event-action">
                  {t.matches.length > 0 && (
                    <div>
                      <span className="small muted">
                        {completed} of {t.matches.length} bouts completed
                      </span>
                      <progress
                        aria-label={"Bout progress for " + t.name}
                        max={t.matches.length}
                        value={completed}
                      />
                    </div>
                  )}
                  <button
                    className="secondary"
                    aria-label={next.action + " for " + t.name}
                    onClick={() => onOpen(t.id, next.tab)}
                  >
                    {next.action}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <h2>
            {search
              ? "No tournaments match your search."
              : archiveView === "archived"
                ? "No archived tournaments."
                : "Create your first tournament."}
          </h2>
        </div>
      )}
    </section>
  );
}

export function Fencers({
  profiles,
  loading,
  error,
  save,
}: {
  profiles: FencerProfile[];
  loading: boolean;
  error: string;
  save: (command: ProfileMutation) => Promise<string>;
}) {
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{
    profile: FencerProfile | null;
    name: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [status, setStatus] = useState("");
  const rows = profiles
    .filter((p) =>
      (p.name + " " + p.id)
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  function edit(profile: FencerProfile | null) {
    setEditor({ profile, name: profile?.name ?? "" });
    setSaveError("");
    setStatus("");
  }
  return (
    <section className="admin-workspace">
      <div className="section-heading admin-heading">
        <div>
          <span className="eyebrow">ADMIN DESK</span>
          <h1>Fencers</h1>
          <p className="muted">
            Manage the profiles used across your tournaments.
          </p>
        </div>
        <button className="primary" disabled={busy} onClick={() => edit(null)}>
          <Plus size={18} />
          Create fencer
        </button>
      </div>
      {editor && (
        <form
          className="panel profile-editor"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setSaveError("");
            try {
              await save(
                editor.profile
                  ? {
                      type: "rename",
                      id: editor.profile.id,
                      expectedName: editor.profile.name,
                      name: editor.name,
                    }
                  : { type: "create", name: editor.name },
              );
              setStatus(
                editor.profile
                  ? "Profile name saved."
                  : "Fencer profile created.",
              );
              setSearch("");
              setEditor(null);
            } catch (error) {
              setSaveError(
                error instanceof Error
                  ? error.message
                  : "Unable to save profile.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>
            {editor.profile ? "Edit profile name" : "Create fencer profile"}
          </h2>
          <p className="muted">
            {editor.profile
              ? "This name will be used for future tournament entries. Use Correct name in tournament preparation to change an event name."
              : "Enter the name you want to use when adding this fencer to tournaments."}
          </p>
          <label className="field">
            Profile name
            <input
              autoFocus
              required
              maxLength={60}
              value={editor.name}
              disabled={busy}
              onChange={(e) => setEditor({ ...editor, name: e.target.value })}
            />
          </label>
          {saveError && (
            <p className="message" role="alert">
              {saveError}
            </p>
          )}
          <div className="profile-actions">
            <button
              className="secondary"
              disabled={busy}
              type="button"
              onClick={() => setEditor(null)}
            >
              Cancel
            </button>
            <button className="primary" disabled={busy || !editor.name.trim()}>
              {busy ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      )}
      <div className="admin-toolbar">
        <label className="admin-search">
          <Search size={18} />
          <input
            aria-label="Search fencers"
            placeholder="Search by name or profile ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span className="muted">
          {profiles.length} {profiles.length === 1 ? "profile" : "profiles"}
        </span>
      </div>
      {status && <p role="status">{status}</p>}
      {error && (
        <p className="message" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="empty" role="status">
          Loading fencers…
        </div>
      ) : rows.length ? (
        <div className="panel fencer-list">
          {rows.map((profile) => (
            <div className="fencer-row" key={profile.id}>
              <div>
                <strong>{profile.name}</strong>
                <small className="muted">Profile ID {profile.id}</small>
              </div>
              <button
                className="secondary"
                aria-label={
                  "Edit profile for " + profile.name + " " + profile.id
                }
                disabled={busy}
                onClick={() => edit(profile)}
              >
                Edit name
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          <h2>
            {search
              ? "No fencers match your search."
              : "Create your first fencer profile."}
          </h2>
          {!search && <p>Add profiles here or while preparing a tournament.</p>}
        </div>
      )}
    </section>
  );
}
