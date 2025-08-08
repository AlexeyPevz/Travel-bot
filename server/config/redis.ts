import { redis } from '../services/cache';

export function getRedisClient() {
  return redis;
}

export default redis;