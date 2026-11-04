/// <reference types="vite/client" />

// Env files are gitignored; the client gate flags are documented here.
// Live values are set per-deploy as Vercel project env vars.
interface ImportMetaEnv {
  // hard maintenance wall: skips the entire network boot (see src/boot.tsx)
  readonly VITE_MAINTENANCE?: 'true' | 'false';
  // optional copy for the maintenance wall; unset = generic copy
  readonly VITE_MAINTENANCE_TITLE?: string;
  readonly VITE_MAINTENANCE_MESSAGE?: string;
  // soft season-over screen, still boots infra (see LoadingState.tsx)
  readonly VITE_STATE?: string;
  // CloudFront origin for the full-state export; unset = full load over gRPC
  readonly VITE_STATE_CDN_URL?: string;
  // Initia L1 REST endpoint for gauge views (VIP modal); defaults to mainnet
  readonly VITE_INITIA_LCD_URL?: string;
}
