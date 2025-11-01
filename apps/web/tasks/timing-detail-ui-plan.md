# 화면 설계 — 비브 사진 페이지 타이밍 정보 노출

## 목표
- `/events/[event]/[bib]` 페이지 상단에 선수 타이밍 요약을 노출해 사진 탐색 전 필요한 정보를 전달한다.
- 기존 셀피 업로드 카드의 집중도를 유지하면서 자연스럽게 타이밍 데이터 흐름을 이어준다.
- 반응형 환경에서 레이아웃이 무너지지 않고 현대적인 시각 밸런스를 유지한다.

## 현재 배치 요약
- 헤더 아래에 `검색 + 셀피 업로드` 섹션이 중앙 정렬된 박스로 배치되어 있으며, 해당 박스는 최대 폭 360px 수준의 카드 레이아웃.
- 셀피 업로드 카드 상단에 타이밍 정보 블록을 단순히 얹으면 카드 크기가 커져 시각적 비례가 깨지고, 주요 CTA(셀피 업로드)의 가독성이 떨어질 수 있음.

## 제안 레이아웃
1. **Two-Column Spotlight (Desktop) / Stacked (Mobile)**
   - 상단에 `Runner Spotlight` 영역을 추가하고, 내부를 좌우 2컬럼 그리드로 구성.
   - **좌측**: 타이밍 요약 카드(대회/bib/이름/기본 메트릭).
   - **우측**: 셀피 업로드 카드. 폭이 좁은 모바일에서는 위-아래로 스택.
   - 배경을 살짝 톤다운(`bg-muted/40`), 각 카드에는 라운드 + 그림자(`shadow-sm`).
   - 타이밍 카드 구조 예:
     ```tsx
     <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
       <TimingCard />
       <SelfieUploadCard />
     </section>
     ```

2. **TimingCard 구성**
   - 헤더: 기본 정보 (이벤트명, bib, 참가자 이름, 도시/나이 등) → flex column
   - 본문: 핵심 지표를 2열 grid로 배치 (`Chip Time`, `Clock Time`, `Pace`, `Division Place` 등 문서 요구 필드).
   - 하단: `전체 결과 보기` 버튼 또는 `result_url` 존재 시 링크 제공.
   - 예시 구조:
     ```tsx
     <article className="rounded-xl border bg-background/80 p-4 shadow-sm">
       <header className="flex flex-col gap-1">
         <span className="text-xs uppercase text-muted-foreground">Bib #{bib}</span>
         <h2 className="text-lg font-semibold">{name}</h2>
         <p className="text-sm text-muted-foreground">{gender} • {age} • {city}, {state}</p>
       </header>
       <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
         <Metric label="Chip Time" value={chip_time ?? "-"} emphasize />
         <Metric label="Clock Time" value={clock_time ?? "-"} />
         <Metric label="Avg Pace" value={avg_pace ?? "-"} />
         <Metric label="Division Place" value={division_place ?? "-"} />
         <Metric label="Overall Place" value={race_placement ?? "-"} />
       </dl>
       {result_url ? (
         <Button asChild variant="ghost" size="sm" className="mt-4 self-start">
           <a href={result_url} target="_blank" rel="noreferrer">공식 결과 보기</a>
         </Button>
       ) : null}
     </article>
     ```

3. **SelfieUploadCard 정리**
   - 현재 중앙 정렬된 카드 레이아웃을 그대로 유지하되, 부모 컨테이너에서 `max-w-md`를 제거하고 그리드 컬럼 폭 제약으로 넓이를 제어.
   - 카드 상단 설명 텍스트를 `flex-start` 정렬로 변경해 `TimingCard`와 시각적 일관성 확보.
   - 업로드 CTA는 그대로 가운데 배치 유지.

4. **데이터 상태 처리**
   - `TimingDetail` 없을 경우 셀피 카드만 전체 폭으로 노출.
   - 로딩 상태는 스켈레톤 블럭(2열 매트릭)+헤더 플레이스홀더로 렌더.
   - 다중 결과셋일 경우 상단에 탭 또는 선택 드롭다운을 배치해 사용자가 카테고리를 전환하도록 한다.
     - 예: 작은 pill 버튼 목록 (`10K Overall`, `10K Division` 등) → 선택 시 해당 타이밍 상세를 업데이트.

5. **스타일 노트**
   - 색상: `bg-muted` 톤을 활용해 주변과 대비를 주되, `TimingCard`는 `bg-background/90`로 가독성 확보.
   - 아이콘: lucide `Timer`, `Flag`, `MapPin` 등 적절히 활용해 메트릭 인지성을 높인다.
   - 반응형: `md` 이상에서만 2컬럼, 그 이하에서는 카드들이 위아래로 스택되며 `gap-4` 유지.

6. **컴포넌트 구조 제안**
   - `TimingHighlights` 컨테이너: 결과 데이터, 셀피 카드 렌더링 여부, 선택된 결과셋 상태 관리.
   - 내부 세부 컴포넌트 분리:
     - `TimingSummaryCard`
     - `TimingMetric` (label/value 렌더링 전용)
     - `TimingCategoryTabs`
   - 셀피 카드 기존 구조는 `SelfieUploadCard`로 추출하여 재사용성 강화.

7. **과정 요약**
   1. `api.results.getTimingByBib` 호출 후 첫 번째 결과 또는 선택된 결과를 `TimingSummaryCard`에 주입.
   2. 상단 레이아웃을 그리드화해 타이밍과 셀피 기능을 나란히 배치.
   3. 모바일에서는 동일 카드를 세로 배치로 전환.
   4. 다중 결과셋 대비를 위해 탭/세그먼트를 제공(후속 구현 범위에 따라 optional).

## 기대 효과
- 타이밍 데이터를 사진 탐색 이전에 노출해 사용자가 현재 페이지가 자신의 결과인지 즉시 확인 가능.
- 셀피 업로드 CTA가 여전히 시선의 중심을 유지하면서도 정보 밀도가 적절히 분배되어 현대적인 느낌.
- 다양한 디바이스에서 일관된 경험 제공.

## 후속 작업
- `TimingHighlights` 컴포넌트 설계 및 스토리 작성.
- 다중 결과셋일 때 UX 시나리오 구체화 (카테고리 탭, fallback 문구).
- 실제 S3/타이밍 데이터와의 상호작용 테스트.
