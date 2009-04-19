from django.conf.urls.defaults import *
from challenge.views import main

urlpatterns = patterns('',
    url(r'^$', main.main, name='main'),
    url(r'^challenge_list/$', main.challenge_list, name='challenge_list'),
    url(r'^challenge/(?P<challenge_slug>[a-zA-Z0-9\-_]+)/$', main.challenge, name='challenge'),
    url(r'^about/$', main.about, name='about'),
)
