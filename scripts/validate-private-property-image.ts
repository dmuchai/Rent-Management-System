import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import {
  PROPERTY_IMAGE_BUCKET,
  PROPERTY_IMAGE_MAX_BYTES,
  PROPERTY_IMAGE_SIGNED_URL_TTL_SECONDS,
  decodePropertyImageReference,
  isValidPropertyImageObjectInfo,
  isValidPropertyImageSignature,
  newPropertyImagePath,
  propertyImageReference,
} from "../shared/private-property-image.js";

const userId = "11111111-1111-4111-8111-111111111111";
const propertyId = "step3-property-a";
const path = newPropertyImagePath(userId, propertyId, "image/png");
const reference = propertyImageReference(path);

assert.equal(PROPERTY_IMAGE_BUCKET, "property-images");
assert.equal(PROPERTY_IMAGE_MAX_BYTES, 5 * 1024 * 1024);
assert.equal(PROPERTY_IMAGE_SIGNED_URL_TTL_SECONDS, 90);
assert.match(path, new RegExp(`^${userId}/${propertyId}/[0-9a-f-]{36}\\.png$`));
assert.equal(decodePropertyImageReference(reference, propertyId), path);
assert.equal(decodePropertyImageReference(reference, "step3-property-b"), null);
assert.equal(decodePropertyImageReference("https://example.test/image.png", propertyId), null);
assert.throws(() => newPropertyImagePath(userId, propertyId, "image/svg+xml"));
assert.throws(() => propertyImageReference(`${userId}/${propertyId}/------------------------------------.png`));
assert.equal(isValidPropertyImageObjectInfo(path, { size: 128, contentType: "image/png" }), true);
assert.equal(isValidPropertyImageObjectInfo(path, { size: 0, contentType: "image/png" }), false);
assert.equal(isValidPropertyImageObjectInfo(path, { size: PROPERTY_IMAGE_MAX_BYTES + 1, contentType: "image/png" }), false);
assert.equal(isValidPropertyImageObjectInfo(path, { size: 128, contentType: "image/jpeg" }), false);
assert.equal(isValidPropertyImageSignature(path, Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
assert.equal(isValidPropertyImageSignature(path, Uint8Array.from([0x3c, 0x73, 0x76, 0x67])), false);
const jpegPath = newPropertyImagePath(userId, propertyId, "image/jpeg");
assert.equal(isValidPropertyImageSignature(jpegPath, Uint8Array.from([0xff, 0xd8, 0xff])), true);
const webpPath = newPropertyImagePath(userId, propertyId, "image/webp");
assert.equal(isValidPropertyImageSignature(webpPath, new TextEncoder().encode("RIFF0000WEBP")), true);
const gifPath = newPropertyImagePath(userId, propertyId, "image/gif");
assert.equal(isValidPropertyImageSignature(gifPath, new TextEncoder().encode("GIF89a")), true);

const apiRoute = await readFile("api/property-images/index.ts", "utf8");
const expressRoute = await readFile("server/routes/property-images.ts", "utf8");
assert.match(apiRoute, /createSignedUploadUrl/);
assert.match(apiRoute, /createSignedUrl\(path, PROPERTY_IMAGE_SIGNED_URL_TTL_SECONDS\)/);
assert.match(apiRoute, /\.info\(path\)/);
assert.match(apiRoute, /\.download\(path\)/);
assert.match(apiRoute, /caretaker_assignments/);
assert.match(apiRoute, /auth\.role === "tenant" && auth\.contextOwnerId === property\.owner_id/);
assert.match(apiRoute, /auth\.role === "caretaker" && auth\.contextOwnerId === property\.owner_id/);
assert.match(apiRoute, /previousPath/);
assert.match(apiRoute, /remove\(\[path\]\)/);
assert.match(apiRoute, /FOR UPDATE/);
assert.ok(apiRoute.indexOf("FOR UPDATE") < apiRoute.indexOf(".info(path)"));
assert.match(expressRoute, /createSignedUploadUrl/);
assert.match(expressRoute, /createSignedUrl\(path, PROPERTY_IMAGE_SIGNED_URL_TTL_SECONDS\)/);
assert.match(expressRoute, /\.info\(path\)/);
assert.match(expressRoute, /\.download\(path\)/);
assert.match(expressRoute, /canCaretakerViewProperty/);
assert.match(expressRoute, /remove\(\[path\]\)/);
assert.match(expressRoute, /FOR UPDATE/);
assert.ok(expressRoute.indexOf("FOR UPDATE") < expressRoute.indexOf(".info(path)"));
const propertyForm = await readFile("client/src/components/properties/PropertyForm.tsx", "utf8");
assert.doesNotMatch(propertyForm, /pendingImage\s*\?\s*\{[^}]*imageUrl:\s*""/s);
assert.doesNotMatch(apiRoute, /getPublicUrl/);
assert.doesNotMatch(expressRoute, /getPublicUrl/);
assert.doesNotMatch(apiRoute, /\["landlord", "property_manager", "caretaker"\]/);
console.log("PASS private property-image reference contract");
