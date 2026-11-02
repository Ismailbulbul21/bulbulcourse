/**
 * Ku saabsan aniga — who builds BulbulCourses, and the apps already shipped.
 *
 * Static on purpose: no database. Editing the arrays below is the whole
 * workflow. Download counts and ratings are Google Play's figures from
 * November 2026; update them by hand when they change.
 *
 * Each app carries its own brand colour, passed to CSS as --a, so a card is
 * tinted by the app it describes rather than by the site.
 */
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

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
  icon: string;
  /** RGB triple from the app's own icon, used inside rgb() with an alpha. */
  accent: string;
  stats: string[];
  features: string[];
  store?: string;
};

const play = (id: string) => `https://play.google.com/store/apps/details?id=${id}`;

const APPS: App[] = [
  {
    name: "Qorsheyn",
    tagline: "Qorshaha maalinlaha ah: hawl, hadaf iyo xusuusin",
    icon: "/apps/qorsheyn.png",
    accent: "108 59 214",
    stats: ["5K+ soo dejin", "4.5★"],
    features: ["Hawlaha Maanta", "Hadafyo", "Xusuusin", "Waqti Feejignaan"],
    store: play("com.productivityapp.abaabulka"),
  },
  {
    name: "JirDhis",
    tagline: "Jimicsi guriga iyo gym, Soomaali ku qoran",
    icon: "/apps/jirdhis.png",
    accent: "11 91 245",
    stats: ["1K+ soo dejin", "4.3★"],
    features: ["150+ Jimicsi", "Qorshe Toddobaadle", "Kaloori AI"],
    store: play("com.jirdhis.app"),
  },
  {
    name: "Baro-Ai",
    tagline: "Casharradaada u beddel hab waxbarasho",
    icon: "/apps/baro-ai.png",
    accent: "22 163 74",
    stats: ["Cusub"],
    features: ["Guudmar", "Macallin AI", "Kaarka", "Imtixaan"],
    store: play("so.baroai.app"),
  },
  {
    name: "BaroHub",
    tagline: "Baro Ingiriisi: koorsooyin iyo ku hadal toos ah",
    icon: "/apps/barohub.png",
    accent: "20 150 220",
    stats: ["1K+ soo dejin", "5.0★"],
    features: ["Koorsooyin", "Imtixaan", "Hadal Toos ah", "EVC · ZAAD"],
    store: play("com.barohub.app"),
  },
  {
    name: "Socod",
    tagline: "Ku socod. Ku tartam. Ku guuleyso.",
    icon: "/apps/socod.png",
    accent: "92 38 170",
    stats: ["500+ soo dejin"],
    features: ["Tallaabo Toos ah", "Liis Hogaamin", "Kooxo"],
    store: play("com.socodapp.walking"),
  },
  {
    name: "AqoonMaal",
    tagline: "Casharro muuqaal ah oo ardayda Soomaaliyeed",
    icon: "/apps/aqoonmaal.png",
    accent: "30 52 130",
    stats: ["100+ soo dejin"],
    features: ["Casharro Muuqaal", "Horumar", "Group Fasal"],
    store: play("com.aqoonmaal.app"),
  },
];

export default function About() {
  return (
    <div className="rd ab">
      <section className="rd-hero ab-hero">
        <span className="rd-glow rd-glow-a" />
        <span className="rd-glow rd-glow-b" />
        <div className="ab-hero-grid">
          <div>
            <span className="rd-eyebrow"><i />Ku saabsan aniga</span>
            <h1>{ME.name}</h1>
            <p className="ab-role">{ME.role}</p>
            <div className="ab-pills">
              <span>{ME.place}</span>
              <span>{ME.education}</span>
            </div>
            <div className="ab-stats">
              <div><b>7+</b><span>apps la daabacay</span></div>
              <div><b>8,600+</b><span>soo dejin Google Play</span></div>
              <div><b>2024</b><span>ilaa hadda</span></div>
            </div>
            <div className="rd-actions">
              <a href={`mailto:${ME.email}`} className="rd-btn rd-btn-primary">Ila soo xiriir</a>
              <Link to="/" className="rd-btn rd-btn-ghost">Fiiri koorsooyinka</Link>
            </div>
          </div>
          <div className="ab-collage" aria-hidden>
            {APPS.map((app) => (
              <img key={app.name} src={app.icon} alt="" width={96} height={96} />
            ))}
          </div>
        </div>
      </section>

      <section className="rd-section">
        <div className="rd-section-head">
          <h2>Apps-ka aan sameeyay</h2>
          <p>Kuwan oo dhan kaligay ayaan dhisay, kuna jira Google Play.</p>
        </div>
        <div className="ab-apps">
          {APPS.map((app) => (
            <article key={app.name} className="ab-app" style={{ "--a": app.accent } as CSSProperties}>
              <header>
                <img src={app.icon} alt={`Astaanta ${app.name}`} width={58} height={58} loading="lazy" />
                <div>
                  <h3>{app.name}</h3>
                  <div className="ab-app-stats">
                    {app.stats.map((s) => <span key={s}>{s}</span>)}
                  </div>
                </div>
              </header>
              <p>{app.tagline}</p>
              <div className="ab-chips">
                {app.features.map((f) => <span key={f}>{f}</span>)}
              </div>
              {app.store && (
                <a className="ab-store" href={app.store} target="_blank" rel="noreferrer">
                  <svg viewBox="0 0 24 24" aria-hidden><path d="M4 3.5v17l9-8.5zM14.5 13.5l2.6 2.5-11 6.2zM14.5 10.5l-8.4-8.7 11 6.2zM18.3 8.9l2.9 1.7c.9.5.9 1.8 0 2.3l-2.9 1.7-2.8-2.8z" /></svg>
                  Ka soo deji Google Play
                </a>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="rd-section">
        <div className="ab-contact">
          <div>
            <h2>Ma waxaad dhisaysaa wax?</h2>
            <p>Su'aal ama mashruuc, igu soo qor.</p>
          </div>
          <a href={`mailto:${ME.email}`} className="rd-btn rd-btn-primary">{ME.email}</a>
        </div>
      </section>
    </div>
  );
}
