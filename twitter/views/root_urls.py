from django.conf.urls.defaults import *

urlpatterns = patterns('',
    (r'^', include('twitter.views.main_urls')),
)
