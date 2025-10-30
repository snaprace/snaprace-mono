import json
import logging
import os
from datetime import datetime
from collections import defaultdict
import urllib.parse

import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Attr

# --- Configuration ---
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(asctime)s:%(message)s')
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# --- Environment Variable Loading & Validation ---
PHOTOS_TABLE_NAME = os.environ.get('PHOTOS_TABLE_NAME')
RUNNERS_TABLE_NAME = os.environ.get('RUNNERS_TABLE_NAME')
GALLERIES_TABLE_NAME = os.environ.get('GALLERIES_TABLE_NAME')
CLOUDFRONT_DOMAIN_NAME = os.environ.get('CLOUDFRONT_DOMAIN_NAME')
EVENTS_TABLE_NAME = os.environ.get('EVENTS_TABLE_NAME')

if not all([PHOTOS_TABLE_NAME, RUNNERS_TABLE_NAME, GALLERIES_TABLE_NAME, CLOUDFRONT_DOMAIN_NAME]):
    raise RuntimeError("Missing required env vars: PHOTOS_TABLE_NAME, RUNNERS_TABLE_NAME, GALLERIES_TABLE_NAME, CLOUDFRONT_DOMAIN_NAME")

# --- AWS Client Initialization ---
dynamodb = boto3.resource('dynamodb')
photos_table = dynamodb.Table(PHOTOS_TABLE_NAME)
runners_table = dynamodb.Table(RUNNERS_TABLE_NAME)
galleries_table = dynamodb.Table(GALLERIES_TABLE_NAME)
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


def lambda_handler(event: dict, context) -> dict:
    """
    Optimized: Scans the Photos table only ONCE to efficiently generate all galleries for a specific event.
    """
    organizer_id = event.get('organizer_id')
    event_id = event.get('event_id')

    if not all([organizer_id, event_id]):
        raise ValueError("organizer_id and event_id must be provided in the event payload.")
        
    logger.info(f"Generating galleries for event: {organizer_id}/{event_id}")

    event_details = get_event_info(event_id)
    if not event_details:
        logger.error(f"Could not find event details for event_id: {event_id}. Aborting.")
        return {'statusCode': 404, 'body': json.dumps(f'Event not found: {event_id}')}

    # Use defaultdict to easily build a set of images for each bib
    galleries_in_progress = defaultdict(lambda: {'images': set()})
    
    paginator = dynamodb.meta.client.get_paginator('scan')
    
    try:
        # --- STEP 1: Scan the Photos table a single time ---
        logger.info(f"Starting single-pass scan of the Photos table for event '{event_id}'...")
        filter_expression = Attr('organizer_id').eq(organizer_id) & Attr('event_id').eq(event_id)
        
        pages = paginator.paginate(
            TableName=PHOTOS_TABLE_NAME,
            FilterExpression=filter_expression,
            ProjectionExpression='raw_s3_key, s3_bucket, bib_number, detected_bibs'
        )
        
        for page in pages:
            for item in page.get('Items', []):
                raw_key = item['raw_s3_key']
                s3_uri = f"https://{CLOUDFRONT_DOMAIN_NAME}/{urllib.parse.quote(raw_key)}"
                
                # Create a set of all bibs associated with this one photo
                all_associated_bibs = set(item.get('detected_bibs', []))
                confirmed_bib = item.get('bib_number')
                if confirmed_bib and confirmed_bib != 'NONE':
                    all_associated_bibs.add(confirmed_bib)
                
                # Add this photo's URI to the gallery for every associated bib
                for bib in all_associated_bibs:
                    galleries_in_progress[bib]['images'].add(s3_uri)

        logger.info(f"Scan complete. Found photos for {len(galleries_in_progress)} unique bibs.")

        # --- STEP 2: Enrich with runner info and save to the Galleries table ---
        if galleries_in_progress:
            with galleries_table.batch_writer() as batch:
                # Iterate through the galleries we built in memory
                for bib_number, gallery_data in galleries_in_progress.items():
                    runner_info = get_runner_info(event_id, bib_number)
                    
                    sorted_photo_uris = sorted(list(gallery_data['images']))
                    
                    item_to_save = {
                        'event_id': event_id,
                        'bib_number': bib_number,
                        'organizer_id': organizer_id,
                        'runner_name': runner_info.get('name', f'Runner {bib_number}'),
                        'event_name': event_details.get('event_name', 'N/A'),
                        'event_date': event_details.get('event_date', 'N/A'),
                        'bib_matched_photos': sorted_photo_uris,
                        'selfie_matched_photos': [],
                        'selfie_enhanced': False,
                        'last_updated': datetime.utcnow().isoformat()
                    }
                    batch.put_item(Item=item_to_save)
            logger.info(f"✅ Successfully saved {len(galleries_in_progress)} galleries to the '{GALLERIES_TABLE_NAME}' table.")

    except ClientError as e:
        logger.error(f"An error occurred during gallery generation: {e}")
            
    logger.info("--- Gallery generation complete. ---")
    
    return {
        'statusCode': 200,
        'body': json.dumps('Galleries generated successfully.')
    }