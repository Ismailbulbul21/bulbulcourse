import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import AdminNav from "../../components/admin/AdminNav";
import Spinner from "../../components/Spinner";
import ErrorMessage from "../../components/ErrorMessage";
import { formatPrice } from "../../components/CourseCard";
import {
  HireService,
  type PackageInput,
  type PortfolioInput,
} from "../../services/hire.service";
import { SettingsService, isOn, type Settings } from "../../services/settings.service";
import { SERVICE_CATEGORIES } from "../../schemas/hire.schema";
import { whatsappLink } from "../../lib/whatsapp";
import { useAuthStore } from "../../stores/authStore";
import type {
  InquiryStatus,
  PortfolioProject,
  ProjectInquiry,
  ServiceCategory,
  ServicePackage,
} from "../../types/db";

type Tab = "requests" | "packages" | "portfolio" | "settings";
const TABS: { id: Tab; label: string }[] = [
  { id: "requests", label: "Codsiyada" },
  { id: "packages", label: "Xirmooyinka" },
  { id: "portfolio", label: "Mashaariicda" },
  { id: "settings", label: "WhatsApp" },
];

const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "Cusub",
  contacted: "La xiriiray",
  quoted: "Qiimo la siiyay",
  won: "La helay ✓",
  lost: "Lumay",
};

const CATEGORY_LABEL = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.value, c.label])
) as Record<ServiceCategory, string>;

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export default function AdminServices() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: Tab = TABS.some((t) => t.id === requested) ? (requested as Tab) : "requests";
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["app-settings", user?.id ?? "anon"],
    queryFn: () => SettingsService.all(),
  });
  const toggle = useMutation({
    mutationFn: (on: boolean) => SettingsService.set("services_enabled", on ? "true" : "false"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
  });

  const open = isOn(settingsQuery.data, "services_enabled");

  return (
    <div className="page">
      <AdminNav />
      <div className="admin-hero">
        <div>
          <p className="wizard-step">Creator Studio</p>
          <h1>Hire me</h1>
        </div>
        <a href="/hire" target="_blank" rel="noreferrer" className="btn btn-secondary">
          Fiiri bogga ↗
        </a>
      </div>

      <div className={`status-banner ${open ? "status-live" : "status-draft"}`}>
        <div>
          <strong>{open ? "✓ Bogga Hire me waa furan yahay" : "● Bogga Hire me waa xiran yahay"}</strong>
          <p className="muted">
            {open
              ? "Dadku way arki karaan, codsina way soo diri karaan."
              : "Qof kale ma arko. Ku dar xirmooyinka iyo lambarka WhatsApp, kadibna fur."}
          </p>
        </div>
        <button
          type="button"
          className={`btn ${open ? "btn-secondary" : "btn-primary"}`}
          disabled={toggle.isPending || settingsQuery.isPending}
          onClick={() => {
            if (!open || window.confirm("Xir bogga Hire me? Dadku ma arki doonaan.")) {
              toggle.mutate(!open);
            }
          }}
        >
          {open ? "Xir" : "🚀 Fur bogga"}
        </button>
      </div>
      {toggle.isError && <ErrorMessage error={toggle.error} />}

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? "tab-active" : ""}`}
            onClick={() => setParams({ tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "requests" && <RequestsTab />}
      {tab === "packages" && <PackagesTab />}
      {tab === "portfolio" && <PortfolioTab />}
      {tab === "settings" && <WhatsAppTab settings={settingsQuery.data} />}
    </div>
  );
}

// ── Requests ─────────────────────────────────────────────────────────────

function RequestsTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<InquiryStatus | "all">("all");

  const inquiriesQuery = useQuery({
    queryKey: ["admin-inquiries"],
    queryFn: () => HireService.inquiries(),
  });
  const packagesQuery = useQuery({
    queryKey: ["service-packages"],
    queryFn: () => HireService.packages(),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] });
    void queryClient.invalidateQueries({ queryKey: ["booking-stats"] });
  };
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { status?: InquiryStatus; admin_note?: string } }) =>
      HireService.updateInquiry(id, patch),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => HireService.deleteInquiry(id),
    onSuccess: refresh,
  });

  if (inquiriesQuery.isPending) return <Spinner label="Loading requests…" />;
  if (inquiriesQuery.isError) {
    return <ErrorMessage error={inquiriesQuery.error} onRetry={() => inquiriesQuery.refetch()} />;
  }

  const all = inquiriesQuery.data;
  const shown = filter === "all" ? all : all.filter((i) => i.status === filter);
  const packageTitle = new Map((packagesQuery.data ?? []).map((p) => [p.id, p.title]));

  return (
    <div>
      <div className="category-chips admin-toolbar">
        {(["all", "new", "contacted", "quoted", "won", "lost"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`chip ${filter === s ? "chip-active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s === "all"
              ? `Dhammaan (${all.length})`
              : `${STATUS_LABEL[s]} (${all.filter((i) => i.status === s).length})`}
          </button>
        ))}
      </div>

      {(update.isError || remove.isError) && (
        <ErrorMessage error={update.error ?? remove.error} />
      )}

      {shown.length === 0 ? (
        <div className="empty-state">
          <h3>Codsi ma jiro</h3>
          <p>Marka qof foomka Hire me soo buuxiyo, halkan ayuu ka muuqan doonaa.</p>
        </div>
      ) : (
        <div className="admin-list">
          {shown.map((inq) => (
            <InquiryCard
              key={inq.id}
              inquiry={inq}
              packageTitle={inq.package_id ? packageTitle.get(inq.package_id) : undefined}
              onUpdate={(patch) => update.mutate({ id: inq.id, patch })}
              onDelete={() => remove.mutate(inq.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InquiryCard({
  inquiry,
  packageTitle,
  onUpdate,
  onDelete,
}: {
  inquiry: ProjectInquiry;
  packageTitle?: string;
  onUpdate: (patch: { status?: InquiryStatus; admin_note?: string }) => void;
  onDelete: () => void;
}) {
  const [note, setNote] = useState(inquiry.admin_note);
  const waLink = whatsappLink(
    inquiry.phone,
    `Asalaamu calaykum ${inquiry.name}, waxaan kaaga jawaabayaa codsigaagii mashruuca (BulbulCourses).`
  );
  const meta = [
    CATEGORY_LABEL[inquiry.project_type],
    packageTitle,
    inquiry.budget || undefined,
    new Date(inquiry.created_at).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  ].filter(Boolean);

  return (
    <div className="card admin-item">
      <div className="admin-item-head">
        <div>
          <h3>{inquiry.name}</h3>
          <p className="admin-item-meta">{meta.join(" · ")}</p>
        </div>
        <select
          className="admin-status-select"
          value={inquiry.status}
          onChange={(e) => onUpdate({ status: e.target.value as InquiryStatus })}
          aria-label="Status"
        >
          {(Object.keys(STATUS_LABEL) as InquiryStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <p className="admin-item-message">{inquiry.message}</p>

      <div className="admin-item-actions">
        <a className="btn btn-secondary btn-sm" href={`tel:${inquiry.phone}`}>
          📞 {inquiry.phone}
        </a>
        {waLink && (
          <a className="btn btn-whatsapp btn-sm" href={waLink} target="_blank" rel="noreferrer noopener">
            💬 WhatsApp
          </a>
        )}
        {inquiry.email && (
          <a className="btn btn-secondary btn-sm" href={`mailto:${inquiry.email}`}>
            ✉️ {inquiry.email}
          </a>
        )}
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() => {
            if (window.confirm(`Tirtir codsiga ${inquiry.name}?`)) onDelete();
          }}
        >
          🗑
        </button>
      </div>

      <label className="admin-note">
        Qoraal gaar ah (adiga kaliya)
        <textarea
          rows={2}
          value={note}
          placeholder="tusaale: qiimo $450 ayaan u sheegay"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== inquiry.admin_note && onUpdate({ admin_note: note })}
        />
      </label>
    </div>
  );
}

// ── Packages ─────────────────────────────────────────────────────────────

interface PackageDraft {
  id: string | null;
  category: ServiceCategory;
  title: string;
  description: string;
  price_from: string;
  delivery_time: string;
  features: string;
  is_featured: boolean;
  is_active: boolean;
  sort_order: string;
}

const emptyPackage: PackageDraft = {
  id: null,
  category: "mobile",
  title: "",
  description: "",
  price_from: "",
  delivery_time: "",
  features: "",
  is_featured: false,
  is_active: false,
  sort_order: "0",
};

function toPackageDraft(p: ServicePackage): PackageDraft {
  return {
    id: p.id,
    category: p.category,
    title: p.title,
    description: p.description,
    price_from: p.price_from === null ? "" : String(p.price_from),
    delivery_time: p.delivery_time,
    features: p.features.join("\n"),
    is_featured: p.is_featured,
    is_active: p.is_active,
    sort_order: String(p.sort_order),
  };
}

function fromPackageDraft(d: PackageDraft): PackageInput {
  if (d.title.trim().length < 2) throw new Error("Geli magaca xirmada.");
  const price = d.price_from.trim();
  if (price !== "" && !(Number(price) >= 0)) throw new Error("Qiimaha sax ma aha.");
  return {
    category: d.category,
    title: d.title.trim(),
    description: d.description.trim(),
    price_from: price === "" ? null : Number(price),
    delivery_time: d.delivery_time.trim(),
    features: d.features.split("\n").map((f) => f.trim()).filter(Boolean),
    is_featured: d.is_featured,
    is_active: d.is_active,
    sort_order: Number(d.sort_order) || 0,
  };
}

function PackagesTab() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PackageDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const packagesQuery = useQuery({
    queryKey: ["service-packages"],
    queryFn: () => HireService.packages(),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["service-packages"] });

  const save = useMutation({
    mutationFn: async (d: PackageDraft) => {
      const input = fromPackageDraft(d);
      if (d.id) await HireService.updatePackage(d.id, input);
      else await HireService.createPackage(input);
    },
    onSuccess: () => {
      setDraft(null);
      setFormError(null);
      void refresh();
    },
    onError: (e) => setFormError(errText(e, "Lama keydin.")),
  });
  const quick = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<PackageInput> }) =>
      HireService.updatePackage(id, patch),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => HireService.deletePackage(id),
    onSuccess: refresh,
  });

  if (packagesQuery.isPending) return <Spinner label="Loading packages…" />;
  if (packagesQuery.isError) {
    return <ErrorMessage error={packagesQuery.error} onRetry={() => packagesQuery.refetch()} />;
  }

  const set = <K extends keyof PackageDraft>(key: K, value: PackageDraft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <div>
      <div className="admin-subhead">
        <p className="muted">
          Xirmo kasta: magac, qiimaha laga bilaabo, iyo waxa ku jira. Kaliya kuwa{" "}
          <strong>shidan</strong> ayaa dadka u muuqda.
        </p>
        {!draft && (
          <button type="button" className="btn btn-primary" onClick={() => setDraft(emptyPackage)}>
            + Xirmo cusub
          </button>
        )}
      </div>

      {draft && (
        <div className="card admin-form">
          <h3>{draft.id ? "Wax ka beddel xirmada" : "Xirmo cusub"}</h3>
          {formError && <div className="error-box">{formError}</div>}
          <div className="form-row">
            <label>
              Nooca
              <select
                value={draft.category}
                onChange={(e) => set("category", e.target.value as ServiceCategory)}
              >
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Magaca xirmada
              <input
                type="text"
                value={draft.title}
                placeholder="tusaale: Mobile App — Bilow"
                onChange={(e) => set("title", e.target.value)}
              />
            </label>
          </div>
          <label>
            Sharaxaad gaaban
            <input
              type="text"
              value={draft.description}
              placeholder="Cidda ay ku habboon tahay"
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
          <div className="form-row">
            <label>
              Laga bilaabo (USD)
              <input
                type="number"
                min="0"
                step="1"
                value={draft.price_from}
                placeholder="bannaan = la isla gaarayaa"
                onChange={(e) => set("price_from", e.target.value)}
              />
            </label>
            <label>
              Muddada
              <input
                type="text"
                value={draft.delivery_time}
                placeholder="tusaale: 3–5 toddobaad"
                onChange={(e) => set("delivery_time", e.target.value)}
              />
            </label>
          </div>
          <label>
            Waxa ku jira — hal walax sadar kasta
            <textarea
              rows={5}
              value={draft.features}
              placeholder={"Android & iPhone\nLogin iyo xisaab isticmaale\nPlay Store gelin"}
              onChange={(e) => set("features", e.target.value)}
            />
          </label>
          <div className="check-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
              />
              Shidan (dadka u muuqda)
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={draft.is_featured}
                onChange={(e) => set("is_featured", e.target.checked)}
              />
              ★ Ugu caansan
            </label>
            <label className="checkbox-label">
              Kala horreynta
              <input
                type="number"
                className="sort-input"
                value={draft.sort_order}
                onChange={(e) => set("sort_order", e.target.value)}
              />
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={save.isPending}
              onClick={() => save.mutate(draft)}
            >
              {save.isPending ? "Keydinaya…" : "Keydi"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDraft(null);
                setFormError(null);
              }}
            >
              Jooji
            </button>
          </div>
        </div>
      )}

      {(quick.isError || remove.isError) && <ErrorMessage error={quick.error ?? remove.error} />}

      {packagesQuery.data.length === 0 ? (
        !draft && (
          <div className="empty-state">
            <h3>Wali xirmo ma jirto</h3>
            <p>Ku dar xirmadaada ugu horreysa — tusaale Mobile App, Website, System.</p>
          </div>
        )
      ) : (
        <div className="admin-list">
          {packagesQuery.data.map((p) => (
            <div key={p.id} className="card admin-item">
              <div className="admin-item-head">
                <div>
                  <h3>
                    {p.title} {p.is_featured && <span className="badge badge-featured">★</span>}
                  </h3>
                  <p className="admin-item-meta">
                    {CATEGORY_LABEL[p.category]} ·{" "}
                    {p.price_from === null
                      ? "Qiime la'aan"
                      : `Laga bilaabo ${formatPrice(p.price_from, p.currency)}`}
                    {p.delivery_time && ` · ${p.delivery_time}`} · {p.features.length} walax
                  </p>
                </div>
                <span className={`badge ${p.is_active ? "badge-published" : "badge-draft"}`}>
                  {p.is_active ? "Shidan" : "Dansan"}
                </span>
              </div>
              <div className="admin-item-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={quick.isPending}
                  onClick={() => quick.mutate({ id: p.id, patch: { is_active: !p.is_active } })}
                >
                  {p.is_active ? "Dami" : "Shid"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setFormError(null);
                    setDraft(toPackageDraft(p));
                  }}
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (window.confirm(`Tirtir "${p.title}"?`)) remove.mutate(p.id);
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Portfolio ────────────────────────────────────────────────────────────

interface ProjectDraft {
  id: string | null;
  category: ServiceCategory;
  title: string;
  description: string;
  image_url: string | null;
  project_url: string;
  is_active: boolean;
  sort_order: string;
}

const emptyProject: ProjectDraft = {
  id: null,
  category: "mobile",
  title: "",
  description: "",
  image_url: null,
  project_url: "",
  is_active: false,
  sort_order: "0",
};

function fromProjectDraft(d: ProjectDraft): PortfolioInput {
  if (d.title.trim().length < 2) throw new Error("Geli magaca mashruuca.");
  const url = d.project_url.trim();
  if (url !== "" && !/^https?:\/\//i.test(url)) {
    throw new Error("Link-gu waa inuu ku bilowdaa https://");
  }
  return {
    category: d.category,
    title: d.title.trim(),
    description: d.description.trim(),
    image_url: d.image_url,
    project_url: url === "" ? null : url,
    is_active: d.is_active,
    sort_order: Number(d.sort_order) || 0,
  };
}

function PortfolioTab() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const portfolioQuery = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => HireService.portfolio(),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["portfolio"] });

  const save = useMutation({
    mutationFn: async (d: ProjectDraft) => {
      const input = fromProjectDraft(d);
      if (d.id) await HireService.updateProject(d.id, input);
      else await HireService.createProject(input);
    },
    onSuccess: () => {
      setDraft(null);
      setFormError(null);
      void refresh();
    },
    onError: (e) => setFormError(errText(e, "Lama keydin.")),
  });
  const quick = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      HireService.updateProject(id, { is_active }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => HireService.deleteProject(id),
    onSuccess: refresh,
  });

  async function upload(file: File) {
    setUploading(true);
    setFormError(null);
    try {
      const url = await HireService.uploadProjectImage(file);
      setDraft((d) => (d ? { ...d, image_url: url } : d));
    } catch (e) {
      setFormError(errText(e, "Sawirka lama soo gelin."));
    } finally {
      setUploading(false);
    }
  }

  if (portfolioQuery.isPending) return <Spinner label="Loading projects…" />;
  if (portfolioQuery.isError) {
    return <ErrorMessage error={portfolioQuery.error} onRetry={() => portfolioQuery.refetch()} />;
  }

  const set = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <div>
      <div className="admin-subhead">
        <p className="muted">Mashaariicdii hore ee aad dhistay — sawir, sharaxaad iyo link.</p>
        {!draft && (
          <button type="button" className="btn btn-primary" onClick={() => setDraft(emptyProject)}>
            + Mashruuc cusub
          </button>
        )}
      </div>

      {draft && (
        <div className="card admin-form">
          <h3>{draft.id ? "Wax ka beddel mashruuca" : "Mashruuc cusub"}</h3>
          {formError && <div className="error-box">{formError}</div>}
          <div className="form-row">
            <label>
              Nooca
              <select
                value={draft.category}
                onChange={(e) => set("category", e.target.value as ServiceCategory)}
              >
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Magaca mashruuca
              <input type="text" value={draft.title} onChange={(e) => set("title", e.target.value)} />
            </label>
          </div>
          <label>
            Sharaxaad
            <textarea
              rows={3}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
          <label>
            Link (ikhtiyaari)
            <input
              type="url"
              value={draft.project_url}
              placeholder="https://…"
              onChange={(e) => set("project_url", e.target.value)}
            />
          </label>
          <label>
            Sawir
            {draft.image_url && (
              <img src={draft.image_url} alt="" className="thumbnail-preview" />
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </label>
          {uploading && <Spinner label="Soo gelinaya sawirka…" />}
          <div className="check-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
              />
              Shidan (dadka u muuqda)
            </label>
            <label className="checkbox-label">
              Kala horreynta
              <input
                type="number"
                className="sort-input"
                value={draft.sort_order}
                onChange={(e) => set("sort_order", e.target.value)}
              />
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={save.isPending || uploading}
              onClick={() => save.mutate(draft)}
            >
              {save.isPending ? "Keydinaya…" : "Keydi"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDraft(null);
                setFormError(null);
              }}
            >
              Jooji
            </button>
          </div>
        </div>
      )}

      {(quick.isError || remove.isError) && <ErrorMessage error={quick.error ?? remove.error} />}

      {portfolioQuery.data.length === 0 ? (
        !draft && (
          <div className="empty-state">
            <h3>Wali mashruuc ma jiro</h3>
            <p>Ku dar 2–4 mashruuc oo aad ku faanto.</p>
          </div>
        )
      ) : (
        <div className="admin-list">
          {portfolioQuery.data.map((p: PortfolioProject) => (
            <div key={p.id} className="card admin-item">
              <div className="admin-item-head">
                <div>
                  <h3>{p.title}</h3>
                  <p className="admin-item-meta">
                    {CATEGORY_LABEL[p.category]}
                    {p.project_url && ` · ${p.project_url}`}
                    {p.image_url ? " · 🖼 sawir" : " · sawir la'aan"}
                  </p>
                </div>
                <span className={`badge ${p.is_active ? "badge-published" : "badge-draft"}`}>
                  {p.is_active ? "Shidan" : "Dansan"}
                </span>
              </div>
              <div className="admin-item-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={quick.isPending}
                  onClick={() => quick.mutate({ id: p.id, is_active: !p.is_active })}
                >
                  {p.is_active ? "Dami" : "Shid"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setFormError(null);
                    setDraft({
                      id: p.id,
                      category: p.category,
                      title: p.title,
                      description: p.description,
                      image_url: p.image_url,
                      project_url: p.project_url ?? "",
                      is_active: p.is_active,
                      sort_order: String(p.sort_order),
                    });
                  }}
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (window.confirm(`Tirtir "${p.title}"?`)) remove.mutate(p.id);
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── WhatsApp number ──────────────────────────────────────────────────────

function WhatsAppTab({ settings }: { settings: Settings | undefined }) {
  const queryClient = useQueryClient();
  const [edited, setEdited] = useState<string | null>(null);
  const value = edited ?? settings?.whatsapp_number ?? "";
  const preview = whatsappLink(value, "Tijaabo — BulbulCourses");

  const save = useMutation({
    mutationFn: (v: string) => SettingsService.set("whatsapp_number", v.trim()),
    onSuccess: () => {
      setEdited(null);
      void queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
  });

  return (
    <div className="card admin-form">
      <h3>Lambarka WhatsApp</h3>
      <p className="muted">
        Wuxuu ka muuqdaa badhamada WhatsApp ee bogga Hire me iyo ballamaha.{" "}
        <strong>Waa mid dadweyne</strong> — qof kasta oo booqda ayaa arki kara.
      </p>
      {save.isSuccess && edited === null && <div className="success-box">La keydiyay.</div>}
      {save.isError && <ErrorMessage error={save.error} />}
      <label>
        Lambarka
        <input
          type="tel"
          value={value}
          placeholder="252 61 5123456"
          onChange={(e) => setEdited(e.target.value)}
        />
      </label>
      {value.trim() !== "" && !preview && (
        <span className="field-error">Lambarkan sax ma aha.</span>
      )}
      {preview && (
        <a className="field-hint" href={preview} target="_blank" rel="noreferrer noopener">
          Tijaabi link-ga WhatsApp ↗
        </a>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={save.isPending || (value.trim() !== "" && !preview)}
          onClick={() => save.mutate(value)}
        >
          {save.isPending ? "Keydinaya…" : "Keydi"}
        </button>
      </div>
    </div>
  );
}
