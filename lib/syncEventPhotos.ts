import { db, photoFaceEmbeddings, photos } from "@/lib/db";
import { getNewFilesFromFolder } from "@/lib/drive";
import { deleteFromR2, getR2KeyFromUrl } from "@/lib/r2";
import { enqueuePhotoTasks } from "@/lib/taskQueue";
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
      sourceModifiedAt: photos.sourceModifiedAt,
      sourceChecksum: photos.sourceChecksum,
    })
    .from(photos)
    .where(eq(photos.eventId, event.id));

  const driveIds = new Set(driveFiles.map((file) => file.driveFileId));
  const existingIds = new Set(existing.map((photo) => photo.driveFileId));
  const removed = existing.filter((photo) => !driveIds.has(photo.driveFileId));
  const added = driveFiles.filter((file) => !existingIds.has(file.driveFileId));
  const existingByDriveId = new Map(existing.map((photo) => [photo.driveFileId, photo]));
  const modified = driveFiles.filter((file) => {
    const current = existingByDriveId.get(file.driveFileId);
    if (!current) return false;
    return (
      (file.checksum && file.checksum !== current.sourceChecksum) ||
      file.modifiedAt.getTime() !== current.sourceModifiedAt?.getTime()
    );
  });

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

  const queuedIds: string[] = [];
  if (added.length > 0) {
    const values = added.map((file) => ({
        id: crypto.randomUUID(),
        eventId: event.id,
        seasonId: event.seasonId,
        driveFileId: file.driveFileId,
        driveUrl: file.driveUrl,
        downloadUrl: file.downloadUrl,
        filename: file.filename,
        fileSize: file.fileSize,
        sourceModifiedAt: file.modifiedAt,
        sourceChecksum: file.checksum,
        sourceSyncStatus: "active",
        status: "pending" as const,
        processingState: "queued",
        createdAt: new Date(),
      }));
    await db.insert(photos).values(values);
    queuedIds.push(...values.map((photo) => photo.id));
  }

  for (const file of modified) {
    const current = existingByDriveId.get(file.driveFileId)!;
    await db.delete(photoFaceEmbeddings).where(eq(photoFaceEmbeddings.photoId, current.id));
    await db.update(photos).set({
      filename: file.filename,
      fileSize: file.fileSize,
      driveUrl: file.driveUrl,
      downloadUrl: file.downloadUrl,
      sourceModifiedAt: file.modifiedAt,
      sourceChecksum: file.checksum,
      sourceSyncStatus: "active",
      thumbnailUrl: null,
      thumbnailSm: null,
      status: "pending",
      processingState: "queued",
      processingVersion: null,
      rejectReason: null,
      processedAt: null,
    }).where(eq(photos.id, current.id));
    queuedIds.push(current.id);

    for (const url of [current.thumbnailUrl, current.thumbnailSm]) {
      if (!url) continue;
      try {
        await deleteFromR2(getR2KeyFromUrl(url));
      } catch (error) {
        console.error(`[SYNC] Failed to replace stale thumbnail ${url}:`, error);
      }
    }
  }

  const queued = await enqueuePhotoTasks(queuedIds);
  return {
    added: added.length,
    modified: modified.length,
    removed: removed.length,
    queued,
    failed: 0,
    total: driveFiles.length,
  };
}
