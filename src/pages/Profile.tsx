import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileInput } from "../schemas/course.schema";
import { ProfileService } from "../services/profile.service";
import { useAuthStore } from "../stores/authStore";
import Spinner from "../components/Spinner";

export default function Profile() {
  const { user, profile, setProfile } = useAuthStore();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    values: { full_name: profile?.full_name ?? "" },
  });

  if (!user || !profile) return <Spinner label="Loading profile…" />;

  async function onSubmit(values: ProfileInput) {
    setStatus("idle");
    try {
      const updated = await ProfileService.update(user!.id, {
        full_name: values.full_name,
      });
      setProfile(updated);
      setStatus("saved");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Could not save your profile.");
      setStatus("error");
    }
  }

  return (
    <div className="page page-narrow">
      <h1>Your profile</h1>
      <form className="card form-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label>
          Full name
          <input type="text" {...register("full_name")} />
          {errors.full_name && (
            <span className="field-error">{errors.full_name.message}</span>
          )}
        </label>

        <label>
          Email
          <input type="email" value={user.email ?? ""} disabled />
        </label>

        <label>
          Role
          <input type="text" value={profile.role} disabled />
        </label>

        {status === "saved" && <div className="success-box">Profile saved.</div>}
        {status === "error" && <div className="error-box">{errorMsg}</div>}

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
