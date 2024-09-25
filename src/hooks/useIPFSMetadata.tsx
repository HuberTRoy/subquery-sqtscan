// SPDX-License-Identifier: GNU-3.0

import yaml from 'js-yaml';

import { useIPFS } from '../containers';
import { AsyncData } from '../utils';
import { useAsyncMemo } from './useAsyncMemo';

export async function fetchIpfsMetadata<T = unknown>(
  catSingle: (cid: string) => Promise<Uint8Array>,
  cid: string,
): Promise<T> {
  const data = await catSingle(cid);
  return yaml.load(Buffer.from(data).toString()) as T;
}

export function useIPFSMetadata<T>(cid: string | undefined | null): AsyncData<T> {
  const { catSingle } = useIPFS();

  return useAsyncMemo(() => (cid ? fetchIpfsMetadata<T>(catSingle, cid) : undefined), [catSingle, cid]);
}
