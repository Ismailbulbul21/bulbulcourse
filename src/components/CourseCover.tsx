import type { Course } from "../types/db";

/**
 * Designed cover drawn in CSS instead of an uploaded photo: weighs nothing on
 * mobile data and every course looks like part of one set.
 */
export default function CourseCover({
  course,
  size = "card",
}: {
  course: Pick<Course, "title" | "category">;
  size?: "card" | "small";
}) {
  const mobile = course.category === "Mobile";
  return (
    <div className={`rd-cover rd-cover-${size} ${mobile ? "rd-cover-mobile" : "rd-cover-web"}`} aria-hidden>
      <span className="rd-cover-glow" />
      {mobile ? (
        <svg className="rd-cover-art" viewBox="0 0 120 120">
          <rect x="38" y="14" width="44" height="92" rx="10" />
          <rect x="45" y="27" width="30" height="8" rx="3" className="fill" />
          <rect x="45" y="41" width="30" height="20" rx="4" />
          <rect x="45" y="67" width="14" height="14" rx="4" className="fill" />
          <rect x="61" y="67" width="14" height="14" rx="4" />
          <circle cx="60" cy="96" r="3" className="fill" />
        </svg>
      ) : (
        <svg className="rd-cover-art" viewBox="0 0 120 120">
          <rect x="12" y="24" width="96" height="72" rx="9" />
          <path d="M12 40h96" />
          <circle cx="22" cy="32" r="2.5" className="fill" />
          <circle cx="30" cy="32" r="2.5" className="fill" />
          <path d="m48 58-10 10 10 10M72 58l10 10-10 10M64 54l-8 28" />
        </svg>
      )}
      <span className="rd-cover-label">{mobile ? "Mobile Apps" : "Websites"} + AI</span>
    </div>
  );
}
