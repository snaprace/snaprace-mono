# 서브도메인 기반 로컬 개발 환경 구성 가이드

이 가이드는 로컬 개발 환경에서 서브도메인 기반 조직 커스터마이징을 테스트하는 방법을 설명합니다.

## 설정 방법

### 1. 환경 변수 설정

예제 환경 파일을 복사하고 설정합니다:

```bash
cp .env.local.example .env.local
```

`.env.local` 파일을 편집하고 AWS 자격증명과 테스트할 조직 서브도메인을 설정합니다:

```env
# 테스트할 조직 서브도메인 설정
NEXT_PUBLIC_DEV_SUBDOMAIN=millenniumrunning
```

### 2. 다양한 조직 테스트 방법

로컬에서 서로 다른 조직 서브도메인을 테스트하는 세 가지 방법이 있습니다:

#### 방법 1: 환경 변수 (권장)

`.env.local` 파일에 `NEXT_PUBLIC_DEV_SUBDOMAIN`을 설정합니다:

```env
NEXT_PUBLIC_DEV_SUBDOMAIN=millenniumrunning
```

그런 다음 개발 서버를 재시작합니다:

```bash
pnpm dev
```

#### 방법 2: URL 쿼리 파라미터

쿼리 파라미터를 사용하여 서브도메인을 오버라이드할 수 있습니다:

```
http://localhost:3000/?org=millenniumrunning
```

이 방법은 서버를 재시작하지 않고 빠르게 다른 조직을 테스트할 때 유용합니다.

#### 방법 3: Hosts 파일 수정 (고급)

가장 실제적인 테스트를 위해 hosts 파일을 수정하여 실제 서브도메인을 시뮬레이션할 수 있습니다:

1. hosts 파일을 편집합니다:
   - Mac/Linux: `/etc/hosts`
   - Windows: `C:\Windows\System32\drivers\etc\hosts`

2. 테스트 서브도메인 항목을 추가합니다:

   ```
   127.0.0.1 millenniumrunning.localhost
   127.0.0.1 anotherorg.localhost
   ```

3. 다음과 같이 애플리케이션에 접근합니다:
   ```
   http://millenniumrunning.localhost:3000
   ```

## 조직 데이터 구조

조직 정보는 DynamoDB에 다음과 같은 구조로 저장됩니다:

```json
{
  "organization_id": "org_millenniumrunning",
  "name": "Millennium Running",
  "subdomain": "millenniumrunning",
  "logo_url": "/images/partners/partner-millenniumrunning.png",
  "primary_color": "#111B11",
  "secondary_color": "#FFFFFF",
  "custom_settings": {
    "show_partner_section": true,
    "welcome_message": "Welcome to Millennium Running's Photo Gallery",
    "partners": [
      {
        "id": "partner_1",
        "name": "Autofair",
        "logo_url": "/images/partners/partner-autofair.png",
        "website_url": "https://autofair.com",
        "display_order": 1
      }
    ]
  },
  "contact_email": "contact@millenniumrunning.com",
  "website_url": "https://millenniumrunning.com",
  "social_links": {
    "facebook": "https://www.facebook.com/MillenniumRunning",
    "instagram": "https://instagram.com/millenniumrunning",
    "twitter": "https://twitter.com/MillenniumRunning",
    "linkedin": "https://linkedin.com/company/millenniumrunning",
    "youtube": "https://youtube.com/@millenniumrunning"
  }
}
```

## 이벤트 필터링

서브도메인이 감지되면 이벤트가 조직별로 자동 필터링됩니다:

1. **이벤트 테이블 구조**: 이벤트는 `organization_id` 필드를 가져야 합니다
2. **자동 필터링**: 서브도메인을 통해 접근할 때 해당 조직의 이벤트만 표시됩니다
3. **API 지원**: 이벤트 API는 `organizationId` 파라미터를 통한 조직 필터링을 지원합니다

## DynamoDB 테스트 데이터 생성

### AWS CLI 사용

1. 조직 테이블 생성 (이미 생성되지 않은 경우):

```bash
aws dynamodb create-table \
  --table-name snaprace-organizations \
  --attribute-definitions \
    AttributeName=organization_id,AttributeType=S \
    AttributeName=subdomain,AttributeType=S \
  --key-schema \
    AttributeName=organization_id,KeyType=HASH \
  --global-secondary-indexes \
    IndexName=subdomain-index,Keys=[{AttributeName=subdomain,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5
```

2. 테스트 조직 데이터 삽입:

```bash
aws dynamodb put-item \
  --table-name snaprace-organizations \
  --item file://test-data/millennium-organization.json
```

### AWS 콘솔 사용

1. AWS 콘솔에서 DynamoDB로 이동합니다
2. `snaprace-organizations` 테이블을 찾습니다
3. "Create item" 버튼을 클릭합니다
4. JSON 뷰로 전환하고 조직 데이터를 붙여넣습니다
5. "Create item" 버튼을 클릭합니다

## 테스트 체크리스트

서브도메인 커스터마이징을 테스트할 때 다음 항목들을 확인하세요:

- [ ] **헤더 커스터마이징**
  - 로고가 올바르게 표시됨 (제공된 경우)
  - 조직명이 헤더에 표시됨 (로고가 없는 경우)
  - 기본 색상이 헤더 배경에 적용됨
  - 내비게이션 링크가 적절한 텍스트 색상 사용

- [ ] **홈페이지 커스터마이징**
  - 히어로 제목에 조직명 표시
  - 맞춤형 환영 메시지 표시
  - 설정에 따른 파트너 섹션 표시 여부
  - 푸터에 소셜 미디어 링크 표시

- [ ] **이벤트 필터링**
  - 조직별 이벤트 필터링
  - 드롭다운에 해당 조직의 이벤트만 표시

- [ ] **브랜딩**
  - 기본 색상이 일관되게 적용됨
  - 보조 색상이 적절히 사용됨
  - 조직 연락처 정보 표시

## 문제 해결

### 조직 정보가 로드되지 않는 경우

1. 서브도메인이 올바르게 설정되었는지 확인:
   - 환경 변수 방법의 경우 `.env.local` 확인
   - 쿼리 방법의 경우 URL 쿼리 파라미터 확인
   - hosts 방법의 경우 hosts 파일 확인

2. DynamoDB 연결 확인:
   - `.env.local`에서 AWS 자격증명 확인
   - 테이블이 존재하고 올바른 권한이 있는지 확인
   - 테이블에 GSI `subdomain-index`가 존재하는지 확인

3. 미들웨어 실행 확인:
   - 브라우저 DevTools에서 `x-organization` 헤더 확인
   - 미들웨어 에러에 대한 콘솔 로그 확인

### 스타일링이 적용되지 않는 경우

1. 조직 데이터에 색상 값이 있는지 확인
2. 브라우저 DevTools에서 CSS 변수가 설정되고 있는지 확인
3. 색상 파싱과 관련된 콘솔 에러 확인

### 개발 서버 이슈

변경사항이 반영되지 않는 경우:

1. Next.js 캐시 정리:

   ```bash
   rm -rf .next
   pnpm dev
   ```

2. 환경 변수 변경 후 개발 서버 재시작

3. 브라우저 강제 새로고침 (Mac: Cmd+Shift+R, Windows/Linux: Ctrl+Shift+R)

## 프로덕션 배포

프로덕션 배포를 위해:

1. 호스팅 제공업체(Vercel, AWS 등)에서 서브도메인 라우팅 설정
2. 각 조직 서브도메인에 대한 DNS 레코드 구성
3. 프로덕션에서 DynamoDB 테이블 생성 확인
4. 프로덕션 환경 변수 설정
5. 서비스 시작 전 서브도메인 라우팅 테스트

## 추가 자료

- [Next.js 미들웨어 문서](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [AWS DynamoDB 문서](https://docs.aws.amazon.com/dynamodb/)
- [tRPC 문서](https://trpc.io/docs)
