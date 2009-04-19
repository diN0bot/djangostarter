from django.conf.urls.defaults import *

urlpatterns = patterns('',
    (r'^', include('twitter.procrasdonate.views.main_urls')),
)
