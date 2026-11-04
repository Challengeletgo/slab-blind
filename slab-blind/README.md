# 슬랩 블라인드

라벨 등급을 가린 그레이딩 슬랩(PSA · CGC · BRG)을 보고 등급을 맞히는 게임입니다.
한 번 틀리면 끝, 맞힐수록 어려워지고, 실시간 랭킹과 카드 제보 기능이 있습니다.

- 게임: `index.html`
- 운영자 검토: `admin.html` (제보 카드 승인·반려)
- 서버: Supabase (랭킹, 제보 카드, 사진 저장, 자동 인식)

`config.js`가 비어 있으면 기본 카드 10장으로 게임만 동작합니다. 아래 순서대로 Supabase를 연결하면 랭킹과 카드 올리기가 켜집니다.

---

## 1. GitHub Pages 켜기 (게임 공개)

1. 이 저장소의 **Settings → Pages** 로 갑니다.
2. **Source**: `Deploy from a branch`, **Branch**: `main` / `/ (root)` → Save.
3. 1~2분 뒤 `https://<아이디>.github.io/<저장소이름>/` 주소가 생깁니다. 이게 인스타에 올릴 링크예요.

## 2. Supabase 프로젝트 만들기

1. https://supabase.com 에 가입하고 **New project** 를 만듭니다. (지역은 Northeast Asia (Seoul) 추천)
2. 프로젝트가 준비되면 **SQL Editor → New query** 에 `supabase/schema.sql` 내용을 전부 붙여 넣습니다.
3. 맨 아래 `YOUR_EMAIL@example.com` 을 **운영자 이메일**로 바꾸고 **Run**.

## 3. 운영자 계정 만들기

1. **Authentication → Users → Add user → Create new user**
2. 2단계에서 넣은 이메일과 비밀번호를 입력하고, **Auto Confirm User** 를 켠 채로 만듭니다.
3. 이 계정으로 `admin.html` 에 로그인해서 제보 카드를 승인합니다.

## 4. config.js 채우기

1. **Project Settings → API** 에서 `Project URL` 과 `anon public` 키를 복사합니다.
2. `config.js` 에 붙여 넣고 커밋·푸시합니다.
   - `anon` 키는 공개돼도 되는 키입니다. **`service_role` 키는 절대 넣지 마세요.**

여기까지 하면 랭킹과 카드 올리기(수동 입력)가 동작합니다.

## 5. 사진 자동 인식 켜기 (선택)

자동 인식은 Claude API를 쓰고, 사용량만큼 요금이 나옵니다.

1. https://console.anthropic.com 에서 API 키를 발급합니다.
2. Supabase **Edge Functions → Secrets** 에 `ANTHROPIC_API_KEY` 로 저장합니다.
3. **Edge Functions → Deploy a new function → Via Editor**, 이름은 `recognize`.
   `supabase/functions/recognize/index.ts` 내용을 붙여 넣고 Deploy.

키는 서버(Supabase)에만 있고 웹페이지에는 들어가지 않습니다.
같은 IP에서 시간당 20회까지만 인식하도록 막아 두었습니다. (`PER_IP_PER_HOUR`)

---

## 알아둘 점

- **랭킹 점수**는 플레이어 브라우저에서 계산됩니다. 서버에서 불가능한 점수(문제당 65점 초과)는 거절하지만, 작정하고 조작하는 것까지 막지는 못합니다. 상품을 거는 이벤트라면 별도 검증이 필요합니다.
- 플레이어 이름은 브라우저마다 만들어지는 **사용자-코드**입니다. 브라우저 데이터를 지우면 새 코드가 생깁니다.
- 제보 카드는 운영자가 승인해야 문제로 나옵니다. 인증번호·바코드·QR 모자이크는 업로드 전에 브라우저에서 처리됩니다.
- 이상한 카드를 내리려면 `admin.html → 문제 풀 → 문제에서 내리기`.

## 파일 구조

```
index.html        게임 화면
admin.html        운영자 검토
app.js            게임 로직
style.css         디자인
config.js         Supabase 연결 정보 (직접 채우기)
og.jpg            링크 미리보기 이미지
seed/             기본 카드 10장 (앞면 f, 뒷면 b, 인증번호·QR 모자이크 처리됨)
supabase/schema.sql                    DB·저장소·권한 설정
supabase/functions/recognize/index.ts  자동 인식 서버
```
