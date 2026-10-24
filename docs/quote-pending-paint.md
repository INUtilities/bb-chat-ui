# 인용 변환 전 paint 검토

## 판정

SDK 0.6.31의 `ComposerRichTextSpec.effects`는 범위 paint를 지원한다. 이번
단계에서는 제품에 등록하지 않는다. 텍스트를 건드리지 않는다는 계약만으로
저장 실패·취소 복구와 실제 editor의 커서·IME·Undo 보존까지 입증할 수 없다.

## 확인한 공개 계약

설치된 `@get-bb/plugin-sdk/bundled-types/bb-plugin-sdk-app.d.ts`의
`ComposerRichTextSpec`은 `effects: { id, match(text), className }[]`이다.
`match`의 유일한 입력은 plain text이며 반환값은 `{ from, to }[]`이다.
composer scope, structured mentions, 저장 요청 상태는 전달하지 않는다.

`PluginComposerApi.setTextEffect({ className } | null)`은 범위가 없는 editor
전체 효과다. 특정 인용 범위를 무효화하거나 `richText.effects.match`를
비동기 저장 결과에 맞춰 다시 실행하는 공개 메서드는 확인하지 못했다.
`replace`로 같은 draft를 다시 쓰는 방식은 history·selection에 영향을 줄
가능성이 있으므로, 효과 갱신 용도로 사용하지 않았다.

현재 bridge의 저장 성공·실패·취소는 React effect와 Promise 안에서
결정된다. `match(text)`의 전역 상태로 이를 연결하면 같은 텍스트를 가진
두 컴포저를 구별할 수 없다. 실패 후 draft를 그대로 둔 상태에서 paint가
해제되는지 보장하는 계약도 없다. 공개 계약에서 찾지 못했다는 판정이며,
호스트 내부에 구현 가능성이 없다는 주장은 아니다.

또한 여러 문단의 range에 class를 붙이는 것이 기존 blockquote 하나와 같은
box·아이콘·말줄임을 만든다는 계약은 없다. 원문·selection을 숨기는 CSS로
겉모양만 맞추지 않는다.

## 시나리오별 결과

| 시나리오 | 이번 단계 결과 / 필요한 다음 검증 |
|---|---|
| 저장 성공 | 기존 저장 후 mention 교체 유지. pending paint 미등록 |
| 저장 오류 | 기존 오류 처리 유지. draft 변경 없는 범위 paint 해제 계약 필요 |
| 빠른 연속 인용 | 기존 bridge 유지. 개별 요청과 범위 수명 연결 필요 |
| 인용 중 입력 | 기존 bridge 유지. 이동한 range·취소된 요청의 paint 해제 필요 |
| 붙여넣기 | 기존 bridge 유지. structured mentions와 plain range 구별 필요 |
| 한글 IME | 미실행. 실제 editor에서 composition 중 decoration 갱신 검증 필요 |
| Undo/Redo | 미실행. 실제 history에서 decoration과 변환 transaction 경계 검증 필요 |
| 스레드 이동 | 미실행. 동일 텍스트의 다중 scope 격리·취소 검증 필요 |
| 전송 직전 | 미실행. 저장 전 제출과 실패 요청의 효과 수명 검증 필요 |

실제 앱의 입력·KV 저장·전송과 설치·reload를 금지한 작업 경계를 유지했다.
새 paint 제품 코드가 없으므로 이 검토에는 새 동작 테스트를 추가하지 않았다.
기존 변환·편집·인용 테스트를 전체 회귀로 실행한다. 다음 구현은 scope를
포함한 range 효과 수명과 실패 시 paint-only 갱신 경로를 확인한 뒤 진행한다.
