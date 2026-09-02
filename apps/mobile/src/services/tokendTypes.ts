import type { TokendModeInfo, TokendServerCapabilities } from '@clippster/api-client';

export type { TokendModeInfo };

export interface TokendCapabilities {
  mode: TokendModeInfo['mode'];
  modeLabel: string;
  fixtureMode: boolean;
  publicCatalog: boolean;
  liveStatus: boolean;
  oauthConnect: boolean;
  mockConnect: boolean;
  publish: boolean;
  schedule: boolean;
  download: boolean;
  playback: boolean;
  watch: boolean;
  dvr: boolean;
  analytics: boolean;
  webhooks: boolean;
}

export type TokendConnectStrategy = 'mock' | 'oauth' | 'unavailable';

export const TOKEND_UNAVAILABLE_MESSAGES = {
  publish:
    'Tokend publishing and scheduling are unavailable until Phoenix reports partner publish capability.',
  download:
    'Tokend media download grants are unavailable until Phoenix reports partner download capability.',
  playback:
    'Tokend playback is unavailable until Phoenix reports partner watch capability.',
  analytics: 'Tokend native analytics are unavailable.',
} as const;

export function getTokendCapabilities(modeInfo: TokendModeInfo): TokendCapabilities {
  const server = modeInfo.capabilities as TokendServerCapabilities | undefined;
  const oauthReady = modeInfo.oauth_ready === true;
  const publish = server?.publish === true || (server?.publish == null && oauthReady);
  const schedule = server?.schedule === true || (server?.schedule == null && oauthReady);
  const download = server?.download === true || (server?.download == null && oauthReady);
  const watch = server?.watch === true || (server?.watch == null && oauthReady);

  return {
    mode: modeInfo.mode,
    modeLabel:
      modeInfo.mode === 'mock'
        ? 'Mock fixtures'
        : modeInfo.mode === 'local'
          ? 'Local Tokend'
          : 'Tokend live',
    fixtureMode: modeInfo.mode === 'mock',
    publicCatalog: server?.public_catalog !== false,
    liveStatus: server?.live_status !== false,
    oauthConnect: server?.oauth_connect === true || (server?.oauth_connect == null && oauthReady),
    mockConnect:
      server?.mock_connect === true ||
      (server?.mock_connect == null && modeInfo.mode === 'mock' && modeInfo.oauth_incomplete !== true),
    publish,
    schedule,
    download,
    playback: watch,
    watch,
    dvr: server?.dvr === true,
    analytics: server?.analytics === true,
    webhooks: server?.webhooks === true,
  };
}

export function getTokendConnectStrategy(modeInfo: TokendModeInfo): TokendConnectStrategy {
  const capabilities = getTokendCapabilities(modeInfo);
  if (capabilities.mockConnect) return 'mock';
  if (capabilities.oauthConnect) return 'oauth';
  return 'unavailable';
}

export function getTokendConnectUnavailableMessage(modeInfo: TokendModeInfo): string {
  if (modeInfo.oauth_incomplete) {
    const missing = modeInfo.missing_oauth_configuration?.join(', ');
    return missing
      ? `Tokend partner OAuth is incomplete. Missing Phoenix configuration: ${missing}.`
      : 'Tokend partner OAuth is incomplete on Phoenix.';
  }
  return (
    modeInfo.message ||
    'Tokend partner OAuth is disabled. Public creator browsing remains available, but account connection requires the opt-in Phoenix partner flag.'
  );
}
