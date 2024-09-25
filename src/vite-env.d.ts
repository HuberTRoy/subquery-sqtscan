// SPDX-License-Identifier: GNU-3.0

import 'vite/client';

declare global {
  interface Window {
    ethereum?: any;
    Buffer?: any;
    debugInfo?: any;
  }
}
