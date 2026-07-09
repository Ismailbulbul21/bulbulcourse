import { Link } from "react-router-dom";
import type { Course } from "../types/db";

export function formatPrice(price: number, currency = "USD"): string {
  if (Number(price) <= 0) return "Bilaash";
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${Number(price).toFixed(2)}`;
}

export default function CourseCard({ course }: { course: Course }) {
  const isFree = Number(course.price) <= 0;
  return (
    <Link to={`/course/${course.id}`} className="course-card">
      <div className="course-thumb">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt="" loading="lazy" />
        ) : (
          <div className="thumb-placeholder" aria-hidden>
            {course.title.slice(0, 1).toUpperCase()}
          </div>
        )}
        <span className="course-thumb-price">
          {formatPrice(course.price, course.currency)}
        </span>
      </div>
      <div className="course-card-body">
        <span className="badge badge-category">{course.category}</span>
        <h3 className="course-card-title">{course.title}</h3>
        <p className="course-card-desc">{course.description}</p>
        <div className="course-card-footer">
          <span className="course-card-price">
            {isFree
              ? "Lacagta waa Bilaash"
              : `Lacagta waa ${formatPrice(course.price, course.currency)}`}
          </span>
          <span className="course-card-cta">Fiiri koorsada →</span>
        </div>
      </div>
    </Link>
  );
}
