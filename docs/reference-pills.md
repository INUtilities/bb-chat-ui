# 인용·멘션 pill

## 면

컴포저·대기 큐·보낸 메시지의 인용과 멘션, 예전 blockquote 인용은
`lib/pill.ts`의 `referenceFace`를 쓴다. foreground 7% 채움 하나이며
1px 테두리 자리는 투명하게 유지한다. 그라데이션·그림자·backdrop blur는 없다.
멘션의 기존 링크 hover는 foreground 11%다. 컴포저 위 정보 pill은 이 범위에 포함하지 않는다.

## 인용·파일 종류와 공통 아이콘

일부 문장을 선택해 넣거나 출처 종류를 알 수 없는 인용은 범용 Quote 아이콘을 쓴다.
메시지 전체 인용 동작으로 넣은 인용은 MessageSquare를 쓴다. 같은 본문이라도
문장 선택 동작으로 넣으면 범용 인용으로 남는다. `diff --git`로 시작하는 변경 내용과
명시적인 코드 블록(` ``` ` 또는 `~~~` 접두사)은 모두 Code 아이콘을 쓴다.
예전에 저장한 FileDiff 인용도 같은 코드 아이콘으로 표시한다.
코드 블록의 표시 이름에는 구분자 대신 첫 코드 줄을 사용한다.
코드 종류 정보나 구분자가 없는 일반 텍스트를 내용만 보고 코드로 추정하지 않는다.
예전 blockquote와 아이콘 정보가 없는 인용은
범용 인용이며, 저장된 본문만으로 전체 메시지 여부를 추정하지 않는다.

파일 경로 멘션(`kind: path`, `entryKind: file`)은 File 아이콘을 쓴다.
파일명처럼 보이는 문장을 파일로 추정하지 않으며, 폴더·첨부·웹·이미지 분류는 추가하지 않는다.
파일의 열기·편집 동작은 호스트가 유지하고 인용 전용 잠금·원문 팝업은 적용하지 않는다.

네 자산은 `lib/quote-icons.ts`의 Lucide 0.300.0 마스크를 공통으로 쓴다.
코드 인용과 코드 블록 제목도 같은 Code 자산을 사용한다.
파일 멘션과 첨부 파일 칩도 같은 File 자산을 사용한다.
새 인용은 같은 glyph 표시 경로를 쓰고 예전 blockquote도 같은 Quote 마스크를 쓴다.
다른 화면의 아이콘을 복제하거나 늦게 나타날 아이콘을 기다리지 않는다.
호스트 아이콘의 원래 DOM은 유지하며 인용·파일 종류 변경·제거·플러그인 해제 시
플러그인 소유 glyph를 정리하고 숨긴 아이콘 표시를 복구한다.

## 크기와 말줄임

예전 blockquote와 새 인용, 컴포저와 보낸 메시지는 reference 역할의
높이 desktop 18px·phone 20px, 최대 너비 140px·240px를 공유한다.
글자는 desktop 12/16, phone 14/18이다. phone 값은 루트 device 속성으로 선택하며
넓은 폰에서도 유지한다. 세로 padding·margin은 0이며 가로 margin 3px·4px는 유지한다.
1px 투명 테두리와 16px·18px 글줄을 합친 높이로, 일반 글줄 높이를 키우지 않는다. hover·focus로 크기를 늘리지 않고 한 줄 말줄임을 유지한다.
코드 인용도 같은 최대 너비를 쓴다. 일반 파일 행 범위·커밋 멘션의 wide 예외는 유지한다.

접힌 입력창에서 필 자체는 inline-flex로 두되, 주변 문단은 일반 inline 글줄로 배치한다.
문장 전체를 flex 항목으로 나누지 않으며 줄바꿈 뒤의 문장은 문단 왼쪽부터 이어진다.
인용 원문 열기·삭제·라벨 말줄임과 기존 필 최대 너비는 유지한다.

## 삭제 액션

편집 중의 삭제 ×는 항상 보이는 desktop 16px·phone 18px 원이다.
phone은 버튼의 투명한 24px 가상 영역으로 터치 크기를 확보한다. pill의 overflow는 visible이며
라벨 자체가 말줄임을 처리해 터치 영역이 줄 배치나 높이를 늘리지 않는다.
foreground 9% 면, hover 16%, glyph opacity 75%, 2px focus ring을 쓴다.
`pillStyle.remove`·`removeHover`·`removeFocus`가 값의 원본이다.
글자가 버튼 아래로 가지 않게 오른쪽 26/28px를 확보한다. 읽기 전용 보낸 메시지에는 삭제를 만들지 않는다.

## 예전 인용의 실제 삭제 버튼

예전 인용도 Tab으로 갈 수 있는 실제 버튼을 쓴다. Enter·Space·클릭은 같은
ProseMirror 삭제 transaction을 실행해 native undo를 유지한다. 인용 본문 오른쪽 좌표에
버튼을 맞추되 DOM은 ProseMirror 밖의 편집기 wrapper에 둔다. 따라서 저장 문서에
버튼·× 글자가 들어가지 않고 native의 문서 재파싱과도 경합하지 않는다.
버튼별 listener는 없고 기존 문서 위임을 재사용한다. 위치 관찰은 해당 편집기에만
한정하며 wrapper 제거·마지막 인용 제거·플러그인 해제 때 observer와 overlay를 정리한다.

## 인용 원문 팝업

컴포저와 보낸 메시지의 인용 본체는 클릭·Enter·Space로 원문을 연다.
삭제 ×는 별개다. `quote-preview.ts`는 열 때 카드 하나를 만들고 document 위임으로
동작하며 pill별 listener·대화 observer를 만들지 않는다. 새 인용의 focus 속성은
기존 quote-mention 추가 노드 경로에서 함께 설정한다. 예전 ProseMirror blockquote에는
접근성 속성을 쓰지 않는다. native 문서 복구와 경합하지 않도록 열기 버튼도 삭제와
같은 바깥 overlay에 두며, Tab·Enter·Space와 포커스 복귀는 이 실제 버튼을 사용한다.

카드 면·제목·닫기·본문·보조 글자는 `info-card.ts`의 CARD·slot·style을 재사용한다.
높이는 `--bb-chat-ui-info-max-height`와 같은 `min(50dvh,26rem)` 상한을 따르며
본문만 스크롤한다. 원문 줄바꿈은 유지하고 코드 인용은 코드 글꼴을 쓴다.
desktop은 pill 위에 붙이고 공간이 없으면 아래로 배치한다. phone은 전체 가용 폭이며
컴포저가 있으면 그 위에 놓는다. 바깥 클릭·Escape·×로 닫고 포커스를 돌려준다.

새 인용의 전문은 기존 KV에서 `readQuote` RPC로 읽는다. ID를 검증하고 저장 값을
그대로 반환하며 읽기에 저장 부작용은 없다. 오래된 blockquote는 DOM의 전체 문단·코드를
읽는다. 짧은 라벨을 전문으로 대신 표시하지 않는다. 실패·원문 없음은 별도 안내한다.
현재 인용 데이터에는 원래 메시지·스레드·시각·위치 식별자가 저장돼 있지 않다.
따라서 표시 이름만 보조 정보에 표시하고 위치 이동 액션은 만들지 않는다.

폰 BB 앱의 haptic capability가 있을 때만 열기·닫기에 impact-light를 낸다.
같은 인용은 400ms 안에 다시 울리지 않으며 두 번째 손가락은 무시한다.
동작 줄이기에서는 kit의 팝오버 모션을 끈다. 닫기·해제 시 카드와 열린 동안의
resize·scroll·navigation listener를 정리한다.
