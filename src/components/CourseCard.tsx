import { Link } from "react-router-dom";
import type { Course } from "../types/db";
import { formatDuration } from "../pages/CourseDetail";
import CourseCover from "./CourseCover";

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

export default function CourseCard({
  course,
  preview,
}: {
  course: Course;
  preview?: { id: string; duration_seconds: number };
}) {
  const discounted = hasDiscount(course);
  const comingSoon = course.status === "coming_soon";
  const href = `/course/${course.id}`;

  return (
    <div className="rd-card">
      <div className="rd-card-media">
        <Link to={href} tabIndex={-1} aria-hidden>
          {course.thumbnail_url ? (
            <img className="rd-card-img" src={course.thumbnail_url} alt="" loading="lazy" />
          ) : (
            <CourseCover course={course} />
          )}
        </Link>
        {comingSoon ? (
          <span className="rd-card-badge">Goordhow</span>
        ) : (
          discounted && <span className="rd-card-badge">-{discountPct(course)}%</span>
        )}
        {preview && (
          <Link to={href} state={{ playPreview: true }} className="rd-card-play">
            <span className="rd-play rd-play-sm">
              <svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" /></svg>
            </span>
            <span className="rd-card-play-label">
              Daawo hordhac{preview.duration_seconds > 0 ? ` · ${formatDuration(preview.duration_seconds)}` : ""}
            </span>
          </Link>
        )}
      </div>
      <Link to={href} className="rd-card-body">
        <span className="rd-chip">{course.category === "Mobile" ? "Mobile App" : course.category}</span>
        <h3>{course.title}</h3>
        <p>{course.description}</p>
        <div className="rd-card-foot">
          {comingSoon ? (
            <span className="rd-price">Dhawaan</span>
          ) : (
            <span className="rd-price">
              {discounted && (
                <s>{formatPrice(course.compare_at_price!, course.currency)}</s>
              )}
              {formatPrice(course.price, course.currency)}
            </span>
          )}
          <span className="rd-card-cta">Fiiri koorsada →</span>
        </div>
      </Link>
    </div>
  );
}
