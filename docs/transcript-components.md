# 대화 컴포넌트

## 범위와 생명주기

`lib/transcript-components.ts`의 CSS를 `app.tsx`의 `transcript-components` content script로 주입한다.
플러그인 해제 때 `#bb-chat-ui-transcript-components` style 요소를 제거한다.
코드 블록·표·미리보기 표면은 CSS만 쓴다. inline-vis 접기 기능만 대화 행의 추가 노드를 관찰하고 토글 버튼을 붙인다.
메시지 내용과 내장 버튼의 동작은 바꾸지 않는다.

모든 규칙은 `[data-timeline-row-id*=":assistant:"] [data-markdown-preview]` 아래에 한정한다.
사용자 메시지의 코드·인용 pill, 에이전트 인용, inline code에는 적용하지 않는다.
색은 BB 테마 토큰만 쓴다. `:has()`와 `backdrop-filter`는 쓰지 않고 오른쪽 끝은 구체적인 태그·속성으로 정한다.

## 코드 블록 — 안 2

| 대상 | 값 | 실제 DOM 선택자 (범위 아래) |
|---|---|---|
| 바깥 | 위아래 margin 12px, radius 12px, 선 `--border-seam` | `div.bg-surface-recessed.rounded-md` |
| 머리줄 | 최소 32px, padding `0 6px 0 12px`, 아래 1px 선 `--border-seam`, 면 `--surface-raised` | 바깥의 `> [data-clipboard-ignore]` |
| 언어 | 12px/16px·500, 본문 글꼴, 대소문자 원문 유지, `--muted-foreground`, 간격 6px | 머리줄의 `> span` |
| 코드 아이콘 | Lucide code의 13px alpha mask, opacity .75, 글자색 | 언어의 `::before` |
| 본문 | padding `12px 16px 14px` | 바깥의 `> pre.bb-code-highlight` |

코드 글자 크기·구문 색상·가로 스크롤·Wrap의 줄바꿈과 Copy/Wrap 버튼의 크기·모양·동작은 native를 유지한다.
아이콘 고지는 `THIRD_PARTY_NOTICES.md`와 기존 app 모듈의 `thirdPartyIconNotices` export에 포함된다.
mask SVG의 검은 stroke는 alpha 마스크용이며 화면 색은 `currentColor`다.

예외·의존성: 바깥에 전용 data 속성이 없어 native Tailwind class 두 개에 의존한다.
BB가 class를 바꾸면 새 CSS가 매칭되지 않을 수 있으므로 업데이트 때 실제 DOM을 확인한다.
목업 전용 wrapper나 속성은 쓰지 않는다. 제목·파일명·줄 번호를 만들지 않는다.

## 표 — 안 1

| 대상 | 값 | 실제 DOM 선택자 (같은 에이전트 범위 아래) |
|---|---|---|
| 바깥 | 1px `--border-seam`, separate, spacing 0, radius 10px | `table` |
| 머리 행 | 투명한 면 | `thead` |
| 셀 | padding `5px 12px`, 세로선 없음, 아래 1px `--border-seam`, 위 정렬, `keep-all` | `th`, `td` |
| 머리 셀 | 12px/18px·500, `--muted-foreground`, 아래 선 `--border`, nowrap | `th` |
| 마지막 행 | 아래 선 없음 | `tbody > tr:last-child > td` |
| 좁은 대화 열 | 좌우 padding 8px | `@container page (width < 36rem)` 안의 `th`, `td` |

본문의 native 글자 크기와 셀의 좌우 정렬은 유지한다.
좁은 열은 실제 BB의 `container:page / inline-size`를 따른다. viewport로 phone을 판정하지 않는다.
native `div.w-max.max-w-full.overflow-x-auto` wrapper와 table 의미 구조, 가로 스크롤 동작은 바꾸지 않는다.

예외·위험: `keep-all` 때문에 공백 없는 긴 한국어 값은 가로 스크롤을 더 만들 수 있다.
향후 native renderer가 rowspan·colspan을 쓰면 separate 테두리와 마지막 행 선을 다시 확인한다.

## inline-vis 미리보기 — 안 2

내장 inline-vis 플러그인과 iframe 내부는 바꾸지 않고 에이전트 출력의 바깥만 꾸민다.

| 대상 | 값 | 실제 DOM 선택자 (같은 에이전트 범위 아래) |
|---|---|---|
| 미리보기 | content-box, padding-top 32px, 선 1px `--border-seam`, radius 12px, clip, 위아래 margin 12px | `div[data-inline-vis-frame]` |
| 불러오는 중 | 같은 껍데기와 머리줄, 1.4초 opacity 1↔.6 | `div[role="status"][aria-label^="Loading visualization"]` |
| 머리줄 | 높이 32px, `--surface-raised`, 아래 hairline, 고정 `html` 12px·500 | 바깥의 `::before` |
| 아이콘 | Lucide app-window의 13px alpha mask, 왼쪽 12px, opacity .75 | 바깥의 `::after` |
| 동작 상자 | 위 4px·오른쪽 6px, z-index 1, 항상 opacity 1 | 미리보기의 `> div` |
| 열기·소스 | 24px 원형, 기본 면·선·그림자 없음, hover·선택 시 foreground 6%, focus ring 2px | `a[aria-label^="Open "]`, `button[aria-label$=" source"]` |

머리줄은 content-box의 padding이어서 iframe에 지정된 내용 높이를 줄이지 않는다. 바깥 높이만 34px 늘어난다.
머리줄과 아이콘은 pointer-events:none으로 기존 버튼의 hit-test를 막지 않는다.
`prefers-reduced-motion`에서는 불러오는 중 animation과 버튼 transition을 끈다.
고정 라벨은 파일명이 아니다. 파일명은 iframe title·열기 버튼 aria-label을 유지한다.
내장 플러그인의 data 속성·직계 동작 상자·영문 aria-label에 의존하므로 BB 업데이트 때 확인한다.
오류·Writing visualization 문구·Markdown 문서 카드는 바꾸지 않는다.

### 접기·펼치기

미리보기 머리줄 오른쪽에 우리 플러그인의 native `button` 하나를 추가한다. 기본은 펼침이다.
아이콘 액션은 공통 루트 변수 `--bb-chat-ui-card-icon`(desktop 20px / phone 24px)을 쓰며,
hover 6%·focus ring 2px·동작 줄이기를 유지한다. Enter·Space는 native button의 click을 사용한다.
`aria-expanded`와 `미리보기 접기`·`미리보기 펼치기` 이름을 상태에 맞춘다.

접으면 `data-bb-chat-ui-inline-vis-collapsed`로 wrapper의 내용 높이를 0, iframe만 display:none으로 둔다.
32px 머리줄과 선을 합친 34px는 남는다. iframe 노드·src·srcdoc·inline height를 고치거나 다시 만들지 않는다.
펼치면 속성을 제거해 native 내용 높이를 복구한다. 숨은 iframe의 스크립트 전체를 중지하는 기능은 아니며
Chrome의 숨은 문서 rAF 억제 여부와 CPU 변화는 별도로 측정한다.

상태는 sessionStorage의 `bb-chat-ui:inline-vis:collapsed:` 키에 접힘 `1`만 저장한다.
파일 미리보기는 안정적인 대화 행 ID와 열기 링크(또는 iframe src), 본문 블록은 행 ID·iframe title·요소 경로로 구분한다.
같은 행 구조의 가상화·재렌더·스레드 이동·플러그인 재활성화에서 복원한다.
본문 블록 순서나 구조를 편집해 바꾸면 별도 미리보기로 본다. srcdoc는 테마·글꼴 데이터가 들어 있어 해시하지 않는다.
저장소 접근이 차단된 클라이언트에서는 현재 플러그인 실행 동안만 메모리로 유지한다. localStorage는 쓰지 않는다.

행 목록의 childList 관찰자는 추가된 노드와 그 안의 미리보기만 검색한다. 기존 목록 전체·본문 전체를 다시 검색하지 않는다.
목록 교체는 그 조상 체인의 직접 childList만 관찰한다. 아직 목록이 없는 초기·이동 구간에만 body의 새로 추가된 하위 트리에서 목록을 찾고,
목록이 생기면 이 넓은 감시를 끈다. attribute·characterData·스크롤 리스너·레이아웃 측정은 추가하지 않는다.
React가 동작 상자만 바꾸면 기존 토글 버튼을 다시 붙여 중복 생성하지 않는다.
같은 상태는 속성·저장소에 다시 쓰지 않으며, 목록 제거·플러그인 해제 때 버튼·속성·리스너·관찰자를 정리한다.
세션의 접힘 기록은 재활성화를 위해 남긴다. 내장 열기·소스 버튼의 핸들러는 그대로다.

### inline-vis 토글 햅틱

- `html[data-bb-chat-ui-root-device="phone"]`인 폰 BB 앱에서만
  `window.bb.native.capabilities`의 `haptic` 지원을 확인한 뒤 `impact-light`를 낸다.
  기존 `send-haptic.ts`의 `postHaptic`·`readHapticBridge`·`acceptJumpPulse`를 재사용한다.
- 같은 버튼은 마지막 진동 후 400ms 안에 다시 울리지 않는다. 접기·펼치기는
  계속 반영하며 다른 미리보기 버튼은 독립적이다. 두 번째 손가락은 진동하지 않는다.
  키보드로 버튼을 활성화해도 같은 지원 확인과 400ms 제한을 적용한다.
- desktop·기기 속성 없음·브리지 미지원에서는 진동하지 않는다. 토글의 기존
  click listener 제거가 햅틱도 해제하므로 새 전역 listener나 observer는 추가하지 않는다.
