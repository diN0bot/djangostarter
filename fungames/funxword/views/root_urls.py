from django.conf.urls.defaults import *

urlpatterns = patterns('',
    (r'^', include('twitter.tcal.views.main_urls')),
)
