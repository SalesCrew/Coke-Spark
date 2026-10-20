export type SmPhotoCommitItem = {
  storageBucket: "sm-visit-photos"; storagePath: string; originalFileName?: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp"; byteSize: number;
};

export type SmPhotoUploadJob = {
  source: File; prepared?: File; answerId?: string; photo?: SmPhotoCommitItem;
  signedUrl?: string; signedAtMs?: number; uploaded?: boolean; committed?: boolean; error?: string; ownerKey?: string;
};

type UploadDependencies = {
  initialize: () => Promise<{ answerId: string }>;
  presign: (answerId: string, extension: string) => Promise<{ upload: { path: string; signedUrl: string } }>;
  commit: (answerId: string, photo: SmPhotoCommitItem) => Promise<unknown>;
  isCurrent: () => boolean;
  prepare?: (file: File) => Promise<File>;
  transfer?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
  onRetry?: (attempt: number) => void;
};

class PhotoHttpError extends Error { constructor(public status: number) { super("Foto konnte nicht übertragen werden."); } }

export function smPhotoErrorMessage(error: unknown): string {
  const status = (error as { status?: number })?.status;
  if (status === 401 || status === 403) return "Bitte prüfe deine Anmeldung. Bereits gespeicherte Fotos bleiben erhalten.";
  if (error instanceof Error && !["TypeError", "AbortError", "TimeoutError", "BackendTimeoutError"].includes(error.name) && !(error instanceof PhotoHttpError)) return error.message;
  return "Foto noch nicht übertragen. Deine gespeicherten Fotos bleiben erhalten.";
}

function retryable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  return error instanceof TypeError || error instanceof Error && ["AbortError", "TimeoutError", "BackendTimeoutError"].includes(error.name)
    || status === 408 || status === 429 || typeof status === "number" && status >= 500 && status < 600;
}

/** Copies bytes before any network wait, so retries don't depend on an Android gallery file handle. */
export async function prepareSmPhoto(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 15 * 1024 * 1024) {
    throw new Error("Bitte wähle ein JPG-, PNG- oder WebP-Foto mit maximal 15 MB.");
  }
  let bytes: ArrayBuffer;
  try { bytes = await file.arrayBuffer(); }
  catch { throw new Error("Dieses Foto kann nicht gelesen werden. Bitte wähle es erneut aus."); }
  const stable = new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
  // Only newly selected, large JPEGs are optimized; saved files and transparent images are untouched.
  if (stable.type !== "image/jpeg" || stable.size <= 2 * 1024 * 1024 || typeof document === "undefined" || typeof createImageBitmap !== "function") return stable;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(stable, { imageOrientation: "from-image" });
    const ratio = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) return stable;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob && blob.size < stable.size ? new File([blob], stable.name, { type: "image/jpeg", lastModified: stable.lastModified }) : stable;
  } catch { return stable; }
  finally { bitmap?.close(); }
}

/** A job retains its path and upload/commit progress across retries. Never deletes any uploaded file. */
export async function saveSmPhotoJob(job: SmPhotoUploadJob, dependencies: UploadDependencies): Promise<void> {
  const assertOwner = () => { if (!dependencies.isCurrent()) throw new Error("Der angemeldete Zugang hat sich geändert."); };
  const retry = async <T>(action: () => Promise<T>): Promise<T> => {
    for (let attempt = 1; ; attempt++) {
      assertOwner();
      try { const result = await action(); assertOwner(); return result; }
      catch (error) {
        assertOwner();
        if (attempt >= 3 || !retryable(error)) throw error;
        dependencies.onRetry?.(attempt + 1);
        await (dependencies.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms))))(attempt * 750);
      }
    }
  };
  assertOwner();
  if (job.committed) return;
  job.error = undefined;
  try {
    job.prepared ??= await (dependencies.prepare ?? prepareSmPhoto)(job.source);
    assertOwner();
    job.answerId ??= (await retry(dependencies.initialize)).answerId;
    if (!job.uploaded && job.signedAtMs && Date.now() - job.signedAtMs > 60 * 60 * 1000) {
      job.photo = undefined; job.signedUrl = undefined;
    }
    if (!job.photo || !job.signedUrl) {
      const extension = job.prepared.type === "image/png" ? "png" : job.prepared.type === "image/webp" ? "webp" : "jpg";
      const { upload } = await retry(() => dependencies.presign(job.answerId!, extension));
      job.signedUrl = upload.signedUrl;
      job.signedAtMs = Date.now();
      job.photo = { storageBucket: "sm-visit-photos", storagePath: upload.path, originalFileName: job.source.name,
        mimeType: job.prepared.type as SmPhotoCommitItem["mimeType"], byteSize: job.prepared.size };
    }
    if (!job.uploaded) {
      await retry(async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 90_000);
        let response: Response;
        try {
          response = await (dependencies.transfer ?? fetch)(job.signedUrl!, {
            method: "PUT", headers: { "content-type": job.prepared!.type }, body: job.prepared, signal: controller.signal,
          });
        } finally { clearTimeout(timer); }
        if (!response.ok) {
          // A previous transfer may have succeeded even if its response was lost. Commit verifies the owned path.
          const body = await response.json().catch(() => ({})) as { error?: string; message?: string; statusCode?: string | number };
          const duplicate = [400, 409].includes(response.status) && (body.error === "Duplicate" || String(body.statusCode) === "409" && /already exists/i.test(body.message ?? ""));
          if (!duplicate) throw new PhotoHttpError(response.status);
        }
      });
      job.uploaded = true;
    }
    await retry(() => dependencies.commit(job.answerId!, job.photo!));
    job.committed = true;
    // The source bytes no longer need to stay in memory once the server has committed them.
    job.prepared = undefined;
  } catch (error) { job.error = smPhotoErrorMessage(error); throw error; }
}
