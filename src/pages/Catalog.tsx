import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CourseService } from "../services/courses.service";
import CourseCard from "../components/CourseCard";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";
import Pagination from "../components/Pagination";

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

  const categories = ["All", "Mobile", "Web Development"];

  return (
    <div className="page">
      <section className="hero">
        <h1>Learn anything, anywhere.</h1>
        <p>Practical video courses. Watch a free preview, pay with EVC Plus or ZAAD, learn at your own pace.</p>
        <form className="search-form" onSubmit={submitSearch} role="search">
          <input
            type="search"
            placeholder="Search courses…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search courses"
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
      </section>

      <div className="category-chips">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip ${category === c ? "chip-active" : ""}`}
            onClick={() => updateParams({ category: c === "All" ? "" : c, page: "1" })}
          >
            {c}
          </button>
        ))}
      </div>

      {coursesQuery.isPending ? (
        <Spinner label="Loading courses…" />
      ) : coursesQuery.isError ? (
        <ErrorMessage error={coursesQuery.error} onRetry={() => coursesQuery.refetch()} />
      ) : coursesQuery.data.courses.length === 0 ? (
        <div className="empty-state">
          <h3>No courses found</h3>
          <p>Try a different search or category.</p>
        </div>
      ) : (
        <>
          <div className="course-grid">
            {coursesQuery.data.courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
          <Pagination
            page={page}
            pageCount={coursesQuery.data.pageCount}
            onPage={(p) => updateParams({ page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
