import { appAlert } from '@/lib/appAlert';

export function confirmAccountDeletion(onConfirm: () => void | Promise<void>) {
  appAlert(
    'Delete your account?',
    'This deactivates your Clippster account and cancels active subscriptions. Your projects and clips will no longer be accessible.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        onPress: () => {
          appAlert(
            'Delete permanently?',
            'This cannot be undone. You will need to create a new account to use Clippster again.',
            [
              { text: 'Keep my account', style: 'cancel' },
              {
                text: 'Delete permanently',
                style: 'destructive',
                onPress: () => void onConfirm(),
              },
            ],
          );
        },
      },
    ],
  );
}
