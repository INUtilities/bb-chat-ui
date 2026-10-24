# 인용·멘션 pill

## 면

컴포저·대기 큐·보낸 메시지의 인용과 멘션, 예전 blockquote 인용은
`lib/pill.ts`의 `referenceFace`를 쓴다. foreground 7% 채움 하나이며
1px 테두리 자리는 투명하게 유지한다. 그라데이션·그림자·backdrop blur는 없다.
멘션의 기존 링크 hover는 foreground 11%다. 컴포저 위 정보 pill은 이 범위에 포함하지 않는다.

## 크기와 말줄임

예전 blockquote와 새 인용, 컴포저와 보낸 메시지는 reference 역할의
높이 desktop 28px·phone 32px, 최대 너비 140px·240px를 공유한다.
글자는 desktop 12/16, phone 14/18이다. phone 값은 루트 device 속성으로 선택하며
넓은 폰에서도 유지한다. hover·focus로 크기를 늘리지 않고 한 줄 말줄임을 유지한다.
인용인 FileDiff도 같은 최대 너비를 쓴다. 일반 파일 행 범위·커밋 멘션의 wide 예외는 유지한다.

## 삭제 액션

편집 중의 삭제 ×는 항상 보이는 desktop 20px·phone 24px 원이다.
foreground 9% 면, hover 16%, glyph opacity 75%, 2px focus ring을 쓴다.
`pillStyle.remove`·`removeHover`·`removeFocus`가 값의 원본이다.
글자가 버튼 아래로 가지 않게 오른쪽 30/34px를 확보한다. 읽기 전용 보낸 메시지에는 삭제를 만들지 않는다.

## 예전 인용의 실제 삭제 버튼

예전 인용도 Tab으로 갈 수 있는 실제 버튼을 쓴다. Enter·Space·클릭은 같은
ProseMirror 삭제 transaction을 실행해 native undo를 유지한다. 인용 본문 오른쪽 좌표에
버튼을 맞추되 DOM은 ProseMirror 밖의 편집기 wrapper에 둔다. 따라서 저장 문서에
버튼·× 글자가 들어가지 않고 native의 문서 재파싱과도 경합하지 않는다.
버튼별 listener는 없고 기존 문서 위임을 재사용한다. 위치 관찰은 해당 편집기에만
한정하며 wrapper 제거·마지막 인용 제거·플러그인 해제 때 observer와 overlay를 정리한다.
