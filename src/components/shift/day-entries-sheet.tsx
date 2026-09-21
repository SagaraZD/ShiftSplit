import DateTimePicker from '@react-native-community/datetimepicker';
import { Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { DAILY_TARGET_MINUTES, getOfficeGeofence, LUNCH_BREAK_MINUTES, OFFICE_GEOFENCES } from '@/constants/locations';
import { sumDurationMinutes } from '@/lib/aggregate';
import { formatMinutesAsHours, isSameDay } from '@/lib/date-utils';
import { createManualWorkLog, deleteWorkLog, updateManualWorkLog } from '@/services/work-log-service';
import type { WorkLogRow } from '@/types/database';

interface Props {
  userId: string;
  date: Date;
  logs: WorkLogRow[];
  onClose: () => void;
  onChange: () => Promise<void>;
}

interface FormState {
  workLogId: string | null;
  locationId: string;
  startTime: Date;
  // Kept even while `isOpen` is true so the picker has a sensible value if
  // the user switches back to entering a normal, completed entry.
  endTime: Date;
  // No end time — for "I forgot to sign in": the entry picks up as the live
  // active session, continuing the elapsed timer from `startTime`.
  isOpen: boolean;
}

function timeOnDay(day: Date, hours: number, minutes: number): Date {
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' });
}

export function DayEntriesSheet({ userId, date, logs, onClose, onChange }: Props) {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const isFuture = date.getTime() > new Date().setHours(23, 59, 59, 999);
  const isToday = isSameDay(date, new Date());

  // Only completed entries have a duration_minutes to net down — an open
  // (still clocked-in) session is excluded until it's clocked out, same as
  // everywhere else totals are computed.
  const completedLogs = logs.filter((log) => log.end_time);
  const rawMinutes = completedLogs.reduce((sum, log) => sum + (log.duration_minutes ?? 0), 0);
  const netMinutes = sumDurationMinutes(completedLogs);
  const lunchDeducted = rawMinutes - netMinutes > 0;
  const dayOvertimeMinutes = Math.max(0, netMinutes - DAILY_TARGET_MINUTES);

  const startAddEntry = () => {
    setForm({
      workLogId: null,
      locationId: OFFICE_GEOFENCES[0].id,
      startTime: timeOnDay(date, 9, 0),
      endTime: timeOnDay(date, 17, 0),
      isOpen: false,
    });
  };

  const startEditEntry = (log: WorkLogRow) => {
    setForm({
      workLogId: log.id,
      locationId: log.location_id,
      startTime: new Date(log.start_time),
      endTime: log.end_time ? new Date(log.end_time) : timeOnDay(date, 17, 0),
      isOpen: !log.end_time,
    });
  };

  const handleDelete = (log: WorkLogRow) => {
    Alert.alert('Delete entry', 'Remove this time entry? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkLog(userId, log.id);
            await onChange();
          } catch (err) {
            Alert.alert('Could not delete entry', err instanceof Error ? err.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!form) return;
    const effectiveEndTime = form.isOpen ? null : form.endTime;
    setSaving(true);
    try {
      if (form.workLogId) {
        await updateManualWorkLog(userId, form.workLogId, form.locationId, form.startTime, effectiveEndTime);
      } else {
        await createManualWorkLog(userId, form.locationId, form.startTime, effectiveEndTime);
      }
      await onChange();
      setForm(null);
    } catch (err) {
      Alert.alert('Could not save entry', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-black">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {date.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        <Pressable onPress={onClose} hitSlop={8} className="rounded-full p-1 active:opacity-60">
          <X size={22} color="#9CA3AF" />
        </Pressable>
      </View>

      {completedLogs.length > 0 && (
        <View className="flex-row items-center justify-between px-4 pb-3">
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">
            {formatMinutesAsHours(netMinutes)} worked
            {lunchDeducted ? ` · ${LUNCH_BREAK_MINUTES}m lunch deducted` : ''}
          </Text>
          {dayOvertimeMinutes > 0 && (
            <Text className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              +{formatMinutesAsHours(dayOvertimeMinutes)} over 8h
            </Text>
          )}
        </View>
      )}

      <ScrollView contentContainerClassName="gap-4 px-4 py-4">
        {form ? (
          <View className="gap-4 rounded-3xl bg-white p-5 shadow-sm shadow-black/5 dark:bg-neutral-900">
            <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {form.workLogId ? 'Edit Entry' : 'Add Entry'}
            </Text>

            <View className="gap-2">
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">Office</Text>
              <View className="flex-row gap-2">
                {OFFICE_GEOFENCES.map((office) => {
                  const selected = form.locationId === office.id;
                  return (
                    <Pressable
                      key={office.id}
                      onPress={() => setForm({ ...form, locationId: office.id })}
                      className="flex-1 items-center rounded-2xl py-3"
                      style={{
                        backgroundColor: selected ? office.color : undefined,
                      }}>
                      <Text
                        className={`text-sm font-semibold ${
                          selected ? 'text-white' : 'text-neutral-500 dark:text-neutral-400'
                        }`}>
                        {office.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="flex-row gap-4">
              <View className="flex-1 gap-2">
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">Start</Text>
                <DateTimePicker
                  value={form.startTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'compact' : 'default'}
                  onChange={(_, selected) => selected && setForm({ ...form, startTime: selected })}
                />
              </View>
              {!form.isOpen && (
                <View className="flex-1 gap-2">
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">End</Text>
                  <DateTimePicker
                    value={form.endTime}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'compact' : 'default'}
                    onChange={(_, selected) => selected && setForm({ ...form, endTime: selected })}
                  />
                </View>
              )}
            </View>

            {(isToday || form.workLogId) && (
              <View className="flex-row items-center justify-between border-t border-neutral-100 pt-4 dark:border-neutral-800">
                <View className="flex-1 pr-4">
                  <Text className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    Forgot to sign in?
                  </Text>
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                    Leave it open — the timer keeps running from this start time.
                  </Text>
                </View>
                <Switch value={form.isOpen} onValueChange={(isOpen) => setForm({ ...form, isOpen })} />
              </View>
            )}

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setForm(null)}
                className="flex-1 items-center rounded-2xl bg-neutral-100 py-3 active:opacity-70 dark:bg-neutral-800">
                <Text className="font-semibold text-neutral-600 dark:text-neutral-300">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                className="flex-1 items-center rounded-2xl bg-indigo-600 py-3 active:opacity-80">
                {saving ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Save</Text>}
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {logs.length === 0 ? (
              <Text className="text-center text-sm text-neutral-400 dark:text-neutral-500">
                No time logged for this day.
              </Text>
            ) : (
              logs.map((log) => {
                const office = getOfficeGeofence(log.location_id);
                return (
                  <View
                    key={log.id}
                    className="flex-row items-center justify-between rounded-2xl bg-white p-4 shadow-sm shadow-black/5 dark:bg-neutral-900">
                    <View className="flex-1 flex-row items-center gap-3">
                      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: office?.color ?? '#6366F1' }} />
                      <View>
                        <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {office?.name ?? 'Unknown office'}
                        </Text>
                        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                          {formatTime(new Date(log.start_time))}
                          {' – '}
                          {log.end_time ? formatTime(new Date(log.end_time)) : 'in progress'}
                          {log.duration_minutes != null ? ` · ${formatMinutesAsHours(log.duration_minutes)}` : ''}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row gap-1">
                      <Pressable onPress={() => startEditEntry(log)} hitSlop={8} className="rounded-full p-2 active:opacity-60">
                        <Pencil size={16} color="#9CA3AF" />
                      </Pressable>
                      <Pressable onPress={() => handleDelete(log)} hitSlop={8} className="rounded-full p-2 active:opacity-60">
                        <Trash2 size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}

            {!isFuture && (
              <Pressable
                onPress={startAddEntry}
                className="flex-row items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 active:opacity-80">
                <Plus size={18} color="#fff" />
                <Text className="font-semibold text-white">Add Entry</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
