import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function calendarDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function nextCalendarDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return calendarDate(new Date(year, month - 1, day + 1, 12));
}
// Refresh at midnight, when the app resumes, and after a device clock/time-zone change.
export function useCurrentDate() {
  const [today, setToday] = useState(calendarDate);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      clearTimeout(timer);
      const now = new Date();
      setToday(calendarDate(now));
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, Math.min(60_000, Math.max(1, midnight.getTime() - now.getTime())));
    }
    timer = setTimeout(refresh, 0);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []);
  return today;
}
