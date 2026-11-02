import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WHATSAPP_INVITE, WhatsAppService } from "../../services/whatsapp.service";

export default function WhatsAppLinkForm({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const linkQuery = useQuery({
    queryKey: ["whatsapp", courseId],
    queryFn: () => WhatsAppService.linkFor(courseId),
  });
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (linkQuery.data !== undefined) setValue(linkQuery.data ?? "");
  }, [linkQuery.data]);

  const trimmed = value.trim();
  const valid = trimmed === "" || WHATSAPP_INVITE.test(trimmed);

  const save = useMutation({
    mutationFn: () => WhatsAppService.save(courseId, trimmed || null),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ["whatsapp"] });
    },
  });

  return (
    <div className="card">
      <h3>WhatsApp group</h3>
      <p className="muted">
        Paste the group's invite link. Only students who bought this course can see it
        and join. In WhatsApp, turn on "Approve new members" so a forwarded link can't
        let others in.
      </p>
      <form
        className="form-card"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          if (valid) save.mutate();
        }}
      >
        <input
          type="url"
          placeholder="https://chat.whatsapp.com/…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          disabled={linkQuery.isPending}
        />
        {!valid && (
          <span className="field-error">The link must start with https://chat.whatsapp.com/</span>
        )}
        {save.isError && <div className="error-box">{(save.error as Error).message}</div>}
        {saved && <div className="success-box">WhatsApp link saved.</div>}
        <button type="submit" className="btn btn-primary" disabled={!valid || save.isPending}>
          {save.isPending ? "Saving…" : trimmed ? "Save link" : "Remove link"}
        </button>
      </form>
    </div>
  );
}
