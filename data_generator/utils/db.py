import os
from typing import Optional
from dotenv import load_dotenv
import psycopg2
from psycopg2.extensions import connection

# Load environment variables
load_dotenv()

def get_db_connection(database_url: Optional[str] = None) -> connection:
    """
    Creates and returns a psycopg2 database connection.
    Uses the provided database_url or reads DATABASE_URL from environment variables.
    """
    url = database_url or os.getenv("DATABASE_URL")
    if not url:
        raise ValueError(
            "DATABASE_URL is not set. Please specify DATABASE_URL in data_generator/.env or your environment."
        )
    return psycopg2.connect(url)
