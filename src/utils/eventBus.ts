// SPDX-License-Identifier: GNU-3.0

import EventEmitter from 'eventemitter3';

export enum EVENT_TYPE {
  CREATED_CONSUMER_OFFER = 'CREATED_CONSUMER_OFFER',
}

const EventBus = new EventEmitter();

export { EventBus };
