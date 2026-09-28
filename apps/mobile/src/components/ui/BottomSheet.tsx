import { Ionicons } from '@expo/vector-icons'
import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { tokens } from '@/theme/tokens'

export type BottomSheetVariant = 'sheet' | 'dialog' | 'action' | 'page'

export interface BottomSheetAction {
  title: string
  onPress: () => void
  disabled?: boolean
  variant?: 'accent' | 'default' | 'outline' | 'destructive' | 'ghost'
}

export interface BottomSheetProps {
  inline?: boolean
  visible: boolean
  onClose: () => void
  variant?: BottomSheetVariant
  title?: string
  subtitle?: string
  /** Me/dialog accent rail. Defaults: dialog on, sheet/action off. */
  showAccentBar?: boolean
  /** Drag handle pill. Defaults: sheet on, others off. */
  showHandle?: boolean
  closeMode?: 'icon' | 'text' | 'none'
  /** Icon well above title (dialog/sheet headers). */
  headerIcon?: keyof typeof Ionicons.glyphMap
  headerAccessory?: ReactNode
  children?: ReactNode
  primaryAction?: BottomSheetAction
  secondaryAction?: BottomSheetAction
  /** Extra footer content below action buttons. */
  footer?: ReactNode
  scrollable?: boolean
  keyboardAvoiding?: boolean
  dismissOnBackdrop?: boolean
  maxHeightClassName?: string
  contentClassName?: string
  testID?: string
}

function defaultsForVariant(variant: BottomSheetVariant) {
  switch (variant) {
    case 'page':
      return {
        showAccentBar: false,
        showHandle: false,
        closeMode: 'none' as const,
        animationType: 'slide' as const,
        maxHeightClassName: ''
      }

    case 'dialog':
      return {
        showAccentBar: false,
        showHandle: false,
        closeMode: 'icon' as const,
        animationType: 'fade' as const,
        maxHeightClassName: 'max-h-[85%]'
      }
    case 'action':
      return {
        showAccentBar: false,
        showHandle: false,
        closeMode: 'none' as const,
        animationType: 'slide' as const,
        maxHeightClassName: 'max-h-[70%]'
      }
    case 'sheet':
    default:
      return {
        showAccentBar: false,
        showHandle: true,
        closeMode: 'icon' as const,
        animationType: 'slide' as const,
        maxHeightClassName: 'max-h-[85%]'
      }
  }
}

export function BottomSheet({
  inline = false,
  visible,
  onClose,
  variant = 'sheet',
  title,
  subtitle,
  showAccentBar,
  showHandle,
  closeMode,
  headerIcon,
  headerAccessory,
  children,
  primaryAction,
  secondaryAction,
  footer,
  scrollable = true,
  keyboardAvoiding = false,
  dismissOnBackdrop = true,
  maxHeightClassName,
  contentClassName,
  testID
}: BottomSheetProps) {
  const insets = useSafeAreaInsets()
  const defaults = defaultsForVariant(variant)
  const accentBar = showAccentBar ?? defaults.showAccentBar
  const handle = showHandle ?? defaults.showHandle
  const close = closeMode ?? defaults.closeMode
  const heightClass = maxHeightClassName ?? defaults.maxHeightClassName
  const isDialog = variant === 'dialog'
  const isPage = variant === 'page'

  const body = (
    <>
      {accentBar ? <View className="h-[3px] bg-accent" /> : null}
      {handle ? <View className="mb-3 mt-3 h-1 w-10 self-center rounded-full bg-border" /> : null}

      <View className={cn('relative', !handle && !accentBar ? 'pt-1' : '')}>
        {close === 'icon' && isDialog ? (
          <Pressable onPress={onClose} className="absolute right-3 top-3 z-10 rounded-md p-1" hitSlop={8}>
            <Ionicons name="close" size={22} color={tokens.colors.muted} />
          </Pressable>
        ) : null}

        {(title || headerIcon || headerAccessory || (close !== 'none' && !isDialog)) && (
          <View
            className={cn(
              isPage ? 'min-h-[60px] flex-row items-center gap-2 px-[18px] pb-2' : 'flex-row items-start gap-3 px-4',
              handle ? 'pt-1' : 'pt-4',
              isDialog && headerIcon ? 'flex-col items-center px-6' : ''
            )}
          >
            {isPage ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={onClose}
                className="min-h-11 min-w-11 items-center justify-center"
              >
                <Ionicons name="chevron-back" size={24} color={tokens.colors.foreground} />
              </Pressable>
            ) : null}
            {headerIcon && !isPage ? (
              <View
                className={cn(
                  'items-center justify-center rounded-xl bg-accent/15',
                  isDialog ? 'mb-1 h-12 w-12' : 'h-10 w-10'
                )}
              >
                <Ionicons name={headerIcon} size={isDialog ? 24 : 20} color={tokens.colors.accent} />
              </View>
            ) : null}

            <View className={cn('min-w-0 flex-1', isDialog && headerIcon ? 'items-center' : '')}>
              {title ? (
                <Text
                  className={cn(
                    'font-bold text-foreground',
                    isDialog || isPage ? 'text-xl' : 'text-lg',
                    isDialog && headerIcon ? 'text-center' : ''
                  )}
                >
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text className={cn('mt-1 text-sm text-muted', isDialog && headerIcon ? 'text-center' : '')}>
                  {subtitle}
                </Text>
              ) : null}
            </View>

            {headerAccessory}
            {close === 'icon' && !isDialog ? (
              <Pressable onPress={onClose} className="rounded-md p-1" hitSlop={8}>
                <Ionicons name="close" size={22} color={tokens.colors.muted} />
              </Pressable>
            ) : null}
            {close === 'text' ? (
              <Pressable onPress={onClose} className="px-1 py-1">
                <Text className="text-sm font-medium text-accent">Close</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      {scrollable ? (
        <ScrollView
          className={isPage ? 'flex-1' : undefined}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName={cn(
            isPage ? 'gap-[17px] px-5 pb-6 pt-[10px]' : 'gap-3 px-4 pb-2 pt-3',
            contentClassName
          )}
        >
          {children}
        </ScrollView>
      ) : (
        <View className={cn('gap-3 px-4 pb-2 pt-3', contentClassName)}>{children}</View>
      )}

      {(primaryAction || secondaryAction || footer || variant === 'action') && (
        <View className="gap-2 border-t border-border px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          {footer}
          {(primaryAction || secondaryAction) && (
            <View className={'gap-2'}>
              {primaryAction ? (
                <Button
                  title={primaryAction.title}
                  variant={primaryAction.variant ?? 'accent'}
                  disabled={primaryAction.disabled}
                  className="w-full"
                  onPress={primaryAction.onPress}
                />
              ) : null}
              {secondaryAction ? (
                <Button
                  title={secondaryAction.title}
                  variant={secondaryAction.variant ?? 'outline'}
                  disabled={secondaryAction.disabled}
                  className="w-full"
                  onPress={secondaryAction.onPress}
                />
              ) : null}
            </View>
          )}
          {variant === 'action' && !primaryAction && !secondaryAction ? (
            <Button title="Cancel" variant="outline" onPress={onClose} />
          ) : null}
        </View>
      )}

      {!primaryAction && !secondaryAction && !footer && variant !== 'action' ? (
        <View style={{ height: Math.max(insets.bottom, 12) }} />
      ) : null}
    </>
  )

  if (inline) return <View className="flex-1">{body}</View>

  const panel = (
    <Pressable
      className={cn(
        'overflow-hidden border-border bg-surface',
        isPage
          ? 'flex-1 w-full bg-background'
          : isDialog
            ? cn('w-full max-w-md rounded-2xl border', heightClass)
            : cn('w-full rounded-t-[24px]', heightClass)
      )}
      onPress={(e) => e.stopPropagation()}
      style={isPage ? { paddingTop: insets.top } : undefined}
      testID={testID}
    >
      {body}
    </Pressable>
  )

  const framed = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className={isPage ? 'flex-1 w-full' : isDialog ? 'w-full items-center' : 'w-full'}
    >
      {panel}
    </KeyboardAvoidingView>
  ) : (
    panel
  )

  return (
    <Modal visible={visible} transparent={!isPage} animationType={defaults.animationType} onRequestClose={onClose}>
      <Pressable
        className={cn('flex-1 bg-black/70', isDialog ? 'items-center justify-center px-5' : 'justify-end')}
        onPress={!isPage && dismissOnBackdrop ? onClose : undefined}
      >
        {framed}
      </Pressable>
    </Modal>
  )
}
