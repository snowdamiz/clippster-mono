import { useEffect, useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import { getMinScheduleTime, isValidScheduleTime } from '@clippster/api-client'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Input } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'
import { calendarCells, localScheduledDate, toLocalScheduleValue } from '@/lib/scheduleCalendar'
import { tokens } from '@/theme/tokens'

export { toLocalScheduleValue } from '@/lib/scheduleCalendar'

export function formatScheduleLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

interface ScheduleTimeSheetProps {
  visible: boolean
  value: string
  onClose: () => void
  onConfirm: (value: string) => void
}

export function ScheduleTimeSheet({ visible, value, onClose, onConfirm }: ScheduleTimeSheetProps) {
  const [day, setDay] = useState(() => getMinScheduleTime())
  const [month, setMonth] = useState(() => new Date())
  const [hour, setHour] = useState('12')
  const [minute, setMinute] = useState('00')
  const [period, setPeriod] = useState<'AM' | 'PM'>('PM')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!visible) return
    const floor = getMinScheduleTime()
    floor.setMinutes(floor.getMinutes() + 1, 0, 0)
    const parsed = new Date(value)
    const initial = Number.isNaN(parsed.getTime()) || parsed < floor ? floor : parsed
    setDay(initial)
    setMonth(new Date(initial.getFullYear(), initial.getMonth(), 1))
    setHour(String(initial.getHours() % 12 || 12))
    setMinute(String(initial.getMinutes()).padStart(2, '0'))
    setPeriod(initial.getHours() >= 12 ? 'PM' : 'AM')
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [visible, value])

  const cells = useMemo(() => calendarCells(month), [month])
  const draft = localScheduledDate(day, hour, minute, period)
  const valid = draft != null && isValidScheduleTime(draft)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="page"
      title="Schedule time"
      primaryAction={{
        title: 'Set schedule',
        disabled: !valid,
        onPress: () => {
          if (draft && isValidScheduleTime(draft)) {
            onConfirm(toLocalScheduleValue(draft))
            onClose()
          }
        }
      }}
    >
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          disabled={month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()}
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="min-h-11 min-w-11 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={20} color={tokens.colors.muted} />
        </Pressable>
        <Text className="text-[17px] font-semibold text-foreground">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="min-h-11 min-w-11 items-center justify-center"
        >
          <Ionicons name="chevron-forward" size={20} color={tokens.colors.muted} />
        </Pressable>
      </View>
      <View className="flex-row">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
          <Text key={index} className="flex-1 text-center text-xs text-muted">
            {label}
          </Text>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {cells.map((cell, index) => {
          const selected = cell?.toDateString() === day.toDateString()
          const disabled = !cell || cell < today
          return (
            <View key={index} style={{ width: '14.285714%' }} className="p-1">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={cell?.toLocaleDateString(undefined, { dateStyle: 'full' })}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => cell && setDay(cell)}
                className={`min-h-11 items-center justify-center rounded-xl ${selected ? 'bg-accent' : 'bg-surface'} ${disabled ? 'opacity-25' : ''}`}
              >
                <Text className={`text-sm font-semibold ${selected ? 'text-primary-foreground' : 'text-foreground'}`}>
                  {cell?.getDate() ?? ''}
                </Text>
              </Pressable>
            </View>
          )
        })}
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1 gap-2">
          <Text className="text-xs font-semibold text-foreground">Hour</Text>
          <Input
            accessibilityLabel="Hour"
            value={hour}
            onChangeText={(text) => setHour(text.replace(/\D/g, '').slice(0, 2))}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
        <View className="flex-1 gap-2">
          <Text className="text-xs font-semibold text-foreground">Minute</Text>
          <Input
            accessibilityLabel="Minute"
            value={minute}
            onChangeText={(text) => setMinute(text.replace(/\D/g, '').slice(0, 2))}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>
      <Tabs
        items={[
          { key: 'AM', label: 'AM' },
          { key: 'PM', label: 'PM' }
        ]}
        value={period}
        onChange={(next) => setPeriod(next as 'AM' | 'PM')}
      />
      <Text className="text-sm leading-[21px] text-muted">
        {timezone} · local time. Schedule at least 5 minutes in the future.
      </Text>
      {!valid ? (
        <Text className="text-sm text-destructive">Choose a valid time at least 5 minutes from now.</Text>
      ) : null}
    </BottomSheet>
  )
}
