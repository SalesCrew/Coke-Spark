import type { SmArchivePhoto, SmPhotoArchiveApi, SmPhotoArchiveFilters } from "@/types/smPhotoArchive";

const MAX_EXPORT_BYTES = 150 * 1024 * 1024;
const safeName = (value: string) => value.normalize("NFKC").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/^[. ]+|[. ]+$/g, "").slice(0, 100) || "Foto";
const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  return `"${(/^[\s]*[=+\-@]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
};
export function smPhotoArchiveManifest(photos: SmArchivePhoto[]) {
  const fields = ["Foto-ID", "Fragebogentyp", "Besuchsdatum", "SM", "Markt", "Adresse", "Fragebogen", "Version", "Modul", "Fotofrage", "Dateiname"];
  return "\uFEFF" + [fields, ...photos.map(photo => [photo.id, photo.SMDurcharbeitCatalogScope === "SMDurcharbeit" ? "Durcharbeit" : "Standardfragebogen", photo.workDate,
    photo.smName, photo.marketName, [photo.address, photo.postalCode, photo.city].filter(Boolean).join(" · "), photo.questionnaireName, photo.questionnaireVersion,
    photo.moduleName, photo.questionText, photo.fileName])].map(row => row.map(csvCell).join(";")).join("\r\n");
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportSmArchivePhotos({ api, filters, isCurrent, onProgress, save = download, fetchPhoto = fetch }: {
  api: SmPhotoArchiveApi; filters: SmPhotoArchiveFilters; isCurrent: () => boolean; onProgress: (value: string) => void;
  save?: (blob: Blob, name: string) => void; fetchPhoto?: typeof fetch;
}) {
  const ensureOwner = () => { if (!isCurrent()) throw new Error("Der angemeldete Zugang hat sich geändert."); };
  ensureOwner();
  const { photos } = await api.export(filters); ensureOwner();
  if (!photos.length) throw new Error("Für diese Filter sind keine Fotos zum Exportieren vorhanden.");
  if (photos.length > 250) throw new Error("Bitte grenze den Export auf maximal 250 Fotos ein.");
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip(); let completed = 0, byteSize = 0;
  for (let offset = 0; offset < photos.length; offset += 60) {
    ensureOwner();
    const batch = photos.slice(offset, offset + 60), result = await api.urls(batch.map(photo => photo.id)); ensureOwner();
    const urls = new Map(result.photos.map(photo => [photo.id, photo.signedUrl]));
    for (let chunk = 0; chunk < batch.length; chunk += 4) {
      await Promise.all(batch.slice(chunk, chunk + 4).map(async photo => {
        ensureOwner();
        const url = urls.get(photo.id);
        if (!url) throw new Error("Ein Foto ist nicht mehr verfügbar. Bitte aktualisiere die Ansicht und starte den Export erneut.");
        const response = await fetchPhoto(url, { credentials: "omit", signal: AbortSignal.timeout(30_000) });
        ensureOwner();
        if (!response.ok) throw new Error("Ein Foto konnte nicht heruntergeladen werden. Bitte starte den Export erneut.");
        const bytes = await response.arrayBuffer(); ensureOwner();
        byteSize += bytes.byteLength;
        if (byteSize > MAX_EXPORT_BYTES) throw new Error("Der Export überschreitet 150 MB. Bitte grenze die Filter weiter ein.");
        const extension = photo.mimeType === "image/png" ? "png" : photo.mimeType === "image/webp" ? "webp" : "jpg";
        const folder = photo.SMDurcharbeitCatalogScope === "SMDurcharbeit" ? "Durcharbeit" : "Standardfragebogen";
        zip.file(`${folder}/${photo.workDate}_${safeName(photo.marketName)}/${photo.id}_${safeName(photo.fileName ?? `Foto.${extension}`)}`, bytes);
        completed += 1; onProgress(`${completed} / ${photos.length} Fotos geladen`);
      }));
    }
  }
  zip.file("Fotoliste.csv", smPhotoArchiveManifest(photos));
  onProgress("ZIP wird erstellt …");
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "STORE" }); ensureOwner();
  save(new Blob([new Uint8Array(bytes)], { type: "application/zip" }), `CokeSpark_SM_Fotoarchiv_${new Date().toISOString().slice(0, 10)}.zip`);
  return { count: photos.length };
}
