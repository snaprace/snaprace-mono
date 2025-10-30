import json
import logging
import os
import re

import boto3
from botocore.exceptions import ClientError

# --- Configuration ---
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(asctime)s:%(message)s')
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# --- Environment Variable Loading & Validation ---
PHOTOS_TABLE_NAME = os.environ.get('PHOTOS_TABLE_NAME')
REKOGNITION_COLLECTION_PREFIX = os.environ.get('REKOGNITION_COLLECTION_PREFIX', 'race-photos')

if not PHOTOS_TABLE_NAME:
    raise RuntimeError("Missing required environment variable: PHOTOS_TABLE_NAME")

# --- AWS Client Initialization ---
dynamodb = boto3.resource('dynamodb')
rekognition_client = boto3.client('rekognition')
table = dynamodb.Table(PHOTOS_TABLE_NAME)

def sanitize_id(input_string: str) -> str:
    """
    Sanitizes a string to be a valid Rekognition ExternalImageId by replacing
    any invalid characters with a double underscore.
    """
    # Replaces any character that is not a letter, number, underscore, dot, or hyphen
    return re.sub(r'[^a-zA-Z0-9_.-]', '__', input_string)

def lambda_handler(event: dict, context) -> dict:
    """
    Triggered by SQS. Indexes all faces from the specified image into a
    dynamically determined Rekognition collection for the specific event.
    """
    batch_item_failures = []

    for record in event['Records']:
        try:
            message_body = json.loads(record['body'])
            # message_body = json.dumps({
            #     'organizer_id': organizer_id,
            #     'event_id': event_id,
            #     'bucket': bucket_name,
            #     'raw_key': raw_image_key,
            #     'sanitized_key': sanitized_image_key,
            #     'bib': confirmed_bib_number
            #  })
            organizer_id = message_body['organizer_id']
            event_id = message_body['event_id']
            bucket_name = message_body['bucket']
            raw_key = message_body['raw_key']
            sanitized_key = message_body['sanitized_key']
            bib_number = message_body.get('bib')

            collection_id = f"{REKOGNITION_COLLECTION_PREFIX}-{organizer_id}-{event_id}"
            
            logger.info(f"Indexing faces for image '{raw_key}' into collection '{collection_id}'")
            
            external_image_id = sanitize_id(sanitized_key)
            
            try:
                # First, try to index the faces
                response = rekognition_client.index_faces(
                    CollectionId=collection_id,
                    Image={'S3Object': {'Bucket': bucket_name, 'Name': raw_key}},
                    ExternalImageId=external_image_id,
                    MaxFaces=5,
                    QualityFilter="NONE",
                    DetectionAttributes=['DEFAULT']
                )
            except ClientError as e:
                # If the collection doesn't exist, create it and retry
                if e.response['Error']['Code'] == 'ResourceNotFoundException':
                    logger.warning(f"Collection '{collection_id}' not found. Creating it now.")
                    rekognition_client.create_collection(CollectionId=collection_id)
                    logger.info(f"Successfully created collection '{collection_id}'. Retrying index operation.")
                    # Retry the index_faces call
                    response = rekognition_client.index_faces(
                        CollectionId=collection_id,
                        Image={'S3Object': {'Bucket': bucket_name, 'Name': raw_key}},
                        ExternalImageId=external_image_id,
                        MaxFaces=5,
                        QualityFilter="AUTO"
                    )
                else:
                    # If it's a different error, re-raise it
                    raise

            face_records = response.get('FaceRecords', [])
            
            if face_records:
                face_ids = [face['Face']['FaceId'] for face in face_records]
                final_status = 'INDEXED_WITH_BIB' if bib_number else 'INDEXED_UNMATCHED'
                
                table.update_item(
                    Key={'image_key': sanitized_key},
                    UpdateExpression="SET #s = :s, #fids = :fids",
                    ExpressionAttributeNames={
                        '#s': 'processing_status',
                        '#fids': 'face_ids'
                    },
                    ExpressionAttributeValues={
                        ':s': final_status,
                        ':fids': set(face_ids)
                    }
                )
                logger.info(f"Successfully indexed {len(face_ids)} faces for '{sanitized_key}'")
            else:
                table.update_item(
                    Key={'image_key': sanitized_key},
                    UpdateExpression="SET #s = :s",
                    ExpressionAttributeNames={'#s': 'processing_status'},
                    ExpressionAttributeValues={':s': 'NO_FACES_DETECTED'}
                )
                logger.warning(f"No faces detected in image '{raw_key}'")

        except Exception as e:
            logger.error(f"Failed to process message {record.get('messageId')}: {e}")
            batch_item_failures.append({'itemIdentifier': record.get('messageId')})
            
    return {'batchItemFailures': batch_item_failures}