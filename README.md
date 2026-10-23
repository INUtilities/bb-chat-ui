# bb-chat-ui

<p align="center">
  <strong>chat message and composer chrome for BB.</strong>
</p>

<p align="center">
  <a href="#install">install</a> · <a href="#what-it-does">what it does</a> · <a href="#related">related</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-666666?labelColor=333333" alt="MIT license" /></a>
</p>

---

A BB plugin that restyles the thread transcript and composer. 폰 패널 모션은 Mobile UI (`sidebar`), 스레드 행 테마는 `bb-thread-theme`가 담당한다.

- **composer** — frosted prompt box; quote and mention pills stay as pills
- **messages** — user attachments, queued messages, and jump/TOC chrome
- **haptics** — `impact-light` on send when the host supports it
- **workspace** — a compact diff pill for checkout line changes

## install

Requires [bb](https://getbb.app) with a compatible Plugin SDK (`engines` in `package.json`).

From a clone:

```bash
git clone https://github.com/INUtilities/bb-chat-ui.git
cd bb-chat-ui
bb plugin install . --yes
```

Or from GitHub:

```bash
bb plugin install 'git:https://github.com/INUtilities/bb-chat-ui.git@main' --yes
```

Plugin id: `bb-chat-ui`.

## what it does

Registers composer customize plus content scripts in `app.tsx` (`composer-glass`, quote/mention pills, queued messages, thread TOC, user attachments, workspace diff pill). It does not own the sidebar list or ribbon.

컴포저·변경 필·맨 밑으로 버튼·Agentation staging의 표면은 해당 채팅 배경의 색조를 유지하며 밝기만 조금 올린다. 순백에서는 기존 얇은 그림자로 구분한다. 일반 채팅은 `--background`, sidebar 톤은 `--sidebar`를 기준으로 한다. 고정 캔버스를 덮어쓰지 않는다. glass 불투명도는 라이트 68%, 다크 76%이며, 하이라이트는 흐린 inset `0 1px 3px`로 표면에 부드럽게 이어진다. 컴포저만 흰색을 라이트 60%, 다크 14%로 섞어 상단 반사광을 더 선명하게 한다. footer fade는 컴포저 위 64px까지 옅게 펼친다. 높이의 90%까지는 반투명으로 두고, 마지막 10%에서 채팅 배경색에 완전히 닿게 해 하단 경계를 잇는다. blur와 바깥 그림자, 모션은 유지한다. 다른 플러그인의 색 변수나 설정에 의존하지 않는다.

## 컴포저 위 정보 설정

전체 정보 목록에는 현재 데이터가 없는 계열도 `현재 없음`으로 남긴다. 모든 목록 항목은 계열별 아이콘을 표시하며, 현재 정보가 없는 상태에서도 아이콘을 유지한다. 호스트 펼침 화살표 대신 해당 계열 아이콘을 쓰고 Agentation은 원래 glyph를 보존한다. 선택하면 `현재 정보 없음`을 표시하며, 정보가 생기면 실제 상세로 바뀐다. 데이터가 없는 상단 필이나 가상의 Diff 수치는 만들지 않는다.

`Settings → Chat UI`에서 각 계열을 `상단 표시`, `목록에만 표시`, `끄기` 중 하나로 설정한다. Code Diff와 Child Thread는 기본으로 상단에 표시하고, 나머지는 목록에만 표시한다. 공간이 부족하면 상단 항목도 자동으로 전체 정보 버튼 안에 접힌다. `끄기`는 상단과 목록 모두에서 제외한다. 전부 끄면 정보 줄도 숨긴다. 스크롤할 내용이 남은 팝오버 가장자리에는 블러 그라데이션을 표시하고, 해당 끝에 도달하면 없앤다. 상세는 한 번에 하나만 펼친다. Code Diff도 먼저 변경 요약 팝오버를 열고, 타이틀 옆의 `Diff 패널 열기` 아이콘으로 옆 패널에 이동한다. 사이드 패널·플러그인 페이지 열기 액션도 목적지를 툴팁에 남긴 아이콘으로 타이틀 옆에 표시한다.

기존 boolean 설정을 사용한 설치를 업그레이드할 때는 빌드·reload 전에 `bb plugin config bb-chat-ui --json`의 값을 보관하고, reload 후 같은 키에 `true → 상단 표시`, `false → 목록에만 표시`로 저장해 선택을 유지한다. 설정 변경으로 대기 메시지를 끄더라도 진행 중인 행 편집은 끝날 때까지 유지한다.

입력 요청 중에는 요청만 표시하고 입력창도 숨긴다. 요청이 끝나면 초안을 그대로 복원한다. 큐는 기존 숫자 버튼을 숨기고 새 정보 버튼 하나로 연다. 이전 큐의 레이아웃·자동 접기·클릭 처리는 새 팝오버와 분리하며, native 편집·전송 동작은 유지한다. 큐 편집 중에는 다른 상세로 전환하지 않고 편집을 끝내면 전환할 수 있다. Archived 화면의 정보도 숨겨서 보관하며, 호스트 복구 버튼은 유지한다. 새 Child Thread는 bubble 모션으로 나타나며 reduced motion 설정을 따른다.

Child Thread는 배경 없는 색상 아바타 스택과 상태 점으로 표시한다. 세 개까지 왼쪽에서 오른쪽으로 겹치고, 초과분은 맨 오른쪽의 별도 원에 `+N`으로 표시한다. 펼치면 아바타·제목·provider·상태 목록에서 각 스레드를 연다. Agentation은 원래 카드의 피드백 아이콘과 개수로 압축하고, 펼치면 본문과 위치·대상을 표시한다. 전체 전송·삭제는 목록 아래에 두고 개별 액션도 유지한다.

검증: `npm ci`, `npm test`, `npm run typecheck`, `bb plugin build`.

## related

| plugin | role |
| --- | --- |
| Mobile UI (`sidebar`) | 폰 패널 모션 |
| `bb-thread-theme` | thread list look and row chrome |
| BB host | 내비게이션 |

## license

MIT. See [LICENSE](LICENSE). Copied icon sources and their original notices are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The app bundle retains the full notices in its `thirdPartyIconNotices` metadata export.

정보 필·원 버튼·팝오버·상세 버튼은 컴포저와 같은 테마 기반 glass 표면을 쓴다. 채팅·sidebar 배경의 색조와 라이트·다크 투명도를 함께 따르고, 주변 버튼과 같은 블러·부드러운 하이라이트를 적용한다. Diff 상세에는 HEAD 이후 미커밋 파일별 통계와 전체 브랜치명, PR 후보·미푸시 커밋 수 및 비교 대상, 커밋 목록을 표시하며 열린 상태에서도 갱신한다. main/master의 clean pill은 origin 대비 미푸시 수, 작업 브랜치의 clean pill은 PR 후보 수만 표시한다. 브랜치의 미푸시 정보는 팝오버에만 둔다. 이름은 pill에서만 `…` 포함 10자로 제한한다. clean main/master에서 미푸시가 0이면 상단 pill을 숨기고 전체 정보의 상세는 유지한다. 원격 ref가 없으면 숫자를 0으로 가정하지 않는다. 원격 비교는 마지막 확인 상태 기준이며 자동 fetch·push는 하지 않는다.

`정보가 없어도 상단 아이콘 표시` 토글은 기본 꺼짐이다. 켜면 `상단 표시`로 선택한 빈 항목도 작은 아이콘으로 남기며, 클릭하면 현재 정보가 없음을 보여 준다. `목록에만 표시`와 `끄기` 항목은 상단에 추가하지 않는다. 실제 정보가 생기면 원래 요약으로 전환한다.

Code Diff pill의 커밋 수는 `commits` 문구 대신 가운데 원과 가로선이 있는 커밋 아이콘과 숫자로 압축한다. 접근성 라벨과 툴팁에는 커밋 개수 의미를 유지한다. 팝오버는 커밋 목록을 위에, HEAD 이후 변경 파일 목록을 아래에 둔다. 커밋 행 왼쪽의 원을 세로선으로 연결하고 첫·마지막 원 밖으로는 선을 늘리지 않는다. 파일 행 왼쪽에는 수정(점), 추가(+), 삭제(−), 이름 변경(화살표), 복사, 충돌, 미추적 상태를 구분하는 사각형 아이콘을 둔다. 추가·삭제는 기존 diff 색을 쓰며 파일 경로와 라인 통계를 유지한다. 팝오버의 일반 안내 문구는 표시하지 않으며, PR 후보의 미푸시 보조 줄은 개수를 확인할 수 있을 때만 표시한다.

Diff 재조회는 마지막 정상 표시를 유지한 채 진행한다. 메시지 스트림·제목 등 환경과 무관한 스레드 변경으로 데이터를 비우거나 재조회하지 않는다. 환경 변경과 5초 polling·focus에서 완성된 결과로 교체하며, 조회 중 변경 이벤트가 오면 이전 요청 결과를 버린다. 다른 스레드로 이동하면 이전 스레드 데이터를 표시하지 않고, 환경 해제는 확인된 뒤 비운다.

컴포저 정보 팝오버의 스크롤은 채팅으로 전달하지 않는다. 내부 목록·편집기의 기본 wheel·한 손가락 스크롤은 유지하고, 팝오버가 짧거나 위·아래 끝인 경우 바깥 스크롤로 이어지지 않게 한다. 팝오버 밖의 채팅 스크롤과 pinch zoom은 유지하며 해제 시 관련 리스너를 정리한다.

스레드 첫 진입에서 Diff SDK source가 아직 비어 있으면 상단 Diff 필을 표시하지 않는다. 최초 결과의 작업트리·브랜치·미푸시 상태로 바로 표시하며, 빈 아이콘 설정도 이 로딩 상태에는 적용하지 않는다. 전체 정보 목록은 유지한다.

Diff 팝오버의 커밋 목록은 SDK `authoredAt` 기준 최신순으로 표시한다. 동일 시각은 원래 상대 순서를 유지하며, 팝오버를 연 상태에서 목록이 갱신되어도 같은 정렬을 적용한다.
