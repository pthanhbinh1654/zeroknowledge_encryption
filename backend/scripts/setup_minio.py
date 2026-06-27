#!/usr/bin/env python3
"""
MinIO Setup Script
=================
Initialize MinIO buckets and policies for file storage.
"""

import logging
from minio import Minio
from minio.error import S3Error
import json

from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_minio_client():
    """Create MinIO client"""
    try:
        client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_USE_SSL
        )
        
        # Test connection
        client.list_buckets()
        logger.info("MinIO connection successful")
        return client
        
    except Exception as e:
        logger.error(f"Failed to connect to MinIO: {e}")
        raise

def create_buckets(client):
    """Create required buckets"""
    logger.info("Creating MinIO buckets...")
    
    buckets = [
        settings.MINIO_BUCKET_NAME,
        f"{settings.MINIO_BUCKET_NAME}-chunks",
        f"{settings.MINIO_BUCKET_NAME}-temp"
    ]
    
    for bucket_name in buckets:
        try:
            if not client.bucket_exists(bucket_name):
                client.make_bucket(bucket_name)
                logger.info(f"Created bucket: {bucket_name}")
            else:
                logger.info(f"Bucket already exists: {bucket_name}")
                
        except S3Error as e:
            logger.error(f"Error creating bucket {bucket_name}: {e}")
            raise

def set_bucket_policies(client):
    """Set bucket policies for security"""
    logger.info("Setting bucket policies...")
    
    # Main bucket policy - private access only
    main_bucket_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Deny",
                "Principal": "*",
                "Action": "s3:*",
                "Resource": [
                    f"arn:aws:s3:::{settings.MINIO_BUCKET_NAME}",
                    f"arn:aws:s3:::{settings.MINIO_BUCKET_NAME}/*"
                ],
                "Condition": {
                    "StringNotEquals": {
                        "aws:PrincipalType": "User"
                    }
                }
            }
        ]
    }
    
    # Chunks bucket policy - private access only
    chunks_bucket_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Deny",
                "Principal": "*",
                "Action": "s3:*",
                "Resource": [
                    f"arn:aws:s3:::{settings.MINIO_BUCKET_NAME}-chunks",
                    f"arn:aws:s3:::{settings.MINIO_BUCKET_NAME}-chunks/*"
                ],
                "Condition": {
                    "StringNotEquals": {
                        "aws:PrincipalType": "User"
                    }
                }
            }
        ]
    }
    
    # Temp bucket policy - private with lifecycle
    temp_bucket_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Deny",
                "Principal": "*",
                "Action": "s3:*",
                "Resource": [
                    f"arn:aws:s3:::{settings.MINIO_BUCKET_NAME}-temp",
                    f"arn:aws:s3:::{settings.MINIO_BUCKET_NAME}-temp/*"
                ],
                "Condition": {
                    "StringNotEquals": {
                        "aws:PrincipalType": "User"
                    }
                }
            }
        ]
    }
    
    policies = [
        (settings.MINIO_BUCKET_NAME, main_bucket_policy),
        (f"{settings.MINIO_BUCKET_NAME}-chunks", chunks_bucket_policy),
        (f"{settings.MINIO_BUCKET_NAME}-temp", temp_bucket_policy)
    ]
    
    for bucket_name, policy in policies:
        try:
            client.set_bucket_policy(bucket_name, json.dumps(policy))
            logger.info(f"Set policy for bucket: {bucket_name}")
        except S3Error as e:
            logger.warning(f"Could not set policy for bucket {bucket_name}: {e}")
            # Continue anyway as policies might not be supported in all MinIO setups

def set_bucket_lifecycle(client):
    """Set lifecycle policies for automatic cleanup"""
    logger.info("Setting bucket lifecycle policies...")
    
    from minio.lifecycleconfig import LifecycleConfig, Rule, Expiration
    
    try:
        # Temp bucket - delete objects after 1 day
        temp_lifecycle = LifecycleConfig([
            Rule(
                rule_id="temp-cleanup",
                status="Enabled",
                expiration=Expiration(days=1)
            )
        ])
        
        client.set_bucket_lifecycle(f"{settings.MINIO_BUCKET_NAME}-temp", temp_lifecycle)
        logger.info(f"Set lifecycle policy for temp bucket")
        
    except Exception as e:
        logger.warning(f"Could not set lifecycle policy: {e}")
        # Continue anyway as lifecycle might not be supported

def create_test_objects(client):
    """Create test objects to verify setup"""
    logger.info("Creating test objects...")
    
    test_content = b"Zero Knowledge Encryption System - Test Object"
    
    try:
        # Test main bucket
        client.put_object(
            settings.MINIO_BUCKET_NAME,
            "test/setup-test.txt",
            data=test_content,
            length=len(test_content),
            content_type="text/plain"
        )
        
        # Verify object exists
        obj = client.get_object(settings.MINIO_BUCKET_NAME, "test/setup-test.txt")
        if obj.read() == test_content:
            logger.info("Test object created and verified successfully")
        else:
            logger.error("Test object verification failed")
            
        # Clean up test object
        client.remove_object(settings.MINIO_BUCKET_NAME, "test/setup-test.txt")
        logger.info("Test object cleaned up")
        
    except S3Error as e:
        logger.error(f"Error creating test object: {e}")
        raise

def setup_minio():
    """Main MinIO setup function"""
    logger.info("Starting MinIO setup...")
    
    try:
        # Create client
        client = create_minio_client()
        
        # Create buckets
        create_buckets(client)
        
        # Set policies
        set_bucket_policies(client)
        
        # Set lifecycle policies
        set_bucket_lifecycle(client)
        
        # Test setup
        create_test_objects(client)
        
        logger.info("MinIO setup completed successfully!")
        
        # Print summary
        logger.info("MinIO Configuration Summary:")
        logger.info(f"  Endpoint: {settings.MINIO_ENDPOINT}")
        logger.info(f"  Main Bucket: {settings.MINIO_BUCKET_NAME}")
        logger.info(f"  Chunks Bucket: {settings.MINIO_BUCKET_NAME}-chunks")
        logger.info(f"  Temp Bucket: {settings.MINIO_BUCKET_NAME}-temp")
        logger.info(f"  SSL Enabled: {settings.MINIO_USE_SSL}")
        
    except Exception as e:
        logger.error(f"MinIO setup failed: {e}")
        raise

def main():
    """Main entry point"""
    try:
        setup_minio()
    except Exception as e:
        logger.error(f"Setup failed: {e}")
        exit(1)

if __name__ == "__main__":
    main()
