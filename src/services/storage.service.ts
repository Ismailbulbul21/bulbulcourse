import { supabase, toError } from "../lib/supabase";
import type { LessonResource } from "../types/db";

/**
 * Supabase Storage is for SMALL files only (thumbnails, PDFs, resources).
 * Lesson videos always go to Contabo via the upload.service presign flow.
 */
export const StorageService = {
  async uploadThumbnail(courseId: string, file: File): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `courses/${courseId}/thumbnail-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("thumbnails")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) throw toError(error);
    const { data } = supabase.storage.from("thumbnails").getPublicUrl(path);
    return data.publicUrl;
  },

  async uploadResource(
    courseId: string,
    lessonId: string,
    file: File
  ): Promise<LessonResource> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `courses/${courseId}/lessons/${lessonId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("resources").upload(path, file);
    if (error) throw toError(error);
    const { data } = supabase.storage.from("resources").getPublicUrl(path);
    return { name: file.name, url: data.publicUrl };
  },
};
