export default function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="pagination">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        ← Previous
      </button>
      <span className="pagination-info">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}
