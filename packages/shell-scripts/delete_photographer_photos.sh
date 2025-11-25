#!/bin/bash
# 사용법: ./delete_photographer_photos.sh <instagram_handle> [eventId]
# eventId는 선택사항 - 지정하면 해당 이벤트의 사진만 삭제

# 특정 포토그래퍼 사진 수 확인
# aws dynamodb query \
#   --table-name "PhotoService" \
#   --region "us-east-1" \
#   --index-name "GSI2" \
#   --key-condition-expression "GSI2PK = :pk" \
#   --expression-attribute-values '{":pk": {"S": "PHOTOGRAPHER#@john_photo"}}' \
#   --select "COUNT" \
#   --output json | jq '.Count'

if [ $# -lt 1 ]; then
  echo "Usage: $0 <instagram_handle> [eventId]"
  echo ""
  echo "Examples:"
  echo "  $0 @john_photo                    # 모든 이벤트에서 해당 포토그래퍼 사진 삭제"
  echo "  $0 @john_photo run-for-liberty-5k-2025  # 특정 이벤트에서만 삭제"
  exit 1
fi

INSTAGRAM_HANDLE=$1
EVENT_ID=$2

TABLE_NAME="PhotoService"
REGION="us-east-1"
GSI2PK="PHOTOGRAPHER#${INSTAGRAM_HANDLE}"

echo "================================================"
echo "Delete Photographer Photos"
echo "================================================"
echo "Instagram Handle: $INSTAGRAM_HANDLE"
echo "GSI2PK: $GSI2PK"
if [ -n "$EVENT_ID" ]; then
  echo "Event Filter: $EVENT_ID"
fi
echo "================================================"
echo ""

# Step 1: GSI2로 포토그래퍼의 PHOTO 항목 조회
echo "Fetching photos by photographer..."

LAST_KEY=""
ALL_PHOTOS=()

while true; do
  if [ -z "$LAST_KEY" ]; then
    RESULT=$(aws dynamodb query \
      --table-name "$TABLE_NAME" \
      --region "$REGION" \
      --index-name "GSI2" \
      --key-condition-expression "GSI2PK = :gsi2pk" \
      --expression-attribute-values "{\":gsi2pk\": {\"S\": \"$GSI2PK\"}}" \
      --projection-expression "PK, SK, ulid, eventId, bibs" \
      --output json)
  else
    RESULT=$(aws dynamodb query \
      --table-name "$TABLE_NAME" \
      --region "$REGION" \
      --index-name "GSI2" \
      --key-condition-expression "GSI2PK = :gsi2pk" \
      --expression-attribute-values "{\":gsi2pk\": {\"S\": \"$GSI2PK\"}}" \
      --projection-expression "PK, SK, ulid, eventId, bibs" \
      --exclusive-start-key "$LAST_KEY" \
      --output json)
  fi

  ITEMS=$(echo "$RESULT" | jq -c '.Items[]')
  
  while IFS= read -r item; do
    if [ -n "$item" ]; then
      ITEM_EVENT_ID=$(echo "$item" | jq -r '.eventId.S')
      
      # eventId 필터가 있으면 해당 이벤트만
      if [ -z "$EVENT_ID" ] || [ "$ITEM_EVENT_ID" = "$EVENT_ID" ]; then
        ALL_PHOTOS+=("$item")
      fi
    fi
  done <<< "$ITEMS"

  LAST_KEY=$(echo "$RESULT" | jq -c '.LastEvaluatedKey // empty')
  if [ -z "$LAST_KEY" ]; then
    break
  fi
done

PHOTO_COUNT=${#ALL_PHOTOS[@]}
echo "Found $PHOTO_COUNT photos by $INSTAGRAM_HANDLE"

if [ "$PHOTO_COUNT" -eq 0 ]; then
  echo "No photos to delete. Exiting."
  exit 0
fi

# Step 2: bibs 배열을 사용하여 BIB_INDEX 항목 키 직접 구성 (추가 DB 쿼리 없음)
echo ""
echo "Building delete list from bibs array..."

ALL_ITEMS_TO_DELETE=()
BIB_INDEX_COUNT=0

for photo in "${ALL_PHOTOS[@]}"; do
  PK=$(echo "$photo" | jq -r '.PK.S')
  SK=$(echo "$photo" | jq -r '.SK.S')
  ULID=$(echo "$photo" | jq -r '.ulid.S')
  
  # PHOTO 항목 추가
  ALL_ITEMS_TO_DELETE+=("{\"PK\": {\"S\": \"$PK\"}, \"SK\": {\"S\": \"$SK\"}}")
  
  # bibs 배열에서 각 bib 값을 읽어 BIB_INDEX 키 직접 구성
  BIBS=$(echo "$photo" | jq -r '.bibs.L[]?.S // empty' 2>/dev/null)
  
  while IFS= read -r bib; do
    if [ -n "$bib" ]; then
      # BIB_INDEX SK 패턴: BIB#<bib>#PHOTO#<ulid>
      BIB_SK="BIB#${bib}#PHOTO#${ULID}"
      ALL_ITEMS_TO_DELETE+=("{\"PK\": {\"S\": \"$PK\"}, \"SK\": {\"S\": \"$BIB_SK\"}}")
      BIB_INDEX_COUNT=$((BIB_INDEX_COUNT + 1))
    fi
  done <<< "$BIBS"
done

TOTAL_ITEMS=${#ALL_ITEMS_TO_DELETE[@]}
echo "Total items to delete: $TOTAL_ITEMS ($PHOTO_COUNT photos + $BIB_INDEX_COUNT BIB_INDEX items)"
echo ""

# 확인 프롬프트
read -p "Do you want to proceed with deletion? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Starting deletion..."

# Step 3: 배치 삭제
TOTAL_DELETED=0

for ((i=0; i<${#ALL_ITEMS_TO_DELETE[@]}; i+=25)); do
  BATCH=()
  for ((j=i; j<i+25 && j<${#ALL_ITEMS_TO_DELETE[@]}; j++)); do
    BATCH+=("{\"DeleteRequest\": {\"Key\": ${ALL_ITEMS_TO_DELETE[$j]}}}")
  done
  
  BATCH_SIZE=${#BATCH[@]}
  
  if [ "$BATCH_SIZE" -gt 0 ]; then
    BATCH_JSON=$(IFS=,; echo "[${BATCH[*]}]")
    REQUEST_JSON="{\"$TABLE_NAME\": $BATCH_JSON}"
    
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
      
      echo "Retrying unprocessed items..."
      REQUEST_JSON="$UNPROCESSED"
      RETRY_COUNT=$((RETRY_COUNT + 1))
      sleep $((2 ** RETRY_COUNT))
    done
    
    if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
      echo "Warning: Max retries reached. Some items may not be deleted."
    fi
    
    TOTAL_DELETED=$((TOTAL_DELETED + BATCH_SIZE))
    echo "Deleted batch: $BATCH_SIZE items (Total: $TOTAL_DELETED)"
  fi
  
  # API 속도 제한 방지
  sleep 0.1
done

echo ""
echo "================================================"
echo "Deletion complete!"
echo "Total deleted: $TOTAL_DELETED items"
echo "================================================"

