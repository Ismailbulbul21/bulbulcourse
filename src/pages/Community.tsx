/**
 * Bulshada — the open community group. Anyone can join, so the invite link
 * lives here in code (unlike the buyers-only course groups in the database).
 * If the link is emptied, the join buttons show "Dhawaan" instead.
 */
import type { CSSProperties } from "react";

const COMMUNITY_URL = "https://chat.whatsapp.com/CWHSPnKjH0DEb2uF0gsgU8";

const PERKS = [
  { icon: "🙋", color: "109 74 255", title: "Su'aal weydii" },
  { icon: "🛠️", color: "245 140 20", title: "Caawimaad hel" },
  { icon: "🚀", color: "37 132 255", title: "Shaqadaada tus" },
  { icon: "🤖", color: "16 170 120", title: "Wararka AI" },
];

const RULES = ["Is ixtiraam", "Xayeysiis ma jiro", "Tech oo kaliya"];

const WA_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2.1.7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.6-.4z" />
  </svg>
);

function JoinButton() {
  return COMMUNITY_URL ? (
    <a className="cm-join" href={COMMUNITY_URL} target="_blank" rel="noreferrer">
      {WA_ICON}
      Ku biir Group-ka
    </a>
  ) : (
    <span className="cm-join cm-join-soon">Dhawaan</span>
  );
}

export default function Community() {
  return (
    <div className="rd cm">
      <section className="cm-hero">
        <span className="cm-glow" aria-hidden />
        <div className="cm-hero-text">
          <span className="cm-eyebrow"><i />Group WhatsApp · Bilaash</span>
          <h1>Kaligaa ha baran. <em>Nagu soo biir.</em></h1>
          <p>Group bilaash ah oo lagu barto apps, websites iyo AI.</p>
          <JoinButton />
        </div>

        <div className="cm-chat" aria-hidden>
          <div className="cm-chat-head">
            <span className="cm-chat-avatar">{WA_ICON}</span>
            <div>
              <b>Bulshada BulbulCourses</b>
              <span>Waxa lagu wada hadlo</span>
            </div>
          </div>
          <div className="cm-chat-body">
            <p className="cm-bubble">Node.js sideen u rakibaa?</p>
            <p className="cm-bubble cm-bubble-me">Casharka 1aad eeg 👍</p>
            <p className="cm-bubble">Error baa ii soo baxay 😅</p>
            <p className="cm-bubble cm-bubble-me">Claude u dir, wuu xallinayaa</p>
            <p className="cm-bubble">App-kaygii waa diyaar! 🎉</p>
          </div>
        </div>
      </section>

      <section className="rd-section">
        <div className="cm-perks">
          {PERKS.map((p) => (
            <div key={p.title} className="cm-perk" style={{ "--p": p.color } as CSSProperties}>
              <b aria-hidden>{p.icon}</b>
              <h3>{p.title}</h3>
            </div>
          ))}
        </div>
      </section>

      <section className="rd-section">
        <div className="cm-rules">
          <h2>Xeerarka</h2>
          <ul>
            {RULES.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      </section>

      <section className="rd-section">
        <div className="cm-final">
          <h2>Diyaar ma tahay?</h2>
          <JoinButton />
        </div>
      </section>
    </div>
  );
}
