import json
import logging
import os
import re
import time
import urllib.parse
from datetime import datetime
from typing import Any, Dict, List, Optional, Set
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

# --- Configuration ---
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(asctime)s:%(message)s')
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# --- Environment Variable Loading & Validation ---
PHOTOS_TABLE_NAME = os.environ.get('PHOTOS_TABLE_NAME')
RUNNERS_TABLE_NAME = os.environ.get('RUNNERS_TABLE_NAME')
BIB_FOUND_QUEUE_URL = os.environ.get('BIB_FOUND_QUEUE_URL')
NO_BIB_FOUND_QUEUE_URL = os.environ.get('NO_BIB_FOUND_QUEUE_URL')
MIN_TEXT_CONFIDENCE = float(os.environ.get('MIN_TEXT_CONFIDENCE', 90.0))
CLOUDFRONT_DOMAIN_NAME = os.environ.get('CLOUDFRONT_DOMAIN_NAME')
WATERMARK_BOTTOM_THRESHOLD = 0.65 # Any text starting below this vertical position will be a candidate for filtering.
WATERMARK_LEFT_THRESHOLD = 0.30 # Text in the leftmost 30% of the image will be filtered if it's also in the bottom zone.
WATERMARK_RIGHT_THRESHOLD = 0.70 # Text in the rightmost 30% of the image will be filtered if it's also in the bottom zone.

if not all([PHOTOS_TABLE_NAME, RUNNERS_TABLE_NAME, BIB_FOUND_QUEUE_URL, NO_BIB_FOUND_QUEUE_URL]):
    raise RuntimeError("Missing required environment variables.")

# --- AWS Client Initialization ---
dynamodb = boto3.resource('dynamodb')
photos_table = dynamodb.Table(PHOTOS_TABLE_NAME)
runners_table = dynamodb.Table(RUNNERS_TABLE_NAME)
rekognition_client = boto3.client('rekognition')
sqs_client = boto3.client('sqs')

def load_valid_bibs_from_dynamodb() -> Set[str]:
    """
    Scans the Runners table to get a set of all valid bib numbers.
    This is called once during Lambda cold starts and the result is cached.
    """
    bibs = set()
    last_evaluated_key = None
    logger.info(f"Loading valid bib numbers from DynamoDB table: {RUNNERS_TABLE_NAME}")

    while True:
        scan_args = {
            'ProjectionExpression': 'bib_number'
        }
        if last_evaluated_key:
            scan_args['ExclusiveStartKey'] = last_evaluated_key
        
        response = runners_table.scan(**scan_args)
        
        for item in response.get('Items', []):
            bibs.add(item['bib_number'])
            
        last_evaluated_key = response.get('LastEvaluatedKey')
        if not last_evaluated_key:
            break
            
    logger.info(f"Successfully loaded {len(bibs)} valid bib numbers.")
    return bibs

# --- Global Cache ---
VALID_BIBS = load_valid_bibs_from_dynamodb()

def sanitize_id(input_string: str) -> str:
    """
    Sanitizes a string to be a valid Rekognition ExternalImageId by replacing
    any invalid characters with an underscore.
    """
    s = input_string.replace('/', '__')
    return re.sub(r'[^a-zA-Z0-9_.\-:]', '_', s)

def floats_to_decimals(obj):
    """Recursively walks a dictionary or list and converts floats to Decimals."""
    if isinstance(obj, list):
        return [floats_to_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: floats_to_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, float):
        return Decimal(str(obj))
    return obj

def find_all_bib_matches(detected_texts: List[Dict[str, Any]]) -> Set[str]:
    """
    Finds all unique, valid bib numbers, IGNORING any text found in the bottom-left or bottom-right corner.
    """
    bib_matches = set()

    for text_info in detected_texts:
        # Basic filtering for confident, word-level detections
        if text_info.get('Type') != 'WORD' or text_info.get('Confidence', 0) < MIN_TEXT_CONFIDENCE:
            continue

        detected_text = text_info.get('DetectedText', '')

        # --- START: Updated Corner Filtering Logic ---
        bbox = text_info.get('Geometry', {}).get('BoundingBox', {})
        if bbox:
            top = bbox.get('Top', 0)
            left = bbox.get('Left', 0)

            # Check if the text is in the bottom-left corner ignore zone
            is_in_bottom_left = (top > WATERMARK_BOTTOM_THRESHOLD and left < WATERMARK_LEFT_THRESHOLD)
            
            # Check if the text is in the bottom-right corner ignore zone
            is_in_bottom_right = (top > WATERMARK_BOTTOM_THRESHOLD and left > WATERMARK_RIGHT_THRESHOLD)

            if is_in_bottom_left or is_in_bottom_right:
                logger.debug(f"Ignoring text '{detected_text}' as it is in a watermark corner zone.")
                continue
        # --- END: Updated Corner Filtering Logic ---

        # Check if the remaining text is a valid bib
        numeric_text = re.sub(r'\D', '', detected_text)
        if numeric_text in VALID_BIBS:
            bib_matches.add(numeric_text)

    if bib_matches:
        logger.info(f"Found {len(bib_matches)} potential bib matches: {bib_matches}")
        
    return bib_matches

def parse_s3_key(raw_key: str) -> Optional[Dict[str, str]]:
    """
    Parses and validates the S3 object key to extract event context
    """
    key_parts = raw_key.split('/')
    if len(key_parts) == 4 and key_parts[2] == 'raw_photos':
        return {
            'organizer_id': key_parts[0],
            'event_id': key_parts[1],
            'filename': key_parts[3]
        }
    logger.warning(f"Skipping object with invalid key structure: {raw_key}")
    return None


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler, updated to support multiple bib detections.
    """
    start_time = time.time()
    
    detail = event.get('detail', {})
    if not detail:
        logger.error("Event is missing the 'detail' object. Not an S3 event from EventBridge.")
        return {'statusCode': 400, 'body': 'Invalid event format.'}

    bucket_name = detail.get('bucket', {}).get('name')
    raw_image_key = urllib.parse.unquote_plus(detail.get('object', {}).get('key', ''))

    if not all([bucket_name, raw_image_key]):
        logger.error(f"Could not extract bucket name or key from event detail: {detail}")
        return {'statusCode': 400, 'body': 'Invalid S3 event detail.'}

    s3_context = parse_s3_key(raw_image_key)
    if not s3_context:
        logger.info(f"Object key '{raw_image_key}' did not match the required 'raw_photos' path. Skipping.")
        return {'statusCode': 200, 'body': 'Object key does not match required format.'}

    organizer_id = s3_context['organizer_id']
    event_id = s3_context['event_id']
    filename = s3_context['filename']
    
    sanitized_image_key = sanitize_id(f"{organizer_id}/{event_id}/{filename}")

    try:
        logger.info(f"Processing image: s3://{bucket_name}/{raw_image_key}")

        response = rekognition_client.detect_text(
            Image={'S3Object': {'Bucket': bucket_name, 'Name': raw_image_key}}
        )
        detected_texts = response.get('TextDetections', [])
        
        unique_bibs_found = find_all_bib_matches(detected_texts)
        
        confirmed_bib_number = None
        if len(unique_bibs_found) == 1:
            confirmed_bib_number = unique_bibs_found.copy().pop()

        cloudfront_url = f"https://{CLOUDFRONT_DOMAIN_NAME}/{urllib.parse.quote(raw_image_key)}"

        item = {
            'image_key': sanitized_image_key,
            'raw_s3_key': raw_image_key,
            'organizer_id': organizer_id,
            'event_id': event_id,
            's3_bucket': bucket_name,
            'cloudfront_url': cloudfront_url,
            'processing_status': 'TEXT_DETECTED',
            'bib_number': confirmed_bib_number or 'NONE',
            'detected_bibs': list(unique_bibs_found),
            'timestamp': datetime.utcnow().isoformat(),
            'rekognition_response': detected_texts 
        }
        item_with_decimals = floats_to_decimals(item)
        photos_table.put_item(Item=item_with_decimals)

        message_body = json.dumps({
            'organizer_id': organizer_id,
            'event_id': event_id,
            'bucket': bucket_name,
            'raw_key': raw_image_key,
            'sanitized_key': sanitized_image_key,
            'bib': confirmed_bib_number
        })
        queue_url = BIB_FOUND_QUEUE_URL if confirmed_bib_number else NO_BIB_FOUND_QUEUE_URL
        
        sqs_client.send_message(QueueUrl=queue_url, MessageBody=message_body)
        
        logger.info(f"Successfully processed '{raw_image_key}'. Confirmed bib: {confirmed_bib_number or 'No'}")
        return {'statusCode': 200, 'body': json.dumps(f"Successfully processed {raw_image_key}")}

    except ClientError as e:
        logger.error(f"AWS Client Error processing s3://{bucket_name}/{raw_image_key}: {e}")
        raise
    except Exception as e:
        logger.error(f"Unhandled error processing s3://{bucket_name}/{raw_image_key}: {e}")
        raise