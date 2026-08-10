import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { resetPasswordSchema, type ResetPasswordInput } from "../schemas/auth.schema";
import { supabase, toError } from "../lib/supabase";
import PasswordInput from "../components/PasswordInput";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Supabase reads the recovery token out of the URL and sets a session on
  // load; until that resolves we don't know yet whether this is a valid link.
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(!!session);
        setReady(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(values: ResetPasswordInput) {
    setServerError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw toError(error);
      setDone(true);
      setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Wax baa qaldamay. Fadlan mar kale isku day.");
    }
  }

  if (!ready) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <p className="muted">Sugaya…</p>
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <h1>Link-gu waa dhacay</h1>
          <p>
            Link-an waa mid aan sax ahayn ama wuu dhacay.{" "}
            <span className="bi-en">This reset link is invalid or has expired.</span>
          </p>
          <p className="muted">
            <Link to="/forgot-password">Codso link cusub / Request a new link</Link>
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <h1>Waa la beddelay ✅</h1>
          <p>Furahaaga sirta ah waa la beddelay. Waxaan ku gudbinaynaa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1>
          Beddel furaha sirta <span className="bi-en">Set a new password</span>
        </h1>
        <p className="muted">Geli furaha sirta ah ee cusub.</p>

        {serverError && <div className="error-box">{serverError}</div>}

        <label>
          Furaha sirta cusub <span className="bi-en">New password</span>
          <PasswordInput autoComplete="new-password" autoFocus {...register("password")} />
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </label>

        <label>
          Xaqiiji furaha <span className="bi-en">Confirm password</span>
          <PasswordInput autoComplete="new-password" {...register("confirmPassword")} />
          {errors.confirmPassword && (
            <span className="field-error">{errors.confirmPassword.message}</span>
          )}
        </label>

        <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
          {isSubmitting ? "Beddelaya…" : "Beddel furaha / Update password"}
        </button>
      </form>
    </div>
  );
}
