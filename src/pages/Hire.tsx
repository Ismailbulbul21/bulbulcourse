import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { HireService } from "../services/hire.service";
import { SettingsService, isOn } from "../services/settings.service";
import { useAuthStore } from "../stores/authStore";
import { formatPrice } from "../components/CourseCard";
import { whatsappLink } from "../lib/whatsapp";
import {
  SERVICE_CATEGORIES,
  inquirySchema,
  type InquiryFormInput,
} from "../schemas/hire.schema";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";
import type { ServiceCategory, ServicePackage } from "../types/db";

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  mobile: "Mobile App",
  web: "Website",
  system: "System",
  other: "Kale",
};

// The order carries meaning here: this is the actual sequence of a project.
const PROCESS = [
  {
    title: "Ii sheeg fikradda",
    text: "Buuxi foomka hoose ama WhatsApp igu soo qor — sharax waxa aad rabto in la dhiso.",
  },
  {
    title: "Wada hadal & qiimo",
    text: "Waan kula soo xiriiraa. Waxaan isla meel dhigaynaa waxa la dhisayo, muddada iyo qiimaha.",
  },
  {
    title: "Dhisid",
    text: "Shaqada ayaan bilaabaa, horumarkana waan kula wadaagaa inta shaqadu socoto.",
  },
  {
    title: "Gudbin",
    text: "Marka aad ku qanacdo, app-ka ama website-ka waa la daabacaa oo waa kuu gudbiyaa.",
  },
];

const FAQ = [
  {
    q: "Immisa waqti ayay qaadanaysaa?",
    a: "Waxay ku xiran tahay baaxadda mashruuca. Muddo cad ayaan kuu sheegaa ka hor intaanan shaqada bilaabin.",
  },
  {
    q: "Sidee lacagta loo bixiyaa?",
    a: "Marka aan isla ogolaano qiimaha, qayb ayaa horay loo bixiyaa, inta kalena marxaladaha shaqada ayaa lagu bixiyaa.",
  },
  {
    q: "Maxaad dhisi kartaa?",
    a: "Mobile app (Android & iPhone), website, iyo nidaamyo maamul (dashboard) — hal mashruuc ama dhammaantood.",
  },
];

const WHATSAPP_MESSAGE =
  "Asalaamu calaykum, waxaan rabaa inaan kaala hadlo mashruuc (BulbulCourses).";

export default function Hire() {
  const { user, isAdmin } = useAuthStore();
  const formRef = useRef<HTMLDivElement>(null);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["app-settings", user?.id ?? "anon"],
    queryFn: () => SettingsService.all(),
  });
  const packagesQuery = useQuery({
    queryKey: ["service-packages"],
    queryFn: () => HireService.packages(),
  });
  const portfolioQuery = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => HireService.portfolio(),
  });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InquiryFormInput>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      project_type: "mobile",
      package_id: "",
      budget: "",
      message: "",
      website: "",
    },
  });

  if (settingsQuery.isPending) return <Spinner label="Sugaya…" />;
  if (settingsQuery.isError) {
    return <ErrorMessage error={settingsQuery.error} onRetry={() => settingsQuery.refetch()} />;
  }

  const settings = settingsQuery.data;
  const open = isOn(settings, "services_enabled");

  if (!open && !isAdmin) {
    return (
      <div className="page page-narrow">
        <div className="card empty-state">
          <h3>Adeegyada wali lama furin</h3>
          <p>Dhawaan ayaa la furayaa. Soo laabo mar dambe.</p>
          <Link to="/" className="btn btn-primary">
            ← Ku laabo koorsooyinka
          </Link>
        </div>
      </div>
    );
  }

  // Admins preview everything; visitors only ever receive active rows (RLS),
  // and the preview also hides drafts so it shows what visitors will see.
  const packages = (packagesQuery.data ?? []).filter((p) => p.is_active);
  const projects = (portfolioQuery.data ?? []).filter((p) => p.is_active);
  const waLink = whatsappLink(settings.whatsapp_number, WHATSAPP_MESSAGE);

  function choosePackage(pkg: ServicePackage) {
    setValue("package_id", pkg.id);
    setValue("project_type", pkg.category);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function onSubmit(values: InquiryFormInput) {
    setServerError(null);
    // Bots fill the hidden field; people never see it. Pretend it worked.
    if (values.website.trim() !== "") {
      setSent(true);
      return;
    }
    try {
      await HireService.submitInquiry({
        name: values.name,
        phone: values.phone,
        email: values.email.trim() === "" ? null : values.email.trim(),
        project_type: values.project_type,
        package_id: values.package_id === "" ? null : values.package_id,
        budget: values.budget.trim(),
        message: values.message,
        user_id: user?.id ?? null,
      });
      reset();
      setSent(true);
    } catch (e) {
      setServerError(
        e instanceof Error ? e.message : "Codsiga lama dirin. Fadlan mar kale isku day."
      );
    }
  }

  return (
    <div className="page hire-page">
      {!open && isAdmin && (
        <div className="status-banner status-draft">
          <div>
            <strong>● Kaliya adiga ayaa arkaya boggan</strong>
            <p className="muted">
              Adeegyadu way xiran yihiin. Ka shid Admin → Hire me marka aad diyaar tahay.
            </p>
          </div>
          <Link to="/admin/services" className="btn btn-secondary">
            Admin →
          </Link>
        </div>
      )}

      <section className="hire-hero">
        <p className="wizard-step">
          Adeegyada <span className="bi-en">Hire me</span>
        </p>
        <h1>Aan kuu dhiso app-kaaga ama website-kaaga</h1>
        <p className="hire-lead">
          Mobile app, website ama nidaam maamul — laga bilaabo fikradda ilaa inta la
          daabacayo. Ii sheeg waxa aad rabto, waxaan kuu soo celinayaa qiimo iyo muddo cad.
        </p>
        <div className="hire-hero-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Dir codsi <span className="bi-en">Get a quote</span>
          </button>
          {waLink && (
            <a className="btn btn-whatsapp btn-lg" href={waLink} target="_blank" rel="noreferrer noopener">
              <span aria-hidden>💬</span> WhatsApp igu soo qor
            </a>
          )}
        </div>
      </section>

      <section className="hire-section">
        <h2>
          Xirmooyinka <span className="bi-en">Packages</span>
        </h2>
        {packagesQuery.isPending ? (
          <Spinner label="Loading…" />
        ) : packagesQuery.isError ? (
          <ErrorMessage error={packagesQuery.error} onRetry={() => packagesQuery.refetch()} />
        ) : packages.length === 0 ? (
          <p className="muted">
            Qiimaha mashruuc kasta waxaa lagu go'aamiyaa baaxaddiisa — ii soo dir codsi,
            waxaan kuu soo celinayaa qiimo.
          </p>
        ) : (
          <div className="package-grid">
            {packages.map((pkg) => (
              <article
                key={pkg.id}
                className={`card package-card ${pkg.is_featured ? "package-card-featured" : ""}`}
              >
                <div className="package-card-top">
                  <span className="badge badge-category">{CATEGORY_LABEL[pkg.category]}</span>
                  {pkg.is_featured && <span className="badge badge-featured">★ Ugu caansan</span>}
                </div>
                <h3>{pkg.title}</h3>
                {pkg.description && <p className="muted">{pkg.description}</p>}
                <div className="package-price">
                  {pkg.price_from === null ? (
                    <span className="package-price-ask">Qiimaha waa la isla gaarayaa</span>
                  ) : (
                    <>
                      <span className="package-price-label">Laga bilaabo</span>
                      <span className="package-price-num">
                        {formatPrice(pkg.price_from, pkg.currency)}
                      </span>
                    </>
                  )}
                </div>
                {pkg.delivery_time && (
                  <p className="package-meta">
                    <span aria-hidden>⏱️</span> {pkg.delivery_time}
                  </p>
                )}
                {pkg.features.length > 0 && (
                  <ul className="package-features">
                    {pkg.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className={`btn btn-block ${pkg.is_featured ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => choosePackage(pkg)}
                >
                  Codso xirmadan
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="hire-section">
        <h2>
          Sida ay u shaqeyso <span className="bi-en">How it works</span>
        </h2>
        <ol className="process-steps">
          {PROCESS.map((step, i) => (
            <li key={step.title} className="process-step">
              <span className="process-num" aria-hidden>
                {i + 1}
              </span>
              <div>
                <strong>{step.title}</strong>
                <p className="muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {projects.length > 0 && (
        <section className="hire-section">
          <h2>
            Mashaariicdii hore <span className="bi-en">Past work</span>
          </h2>
          <div className="portfolio-grid">
            {projects.map((project) => (
              <article key={project.id} className="portfolio-card">
                <div className="portfolio-thumb">
                  {project.image_url ? (
                    <img src={project.image_url} alt="" loading="lazy" />
                  ) : (
                    <div className="thumb-placeholder" aria-hidden>
                      {project.title.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="portfolio-body">
                  <span className="badge badge-category">{CATEGORY_LABEL[project.category]}</span>
                  <h3>{project.title}</h3>
                  {project.description && <p className="muted">{project.description}</p>}
                  {project.project_url && (
                    <a href={project.project_url} target="_blank" rel="noreferrer noopener">
                      Fiiri mashruuca ↗
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="hire-section">
        <h2>
          Su'aalo <span className="bi-en">Questions</span>
        </h2>
        <div className="faq-list">
          {FAQ.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p className="muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="hire-section" ref={formRef}>
        <h2>
          Dir codsi <span className="bi-en">Get a quote</span>
        </h2>

        {sent ? (
          <div className="card hire-sent">
            <h3>✓ Codsigaaga waa la helay</h3>
            <p>Waan kula soo xiriiri doonaa dhawaan lambarka aad noo siisay.</p>
            <div className="hire-hero-actions">
              {waLink && (
                <a className="btn btn-whatsapp" href={waLink} target="_blank" rel="noreferrer noopener">
                  <span aria-hidden>💬</span> WhatsApp igu soo qor
                </a>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setSent(false)}>
                Dir codsi kale
              </button>
            </div>
          </div>
        ) : (
          <form className="card form-card hire-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            {serverError && <div className="error-box">{serverError}</div>}

            <div className="form-row">
              <label>
                Magacaaga <span className="bi-en">Name</span>
                <input type="text" autoComplete="name" {...register("name")} />
                {errors.name && <span className="field-error">{errors.name.message}</span>}
              </label>
              <label>
                Lambarka taleefanka <span className="bi-en">Phone / WhatsApp</span>
                <input type="tel" autoComplete="tel" placeholder="61 5123456" {...register("phone")} />
                {errors.phone && <span className="field-error">{errors.phone.message}</span>}
              </label>
            </div>

            <div className="form-row">
              <label>
                Maxaad rabtaa in la dhiso? <span className="bi-en">Project type</span>
                <select {...register("project_type")}>
                  {SERVICE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Xirmada <span className="bi-en">Package (optional)</span>
                <select {...register("package_id")}>
                  <option value="">— Ma hubo —</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                Email <span className="bi-en">(optional)</span>
                <input type="email" autoComplete="email" {...register("email")} />
                {errors.email && <span className="field-error">{errors.email.message}</span>}
              </label>
              <label>
                Miisaaniyadda <span className="bi-en">Budget (optional)</span>
                <input type="text" placeholder="tusaale: $300 – $600" {...register("budget")} />
              </label>
            </div>

            <label>
              Faahfaahin <span className="bi-en">Tell me about the project</span>
              <textarea
                rows={5}
                placeholder="Waa maxay fikraddu? Yaa isticmaalaya? Wax la mid ah ma jiraan?"
                {...register("message")}
              />
              {errors.message && <span className="field-error">{errors.message.message}</span>}
            </label>

            {/* Honeypot — hidden from people and screen readers. */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hp-field"
              {...register("website")}
            />

            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
              {isSubmitting ? "Diraya…" : "Dir codsiga"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
