# Supabase 설정 (부부 가계부 — 직접 진행 필요)

코드는 모두 적용되었습니다. 아래 단계를 직접 해주시면 실제 DB에 저장되고 로그인이 동작합니다.

## 1단계: 테이블 생성 (SQL 실행)

1. https://supabase.com/dashboard 접속 → 프로젝트 **jvtwxjkfntxnuepkfcuq** 선택
2. 좌측 **SQL Editor** → **New query**
3. 저장소의 `supabase/migrations/0006_household_ledger.sql` 내용을 **전부 붙여넣고 Run**

이 스크립트가 하는 일:
- `transactions`(수입·지출), `fixed_expenses`(고정지출), `expense_categories`(지출 카테고리) 생성
- 로그인 사용자만 접근 가능한 RLS 정책 + 기본 지출 카테고리 시드
- 기존 `sales_records`(미용실 매출)를 `transactions`(수입/매출/아내)로 **자동 이관**

> **월 예산 기능**을 쓰려면 `supabase/migrations/0007_budgets.sql` 도 이어서 실행하세요.
> 안 해도 앱은 정상 동작하고, 예산 게이지만 안 보입니다.
>
> **공금 충전(공금 통장) 기능**을 쓰려면 `supabase/migrations/0008_joint_fund_transfer.sql` 도 실행하세요.
> 안 하면 공금 충전 저장 시 오류가 납니다(지출·수입은 정상).

## 2단계: 계정 2개 만들기 + 역할 지정

부부 각자의 계정을 만듭니다. 가입 화면은 없으니 대시보드에서 직접 생성합니다.

1. 대시보드 → **Authentication → Users → Add user** 로 계정 2개 생성
   - 아이디만 쓰고 싶으면 이메일을 `wife@home.local`, `husband@home.local` 처럼 만들면
     로그인 화면에서 `wife` / `husband` 만 입력해도 됩니다. (앱이 `@home.local` 을 붙여줌)
2. **역할 지정** (둘 중 하나)
   - **(권장) User metadata**: 각 사용자 편집 → **User Metadata (raw)** 에
     `{ "role": "wife" }` / `{ "role": "husband" }` 저장
   - **또는 코드 매핑**: `src/lib/members.js` 의 `EMAIL_ROLE` 에 이메일→역할을 적기
     ```js
     const EMAIL_ROLE = {
       'wife@home.local': 'wife',
       'husband@home.local': 'husband',
     };
     ```

> 역할을 지정하지 않으면 기본값 `wife` 로 처리됩니다(입력 시 자동선택만 영향, 데이터는 공유).

## 3단계: API 키를 .env.local 에 입력

이미 설정돼 있다면 건너뛰세요. 없으면:

1. 대시보드 → **Settings → API**
2. **Publishable key**(`sb_publishable_...`) 또는 **anon public** 값을 복사
3. 루트 `.env.local`:

```
VITE_SUPABASE_URL=https://jvtwxjkfntxnuepkfcuq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<복사한 키>
```

## 4단계: 실행 및 확인

```
npm run dev
```

- 만든 계정으로 로그인 → 홈에 **현재 잔액**이 보입니다.
- `＋` 로 지출/수입을 넣으면 잔액이 즉시 바뀌고, 새로고침해도 유지됩니다.
- 테이블이 아직 없으면 앱이 "데이터베이스 설정이 필요해요" 안내를 띄웁니다(1단계 실행 필요).

> AI 챗봇 등 이전 기능(`ai_chat`, Edge Function)은 이번 1차 범위에서 제외되어 화면에 없습니다.
> 관련 테이블/함수는 지워도 되고 남겨둬도 앱에 영향 없습니다.
