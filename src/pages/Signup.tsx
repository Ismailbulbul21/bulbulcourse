import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { signupSchema, type SignupInput } from "../schemas/auth.schema";
import { supabase, toError } from "../lib/supabase";

export default function Signup() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupInput) {
    setServerError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: { data: { full_name: values.fullName } },
      });
      if (error) throw toError(error);
      if (data.session) {
        // New users land on the course catalog, not the empty dashboard.
        navigate("/", { replace: true });
      } else {
        // Email confirmation is enabled on the project.
        setNeedsConfirmation(true);
      }
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Signup failed. Please try again.");
    }
  }

  if (needsConfirmation) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <h1>Check your email</h1>
          <p>
            We sent you a confirmation link. Open it to activate your account,
            then <Link to="/login">log in</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1>
          Is diiwaangeli <span className="bi-en">Create your account</span>
        </h1>
        <p className="muted">Start learning in minutes.</p>

        {serverError && <div className="error-box">{serverError}</div>}

        <label>
          Full name
          <input type="text" autoComplete="name" {...register("fullName")} />
          {errors.fullName && <span className="field-error">{errors.fullName.message}</span>}
        </label>

        <label>
          Email
          <input type="email" autoComplete="email" {...register("email")} />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </label>

        <label>
          Password
          <input type="password" autoComplete="new-password" {...register("password")} />
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </label>

        <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
          {isSubmitting ? (
            "Creating account…"
          ) : (
            <>
              <span className="bi-en">Sign up</span> Is diiwaangeli
            </>
          )}
        </button>

        <p className="muted">
          Already have an account? <Link to="/login">Login / Gal</Link>
        </p>
      </form>
    </div>
  );
}
