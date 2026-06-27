# app/database.py
# Kết nối MongoDB bằng pymongo (đồng bộ) để tương thích

from pymongo import MongoClient
from app.core.config import settings
import logging

# Cài đặt logging
logger = logging.getLogger(__name__)

# Biến toàn cục client
_client = None
_database = None

def get_client():
    """Lấy MongoDB client với connection pooling"""
    global _client
    if _client is None:
        try:
            _client = MongoClient(
                settings.DATABASE_URL,
                maxPoolSize=10,  # Số kết nối tối đa trong pool
                minPoolSize=1,   # Số kết nối tối thiểu trong pool
                maxIdleTimeMS=30000,  # Thời gian chờ kết nối rỗi trước khi đóng
                serverSelectionTimeoutMS=5000  # Thời gian chờ việc chọn server
            )
            # Kiểm tra kết nối
            _client.admin.command('ping')
            logger.info("Kết nối MongoDB thành công")
        except Exception as e:
            logger.error(f"Lỗi kết nối MongoDB: {e}")
            raise
    return _client

def get_database():
    """Lấy đối tượng database"""
    global _database
    if _database is None:
        try:
            client = get_client()
            _database = client[settings.DATABASE_NAME]
            logger.info(f"Sử dụng database: {settings.DATABASE_NAME}")
        except Exception as e:
            logger.error(f"Lỗi lấy database: {e}")
            raise
    return _database

def close_connection():
    """Đóng kết nối MongoDB"""
    global _client, _database
    if _client:
        _client.close()
        _client = None
        _database = None
        logger.info("Đã đóng kết nối MongoDB")

# Đối tượng Database để truy cập dễ dàng
class Database:
    """Lớp bọc database để truy cập collection dễ dàng"""
    _db = None
    
    @classmethod
    def get_db(cls):
        """Lấy database instance"""
        if cls._db is None:
            cls._db = get_database()
        return cls._db
    
    @classmethod
    def get_collection(cls, collection_name: str):
        """Lấy collection"""
        if cls._db is None:
            cls._db = get_database()
        return cls._db[collection_name]

# Đối tượng toàn cục
db = Database()
