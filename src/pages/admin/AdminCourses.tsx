import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CourseService } from "../../services/courses.service";
import { AdminService } from "../../services/admin.service";
import { formatPrice } from "../../components/CourseCard";
import Spinner from "../../components/Spinner";
import ErrorMessage from "../../components/ErrorMessage";
import type { Course } from "../../types/db";

export default function AdminCourses() {
  const queryClient = useQueryClient();

  const coursesQuery = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => CourseService.adminList(),
  });

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => AdminService.stats(),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
    void queryClient.invalidateQueries({ queryKey: ["courses"] });
  }

  const toggleStatus = useMutation({
    mutationFn: (course: Course) =>
      CourseService.update(course.id, {
        status: course.status === "published" ? "draft" : "published",
      }),
    onSuccess: invalidate,
  });

  const softDelete = useMutation({
    mutationFn: (id: string) => CourseService.softDelete(id),
    onSuccess: invalidate,
  });

  if (coursesQuery.isPending) return <Spinner label="Loading your studio…" />;
  if (coursesQuery.isError) {
    return (
      <ErrorMessage error={coursesQuery.error} onRetry={() => coursesQuery.refetch()} />
    );
  }

  const courses = coursesQuery.data;
  const published = courses.filter((c) => c.status === "published").length;
  const drafts = courses.filter((c) => c.status === "draft").length;

  const stats = statsQuery.data ?? null;
  const buyersById = new Map(
    (stats?.per_course ?? []).map((c) => [c.id, c.buyers])
  );

  return (
    <div className="page">
      <div className="admin-hero">
        <div>
          <p className="wizard-step">Creator Studio</p>
          <h1>My Courses</h1>
        </div>
        <Link to="/admin/courses/new" className="btn btn-primary btn-lg">
          + Create Course
        </Link>
      </div>

      {/* Business metrics — admin only (RLS-gated RPC) */}
      <div className="stat-row stat-row-primary">
        <div className="stat-card stat-card-hero">
          <span className="stat-num">
            {statsQuery.isPending ? "…" : stats?.total_users ?? 0}
          </span>
          <span className="stat-label">👥 Isticmaaleyaal (users)</span>
        </div>
        <div className="stat-card stat-card-hero">
          <span className="stat-num">
            {statsQuery.isPending ? "…" : stats?.paid_purchases ?? 0}
          </span>
          <span className="stat-label">✅ Dad iibsaday (paid)</span>
        </div>
        <div className="stat-card stat-card-hero">
          <span className="stat-num">
            {statsQuery.isPending
              ? "…"
              : formatPrice(stats?.total_revenue ?? 0, "USD")}
          </span>
          <span className="stat-label">💰 Dakhliga (revenue)</span>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-num">{courses.length}</span>
          <span className="stat-label">Total courses</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{published}</span>
          <span className="stat-label">Published</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{drafts}</span>
          <span className="stat-label">Drafts</span>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="empty-state">
          <h3>No courses yet</h3>
          <p>Create your first course — it takes about 10 minutes.</p>
          <Link to="/admin/courses/new" className="btn btn-primary">
            + Create Course
          </Link>
        </div>
      ) : (
        <div className="admin-grid">
          {courses.map((course) => (
            <div key={course.id} className="admin-card">
              <Link
                to={`/admin/courses/${course.id}`}
                className="admin-card-thumb"
                title="Open editor"
              >
                {course.thumbnail_url ? (
                  <img src={course.thumbnail_url} alt="" loading="lazy" />
                ) : (
                  <div className="thumb-placeholder" aria-hidden>
                    {course.title.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className={`badge badge-${course.status} admin-card-status`}>
                  {course.status}
                </span>
              </Link>
              <div className="admin-card-body">
                <h3 className="admin-card-title">
                  <Link to={`/admin/courses/${course.id}`}>{course.title}</Link>
                </h3>
                <p className="muted">
                  {course.category} · {formatPrice(course.price, course.currency)}
                </p>
                <p className="admin-card-buyers">
                  👥 {buyersById.get(course.id) ?? 0} qof ayaa iibsaday
                </p>
                <div className="admin-card-actions">
                  <Link
                    to={`/admin/courses/${course.id}`}
                    className="btn btn-secondary btn-sm"
                  >
                    ✏️ Edit
                  </Link>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={toggleStatus.isPending}
                    onClick={() => toggleStatus.mutate(course)}
                  >
                    {course.status === "published" ? "Unpublish" : "🚀 Publish"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={softDelete.isPending}
                    onClick={() => {
                      if (window.confirm(`Archive "${course.title}"?`)) {
                        softDelete.mutate(course.id);
                      }
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
