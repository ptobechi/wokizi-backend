export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const CURRENT_USER_KEY = 'user';

export const CACHE_TTL = {
  FEED: 60,       // 1 min
  PROFILE: 300,   // 5 min
  CATEGORIES: 3600, // 1 hour
  SEARCH: 120,    // 2 min
};

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

export const UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/quicktime', 'video/webm'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
};

export const SERVICE_RADIUS = {
  DEFAULT: 10,  // km
  OPTIONS: [5, 10, 20, 50, 100],
};

export const FEED_WEIGHTS = {
  DISTANCE: 0.30,
  RATING: 0.20,
  COMPLETION_RATE: 0.15,
  RESPONSE_RATE: 0.10,
  TRENDING: 0.10,
  ENGAGEMENT: 0.08,
  VERIFICATION: 0.05,
  RECENCY: 0.02,
};
