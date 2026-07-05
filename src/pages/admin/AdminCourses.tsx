import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CourseService } from "../../services/courses.service";
import { formatPrice } from "../../components/CourseCard";
import Spinner from "../../components/Spinner";
import ErrorMessage from "../../components/ErrorMessage";
import type { Course, CourseStatus } from "../../types/db";

const STATUS_LABEL: Record<CourseStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export default function AdminCourses() {
  const queryClient = useQueryClient();

  const coursesQuery = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => CourseService.adminList(),
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

  if (coursesQuery.isPending) return <Spinner label="Loading courses…" />;
  if (coursesQuery.isError) {
    return (
      <ErrorMessage error={coursesQuery.error} onRetry={() => coursesQuery.refetch()} />
    );
  }

  const courses = coursesQuery.data;

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Courses</h1>
        <Link to="/admin/courses/new" className="btn btn-primary">
          + Create Course
        </Link>
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
        <table className="admin-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Status</th>
              <th>Price</th>
              <th>Created</th>
              <th className="admin-table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id}>
                <td>
                  <Link to={`/admin/courses/${course.id}`} className="admin-course-title">
                    {course.title}
                  </Link>
                </td>
                <td>
                  <span className={`badge badge-${course.status}`}>
                    {STATUS_LABEL[course.status]}
                  </span>
                </td>
                <td>{formatPrice(course.price, course.currency)}</td>
                <td>{new Date(course.created_at).toLocaleDateString()}</td>
                <td className="admin-table-actions">
                  <Link to={`/admin/courses/${course.id}`} className="btn btn-secondary btn-sm">
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={toggleStatus.isPending}
                    onClick={() => toggleStatus.mutate(course)}
                  >
                    {course.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={softDelete.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Archive "${course.title}"? Students who bought it will lose access to the catalog listing.`
                        )
                      ) {
                        softDelete.mutate(course.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
