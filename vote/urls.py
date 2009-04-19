from django.conf.urls.defaults import *
import views

urlpatterns = patterns('',
    url(r'^vote/(?P<model_name>\w+)/(?P<obj_id>\d+)/(?P<votetype_name>\w+/$', views.vote, name="vote"),
    url(r'^thumb_up/(?P<model_name>\w+)/(?P<obj_id>\d+)/$', views.thumb_up, name="thumb_up"),
    url(r'^thumb_down/(?P<model_name>\w+)/(?P<obj_id>\d+)/$', views.thumb_down, name="thumb_down"),
    
    url(r'^get/vote', views.vote_GET, name="vote_GET"),
    url(r'^get/thumb_up', views.thumb_up_GET, name="thumb_up_GET"),
    url(r'^get/thumb_down', views.thumb_down_GET, name="thumb_down_GET"),
    
    url(r'^post/vote/$', views.vote_POST, name="vote_POST"),
    url(r'^post/thumb_up/$', views.thumb_up_POST, name="thumb_up_POST"),
    url(r'^post/thumb_down/$', views.thumb_down_POST, name="thumb_down_POST"),
)
