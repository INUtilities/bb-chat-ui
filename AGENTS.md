<!-- bb-plugin-kit:common begin — 자동 복사본이다. 여기서 고치지 말고
     ~/Foundry/bb-plugin/bb-plugin-kit/AGENTS.common.md를 고친 뒤 다시 복사한다. -->
## BB 플러그인 공통 규칙

이 저장소는 BB 플러그인이다. 아래 규칙은 `~/Foundry/bb-plugin` 아래 모든 플러그인에 같다.

1. **BB 앱은 고치지 않는다.** 이 저장소 안에서만 고친다. `~/Foundry/bb`(BB 앱 소스)와
   설치된 BB 앱 파일에는 쓰지 않는다. 플러그인으로 안 되는 일이면 멈추고 그렇다고 보고한다.
2. **폰이냐 컴퓨터냐는 `device`로 정한다.** 창 너비(`viewport`)는 화면을 얼마나 빽빽하게
   채울지에만 쓴다. 판정 코드는 kit에서 복사한 `useDeviceChrome()`만 쓰고, 복사본
   (`device.ts`, `use-device.ts`)은 고치지 않는다.
3. **검색은 검색어가 연속으로 들어 있는 것만 맞춘다.** 대소문자는 무시하고, 맞은 부분은
   진하게 표시한다. 흩어진 글자를 맞추는 fuzzy 검색은 쓰지 않는다.
4. **플러그인 전체 화면(navPanel)은 다른 스레드에 갔다 와도 보던 폴더·선택·보기를 그대로
   보여 준다.** BB를 껐다 켜면 처음 화면으로 돌아간다. 그래서 이 상태는 `sessionStorage`나
   모듈 변수에 두고, `localStorage`나 plugin settings에 두지 않는다.
5. **화면이 맞는지는 사용자가 판정한다.** 테스트가 초록이어도 화면 완료를 선언하지 않는다.
   완료 보고에는 네 가지를 적는다. 검증한 커밋, 지금 실행 중인 번들이 그 커밋인지,
   phone·desktop 캡처(없으면 없다고), 확인하지 못한 것.
6. **커밋과 브랜치.** 검증된 기능 단위마다 묻지 않고 커밋한다. push는 사용자가
   「푸시해」라고 할 때만 한다. 일이 끝나면 main에 머지하고, 머지된 브랜치와 워크트리를
   정리한다. 커밋 메시지는 commit-msg hook이 검사한다. `--no-verify`로 hook을 건너뛰지 않는다.
7. **디자인은 kit의 디자인 문서를 따른다.** UI를 만들거나 고치기 전에
   `~/Foundry/bb-plugin/bb-plugin-kit/docs/design.md`를 읽는다. 색은 BB 테마 토큰만 쓰고
   색값(`#hex`, `oklch(...)`)을 직접 넣지 않는다. 모션은 kit의 `motion/`을 복사해 쓴다.

### 이럴 때 kit 문서를 읽는다

- UI를 만들거나 고칠 때: `~/Foundry/bb-plugin/bb-plugin-kit/docs/design.md`
- 새 플러그인을 만들 때: `~/Foundry/bb-plugin/bb-plugin-kit/docs/new-plugin.md`
- 설치 위치를 옮기거나 git·npm 설치를 path로 바꿀 때, 화면에 옛 번들이 보일 때:
  `~/Foundry/bb-plugin/bb-plugin-kit/docs/install.md`
- 기기 판정을 바꾸거나 헬퍼를 다시 복사할 때: `~/Foundry/bb-plugin/bb-plugin-kit/docs/device.md`

### 규칙과 강제 장치

글로만 지키는 규칙은 어겨도 아무것도 실패하지 않는다. 장치를 하나 붙일 때마다 이 표를 고친다.
이 블록이 원본과 같은지는 kit에서 `npm run check-agents`로 검사한다.

| 규칙 | 지금 막는 장치 |
|---|---|
| 1 BB 앱 | 없음 (예정: `~/Foundry/bb` 쓰기 차단) |
| 2 기기 | 없음 (예정: 복사본 해시 검사) |
| 3 검색 | 없음 (예정: 공유 검색 모듈과 테스트) |
| 4 navPanel | 없음 |
| 5 화면 | 없음 (예정: `verify-bb-plugin`) |
| 6 커밋 | commit-msg hook: 형식·tag·명사 끝 검사. 원본 `~/Systems/registry-pool/scripts/git-hooks`, 연결은 kit `npm run sync-agents` |
| 7 디자인 | 없음 (예정: 직접 넣은 색값 검사, 모션 복사본 해시 검사) |
<!-- bb-plugin-kit:common end -->

## 이 플러그인만의 규칙

- plugin id: `bb-chat-ui`
- 확인 명령: `npm test`, `npm run typecheck`
- 이 플러그인의 제품 규칙은 이 절에 쓴다.
- 정보 팝오버 UI를 만들거나 고치기 전에 `docs/composer-popovers.md`를 읽고 카드·제목·목록 행의 공통 규격을 따른다.
- 정보 팝오버 글자는 desktop에서 제목 13px/15px·600, 목록·글자 액션 12px/14px, 긴 본문·사용자 메시지 11px/18px, 보조 정보 11px/18px를 쓴다. phone은 제목 14px/18px·600, 목록·글자 액션 13px/16px, 본문·보조 12px/18px다. 단일 행 PR·Parent 제목은 같은 제목 크기에 굵기 400이다. native·SDK에 같은 역할 규칙을 적용하고 html의 data-bb-chat-ui-root-device 속성으로 CSS 변수를 선택한다. 속성이 없으면 desktop 값이며 창 너비로 기기를 정하지 않는다.
- 정보 카드 여백은 루트 CSS 변수로 device별 선택한다. 안쪽은 12px 16px이며 desktop은 제목 줄 30px·본문 간격 10px·닫기 여백 34px, 아이콘 액션·닫기 20px(위 17px), 목록 행 최소 24px·padding 4px·radius 8px·형제 간격 6px다. phone은 제목 줄 32px·간격 10px·닫기 여백 34px·닫기 24px(위 15.5px), 행 32px·padding 6px·형제 간격 6px다. Diff·대기 메시지의 형제 간격 0은 유지한다. 컴포저 상단 정보 pill과 모델 메뉴의 기존 규격은 바꾸지 않는다.
- PR의 Merge 버튼과 오른쪽 캐럿은 같은 머지 방식 메뉴를 연다. `Merge`, `Squash merge`, `Rebase and merge` 중 하나를 선택했을 때만 실행한다.
- UI 구현 때마다 같은 제품 코드를 직접 쓰고 검수 데이터를 주입하는 데모를 함께 갱신해 사용자에게 띄운다. 데모는 `thread-storage`에 두고 검증한 커밋을 표시하며, 외부 변경 액션만 검수용 콜백으로 대체한다.
- 정보 팝오버 제목은 읽기 전용이며, 제목·액션·닫기는 세로 중앙선을 맞추되 phone 일반 카드의 닫기는 사용자 시각 보정으로 0.5px 위에 둔다. 닫기 기하 아이콘은 desktop 8px·phone 9px, SVG stroke 1.5이며 버튼·터치 영역은 유지한다. PR·Parent 단일 행은 기존 닫기 top 8px를 유지한다. 실제 액션과 내부 목록 펼치기는 유지한다. 목록 hover는 상태별로 달라지지 않게 padding·radius·전환을 통일하며, 장식용 행에 pointer를 추가하지 않는다.
- 정보 pill 팝오버와 전체 정보 목록은 Code Diff의 공통 최대 높이 변수를 공유한다. 내용이 짧으면 내용만큼만 높아지고, 긴 내용은 해당 상한에서 스크롤한다.
- phone 하단 시트는 `+`·모델 선택·전송 옵션·PR 머지 방식 같은 컴포저 옵션 메뉴에만 적용한다. 좌우·아래 8px·모서리 30px·손잡이 40×4px·frost 한 겹을 쓰며 BB drawer의 높이·선택·끌기·닫기는 유지한다. 정보 pill 상세·전체 정보 목록·인용 원문은 기존 팝오버를 유지한다. stylesheet는 phone일 때만 설치하고 desktop CSS는 바꾸지 않는다. 독립 접힘·펼침 controller는 디자인 레퍼런스 데모에만 명시적으로 연결한다. 자세한 규칙은 `docs/composer-popovers.md`의 phone 옵션 메뉴 하단 시트 절이다.
- phone 옵션 시트 내부는 desktop과 같은 컨트롤을 쓴다. 모델 선택의 Effort 파형·Fast mode 토글을 공유하고 모델·섹션·검색은 12px/16px, 메뉴 inset·행 모서리는 4px·10px로 맞춘다. native 검색·선택·비활성 상태와 phone 터치 padding은 유지한다.

- 문장 안 reference pill(인용·멘션·예전 인용)은 desktop 22px·phone 24px이며 글자는 13/16·14/18이다. 세로 padding은 0, 세로 margin은 두 기기 모두 −2px이며 가로 margin은 3px·4px다. −2px는 desktop 입력 22px·보낸 줄 24px, phone 입력 27px·보낸 줄 24px의 증가를 막는 보정이다. × 도형은 desktop 8px·phone 9px이며 보이는 원은 16px·18px이고 phone의 투명한 가상 터치 영역은 24px 이상이다. 라벨만 잘라 말줄임하며 일반 글줄의 높이를 늘리지 않는다. 상단 navigation pill 32px와 첨부 칩은 이 규칙의 대상이 아니다.
