const faceApiUrl =
  process.env.FACE_API_URL ??
  "https://kantapon020-shotsync-face-api.hf.space";

async function pingHealth(): Promise<void> {
  const response = await fetch(`${faceApiUrl}/health`, {
    headers: process.env.FACE_API_SECRET
      ? { Authorization: `Bearer ${process.env.FACE_API_SECRET}` }
      : undefined,
    signal: AbortSignal.timeout(8000),
  });

  const body: unknown = await response.json().catch(() => null);
  console.log(JSON.stringify({ ok: response.ok, status: response.status, body }));

  if (!response.ok) {
    process.exitCode = 1;
  }
}

pingHealth().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
