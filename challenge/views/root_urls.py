from django.conf import settings 
from django.conf.urls.defaults import *

urlpatterns = patterns('',
    (r'^ajax/', include('challenge.views.ajax_urls')),
    (r'^api/', include('challenge.views.api_urls')),
    (r'^', include('challenge.views.main_urls')),
)
