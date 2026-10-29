# 컴포저 탐색과 부분 측정

PR #15의 탐색·측정 개선을 현재 컴포저에 적용한다. 카드 CSS를 조건부로 켜고 끄는 부분은 적용하지 않는다.

## DOM 발견

`addedMutationRoots`는 한 요소의 추가는 그 하위 트리에서 찾고, 같은 부모에 여러 요소가 추가되면 부모를 한 번 조회한다. 같은 MutationObserver 전달에 여러 record가 와도 형제를 묶고, 겹치는 하위 루트는 제외한다. 메시지 행마다 같은 탐색을 반복하거나 작은 스트리밍 변경마다 문서 전체를 조회하지 않는다.

Glass는 새 컴포저의 모션 관찰을 다음 측정 프레임 전에 연결한다. 입력 form 없는 요청 전용 footer와 기존 footer 안의 stack 교체도 발견한다. 정보 줄은 기존 shell의 제거와 새 inline shell을 구분하며 native jump·기기 표식의 갱신을 유지한다.

## 크기와 정보 줄

- Glass는 변경된 footer만 측정하고 각 footer의 ResizeObserver를 별도로 관리한다. 제거·재연결 시 관찰과 예약 작업을 정리한다.
- Viewport는 같은 pane 안에서 위치가 함께 바뀔 수 있는 컴포저를 갱신한다. 독립 pane은 일반 footer 변경으로 다시 측정하지 않는다.
- 기존 footer의 pane 이동·제거는 이전 pane에 남은 컴포저도 갱신한다. footer·pane·editor가 바뀌면 관찰을 다시 연결한다. 크기 계산은 읽기를 마친 뒤 CSS 값을 쓴다. window·visual viewport 변경은 전체를 갱신한다.
- 정보 줄은 표시하는 내용·아이콘·활성 항목·너비·기기 규격이 바뀔 때 다시 배치한다. Diff 파일 경로 같은 상세 revision은 열린 본문을 갱신하면서 기존 pill의 위치를 유지한다. 높이만 바뀐 ResizeObserver 알림은 열린 카드의 스크롤 힌트를 갱신한다.

## 측정과 적용 범위

2026-10-28, 기준 `58a043b`와 같은 제품 코드를 번들한 Chrome 검수 페이지에서 비교했다. 독립 pane 두 개와 검수용 메시지 500개를 사용했다. reduced motion으로 모션 비용을 제외하고, 각 문서에서 예열한 뒤 기준/변경/변경/기준 순서로 시나리오당 24회 측정했다. 각 작업 전후의 CDP Performance 누적 값 차이를 사용했다.

| 시나리오와 측정값 | 기준 중앙값 | 적용 중앙값 | 해석 |
|---|---:|---:|---|
| 500행 교체의 ScriptDuration | 0.592ms | 0.272ms | 약 54% 감소. 사분위 범위 0.578–0.618ms / 0.265–0.282ms |
| 500행 교체의 TaskDuration | 21.330ms | 21.321ms | 전체 작업 시간 개선은 확인하지 못함 |
| 입력 내용 변경의 RecalcStyleDuration | 0.575ms | 0.324ms | 측정 범위에서 스타일 계산 감소 |
| 한 행 추가의 ScriptDuration | 0.200ms | 0.077ms | 변동이 커 이 비율을 일반적인 속도 개선으로 사용하지 않음 |

조건부 상세 CSS만 적용한 별도 비교는 500행 교체 TaskDuration 20.561ms → 20.680ms였다. 효과가 측정 오차를 넘지 않아 해당 구현을 제외했다. 원래 카드 CSS와 기기별 스타일은 유지한다.

이 결과는 검수 데이터와 headless Chrome의 작업량이다. 실제 BB의 네트워크 조회, 전체 스레드 전환·paint 완료, macOS 앱·실제 phone의 체감 속도 개선을 증명하지 않는다.

## 회귀 검사

`composer-glass-lifecycle.test.ts`, `composer-viewport.test.ts`, `composer-info.test.ts`에서 대량·소량 추가의 탐색 범위, inline 컴포저 발견, 독립 pane 측정, pane 이동·제거, Diff 상세·아이콘·목록 전용 표시와 높이 변경을 확인한다. 시간 임계값 대신 불필요한 탐색·크기 읽기가 생기는지와 실제 UI 갱신을 함께 검사한다.

```sh
npm test
npm run typecheck
```

## Diff 데이터 조회

- BB 0.48부터 제공되는 `bb--git`의 `workspaceStatus`와 `files` RPC를 사용한다. 이전 `sdk.environments.status`·`diffFiles`는 호출하지 않는다.
- `workspaceStatus`에 비교 ref를 직접 전달해 PR 대상과 `origin`의 미푸시 커밋 수를 각각 읽는다. 환경에 저장된 비교 브랜치는 바꾸지 않는다.
- 파일 통계는 `uncommitted` 대상과 `ignoreWhitespace: false`로 읽어 HEAD 이후 변경과 공백 변경을 포함한다. 사용 필드는 RPC 경계에서 검증한다.
- 기존 보이는 화면의 5초 갱신·focus 갱신, PR 30초 캐시, 이전 결과 유지·환경 변경 시 오래된 결과 무시는 유지한다.
