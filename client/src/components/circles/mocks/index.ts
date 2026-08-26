import { circleEmptyPackage } from './circleEmpty';
import { circleSeededPackage } from './circleSeeded';
import type { CirclePackage } from '../types';

export { circleEmptyPackage } from './circleEmpty';
export { circleSeededPackage } from './circleSeeded';
export { mockAvatarUrl } from './avatar';

export const MOCK_CIRCLE_PACKAGES: CirclePackage[] = [circleEmptyPackage, circleSeededPackage];
