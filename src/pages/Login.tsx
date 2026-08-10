import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "../schemas/auth.schema";
import { supabase, toError } from "../lib/supabase";
import PasswordInput from "../components/PasswordInput";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  // Default landing after login is the course catalog, not My Learning.
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) throw toError(error);
      navigate(from, { replace: true });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Login failed. Please try again.");
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1>
          Gal <span className="bi-en">Welcome back</span>
        </h1>
        <p className="muted">Log in to continue learning.</p>

        {serverError && <div className="error-box">{serverError}</div>}

        <label>
          Email
          <input type="email" autoComplete="email" {...register("email")} />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </label>

        <label>
          Password
          <PasswordInput autoComplete="current-password" {...register("password")} />
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </label>

        <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
          {isSubmitting ? (
            "Logging in…"
          ) : (
            <>
              <span className="bi-en">Login</span> Gal
            </>
          )}
        </button>

        <p className="muted">
          New here? <Link to="/signup">Sign up / Is diiwaangeli</Link>
        </p>
      </form>
    </div>
  );
}
