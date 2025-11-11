#!/bin/bash


# 사용법 출력 함수
usage() {
  echo "사용법: $0 <디렉토리_경로> <instagram_id> [옵션]"
  echo ""
  echo "옵션:"
  echo "  -r, --resize <크기>        ImageMagick으로 이미지 리사이즈 (예: 1920x1080, 50%)"
  echo "  -c, --compress [품질]      jpegoptim으로 이미지 압축 (기본값: 80, 범위: 1-100)"
  echo "                             숫자가 클수록 품질 높음 (덜 압축), 작을수록 강압축"
  echo "  -a, --auto-optimize <크기> 지정 크기(MB) 이상 파일만 자동 최적화"
  echo "                             예: --auto-optimize 5 (5MB 이상 파일만 처리)"
  echo ""
  echo "예시:"
  echo "  $0 ./images sestafford"
  echo "  $0 ./images sestafford --resize 1920x1080"
  echo "  $0 ./images sestafford --compress 85"
  echo "  $0 ./images sestafford --auto-optimize 5"
  echo "  $0 ./images sestafford --auto-optimize 3 --resize 1920x1080 --compress 80"
  exit 1
}


# 인자 체크
if [ $# -lt 2 ]; then
  usage
fi


# 디렉토리 경로와 Instagram ID
DIR="$1"
INSTAGRAM_ID="$2"
shift 2


# 옵션 변수 초기화
RESIZE=""
COMPRESS=false
COMPRESS_QUALITY=80
AUTO_OPTIMIZE=false
SIZE_THRESHOLD_MB=0


# 옵션 파싱
while [[ $# -gt 0 ]]; do
  case $1 in
    -r|--resize)
      RESIZE="$2"
      shift 2
      ;;
    -c|--compress)
      COMPRESS=true
      if [[ $# -gt 1 && "$2" =~ ^[0-9]+$ ]]; then
        COMPRESS_QUALITY="$2"
        shift 2
      else
        shift
      fi
      ;;
    -a|--auto-optimize)
      AUTO_OPTIMIZE=true
      SIZE_THRESHOLD_MB="$2"
      shift 2
      ;;
    *)
      echo "알 수 없는 옵션: $1"
      usage
      ;;
  esac
done


# 품질값 검증 (1-100 범위)
if [ "$COMPRESS" = true ] && (( COMPRESS_QUALITY < 1 || COMPRESS_QUALITY > 100 )); then
  echo "오류: 압축 품질은 1-100 사이여야 합니다."
  exit 1
fi


# 자동 최적화 임계값 검증
if [ "$AUTO_OPTIMIZE" = true ] && ! [[ "$SIZE_THRESHOLD_MB" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  echo "오류: 파일 크기 임계값은 숫자여야 합니다."
  exit 1
fi


# 디렉토리 존재 여부 확인
if [ ! -d "$DIR" ]; then
  echo "오류: '$DIR' 디렉토리를 찾을 수 없습니다."
  exit 1
fi


# ImageMagick 확인
if [ -n "$RESIZE" ] || [ "$AUTO_OPTIMIZE" = true ]; then
  if ! command -v magick &> /dev/null; then
    echo "오류: ImageMagick이 설치되어 있지 않습니다."
    echo "설치: brew install imagemagick (macOS) 또는 apt-get install imagemagick (Linux)"
    exit 1
  fi
fi


# jpegoptim 확인
if [ "$COMPRESS" = true ] || [ "$AUTO_OPTIMIZE" = true ]; then
  if ! command -v jpegoptim &> /dev/null; then
    echo "오류: jpegoptim이 설치되어 있지 않습니다."
    echo "설치: brew install jpegoptim (macOS) 또는 apt-get install jpegoptim (Linux)"
    exit 1
  fi
fi


# 디렉토리로 이동
cd "$DIR" || exit 1


echo "=== 이미지 처리 시작 ==="
echo "디렉토리: $DIR"
echo "Instagram ID: @$INSTAGRAM_ID"
[ -n "$RESIZE" ] && echo "리사이즈: $RESIZE"
[ "$COMPRESS" = true ] && echo "압축: 활성화 (품질: $COMPRESS_QUALITY, 메타데이터 제거)"
[ "$AUTO_OPTIMIZE" = true ] && echo "자동 최적화: ${SIZE_THRESHOLD_MB}MB 이상 파일"
echo ""


count=1
optimized_count=0
skipped_count=0


find . -maxdepth 1 -type f \( -iname "*.jpg" -o -iname "*.jpeg" \) -print0 | while IFS= read -r -d $'\0' file; do
  # 파일명에서 ./ 접두사 제거
  file="${file#./}"
  
  # 파일 크기 계산 (MB)
  file_size_bytes=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
  file_size_mb=$(echo "scale=2; $file_size_bytes / 1048576" | bc)
  
  new_name="@${INSTAGRAM_ID}-$count.jpg"
  
  # 파일명 변경
  mv -- "$file" "$new_name"
  echo "[$count] Renamed: $file -> $new_name (${file_size_mb}MB)"
  
  # 자동 최적화 모드인 경우 파일 크기 체크
  should_optimize=false
  if [ "$AUTO_OPTIMIZE" = true ]; then
    if (( $(echo "$file_size_mb >= $SIZE_THRESHOLD_MB" | bc -l) )); then
      should_optimize=true
      echo "    ⚠️  ${SIZE_THRESHOLD_MB}MB 이상 - 최적화 적용"
    else
      echo "    ✓ ${SIZE_THRESHOLD_MB}MB 미만 - 최적화 스킵"
      ((skipped_count++))
    fi
  fi
  
  # 리사이즈 (전체 적용 또는 자동 최적화 조건 충족 시)
  if [ -n "$RESIZE" ]; then
    if [ "$AUTO_OPTIMIZE" = false ] || [ "$should_optimize" = true ]; then
      magick "$new_name" -resize "$RESIZE" "$new_name"
      echo "    ✓ Resized to $RESIZE"
    fi
  fi
  
  # 압축 (전체 적용 또는 자동 최적화 조건 충족 시)
  if [ "$COMPRESS" = true ]; then
    if [ "$AUTO_OPTIMIZE" = false ] || [ "$should_optimize" = true ]; then
      jpegoptim --max="$COMPRESS_QUALITY" --strip-all "$new_name"
      echo "    ✓ Compressed (quality: $COMPRESS_QUALITY, metadata stripped)"
    fi
  fi
  
  # 자동 최적화 모드에서 조건 충족 시 기본 최적화 적용
  if [ "$AUTO_OPTIMIZE" = true ] && [ "$should_optimize" = true ]; then
    # resize 옵션이 없으면 기본 리사이즈 적용
    if [ -z "$RESIZE" ]; then
      magick "$new_name" -resize 1920x1080\> "$new_name"
      echo "    ✓ Auto-resized to max 1920x1080"
    fi
    
    # compress 옵션이 없으면 기본 압축 적용
    if [ "$COMPRESS" = false ]; then
      jpegoptim --max=80 --strip-all "$new_name"
      echo "    ✓ Auto-compressed (quality: 80)"
    fi
    
    ((optimized_count++))
  fi
  
  ((count++))
done


echo ""
echo "=== 완료! 총 $((count-1))개 파일 처리 ==="
[ "$AUTO_OPTIMIZE" = true ] && echo "최적화 적용: ${optimized_count}개 / 스킵: ${skipped_count}개"
