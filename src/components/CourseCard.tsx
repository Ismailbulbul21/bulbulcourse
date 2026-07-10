import { Link } from "react-router-dom";
import type { Course } from "../types/db";

export function formatPrice(price: number, currency = "USD"): string {
  if (Number(price) <= 0) return "Bilaash";
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${Number(price).toFixed(2)}`;
}

/** True when the course has an old price higher than the current one. */
export function hasDiscount(
  course: Pick<Course, "price" | "compare_at_price">
): boolean {
  return (
    course.compare_at_price != null &&
    Number(course.compare_at_price) > Number(course.price)
  );
}

export function discountPct(
  course: Pick<Course, "price" | "compare_at_price">
): number {
  return Math.round(
    (1 - Number(course.price) / Number(course.compare_at_price)) * 100
  );
}

export default function CourseCard({ course }: { course: Course }) {
  const isFree = Number(course.price) <= 0;
  const discounted = hasDiscount(course);
  const comingSoon = course.status === "coming_soon";
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
        {comingSoon ? (
          <span className="soon-badge">🔜 DHAWAAN</span>
        ) : (
          discounted && (
            <span className="discount-badge">-{discountPct(course)}%</span>
          )
        )}
        {!comingSoon && (
          <span className="course-thumb-price">
            {formatPrice(course.price, course.currency)}
          </span>
        )}
      </div>
      <div className="course-card-body">
        <span className="badge badge-category">{course.category}</span>
        <h3 className="course-card-title">{course.title}</h3>
        <p className="course-card-desc">{course.description}</p>
        <div className="course-card-footer">
          {comingSoon ? (
            <span className="course-card-price soon-text">
              Dhawaan ayaa la furayaa
            </span>
          ) : (
            <span className="course-card-price">
              Lacagta waa{" "}
              {discounted && (
                <s className="price-old">
                  {formatPrice(course.compare_at_price!, course.currency)}
                </s>
              )}{" "}
              {isFree ? "Bilaash" : formatPrice(course.price, course.currency)}
            </span>
          )}
          <span className="course-card-cta">Fiiri koorsada →</span>
        </div>
      </div>
    </Link>
  );
}
