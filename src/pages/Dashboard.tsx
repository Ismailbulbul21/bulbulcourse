import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PurchaseService } from "../services/purchases.service";
import { LessonService } from "../services/lessons.service";
import { ProgressService } from "../services/progress.service";
import { useAuthStore } from "../stores/authStore";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";

export default function Dashboard() {
  const { profile } = useAuthStore();

  const purchasesQuery = useQuery({
    queryKey: ["my-purchases"],
    queryFn: () => PurchaseService.myPurchases(),
  });

  const courseIds = (purchasesQuery.data ?? [])
    .map((p) => p.course_id)
    .filter(Boolean);

  const lessonCountsQuery = useQuery({
    queryKey: ["lesson-counts", courseIds],
    queryFn: () => LessonService.countByCourse(courseIds),
    enabled: courseIds.length > 0,
  });

  const progressQuery = useQuery({
    queryKey: ["my-progress"],
    queryFn: () => ProgressService.mine(),
  });

  if (purchasesQuery.isPending) return <Spinner label="Loading your courses…" />;
  if (purchasesQuery.isError) {
    return (
      <ErrorMessage error={purchasesQuery.error} onRetry={() => purchasesQuery.refetch()} />
    );
  }

  const purchases = purchasesQuery.data;
  const lessonCounts = lessonCountsQuery.data ?? {};
  const progress = progressQuery.data ?? [];

  const completedByCourse: Record<string, number> = {};
  for (const p of progress) {
    if (p.completed) {
      completedByCourse[p.course_id] = (completedByCourse[p.course_id] ?? 0) + 1;
    }
  }

  return (
    <div className="page">
      <h1>Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋</h1>

      {purchases.length === 0 ? (
        <div className="empty-state">
          <h3>You haven't enrolled in any course yet</h3>
          <p>Browse the catalog and start learning today.</p>
          <Link to="/" className="btn btn-primary">
            Browse courses
          </Link>
        </div>
      ) : (
        <>
          <h2>Continue learning</h2>
          <div className="dashboard-grid">
            {purchases.map((purchase) => {
              const course = purchase.courses;
              if (!course) return null;
              const total = lessonCounts[course.id] ?? 0;
              const completed = Math.min(completedByCourse[course.id] ?? 0, total);
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              return (
                <div key={purchase.id} className="card dashboard-card">
                  <div className="dashboard-card-thumb">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt="" loading="lazy" />
                    ) : (
                      <div className="thumb-placeholder">
                        {course.title.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="dashboard-card-body">
                    <h3>{course.title}</h3>
                    <div className="progress-bar" aria-hidden>
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="muted">
                      {total > 0
                        ? `${completed} of ${total} lessons completed`
                        : "No lessons yet"}
                    </p>
                    <Link to={`/learn/${course.id}`} className="btn btn-primary">
                      {completed === 0 ? "Start course" : "Continue →"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
