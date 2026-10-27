# 컴포저 정보 팝오버 디자인

이 저장소의 정보 팝오버를 만들거나 고칠 때 적용한다. 공통 디자인의 원본은
`~/Foundry/bb-plugin/bb-plugin-kit/docs/design.md`이며, 이 문서는 Chat UI에 확정된
배치와 목록 밀도를 정리한다. 공통 카드의 면·제목·닫기·액션·행은 `lib/info-card.ts`,
native 카드 연결은 `lib/composer-info.ts`, 대기 큐의 편집·액션은
`lib/queued-messages.ts`와 `lib/composer-queue-controls.ts`에 있다.

## 카드와 제목

제목 13px/12px는 실제 DOM에서 영문 descender·한글의 픽셀이 잘려 desktop 줄 높이를 15px로 보정했다. 닫기는 카드 위 여백 12px + (제목 줄 30px − 닫기 20px) / 2 = 17px로 제목·아이콘·액션의 중심을 맞춘다. 본문 줄 높이와 보조 줄 높이는 각각 `--bb-chat-ui-card-prose-line`, `--bb-chat-ui-card-meta-line`이며 목록의 `--bb-chat-ui-card-line`과 독립이다.


정보 카드의 기기별 여백은 다음 표를 기준으로 한다. 루트 CSS 변수만 바꾸며 카드 스타일시트를 복제하지 않는다.
기기 속성이 없으면 desktop 값이다. 컴포저·32px pill·모델 메뉴는 이 축소 대상에서 제외한다.

| 규격 | desktop | phone |
|---|---|---|
| 상세 카드 padding | 12px 16px | 12px 16px |
| 제목 줄 / 본문 간격 | 30px / 10px | 32px / 10px |
| 제목의 닫기 여백 | 34px | 34px |
| 아이콘 액션 / 액션 glyph | 20px / 12px | 24px / 14px |
| 닫기 크기 / 위 / 오른쪽 | 20px / 17px / 10px | 24px / 15.5px / 8px |
| 닫기 × SVG 상자 | 8px | 9px |
| 글자 액션 높이 / 좌우 padding | 24px / 8px | 32px (모든 hit) / 10px |
| 목록 행 최소 높이 / padding / gutter / radius | 24px / 4px / 4px / 8px | 32px / 6px / 6px / 10px |
| 형제 행 간격 | 6px | 6px |
| Workflow 단계 최소 높이 / padding | 24px / 2px 4px | 28px / 4px 6px |
| PR·Parent 단일 행 높이 / 왼쪽 / 닫기 위·오른쪽 | 36px / 12px / 8px·6px | 40px / 16px / 8px·8px |
| 대기 메시지 행 padding | 2px 4px | 4px 6px |
| 대기 메시지 행 아이콘 액션 | 20px | small hit 24px / large hit 32px |
| PR 머지 메뉴 목록 padding / 행 radius | 4px / 10px | 8px / 4px |


| 글자 역할 | desktop | phone |
|---|---|---|
| 제목 | 13px/15px · 600 | 14px/18px · 600 |
| PR·Parent 단일 행 제목 | 13px/15px · 400 | 14px/18px · 400 |
| 목록·일반 안내·글자 액션 | 12px/14px | 13px/16px |
| 긴 본문·사용자 메시지 | 11px/18px | 12px/18px |
| 보조·Diff 파일/커밋 | 11px/18px | 12px/18px |

Diff 파일/커밋과 대기 메시지 목록의 형제 간격은 기존 0을 유지한다. Workflow 연결선은 6px 행 간격에 맞춰 desktop tail 14px, phone tail 16px·시작 18px로 잇는다.

닫기의 버튼 위치는 위 표를 유지한다. ×는 글꼴의 advance나 ink metric에 의존하지 않는 SVG 대각선 두 줄이며 버튼의 정중앙에 놓는다.
phone은 padding 12px 16px, 제목 줄 32px·행 최소 32px·padding 6px·글자 액션 32px·닫기 24px다.
폰 닫기는 제목 줄 중앙 위치 16px에서 사용자 시각 보정으로 0.5px 위인 top 15.5px에 둔다. PR·Parent 단일 행의 top 8px는 유지한다. 닫기 여백은 두 기기 모두 34px이며 닫기 버튼의 오른쪽 위치는 유지한다.
Workflow 점의 보이는 크기와 선 폭은 유지한다. desktop의 점 배치 상자는 16px이며
연결선은 새 행 padding과 점 중심에 맞춰 잇는다. Diff의 graph는 기기별 행 padding의 음수 margin으로 행 전체 높이를 잇는다.
PR 머지 메뉴의 목록 inset·행 모서리는 컴포저 `+` 메뉴와 같은 `nativeActionMenuCss`를 쓴다. 행 높이·padding·글자·키보드 선택은 같은 native DropdownMenuItem 구현을 유지한다.

- 컴포저 `+` 메뉴와 모델 선택 팝오버도 `lib/composer-menu-glass.ts`에서 같은
  18px 모서리와 frost 표면을 쓴다. + 메뉴의 접근성 이름과 모델 선택 버튼의 aria-controls 연결로
  범위를 한정하며, 패딩·검색·선택 동작은 native 구현을 유지한다.
  모델 목록의 고정 제목은 스크롤 0에서 배경이 투명하며 backdrop-filter가 없다.
  실제 모델 목록이 스크롤되어 제목 아래로 지나갈 때만 카드 면
  `var(--bb-chat-ui-card-face)`와 `blur(24px) saturate(1.5)`를 적용한다.
  제목 아래에는 카드 면에서 투명으로 사라지는 12px gradient·blur 6px·mask를 둔다.
  상태 전환은 160ms ease-out이며 동작 줄이기 설정에서는 전환하지 않는다.
  열린 메뉴의 실제 스크롤 요소에 passive listener 하나를 연결하고 scrollTop만 읽어
  상태가 달라질 때만 data 속성을 바꾼다. 메뉴 닫기·목록 교체·플러그인 해제 때 정리한다.
  More models의 별도 native 팝오버도 같은 frost와 행 radius를
  사용하며, 해당 컴포저의 열린 More models에서 새로 열린 모델 목록만 표시 범위에 넣는다.
  목록 행과 모델 카드의 hover 배경이 있는 버튼은 안쪽 모서리를 10px로 통일한다.
  모델 카드 너비는 20rem이며 작은 화면에서는 화면 안으로 제한한다. Provider 변경에
  따른 카드 높이는 160ms로 연결한다. 다음 프레임을 기다리지 않고 내용 변경을 합쳐 반영하며,
  원래 popper의 위치 계산을 그대로 쓴다. 바깥틀 높이와 위치를 따로 보정하지 않는다.
  기존 스레드에서 다른 provider를 골라 Handoff에 들어가거나 나올 때는 컴포저 높이도
  같은 160ms로 연결한다. 새 Handoff 제목은 같은 시간 동안 나타난다. 빠르게 되돌리면
  현재 보이는 높이에서 이어 간다. 초안 입력은 측정하지 않고, native 접기·펼치기의
  명시적 높이는 우선한다. 원래 입력 노드와 Exit handoff 동작을 유지한다.
  Effort는 provider가 제공하는 단계에 연결된 48px 높이의 고정 눈금 파형이다.
  막대 간격은 넓게 두고 길이 차이를 크게 표시한다. 막대는 선택 위치 주변에서 높아지고,
  각 옵션 눈금은 더 길게 표시한다. 22px 세로 핀은 막대 앞에서 전체 길이가 보이며,
  테마 표면색의 얇은 외곽선으로 겹친 막대와 구분한다.
  핀과 파형의 높은 부분은 같은 스프링으로 이동하며, 새 선택 위치에서 미세한
  길이 파동이 즉시 퍼진다. 이동 중 선택을 바꾸면 현재 위치와 속도에서 이어 간다.
  핀의 목표 위치는 실제 단계에만 놓이고, 아래 별도 선택 버튼과 채움 막대는 두지 않는다.
  단계가 많으면 아래 이름은 간격 안에서 말줄임하고, 선택한 전체 이름은 상단에 표시한다.
  방향키·Home·End와 비활성 단계도 지원한다.
  Fast mode는 native switch를 40×24px 토글로 표시한다. 손잡이 이동은 한 경로만 적용하며
  160ms 안에 전환한다.
  동작 줄이기 설정에서는 모션을 끈다.

- 컴포저 메뉴의 바깥 면은 `cardFaceCss`를 재사용한다. 작은 메뉴의 기존 그림자
  `0 6px 18px -12px`와 dark의 `--background` 60% 혼합은 유지한다.
- 컴포저 메뉴의 행 모서리는 `cardStyle.rowRadius`를 재사용한다. native 메뉴의
  높이·패딩·hover·간격·글자 규격은 바꾸지 않는다.

- 카드의 glass 면은 한 겹이다. BB 테마 토큰과 `glass-surface.ts`를 쓰고 안쪽에
  불투명한 native 배경·ring·상단 구분선을 겹치지 않는다.
  모델 목록의 고정 제목은 스크롤 중 글자가 아래로 지나갈 때만 frost 한 겹 원칙의 예외다.
- 바깥 radius는 18px, 상세 카드 패딩은 desktop 12px 16px·phone 12px 16px다. 짧은 카드는 내용만큼 높아지고,
  긴 카드는 Code Diff와 같은 `--bb-chat-ui-info-max-height`에서 스크롤한다.
- 상세 카드 제목은 읽기 전용이다. 제목 클릭으로 카드를 접지 않으며 hover 배경·pointer를
  추가하지 않는다. 실제 액션과 본문 내부의 펼치기·접기는 유지한다.
- 제목 행은 desktop 30px·phone 32px, 제목 글자는 desktop 13px/15px·phone 14px/18px이며 굵기 600·왼쪽 정렬이다. native 제목의
  가운데 정렬·`font-normal`을 그대로 남기지 않는다. 제목의 아이콘·외부 열기·닫기는
  이 행의 세로 중심선을 공유하되 phone 닫기는 0.5px 위로 시각 보정한다. 32px 터치 액션도 제목 행을 아래로 밀지 않는다.
- 제목 왼쪽에는 해당 정보 아이콘을 둔다. 전체 정보 목록 제목은 예외다.
- 제목 영역(아이콘 포함)과 본문은 카드의 같은 왼쪽 시작점을 쓴다. 목록 hover를
  좌우 device별 row padding만큼 넓히는 여백을 본문 전체에 적용하지 않는다. 들여쓰기된 하위 목록은
  계층을 유지하되 첫 본문 줄을 제목보다 왼쪽으로 당기지 않는다.
- 글자가 많은 Goal·Plan 본문과 대기 사용자 메시지, 피드백 본문, 작업 진행 설명은
  desktop 11px/18px·phone 12px/18px다. 문단과 `cardSlot.prose`는 공통 `cardStyle.prose`에 연결한다.
  native·SDK 모두 같은 역할의 기기 값을 쓰며 문단 안 강조·링크도 크기를 키우지 않는다.
- 짧은 안내 문장도 문단이면 기기별 본문 규칙을 유지한다. 문장 길이를 이유로
  목록 이름·글자 액션의 device별 규격으로 바꾸지 않는다.
- 목록 이름과 일반 안내는 desktop 12px/14px·phone 13px/16px다. native `text-xs`·`text-sm`와 목록 행은
  `cardStyle.text`를 쓴다. Diff의 파일 경로·커밋 목록은 예외로 `cardStyle.secondaryText`의
  desktop 11px/18px·phone 12px/18px를 쓰며 코드 글꼴은 유지한다.
  호스트의 모바일 14px·`leading-relaxed`가 이 세 단계에 섞이지 않게 한다.
- 글자 액션도 desktop 12px/14px·phone 13px/16px다. Merge·해제·복구·더 보기의 크기를 목록과 맞추고,
  버튼의 클릭 영역 높이와 글자의 줄 높이를 분리한다.
- Goal의 사용량·상태, Workflow의 진행 수·대기 상태·시간·모델, 백그라운드 시간,
  Diff의 비교 통계·미푸시 안내와 SDK 대기 메시지 상태는 보조 정보로 desktop 11px/18px·phone 12px/18px다.
  제목·액션·보조 정보 slot, 코드·입력·편집기와 그 자식은 본문 글자 규칙에서 제외한다.
  native `text-2xs`와 작은 개수 배지도 같은 device별 보조 크기를 쓴다.
  대기 메시지의 예약 시간도 보조 크기다. 말줄임 글자에 사용자 메시지 본문의 12px을 적용하지 않는다.
  백그라운드 명령의 앞쪽 안내 문구는 좁은 카드에서 말줄임해 제목·시간이 가로로 넘치지 않게 한다.
- 패널·플러그인 페이지·GitHub 등 외부 열기 버튼은 제목 텍스트 바로 오른쪽에
  둔다. 짧은 제목 뒤에 빈 공간을 늘려 버튼을 카드 오른쪽 끝으로 밀지 않는다.
  긴 제목은 버튼과 닫기 영역을 남긴 뒤 한 줄 말줄임한다.
  PR 단일 행은 예외로 GitHub 로고를 제목 앞의 맨 왼쪽에 둔다. 보이는 glyph의
  왼쪽 끝은 Parent 행 provider 아이콘의 왼쪽 끝과 맞춘다.
- 제목 바로 오른쪽은 상세 화면을 여는 액션 전용이다. Goal·fallback의 `해제`,
  Plan의 `종료`와 PR의 Merge처럼 상태를 바꾸는 액션은 제목 줄 오른쪽 끝의 × 왼쪽에 둔다.
  화면 이름은 버튼에서 반복하지 않고 원래 접근성 이름과 실제 동작은 유지한다.
  native 버튼이 본문에 있어도 원래 DOM 부모를 유지하며 `with-actions` layout으로 제목 줄에 연결한다.
- Archived thread의 `Unarchive`와 환경 복구 버튼은 본문 전체 너비로 표시한다.
  진행 중·비활성·오류 상태와 원래 복구 동작을 유지한다.
- Machine의 `Retry`는 공통 글자 액션을 쓴다. 원래 버튼과 클릭 동작은 유지하며
  닫기·해제 때 adapter가 붙인 slot만 제거한다. 현재 검수 근거는 Machine fixture다.
- 제목·액션·닫기의 세로 중앙선을 맞추되 phone 일반 카드 닫기는 사용자 시각 보정으로 0.5px 위에 둔다. 닫기는 desktop 20px·phone 24px 원형 영역의 ×다.
  액션은 × 왼쪽에 두며, 제목과 겹치지 않게 별도 열 또는 닫기 여백을 확보한다.
- 닫기 ×는 desktop 8px·phone 9px SVG 상자, 12×12 viewBox의 대칭 대각선 두 줄,
  `currentColor`·stroke 1.5·round cap을 쓴다. Agentation collapse는 같은 SVG의 mask를 쓰고
  기존 native 버튼·이벤트를 유지한다. 글꼴별 baseline 보정은 하지 않는다.
  아이콘 상자의 가로·세로 중심은 버튼 중심과 같고, 접근성 이름은 버튼에 둔다.
- 닫기 위치와 제목의 닫기 여백은 위 기기별 표를 따른다.
  글자 액션은 desktop 24px·phone 32px이며 phone large hit에서는 32px다. 카드 안 아이콘 액션과
  닫기는 desktop 20px·phone 24px이며 추가 frost 면·그림자를 겹치지 않는다.
- Parent 탐색은 아래의 `single-row` 규격을 쓴다. 별도의 `Parent` 제목·계열 아이콘은
  추가하지 않으며 provider 아이콘·부모 제목·닫기만 한 줄에 둔다.
  통합 전 Parent처럼 desktop 36px·phone 40px인 카드 전체가 하나의 클릭 영역이다. 안쪽 행의 별도
  배경·테두리·그림자와 바깥 여백을 없애고, 카드의 inset edge도 표시하지 않는다.
  부모 정보가 아직 없으면 기존 링크로 보완하고, 사라진 부모로 이동하지 않는다.
- Goal의 `해제`는 이름이 있는 액션으로 유지한다. Agentation의 전체 액션은
  ↑ 전송 → 휴지통 삭제 → × 닫기 순서다. 아이콘만 표시해도 tooltip과 접근성
  이름에는 `Send all` / `Discard all`을 남긴다.
- Agentation 목록 안 Mention·Send·Discard도 공통 device별 원형 아이콘 액션과 glyph를 쓴다.
- Workflow는 첫 줄에 아이콘·제목·패널 열기·닫기를 둔다. 제목 줄은 desktop 30px·phone 32px이며,
  진행 수는 아래 줄의 왼쪽에, 시간은 오른쪽에 둔다. 가운데 구분점은 쓰지 않는다. 전체 너비의 분할 진행 막대는
  요약 아래에 둔다. native 데이터 갱신과 실제 패널 열기는 유지한다.
- Workflow 단계는 번호 없이 점과 연결선이 이어지는 그래프로 표시한다. 점 크기는
  모든 상태에서 동일하며 완료·진행 중만 밝게, 나머지는 연하게 표시한다. 연결선은
  2px 한 겹으로 점 사이에만 그려 겹침에 따른 밝기 차이를 없앤다. 단계 행의 최소 높이와 padding은 desktop 24px·2px 4px, phone 28px·4px 6px이며 상태와 관계없이 같은 hover 규격을 쓴다.
  단계 펼치기 캐럿과 대기 상태는 행 오른쪽에 둔다. 펼친 에이전트는 연결선 안쪽에
  들여쓰고, 작업 이름 아래에 provider·model·reasoning 정보를 작은 보조 줄로 표시한다.
  제목·에이전트 이름·보조 정보는 카드 안쪽 여백에서 한 줄 말줄임한다.
- Pull request도 Parent와 같은 `single-row` 카드다. 별도 계열 제목·계열 아이콘·상태 본문 없이
  SDK에서 읽은 PR 제목을 한 줄로 표시하고 남는 너비에서 말줄임한다.
  원래 PR 링크는 제목 앞의 GitHub 로고로 보이며 카드 전체를 클릭해도 같은
  GitHub 링크를 연다. 원래 URL·modifier click·키보드 동작을 유지한다.
  GitHub 외부 열기도 공통 device별 원형 아이콘 액션과 glyph를 쓴다.
  SDK 제목을 아직 읽지 못했으면 원래 PR 번호를 임시 제목으로 쓴다.
  Merge 메뉴와 닫기는 별도 영역으로 두어 제목과 겹치지 않게 한다. Merge는 테두리·배경 없이
  글자와 캐럿만 표시한다. 글자와 캐럿 모두 같은 머지 방식 메뉴를 열며, 방법을 선택할 때만 실행한다.
- PR 머지 방식 메뉴는 공통 `cardFaceCss` 면에 `+` 메뉴와 같은 항목 규격을 쓴다.
  `lib/info-card.ts`의 `nativeActionMenuCss`가 목록 padding(desktop 4px·phone 8px)과
  행 radius(10px·4px)를 두 메뉴에 함께 적용한다. native 행 padding은 5px 8px·8px,
  실측 높이는 26px·36px, 글자는 12/16·14/20이며 font·높이·동작을 별도로 덮지 않는다.
  native focus·last-hovered 배경은 같은 BB `state-hover` 토큰을 유지한다.
- phone의 `+` 메뉴는 `[data-persistent-drawer-content]` 안의 `div[aria-label="Prompt actions"]`다.
  PR drawer에 겹치던 12px 16px padding을 제거하고 native 안쪽 목록 padding 8px만 둔다.
  `+` drawer의 native 테두리 1px와 같은 전체 inset을 만들기 위해 PR frost 면에는
  테두리 대신 안쪽 여유 1px를 둔다. 두 메뉴의 hover 왼쪽·오른쪽 끝은 면에서 9px다.
  safe-area-bottom과 drawer handle, Escape·키보드 선택·실행 동작은 유지한다.

## 공통 규격과 컴포넌트 연결

| 글자 역할 | desktop 크기 / 줄 높이 | phone 크기 / 줄 높이 | 연결 |
|---|---|---|---|
| 제목 | 13px / 15px, 굵기 600 | 14px / 18px, 굵기 600 | `cardSlot.head`, `cardSlot.title`, `cardStyle.titleText` |
| 단일 행 PR·Parent 제목 | 13px / 15px, 굵기 400 | 14px / 18px, 굵기 400 | `single-row`, `cardStyle.titleText` |
| 긴 본문·사용자 메시지 | 11px / 18px | 12px / 18px | `cardSlot.prose`, `cardStyle.prose`, 일반 문단·native 대기 메시지 preview |
| 목록 이름·일반 안내 | 12px / 14px | 13px / 16px | `cardStyle.text`, 목록 행·native `text-xs`·`text-sm` |
| Diff 파일 경로·커밋 목록 | 11px / 18px, 코드 글꼴 | 12px / 18px, 코드 글꼴 | `cardStyle.secondaryText` |
| 글자 액션 | 12px / 14px | 13px / 16px | `cardStyle.button`, PR Merge, Diff 더 보기 |
| 상태·시간·개수·모델 등 보조 정보 | 11px / 18px | 12px / 18px | `cardSlot.meta`, `cardSlot.section`, `cardStyle.secondaryText`, native `text-2xs` |

native·SDK는 같은 역할 규칙을 쓴다. 글자 값은 `html` 루트의 CSS 변수로 한 번 정의하고
`html[data-bb-chat-ui-root-device="phone"]`에서 phone 값만 덮어쓴다. 속성이 없으면 desktop 값이다.
창 너비로 글자 크기를 선택하지 않으며 기기별 카드 스타일시트를 두 벌 만들지 않는다.
컴포저 안으로 제한한 글자 선택자 범위도 유지한다.
색·굵기·배치는 각 역할을 따르고 입력·편집기·코드 본문의 자체 크기는 유지한다.
아이콘 전용 액션과 기하 SVG ×는 일반 글자 액션의 줄 높이로 덮지 않는다.
Child Thread 등 목록 안의 이름은 desktop 12px/14px·phone 13px/16px다.
읽기 전용 대기 메시지 preview는 desktop 11px·phone 12px지만 편집기는 원래 크기를 유지한다.
제목 줄·목록 행·액션·닫기의 기기별 크기와 여백은 위 표를 따른다.

| 규격 | 구성과 여백 | 연결 |
|---|---|---|
| 기본 상세 카드 | desktop 30px 제목·10px 간격·12px 16px padding, phone 32px 제목·10px 간격·12px 16px padding | `cardSlot.head`, `cardSlot.body` |
| 제목 단독 카드 (`heading-only`) | 본문 없이 기기별 제목 줄만 표시, 하단 본문 간격 없음 | 공통 `heading-only` layout |
| 상태 액션이 있는 카드 (`with-actions`) | 기기별 제목 줄·상태 액션·닫기 열, 본문은 아래 전체 너비 | `cardSlot.head`, `cardSlot.endAction`, `cardSlot.body`; native Goal controls와 fallback status는 adapter가 연결 |
| 단일 행 카드 (`single-row`) | 테두리·안쪽 면 없이 기기별 높이 36/40px인 카드 하나, 바깥 패딩 0, 내용 왼쪽 desktop 12px·phone 16px, 닫기 여유 desktop 32px·phone 40px | Parent는 `cardSlot.row`와 `cardSlot.navigation`, PR은 native/SDK 행을 `cardSlot.head`에, 원래 링크를 `cardSlot.navigation`에 연결, 공통 `cardSlot.layout="single-row"` |
| 본문 가장자리 | 본문 wrapper의 상하 패딩·margin은 0, 첫·끝 문단의 바깥 margin은 0 | SDK는 `cardSlot.body`, native는 `NATIVE_BODY` 선택자가 `cardStyle.body`를 재사용 |

- `single-row`의 닫기는 desktop 위 8px·오른쪽 6px, phone 위·오른쪽 8px로 각 카드의 중앙에 놓인다.
  기기별 내용 왼쪽 여백과 닫기 버튼 위치는 위 표를 유지하며 기하 ×를 버튼 중앙에 둔다.
  `cardSlot.navigation`이 카드 전체를 덮고, 닫기·Merge는 그 위의 별도 클릭 영역이다.
  전체 면에 같은 hover·키보드 focus 표시를 쓰고 긴 제목은 닫기·Merge 앞에서 한 줄 말줄임한다.
- 부모 metadata가 늦게 오거나 native 링크만 있어도 같은 단일 행을 쓴다.
  관계가 제거된 경우의 기존 비활성 처리와 native 복원 동작은 유지한다.
- native Child 목록, Goal 본문, 백그라운드 목록, Workflow scroll area, Queue scroll/list의
  추가 상하 패딩을 제거한다. 본문 사이의 간격과 목록 행 자체의 기기별 패딩은 유지한다.
- `cardSlot.endAction`은 제목 줄 끝의 액션이다. native 글자 버튼에는
  `cardSlot.buttonLabel`로 짧은 표시 이름을 연결하고, 원래 글자·아이콘이 중복 표시되지 않게 한다.
  상세 열기 액션은 이 slot 앞에 배치한다. 닫기·native 재렌더·플러그인 해제 시 추가 layout과 slot을 복원한다.
- SDK Goal은 기존 `cardSlot.head`를 재사용하고 `cardSlot.body`를 제목 아래 전체 너비에 둔다.
  native Goal의 해제 액션용 grid 열은 SDK 카드에 적용하지 않는다. 닫기·해제 시 SDK가 만든
  제목과 slot은 보존하고 adapter가 추가한 제목·slot만 정리한다.
- Queue 제목 아래도 두 기기 모두 10px 간격을 쓴다. 빈 정보 안내는 본문의 끝에 추가 margin을 남기지 않는다.
  Queue의 마지막 그룹 경계가 잘리지 않도록 확보한 하단 12px는 기능 여백이므로 유지한다.
- 대기 메시지 행은 공통 행의 밀도 예외로 desktop 2px 4px·phone 4px 6px 패딩과 형제 간격 0을 쓴다.
  기기별 최소 높이·radius·gutter와 6% hover는 유지하고 행 구분선은 없앤다.
  그룹 경계·드래그·편집·전송 동작과 기존 hit target은 유지한다.
  메시지 글자 블록의 내부 세로 패딩은 0이다. 행 패딩을 겹쳐 넣지 않고,
  기기별 크기의 액션은 행 안에서 세로 중앙에 맞춘다.
- 대기 메시지의 전송·편집·삭제·더 보기 아이콘 액션은 모든 기기에서 원형이다.
  클릭 영역은 desktop 20px, phone large hit 32px·small hit 24px다.
- 대기 메시지의 드래그 핸들은 아이콘 액션의 의도된 예외다. 원래 크기·모서리와
  드래그 동작을 유지하며 전송·편집·삭제 버튼의 원형 규격을 적용하지 않는다.
- 닫기·해제하면 Parent·PR의 layout 표식과 추가 표시를 제거하고 원래 native DOM을 복원한다.

## 비활성 정보와 접힌 스택

- `비활성 정보 표시` (`showInactiveInfo`)는 기본적으로 꺼져 있다. 내용 없는 계열은
  스택과 전체 목록에서 숨기며, 비활성 정보만을 위한 +N과 너비를 예약하지 않는다.
  활성 정보도 Latest도 없으면 빈 정보 줄은 숨긴다.
  Latest 표시로 가용 폭이 바뀌면 pill과 대응 스택 아이콘을 460ms 등장·340ms 퇴장의
  한 모션으로 합치거나 분리한다. 이전 모습은 절대 위치 overlay에 남기고,
  최종 layout의 요소는 transform·opacity로 이동한다. 첫 이전 모습이 paint된 다음
  같은 시각에 시작하며, 빠른 반전은 현재 보이는 모습에서 이어 간다.
  jump 상태 변화 때만 위치를 읽고, reduced motion·해제 시 overlay와 모션을 즉시 정리한다.
- 활성 정보가 너비 부족으로 접히거나 `목록에만 표시`로 설정된 경우에는 스택에서
  접근한다. 아이콘은 최대 세 개이며 +N은 그 뒤에 남은 활성 계열 수다.
- 옵션을 켜면 내용 없는 계열도 포함한다. +N은 상단 pill과 표시한 스택 아이콘을
  제외한 전체 계열 수다. `끄기`인 계열은 어떤 경우에도 포함하지 않는다.
- 접힌 활성 정보를 먼저 배치하고 점을 표시한다. +N 뒤에 활성 정보가 있으면
  +N에도 점을 표시한다. 상단에 이미 표시된 계열을 스택에 중복 표시하지 않는다.
- 이 설정은 표시·배치에만 적용한다. SDK 조회와 기존 모션은 유지한다.

## 간결한 정보 목록의 공통 행

할 일, Workflow의 phase·agent, 백그라운드 작업에 같은 규격을 적용한다.
기준은 백그라운드 작업 팝오버의 한 줄 행이다.

| 항목 | 기준 |
|---|---|
| 최소 높이 | desktop 24px, phone 32px |
| 내부 패딩 | desktop 4px, phone 6px |
| 글자 / 줄 높이 | desktop 12px / 14px, phone 13px / 16px |
| 형제 행 사이 | 6px (`--bb-chat-ui-info-row-gap`) |
| Workflow phase와 펼친 agent 목록 사이 | 같은 device별 형제 간격 |
| hover 배경 radius | desktop 8px, phone 10px |
| hover 배경 | 테마 foreground 6% |
| 배경 전환 | 150ms ease-out |

Workflow도 위 기기별 규격을 적용한다. 목록 행 높이는 최소값이다. 긴 내용과 여러 줄은 자연스럽게 늘어나게 하고 고정 높이로
자르지 않는다. 상태별로 padding·radius·간격을 다르게 두지 않는다.

- 행 간격은 부모의 gap으로 관리한다. native `space-y-*`의 위·아래 margin을
  겹쳐 넣지 않는다. 목록 마지막에 불필요한 행 간격도 남기지 않는다.
- 내용의 시작점은 제목과 맞춘다. hover 배경은 내용 좌우로 desktop 4px·phone 6px 확장하되 카드
  가장자리에는 여백을 남긴다. 둥근 배경이 안쪽 reveal wrapper에서 잘리지 않게 한다.
  reveal의 grid 자식은 `min-width:0`으로 축소할 수 있게 두어 긴 내용이 카드와 행을
  가로로 밀어내지 않게 한다. 할 일과 일반 본문의 긴 경로·공백 없는 문자열은
  카드 안에서 줄바꿈한다. 코드 블록의 공백과 스크롤 규칙은 유지한다.
- 본문 시작점은 본문 wrapper의 왼쪽을 기준으로 한다. 행의 아이콘·드래그 핸들·
  계층 들여쓰기 뒤의 실제 글자까지 제목과 같은 위치로 당기지 않는다.
- 장식용 hover 배경은 항목을 구분하기 위한 것이다. 이 효과를 넣는다는 이유로
  pointer 커서나 클릭 동작을 추가하지 않는다. 기존 버튼·링크와 키보드 동작은 유지한다.
- Workflow의 phase·agent 계층과 원래 DOM 부모를 유지한다. 간격을 맞추기 위해
  native 노드를 옮기거나 동일한 액션을 복제하지 않는다.
- 백그라운드 작업 행은 진행 데이터가 있을 때만 버튼이 된다. 누르면 그 행 바로
  아래에 상태와 현재 진행이 아코디언으로 펼쳐지고, 다시 누르면 접힌다. 다른
  행을 열면 이전 행은 접힌다. 별도 팝오버는 만들지 않는다. 진행 데이터가 없는
  행은 장식용 hover만 유지하고 pointer를 추가하지 않는다.
- 백그라운드 단일 작업도 같은 공통 행·좌우 gutter를 쓴다. 별도 제목 disclosure와
  실제 작업 행을 구분하고, 원래 진행 데이터의 클릭·키보드 동작을 유지한다.
- 카드 제목 disclosure가 보여주는 첫 작업은 카드 여닫기를 유지한다. 그 작업은
  목록 짝에서 빼서, 같은 설명의 다른 행과 진행이 섞이지 않게 한다. 명령이
  하나뿐이라 제목이 버튼이 아니면 그 행이 아코디언을 연다.

## 정보량이 다른 행

- Child Thread는 오른쪽에 `idle` 같은 실행 상태를 한 번만 표시한다. 제목 아래에는
  모델명·effort를 두고 provider 이름과 별도의 완료 문구는 넣지 않는다. 모델명도
  제목처럼 남은 너비 안에서 한 줄 말줄임한다. provider 아이콘과 탐색 동작은 유지한다.
  완료 표시는 체크 없이 6px 점으로 표시한다. 미확인은 Thread Theme와 같은
  `--timeline-accent`, 확인 후는 `--subtle-foreground`를 쓴다. 읽음 변경도 즉시 반영한다.
- 상단 Child Thread 스택은 각 아바타와 `+N` 원에만 표면을 그린다. 공통 pill 배경·그림자를
  스택 전체에 적용하지 않는다. 열기·hover에서도 유지하며, 비활성 Child 아이콘은 일반 원형 pill을 쓴다.

모든 행을 같은 고정 높이로 만들지는 않는다. Child Thread의 탐색 행,
Agentation의 피드백·위치 두 줄, 대기 메시지 본문·편집기는 각각의 정보량에 따라
높아진다. 이 경우에도 내용과 배경의 padding, 둥근 모서리, 제목과의 정렬 원칙은
같다. Diff 커밋 연결선과 파일·통계의 정렬도 유지한다.

Diff 파일·커밋 행도 desktop padding 4px·radius 8px, phone padding 6px·radius 10px와 6% hover·기기별 gutter를 쓴다.
이 두 목록의 형제 간격은 0이다. 커밋 graph는 위아래 패딩을 포함한 행 전체 높이를
이어 붙이며, 첫·끝 항목과 접힌 목록 끝에서만 연결선을 끊는다.
Diff의 `N개 더 보기`와 접기도 공통 목록 행 모양과 gutter를 쓴다. 기기별 최소 높이·padding·radius와 6% hover·desktop 12px/14px·phone 13px/16px이며 보조 색과 펼침 캐럿을 유지한다.

입력·코드·편집기, standalone native 카드는 이 목록 규칙으로 덮지 않는다.

## 변경과 검수

- 가능한 변경은 먼저 native 상태·간격 차이를 재현하는 실패 테스트로 고정한다.
  문서만 바꿀 때는 내용과 참조 경로를 검토한다.
- 닫기·재열기·native 재렌더·플러그인 해제 후 원상 복구를 확인한다.
- 데모는 제품 코드를 직접 사용하고 데이터만 주입한다. 화면을 별도로 다시 만들지
  않는다. 외부 변경 액션만 검수용 콜백으로 바꾸고 검증 커밋을 표시한다.
- phone·desktop, light·dark, 한 줄·여러 줄, 짧은 목록·스크롤 목록을 확인한다.
  hover 배경의 모서리·가로 넘침·본문 스크롤과 실제 액션도 확인한다.
  목록은 0·1·10·100·500개, 본문은 공백 없는 경로·여러 줄·다국어·이모지를 주입한다.
  Diff와 Agentation은 로딩·오류도 확인하며 스크롤 끝의 항목이 접근 가능한지 검사한다.
- 보고에는 검증 커밋, 실행 중 번들의 일치 여부, 캡처, 미확인 범위를 적는다.
  화면 완료 여부는 사용자가 판정한다.

## 컴포저 높이와 입력 스크롤

- 입력 본문의 최대 높이는 문서 전체 높이 대신 현재 대화 패널과 `visualViewport`가
  겹치는 영역에서 계산한다. 위아래 분할, 창 크기 변경, 키보드로 줄어든 가용 영역을
  다시 측정한다. 전송·모델 버튼과 정보 줄 높이를 빼고 멘션 목록을 위한 공간을 남긴다.
- 본문이 길면 입력 본문 안에서 스크롤한다. 최소 입력 높이도 같은 상한 안에서 줄어든다.
  멘션 목록은 입력창 위에 남은 높이 안에서 스크롤한다.
- 컴포저 위의 휠과 한 손가락 스크롤은 대화 출력으로 전달하지 않는다. 입력 본문과
  멘션 목록 끝에서도 유지하며 확대 제스처는 막지 않는다. 대기 메시지 편집기는 기존
  팝오버의 높이·스크롤 규칙을 유지한다.

## Pill 선언의 소유

`lib/pill.ts`는 reference·remove·wide·navigation·attachment의 기존 선언과
slot 이름만 소유한다. `app.tsx`의 `pill-styles` content script가 공통 device
변수 sheet를 한 번 설치하고 해제한다. 독립 adapter fixture에는 같은 값의
fallback을 둔다. reference 변수는 device=phone이면 viewport와 무관하게 phone 값을 쓰며 속성이 없으면 desktop 값을 쓴다.

인용·멘션·예전 인용은 같은 reference 규격과 flat 면을 쓴다. 정보 줄의 frost·32px navigation, native Diff의 면·첨부 40/64px는 별도 역할이다. 데이터·선택·삭제·저장은 adapter에 둔다.

정보 줄·Diff의 색 fallback 6곳은 같은 색의 토큰을 입증하지 못해 유지했다.
현재 테마의 `--success`, `--warning`, `--destructive`와 기존 상태 fallback은
색이 다르며, `--color-purple-500`도 fallback hex와 동일한 색은 아니다.
테마 토큰이 없는 환경의 표시를 바꾸는 치환은 이번 이동에 포함하지 않는다.

## 컴포저 접기·펼치기 모션

- desktop·phone 모두 높이와 모서리를 같은 360ms와 kit 감속 곡선
  `cubic-bezier(0.22, 1, 0.36, 1)`으로 시작한다. 접힌 48px 줄과 테두리의
  실제 높이 50px에 맞춰 모서리 목표는 25px이며 펼침은 1.375rem이다.
  `999px`를 보간하면 현재 높이의 절반에서 모서리가 일찍 잘리므로 사용하지 않는다.
- native가 240ms 뒤 inline 높이를 해제해도 두 속성을 같은 음수 delay로
  이어 간다. 빠르게 반전하면 이전 곡선의 중간 radius와 보이는 높이에서 시작한다.
  다음 전환에는 종료 후의 실제 높이를 사용한다. 매 프레임 radius 측정은 추가하지 않는다.
- 동작 줄이기 설정에서는 높이·모서리를 즉시 바꾼다. Handoff의 기존 모션과
  native 햅틱·입력·전송 동작은 유지한다. 컴포저 분리·플러그인 해제 시
  모서리 inline 스타일·종료 listener와 기존 높이 timer를 정리한다.

## 대기 큐 hover 미리보기

desktop에서 hover로 연 대기 큐는 포인터가 필과 카드에서 벗어나면 기존 150ms 지연 후 닫는다.
native 큐가 열릴 때 자동으로 포커스를 보내는 숨겨진 `Collapse queued messages` 버튼은
사용자 조작으로 간주하지 않으며 미리보기를 고정하지 않는다. 필·카드의 직접 클릭과
본문 액션으로의 키보드 포커스는 기존처럼 카드를 고정한다. phone·touch의 클릭 동작은 유지한다.

## 조절판 확정 reference 값

| 문장 속 reference | desktop | phone |
|---|---|---|
| 높이 / 글자 / 줄 높이 | 22px / 13px / 16px | 24px / 14px / 18px |
| 왼쪽 padding | 10px | 12px |
| 삭제 원 / 가상 터치 영역 | 16px / 기존 원 | 18px / 24px 이상 |
| 삭제 × 도형 | 8px | 9px |
| 세로 / 가로 margin | −2px / 3px | −2px / 4px |

왼쪽 padding은 `--bb-chat-ui-pill-reference-pad-left`, 삭제 원은 `--bb-chat-ui-pill-reference-remove`로 선택한다. 원 안의 × 도형은 desktop 10→8px·phone 12→9px로 축소하며 원 16px·18px와 phone 24px 투명 터치 영역은 유지한다. 높이 22px에서 세로 margin 0은 desktop 입력 줄(22px)을 1.17px 늘려 −2px로 보정했다. 입력 줄 22px·보낸 줄 24px의 pill 유무 높이 차이는 0을 유지한다. phone 24px pill도 입력 27px·보낸 줄 24px에서 높이 차이 0을 유지하도록 세로 margin −2px를 쓴다.
