import { Alert } from 'react-native';

export function confirmAccountDeletion(onConfirm: () => void | Promise<void>) {
  Alert.alert(
    'Delete your account?',
    'This deactivates your Clippster account and cancels active subscriptions. Your projects and clips will no longer be accessible.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        onPress: () => {
          Alert.alert(
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
