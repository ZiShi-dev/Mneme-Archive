export const DB_NAME = "living_archive";
export const DB_VERSION = 1;

export const MAX_KV_KEY_LENGTH = 512;
export const MAX_KV_VALUE_BYTES = 2 * 1024 * 1024;
export const MAX_CHAPTER_KEY_LENGTH = 2048;

export const IMAGE_CACHE_DIR = "image-cache";
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_CACHE_BYTES = 200 * 1024 * 1024;
export const MAX_IMAGE_CACHE_ENTRIES = 500;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export const STORAGE_META_MIGRATED = "storage:migrated-v1";
export const STORAGE_META_CHAPTER_LOG_BACKFILL = "storage:chapter-log-backfill-v1";
export const CHAPTER_PROGRESS_PREFIX = "living-archive:chapter-progress:";
