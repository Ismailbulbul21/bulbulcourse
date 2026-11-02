import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { CourseService } from "../services/courses.service";
import CourseCard from "../components/CourseCard";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";
import Pagination from "../components/Pagination";
import Faq from "../components/Faq";

const SHOW_FILTERS_ABOVE = 4;

const APPS = [
  { name: "Qorsheyn", icon: "/apps/qorsheyn.png" },
  { name: "JirDhis", icon: "/apps/jirdhis.png" },
  { name: "Baro-Ai", icon: "/apps/baro-ai.png" },
  { name: "Socod", icon: "/apps/socod.png" },
];

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const category = params.get("category") ?? "All";
  const search = params.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(search);

  const coursesQuery = useQuery({
    queryKey: ["courses", { page, search, category }],
    queryFn: () => CourseService.list({ page, search, category }),
    placeholderData: keepPreviousData,
  });

  const courseIds = (coursesQuery.data?.courses ?? []).map((c) => c.id);
  const previewsQuery = useQuery({
    queryKey: ["preview-lessons", courseIds],
    queryFn: () => CourseService.previewLessons(courseIds),
    enabled: courseIds.length > 0,
  });

  function updateParams(patch: Record<string, string>) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: searchInput.trim(), page: "1" });
  }

  const filtering = Boolean(search) || category !== "All";
  const showFilters = filtering || (coursesQuery.data?.total ?? 0) > SHOW_FILTERS_ABOVE;
  const firstCourse = coursesQuery.data?.courses[0];

  return (
    <div className="rd">
      <section id="courses">
        <div className="rd-section-head rd-top-head">
          <h1>Koorsooyinka</h1>
          <p>Koorso kasta waxay leedahay hordhac bilaash ah. Daawo adigoon is diiwaangelin.</p>
        </div>

        {showFilters && (
          <div className="catalog-toolbar">
            <div className="category-chips">
              {["All", "Mobile", "Web Development"].map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`chip ${category === c ? "chip-active" : ""}`}
                  onClick={() => updateParams({ category: c === "All" ? "" : c, page: "1" })}
                >
                  {c === "All" ? "Dhammaan" : c}
                </button>
              ))}
            </div>
            <form className="search-form" onSubmit={submitSearch} role="search">
              <input
                type="search"
                placeholder="Raadi koorso…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Raadi koorso"
              />
              <button type="submit" className="btn btn-secondary">Raadi</button>
            </form>
          </div>
        )}

        {coursesQuery.isPending ? (
          <Spinner label="Koorsooyinka ayaa la soo saarayaa…" />
        ) : coursesQuery.isError ? (
          <ErrorMessage error={coursesQuery.error} onRetry={() => coursesQuery.refetch()} />
        ) : coursesQuery.data.courses.length === 0 ? (
          <div className="empty-state">
            <h3>Koorso lama helin</h3>
            <p>Isku day raadin kale.</p>
          </div>
        ) : (
          <>
            <div className="rd-grid">
              {coursesQuery.data.courses.map((course) => (
                <CourseCard key={course.id} course={course} preview={previewsQuery.data?.[course.id]} />
              ))}
            </div>
            <Pagination
              page={page}
              pageCount={coursesQuery.data.pageCount}
              onPage={(p) => updateParams({ page: String(p) })}
            />
          </>
        )}
      </section>

      <section className="rd-section">
        <div className="rd-strip">
          <div><b>7+</b><span>apps aan dhisay</span></div>
          <div><b>8,600+</b><span>soo dejin Google Play</span></div>
          <div><b>EVC · ZAAD · Sahal</b><span>ku bixi taleefankaaga</span></div>
          {firstCourse && (
            <Link to={`/course/${firstCourse.id}#preview`} className="rd-btn rd-btn-primary">
              ▶ Daawo cashar bilaash ah
            </Link>
          )}
        </div>
      </section>

      <section className="rd-section">
        <div className="rd-section-head">
          <h2>Sida ay u shaqeyso</h2>
        </div>
        <div className="rd-steps">
          <div className="rd-step"><b>1</b><h3>Daawo bilaash</h3><p>Fiiri hordhaca koorsada si aad u ogaato waxa aad baran doonto.</p></div>
          <div className="rd-step"><b>2</b><h3>Ku bixi taleefankaaga</h3><p>EVC Plus, ZAAD ama Sahal. Koorsada isla markiiba waa laguu furayaa.</p></div>
          <div className="rd-step"><b>3</b><h3>Baro weligaa</h3><p>Daawo goor kasta, meeshii aad ka joogsatayna ka sii wad.</p></div>
        </div>
      </section>

      <section className="rd-section">
        <Link to="/about" className="rd-maker">
          <div className="rd-maker-icons">
            {APPS.map((a) => <img key={a.name} src={a.icon} alt={a.name} width={52} height={52} loading="lazy" />)}
          </div>
          <div>
            <h3>Wuxuu ku barayaa qof dhab ahaan apps dhisay</h3>
            <p>Qorsheyn, JirDhis, Baro-Ai, Socod iyo kuwo kale ayaa ku jira Google Play. Fiiri apps-ka →</p>
          </div>
        </Link>
      </section>

      <section className="rd-section">
        <div className="rd-section-head"><h2>Su'aalaha badanaa la isweydiiyo</h2></div>
        <Faq />
      </section>
    </div>
  );
}
