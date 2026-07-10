import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  COURSE_CATEGORIES,
  courseSchema,
  type CourseInput,
} from "../../schemas/course.schema";

export default function CourseForm({
  defaultValues,
  submitLabel,
  onSubmit,
  serverError,
}: {
  defaultValues: CourseInput;
  submitLabel: string;
  onSubmit: (values: CourseInput) => Promise<void>;
  serverError?: string | null;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CourseInput>({
    resolver: zodResolver(courseSchema),
    defaultValues,
  });

  return (
    <form className="form-card" onSubmit={handleSubmit(onSubmit)} noValidate>
      {serverError && <div className="error-box">{serverError}</div>}

      <label>
        Course title
        <input type="text" placeholder="e.g. React Masterclass" {...register("title")} />
        {errors.title && <span className="field-error">{errors.title.message}</span>}
      </label>

      <label>
        Description
        <textarea
          rows={5}
          placeholder="What will students learn?"
          {...register("description")}
        />
        {errors.description && (
          <span className="field-error">{errors.description.message}</span>
        )}
      </label>

      <div className="form-row">
        <label>
          Category
          <select {...register("category")}>
            {COURSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.category && (
            <span className="field-error">{errors.category.message}</span>
          )}
        </label>

        <label>
          Price (USD)
          <input type="number" step="0.01" min="0" placeholder="15" {...register("price")} />
          {errors.price && <span className="field-error">{errors.price.message}</span>}
        </label>
      </div>

      <label>
        Qiimaha hore — discount{" "}
        <span className="bi-en">
          (optional: old price shown crossed out, e.g. 25 → students see the deal)
        </span>
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="tusaale: 25 (bannaan ka tag haddii aanu jirin discount)"
          {...register("compare_at_price")}
        />
        {errors.compare_at_price && (
          <span className="field-error">{errors.compare_at_price.message}</span>
        )}
      </label>

      <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
