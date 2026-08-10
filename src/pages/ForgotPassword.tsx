import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { forgotPasswordSchema, type ForgotPasswordInput } from "../schemas/auth.schema";
import { supabase, toError } from "../lib/supabase";

export default function ForgotPassword() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setServerError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw toError(error);
      setSent(true);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Wax baa qaldamay. Fadlan mar kale isku day.");
    }
  }

  if (sent) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <h1>Fiiri emailkaaga</h1>
          <p>
            Haddii akoon email-kaas ku diiwaan gashan yahay, waxaan u dirnay link aad ku
            beddesho furahaaga sirta ah.{" "}
            <span className="bi-en">If an account exists for that email, we've sent a reset link.</span>
          </p>
          <p className="muted">
            <Link to="/login">Ku noqo Login</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1>
          Furaha sirta ma illowday? <span className="bi-en">Forgot password?</span>
        </h1>
        <p className="muted">
          Geli email-kaaga, waxaan kuu diri doonaa link aad ku beddesho furahaaga sirta ah.
        </p>

        {serverError && <div className="error-box">{serverError}</div>}

        <label>
          Email
          <input type="email" autoComplete="email" autoFocus {...register("email")} />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </label>

        <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
          {isSubmitting ? "Diraya…" : "Dir link / Send reset link"}
        </button>

        <p className="muted">
          <Link to="/login">Ku noqo Login</Link>
        </p>
      </form>
    </div>
  );
}
