/**
 * Race category sorting utilities
 * 카테고리를 Marathon → Half → 5K → Relay → Virtual 순으로 정렬
 */

/**
 * 카테고리 라벨에서 정렬 우선순위를 계산합니다.
 * 낮은 숫자가 먼저 표시됩니다.
 *
 * 정렬 순서:
 * 1. Marathon (개인)
 * 2. Half Marathon (개인)
 * 3. 10K (개인)
 * 4. 5K (개인)
 * 5. Marathon Relay
 * 6. Half Marathon Relay
 * 7. Other Relay
 * 8. Virtual Marathon
 * 9. Virtual Half Marathon
 * 10. Virtual 5K/10K
 * 11. Others
 */
export function getCategorySortOrder(label: string | null): number {
  if (!label) return 999;
  const lower = label.toLowerCase();

  // Virtual은 뒤로
  const isVirtual = lower.includes("virtual");
  const virtualPenalty = isVirtual ? 100 : 0;

  // Relay는 개인 종목 뒤로
  const isRelay = lower.includes("relay");
  const relayPenalty = isRelay ? 50 : 0;

  // 거리 기준 우선순위
  let distancePriority = 40; // 기본값 (알 수 없는 거리)

  if (lower.includes("marathon") && !lower.includes("half")) {
    distancePriority = 1; // Marathon 먼저
  } else if (lower.includes("half")) {
    distancePriority = 2; // Half Marathon
  } else if (lower.includes("10k") || lower.includes("10 k")) {
    distancePriority = 3; // 10K
  } else if (lower.includes("5k") || lower.includes("5 k")) {
    distancePriority = 4; // 5K
  } else if (lower.includes("1k") || lower.includes("1 k")) {
    distancePriority = 5; // 1K (Kids run 등)
  }

  // Relay 내에서도 거리순 정렬을 위해 추가 조정
  // 4 Person > 2 Person 순서로 (팀 규모가 큰 것 먼저)
  let teamSizePriority = 0;
  if (isRelay) {
    if (lower.includes("4 person") || lower.includes("4-person")) {
      teamSizePriority = 0;
    } else if (lower.includes("2 person") || lower.includes("2-person")) {
      teamSizePriority = 1;
    } else {
      teamSizePriority = 2;
    }
  }

  return distancePriority + relayPenalty + virtualPenalty + teamSizePriority;
}

/**
 * 카테고리 배열을 정렬합니다.
 */
export function sortCategories<T extends { label: string | null }>(
  categories: T[]
): T[] {
  return [...categories].sort(
    (a, b) => getCategorySortOrder(a.label) - getCategorySortOrder(b.label)
  );
}

