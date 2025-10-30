import json
import logging
import os
import base64
import uuid
from datetime import datetime
import re

import boto3
from botocore.exceptions import ClientError

# --- Configuration ---
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(asctime)s:%(message)s')
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# --- Environment Variable Loading & Validation ---
PHOTOS_TABLE_NAME = os.environ.get('PHOTOS_TABLE_NAME')
RUNNERS_TABLE_NAME = os.environ.get('RUNNERS_TABLE_NAME')
EVENTS_TABLE_NAME = os.environ.get('EVENTS_TABLE_NAME')
GALLERIES_TABLE_NAME = os.environ.get('GALLERIES_TABLE_NAME')
UPLOAD_BUCKET = os.environ.get('UPLOAD_BUCKET')
REKOGNITION_COLLECTION_PREFIX = os.environ.get('REKOGNITION_COLLECTION_PREFIX', 'race-photos')
FACE_SIMILARITY_THRESHOLD = float(os.environ.get('FACE_SIMILARITY_THRESHOLD', 95.0))

if not all([PHOTOS_TABLE_NAME, RUNNERS_TABLE_NAME, GALLERIES_TABLE_NAME, UPLOAD_BUCKET]):
    raise RuntimeError("Missing one or more required environment variables.")

# --- AWS Client Initialization ---
dynamodb = boto3.resource('dynamodb')
rekognition_client = boto3.client('rekognition')
s3_client = boto3.client('s3')
photos_table = dynamodb.Table(PHOTOS_TABLE_NAME)
galleries_table = dynamodb.Table(GALLERIES_TABLE_NAME)
runners_table = dynamodb.Table(RUNNERS_TABLE_NAME)
events_table = dynamodb.Table(EVENTS_TABLE_NAME)

def get_event_info(event_id: str) -> dict:
    """Fetches an event's details from the Events table."""
    try:
        response = events_table.get_item(Key={'event_id': event_id})
        return response.get('Item', {})
    except ClientError as e:
        logger.error(f"Failed to get info for event {event_id}: {e}")
        return {}

def get_runner_info(event_id: str, bib_number: str) -> dict:
    """Fetches a runner's details from the Runners table using a composite key."""
    try:
        response = runners_table.get_item(
            Key={'event_id': event_id, 'bib_number': bib_number}
        )
        return response.get('Item', {})
    except ClientError as e:
        logger.error(f"Failed to get info for runner {bib_number} in event {event_id}: {e}")
        return {}

def sanitize_for_path(input_string: str) -> str:
    """
    Aggressively sanitizes a string to be a valid path component in a
    DynamoDB UpdateExpression by replacing any non-alphanumeric character
    with an underscore.
    """
    return re.sub(r'[^a-zA-Z0-9_]', '_', input_string)


def lambda_handler(event: dict, context) -> dict:
    """
    Receives a selfie and bib, finds new matching photos, and saves them
    to the 'selfie_matched_photos' field.
    """
    try:
        # --- Steps 1-4: Parse, Upload, Search, and Get URLs ---
        body = json.loads(event.get('body', '{}'))
        image_b64 = body.get('image')
        bib_number = body.get('bib_number')
        organizer_id = body.get('organizer_id')
        event_id = body.get('event_id')

        if not all([image_b64, bib_number, organizer_id, event_id]):
            return {'statusCode': 400, 'body': json.dumps('Missing required fields.')}

        image_bytes = base64.b64decode(image_b64)
        collection_id = f"{REKOGNITION_COLLECTION_PREFIX}-{organizer_id}-{event_id}"
        
        response = rekognition_client.search_faces_by_image(
            CollectionId=collection_id,
            Image={'Bytes': image_bytes},
            FaceMatchThreshold=FACE_SIMILARITY_THRESHOLD,
            MaxFaces=100
        )
        matched_faces = response.get('FaceMatches', [])
        
        photos_found_by_selfie = []
        if matched_faces:
            matched_image_keys = {match['Face']['ExternalImageId'] for match in matched_faces}
            if matched_image_keys:
                keys_to_fetch = [{'image_key': key} for key in matched_image_keys]
                photo_items_response = dynamodb.batch_get_item(
                    RequestItems={PHOTOS_TABLE_NAME: {'Keys': keys_to_fetch, 'ProjectionExpression': 'cloudfront_url'}}
                )
                photo_items = photo_items_response.get('Responses', {}).get(PHOTOS_TABLE_NAME, [])
                photos_found_by_selfie = [item['cloudfront_url'] for item in photo_items if 'cloudfront_url' in item]

        # --- Step 5: Get Existing bib-matched Photos to prevent duplicates ---
        try:
            gallery_response = galleries_table.get_item(
                Key={'event_id': event_id, 'bib_number': bib_number},
                ProjectionExpression="bib_matched_photos"
            )
            existing_bib_photos = gallery_response.get('Item', {}).get('bib_matched_photos', [])
        except ClientError as e:
            logger.error(f"Could not fetch existing gallery for bib {bib_number}: {e}")
            existing_bib_photos = []

        # --- Step 6: Determine which photos are genuinely new ---
        existing_bib_photos_set = set(existing_bib_photos)
        newly_found_photos = sorted([url for url in photos_found_by_selfie if url not in existing_bib_photos_set])

        if not newly_found_photos:
             return {'statusCode': 200, 'body': json.dumps({'message': 'No new matches found from your selfie.', 'selfie_matched_photos': []})}

        # --- Step 7: Update the Galleries table, saving ONLY new photos to the 'selfie_matched_photos' field ---
        runner_info = get_runner_info(event_id, bib_number)
        event_details = get_event_info(event_id)
        
        galleries_table.update_item(
            Key={'event_id': event_id, 'bib_number': bib_number},
            UpdateExpression="SET #ismp = :new_photos, #se = :true, #updated = :ts, #rname = :rname, #ename = :ename, #edate = :edate, #org = :org",
            ExpressionAttributeNames={
                '#ismp': 'selfie_matched_photos',
                '#se': 'selfie_enhanced',
                '#updated': 'last_updated',
                '#rname': 'runner_name',
                '#ename': 'event_name',
                '#edate': 'event_date',
                '#org': 'organizer_id'
            },
            ExpressionAttributeValues={
                ':new_photos': newly_found_photos,
                ':true': True,
                ':ts': datetime.utcnow().isoformat(),
                ':rname': runner_info.get('name', 'N/A'),
                ':ename': event_details.get('event_name', 'N/A'),
                ':edate': event_details.get('event_date', 'N/A'),
                ':org': organizer_id
            }
        )
        logger.info(f"Saved {len(newly_found_photos)} new photos to the selfie_matched_photos field for bib {bib_number}.")
        
        # --- Step 8: Return ONLY the newly found photos to the app ---
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'message': f'Success! Found {len(newly_found_photos)} new photos.',
                'selfie_matched_photos': newly_found_photos
            })
        }

    except ClientError as e:
        logger.error(f"A DynamoDB error occurred: {e.response['Error']['Message']}")
        return {'statusCode': 500, 'body': json.dumps('An error occurred while updating the database.')}
    except Exception as e:
        logger.error(f"An unexpected error occurred: {e}")
        return {'statusCode': 500, 'body': json.dumps('Internal server error.')}