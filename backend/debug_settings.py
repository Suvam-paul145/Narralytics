import sys
sys.path.append('.')
from config import settings
print(f"GOOGLE_CLIENT_ID: '{settings.GOOGLE_CLIENT_ID}'")
print(f"GOOGLE_CLIENT_SECRET: '{'SET' if settings.GOOGLE_CLIENT_SECRET else 'NOT SET'}'")
print(f"REDIRECT_URI: '{settings.REDIRECT_URI}'")
