import { useQuery } from "@tanstack/react-query";
import { WhatsAppService } from "../services/whatsapp.service";

const ICON = (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2.1.7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.6-.4z" />
  </svg>
);

/**
 * Everyone sees that the course has a WhatsApp group; only buyers (and the
 * admin) can read the invite link, so only they get a working button.
 */
export default function WhatsAppGroup({
  courseId,
  canJoin,
  onBuy,
}: {
  courseId: string;
  canJoin: boolean;
  onBuy: () => void;
}) {
  const linkQuery = useQuery({
    queryKey: ["whatsapp", courseId],
    queryFn: () => WhatsAppService.linkFor(courseId),
    enabled: canJoin,
  });

  return (
    <div className="rd-wa">
      <span className="rd-wa-icon">{ICON}</span>
      <div className="rd-wa-text">
        <b>Group-ka WhatsApp ee ardayda</b>
        <span>
          {canJoin
            ? "Ku biir ardayda kale, weydii su'aalo, hel war cusub."
            : "Kaliya ardayda iibsatay koorsada ayaa ku biiri kara."}
        </span>
      </div>
      {canJoin ? (
        linkQuery.data ? (
          <a className="rd-wa-btn" href={linkQuery.data} target="_blank" rel="noreferrer">
            Ku biir
          </a>
        ) : (
          <span className="rd-wa-soon">{linkQuery.isPending ? "…" : "Dhawaan"}</span>
        )
      ) : (
        <button type="button" className="rd-wa-btn rd-wa-locked" onClick={onBuy}>
          🔒 Iibso si aad ugu biirto
        </button>
      )}
    </div>
  );
}
