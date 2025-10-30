import json
import logging
import os
from typing import Dict, Set

import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Attr

# --- Configuration ---
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(asctime)s:%(message)s')
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# --- Environment Variable Loading & Validation ---
PHOTOS_TABLE_NAME = os.environ.get('PHOTOS_TABLE_NAME')
REKOGNITION_COLLECTION_PREFIX = os.environ.get('REKOGNITION_COLLECTION_PREFIX', 'race-photos')
FACE_SIMILARITY_THRESHOLD = float(os.environ.get('FACE_SIMILARITY_THRESHOLD'))
HIGH_CONFIDENCE_THRESHOLD = float(os.environ.get('HIGH_CONFIDENCE_THRESHOLD'))

if not PHOTOS_TABLE_NAME:
    raise RuntimeError("Missing required environment variable: PHOTOS_TABLE_NAME")

# --- AWS Client Initialization ---
dynamodb = boto3.resource('dynamodb')
rekognition_client = boto3.client('rekognition')
photo_table = dynamodb.Table(PHOTOS_TABLE_NAME)

def get_all_photo_data(organizer_id: str, event_id: str) -> Dict[str, Dict]:
    """
    Scans the Photos table for a specific event to get the current state of all its photos.
    """
    all_photos = {}
    last_evaluated_key = None
    
    filter_expression = Attr('organizer_id').eq(organizer_id) & Attr('event_id').eq(event_id)
    
    while True:
        scan_args = {
            'FilterExpression': filter_expression,
            'ProjectionExpression': 'image_key, bib_number, processing_status, detected_bibs, face_ids'
        }
        if last_evaluated_key:
            scan_args['ExclusiveStartKey'] = last_evaluated_key
            
        response = photo_table.scan(**scan_args)
        
        for item in response.get('Items', []):
            all_photos[item['image_key']] = {
                'bib_number': item.get('bib_number', 'NONE'),
                'status': item.get('processing_status'),
                'detected_bibs': set(item.get('detected_bibs', [])),
                'face_ids': set(item.get('face_ids', []))
            }
                
        last_evaluated_key = response.get('LastEvaluatedKey')
        if not last_evaluated_key:
            break
            
    logger.info(f"Loaded data for {len(all_photos)} photos for event '{organizer_id}/{event_id}'.")
    return all_photos


def lambda_handler(event: dict, context) -> dict:
    # Example input: {"organizer_id": "millennium-running", "event_id": "white-mountain-2025"}
    organizer_id = event.get('organizer_id')
    event_id = event.get('event_id')

    if not all([organizer_id, event_id]):
        raise ValueError("organizer_id and event_id must be provided in the event payload.")
        
    collection_id = f"{REKOGNITION_COLLECTION_PREFIX}-{organizer_id}-{event_id}"
    logger.info(f"Processing photos for collection: {collection_id}")

    all_photos = get_all_photo_data(organizer_id, event_id)
    
    # --- STAGE 1: Build Initial Ground Truth & Reference Face Maps ---
    face_to_bib_map = {}
    bib_to_ref_face_map = {}
    for key, data in all_photos.items():
        bib_num = data.get('bib_number')
        if bib_num and bib_num != 'NONE':
            if bib_num not in bib_to_ref_face_map and data['face_ids']:
                bib_to_ref_face_map[bib_num] = list(data['face_ids'])[0]
            for face_id in data['face_ids']:
                face_to_bib_map[face_id] = bib_num
    
    logger.info(f"Initialized ground truth with {len(face_to_bib_map)} faces across {len(bib_to_ref_face_map)} bibs.")

    # --- STAGE 2: Direct Linking with AWS Rekognition SearchFaces ---
    direct_links_found = 0
    links_corrected = 0
    for bib_number, ref_face_id in bib_to_ref_face_map.items():
        logger.info(f"Searching for faces matching bib {bib_number}...")
        try:
            response = rekognition_client.search_faces(
                CollectionId=collection_id,
                FaceId=ref_face_id,
                FaceMatchThreshold=FACE_SIMILARITY_THRESHOLD,
                MaxFaces=25
            )
            for match in response.get('FaceMatches', []):
                matched_key = match['Face'].get('ExternalImageId')
                
                photo_data = all_photos[matched_key]
                similarity = match['Similarity']
                current_bib = photo_data.get('bib_number')
                
                should_link = False
                update_status = None

                if similarity >= HIGH_CONFIDENCE_THRESHOLD:
                    if current_bib != bib_number:
                        should_link = True
                        update_status = 'CORRECTED_BY_FACE' if current_bib != 'NONE' else 'LINKED_BY_FACE'
                
                elif current_bib == 'NONE' and bib_number in photo_data['detected_bibs']:
                    should_link = True
                    update_status = 'LINKED_BY_FACE'

                if should_link:
                    logger.info(
                        f"Updating photo {matched_key} to bib {bib_number}. "
                        f"Reason: {update_status}, Similarity: {similarity:.2f}%, Previous Bib: {current_bib}"
                    )
                    
                    photo_table.update_item(
                        Key={'image_key': matched_key},
                        UpdateExpression="SET #b = :b, #s = :s",
                        ExpressionAttributeNames={'#b': 'bib_number', '#s': 'processing_status'},
                        ExpressionAttributeValues={':b': bib_number, ':s': update_status}
                    )
                    
                    if current_bib != 'NONE' and current_bib != bib_number:
                        links_corrected += 1
                    else:
                        direct_links_found += 1
                        
                    all_photos[matched_key]['bib_number'] = bib_number
                    for face_id in photo_data['face_ids']:
                        face_to_bib_map[face_id] = bib_number
        except ClientError as e:
            logger.error(f"SearchFaces failed for bib {bib_number}: {e}")

    logger.info(f"Direct face linking found {direct_links_found} new links and corrected {links_corrected} existing links.")

    # --- STAGE 3: Final Reconciliation Pass ---
    logger.info("--- Starting final reconciliation pass to correct mismatches ---")
    stage3_corrections = 0
    for image_key, photo_data in all_photos.items():
        current_bib = photo_data['bib_number']
        if current_bib == 'NONE':
            continue

        bibs_from_faces = {face_to_bib_map[fid] for fid in photo_data['face_ids'] if fid in face_to_bib_map}
        
        if bibs_from_faces and bibs_from_faces != {current_bib}:
            if len(bibs_from_faces) == 1:
                corrected_bib = bibs_from_faces.pop()
                logger.warning(
                    f"MISMATCH FOUND (Stage 3)! Photo {image_key} is assigned to bib {current_bib}, "
                    f"but its faces strongly belong to bib {corrected_bib}. Correcting now."
                )
                try:
                    photo_table.update_item(
                        Key={'image_key': image_key},
                        UpdateExpression="SET #b = :b, #s = :s",
                        ExpressionAttributeNames={'#b': 'bib_number', '#s': 'processing_status'},
                        ExpressionAttributeValues={':b': corrected_bib, ':s': 'CORRECTED_BY_RECONCILIATION'}
                    )
                    all_photos[image_key]['bib_number'] = corrected_bib # Update in-memory state
                    stage3_corrections += 1
                except ClientError as e:
                    logger.error(f"Failed to correct mismatch for {image_key}: {e}")
            else:
                 logger.warning(
                    f"Complex mismatch found for photo {image_key}. Assigned to bib {current_bib}, "
                    f"but faces suggest multiple bibs: {bibs_from_faces}. Leaving as is for Stage 4 cleanup."
                )
    
    logger.info(f"--- Reconciliation complete. Made {stage3_corrections} corrections. ---")

    # --- STAGE 4: Imposter Face Cleanup ---
    logger.info("--- Starting imposter face cleanup for group photos ---")
    imposter_photos_unlinked = 0

    bib_to_all_faces = {}
    for photo in all_photos.values():
        bib = photo['bib_number']
        if bib != 'NONE':
            if bib not in bib_to_all_faces:
                bib_to_all_faces[bib] = set()
            bib_to_all_faces[bib].update(photo['face_ids'])

    face_to_bib_ocr_count = {}
    original_photo_data = get_all_photo_data(organizer_id, event_id)
    for photo in original_photo_data.values():
        detected_bibs = photo['detected_bibs']
        for face_id in photo['face_ids']:
            if face_id not in face_to_bib_ocr_count:
                face_to_bib_ocr_count[face_id] = {}
            for bib in detected_bibs:
                face_to_bib_ocr_count[face_id][bib] = face_to_bib_ocr_count[face_id].get(bib, 0) + 1
    
    for bib, faces in bib_to_all_faces.items():
        if len(faces) <= 1:
            continue

        primary_face = None
        max_score = -1
        for face_id in faces:
            score = face_to_bib_ocr_count.get(face_id, {}).get(bib, 0)
            if score > max_score:
                max_score = score
                primary_face = face_id
        
        # --- START: FIXED LOGIC ---
        # If the highest score is less than 2, the evidence is too weak to be certain.
        # This prevents incorrect unlinking in 1-vs-1 tie scenarios based on bad OCR.
        if max_score < 2:
            logger.warning(
                f"Skipping imposter cleanup for bib {bib}: evidence from OCR is inconclusive (max score: {max_score}). "
                f"Could not reliably determine primary face among {faces}."
            )
            continue # Skip to the next bib
        # --- END: FIXED LOGIC ---
            
        if not primary_face:
            logger.warning(f"Could not determine a primary face for bib {bib} among {faces}. Skipping cleanup.")
            continue
            
        imposter_faces = faces - {primary_face}
        logger.info(f"Auditing bib {bib}. Primary face: {primary_face} (Score: {max_score}). Potential imposters: {imposter_faces}.")

        for image_key, photo_data in all_photos.items():
            if photo_data['bib_number'] == bib:
                photo_faces = photo_data['face_ids']
                
                if imposter_faces.intersection(photo_faces) and primary_face not in photo_faces:
                    logger.warning(
                        f"IMPOSTER DETECTED! Unlinking photo {image_key} from bib {bib}. "
                        f"It contains imposter face(s) {photo_faces.intersection(imposter_faces)} "
                        f"but not primary face {primary_face}."
                    )
                    try:
                        photo_table.update_item(
                            Key={'image_key': image_key},
                            UpdateExpression="SET #b = :b, #s = :s",
                            ExpressionAttributeNames={'#b': 'bib_number', '#s': 'processing_status'},
                            ExpressionAttributeValues={':b': 'NONE', ':s': 'UNLINKED_IMPOSTER'}
                        )
                        imposter_photos_unlinked += 1
                    except ClientError as e:
                        logger.error(f"Failed to unlink imposter photo {image_key}: {e}")
    
    logger.info(f"--- Imposter cleanup complete. Unlinked {imposter_photos_unlinked} photos. ---")
    
    total_new_links = direct_links_found + links_corrected
    total_corrections = stage3_corrections
    
    return {
        'statusCode': 200,
        'body': json.dumps(
            f'Process complete. New Links: {total_new_links}. '
            f'Stage3 Corrections: {total_corrections}. '
            f'Imposter Photos Unlinked: {imposter_photos_unlinked}.'
        )
    }