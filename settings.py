# Global Django settings for BILUMI project
# For help setting up local settings, see the dev-flock wiki:
#     http://bilumi.org/trac/wiki/FAQ#Projectsetupoptional

import os
def path(p):
    """
    @param p: path with *nix path separator
    @return: string with os-specific path separator
    """
    return os.sep.join(p.split("/"))

def pathify(lst, file_extension=False):
    """
    @param lst: list of path components
    @return: string with os-specific path separator between components 
    """
    if file_extension:
        return os.sep.join([el != lst[-1] and el.replace('.', os.sep) or el for el in lst])
    else:
        return os.sep.join([el.replace('.', os.sep) for el in lst])

import sys
if not sys.stdout:
    # fail on windows?
    #sys.stdout = file(path('/dev/null'),"w")
    sys.stdout = file(path('/var/log/apache2/whynoti.org/stdout.log'),"a")

PROJECT_PATH = os.path.dirname(os.path.realpath(__file__))

DEBUG = False # True for general debug mode, eg, will display debug info rather than 404 or 500
DJANGO_SERVER = False # True if using django's runserver
TEMPLATE_DEBUG = DEBUG # Template exceptions won't crash rendering, plus mroe useful exception message is shown in console.
DEBUG_SQL = DEBUG # not sure
DEBUG_TOOLBAR = False # True to show debug toolbar at top of page
DEBUG_PROPAGATE_EXCEPTIONS = DEBUG # For twill tests

ADMINS = (
    ('y0i', 'y0i@whynoti.org'),
)
MANAGERS = ADMINS

APPS = ('twitter', 'twitter.imager', 'twitter.procrasdonate') #'user_profile', 'challenge', 'textful', 'vote')

# Local time zone for this installation. Choices can be found here:
# http://www.postgresql.org/docs/8.1/static/datetime-keywords.html#DATETIME-TIMEZONE-SET-TABLE
# although not all variations may be possible on all operating systems.
# If running in a Windows environment this must be set to the same as your
# system time zone.
TIME_ZONE = 'America/New_York'

# Language code for this installation. All choices can be found here:
# http://www.w3.org/TR/REC-html40/struct/dirlang.html#langcodes
# http://blogs.law.harvard.edu/tech/stories/storyReader$15
LANGUAGE_CODE = 'en-us'

SITE_ID = 1

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = True

ROOT_URLCONF = 'root_urls'

DOWN_FOR_MAINTENANCE = False

# check this out: http://www.djangosnippets.org/snippets/1068/

# Absolute path to the directory that holds media.
# including upload image directory
# Example: "/home/media/media.lawrence.com/"
MEDIA_ROOT = pathify([PROJECT_PATH, path('media/')])

####### if override BASE_URL, may also want to override MEDIA_URL ###########
BASE_URL = 'Starter'

####### if override MEDIA_URL, may also want to override BASE_URL ###########
# URL that handles the media served from MEDIA_ROOT.
# Example: "http://media.lawrence.com"
MEDIA_URL = '/%s/media/' % BASE_URL

# Number of days a user has at most to activate his/her account.
ACCOUNT_ACTIVATION_DAYS = 10

# Make this unique, and don't share it with anybody.
SECRET_KEY = 'somethingsekret'

# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
    'django.template.loaders.filesystem.load_template_source',
    'django.template.loaders.app_directories.load_template_source',
)

MIDDLEWARE_CLASSES = (
    'django.middleware.doc.XViewMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'lib.pagination.middleware.PaginationMiddleware',
    #'django.contrib.csrf.middleware.CsrfMiddleware',
)
for app in APPS:
    if os.path.exists(pathify([PROJECT_PATH, app, 'middleware.py'], file_extension=True)):
        MIDDLEWARE_CLASSES += (
            '%s.middleware.%sMiddleware' % (app, app.capitalize()),
        )

if DEBUG_TOOLBAR:
    MIDDLEWARE_CLASSES += (
        'debug_toolbar.middleware.DebugToolbarMiddleware',
    )
        
TEMPLATE_DIRS = ()

for app in APPS:
    if os.path.exists(pathify([PROJECT_PATH, app, 'templates'])):
        TEMPLATE_DIRS += (
            pathify([PROJECT_PATH, path('%s/templates' % app)]),
        )

INSTALLED_APPS = (
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.sites',
    'django.contrib.humanize',
    'lib.pagination',
    'django.contrib.auth',
    'django.contrib.admindocs',
    'django.contrib.admin',
    'django_evolution',
)

for app in APPS:
    INSTALLED_APPS += (
        app,
    )

USE_MARKUP = True # TODO text ful app should set this?
if USE_MARKUP:
    INSTALLED_APPS += ('django.contrib.markup',)

if DEBUG_TOOLBAR:
    INSTALLED_APPS += ('debug_toolbar',)

PAGINATE_TEMPLATE = 'browse/pagination.html'

TEMPLATE_CONTEXT_PROCESSORS = (
    'lib.context.defaults',
    'django.core.context_processors.auth',
    'django.core.context_processors.debug',
    'django.core.context_processors.i18n',
    'django.core.context_processors.media',
    'django.core.context_processors.request',
)

for app in APPS:
    if os.path.exists(pathify([PROJECT_PATH, app, 'context.py'], file_extension=True)):
        TEMPLATE_CONTEXT_PROCESSORS += (
            '%s.context.defaults' % app,
        )


"""
Determine the environment:
1. env/CURRENT should contain a single line of text that matches a directory name in env
    If env/CURRENT does not exist, use env/CURRENT.default
2. Load settings.py from the named directory

Note that env/CURRENT.default and the folder it points to (eg, sqlite3_default) should
be checked into the repository. 
** env/CURRENT should not be checked into the repostiroy **
Other folders may be checked in to manage setting revisions, but be careful about
revealing database passwords.
"""

env_file = PROJECT_PATH+path("/env/CURRENT")
def_env_file = PROJECT_PATH+path("/env/CURRENT.default")
if os.path.exists(env_file):
    f = file(env_file)
elif os.path.exists(def_env_file):
    f = file(def_env_file)
else:
    raise IOError(env_file+" or "+def_env_file+" do not exist!  Please specify an environment\nhttp://bilumi.org/trac/wiki/FAQ.")

DEV_ENV = f.read().strip()
f.close()
    
env_settings_file = PROJECT_PATH+path("/env/"+DEV_ENV+"/settings.py")
try:
    f = file(env_settings_file)
except IOError, e:
    raise IOError(env_settings_file+" does not exist!  Please create this file.")
else:
    env_settings = f.read()
    f.close()
    code = compile(env_settings, env_settings_file, 'exec')
    exec(code)
