import type { LogisticsRecommendations } from '../../../packages/contracts/src/logistics-recommendations';
export const optionCache = new Map<string, { expires: number; data: LogisticsRecommendations }>();
