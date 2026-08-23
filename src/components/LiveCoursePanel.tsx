import { useQuery } from "@tanstack/react-query";
import {
  LiveService,
  formatSessionWhen,
  isSessionPast,
} from "../services/live.service";
import Spinner from "./Spinner";
import ErrorMessage from "./ErrorMessage";

/**
 * The class schedule of a live course. Public — this is what sells the
 * course, so it renders for visitors who have not bought (and have not
 * even logged in).
 */
export function LiveSchedule({ courseId }: { courseId: string }) {
  const sessionsQuery = useQuery({
    queryKey: ["live-sessions", courseId],
    queryFn: () => LiveService.sessions(courseId),
  });

  if (sessionsQuery.isPending) return <Spinner label="Loading classes…" />;
  if (sessionsQuery.isError) {
    return (
      <ErrorMessage
        error={sessionsQuery.error}
        onRetry={() => sessionsQuery.refetch()}
      />
    );
  }

  const sessions = sessionsQuery.data;
  if (sessions.length === 0) {
    return <p className="muted">Jadwalka fasallada ayaa dhawaan la soo bandhigi doonaa.</p>;
  }

  return (
    <ol className="live-schedule">
      {sessions.map((s, i) => {
        const past = isSessionPast(s);
        return (
          <li key={s.id} className={past ? "live-row is-past" : "live-row"}>
            <span className="live-row-n" aria-hidden>
              {past ? "✓" : i + 1}
            </span>
            <div className="live-row-body">
              <strong className="live-row-title">{s.title}</strong>
              {s.description && <p className="live-row-desc">{s.description}</p>}
            </div>
            <span className="live-row-when">
              {formatSessionWhen(s)}
              {past && <span className="live-row-done">Dhammaaday</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The WhatsApp group button, shown once someone owns the course.
 *
 * Security note: this does not decide entitlement. The link row is
 * protected by RLS, so a non-buyer calling the same query gets nothing
 * back — the button simply has no link to render.
 */
export function WhatsappJoinCard({ courseId }: { courseId: string }) {
  const waQuery = useQuery({
    queryKey: ["live-whatsapp", courseId],
    queryFn: () => LiveService.whatsappUrl(courseId),
  });

  if (waQuery.isPending) return <Spinner label="Loading…" />;

  if (waQuery.isError) {
    return <ErrorMessage error={waQuery.error} onRetry={() => waQuery.refetch()} />;
  }

  const url = waQuery.data;

  if (!url) {
    return (
      <div className="wa-pending">
        <strong>Group-ka wali lama diyaarin</strong>
        <p className="muted">
          Macallinku wuxuu dhawaan halkan ku dari doonaa link-ga group-ka WhatsApp.
          Soo laabo mar kale.
        </p>
      </div>
    );
  }

  return (
    <div className="wa-join">
      <a
        className="btn btn-whatsapp btn-lg btn-block"
        href={url}
        target="_blank"
        rel="noreferrer noopener"
      >
        <span aria-hidden>💬</span> Ku biir group-ka WhatsApp
      </a>
      <p className="wa-join-note">
        Fasalladu waxay ka dhacaan group-kan. Macallinku halkaas ayuu ku soo dirayaa
        link-ga fasalka mar kasta oo uu bilaabmayo.
      </p>
    </div>
  );
}
