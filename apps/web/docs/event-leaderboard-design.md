# Event Leaderboard Design Document

## Overview
Add a comprehensive event leaderboard section to the event photo page that displays all timing results for the event. This complements the existing RunnerSpotlight component which shows individual runner data.

## Current State Analysis

### Existing Components
- **RunnerSpotlight**: Displays individual runner's timing data and selfie upload (lines 349-362 in page.tsx)
- **InfinitePhotoGrid**: Shows photos with infinite scroll
- **PhotoSelectionControls**: Bulk download functionality

### Data Flow
1. Individual timing data: `api.results.getTimingByBib.useQuery`
2. Mock data structure:
   - `index.json`: Event metadata with multiple `result_sets` (5K, 10K categories)
   - Each result_set has an `s3_key` pointing to full results data
3. Service layer: `timing-service.ts` with `getBibDetail()` for individual results

## Design Decisions

### 1. UI Layout & Positioning
**Decision**: Place EventLeaderboard section between RunnerSpotlight and Photos
```
┌─────────────────────────┐
│ Header                  │
├─────────────────────────┤
│ RunnerSpotlight         │ ← Existing (individual data)
├─────────────────────────┤
│ EventLeaderboard        │ ← NEW (all results)
├─────────────────────────┤
│ Photo Selection         │
│ InfinitePhotoGrid       │
└─────────────────────────┘
```

**Rationale**:
- Natural information hierarchy: Individual → All Results → Photos
- Maintains focus on personal results first
- Doesn't disrupt existing photo browsing workflow

### 2. Responsive Design
**Desktop (≥768px)**:
- Full data table with sortable columns
- Display all key metrics in columns
- Sticky header for long lists
- Horizontal scroll if needed

**Mobile (<768px)**:
- Card-based layout
- Top 3-5 key metrics per card
- Compact, touch-friendly design
- Matches existing mobile patterns (RunnerSpotlight, PhotoGrid)

### 3. Data Loading Strategy
**Infinite Scroll**:
- Initial load: 50 results
- Load more: 25 results per batch
- Matches InfinitePhotoGrid pattern
- Better performance for large datasets (1000+ runners)

**Why not full load**:
- Large events can have 1000+ participants
- Initial page load would be slow
- Filtering/sorting on large datasets requires backend support

### 4. Features

#### Phase 1 (MVP)
- [x] Display all timing results
- [x] Category tabs (5K, 10K, etc.) if multiple result_sets exist
- [x] Responsive table/card view
- [x] Basic sorting (rank, time, name)
- [x] Infinite scroll pagination

#### Phase 2 (Future)
- [ ] Search by name/bib
- [ ] Filter by division/gender/age
- [ ] Export to CSV
- [ ] Share/bookmark specific results

### 5. Data Schema

#### API Response
```typescript
type EventResultsResponse = {
  resultSets: Array<{
    id: string;
    category: string; // "5K", "10K"
    results: Array<{
      rank: number;
      bib: string;
      name?: string;
      chipTime: string;
      division?: string;
      gender?: string;
      age?: number;
      divisionPlace?: string | number;
      agePerformance?: number;
      // ... other fields from timing dataset
    }>;
  }>;
  meta: {
    eventId: string;
    eventName: string;
    totalResults: number;
    updatedAt: string;
  };
};
```

#### Component Props
```typescript
interface EventLeaderboardProps {
  eventId: string;
  eventName: string;
  highlightBib?: string; // Scroll to and highlight this bib
}
```

## UI Components Structure

```
EventLeaderboard/
├── EventLeaderboard.tsx          # Main container
├── LeaderboardTable.tsx          # Desktop table view
├── LeaderboardCardList.tsx       # Mobile card view
├── LeaderboardFilters.tsx        # Category tabs, future filters
├── LeaderboardSkeleton.tsx       # Loading state
└── LeaderboardEmptyState.tsx     # No results state
```

## Visual Design

### Desktop Table Columns
| Rank | Bib | Name | Chip Time | Division | Div. Place | Gender | Age | Performance |
|------|-----|------|-----------|----------|------------|--------|-----|-------------|

### Mobile Card
```
┌─────────────────────────────┐
│ #1  Bib 123                 │
│ John Doe                    │
│ ────────────────────────────│
│ 🏁 18:24  📊 M 25-29  #3/45│
│ ⚡ 94% Age Performance     │
└─────────────────────────────┘
```

### Color Coding
- Top 3 ranks: Gold (#FFD700), Silver (#C0C0C0), Bronze (#CD7F32) badges
- Current user's bib: Highlighted row (primary/5 background)
- Performance tier: Reuse PerformanceTierBadge component

## Performance Considerations

1. **Virtual Scrolling**: For very large datasets (future optimization)
2. **Memoization**: React.memo for LeaderboardRow/Card components
3. **Debounced Search**: If/when search is added
4. **Optimistic Updates**: Category switching should feel instant

## Accessibility

- Semantic HTML table with proper headers
- ARIA labels for sort buttons
- Keyboard navigation support
- Focus management for infinite scroll
- Screen reader announcements for data updates

## Error Handling

1. **No timing data**: Show empty state with message
2. **Partial data**: Display what's available, warn about missing categories
3. **Load failure**: Retry button with error message
4. **Slow loading**: Show skeleton UI, timeout after 30s

## Analytics Tracking

Track user engagement:
- `leaderboard_view`: When leaderboard is visible
- `leaderboard_category_switch`: Tab changes
- `leaderboard_sort`: Sort column changes
- `leaderboard_runner_click`: Click on specific result

## Migration Path

1. Create new tRPC endpoint: `results.getAllResults`
2. Add timing-service function: `getAllEventResults`
3. Build EventLeaderboard component (responsive)
4. Integrate into page.tsx with feature flag (optional)
5. Test with real data from mock/
6. Deploy and monitor performance

## Open Questions

✅ Should we show all categories at once or use tabs?
→ Use tabs for better organization when multiple categories exist

✅ How to handle events with 1000+ participants?
→ Infinite scroll with 50 initial + 25 per batch

✅ Should we load leaderboard data on initial page load?
→ Yes, load first 50 results immediately

✅ Desktop vs mobile layout cutoff?
→ Standard 768px (md breakpoint), matches existing patterns

## References

- Current page: `src/app/events/[event]/[bib]/page.tsx`
- Timing service: `src/server/services/timing-service.ts`
- Results router: `src/server/api/routers/results.ts`
- Mock data: `src/mock/index.json`, `src/mock/5k.json`
- Similar component: `RunnerSpotlight.tsx` (timing display)
