from django.conf.urls.defaults import *
from twitter.imager.views import main

urlpatterns = patterns('',
    url(r'^$', main.main, name='imager'),
    url(r'^select_theme/$', main.select_theme, name='select_theme'),
    url(r'^authorize_background_changes/(?P<theme_slug>[\w_-]+)/$', main.authorize_background_changes, name='authorize_background_changes'),
    
    url(r'^create_theme/$', main.create_theme, name='create_theme'),
    
    url(r'^edit_theme/(?P<theme_slug>[\w_-]+)/$', main.edit_theme, name='edit_theme'),
    url(r'^edit_theme/$', main.edit_some_theme, name='edit_some_theme'),
    
    url(r'^edit_image/(?P<theme_slug>[\w_-]+)/(?P<code>\d+)/$', main.edit_image, name='edit_image'),
    url(r'^delete_image/(?P<theme_slug>[\w_-]+)/(?P<code>\d+)/$', main.delete_image, name='delete_image'),
    
    url(r'^weatherized/$', main.weatherized, name='weatherized'),
    url(r'^un_weatherize_background/$', main.un_weatherize, { 'background_not_avatar': True }, name='un_weatherize_background'),
    url(r'^un_weatherize_avatar/$', main.un_weatherize, { 'background_not_avatar': False }, name='un_weatherize_avatar'),
    
    url(r'^theme/(?P<theme_slug>[\w_-]+)/$', main.theme, name='theme'),
    
    url(r'^help/$', main.help, name='imager_help'),
    url(r'^dev/$', main.dev, name='imager_dev'),
    url(r'^about/$', main.about, name='imager_about'),
    url(r'^tos/$', main.tos, name='imager_tos'),
    
    url(r'^log_out/$', main.log_out, name='log_out'),
    
    url(r'^screen_shot/(?P<theme_slug>[\w_-]+)/(?P<type>(before|after))/$', main.screen_shot, name='screen_shot'),
    url(r'^edit_screen_shot/(?P<theme_slug>[\w_-]+)/(?P<type>(before|after))/$', main.edit_screen_shot, name='edit_screen_shot'),
    url(r'^edit_author_comments/(?P<theme_slug>[\w_-]+)/$', main.edit_author_comments, name='edit_author_comments'),
    url(r'^edit_replace_background/(?P<theme_slug>[\w_-]+)/$', main.edit_replace_background, name='edit_replace_background'),

    url(r'^change_zipcode_background/$', main.change_zipcode, { 'background_not_avatar': True }, name='change_zipcode_background'),
    url(r'^change_zipcode_avatar/$', main.change_zipcode, { 'background_not_avatar': False }, name='change_zipcode_avatar'),
    url(r'^change_background_background/$', main.change_background, { 'background_not_avatar': True }, name='change_background_background'),
    url(r'^change_background_avatar/$', main.change_background, { 'background_not_avatar': False }, name='change_background_avatar'),

)
