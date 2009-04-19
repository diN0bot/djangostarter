from django.conf.urls.defaults import *

urlpatterns = patterns('',
    (r'^', include('twitter.twoggle.views.main_urls')),
)
