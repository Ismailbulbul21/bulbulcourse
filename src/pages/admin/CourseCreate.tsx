import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import CourseForm from "../../components/admin/CourseForm";
import { CourseService } from "../../services/courses.service";
import { useAuthStore } from "../../stores/authStore";
import type { CourseInput } from "../../schemas/course.schema";

export default function CourseCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(values: CourseInput) {
    setServerError(null);
    try {
      const course = await CourseService.create({
        title: values.title,
        description: values.description,
        category: values.category,
        price: Number(values.price),
        compare_at_price:
          values.compare_at_price.trim() !== "" && Number(values.compare_at_price) > 0
            ? Number(values.compare_at_price)
            : null,
        created_by: user!.id,
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      navigate(`/admin/courses/${course.id}?tab=curriculum`, { replace: true });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Could not create the course.");
    }
  }

  return (
    <div className="page page-narrow">
      <p className="wizard-step muted">Step 1 of 3 — Course details</p>
      <h1>Create Course</h1>
      <p className="muted">
        Just the essentials. You'll add modules, lessons, videos and a thumbnail in the
        next step.
      </p>
      <div className="card">
        <CourseForm
          defaultValues={{
            title: "",
            description: "",
            category: "Mobile",
            price: "0",
            compare_at_price: "",
          }}
          submitLabel="Save & Continue →"
          onSubmit={onSubmit}
          serverError={serverError}
        />
      </div>
    </div>
  );
}
