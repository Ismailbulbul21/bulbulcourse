import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signupSchema, type SignupInput } from "../schemas/auth.schema";
import { supabase, toError } from "../lib/supabase";

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  // If they were sent here from "Buy" (Iibso), continue to that payment screen.
  const from = (location.state as { from?: string } | null)?.from ?? "/";
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
      });
      if (error) throw toError(error);
      if (data.session) {
        // Continue to the payment screen if they came to buy, else catalog.
        navigate(from, { replace: true });
      } else {
        // Email confirmation is enabled on the project.
        setNeedsConfirmation(true);
      }
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Diiwaangelintu waa fashilantay. Fadlan mar kale isku day.");
    }
  }

  if (needsConfirmation) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <h1>Fiiri emailkaaga</h1>
          <p>
            Waxaan kuu dirnay link xaqiijin. Fur si aad u hawlgeliso akoonkaaga,
            ka dibna <Link to="/login">gal</Link>.
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
        <p className="muted">Daqiiqado gudahood ku bilow barashada.</p>

        {serverError && <div className="error-box">{serverError}</div>}

        <label>
          Email
          <input type="email" autoComplete="email" {...register("email")} />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </label>

        <label>
          Furaha sirta <span className="bi-en">Password</span>
          <input type="password" autoComplete="new-password" {...register("password")} />
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </label>

        <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
          {isSubmitting ? (
            "Diiwaangelinaya…"
          ) : (
            <>
              Is diiwaangeli <span className="bi-en">Sign up</span>
            </>
          )}
        </button>

        <p className="muted">
          Horey ma u leedahay akoon? <Link to="/login">Gal / Login</Link>
        </p>
      </form>
    </div>
  );
}
