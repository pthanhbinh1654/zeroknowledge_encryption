// Environment configuration for the frontend application
// Values are loaded from VITE_* environment variables (see .env.example)

export const env = {
  // hCaptcha - set VITE_HCAPTCHA_SITE_KEY in your .env file
  HCAPTCHA_SITE_KEY: import.meta.env.VITE_HCAPTCHA_SITE_KEY || '',

  // API base URL - points to the backend
  API_BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',

  // Environment flags
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD,

  // App info
  APP_NAME: import.meta.env.VITE_APP_NAME || 'Zero Knowledge Encryption',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
};

export default env;
