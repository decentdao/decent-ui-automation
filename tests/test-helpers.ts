import { environments } from '../config/environments';

export function getEnv() {
  return process.env.TEST_ENV || 'develop';
}

export function getBaseUrl() {
  const ENV = getEnv();
  return (process.env.BASE_URL || environments[ENV]).replace(/\/$/, '');
}

export {};
