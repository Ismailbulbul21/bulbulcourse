/**
 * Ku saabsan aniga — who builds BulbulCourses, and the apps already shipped.
 *
 * Static on purpose: no database, no tables, no admin screen. Editing the
 * array below is the whole workflow, so nothing here can affect courses,
 * payments or purchases.
 *
 * Kept deliberately dense: short copy, chip-style feature tags instead of
 * bullet paragraphs, tight spacing — so the page can be read without much
 * scrolling instead of unfolding into a long scroll of prose.
 *
 * The copy is Somali, and where an app already has its own Somali tagline or
 * names its own features, those exact words are used rather than a fresh
 * translation — so a card reads the way the app itself reads.
 *
 * Each app carries its own brand colour, passed to CSS as --accent, so a
 * card is tinted by the app it is describing rather than by the site.
 */
import type { CSSProperties } from "react";

/** Shown in the hero. Change these lines to change it everywhere. */
const ME = {
  name: "Ismail Bulbul",
  role: "Horumariye Mobile Apps & Websites",
  place: "Muqdisho, Soomaaliya",
  education: "SIMAD University",
  email: "ismailbulbul381@gmail.com",
};

type App = {
  name: string;
  tagline: string;
  /** One short sentence — not a paragraph. */
  what: string;
  /** Short tags (2-4 words), not sentences — rendered as chips, not a bullet list. */
  features: string[];
  /** Real launcher icon, resized to 256px — see public/apps/. */
  icon: string;
  /** RGB triple from the app's own icon. Not hex: it is used inside rgb() with an alpha. */
  accent: string;
  /** Left out when the app has no public listing yet. */
  store?: { label: string; url: string };
  status?: string;
};

const APPS: App[] = [
  {
    name: "Qorsheyn",
    tagline: "Qorshaha maalinlaha ah, dhammaantii af Soomaali ku qoran",
    icon: "/apps/qorsheyn.png",
    accent: "108 59 214",
    what: "Qorshaha maalinlaha ah — hawl, hadaf iyo xusuusin, dhammaantii af Soomaali ah.",
    features: ["Hawlaha Maanta", "Hadafyo & Xusuusin", "Waqti Feejignaan", "EVC · ZAAD · Sahal"],
    store: {
      label: "Google Play",
      url: "https://play.google.com/store/apps/details?id=com.productivityapp.abaabulka",
    },
  },
  {
    name: "Socod",
    tagline: "Ku socod. Ku tartam. Ku guuleyso.",
    icon: "/apps/socod.png",
    accent: "70 24 146",
    what: "Tallaabooyinkaaga si toos ah buu u tiriyaa, kuna tartamaa saaxiibadaa.",
    features: ["Tallaabo Toos ah", "Liis Hogaamin", "Kooxo", "Calaamado"],
    store: {
      label: "Google Play",
      url: "https://play.google.com/store/apps/details?id=com.socodapp.walking",
    },
  },
  {
    name: "JirDhis",
    tagline: "Jimicsi guriga iyo gym, Soomaali ku qoran",
    icon: "/apps/jirdhis.png",
    accent: "11 91 245",
    what: "In ka badan 150 jimicsi, Soomaali ku sharraxan, muuqaal la socda.",
    features: ["150+ Jimicsi", "8 Qaybood", "Guri iyo Gym", "Muuqaal + Animation"],
  },
  {
    name: "Baro-Ai",
    tagline: "Casharradaada u beddel hab waxbarasho",
    icon: "/apps/baro-ai.png",
    accent: "22 163 74",
    what: "PDF, sawir ama qoraal — wuxuu kaaga dhigaa hage, kaarar iyo imtixaan.",
    features: ["Guudmar", "Macallin AI", "Kaarka", "Imtixaan", "Cod"],
    status: "Dhawaan",
  },
];

export default function About() {
  return (
    <div className="page about-page">
      <section className="about-hero">
        <div className="about-glow" aria-hidden="true" />
        <p className="about-eyebrow">Ku saabsan aniga</p>
        <h1 className="about-name">{ME.name}</h1>
        <div className="about-pills">
          <span className="about-pill">{ME.role}</span>
          <span className="about-pill">{ME.place}</span>
          <span className="about-pill">{ME.education}</span>
        </div>
        <p className="about-lead">
          Waxaan sameeyaa mobile apps iyo websites, waxaanan ka qalin-jebiyay
          Jaamacadda SIMAD.
        </p>
      </section>

      <section className="about-section">
        <h2 className="about-h2">Apps-ka aan sameeyay</h2>
        <div className="about-apps">
          {APPS.map((app) => (
            <article
              key={app.name}
              className="app-card"
              style={{ "--accent": app.accent } as CSSProperties}
            >
              <div className="app-card-wash" aria-hidden="true" />

              <header className="app-card-top">
                <img
                  className="app-icon"
                  src={app.icon}
                  alt={`Astaanta appka ${app.name}`}
                  width={56}
                  height={56}
                  loading="lazy"
                />
                <div className="app-id">
                  <h3 className="app-name">{app.name}</h3>
                  <p className="app-tagline">{app.tagline}</p>
                </div>
                {app.status && <span className="app-status">{app.status}</span>}
              </header>

              <p className="app-what">{app.what}</p>

              <div className="app-chips">
                {app.features.map((f) => (
                  <span key={f} className="app-chip">
                    {f}
                  </span>
                ))}
              </div>

              {app.store && (
                <a
                  className="app-store"
                  href={app.store.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ka soo deji {app.store.label}
                  <span aria-hidden="true">→</span>
                </a>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="about-section">
        <div className="about-bottom">
          <div className="about-platform">
            <h2>BulbulCourses</h2>
            <p>
              Meesha aan ku baro waxa aan aqaano — koorsooyin af Soomaali ah,
              lagu iibsado lacagta mobilada, kuuna xasuusta meeshii aad ka
              joogsatay.
            </p>
          </div>
          <div className="about-contact">
            <h2>Ila soo xiriir</h2>
            <p>Ma waxaad dhisaysaa wax, mise su'aal ayaad qabtaa?</p>
            <a className="about-mail" href={`mailto:${ME.email}`}>
              {ME.email}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
