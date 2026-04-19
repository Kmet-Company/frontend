/**
 * Dev-server proxy for PostgREST (/api) and the AI gateway (/gateway).
 *
 * Browser calls `/gateway/predict-upload` → Vite forwards to `http://127.0.0.1:8000/predict-upload`.
 * If nothing listens on 8000 you see: `ECONNREFUSED 127.0.0.1:8000` (often shown as HTTP 500 in the app).
 *
 * Start DB + API + ai-vision + gateway before `npm start`:
 *   npm run dev:backend
 *
 * PostgREST only (no AI):  npm run dev:db-api
 *
 * Override targets:
 *   VIGILANT_POSTGREST_PROXY=http://host:3000 VIGILANT_GATEWAY_PROXY=http://host:8000 npm start
 */
const postgrest =
  process.env.VIGILANT_POSTGREST_PROXY || 'http://127.0.0.1:3000';
const gateway =
  process.env.VIGILANT_GATEWAY_PROXY || 'http://127.0.0.1:8000';

module.exports = {
  '/api': {
    target: postgrest,
    secure: false,
    changeOrigin: true,
  },
  '/gateway': {
    target: gateway,
    secure: false,
    changeOrigin: true,
    pathRewrite: { '^/gateway': '' },
    /** Long uploads + first model inference (ai-vision cold start). */
    timeout: 600_000,
    proxyTimeout: 600_000,
  },
};
