import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SubscriptionStatus } from '@clippster/shared-types';
import { shouldResetPlanSelectionAfterRefresh } from '@/lib/planCatalog';
import { hasValidSubscription } from '@/lib/subscriptionAccess';

const HAS_SELECTED_PLAN_KEY = 'clippster_has_selected_plan';
const LAST_SUB_STATUS_KEY = 'clippster_last_subscription_status';
const LAST_SUB_VALID_KEY = 'clippster_last_subscription_valid';

export async function getHasSelectedPlan(): Promise<boolean> {
  const value = await AsyncStorage.getItem(HAS_SELECTED_PLAN_KEY);
  return value === 'true';
}

export async function setHasSelectedPlan(value: boolean): Promise<void> {
  if (value) {
    await AsyncStorage.setItem(HAS_SELECTED_PLAN_KEY, 'true');
  } else {
    await AsyncStorage.removeItem(HAS_SELECTED_PLAN_KEY);
  }
}

export async function clearPlanSelectionState(): Promise<void> {
  await AsyncStorage.multiRemove([HAS_SELECTED_PLAN_KEY, LAST_SUB_STATUS_KEY, LAST_SUB_VALID_KEY]);
}

export async function syncPlanSelectionForStatus(
  status: SubscriptionStatus | string | null | undefined,
): Promise<boolean> {
  const previousValid = (await AsyncStorage.getItem(LAST_SUB_VALID_KEY)) === 'true';
  const nextStatus = typeof status === 'string' ? { status } as SubscriptionStatus : status;
  const nextValid = hasValidSubscription(nextStatus);
  const nextStatusValue = typeof status === 'string' ? status : status?.status;

  if (shouldResetPlanSelectionAfterRefresh(previousValid, nextValid)) {
    await setHasSelectedPlan(false);
  }

  if (nextStatusValue) {
    await AsyncStorage.setItem(LAST_SUB_STATUS_KEY, nextStatusValue);
  }
  await AsyncStorage.setItem(LAST_SUB_VALID_KEY, nextValid ? 'true' : 'false');
  return getHasSelectedPlan();
}
