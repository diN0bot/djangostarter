# Default Django settings for sqlite3 development

DOMAIN = "localhost:8000"

DEBUG = True
DEBUG_SQL = True
DJANGO_SERVER = True
DEBUG_TOOLBAR = False

# Make this unique, and don't share it with anybody.                                                                                                           
SECRET_KEY = 'oez0xk+-u34bcyd!+z0w=79mc^_tf9zm05nm9ia9)zps2s56a2'

DATABASE_ENGINE = 'sqlite3'
DATABASE_NAME = DB_PATH+path("databases/hm_dev.db")
DATABASE_USER = ''             # Not used with sqlite3.
DATABASE_PASSWORD = ''         # Not used with sqlite3.
DATABASE_HOST = ''             # Set to empty string for localhost. Not used with sqlite3.
DATABASE_PORT = ''             # Set to empty string for default. Not used with sqlite3.
