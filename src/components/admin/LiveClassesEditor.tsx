import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LiveService, formatSessionWhen, isSessionPast } from "../../services/live.service";
import Spinner from "../Spinner";
import ErrorMessage from "../ErrorMessage";
import type { LiveSession } from "../../types/db";

/** <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm" in LOCAL time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Local "YYYY-MM-DDTHH:mm" back to a UTC ISO string for the database. */
function fromLocalInput(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function emptyDraft() {
  return { title: "", description: "", starts_at: "", ends_at: "" };
}

export default function LiveClassesEditor({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [waSaved, setWaSaved] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["live-sessions", courseId],
    queryFn: () => LiveService.sessions(courseId),
  });

  const waQuery = useQuery({
    queryKey: ["live-whatsapp", courseId],
    queryFn: () => LiveService.whatsappUrl(courseId),
  });

  const buyersQuery = useQuery({
    queryKey: ["course-buyers", courseId],
    queryFn: () => LiveService.buyers(courseId),
  });

  function refreshSessions() {
    void queryClient.invalidateQueries({ queryKey: ["live-sessions", courseId] });
  }

  const saveSession = useMutation({
    mutationFn: async () => {
      const starts = fromLocalInput(draft.starts_at);
      if (!starts) throw new Error("Geli taariikhda iyo saacadda fasalka.");
      const ends = fromLocalInput(draft.ends_at);
      if (ends && ends <= starts) {
        throw new Error("Saacadda dhammaadka waa inay ka danbeysaa bilowga.");
      }
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        starts_at: starts,
        ends_at: ends,
      };
      if (!payload.title) throw new Error("Geli magaca fasalka.");
      return editingId
        ? LiveService.updateSession(editingId, payload)
        : LiveService.createSession(courseId, payload);
    },
    onSuccess: () => {
      setDraft(emptyDraft());
      setEditingId(null);
      setFormError(null);
      refreshSessions();
    },
    onError: (e) =>
      setFormError(e instanceof Error ? e.message : "Could not save the class."),
  });

  const removeSession = useMutation({
    mutationFn: (id: string) => LiveService.deleteSession(id),
    onSuccess: refreshSessions,
  });

  const saveWhatsapp = useMutation({
    mutationFn: (url: string) => LiveService.saveWhatsappUrl(courseId, url),
    onSuccess: () => {
      setWaSaved(true);
      setWaError(null);
      void queryClient.invalidateQueries({ queryKey: ["live-whatsapp", courseId] });
    },
    onError: (e) =>
      setWaError(e instanceof Error ? e.message : "Could not save the link."),
  });

  function startEdit(session: LiveSession) {
    setEditingId(session.id);
    setFormError(null);
    setDraft({
      title: session.title,
      description: session.description,
      starts_at: toLocalInput(session.starts_at),
      ends_at: toLocalInput(session.ends_at),
    });
  }

  const sessions = sessionsQuery.data ?? [];
  const buyers = buyersQuery.data ?? [];
  // waUrl is local edit state; fall back to whatever the server has.
  const waValue = waUrl ?? waQuery.data ?? "";
  const waLooksValid =
    waValue.trim() === "" || /^https:\/\/chat\.whatsapp\.com\/\S+$/i.test(waValue.trim());

  return (
    <div className="editor-panel">
      {/* ── WhatsApp group link ─────────────────────────────────────── */}
      <div className="card">
        <h3>Group-ka WhatsApp</h3>
        <p className="muted">
          Samee group WhatsApp ah taleefankaaga → <strong>Group info</strong> →{" "}
          <strong>Invite via link</strong> → <strong>Copy link</strong>, ka dibna halkan
          ku dhaji. Kaliya ardayda <strong>iibsatay</strong> ayaa arki doona.
        </p>

        <label>
          Link-ga group-ka
          <input
            type="url"
            placeholder="https://chat.whatsapp.com/..."
            value={waValue}
            onChange={(e) => {
              setWaUrl(e.target.value);
              setWaSaved(false);
            }}
          />
          {!waLooksValid && (
            <span className="field-error">
              Link-gu waa inuu ku bilowdaa https://chat.whatsapp.com/
            </span>
          )}
        </label>

        {waError && <div className="error-box">{waError}</div>}
        {waSaved && <div className="success-box">Link-ga waa la keydiyay.</div>}

        <button
          type="button"
          className="btn btn-primary"
          disabled={!waLooksValid || saveWhatsapp.isPending}
          onClick={() => saveWhatsapp.mutate(waValue)}
        >
          {saveWhatsapp.isPending ? "Keydinaya…" : "Keydi link-ga"}
        </button>

        <div className="wa-warning">
          <strong>⚠️ Muhiim:</strong> WhatsApp-ka ka shid{" "}
          <strong>"Approve new participants"</strong>. Haddii kale arday kasta wuu u
          dirsan karaa link-ga saaxiibbadiis, oo bilaash bay u soo geli doonaan.
        </div>
      </div>

      {/* ── Class schedule ──────────────────────────────────────────── */}
      <div className="card">
        <h3>Fasallada — jadwalka</h3>
        <p className="muted">
          Fasal kasta taariikhdiisa iyo mowduuciisa. Ardayda ayaa arki doona jadwalkan
          <strong> ka hor</strong> inta aysan iibsan — taasi waa waxa iibinaysa koorsada.
        </p>

        {sessionsQuery.isPending ? (
          <Spinner label="Loading classes…" />
        ) : sessionsQuery.isError ? (
          <ErrorMessage
            error={sessionsQuery.error}
            onRetry={() => sessionsQuery.refetch()}
          />
        ) : sessions.length === 0 ? (
          <p className="muted">Wali fasal lama darin.</p>
        ) : (
          <ul className="live-admin-list">
            {sessions.map((s, i) => (
              <li key={s.id} className={isSessionPast(s) ? "is-past" : ""}>
                <span className="live-admin-n">{i + 1}</span>
                <div className="live-admin-body">
                  <strong>{s.title}</strong>
                  {s.description && <p className="muted">{s.description}</p>}
                  <span className="live-admin-when">{formatSessionWhen(s)}</span>
                </div>
                <div className="live-admin-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => startEdit(s)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={removeSession.isPending}
                    onClick={() => {
                      if (window.confirm(`Tirtir fasalka "${s.title}"?`)) {
                        removeSession.mutate(s.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {removeSession.isError && <ErrorMessage error={removeSession.error} />}

        <div className="live-session-form">
          <h4>{editingId ? "Wax ka beddel fasalka" : "Ku dar fasal cusub"}</h4>
          {formError && <div className="error-box">{formError}</div>}

          <label>
            Magaca fasalka
            <input
              type="text"
              placeholder="tusaale: React Components"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>

          <label>
            Mowduuca (ikhtiyaari)
            <input
              type="text"
              placeholder="Waxa aan baranayno maalintaas"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>

          <div className="form-row">
            <label>
              Bilowga
              <input
                type="datetime-local"
                value={draft.starts_at}
                onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}
              />
            </label>
            <label>
              Dhammaadka (ikhtiyaari)
              <input
                type="datetime-local"
                value={draft.ends_at}
                onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })}
              />
            </label>
          </div>

          <div className="live-form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={saveSession.isPending}
              onClick={() => saveSession.mutate()}
            >
              {saveSession.isPending
                ? "Keydinaya…"
                : editingId
                  ? "Keydi beddelka"
                  : "+ Ku dar fasalka"}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyDraft());
                  setFormError(null);
                }}
              >
                Jooji
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Buyer list, for WhatsApp approval ───────────────────────── */}
      <div className="card">
        <h3>Ardayda iibsatay ({buyers.length})</h3>
        <p className="muted">
          Marka qof codsado inuu ku soo biiro group-ka, lambarkiisa halkan ka hubi. Haddii
          uusan liiskan ku jirin — ma bixin lacagta.
        </p>

        {buyersQuery.isPending ? (
          <Spinner label="Loading buyers…" />
        ) : buyersQuery.isError ? (
          <ErrorMessage error={buyersQuery.error} onRetry={() => buyersQuery.refetch()} />
        ) : buyers.length === 0 ? (
          <p className="muted">Wali cidna ma iibsan koorsadan.</p>
        ) : (
          <div className="buyers-table-wrap">
            <table className="buyers-table">
              <thead>
                <tr>
                  <th>Magaca</th>
                  <th>Lambarka</th>
                  <th>Taariikhda</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map((b) => (
                  <tr key={b.purchase_id}>
                    <td>{b.full_name}</td>
                    <td className="buyer-phone">{b.phone_number ?? "—"}</td>
                    <td className="muted">
                      {new Date(b.created_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
