/**
 * About me — who builds BulbulCourses, and the apps already shipped.
 *
 * Static on purpose: no database, no tables, no admin screen. Editing the
 * arrays below is the whole workflow, so nothing here can affect courses,
 * payments or purchases.
 */

/** Shown as the page heading. Change this one line to change it everywhere. */
const ME = {
  name: "Ismail Bulbul",
  role: "Mobile & web developer",
  place: "Mogadishu, Somalia",
  email: "ismailbulbul381@gmail.com",
};

type App = {
  name: string;
  tagline: string;
  /** Plain-language answer to "what is this app for?" */
  what: string;
  features: string[];
  /** Left out when the app has no public listing yet. */
  store?: { label: string; url: string };
  status?: string;
};

const APPS: App[] = [
  {
    name: "Qorsheyn",
    tagline: "A daily planner, written entirely in Somali",
    what:
      "Qorsheyn is for anyone who wants to plan their day and actually finish it. You write down what you plan to do, set the goals you are working toward, and the app reminds you. Everything in it is in Somali — there is no English to translate in your head first.",
    features: [
      "A Today view with the tasks ahead of you, and your past days kept so you can look back",
      "Goals you can set weekly, monthly, every three months, or for the whole year",
      "Reminders that arrive on the day and at the time you pick",
      "Focus sessions that block the apps that distract you while you work",
      "Free to download, with a paid plan you buy using EVC Plus, ZAAD or Sahal",
    ],
    store: {
      label: "Google Play",
      url: "https://play.google.com/store/apps/details?id=com.productivityapp.abaabulka",
    },
  },
  {
    name: "Socod",
    tagline: "Walking, counted and turned into a competition",
    what:
      "Socod counts your steps by itself, using the motion sensors already inside your phone — you do not have to start or stop anything. You set the number of steps you want to reach each day, and then you walk against everyone else on the leaderboard instead of walking alone.",
    features: [
      "Steps counted automatically in the background, with no extra device needed",
      "Your own daily step goal, set by you",
      "A leaderboard that ranks you against the other walkers",
      "Groups, so friends, a family or a workplace can walk together",
      "Every walk saved as a session, with the full history kept",
      "Badges for the milestones you reach",
    ],
    store: {
      label: "Google Play",
      url: "https://play.google.com/store/apps/details?id=com.socodapp.walking",
    },
  },
  {
    name: "JirDhis",
    tagline: "A full exercise library in Somali, for home or the gym",
    what:
      "JirDhis teaches you how to exercise properly in your own language. Every movement is explained in Somali, with a video showing it being done, so you are not copying a picture and guessing. It works whether you train at home with nothing or at a gym with equipment.",
    features: [
      "More than 150 exercises, sorted into eight groups: Laabta, Dhabarka, Garbaha, Cudud (biceps), Cudud (triceps), Lugaha, Caloosha and Cardio",
      "Each exercise explained step by step in Somali, with the muscles it works",
      "The common mistakes people make, and tips to do it right",
      "A difficulty level on every exercise — beginner, intermediate or advanced",
      "Marked for home or gym, and by the equipment it needs",
      "A video and an animation for every single exercise",
    ],
  },
  {
    name: "Baro-Ai",
    tagline: "Casharradaada u beddel hab waxbarasho",
    what:
      "Baro-Ai turns the material you already study from into something you can revise properly. You give it your own pages — a PDF, photos of your textbook, or notes you typed — and it builds the study tools out of those exact pages. It teaches your syllabus, not a general version of the subject.",
    features: [
      "Guudmar — a study guide that explains your lesson, with diagrams, comparisons, formulas and timelines drawn from your own pages",
      "Macallin AI — ask questions and get answers taken from the pages you added, showing you the passage they came from",
      "Kaarka — flashcards scheduled so the ones you find hard come back sooner",
      "Imtixaan — practice questions at three levels, with an explanation for every answer",
      "Cod — your study guide read aloud, for revising while walking or resting your eyes",
      "No ads, no trackers, and no selling your data",
    ],
    status: "Coming soon — Android and iOS",
  },
];

const TECH = [
  "React and TypeScript for the web",
  "Android and iOS for mobile",
  "Supabase and Postgres, with row-level security on every table",
  "Mobile-money payments — EVC Plus, ZAAD and Sahal",
  "Object storage with signed links, so paid video stays paid",
];

export default function About() {
  return (
    <div className="page">
      <header className="about-hero">
        <h1>{ME.name}</h1>
        <p className="about-role">
          {ME.role} · {ME.place}
        </p>
        <p className="about-lead">
          I build apps for Somali people in Somali. Not apps translated into
          Somali afterwards — apps where the language, the examples and the way
          you pay were the starting point. Below is what I have shipped so far,
          and what each one is for. You are reading this on the newest one.
        </p>
      </header>

      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-num">4</span>
          <span className="stat-label">Mobile apps built</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">2</span>
          <span className="stat-label">Live on Google Play</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">1</span>
          <span className="stat-label">Course platform — this one</span>
        </div>
      </div>

      <section className="about-section">
        <h2>The apps I have built</h2>
        <div className="about-apps">
          {APPS.map((app) => (
            <article key={app.name} className="app-card">
              <div className="app-card-head">
                <div>
                  <h3 className="app-name">{app.name}</h3>
                  <p className="app-tagline">{app.tagline}</p>
                </div>
                {app.status && <span className="badge badge-coming_soon">{app.status}</span>}
              </div>

              <p className="app-what">{app.what}</p>

              <ul className="app-features">
                {app.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>

              {app.store && (
                <a
                  className="btn btn-secondary btn-sm"
                  href={app.store.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get it on {app.store.label}
                </a>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="about-section">
        <h2>BulbulCourses — the site you are on</h2>
        <div className="card">
          <p>
            This platform is where I teach what I know. Courses are recorded in
            Somali, split into modules and lessons, and you buy one with the
            same mobile money you already use. The site remembers where you
            stopped in every video, so you can come back and carry on, and you
            can ask a question under any lesson and get an answer from me.
          </p>
        </div>
      </section>

      <section className="about-section">
        <h2>How I build</h2>
        <div className="card">
          <ul className="tech-list">
            {TECH.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="muted about-tech-note">
            I also build apps and systems for other people — mobile apps,
            websites and the admin dashboards behind them.
          </p>
        </div>
      </section>

      <section className="about-section">
        <h2>Get in touch</h2>
        <div className="card about-contact">
          <p>
            Email me at <a href={`mailto:${ME.email}`}>{ME.email}</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
