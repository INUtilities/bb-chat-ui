# 외부 라이브러리·디자인 에셋 라이선스 점검

- 점검일: 2026-10-19.
- 최초 점검의 제품 코드 기준: `c97efc5` (`main`).
- 이 문서는 소스와 공식 라이선스 원문을 대조한 기술 점검 기록이다. 아래 최초 점검 내용의 ‘현재’는 이 기준 커밋을 뜻한다. 법적 위반 여부는 단정하지 않는다.

## 2026-10-19 시정 결과

최초 점검의 열린 지적 3개를 다음과 같이 보완했다. 이후 절은 최초 점검의 증거와 당시 상태를 보존한 기록이다.

- 상태 아이콘: Lucide `0.300.0`의 `activity.svg`와 일치하는 출처를 명시하고, Lucide ISC와 그 원문에서 인정한 Feather MIT 고지를 추가했다. 실제 과거 복사 경로를 확인했다고 주장하지 않는다.
- Hugeicons 8개: 확인한 무료 저장소 리비전과 제품 내 이름의 대응 관계, `Copyright (c) 2025 Hugeicons`, MIT 원문을 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)에 추가했다. 기존 도형은 유지했다.
- 인용·파일 SVG: 최초 출처를 확정할 수 없던 두 문자열을 제거하고, Lucide `0.300.0`의 `quote.svg`·`file.svg`에서 직접 가져온 도형으로 교체했다. 인용은 여는 부호로 보이도록 180도 회전하고, 두 아이콘의 선은 CSS 마스크용 검정으로 지정했다. 기존 CSS 크기·이벤트·기기 판정은 유지했다.

원본 저작권·허가·면책 문구는 루트 고지 파일과 `lib/third-party-icon-notices.ts`에 보존한다. BB 앱 빌더는 `legalComments: "none"`으로 주석을 지우므로, `app.tsx`는 `thirdPartyIconNotices`를 공개 메타데이터로 내보낸다. 이 값은 DOM·네트워크·타이머를 사용하지 않으며, `app.js`만 전달해도 원문이 남도록 한다. README에도 고지 파일을 연결했다.

배포 검증에서 새로 생성한 `dist/app.js`에 세 라이선스 원문과 공개 메타데이터 export가 남는지, npm 패키지 목록에 루트 고지·메타데이터 소스가 포함되는지를 확인했다. 두 교체 SVG의 모든 path·polyline 좌표도 지정한 Lucide 원본과 대조했다. 별도 SDK·React·개발 도구 전체를 재배포할 때의 조건은 이 시정 범위에 포함하지 않는다.

인용·첨부 관련 테스트 11개, 타입 검사, BB 빌드는 통과했다. 전체 `npm test`는 364개 중 359개 통과·5개 실패였다. 실패한 정보 제목·큐 모션 테스트 5개를 수정 전 `306b871` 아카이브와 현재 소스에서 각각 다시 실행해 같은 항목의 실패를 재현했다. 이번 시정에서 해당 기능은 수정하지 않았다. 실제 제품 CSS 함수와 첨부 마커 주입 코드를 사용한 데스크톱·폰 검수 페이지도 확인했다. 폰 실기기·BB 실제 대화 화면은 이 검수 페이지와 별개이며, 사용자의 화면 판정은 남아 있다.

## 점검 결론

확인한 외부 아이콘과 라이브러리에서 상업용 사용을 금지하거나 이 프로젝트의 MIT와 충돌하는 조건은 찾지 못했다. 다만 직접 포함한 Hugeicons 도형 8개와 Lucide·Feather 계열 상태 아이콘의 저작권·허가 고지가 빠져 있다. 현재 상태를 고지까지 완료한 배포물로 판정할 수는 없다.

인용 부호·파일 SVG 등 일부 작은 도형의 최초 출처는 확정하지 못했다. 이는 출처 기록을 보완할 항목이며, 그 자체가 침해나 유료 에셋 사용의 증거는 아니다.

직접 npm 의존성 6개와 전이 의존성을 합친 50개를 점검했다. React와 SDK는 제품 코드에서 사용하지만, 기존 앱 번들은 BB 공유 런타임을 참조한다. jsdom·TypeScript·타입 선언은 테스트·개발 도구다. 이미지·폰트 등 별도 에셋 파일은 tracked 목록에 없다. SVG 도형은 코드에 포함되어 있으므로 파일 확장자 검색만으로 제외하면 안 된다.

## 디자인 에셋에서 확인한 사실

외부 SVG 도형을 직접 포함하고 있다. npm 의존성만 확인하면 이 에셋들은 목록에 나오지 않는다. 직접 포함한 Hugeicons 도형은 공식 무료 저장소에서 일치하는 파일을 찾았다. 사용 자체를 금지하는 조건은 찾지 못했지만, 현재 저장소에는 해당 제작자의 저작권·라이선스 고지가 없다.

### Hugeicons 도형 8개

공식 `hugeicons/hugeicons`의 `c1b280d3964e115dfdefb58241f6d93ca68f7b6d`에서 SVG를 받아 제품 소스와 비교했다. 아래 파일들의 모든 `path d` 값이 제품 코드와 일치했다. `help-circle`의 원 도형도 중심 `(12, 12)`, 반지름 `10`으로 일치했다. 제품은 선 색상을 `currentColor`로 바꾸고 React 또는 DOM으로 SVG를 만든다. 출처 파일을 npm 패키지로 import하지 않고, 도형 데이터를 직접 포함한다.

| 제품 코드 | 제품 내 이름 | 공식 무료 도형 |
|---|---|---|
| `app.tsx:33` | `bb-chat-ui-queue` / `MessageDelay02Icon` | [message-delay-02.svg](https://github.com/hugeicons/hugeicons/blob/c1b280d3964e115dfdefb58241f6d93ca68f7b6d/icons/message-delay-02.svg) |
| `lib/composer-diff-icons.ts:25` | `DiffModified` | [square-dot.svg](https://github.com/hugeicons/hugeicons/blob/c1b280d3964e115dfdefb58241f6d93ca68f7b6d/icons/square-dot.svg) |
| `lib/composer-diff-icons.ts:29` | `DiffAdded` | [add-square.svg](https://github.com/hugeicons/hugeicons/blob/c1b280d3964e115dfdefb58241f6d93ca68f7b6d/icons/add-square.svg) |
| `lib/composer-diff-icons.ts:33` | `DiffRemoved` | [minus-sign-square.svg](https://github.com/hugeicons/hugeicons/blob/c1b280d3964e115dfdefb58241f6d93ca68f7b6d/icons/minus-sign-square.svg) |
| `lib/composer-diff-icons.ts:37` | `DiffRenamed` | [square-arrow-right-01.svg](https://github.com/hugeicons/hugeicons/blob/c1b280d3964e115dfdefb58241f6d93ca68f7b6d/icons/square-arrow-right-01.svg) |
| `lib/composer-diff-icons.ts:41` | `DiffConflict` | [alert-square.svg](https://github.com/hugeicons/hugeicons/blob/c1b280d3964e115dfdefb58241f6d93ca68f7b6d/icons/alert-square.svg) |
| `lib/composer-diff-icons.ts:46` | `Copy` | [copy-01.svg](https://github.com/hugeicons/hugeicons/blob/c1b280d3964e115dfdefb58241f6d93ca68f7b6d/icons/copy-01.svg) |
| `lib/composer-diff-icons.ts:50` | `CircleQuestion` | [help-circle.svg](https://github.com/hugeicons/hugeicons/blob/c1b280d3964e115dfdefb58241f6d93ca68f7b6d/icons/help-circle.svg) |

Hugeicons는 Free Stroke Rounded 도형과 `@hugeicons/core-free-icons`를 MIT로 공개한다. 개인·상업용 사용과 변경·재배포를 허용하며, 원본의 저작권·허가 고지를 사본에 유지해야 한다. 무료 도형에는 Pro 라이선스의 좌석·키 조건을 적용하지 않는다. 확인한 저장소의 저작권 표시는 `Copyright (c) 2025 Hugeicons`다. [공식 무료·Pro 구분](https://hugeicons.com/docs/faqs/license-questions), [해당 리비전의 MIT 원문](https://github.com/hugeicons/hugeicons/blob/c1b280d3964e115dfdefb58241f6d93ca68f7b6d/LICENSE.md).

일치한 SVG는 이 MIT 저장소 안의 `icons/` 파일이며, 공식 README도 무료 도형과 저장소 소스를 MIT로 명시한다. 따라서 이름이나 모양만으로 무료라고 추정한 것이 아니다. 공식 사이트는 Pro와 무료 조건을 함께 설명하고, 저장소 LICENSE는 실제 일치한 소스에 대한 원문을 제공한다. 두 근거 사이에서 이 무료 SVG의 MIT 사용 조건이 충돌하는 부분은 찾지 못했다. 출처를 확인한 위 도형들에는 별도 유료 라이선스가 필요하다는 근거가 없다. 출처 미확인 SVG까지 같은 결론을 적용하지는 않는다. [공식 저장소의 라이선스 설명](https://github.com/hugeicons/hugeicons/blob/c1b280d3964e115dfdefb58241f6d93ca68f7b6d/README.md#license).

제품 git 기록에서도 `1d4b53d`는 MessageDelay02Icon의 로컬 등록을, `c9000cc`는 BB 스레드 정보와 같은 파일 상태 도형의 도입을 명시한다. 이 기록은 제품에 들어온 시점을 보여 준다. 당시 실제 다운로드 경로나 패키지 버전까지 기록한 것은 아니다.

### 상태 아이콘의 Lucide·Feather 도형

`app.tsx:26`의 `bb-chat-ui-status`에는 `M22 12h-4l-3 9L9 3l-3 9H2`를 직접 포함한다. 이 값은 [Lucide 0.300.0의 activity.svg](https://github.com/lucide-icons/lucide/blob/0.300.0/icons/activity.svg)의 `path d`와 정확히 일치한다. [Feather의 activity.svg](https://github.com/feathericons/feather/blob/main/icons/activity.svg)는 같은 좌표를 `polyline`으로 표현한다. 현재 Lucide main의 activity 도형은 이미 달라졌으므로, 최신 도형과 일치한다고 판정하지 않았다.

Lucide 0.300.0의 ISC 원문에는 Feather 부분의 Cole Bemis 저작권과 나머지 Lucide Contributors 저작권이 함께 적혀 있다. 사본에 저작권·허가 고지를 유지해야 한다. Feather 원문은 Cole Bemis의 MIT다. 현재 제품에는 이 두 출처의 고지가 없다. 실제 복사 경로·버전은 남아 있지 않아, 고지를 정리할 때 확인된 출처와 버전을 함께 적는 것이 적절하다. [Lucide 해당 버전의 ISC 원문](https://raw.githubusercontent.com/lucide-icons/lucide/0.300.0/LICENSE), [Feather MIT 원문](https://raw.githubusercontent.com/feathericons/feather/main/LICENSE).

### BB 호스트가 제공하는 아이콘

`lib/composer-info-bridge.ts`는 SDK의 `experimental_Icon`과 `experimental_ProviderIcon`을 사용한다. `lib/composer-info-settings.ts`는 `GitBranch`, `UserRound`, `MessageSquare` 같은 이름을 전달한다. `lib/quote-mention.ts`와 `lib/composer-info.ts`는 호스트에 표시된 SVG를 복제해서 쓰기도 한다.

설치된 SDK `0.6.31`의 타입 문서는 아이콘 이름을 호스트가 해석한다고 명시한다. 플러그인 등록 도형이 기본 BB 도형보다 우선한다(`bundled-types/bb-plugin-sdk-app.d.ts:18686`). 따라서 이름이 Lucide와 같다는 사실만으로 실제 SVG를 Lucide 도형이라고 분류할 수 없다. 이 경로에는 외부 아이콘 패키지를 직접 import하는 코드가 없다. 호스트·provider 도형의 전체 출처와 호스트 배포물의 고지 준수까지는 이번 플러그인 점검으로 확정하지 않았다.

### 자체 kit에서 복사한 모션·기기 코드

`lib/motion.ts`, `lib/motion.css`, `lib/device.ts`, `lib/use-device.ts`는 옆 저장소 `bb-plugin-kit`의 원본과 SHA-256이 모두 같다. kit 기준 리비전은 `88a1a031a587bd818b6aa07991d32f83c84563b7`이다.

- `bb-plugin-kit/README.md`는 이 파일들을 각 플러그인으로 복사해 쓰는 공용 원본이라고 설명한다.
- `bb-plugin-kit/docs/design.md:5`는 모션 값을 사용자가 데모에서 골랐다고 설명한다. Anime.js·GSAP 같은 외부 모션 패키지를 import하지 않는다.
- kit의 `package.json`은 MIT를 선언한다. 별도 `LICENSE`와 `NOTICE`는 없다.
- kit git 기록에서 기기 코드 도입은 `a4852dd`, 공용 모션 도입은 `1bef8ee`이며 작성자는 `HIJKM`이다. 제품 루트 MIT도 `HIJKM` 명의다. 이 사실만으로 법적 권리 소유 관계까지 확정하지는 않는다.

동일 작성자 계열의 내부 공용 코드로 보이며, 외부 유료 모션 에셋을 사용했다는 근거는 찾지 못했다. kit를 별도 배포한다면 MIT 선언만 있는 상태보다 저작권자·연도·허가 원문을 갖춘 LICENSE로 출처를 명확히 할 수 있다. 이 문서 작성 중 kit 파일은 변경하지 않았다.

### 출처를 확정하지 못한 작은 SVG

`lib/quote-pill.ts:19`의 인용 부호와 `lib/user-attachments.ts:14`의 파일 모양은 SVG 문자열을 직접 포함한다. 도입 커밋은 각각 `59fdc9a`, `c2da510`이며, 두 커밋에는 Grok이 변경을 수행했다는 기록이 있다. 외부 제작자·패키지·다운로드 URL은 소스와 해당 git 기록에 없다. AI가 추가했다는 기록만으로 독자 제작이나 라이선스 적합성을 증명할 수는 없다.

그 밖에 체크·캐럿·원·레이어·외부 열기 등의 간단한 SVG가 `lib/composer-info.ts`, `lib/composer-queue-controls.ts`, `lib/composer-diff-icons.ts`에 있다. 이들의 원본 제작 경로는 확정하지 않았다. 단순 도형이 있다는 사실만으로 특정 라이선스 위반을 판단하지 않는다.

제품 소스에서 외부 폰트 파일·사진·일러스트 패키지·CDN 스타일시트는 찾지 못했다. 사용자 첨부 사진과 provider가 호스트에서 제공하는 로고는 플러그인이 배포하는 정적 에셋과 구분했다. README의 MIT 배지는 `img.shields.io`를 참조하며 제품 UI 번들에 넣는 이미지 파일은 아니다.

## 고지에서 확인한 누락

현재 루트 `LICENSE`에는 `Copyright (c) 2026 HIJKM`과 MIT 원문만 있다. tracked 소스·문서에 Hugeicons·Lucide·Feather의 저작권·허가 원문은 없고 `THIRD_PARTY_NOTICES`도 없다. 아이콘 이름을 적은 코드 주석은 원문 고지를 대신하지 못한다.

따라서 직접 포함한 Hugeicons 무료 도형과 Lucide·Feather 계열 상태 도형은 배포 전에 원본 저작권·라이선스 고지를 갖추도록 보완할 항목이다. MIT·ISC라는 라이선스 선택 자체가 이 프로젝트 MIT와 충돌하는 것으로 보이지는 않는다. 실제 배포물에 별도 고지가 포함되었는지, 각 도형에 적용되는 권리 관계와 보호 범위가 무엇인지는 이번 검사로 확정하지 않았다. 이 문서는 에셋 교체나 고지 파일 추가를 수행하지 않았다.

## 점검 증거와 한계

공식 SVG 원문·경로 비교 결과·공식 저장소 리비전 응답은 이 스레드의 `asset-license-research` 폴더에 저장했다. 경로 비교는 원본의 `path d` 문자열을 대조한 검사이며, 화면 캡처의 픽셀 비교나 법률 검토가 아니다. 현재 ignored `dist/app.js`에는 `bb-chat-ui-status`, `bb-chat-ui-queue` 두 개의 로컬 등록 도형이 있고 `bb-chat-ui-subagent` 등록은 없다. 소스와 번들의 동일 리비전 여부 또는 현재 실행 중인 BB가 로드한 번들까지는 확정하지 않았다.

## npm 라이브러리 점검

`package.json`, `package-lock.json`, 설치된 각 패키지의 `package.json`과 최상위 LICENSE·COPYING·NOTICE 계열 파일을 읽었다. 모든 패키지는 lockfile에서 개발 의존성으로 분류된다. 이 분류가 제품에서 사용하지 않는다는 뜻은 아니다. 실제 소스 import와 기존 번들도 함께 확인했다.

| 직접 의존성 | 설치 버전 | 라이선스 | 실제 역할 |
|---|---|---|---|
| `@get-bb/plugin-sdk` | `0.6.31` | 원본 저장소 MIT. npm 메타데이터에는 누락 | 앱·서버 API. 앱은 공유 런타임, 서버는 external import |
| `react` | `19.3.0` | MIT | 제품 UI에서 사용. 기존 번들은 BB 공유 React 참조 |
| `jsdom` | `30.1.2` | MIT | DOM 테스트 |
| `typescript` | `5.9.3` | Apache-2.0 | 타입 검사·개발 도구 |
| `@types/node` | `22.20.5` | MIT | 타입 선언 |
| `@types/react` | `19.3.0` | MIT | 타입 선언 |

원문: [React MIT](https://github.com/react/react/blob/main/LICENSE), [jsdom MIT](https://github.com/jsdom/jsdom/blob/main/LICENSE.txt), [TypeScript Apache-2.0](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt), [DefinitelyTyped MIT](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/LICENSE). 설치된 패키지 원문도 함께 확인했으며, 표의 버전은 현재 설치본을 기준으로 한다.

### SDK의 미확인 표기는 원본 커밋으로 보완했다

설치된 `@get-bb/plugin-sdk@0.6.31`에는 `license` 필드와 LICENSE 파일이 없다. 이 사실만으로 사용 불가라고 판정하지 않았다. [npm의 해당 버전 메타데이터](https://registry.npmjs.org/%40get-bb%2Fplugin-sdk/0.6.31)에 기록된 `gitHead`는 `ec6c0d202f526fe510da70693f5ef0cff5cee112`이며, [그 커밋의 루트 LICENSE](https://github.com/get-bb/bb/blob/ec6c0d202f526fe510da70693f5ef0cff5cee112/LICENSE)는 Michael Yong의 MIT다. 원문은 Node fetch로 받아 확인했다.

따라서 자동 메타데이터 검사의 UNKNOWN 1개는 SDK 원본의 MIT로 추적할 수 있다. SDK 소스나 선언 파일을 별도로 재배포하는 경우에는 이 원본 고지도 포함해야 한다.

### 전이 의존성

50개 패키지의 메타데이터 분포는 MIT 36개, MIT-0 2개, BSD-2-Clause 2개, BSD-3-Clause 2개, ISC 3개, BlueOak-1.0.0 1개, CC0-1.0 1개, Apache-2.0 2개, SDK 미기재 1개다. SDK는 위 원본 커밋으로 MIT를 확인했다.

메타데이터와 읽은 라이선스 파일에서 GPL·AGPL·비상업용 제한 표기는 찾지 못했다. 이는 각 의존성의 모든 내부 파일과 최초 제작 경로를 검증했다는 뜻은 아니다. `saxes@6.0.0`은 ISC를 선언하지만 패키지 안에 별도 LICENSE 파일이 없다. 현재는 jsdom의 테스트용 의존성이며 기존 제품 번들에서 발견되지 않았다. 향후 `node_modules`까지 묶어서 배포한다면 원본 ISC 고지를 추가로 확보해야 한다.

TypeScript에는 Apache-2.0 LICENSE 외에 `ThirdPartyNoticeText.txt`도 있다. 개발 도구 자체를 재배포한다면 이 파일처럼 패키지가 제공하는 제3자 고지도 유지해야 한다. 현재 플러그인 번들에 TypeScript 구현을 넣는 코드는 발견하지 못했다.

## 배포물 경계

제품 소스에서 외부 모듈을 import하는 경로는 `react`, `@get-bb/plugin-sdk`, `@get-bb/plugin-sdk/app`이다. 그 밖의 비상대 경로 패키지 import는 제품 소스에서 발견하지 못했다. 테스트 파일의 jsdom·Node 내장 모듈은 별도로 분류했다.

- 기존 `dist/app.js`는 `globalThis.__bbPluginRuntime.react`와 `.pluginSdkApp`을 참조한다. React 전체 구현이나 jsdom을 플러그인이 독립 번들로 다시 싣는 구조는 아니다.
- 기존 `dist/server.js`는 `@get-bb/plugin-sdk`를 external import한다. source map에 포함된 원본은 플러그인 파일 4개이며 SDK 구현은 포함하지 않는다.
- 직접 복사한 SVG 경로와 kit 코드도 제품 소스·번들에 들어가는 코드다. npm 의존성 목록만으로 이들의 고지 여부를 판단할 수 없다.
- 기존 산출물은 분석한 HEAD와 동일하다고 확정하지 않았다. 예를 들어 server source map의 설정에는 현재 소스에 없는 항목이 남아 있다. 실제 배포 전에는 HEAD에서 새로 만든 번들에 고지 파일이 함께 포함되는지 다시 확인해야 한다.

## 배포 전에 보완할 항목

1. 직접 포함한 Hugeicons와 Lucide·Feather 계열 도형의 출처·버전·원본 저작권·허가 원문을 제3자 고지 파일에 모은다. 코드 주석과 이 점검 보고서는 원문 고지를 대신하지 않는다.
2. 인용·파일 SVG의 출처를 확인한다. 확인할 수 없다면 출처와 사용 조건이 명확한 도형으로 교체하는 방법을 검토한다.
3. 고지 파일을 저장소뿐 아니라 실제 배포물에도 포함한다. 루트의 자체 MIT 고지는 유지하고 외부 저작권자를 그 명의로 덮어쓰지 않는다.
4. React·SDK·개발 도구의 전체 파일을 함께 배포하는 방식으로 바뀌면 해당 패키지의 고지·NOTICE 포함 여부를 다시 점검한다.

점검 결과와 증거만 추가했다. 이 작업에서 원본 고지 파일을 만들거나 제품 에셋을 교체하지 않았다. 기능 테스트를 통과했다는 사실로 라이선스 적합성을 판정하지 않았으며, 의존성 목록·SVG 경로 대조·라이선스 원문·번들 경계를 근거로 판단했다.
