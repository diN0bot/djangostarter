from django.conf.urls.defaults import *
from twitter.tcal.views import main
#from django.contrib.comments.models import FreeComment

urlpatterns = patterns('',
    url(r'^$', main.main, name='tcal'),
    
    url(r'^week/$', main.week, name='anonymous_week'),
    url(r'^week/(?P<username>\w+)/$', main.week, name='this_week'),
    url(r'^week/(?P<username>\w+)/(?P<day>\d\d?)/(?P<month>\w+)/(?P<year>\d{4})/$', main.week, name='week'),
    
    url(r'^ajax_week/$', main.ajax_week, name='ajax_this_week'),
    url(r'^ajax_week/(?P<username>\w+)/$', main.ajax_week, name='ajax_username'),
    
    url(r'^about/$', main.about, name='tcal_about'),

    url(r'^blog/$', main.blog, name='anonymous_blog'),
    url(r'^blog/(?P<username>\w+)/$', main.blog, name='blog'),
)
