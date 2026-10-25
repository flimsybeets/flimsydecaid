/// <reference types="svelte" />
/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Default Decaid host for the dev server, e.g. 192.168.1.50 */
  readonly VITE_GATEWAY?: string;
}
