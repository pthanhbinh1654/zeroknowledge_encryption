#!/usr/bin/env python3
"""
Database Setup Script
====================
Initialize MongoDB database with required collections and indexes.
"""

import asyncio
import logging
from datetime import datetime
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import CollectionInvalid

from app.core.config import settings
from app.database import get_database

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_indexes():
    """Create database indexes for optimal performance"""
    logger.info("Creating database indexes...")
    
    try:
        db = get_database()
        
        # Users collection indexes
        logger.info("Creating indexes for users collection...")
        db.users.create_index([("email", ASCENDING)], unique=True)
        db.users.create_index([("username", ASCENDING)], unique=True)
        db.users.create_index([("created_at", DESCENDING)])
        db.users.create_index([("is_active", ASCENDING)])
        
        # Encrypted files collection indexes
        logger.info("Creating indexes for encrypted_files collection...")
        db.encrypted_files.create_index([("user_id", ASCENDING)])
        db.encrypted_files.create_index([("filename", ASCENDING)])
        db.encrypted_files.create_index([("uploaded_at", DESCENDING)])
        db.encrypted_files.create_index([("algorithm", ASCENDING)])
        db.encrypted_files.create_index([("file_type", ASCENDING)])
        db.encrypted_files.create_index([("user_id", ASCENDING), ("uploaded_at", DESCENDING)])
        db.encrypted_files.create_index([("user_id", ASCENDING), ("filename", ASCENDING)])
        
        # Security events collection indexes
        logger.info("Creating indexes for security_events collection...")
        db.security_events.create_index([("user_id", ASCENDING)])
        db.security_events.create_index([("event_type", ASCENDING)])
        db.security_events.create_index([("timestamp", DESCENDING)])
        db.security_events.create_index([("severity", ASCENDING)])
        db.security_events.create_index([("status", ASCENDING)])
        db.security_events.create_index([("ip_address", ASCENDING)])
        db.security_events.create_index([("user_id", ASCENDING), ("timestamp", DESCENDING)])
        db.security_events.create_index([("user_id", ASCENDING), ("event_type", ASCENDING)])
        
        # Sessions collection indexes
        logger.info("Creating indexes for sessions collection...")
        db.sessions.create_index([("user_id", ASCENDING)])
        db.sessions.create_index([("session_id", ASCENDING)], unique=True)
        db.sessions.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
        db.sessions.create_index([("created_at", DESCENDING)])
        
        # OTP codes collection indexes
        logger.info("Creating indexes for otp_codes collection...")
        db.otp_codes.create_index([("user_id", ASCENDING)])
        db.otp_codes.create_index([("code", ASCENDING)])
        db.otp_codes.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
        db.otp_codes.create_index([("created_at", DESCENDING)])
        
        # File chunks collection indexes (for large files)
        logger.info("Creating indexes for file_chunks collection...")
        db.file_chunks.create_index([("file_id", ASCENDING)])
        db.file_chunks.create_index([("chunk_index", ASCENDING)])
        db.file_chunks.create_index([("file_id", ASCENDING), ("chunk_index", ASCENDING)], unique=True)
        
        logger.info("All indexes created successfully")
        
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")
        raise

def create_collections():
    """Create required collections with validation"""
    logger.info("Creating database collections...")
    
    try:
        db = get_database()
        
        # Users collection with validation
        try:
            db.create_collection("users", validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["username", "email", "hashed_password", "created_at"],
                    "properties": {
                        "username": {"bsonType": "string", "minLength": 3, "maxLength": 50},
                        "email": {"bsonType": "string", "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"},
                        "hashed_password": {"bsonType": "string"},
                        "is_active": {"bsonType": "bool"},
                        "is_verified": {"bsonType": "bool"},
                        "created_at": {"bsonType": "date"},
                        "updated_at": {"bsonType": "date"}
                    }
                }
            })
            logger.info("Created users collection")
        except CollectionInvalid:
            logger.info("Users collection already exists")
        
        # Encrypted files collection
        try:
            db.create_collection("encrypted_files", validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["user_id", "filename", "file_path", "algorithm", "uploaded_at"],
                    "properties": {
                        "user_id": {"bsonType": "objectId"},
                        "filename": {"bsonType": "string"},
                        "file_path": {"bsonType": "string"},
                        "algorithm": {"bsonType": "string"},
                        "original_size": {"bsonType": "long"},
                        "encrypted_size": {"bsonType": "long"},
                        "file_type": {"bsonType": "string"},
                        "uploaded_at": {"bsonType": "date"}
                    }
                }
            })
            logger.info("Created encrypted_files collection")
        except CollectionInvalid:
            logger.info("Encrypted files collection already exists")
        
        # Security events collection
        try:
            db.create_collection("security_events", validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["user_id", "event_type", "timestamp"],
                    "properties": {
                        "user_id": {"bsonType": "objectId"},
                        "event_type": {"bsonType": "string"},
                        "ip_address": {"bsonType": "string"},
                        "user_agent": {"bsonType": "string"},
                        "timestamp": {"bsonType": "date"},
                        "severity": {"bsonType": "string", "enum": ["low", "medium", "high", "critical"]},
                        "status": {"bsonType": "string", "enum": ["success", "failed", "blocked"]}
                    }
                }
            })
            logger.info("Created security_events collection")
        except CollectionInvalid:
            logger.info("Security events collection already exists")
        
        # Sessions collection
        try:
            db.create_collection("sessions")
            logger.info("Created sessions collection")
        except CollectionInvalid:
            logger.info("Sessions collection already exists")
        
        # OTP codes collection
        try:
            db.create_collection("otp_codes")
            logger.info("Created otp_codes collection")
        except CollectionInvalid:
            logger.info("OTP codes collection already exists")
        
        # File chunks collection
        try:
            db.create_collection("file_chunks")
            logger.info("Created file_chunks collection")
        except CollectionInvalid:
            logger.info("File chunks collection already exists")
        
        logger.info("All collections created successfully")
        
    except Exception as e:
        logger.error(f"Error creating collections: {e}")
        raise

def create_admin_user():
    """Create default admin user if it doesn't exist"""
    logger.info("Checking for admin user...")
    
    try:
        db = get_database()
        
        # Check if admin user exists
        admin_user = db.users.find_one({"email": "admin@example.com"})
        
        if not admin_user:
            logger.info("Creating default admin user...")
            
            from app.core.security import get_password_hash
            
            admin_data = {
                "username": "admin",
                "email": "admin@example.com",
                "hashed_password": get_password_hash("admin123"),
                "is_active": True,
                "is_verified": True,
                "is_admin": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            result = db.users.insert_one(admin_data)
            logger.info(f"Admin user created with ID: {result.inserted_id}")
            logger.warning("Default admin credentials: admin@example.com / admin123")
            logger.warning("Please change the admin password after first login!")
        else:
            logger.info("Admin user already exists")
            
    except Exception as e:
        logger.error(f"Error creating admin user: {e}")
        raise

def setup_database():
    """Main database setup function"""
    logger.info("Starting database setup...")
    
    try:
        # Test database connection
        db = get_database()
        db.command("ping")
        logger.info("Database connection successful")
        
        # Create collections
        create_collections()
        
        # Create indexes
        create_indexes()
        
        # Create admin user
        create_admin_user()
        
        logger.info("Database setup completed successfully!")
        
    except Exception as e:
        logger.error(f"Database setup failed: {e}")
        raise

def main():
    """Main entry point"""
    try:
        setup_database()
    except Exception as e:
        logger.error(f"Setup failed: {e}")
        exit(1)

if __name__ == "__main__":
    main()
