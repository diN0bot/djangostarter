from django.conf.urls.defaults import *

urlpatterns = patterns('',
    (r'^account/', include('user_profile.views.account_urls')),
    (r'^', include('user_profile.views.user_urls')),
)
