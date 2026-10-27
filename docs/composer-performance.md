# 스레드 전환 중 컴포저 갱신

컴포저 발견은 MutationObserver 전달 묶음마다 수행한다. 메시지 행마다 하위 트리를 검색하지 않는다. 본문 안의 중첩 입력창과 입력 form이 없는 요청 전용 footer도 발견해야 하며, 새 컴포저의 모션 관찰은 다음 크기 계산 프레임 전에 연결한다.

Glass의 크기 계산은 변경된 footer로 제한한다. Viewport는 같은 pane 안에서 위치가 함께 바뀔 수 있는 컴포저도 갱신한다. 독립된 다른 pane의 컴포저는 일반 footer 변경 때문에 다시 측정하지 않는다.

기존 footer가 다른 pane으로 이동하거나 제거되면 전체 viewport 갱신을 예약한다. 이전 pane에 남은 컴포저의 위치도 바뀔 수 있기 때문이다. 소유 footer·pane·editor가 바뀌면 이전 관찰을 해제하고 다시 연결한다. 같은 footer 안의 stack이 교체되면 MutationObserver를 복구한다.

Viewport는 관찰 연결을 갱신한 뒤 모든 크기를 읽고, 마지막에 CSS 크기 값을 적용한다. Window와 visual viewport 변화는 키보드 영역 변화를 포함해 전체 컴포저를 갱신한다.

표준 DOM, MutationObserver, ResizeObserver, requestAnimationFrame만 사용한다. 운영체제, user agent, 브라우저 실행 옵션이나 머신별 설정으로 동작을 나누지 않는다.

회귀 테스트는 `composer-glass-lifecycle.test.ts`, `composer-viewport.test.ts`, `composer-info.test.ts`의 발견·inline composer 항목에 있다. 작업 횟수 감소가 실제 paint 시간 개선을 증명하지는 않는다. macOS와 phone의 실제 화면 검증은 해당 기기에서 별도로 수행해야 한다.
