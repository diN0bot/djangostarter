from django.conf.urls.defaults import *
from twitter.procrasdonate.views import main

urlpatterns = patterns('',
    url(r'^$', main.main, name='procrasdonate'),
    url(r'^start_now/$', main.start_now, name='start_now'),
    url(r'^learn_more/$', main.learn_more, name='learn_more'),
    url(r'^my_impact/$', main.my_impact, name='my_impact'),
    url(r'^settings/$', main.settings, name='settings'),

    url(r'^our_community/$', main.our_community, name='our_community'),
    url(r'^our_community/recipients', main.our_community_recipients, name='our_community_recipients'),
    url(r'^our_community/sites', main.our_community_sites, name='our_community_sites'),
    url(r'^our_community/procrasdonations', main.our_community_procrasdonations, name='our_community_procrasdonations'),

    url(r'^privacy_guarantee/$', main.privacy_guarantee, name='privacy_guarantee'),
    url(r'^recipients', main.recipients, name='recipients'),
    url(r'^data/$', main.data, name='data'),
)
