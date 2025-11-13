#!/bin/bash

# 사용법 출력
usage() {
  echo "Usage: $0 -c <collection-id> [-o <output-file>] [-h]"
  echo "  -c <collection-id>: AWS Rekognition collection ID (required)"
  echo "  -o <output-file>: Output JSON file path (default: all_faces.json)"
  echo "  -h: Display this help message"
  exit 1
}

# 기본값 설정
OUTPUT_FILE="all_faces.json"
COLLECTION_ID=""

# 파라미터 파싱
while getopts "c:o:h" opt; do
  case $opt in
    c)
      COLLECTION_ID="$OPTARG"
      ;;
    o)
      OUTPUT_FILE="$OPTARG"
      ;;
    h)
      usage
      ;;
    *)
      usage
      ;;
  esac
done

# Collection ID 필수 확인
if [ -z "$COLLECTION_ID" ]; then
  echo "Error: Collection ID is required"
  usage
fi

# jq 설치 확인
if ! command -v jq &> /dev/null; then
  echo "Error: jq is not installed. Please install jq first."
  exit 1
fi

# AWS CLI 설치 확인
if ! command -v aws &> /dev/null; then
  echo "Error: AWS CLI is not installed. Please install AWS CLI first."
  exit 1
fi

echo "Starting to dump faces from collection: $COLLECTION_ID"
echo "Output file: $OUTPUT_FILE"

NEXT_TOKEN=""
TMP_FILE="tmp_faces_$$.json"
FIRST_PAGE=true
TOTAL_FACES=0

# 출력 파일 초기화
echo "[" > "$OUTPUT_FILE"

# 페이징 처리하며 모든 얼굴 데이터 추출
while :; do
  echo "Fetching faces..." >&2
  
  if [ -z "$NEXT_TOKEN" ]; then
    RESPONSE=$(aws rekognition list-faces --collection-id "$COLLECTION_ID" 2>&1)
  else
    RESPONSE=$(aws rekognition list-faces --collection-id "$COLLECTION_ID" --next-token "$NEXT_TOKEN" 2>&1)
  fi

  # AWS 명령 실패 확인
  if [ $? -ne 0 ]; then
    echo "Error: $RESPONSE" >&2
    rm -f "$OUTPUT_FILE" "$TMP_FILE"
    exit 1
  fi

  # Faces 배열 추출
  echo "$RESPONSE" | jq '.Faces' > "$TMP_FILE"

  # 현재 페이지 얼굴 개수
  PAGE_COUNT=$(jq 'length' "$TMP_FILE")
  TOTAL_FACES=$((TOTAL_FACES + PAGE_COUNT))
  
  echo "Fetched $PAGE_COUNT faces (Total: $TOTAL_FACES)" >&2

  if [ "$FIRST_PAGE" = true ]; then
    # 첫 페이지: 배열 요소들을 추출하고 쉼표 추가
    jq -c '.[]' "$TMP_FILE" | sed '$!s/$/,/' >> "$OUTPUT_FILE"
    FIRST_PAGE=false
  else
    # 이후 페이지: 첫 요소 앞에 쉼표 추가
    jq -c '.[]' "$TMP_FILE" | sed '1s/^/,/' | sed '$!s/$/,/' >> "$OUTPUT_FILE"
  fi

  # NextToken 확인
  NEXT_TOKEN=$(echo "$RESPONSE" | jq -r '.NextToken // empty')
  
  if [ -z "$NEXT_TOKEN" ]; then
    break
  fi
done

# 파일 종료
echo "]" >> "$OUTPUT_FILE"

# 임시 파일 정리
rm -f "$TMP_FILE"

echo "Successfully dumped $TOTAL_FACES faces to $OUTPUT_FILE" >&2
