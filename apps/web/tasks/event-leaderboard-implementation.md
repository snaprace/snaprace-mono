# Event Leaderboard Implementation Task

## Goal
Implement a comprehensive event leaderboard that displays all timing results for an event, complementing the existing individual RunnerSpotlight component.

## Context
- **Related Design Doc**: `docs/event-leaderboard-design.md`
- **Current Page**: `src/app/events/[event]/[bib]/page.tsx`
- **Affected Files**:
  - `src/server/services/timing-service.ts`
  - `src/server/api/routers/results.ts`
  - `src/app/events/[event]/[bib]/_components/EventLeaderboard.tsx` (new)
  - `src/app/events/[event]/[bib]/page.tsx`

## Implementation Steps

### 1. Backend - Service Layer
**File**: `src/server/services/timing-service.ts`

Add function to fetch all results for an event:

```typescript
export type EventResultsResponse = {
  resultSets: Array<{
    id: string;
    category: string;
    results: Array<{
      rank: number;
      bib: string;
      name?: string;
      chipTime: string;
      clockTime?: string;
      division?: string;
      gender?: string;
      age?: number;
      divisionPlace?: string | number;
      racePlacement?: string | number;
      agePerformance?: number;
      avgPace?: string;
      city?: string;
      state?: string;
    }>;
    totalResults: number;
  }>;
  meta: {
    eventId: string;
    totalResults: number;
  };
};

export async function getAllEventResults(options: {
  ddb: Pick<DynamoDBDocumentClient, "send">;
  tableName: string;
  eventId: string;
  loadDataset: LoadDatasetFn;
  limit?: number;
  offset?: number;
}): Promise<EventResultsResponse>
```

**Implementation Logic**:
1. Query DynamoDB for event metadata (or use getJsonFromS3 for index.json)
2. Load all result_sets from event metadata
3. For each result_set, load the full dataset from S3
4. Parse and format results
5. Apply limit/offset for pagination
6. Return structured response

### 2. Backend - tRPC Router
**File**: `src/server/api/routers/results.ts`

Add new endpoint:

```typescript
getAllResults: publicProcedure
  .input(
    z.object({
      eventId: z.string().min(1),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      category: z.string().optional(), // Filter by category
    })
  )
  .query(async ({ input }) => {
    const { eventId, limit, offset, category } = input;

    const results = await getAllEventResults({
      ddb,
      tableName: DYNAMO_TIMING_RESULTS_TABLE,
      eventId,
      loadDataset: (key) => getJsonFromS3(key),
      limit,
      offset,
    });

    // Filter by category if specified
    if (category) {
      results.resultSets = results.resultSets.filter(
        rs => rs.id === category || rs.category === category
      );
    }

    return results;
  })
```

### 3. Frontend - Component Structure

#### 3a. Main Container Component
**File**: `src/app/events/[event]/[bib]/_components/EventLeaderboard.tsx`

```typescript
interface EventLeaderboardProps {
  eventId: string;
  eventName: string;
  highlightBib?: string;
}

export function EventLeaderboard({
  eventId,
  eventName,
  highlightBib,
}: EventLeaderboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const resultsQuery = api.results.getAllResults.useQuery({
    eventId,
    limit,
    offset,
    category: selectedCategory ?? undefined,
  });

  // Implement component logic
}
```

**Features**:
- Category tabs if multiple result_sets
- Responsive table/card view switching
- Infinite scroll integration
- Loading and error states
- Highlight current user's bib

#### 3b. Desktop Table View
**File**: `src/app/events/[event]/[bib]/_components/LeaderboardTable.tsx`

```typescript
interface LeaderboardTableProps {
  results: EventResultsResponse['resultSets'][0]['results'];
  highlightBib?: string;
}

export function LeaderboardTable({
  results,
  highlightBib,
}: LeaderboardTableProps) {
  // Sortable table implementation
  // Sticky header
  // Highlight row logic
}
```

#### 3c. Mobile Card View
**File**: `src/app/events/[event]/[bib]/_components/LeaderboardCardList.tsx`

```typescript
interface LeaderboardCardListProps {
  results: EventResultsResponse['resultSets'][0]['results'];
  highlightBib?: string;
}

export function LeaderboardCardList({
  results,
  highlightBib,
}: LeaderboardCardListProps) {
  // Card-based layout
  // Compact mobile design
}
```

#### 3d. Loading Skeleton
**File**: `src/app/events/[event]/[bib]/_components/EventLeaderboardSkeleton.tsx`

```typescript
export function EventLeaderboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Category tabs skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-20" />
      </div>

      {/* Table/Cards skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
```

### 4. Integration
**File**: `src/app/events/[event]/[bib]/page.tsx`

Add EventLeaderboard between RunnerSpotlight and photo grid:

```tsx
// After RunnerSpotlight (line 362)
<RunnerSpotlight {...props} />

{/* NEW: Event Leaderboard */}
{!isAllPhotos && (
  <EventLeaderboard
    eventId={event}
    eventName={eventQuery.data?.event_name || ''}
    highlightBib={bibNumber}
  />
)}

{/* Existing photo selection controls */}
{!isMobile && photos.length > 0 && !isAllPhotos && (
  ...
)}
```

### 5. Testing Plan

#### Unit Tests
- [ ] `timing-service.getAllEventResults` with mock data
- [ ] Proper parsing of result_sets
- [ ] Pagination logic (limit/offset)
- [ ] Category filtering

#### Integration Tests
- [ ] tRPC endpoint returns correct data
- [ ] Error handling for missing data
- [ ] Performance with large datasets (1000+ results)

#### UI Tests
- [ ] Responsive layout switches correctly
- [ ] Category tabs work
- [ ] Infinite scroll loads more data
- [ ] Highlight current bib
- [ ] Loading and error states render

#### Manual Testing Checklist
- [ ] Desktop: Table view displays all columns correctly
- [ ] Mobile: Card view is readable and scrollable
- [ ] Category switching is instant
- [ ] Scroll to highlighted bib on load
- [ ] Performance tier badges display correctly
- [ ] Empty state shows when no data
- [ ] Error state with retry button works
- [ ] Infinite scroll triggers at correct position

## Data Flow

```
User visits /events/[event]/[bib]
        ↓
page.tsx renders
        ↓
EventLeaderboard.useQuery({ eventId, limit: 50, offset: 0 })
        ↓
results.getAllResults tRPC endpoint
        ↓
getAllEventResults service function
        ↓
1. Fetch event metadata (result_sets)
2. Load datasets from S3 (5k.json, 10k.json)
3. Parse and format data
4. Apply pagination
        ↓
Return EventResultsResponse
        ↓
Component renders table/cards
        ↓
User scrolls → Load more (offset += 25)
```

## Potential Issues & Solutions

### Issue 1: Large Dataset Performance
**Problem**: Loading 1000+ results at once is slow
**Solution**:
- Implement pagination with limit=50, load more on scroll
- Use React.memo for row/card components
- Consider virtual scrolling for future optimization

### Issue 2: S3 Data Loading
**Problem**: Multiple S3 calls for different categories
**Solution**:
- Cache loaded datasets in service layer
- Load all categories in parallel with Promise.all
- Consider server-side caching with TTL

### Issue 3: Mobile Layout Shift
**Problem**: Switching between table and cards causes layout shift
**Solution**:
- Use CSS @media queries for responsive switching
- Reserve space with skeleton during load
- Smooth transitions with CSS

### Issue 4: Stale Data
**Problem**: Results may update during event
**Solution**:
- Set reasonable staleTime (5 minutes)
- Add manual refresh button
- Show last updated timestamp

## Success Criteria

- [ ] All timing results display correctly for events with mock data
- [ ] Responsive design works on mobile and desktop
- [ ] Category tabs switch instantly
- [ ] Infinite scroll loads additional results
- [ ] Current user's bib is highlighted
- [ ] Performance tier badges integrate seamlessly
- [ ] Loading and error states are user-friendly
- [ ] No performance regression on page load
- [ ] Code is well-documented and maintainable

## Timeline Estimate
- Backend (service + tRPC): 2-3 hours
- Frontend components: 4-5 hours
- Integration & testing: 2-3 hours
- **Total**: 8-11 hours

## Dependencies
- ✅ Existing timing-service.ts and results.ts
- ✅ Mock data structure (index.json, 5k.json)
- ✅ UI components (Skeleton, Badge, etc.)
- ✅ PerformanceTierBadge component
- ✅ tRPC setup and React Query

## Future Enhancements
- [ ] Search by name/bib
- [ ] Filter by division, gender, age
- [ ] Sort by different columns
- [ ] Export results to CSV
- [ ] Share link to specific result
- [ ] Real-time updates during live events
- [ ] Virtual scrolling for 10k+ results
