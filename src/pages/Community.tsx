/**
 * Bulshada — the open community group. Anyone can join, so the invite link
 * lives here in code (unlike the buyers-only course groups in the database).
 * If the link is emptied, the button shows "Dhawaan" instead.
 */
const COMMUNITY_URL = "https://chat.whatsapp.com/CWHSPnKjH0DEb2uF0gsgU8";

const PERKS = [
  { icon: "💬", title: "Wada sheekayso", text: "La kulan dadka kale ee jecel tech-ka." },
  { icon: "🙋", title: "Weydii su'aalo", text: "Hel caawimaad marka aad meel ku xayirantahay." },
  { icon: "🚀", title: "La wadaag shaqadaada", text: "Tus app-ka ama website-ka aad dhisay." },
  { icon: "📣", title: "Wararka cusub", text: "Ogow koorsooyinka iyo casharrada cusub." },
];

const RULES = [
  "Ixtiraam qof walba.",
  "Xayeysiis iyo spam ma jiro.",
  "Ka hadal tech, apps iyo websites.",
];

const WA_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2.1.7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.6-.4z" />
  </svg>
);

export default function Community() {
  return (
    <div className="rd cm">
      <section className="cm-hero">
        <span className="cm-icon">{WA_ICON}</span>
        <h1>Bulshada BulbulCourses</h1>
        <p>
          Meel ay isugu yimaadaan dadka jecel inay dhisaan apps iyo websites.
          Qof walba waa soo dhaweyn yahay, bilaash.
        </p>
        {COMMUNITY_URL ? (
          <a className="cm-join" href={COMMUNITY_URL} target="_blank" rel="noreferrer">
            {WA_ICON}
            Ku biir group-ka WhatsApp
          </a>
        ) : (
          <span className="cm-join cm-join-soon">Dhawaan</span>
        )}
      </section>

      <section className="rd-section">
        <div className="cm-perks">
          {PERKS.map((p) => (
            <div key={p.title} className="cm-perk">
              <b aria-hidden>{p.icon}</b>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rd-section">
        <div className="cm-rules">
          <h2>Xeerarka group-ka</h2>
          <ul>
            {RULES.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      </section>
    </div>
  );
}
