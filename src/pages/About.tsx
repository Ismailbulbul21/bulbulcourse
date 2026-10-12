/**
 * Ku saabsan aniga — who builds BulbulCourses, and the apps already shipped.
 *
 * Static on purpose: no database, no tables, no admin screen. Editing the
 * array below is the whole workflow, so nothing here can affect courses,
 * payments or purchases.
 *
 * The copy is Somali, and where an app already has its own Somali tagline or
 * names its own features, those exact words are used rather than a fresh
 * translation — so a card reads the way the app itself reads.
 *
 * Each app carries its own brand colour, passed to CSS as --accent, so a
 * card is tinted by the app it is describing rather than by the site.
 */
import type { CSSProperties } from "react";

/** Shown as the page heading. Change this one line to change it everywhere. */
const ME = {
  name: "Ismail Bulbul",
  role: "Horumariye app iyo website",
  place: "Muqdisho, Soomaaliya",
  email: "ismailbulbul381@gmail.com",
};

type App = {
  name: string;
  tagline: string;
  /** Plain-language answer to "waa maxay appkan?" */
  what: string;
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
    what:
      "Qorsheyn waxaa loo sameeyay qof kasta oo doonaya inuu maalintiisa qorsheeyo oo uu dhab ahaan dhammeeyo. Waxaad qortaa hawlaha aad qabanayso, waxaad dejisaa hadafyada aad u socoto, appkuna wuu ku xasuusiyaa. Wax walba waa af Soomaali — ma jiro Ingiriisi aad maskaxda ku turjumayso.",
    features: [
      "Bogga «Maanta» oo ku tusaya hawlaha ku hor yaal, maalmihii hore oo dhanna waa la kaydiyaa si aad dib ugu noqoto",
      "Hadafyo aad u dejisan karto toddobaadle, bille, saddex-biloodle ama sannadle",
      "Xusuusin kuugu timaadda maalinta iyo saacadda aad doorato",
      "Waqti feejignaan ah oo xiraya apps-ka ku carqaladeeya inta aad shaqaynayso",
      "Bilaash ayaad u soo dejisan kartaa, waxaana jira qorshe lacag ah oo aad ku iibsan karto EVC Plus, ZAAD ama Sahal",
    ],
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
    what:
      "Socod wuxuu tallaabooyinkaaga iskiis u tiriyaa, isagoo adeegsanaya dareemayaasha dhaqdhaqaaqa ee horey taleefankaaga ugu jira — wax aad bilowdo ama joojiso ma jiraan. Waxaad dejisaa tirada tallaabooyinka aad maalin kasta gaari doonto, kadibna kaligaa ma socotid ee waxaad la tartantaa dadka kale ee liiska hogaaminta ku jira.",
    features: [
      "Tallaabooyinka si toos ah ayaa loo tiriyaa, qalab dheeraad ah looma baahna",
      "Bartilmaameedkaaga tallaabada ee maalinlaha ah, adigu dejiso",
      "Liis hogaamin oo kaa dhigaya mid la tartamaya dadka kale ee socda",
      "Kooxo, si saaxiibo, qoys ama shaqo ay wada socdaan",
      "Socod kasta waa la kaydiyaa, taariikhda oo dhanna way taallaa",
      "Calaamado aad hesho marka aad heer cusub gaarto",
    ],
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
    what:
      "JirDhis wuxuu ku baraa sida saxda ah ee jimicsiga loo sameeyo, luqaddaada. Jimicsi kasta af Soomaali ayaa lagu sharraxay, waxaana la socda muuqaal lagu tusayo sida loo sameeyo, si aadan sawir eegin oo aadan saadaalin. Wuu kuu shaqeeyaa haddii aad guriga qalab la'aan ku jimicsato iyo haddii aad gym qalab leh tagtoba.",
    features: [
      "In ka badan 150 jimicsi oo loo kala saaray siddeed qaybood: Laabta, Dhabarka, Garbaha, Cudud (Biceps), Cudud (Triceps), Lugaha, Caloosha iyo Cardio",
      "Jimicsi kasta tallaabo-tallaabo af Soomaali ugu qoran, iyo muruqyada uu shaqaaleeyo",
      "Khaladaadka ay dadku badanaa sameeyaan, iyo talooyin si aad si sax ah u samayso",
      "Heer adkaansho jimicsi kasta leeyahay — bilow, dhexdhexaad ama sare",
      "Waxaa lagu calaamadiyay guriga iyo gym, iyo qalabka uu u baahan yahay",
      "Muuqaal iyo animation jimicsi kasta leeyahay",
    ],
  },
  {
    name: "Baro-Ai",
    tagline: "Casharradaada u beddel hab waxbarasho",
    icon: "/apps/baro-ai.png",
    accent: "22 163 74",
    what:
      "Baro-Ai wuxuu waxa aad horey uga baranaysay u beddelaa wax aad si wanaagsan u celcelin karto. Waxaad siisaa boggaagaaga adiga kuu gaarka ah — PDF, sawirro buugga ah, ama qoraallo aad qortay — isaguna qalabka waxbarashada wuxuu ka dhisaa isla boggahaas. Wuxuu ku baraa manhajkaaga, ma aha nooc guud oo maaddada ah.",
    features: [
      "Guudmar — hage waxbarasho oo casharkaaga sharraxaya, leh jaantusyo, isbarbardhig, qaacidooyin iyo jadwal waqtiyeed oo laga soo saaray boggaagaaga",
      "Macallin AI — su'aalo weydii oo hel jawaabo ka soo jeeda boggaga aad gelisay, isagoo ku tusaya qaybta ay ka yimaadeen",
      "Kaarka — kaarar laga sameeyay casharkaaga oo loo jadwaleeyay si kuwa adag ay dhaqso kuugu soo noqdaan",
      "Imtixaan — su'aalo tababar ah oo saddex heer ah, jawaab kastana sharraxaad leh",
      "Cod — hagahaaga waxbarasho oo kor loogu akhriyo, si aad u celcelisato adigoo socda ama indhaha nasinaya",
      "Xayaysiis ma leh, raad-raac ma leh, xogtaadana lama iibiyo",
    ],
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
        </div>
        <p className="about-lead">
          Waxaan dadka Soomaaliyeed u sameeyaa apps af Soomaali ah. Ma aha app
          markii dambe loo turjumay — luqadda, tusaalooyinka iyo habka
          lacag-bixinta tan iyo maalintii ugu horreysay waxay ahaayeen Soomaali.
          Hoos ka eeg waxa aan ilaa hadda soo saaray iyo waxa mid walba loogu
          talagalay. Boggan waxaad ku akhrinaysaa kan ugu cusub.
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
                  width={72}
                  height={72}
                  loading="lazy"
                />
                <div className="app-id">
                  <h3 className="app-name">{app.name}</h3>
                  <p className="app-tagline">{app.tagline}</p>
                </div>
                {app.status && <span className="app-status">{app.status}</span>}
              </header>

              <p className="app-what">{app.what}</p>

              <ul className="app-features">
                {app.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>

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
        <div className="about-platform">
          <h2>BulbulCourses — boggan aad ku sugan tahay</h2>
          <p>
            Boggan waa meesha aan ku baro waxa aan aqaano. Koorsooyinka af
            Soomaali ayaa lagu duubay, waxaana loo kala qaybiyey qaybo iyo
            casharro, waxaadna ku iibsan kartaa isla lacagta mobilada ee aad
            horey u isticmaasho. Boggu wuxuu xasuustaa meeshii aad ka joogsatay
            muuqaal kasta, si aad u soo noqoto oo aad uga sii wadato, waxaadna
            su'aal ka weydiin kartaa cashar kasta oo aad jawaab iga heli karto.
          </p>
        </div>
      </section>

      <section className="about-section">
        <div className="about-contact">
          <h2>Ila soo xiriir</h2>
          <p>
            Ma waxaad dhisaysaa wax, mise waxaad ku dhibtootay mid ka mid ah
            apps-ka? I soo qor.
          </p>
          <a className="about-mail" href={`mailto:${ME.email}`}>
            {ME.email}
          </a>
        </div>
      </section>
    </div>
  );
}
