import { invokeFunction } from "../lib/functions";

export interface PresignedUpload {
  upload_url: string;
  video_key: string;
}

export interface UploadHandle {
  promise: Promise<void>;
  abort: () => void;
}

export const UploadService = {
  /** Ask the create-upload-url edge function (admin only) for a presigned PUT. */
  requestUploadUrl(
    lessonId: string,
    filename: string,
    contentType: string
  ): Promise<PresignedUpload> {
    return invokeFunction<PresignedUpload>("create-upload-url", {
      lesson_id: lessonId,
      filename,
      content_type: contentType,
    });
  },

  /**
   * Upload the file straight to Contabo with the presigned URL.
   * XHR (not fetch) so we get real upload progress events and cancel support.
   */
  uploadToUrl(
    url: string,
    file: File,
    onProgress: (pct: number) => void
  ): UploadHandle {
    const xhr = new XMLHttpRequest();
    const promise = new Promise<void>((resolve, reject) => {
      xhr.open("PUT", url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
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
  },

  /** Read a video file's duration locally (used to store duration_seconds). */
  getVideoDuration(file: File): Promise<number> {
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
