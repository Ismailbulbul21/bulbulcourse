import { supabase, queryTimeoutSignal, toError } from "../lib/supabase";
import type {
  InquiryStatus,
  PortfolioProject,
  ProjectInquiry,
  ServiceCategory,
  ServicePackage,
} from "../types/db";

export type PackageInput = Pick<
  ServicePackage,
  | "category"
  | "title"
  | "description"
  | "price_from"
  | "delivery_time"
  | "features"
  | "is_featured"
  | "is_active"
  | "sort_order"
>;

export type PortfolioInput = Pick<
  PortfolioProject,
  "category" | "title" | "description" | "image_url" | "project_url" | "is_active" | "sort_order"
>;

export interface NewInquiry {
  name: string;
  phone: string;
  email: string | null;
  project_type: ServiceCategory;
  package_id: string | null;
  budget: string;
  message: string;
  user_id: string | null;
}

export const HireService = {
  /** Visitors get active packages only (RLS); admins get every package. */
  async packages(): Promise<ServicePackage[]> {
    const { data, error } = await supabase
      .from("service_packages")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as ServicePackage[];
  },

  async createPackage(input: PackageInput): Promise<ServicePackage> {
    const { data, error } = await supabase
      .from("service_packages")
      .insert(input)
      .select()
      .single();
    if (error) throw toError(error);
    return data as ServicePackage;
  },

  async updatePackage(id: string, patch: Partial<PackageInput>): Promise<void> {
    const { error } = await supabase.from("service_packages").update(patch).eq("id", id);
    if (error) throw toError(error);
  },

  async deletePackage(id: string): Promise<void> {
    const { error } = await supabase.from("service_packages").delete().eq("id", id);
    if (error) throw toError(error);
  },

  /** Visitors get active projects only (RLS); admins get every project. */
  async portfolio(): Promise<PortfolioProject[]> {
    const { data, error } = await supabase
      .from("portfolio_projects")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as PortfolioProject[];
  },

  async createProject(input: PortfolioInput): Promise<PortfolioProject> {
    const { data, error } = await supabase
      .from("portfolio_projects")
      .insert(input)
      .select()
      .single();
    if (error) throw toError(error);
    return data as PortfolioProject;
  },

  async updateProject(id: string, patch: Partial<PortfolioInput>): Promise<void> {
    const { error } = await supabase.from("portfolio_projects").update(patch).eq("id", id);
    if (error) throw toError(error);
  },

  async deleteProject(id: string): Promise<void> {
    const { error } = await supabase.from("portfolio_projects").delete().eq("id", id);
    if (error) throw toError(error);
  },

  /** Portfolio screenshots live in the public thumbnails bucket (admin upload only). */
  async uploadProjectImage(file: File): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `portfolio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from("thumbnails")
      .upload(path, file, { cacheControl: "3600" });
    if (error) throw toError(error);
    return supabase.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
  },

  /**
   * Anyone can send a request. Deliberately no .select(): visitors are not
   * allowed to read requests back, including their own.
   */
  async submitInquiry(input: NewInquiry): Promise<void> {
    const { error } = await supabase.from("project_inquiries").insert(input);
    if (error) throw toError(error);
  },

  // ── Admin ──────────────────────────────────────────────────────────────

  async inquiries(): Promise<ProjectInquiry[]> {
    const { data, error } = await supabase
      .from("project_inquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300)
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as ProjectInquiry[];
  },

  async updateInquiry(
    id: string,
    patch: Partial<{ status: InquiryStatus; admin_note: string }>
  ): Promise<void> {
    const { error } = await supabase.from("project_inquiries").update(patch).eq("id", id);
    if (error) throw toError(error);
  },

  async deleteInquiry(id: string): Promise<void> {
    const { error } = await supabase.from("project_inquiries").delete().eq("id", id);
    if (error) throw toError(error);
  },
};
