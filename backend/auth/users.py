import pg8000.exceptions
from passlib.context import CryptContext
from auth.database import get_connection

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_user(username: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT username, hashed_password FROM users WHERE username = %s", (username,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if row:
        return {"username": row[0], "hashed_password": row[1]}
    return None


def create_user(username: str, password: str):
    conn = get_connection()
    cursor = conn.cursor()
    hashed = pwd_context.hash(password)
    try:
        cursor.execute("INSERT INTO users (username, hashed_password) VALUES (%s, %s)", (username, hashed))
        conn.commit()
        return True
    except pg8000.exceptions.IntegrityError:
        conn.rollback()
        return False  # el usuario ya existe
    finally:
        cursor.close()
        conn.close()


def authenticate_user(username: str, password: str):
    user = get_user(username)
    if not user or not verify_password(password, user["hashed_password"]):
        return None
    return user