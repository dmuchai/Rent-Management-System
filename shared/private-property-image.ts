export const PROPERTY_IMAGE_BUCKET = "property-images" as const;
export const PROPERTY_IMAGE_REFERENCE_PREFIX = "storage:property-images:" as const;
export const PROPERTY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PROPERTY_IMAGE_SIGNED_URL_TTL_SECONDS = 90;

const PROPERTY_ID = /^[A-Za-z0-9_-]{1,128}$/;
const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const IMAGE_PATH = new RegExp(`^(${UUID})/([A-Za-z0-9_-]{1,128})/(${UUID})\\.(jpg|jpeg|png|webp|gif)$`);

export const PROPERTY_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function newPropertyImagePath(uploaderId: string, propertyId: string, contentType: string): string {
  if (!new RegExp(`^${UUID}$`).test(uploaderId) || !PROPERTY_ID.test(propertyId)) {
    throw new Error("Invalid property image identity");
  }
  const extension = PROPERTY_IMAGE_EXTENSIONS[contentType];
  if (!extension) throw new Error("Unsupported property image type");
  return `${uploaderId}/${propertyId}/${crypto.randomUUID()}.${extension}`;
}

export function propertyImageContentTypeForPath(path: string): string | null {
  const match = IMAGE_PATH.exec(path);
  if (!match) return null;
  const extension = match[4].toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  return `image/${extension}`;
}

export function isValidPropertyImageObjectInfo(
  path: string,
  info: { size?: unknown; contentType?: unknown; metadata?: Record<string, unknown> | null },
): boolean {
  const size = Number(info.size ?? info.metadata?.size);
  const contentType = String(info.contentType ?? info.metadata?.mimetype ?? "").split(";", 1)[0].toLowerCase();
  return Number.isInteger(size)
    && size > 0
    && size <= PROPERTY_IMAGE_MAX_BYTES
    && Boolean(PROPERTY_IMAGE_EXTENSIONS[contentType])
    && propertyImageContentTypeForPath(path) === contentType;
}

export function isValidPropertyImageSignature(path: string, bytes: Uint8Array): boolean {
  const ascii = (start: number, length: number) => {
    let value = "";
    for (let index = start; index < start + length && index < bytes.length; index += 1) {
      value += String.fromCharCode(bytes[index]);
    }
    return value;
  };
  const contentType = propertyImageContentTypeForPath(path);
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= png.length && png.every((value, index) => bytes[index] === value);
  }
  if (contentType === "image/webp") {
    return bytes.length >= 12
      && ascii(0, 4) === "RIFF"
      && ascii(8, 4) === "WEBP";
  }
  if (contentType === "image/gif") {
    if (bytes.length < 6) return false;
    const header = ascii(0, 6);
    return header === "GIF87a" || header === "GIF89a";
  }
  return false;
}

export function propertyImageReference(path: string): string {
  if (!IMAGE_PATH.test(path)) throw new Error("Invalid property image path");
  return `${PROPERTY_IMAGE_REFERENCE_PREFIX}${path}`;
}

export function decodePropertyImageReference(value: unknown, propertyId: string): string | null {
  if (typeof value !== "string" || !value.startsWith(PROPERTY_IMAGE_REFERENCE_PREFIX)) return null;
  const path = value.slice(PROPERTY_IMAGE_REFERENCE_PREFIX.length);
  const match = IMAGE_PATH.exec(path);
  return match && match[2] === propertyId ? path : null;
}

export function isPrivatePropertyImageReference(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(PROPERTY_IMAGE_REFERENCE_PREFIX);
}

export function propertyImageApiUrl(imageRef: unknown, propertyId: string): string | null {
  return decodePropertyImageReference(imageRef, propertyId)
    ? `/api/property-images?propertyId=${encodeURIComponent(propertyId)}`
    : null;
}
