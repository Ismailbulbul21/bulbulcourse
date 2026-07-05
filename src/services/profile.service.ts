import { supabase, toError } from "../lib/supabase";
import type { Profile } from "../types/db";

export const ProfileService = {
  async update(
    id: string,
    patch: { full_name?: string; avatar_url?: string }
  ): Promise<Profile> {
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw toError(error);
    return data as Profile;
  },
};
