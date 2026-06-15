import { db, photos } from "@/lib/db";
import { getNewFilesFromFolder } from "@/lib/drive";
import { deleteFromR2, getR2KeyFromUrl } from "@/lib/r2";
import { eq, inArray } from "drizzle-orm";

interface SyncEvent {
  id: string;
  seasonId: string;
  driveFolderId: string;
}

export async function syncEventPhotos(event: SyncEvent) {
  // Drive returns the complete current snapshot. Reconcile it with the DB so
  // deleted Drive files do not remain visible or block replacement uploads.
  const driveFiles = await getNewFilesFromFolder(event.driveFolderId);
  const existing = await db
    .select({
      id: photos.id,
      driveFileId: photos.driveFileId,
      thumbnailUrl: photos.thumbnailUrl,
      thumbnailSm: photos.thumbnailSm,
    })
    .from(photos)
    .where(eq(photos.eventId, event.id));

  const driveIds = new Set(driveFiles.map((file) => file.driveFileId));
  const existingIds = new Set(existing.map((photo) => photo.driveFileId));
  const removed = existing.filter((photo) => !driveIds.has(photo.driveFileId));
  const added = driveFiles.filter((file) => !existingIds.has(file.driveFileId));

  if (removed.length > 0) {
    await db.delete(photos).where(inArray(photos.id, removed.map((photo) => photo.id)));

    for (const photo of removed) {
      for (const url of [photo.thumbnailUrl, photo.thumbnailSm]) {
        if (!url) continue;
        try {
          await deleteFromR2(getR2KeyFromUrl(url));
        } catch (error) {
          console.error(`[SYNC] Failed to delete stale thumbnail ${url}:`, error);
        }
      }
    }
  }

  if (added.length > 0) {
    await db.insert(photos).values(
      added.map((file) => ({
        id: crypto.randomUUID(),
        eventId: event.id,
        seasonId: event.seasonId,
        driveFileId: file.driveFileId,
        driveUrl: file.driveUrl,
        downloadUrl: file.downloadUrl,
        filename: file.filename,
        fileSize: file.fileSize,
        status: "pending" as const,
        createdAt: new Date(),
      }))
    );
  }

  return {
    added: added.length,
    removed: removed.length,
    total: driveFiles.length,
  };
}
