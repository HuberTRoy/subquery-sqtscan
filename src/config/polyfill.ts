// SPDX-License-Identifier: GNU-3.0

import { Buffer } from 'buffer';

window.global = window.global ?? window;
window.Buffer = window.Buffer ?? Buffer;
window.process = window.process ?? { env: {} };
