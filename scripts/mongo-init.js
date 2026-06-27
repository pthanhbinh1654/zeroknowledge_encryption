// MongoDB Initialization Script
// This script runs automatically when the MongoDB container starts for the first time.
// It creates the application database and a dedicated user.

db = db.getSiblingDB('zero_knowledge_encryption');

// Create indexes for performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ created_at: 1 });

db.encrypted_files.createIndex({ user_id: 1 });
db.encrypted_files.createIndex({ created_at: -1 });

db.activity_logs.createIndex({ user_id: 1, created_at: -1 });
db.activity_logs.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL

db.otp_codes.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }); // Auto-expire

print('MongoDB initialized: indexes created successfully.');
