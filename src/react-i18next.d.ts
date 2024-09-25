// SPDX-License-Identifier: GNU-3.0

import { resources } from './i18n';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    resources: (typeof resources)['en'];
  }
}
