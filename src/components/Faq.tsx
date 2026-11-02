const ITEMS = [
  {
    q: "Sideen u bixiyaa lacagta?",
    a: "Waxaad ku bixin kartaa EVC Plus, ZAAD ama Sahal. Codsiga lacagta ayaa taleefankaaga kuu soo dhacaya, markaad ansixisana koorsada isla markiiba waa laguu furayaa.",
  },
  {
    q: "Maxaa dhacaya haddii lacag bixintu fashilanto?",
    a: "Lacag lagaama jarayo. Bogga ayaa kuu sheegaya sababta, tusaale haraagaagu kuma filna. Lacag ku shubo kadibna mar kale isku day.",
  },
  {
    q: "Ilaa goorma ayaan koorsada haysanayaa?",
    a: "Weligaa. Hal mar ayaad bixinaysaa, casharrada cusub ee koorsada lagu daro adiga ayaa helaya.",
  },
  {
    q: "Ma u baahanahay kombiyuutar?",
    a: "Daawashada taleefan ayaa ku filan. Si aad u dhisto apps ama websites, waxaa fiican inaad haysato kombiyuutar.",
  },
  {
    q: "Ma waydiin karaa su'aalo?",
    a: "Haa. Bogga koorsada hoostiisa waxaa ku yaal qaybta su'aalaha, macallinka ayaana kaaga jawaabaya.",
  },
];

export default function Faq() {
  return (
    <div className="rd-faq">
      {ITEMS.map((item) => (
        <details key={item.q}>
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}
