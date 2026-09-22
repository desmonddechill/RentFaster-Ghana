const BUCKET = "listing-media";

function storageConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase Storage is not configured on the API server");
  }
  return { url: url.replace(/\/$/, ""), serviceRoleKey };
}

export async function ensureListingMediaBucket() {
  const { url, serviceRoleKey } = storageConfig();
  const response = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (!response.ok && response.status !== 400 && response.status !== 409) {
    throw new Error(`Could not initialize Supabase Storage bucket (${response.status})`);
  }
}

export async function uploadListingMedia(userId: string, fileName: string, contentType: string, body: Buffer) {
  const { url, serviceRoleKey } = storageConfig();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-") || "upload";
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Could not upload listing media (${response.status}): ${detail.slice(0, 200)}`);
  }
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}