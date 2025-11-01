# RaceRoster API Pagination Implementation Guide

## ✅ SOLVED: Complete Pagination Support

### Working Pagination Method
RaceRoster v2 API supports pagination using the **`start` parameter**:
```
GET /v2/api/result-events/{eventId}/sub-events/{subEventId}/results?start=0&limit=1000
GET /v2/api/result-events/{eventId}/sub-events/{subEventId}/results?start=1000&limit=1000
```

### Implementation Features
- ✅ **Automatic Pagination**: Fetches all participants regardless of count
- ✅ **Rate Limiting**: 500ms delays between API calls
- ✅ **Error Handling**: Continues processing even if some pages fail
- ✅ **Progress Tracking**: Real-time status updates
- ✅ **Batch Processing**: Efficient participant detail fetching

### Supported Parameters
- ✅ `limit` parameter: Maximum value is 1000
- ✅ `start` parameter: For pagination (0-based index)
- ✅ `filter_search`: Optional search filtering
- ❌ `page` parameter: Not supported (returns 400 error)
- ❌ `offset` parameter: Not supported (returns 400 error)

### Successful Test Results
- **Half Marathon**: 1431 participants (1000 + 431)
- **Half Marathon Relay**: 101 participants
- **5k**: 380 participants
- **Total**: 1912 participants processed successfully

## Usage Examples

### Basic Usage (All Sub-events)
```bash
node src/mock/fetch-raceroster-data.js dutbkx7e2epftx4x ./output --sub-events all
```

### Specific Sub-events
```bash
node src/mock/fetch-raceroster-data.js dutbkx7e2epftx4x ./output --sub-events 245903,245905
```

### Output Structure
```
output/
├── index.json              # Event overview
├── half-marathon.json      # 1431 participants
├── half-marathon-relay.json # 101 participants
└── 5k.json                # 380 participants
```

## Technical Implementation

### Pagination Logic
```javascript
let start = 0;
const limit = 1000;
let hasMore = true;

while (hasMore) {
  const url = `.../results?start=${start}&limit=${limit}`;
  // Fetch and process data
  if (data.data.length < limit) hasMore = false;
  else start += limit;
}
```

### Rate Limiting
- 500ms delay between API calls
- Prevents rate limiting issues
- Ensures stable processing

This implementation provides a robust solution for handling RaceRoster events of any size.

### Supported Limit Values
```bash
# Valid limit values only
?limit=50
?limit=100
?limit=250
?limit=500
?limit=1000  # Maximum allowed
```

## Current Workaround

### What We Do Now
1. **Fetch up to 1000 participants** per sub-event
2. **Warning when exactly 1000 participants** are retrieved
3. **Process all available data** (up to the 1000 limit)

### Implementation Details
```javascript
// In fetchSubEventLeaderboard function
const participantCount = data.data?.length || 0;

if (participantCount === 1000) {
  console.log(`⚠️ Retrieved exactly 1000 participants. There may be more data.`);
  console.log(`💡 Consider reaching out to RaceRoster support for pagination options.`);
}
```

## Potential Solutions for Large Events

### 1. Contact RaceRoster Support
- Request access to pagination parameters
- Ask about bulk data export options
- Inquire about premium API tiers with higher limits

### 2. Use Search Filters (If Available)
```javascript
// Example: Filter by name ranges
const nameRanges = ['A-F', 'G-M', 'N-S', 'T-Z'];

for (const range of nameRanges) {
  const url = `.../results?filter_search=${range}&limit=1000`;
  // Process each range separately
}
```

### 3. Time-based Filtering
```javascript
// Filter by finish time ranges (if API supports it)
const timeRanges = [
  { start: '00:00:00', end: '01:30:00' },
  { start: '01:30:01', end: '03:00:00' },
  // ... more ranges
];
```

### 4. Alternative API Endpoints
- Check if RaceRoster offers different endpoints for bulk data
- Look for CSV export capabilities
- Investigate webhook options for real-time data

## Recommended Actions

### For Small Events (<1000 participants)
✅ **Current solution works perfectly**
- All participants are retrieved
- Complete data processing

### For Large Events (>1000 participants)
⚠️ **Current limitations apply**
- Only first 1000 participants are retrieved
- Data may be incomplete

### Immediate Steps
1. **Document the limitation** clearly for users
2. **Add participant count warnings** in the output
3. **Monitor for official API updates** from RaceRoster
4. **Consider hybrid approaches** for critical applications

## Code Improvements Made

### Enhanced Logging
```javascript
console.log(`⚠️ Retrieved exactly 1000 participants for ${subEventName}.`);
console.log(`💡 There may be more data, but this API has a 1000 participant limit.`);
```

### Graceful Handling
- Process continues even with partial data
- Clear warnings inform users of limitations
- Error handling for API edge cases

## Future Enhancements

### Monitoring for API Changes
```javascript
// Could be added to track when API supports pagination
const checkPaginationSupport = async () => {
  // Test for new pagination parameters periodically
  // Update implementation when available
};
```

### Configurable Limits
```javascript
// Allow users to set custom limits (within API constraints)
const config = {
  maxParticipants: 1000,  // Could be made configurable
  batchSize: 10,         // For detail fetching
  apiDelay: 200          // Rate limiting
};
```

## Conclusion

While the current implementation handles most use cases effectively, the 1000 participant limitation is a known constraint of the RaceRoster v2 API. The best approach is to:

1. **Use the current solution** for events under 1000 participants
2. **Contact RaceRoster** for events requiring more participants
3. **Monitor API updates** for future pagination support
4. **Consider alternative data sources** for critical applications

This ensures transparency about limitations while providing the best possible solution within current API constraints.