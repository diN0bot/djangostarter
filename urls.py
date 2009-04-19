from django.conf import settings
from settings import pathify
from django.conf.urls.defaults import *

from django.contrib import admin
admin.autodiscover()

import os

urlpatterns = patterns('',)

if settings.DEBUG or settings.DJANGO_SERVER:
    urlpatterns += patterns('',
        (r'^media/(?P<path>.*)$', 'django.views.static.serve',
            {'document_root': settings.MEDIA_ROOT, 'show_indexes':True}),
    )

urlpatterns += patterns('',
    # if you have a static intro that still works when database is offline
    #(r'^', include('app.views.main_urls')),
)

if settings.DOWN_FOR_MAINTENANCE:
    urlpatterns += patterns('',
        (r'^.*', 'django.views.generic.simple.direct_to_template', { 'template': 'data_munger/down_for_maintenance.html' }),
    )

for app in settings.APPS:
    if os.path.exists(pathify([settings.PROJECT_PATH, app, 'views'])):
        urlpatterns += patterns('',
            (r'^%s/' % app, include('%s.views.root_urls' % app)),
        )
# start page
urlpatterns += patterns('',
    (r'^$', include('twitter.views.root_urls')),
)

urlpatterns += patterns('',
    (r'^admin/doc/', include('django.contrib.admindocs.urls')),
    (r'^admin/(.*)', admin.site.root),
)