import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CommentService } from "../services/comments.service";
import Spinner from "./Spinner";
import ErrorMessage from "./ErrorMessage";
import type { CourseComment } from "../types/db";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CourseComments({
  courseId,
  currentUserId,
  isAdmin,
}: {
  courseId: string;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["comments", courseId];
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const commentsQuery = useQuery({
    queryKey,
    queryFn: () => CommentService.list(courseId),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey });
  }

  const addComment = useMutation({
    mutationFn: ({ text, parentId }: { text: string; parentId?: string }) =>
      CommentService.add(courseId, text, parentId),
    onSuccess: () => {
      setBody("");
      setReplyBody("");
      setReplyTo(null);
      setFormError(null);
      invalidate();
    },
    onError: (e) =>
      setFormError(e instanceof Error ? e.message : "Could not post your comment."),
  });

  const removeComment = useMutation({
    mutationFn: (id: string) => CommentService.remove(id),
    onSuccess: invalidate,
  });

  const { topLevel, repliesByParent } = useMemo(() => {
    const all = commentsQuery.data ?? [];
    const top: CourseComment[] = [];
    const replies = new Map<string, CourseComment[]>();
    for (const c of all) {
      if (c.parent_id) {
        const arr = replies.get(c.parent_id) ?? [];
        arr.push(c);
        replies.set(c.parent_id, arr);
      } else {
        top.push(c);
      }
    }
    return { topLevel: top, repliesByParent: replies };
  }, [commentsQuery.data]);

  function CommentRow({ c, isReply }: { c: CourseComment; isReply?: boolean }) {
    const mine = c.user_id === currentUserId;
    return (
      <div className={`comment ${isReply ? "comment-reply" : ""}`}>
        <div className="comment-head">
          <span className="comment-author">
            {c.author_name}
            {c.author_is_admin && <span className="comment-badge">Instructor</span>}
          </span>
          <span className="comment-time muted">{timeAgo(c.created_at)}</span>
        </div>
        <p className="comment-body">{c.body}</p>
        <div className="comment-actions">
          {!isReply && (isAdmin || mine) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setReplyTo(replyTo === c.id ? null : c.id);
                setReplyBody("");
              }}
            >
              Reply
            </button>
          )}
          {(mine || isAdmin) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (window.confirm("Delete this comment?")) removeComment.mutate(c.id);
              }}
            >
              Delete
            </button>
          )}
        </div>

        {replyTo === c.id && (
          <form
            className="comment-reply-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (replyBody.trim()) {
                addComment.mutate({ text: replyBody, parentId: c.id });
              }
            }}
          >
            <textarea
              rows={2}
              placeholder="Write a reply…"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!replyBody.trim() || addComment.isPending}
            >
              {addComment.isPending ? "Posting…" : "Post reply"}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <section className="comments">
      <h2>
        Su'aalo &amp; Talo <span className="bi-en">Questions &amp; feedback</span>
      </h2>
      <p className="muted">
        Ask a question, report an issue, or tell us what you'd like to see. The
        instructor replies here.
      </p>

      <form
        className="comment-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) addComment.mutate({ text: body });
        }}
      >
        <textarea
          rows={3}
          placeholder="Write your question or feedback…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {formError && <div className="error-box">{formError}</div>}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!body.trim() || addComment.isPending}
        >
          {addComment.isPending ? "Posting…" : "Post comment"}
        </button>
      </form>

      {commentsQuery.isPending ? (
        <Spinner label="Loading comments…" />
      ) : commentsQuery.isError ? (
        <ErrorMessage error={commentsQuery.error} onRetry={() => commentsQuery.refetch()} />
      ) : topLevel.length === 0 ? (
        <p className="muted comment-empty">No comments yet — be the first to ask.</p>
      ) : (
        <div className="comment-list">
          {topLevel.map((c) => (
            <div key={c.id} className="comment-thread">
              <CommentRow c={c} />
              {(repliesByParent.get(c.id) ?? []).map((r) => (
                <CommentRow key={r.id} c={r} isReply />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
