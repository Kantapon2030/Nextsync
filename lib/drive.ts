import { google } from "googleapis";
import { Readable } from "stream";

const GOOGLE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_KEY = process.env.GOOGLE_PRIVATE_KEY;
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID || "";

const isMock = !GOOGLE_EMAIL || !GOOGLE_KEY || GOOGLE_EMAIL.startsWith("dummy") || GOOGLE_KEY.startsWith("-----BEGIN RSA PRIVATE KEY-----\n...");

const privateKey = GOOGLE_KEY ? GOOGLE_KEY.replace(/\\n/g, "\n") : "";

const auth = isMock
  ? null
  : new google.auth.GoogleAuth({
      credentials: {
        client_email: GOOGLE_EMAIL,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

const drive = isMock ? null : google.drive({ version: "v3", auth: auth! });

/**
 * Creates a folder in Drive and shares it with anyone as a writer.
 */
export async function createDriveFolder(
  name: string,
  parentId: string = ROOT_FOLDER_ID
): Promise<{ folderId: string; folderUrl: string; uploadUrl: string }> {
  if (isMock || !drive) {
    console.log(`[DRIVE MOCK] Creating folder: ${name}`);
    const folderId = `mock-folder-${Math.random().toString(36).substring(7)}`;
    return {
      folderId,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}-view`,
      uploadUrl: `https://drive.google.com/drive/folders/${folderId}`,
    };
  }

  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id, webViewLink",
  });

  const folderId = res.data.id!;

  // Share folder: anyone with link can upload (writer)
  await drive.permissions.create({
    fileId: folderId,
    requestBody: {
      role: "writer",
      type: "anyone",
    },
  });

  return {
    folderId,
    folderUrl: res.data.webViewLink!,
    uploadUrl: `https://drive.google.com/drive/folders/${folderId}`,
  };
}

export function extractDriveFolderId(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  const urlParams = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (urlParams && urlParams[1]) {
    return urlParams[1];
  }
  return trimmed;
}

/**
 * Lists new files in the folder after a given date.
 */
export async function getNewFilesFromFolder(
  folderId: string,
  afterDate?: Date
): Promise<DriveFile[]> {
  if (isMock || !drive) {
    console.log(`[DRIVE MOCK] Listing files from folder: ${folderId}`);
    
    const mockImages = [
      { id: "mock-pic-1", name: "runner_marathon.jpg", url: "https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=1200&q=80" },
      { id: "mock-pic-2", name: "cyclist_road.jpg", url: "https://images.unsplash.com/photo-1541614101331-1a5a3a194e92?auto=format&fit=crop&w=1200&q=80" },
      { id: "mock-pic-3", name: "swimmer_pool.jpg", url: "https://images.unsplash.com/photo-1519315901367-f34ff9154487?auto=format&fit=crop&w=1200&q=80" },
    ];

    if (afterDate && (Date.now() - afterDate.getTime() < 30000)) {
      // Simulate no new files if synced recently
      return [];
    }

    return mockImages.map((img) => ({
      driveFileId: `${folderId}-${img.id}`,
      filename: img.name,
      fileSize: 1024 * 1024 * 2, // 2MB
      driveUrl: img.url,
      downloadUrl: img.url,
      driveThumbnail: img.url,
      createdAt: new Date(),
      modifiedAt: new Date(),
      checksum: `${folderId}-${img.id}`,
    }));
  }

  // 1. Recursively find all subfolder IDs under the parent folderId
  const folderIds = [folderId];
  const queue = [folderId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    try {
      const subq = `'${currentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      let subPageToken: string | undefined = undefined;
      do {
        const res: any = await drive.files.list({
          q: subq,
          fields: "nextPageToken, files(id)",
          pageSize: 100,
          pageToken: subPageToken,
        });
        const files = res.data.files || [];
        for (const f of files) {
          if (f.id && !folderIds.includes(f.id)) {
            folderIds.push(f.id);
            queue.push(f.id);
          }
        }
        subPageToken = res.data.nextPageToken || undefined;
      } while (subPageToken);
    } catch (err) {
      console.error(`[DRIVE API] Error getting subfolders of ${currentId}:`, err);
    }
  }

  // 2. Query all image files that reside in any of the retrieved folders
  // Google Drive API q parameter query limits may apply, but typically works well for dozens of folders
  const parentQueries = folderIds.map((id) => `'${id}' in parents`).join(" or ");
  const q = `(${parentQueries}) and mimeType contains 'image/' and trashed = false`;

  const files: any[] = [];
  let pageToken: string | undefined = undefined;

  try {
    do {
      const res: any = await drive.files.list({
        q,
        fields: "nextPageToken, files(id, name, size, createdTime, modifiedTime, md5Checksum, webContentLink, webViewLink, thumbnailLink)",
        pageSize: 1000,
        pageToken,
        orderBy: "createdTime desc",
      });

      if (res.data.files) {
        files.push(...res.data.files);
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
  } catch (err) {
    console.error(`[DRIVE API] Error listing files in folder ${folderId}:`, err);
    throw err;
  }

  return files.map((f) => ({
    driveFileId: f.id!,
    filename: f.name!,
    fileSize: parseInt(f.size || "0"),
    driveUrl: f.webViewLink!,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${f.id}`,
    driveThumbnail: f.thumbnailLink || null,
    createdAt: new Date(f.createdTime!),
    modifiedAt: new Date(f.modifiedTime || f.createdTime!),
    checksum: f.md5Checksum || null,
  }));
}

/**
 * Downloads a file buffer from Drive.
 */
export async function downloadFileBuffer(fileId: string): Promise<Buffer> {
  if (isMock || !drive || fileId.includes("mock-pic")) {
    console.log(`[DRIVE MOCK] Downloading buffer for file: ${fileId}`);
    
    const mockUrls: Record<string, string> = {
      "mock-pic-1": "https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=1200&q=80",
      "mock-pic-2": "https://images.unsplash.com/photo-1541614101331-1a5a3a194e92?auto=format&fit=crop&w=1200&q=80",
      "mock-pic-3": "https://images.unsplash.com/photo-1519315901367-f34ff9154487?auto=format&fit=crop&w=1200&q=80",
    };

    const key = Object.keys(mockUrls).find(k => fileId.includes(k));
    const url = key ? mockUrls[key] : "https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=1200&q=80";

    const fetchRes = await fetch(url);
    const arrayBuffer = await fetchRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

/**
 * Changes folder permission to reader only (closes uploads).
 */
export async function closeFolderUpload(folderId: string): Promise<void> {
  if (isMock || !drive) {
    console.log(`[DRIVE MOCK] Closing upload for folder: ${folderId}`);
    return;
  }

  const perms = await drive.permissions.list({ fileId: folderId });
  for (const p of perms.data.permissions || []) {
    if (p.type === "anyone") {
      await drive.permissions.update({
        fileId: folderId,
        permissionId: p.id!,
        requestBody: { role: "reader" },
      });
    }
  }
}

export interface DriveFile {
  driveFileId: string;
  filename: string;
  fileSize: number;
  driveUrl: string;
  downloadUrl: string;
  driveThumbnail: string | null;
  createdAt: Date;
  modifiedAt: Date;
  checksum: string | null;
}
