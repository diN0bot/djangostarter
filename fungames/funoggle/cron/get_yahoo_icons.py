
import os, sys

# if use django.conf for settings, then need to definte
# DJANGO_SETTINGS_MODULE in crontab
#from django.conf import settings
import settings
os.chdir(settings.PROJECT_PATH)

from lib import django_from_shell
django_from_shell.start_django()

import urllib, re
from twitter.imager.models import *
from twitter.models import TwitterUser

import cStringIO # *much* faster than StringIO
import Image

#PATH = '/Users/lucy/sandbox/ThoughtAndMemory/web/starter'
PATH = '/var/sites/twitter'

def automask(im):
    width, height = im.size
    mask = Image.new('1', im.size) # black and white
    tran = im.getpixel((0,0)) #[0]   # transparent top-left
    pix = im.load()
    for y in range(height):
        for x in range(width):
            if pix[x, y] == tran:
                mask.putpixel((x,y), 0) # no mask for transparent pixels (paste nothing)
            else:
                mask.putpixel((x,y), 255)  # mask (paste something)
    return mask

def get_icons():
    for code in Code.objects.all():
        ### Get yahoo icon
        icon_url = "http://l.yimg.com/a/i/us/we/52/%s.gif" % code.code
        fp = urllib.urlopen(icon_url)
        str_img = cStringIO.StringIO(fp.read()) # constructs a StringIO holding the image
        icon = Image.open(str_img)
        icon.save('%s/media/twitter/imager/img/uploads/yahoo_rss_weather/%s.gif' % (PATH, code.code))
        print "   icon: ", icon

        ### Convert gif icon to png
        #icon.save('/tmp/icon.png', mask=automask(icon))
        transparency = icon.info['transparency']
        #icon.save('/Users/lucy/sandbox/ThoughtAndMemory/web/starter/media/twitter/imager/img/uploads/yahoo_rss_weather/%s.png' % code.code, transparency=transparency)
        #icon.save('/Users/lucy/sandbox/ThoughtAndMemory/web/starter/media/twitter/imager/img/uploads/yahoo_rss_weather/%s.png' % code.code, mask=automask(icon))
        icon.save('%s/media/twitter/imager/img/uploads/yahoo_rss_weather/%s.png' % (PATH, code.code))
        print "   converted icon: ", icon

def get_avatar_icons():
    for code in Code.objects.all():
        ### Get yahoo icon
        icon_url = "http://l.yimg.com/a/i/us/we/52/%s.gif" % code.code
        fp = urllib.urlopen(icon_url)
        str_img = cStringIO.StringIO(fp.read()) # constructs a StringIO holding the image
        icon = Image.open(str_img)
        icon.save('%s/media/twitter/imager/img/uploads/yahoo_rss_weather_avatars/%s.gif' % (PATH, code.code))
        print "   icon: ", icon

        ### Convert gif icon to png
        #icon.save('/tmp/icon.png', mask=automask(icon))
        transparency = icon.info['transparency']
        #icon.save('/Users/lucy/sandbox/ThoughtAndMemory/web/starter/media/twitter/imager/img/uploads/yahoo_rss_weather/%s.png' % code.code, transparency=transparency)
        #icon.save('/Users/lucy/sandbox/ThoughtAndMemory/web/starter/media/twitter/imager/img/uploads/yahoo_rss_weather/%s.png' % code.code, mask=automask(icon))
        icon.save('%s/media/twitter/imager/img/uploads/yahoo_rss_weather_avatars/%s.png' % (PATH, code.code))
        print "   converted icon: ", icon


def yahoo_create_theme():
    theme = Theme.get_or_none(slug='yahoo_rss_weather')
    if not theme:
        theme = Theme.add('yahoo_rss_weather')
    for ir in ImageRedirect.objects.all():
        WeatherImage.add(code=ir.code, theme=theme, image='%s.png'%ir.code.code)
        
def yahoo_create_avatar_theme():
    theme = Theme.get_or_none(slug='yahoo_rss_weather_avatars')
    if not theme:
        theme = Theme.add('yahoo_rss_weather_avatars')
    for ir in ImageRedirect.objects.all():
        WeatherImage.add(code=ir.code, theme=theme, image='%s.png'%ir.code.code)

def drawdraw_create_theme():
    theme = Theme.get_or_none(slug='yahoo_rss_weather')
    if not theme:
        theme = Theme.add('yahoo_rss_weather')
    for ir in ImageRedirect.objects.all():
        WeatherImage.add(code=ir.code, theme=theme, image='%s.png'%ir.code.code)

if __name__=="__main__":
    #get_icons()
    #yahoo_create_theme()
    get_avatar_icons()
    yahoo_create_avatar_theme()
    #drawdraw_create_theme()
    
