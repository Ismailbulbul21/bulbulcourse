import { invokeFunction } from "../lib/functions";

export interface PresignedUpload {
  mode: "single" | "multipart";
  video_key: string;
  /** single mode */
  upload_url?: string;
  /** multipart mode */
  part_size?: number;
  part_urls?: string[];
  complete_url?: string;
  abort_url?: string;
}

export interface UploadHandle {
  promise: Promise<void>;
  abort: () => void;
}

const CONCURRENCY = 4; // parallel part uploads — much faster on long-distance links
const MAX_ATTEMPTS = 3; // per-part retries so one hiccup doesn't kill a big upload

export const UploadService = {
  /** Ask the create-upload-url edge function (admin only) for presigned upload URLs. */
  requestUploadUrl(
    lessonId: string,
    filename: string,
    contentType: string,
    size: number
  ): Promise<PresignedUpload> {
    return invokeFunction<PresignedUpload>("create-upload-url", {
      lesson_id: lessonId,
      filename,
      content_type: contentType,
      size,
    });
  },

  /** Route to single PUT or parallel multipart depending on what the server returned. */
  upload(
    presigned: PresignedUpload,
    file: Blob,
    onProgress: (pct: number) => void
  ): UploadHandle {
    if (presigned.mode === "multipart") {
      return multipartUpload(presigned, file, onProgress);
    }
    return singleUpload(presigned.upload_url!, file, onProgress);
  },

  /** Read a video file's duration locally (used to store duration_seconds). */
  getVideoDuration(file: Blob): Promise<number> {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : 0);
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(0);
      };
      video.src = URL.createObjectURL(file);
    });
  },
};

function singleUpload(
  url: string,
  file: Blob,
  onProgress: (pct: number) => void
): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<void>((resolve, reject) => {
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed with status ${xhr.status}`));
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Upload failed. Check your connection and the Contabo bucket CORS configuration."
        )
      );
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(file);
  });
  return { promise, abort: () => xhr.abort() };
}

/**
 * S3 multipart upload straight from the browser:
 * 16MB parts, 4 in parallel, each retried up to 3 times, then a presigned
 * CompleteMultipartUpload POST assembles the object on Contabo.
 */
function multipartUpload(
  presigned: PresignedUpload,
  file: Blob,
  onProgress: (pct: number) => void
): UploadHandle {
  const partSize = presigned.part_size!;
  const urls = presigned.part_urls!;
  const total = file.size;
  const loadedByPart = new Array<number>(urls.length).fill(0);
  const etags = new Array<string | null>(urls.length).fill(null);
  const attempts = new Array<number>(urls.length).fill(0);
  const inFlight = new Set<XMLHttpRequest>();
  let cancelled = false;
  let settled = false;

  let rejectFn: (e: Error) => void = () => {};
  let resolveFn: () => void = () => {};

  function reportProgress() {
    const loaded = loadedByPart.reduce((a, b) => a + b, 0);
    onProgress(Math.min(99, Math.round((loaded / total) * 100)));
  }

  function abortRemote() {
    if (presigned.abort_url) {
      void fetch(presigned.abort_url, { method: "DELETE" }).catch(() => {});
    }
  }

  function settleReject(err: Error) {
    if (settled) return;
    settled = true;
    for (const x of inFlight) x.abort();
    abortRemote();
    rejectFn(err);
  }

  const promise = new Promise<void>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;

    const queue: number[] = urls.map((_, i) => i);
    let active = 0;

    function pump() {
      if (settled || cancelled) return;
      while (active < CONCURRENCY && queue.length > 0) {
        const index = queue.shift()!;
        active++;
        startPart(index);
      }
    }

    function startPart(index: number) {
      attempts[index]++;
      const start = index * partSize;
      const chunk = file.slice(start, Math.min(start + partSize, total));
      const xhr = new XMLHttpRequest();
      inFlight.add(xhr);
      xhr.open("PUT", urls[index]);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          loadedByPart[index] = e.loaded;
          reportProgress();
        }
      };
      xhr.onload = () => {
        inFlight.delete(xhr);
        active--;
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag");
          if (!etag) {
            settleReject(
              new Error(
                "Storage did not expose the upload ETag — check the bucket CORS ExposeHeaders setting."
              )
            );
            return;
          }
          etags[index] = etag;
          loadedByPart[index] = chunk.size;
          reportProgress();
          if (etags.every(Boolean)) {
            void completeUpload();
          } else {
            pump();
          }
        } else {
          retryOrFail(index, new Error(`Part ${index + 1} failed (status ${xhr.status})`));
        }
      };
      xhr.onerror = () => {
        inFlight.delete(xhr);
        active--;
        retryOrFail(index, new Error("Network error during upload."));
      };
      xhr.onabort = () => {
        inFlight.delete(xhr);
        active--;
      };
      xhr.send(chunk);
    }

    function retryOrFail(index: number, err: Error) {
      if (settled || cancelled) return;
      if (attempts[index] < MAX_ATTEMPTS) {
        loadedByPart[index] = 0;
        queue.push(index);
        pump();
      } else {
        settleReject(err);
      }
    }

    async function completeUpload() {
      try {
        const xml = `<CompleteMultipartUpload>${etags
          .map((tag, i) => `<Part><PartNumber>${i + 1}</PartNumber><ETag>${tag}</ETag></Part>`)
          .join("")}</CompleteMultipartUpload>`;
        const res = await fetch(presigned.complete_url!, {
          method: "POST",
          body: xml,
          headers: { "Content-Type": "application/xml" },
        });
        const text = await res.text();
        if (!res.ok || text.includes("<Error>")) {
          throw new Error("Could not finalize the upload. Please try again.");
        }
        if (!settled) {
          settled = true;
          onProgress(100);
          resolveFn();
        }
      } catch (e) {
        settleReject(
          e instanceof Error ? e : new Error("Could not finalize the upload.")
        );
      }
    }

    pump();
  });

  return {
    promise,
    abort: () => {
      cancelled = true;
      settleReject(new Error("Upload cancelled"));
    },
  };
}
