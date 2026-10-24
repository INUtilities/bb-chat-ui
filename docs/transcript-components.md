# 대화 컴포넌트

## 범위와 생명주기

`lib/transcript-components.ts`의 CSS를 `app.tsx`의 `transcript-components` content script로 주입한다.
플러그인 해제 때 `#bb-chat-ui-transcript-components` style 요소를 제거한다.
DOM을 관찰하거나 메시지·버튼을 바꾸는 JS 동작은 없다.

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
