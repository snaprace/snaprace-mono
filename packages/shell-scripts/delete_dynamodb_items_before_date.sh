#!/bin/bash
# 사용법: ./delete_dynamodb_items_before_date.sh <orgId> <eventId> <before_date>
# before_date는 ISO 형식 (예: 2025-11-25T00:00:00.000Z)

if [ $# -ne 3 ]; then
  echo "Usage: $0 <orgId> <eventId> <before_date>"
  echo "Example: $0 winningeventsgroup run-for-liberty-5k-2025 2025-11-25T00:00:00.000Z"
  echo ""
  echo "This will delete all items created BEFORE the specified date."
  exit 1
fi

ORG_ID=$1
EVENT_ID=$2
BEFORE_DATE=$3

TABLE_NAME="PhotoService"
REGION="us-east-1"
PK="ORG#${ORG_ID}#EVT#${EVENT_ID}"

echo "================================================"
echo "DynamoDB Item Deletion (Before Date Filter)"
echo "================================================"
echo "PK: $PK"
echo "Deleting items created BEFORE: $BEFORE_DATE"
echo "================================================"
echo ""

# 먼저 삭제될 항목 수 확인 (dry-run)
echo "Counting items to be deleted..."

LAST_KEY=""
TOTAL_TO_DELETE=0

while true; do
  if [ -z "$LAST_KEY" ]; then
    RESULT=$(aws dynamodb query \
      --table-name "$TABLE_NAME" \
      --region "$REGION" \
      --key-condition-expression "PK = :pk" \
      --filter-expression "createdAt < :before_date" \
      --expression-attribute-values "{\":pk\": {\"S\": \"$PK\"}, \":before_date\": {\"S\": \"$BEFORE_DATE\"}}" \
      --projection-expression "PK, SK, createdAt" \
      --output json)
  else
    RESULT=$(aws dynamodb query \
      --table-name "$TABLE_NAME" \
      --region "$REGION" \
      --key-condition-expression "PK = :pk" \
      --filter-expression "createdAt < :before_date" \
      --expression-attribute-values "{\":pk\": {\"S\": \"$PK\"}, \":before_date\": {\"S\": \"$BEFORE_DATE\"}}" \
      --projection-expression "PK, SK, createdAt" \
      --exclusive-start-key "$LAST_KEY" \
      --output json)
  fi

  ITEM_COUNT=$(echo "$RESULT" | jq '.Items | length')
  TOTAL_TO_DELETE=$((TOTAL_TO_DELETE + ITEM_COUNT))

  LAST_KEY=$(echo "$RESULT" | jq -c '.LastEvaluatedKey // empty')
  if [ -z "$LAST_KEY" ]; then
    break
  fi
done

echo "Found $TOTAL_TO_DELETE items to delete."
echo ""

if [ "$TOTAL_TO_DELETE" -eq 0 ]; then
  echo "No items to delete. Exiting."
  exit 0
fi

# 확인 프롬프트
read -p "Do you want to proceed with deletion? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Starting deletion..."

LAST_KEY=""
TOTAL_DELETED=0

while true; do
  # 페이지네이션 처리 (필터 포함)
  if [ -z "$LAST_KEY" ]; then
    RESULT=$(aws dynamodb query \
      --table-name "$TABLE_NAME" \
      --region "$REGION" \
      --key-condition-expression "PK = :pk" \
      --filter-expression "createdAt < :before_date" \
      --expression-attribute-values "{\":pk\": {\"S\": \"$PK\"}, \":before_date\": {\"S\": \"$BEFORE_DATE\"}}" \
      --projection-expression "PK, SK" \
      --output json)
  else
    RESULT=$(aws dynamodb query \
      --table-name "$TABLE_NAME" \
      --region "$REGION" \
      --key-condition-expression "PK = :pk" \
      --filter-expression "createdAt < :before_date" \
      --expression-attribute-values "{\":pk\": {\"S\": \"$PK\"}, \":before_date\": {\"S\": \"$BEFORE_DATE\"}}" \
      --projection-expression "PK, SK" \
      --exclusive-start-key "$LAST_KEY" \
      --output json)
  fi

  ITEMS=$(echo "$RESULT" | jq -c '.Items')
  ITEM_COUNT=$(echo "$ITEMS" | jq 'length')

  if [ "$ITEM_COUNT" -eq 0 ]; then
    # 다음 페이지 확인 (필터링 후 0개여도 더 있을 수 있음)
    LAST_KEY=$(echo "$RESULT" | jq -c '.LastEvaluatedKey // empty')
    if [ -z "$LAST_KEY" ]; then
      break
    fi
    continue
  fi

  # 25개씩 배치로 삭제 (BatchWriteItem 최대 제한)
  echo "$ITEMS" | jq -c '[.[] | {DeleteRequest: {Key: {PK: .PK, SK: .SK}}}]' | \
  jq -c "range(0; length; 25) as \$i | .[\$i:\$i+25]" | \
  while read -r batch; do
    BATCH_SIZE=$(echo "$batch" | jq 'length')
    
    if [ "$BATCH_SIZE" -gt 0 ]; then
      REQUEST_JSON=$(echo "$batch" | jq -c "{\"$TABLE_NAME\": .}")
      
      # 재시도 로직
      MAX_RETRIES=5
      RETRY_COUNT=0
      
      while [ -n "$REQUEST_JSON" ] && [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
        RESPONSE=$(aws dynamodb batch-write-item \
          --region "$REGION" \
          --request-items "$REQUEST_JSON" 2>&1)
        
        if [ $? -ne 0 ]; then
          echo "Error: $RESPONSE"
          RETRY_COUNT=$((RETRY_COUNT + 1))
          sleep $((2 ** RETRY_COUNT))
          continue
        fi
        
        # UnprocessedItems 확인
        UNPROCESSED=$(echo "$RESPONSE" | jq -c ".UnprocessedItems // {}")
        
        if [ "$UNPROCESSED" = "{}" ] || [ -z "$UNPROCESSED" ]; then
          break
        fi
        
        echo "Retrying $(echo "$UNPROCESSED" | jq ".\"$TABLE_NAME\" | length") unprocessed items..."
        REQUEST_JSON="$UNPROCESSED"
        RETRY_COUNT=$((RETRY_COUNT + 1))
        sleep $((2 ** RETRY_COUNT))
      done
      
      if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
        echo "Warning: Max retries reached. Some items may not be deleted."
      fi
      
      echo "Deleted batch of $BATCH_SIZE items"
    fi
  done

  TOTAL_DELETED=$((TOTAL_DELETED + ITEM_COUNT))
  echo "Progress: $TOTAL_DELETED items deleted so far"

  # 다음 페이지 키 확인
  LAST_KEY=$(echo "$RESULT" | jq -c '.LastEvaluatedKey // empty')

  if [ -z "$LAST_KEY" ]; then
    break
  fi
  
  # API 속도 제한 방지를 위한 짧은 대기
  sleep 0.1
done

echo ""
echo "================================================"
echo "Deletion complete!"
echo "Total deleted: $TOTAL_DELETED items"
echo "================================================"

