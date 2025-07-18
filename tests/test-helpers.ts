import { environments } from '../config/environments';
import { defaultElementWaitTime } from '../config/test-settings';

export function getEnv() {
  return process.env.TEST_ENV || 'develop';
}

export { defaultElementWaitTime };


export function getBaseUrl() {
  const ENV = getEnv();
  return (process.env.BASE_URL || environments[ENV]).replace(/\/$/, '');
}

// Helper to append flags as URL parameters
export function appendFlagsToUrl(url: string): string {
  const flags = process.env.TEST_FLAGS;
  if (!flags) {
    return url;
  }
  // Parse existing params from url
  let [base, query = ''] = url.split('?');
  const urlParams = new URLSearchParams(query);
  // Split flags on comma, space, or plus (robust for shell quirks)
  flags.split(/[\s,+]+/).filter(Boolean).forEach(f => {
    const [k, v] = f.split('=');
    if (k) urlParams.set(k, v ?? '');
  });
  const paramStr = urlParams.toString();
  const finalUrl = paramStr ? `${base}?${paramStr}` : base;
  return finalUrl;
}
