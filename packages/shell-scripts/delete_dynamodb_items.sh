#!/bin/bash
# 사용법: ./delete_dynamodb_items.sh <orgId> <eventId>

if [ $# -ne 2 ]; then
  echo "Usage: $0 <orgId> <eventId>"
  echo "Example: $0 winningeventsgroup hoboken-turkey-trot-1mile-2025"
  exit 1
fi

ORG_ID=$1
EVENT_ID=$2

TABLE_NAME="PhotoService"
REGION="us-east-1"
PK="ORG#${ORG_ID}#EVT#${EVENT_ID}"

echo "Starting deletion for PK: $PK"

LAST_KEY=""
TOTAL_DELETED=0

while true; do
  # 페이지네이션 처리
  if [ -z "$LAST_KEY" ]; then
    RESULT=$(aws dynamodb query \
      --table-name "$TABLE_NAME" \
      --region "$REGION" \
      --key-condition-expression "PK = :pk" \
      --expression-attribute-values "{\":pk\": {\"S\": \"$PK\"}}" \
      --projection-expression "PK, SK" \
      --output json)
  else
    RESULT=$(aws dynamodb query \
      --table-name "$TABLE_NAME" \
      --region "$REGION" \
      --key-condition-expression "PK = :pk" \
      --expression-attribute-values "{\":pk\": {\"S\": \"$PK\"}}" \
      --projection-expression "PK, SK" \
      --exclusive-start-key "$LAST_KEY" \
      --output json)
  fi

  ITEMS=$(echo "$RESULT" | jq -c '.Items')
  ITEM_COUNT=$(echo "$ITEMS" | jq 'length')

  if [ "$ITEM_COUNT" -eq 0 ]; then
    echo "No items found in this batch."
    break
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
    echo "No more pages. Done!"
    echo "Total deleted: $TOTAL_DELETED items"
    break
  fi
  
  # API 속도 제한 방지를 위한 짧은 대기
  sleep 0.1
done
