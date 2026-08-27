import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { cn } from '@/lib/utils';
import { tokens } from '@/theme/tokens';

interface Option {
  value: string;
  label: string;
}

interface TagSelectProps {
  label: string;
  description?: string;
  options: readonly Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
}

interface SingleSelectChipsProps {
  label: string;
  description?: string;
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'min-h-[40px] flex-row items-center gap-1.5 rounded-lg border px-3 py-2',
        active ? 'border-primary/40 bg-primary/15' : 'border-border bg-surfaceMuted/60',
      )}
    >
      {active ? <Ionicons name="checkmark" size={14} color={tokens.colors.primary} /> : null}
      <Text className={cn('text-sm font-medium', active ? 'text-primary' : 'text-foreground')}>{label}</Text>
    </Pressable>
  );
}

function SectionHeader({
  label,
  description,
  trailing,
}: {
  label: string;
  description?: string;
  trailing?: string;
}) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-base font-semibold text-foreground">{label}</Text>
        {trailing ? <Text className="text-xs text-muted">{trailing}</Text> : null}
      </View>
      {description ? <Text className="text-sm leading-5 text-muted">{description}</Text> : null}
    </View>
  );
}

export function TagSelect({
  label,
  description,
  options,
  selected,
  onChange,
  searchable,
}: TagSelectProps) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const showSearch = searchable ?? options.length > 8;
  const collapseThreshold = 10;
  const shouldCollapse = !showSearch && options.length > collapseThreshold;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const visible = useMemo(() => {
    if (shouldCollapse && !expanded) {
      const selectedSet = new Set(selected);
      const selectedOptions = options.filter((o) => selectedSet.has(o.value));
      const unselected = options.filter((o) => !selectedSet.has(o.value));
      return [...selectedOptions, ...unselected.slice(0, Math.max(0, collapseThreshold - selectedOptions.length))];
    }
    return filtered;
  }, [shouldCollapse, expanded, options, selected, filtered, collapseThreshold]);

  const hiddenCount = shouldCollapse && !expanded ? options.length - visible.length : 0;

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const trailing =
    selected.length > 0 ? `${selected.length} selected` : 'None selected';

  return (
    <View className="gap-3">
      <SectionHeader label={label} description={description} trailing={trailing} />

      {showSearch ? (
        <View className="flex-row items-center gap-2 rounded-lg border border-border bg-surfaceMuted/40 px-3">
          <Ionicons name="search" size={16} color={tokens.colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${label.toLowerCase()}...`}
            placeholderTextColor={tokens.colors.muted}
            className="flex-1 py-2.5 text-sm text-foreground"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={tokens.colors.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        {visible.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            active={selected.includes(option.value)}
            onPress={() => toggle(option.value)}
          />
        ))}
      </View>

      {hiddenCount > 0 ? (
        <Pressable onPress={() => setExpanded(true)} className="self-start">
          <Text className="text-sm font-medium text-primary">Show {hiddenCount} more</Text>
        </Pressable>
      ) : null}

      {shouldCollapse && expanded ? (
        <Pressable onPress={() => setExpanded(false)} className="self-start">
          <Text className="text-sm font-medium text-muted">Show less</Text>
        </Pressable>
      ) : null}

      {showSearch && filtered.length === 0 ? (
        <Text className="text-sm text-muted">No matches for "{query}"</Text>
      ) : null}
    </View>
  );
}

export function SingleSelectChips({ label, description, options, value, onChange }: SingleSelectChipsProps) {
  return (
    <View className="gap-3">
      <SectionHeader label={label} description={description} />
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            active={value === option.value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

export function formatTimezoneLabel(tz: string): string {
  const parts = tz.split('/');
  const city = parts[parts.length - 1]?.replace(/_/g, ' ') ?? tz;
  const region = parts[0];

  const abbreviations: Record<string, string> = {
    'America/New_York': 'Eastern',
    'America/Chicago': 'Central',
    'America/Denver': 'Mountain',
    'America/Los_Angeles': 'Pacific',
    'America/Toronto': 'Eastern (CA)',
    'Europe/London': 'London',
    'Europe/Paris': 'Paris',
    'Europe/Berlin': 'Berlin',
    'Asia/Tokyo': 'Tokyo',
    'Asia/Seoul': 'Seoul',
    'Asia/Singapore': 'Singapore',
    'Australia/Sydney': 'Sydney',
    'Pacific/Auckland': 'Auckland',
  };

  if (abbreviations[tz]) {
    return abbreviations[tz];
  }

  if (region && parts.length > 1) {
    return city;
  }

  return tz;
}
