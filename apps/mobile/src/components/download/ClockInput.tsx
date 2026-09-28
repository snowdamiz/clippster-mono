import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Input } from '@/components/ui/input'
import { formatClockTime, parseClockTime } from '@/lib/timeRange'

export function ClockInput({
  label,
  seconds,
  onChange
}: {
  label: string
  seconds: number
  onChange: (seconds: number) => number
}) {
  const [text, setText] = useState(formatClockTime(seconds))
  const [invalid, setInvalid] = useState(false)
  useEffect(() => {
    setText(formatClockTime(seconds))
    setInvalid(false)
  }, [seconds])
  function commit() {
    const parsed = parseClockTime(text)
    if (parsed == null) {
      setInvalid(true)
      return
    }
    setText(formatClockTime(onChange(parsed)))
    setInvalid(false)
  }
  return (
    <View className="flex-1 gap-2">
      <Text className="text-xs font-semibold text-foreground">{label}</Text>
      <Input
        accessibilityLabel={label}
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        placeholder="00:00:00"
        autoCorrect={false}
      />
      {invalid ? <Text className="text-xs text-destructive">Use mm:ss or hh:mm:ss.</Text> : null}
    </View>
  )
}
