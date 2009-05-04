from django.conf.urls.defaults import *
from twitter.procrasdonate.views import main

urlpatterns = patterns('',
    # currently redirects to learn_more
    url(r'^$', main.main, name='procrasdonate'),
    
    # intro, faq
    url(r'^learn_more/$', main.learn_more, name='learn_more'),
    
    # display visit and procras donation info
    # plugin alters page 
    url(r'^my_impact/$', main.my_impact, name='my_impact'),
    
    # displays registration track
    # plugin alters page 
    url(r'^start_now/$', main.start_now, name='start_now'),
    # displays settings pages
    # plugin alters page 
    url(r'^settings/$', main.settings, name='settings'),
    # lists all recipients. selecting a recipient will fill info into settings account page
    url(r'^recipients', main.recipients, name='recipients'),
    # clarifies what information stays safe on server, and what is divulged publicly
    url(r'^privacy_guarantee/$', main.privacy_guarantee, name='privacy_guarantee'),
        
    
    # displays total site and recipient ranks
    url(r'^our_community/$', main.our_community, name='our_community'),
    url(r'^our_community/recipients', main.our_community_recipients, name='our_community_recipients'),
    url(r'^our_community/sites', main.our_community_sites, name='our_community_sites'),

    # post handler from extension
    url(r'^data/$', main.data, name='data'),
)
