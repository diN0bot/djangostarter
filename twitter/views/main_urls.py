from django.conf.urls.defaults import *
from twitter.views import main

urlpatterns = patterns('',
    
    url(r'^$', main.main, name='overview'),
    url(r'^about/$', main.about, name='overview_about'),
        
    url(r'^reply/(?P<key>[\w_]+)/(?P<parent_id>\d+)/$', main.reply, name='reply'),
    
    url(r'^feedback/(?P<key>[\w_]+)/$', main.feedback, name='feedback'),

    url(r'^userpage/(?P<username>[\w\d_]+)/$', main.userpage, name='userpage'),
    url(r'^users/$', main.users, name='users'),
)
