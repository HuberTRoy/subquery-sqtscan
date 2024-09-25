// SPDX-License-Identifier: GNU-3.0

import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay = 5000): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    // Update debounced value after delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}
