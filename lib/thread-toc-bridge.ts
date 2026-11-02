import { useLayoutEffect } from 'react';
import { useSdk } from '@get-bb/plugin-sdk/app';
import { registerTocOutlineReader } from './thread-toc-preview.ts';

// 읽기 전용 스레드와 여러 pane도 같은 공개 SDK 경로를 사용한다.
export function ThreadTocBridge(): null {
  const sdk = useSdk();
  useLayoutEffect(() => registerTocOutlineReader(document, (threadId, signal) =>
    sdk.threads.conversationOutline({threadId, signal})), [sdk]);
  return null;
}
