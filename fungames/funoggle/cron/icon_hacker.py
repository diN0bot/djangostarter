#!/usr/bin/env python


"""
list crontab: crontab -l

edit crontab: crontab -e

check for errors in mail

example crontab for Mac OS X:

PATH=/sw/bin:/sw/sbin:/opt/local/bin:/opt/local/sbin:/Library/Frameworks/Python.framework/Versions/Current/bin:/usr/local/bin:/bin:/sbin:/usr/bin:/usr/sbin:/usr/X11R6/bin:/opt/lo\
cal/bin:/opt/local/sbin:/Applications/Emacs.app/Contents/MacOS:/usr/local/bin:/usr/texbin
PYTHONPATH=/Users/lucy/sandbox/ThoughtAndMemory/web/starter/

# min (0-59)    hour (0-23)     day of month (1-31)     month (1-12)    day of week (0-6, 0=Sunday)
0       *       *       *       *       python /Users/lucy/sandbox/ThoughtAndMemory/web/starter/twitter/imager/cron/weatherizer.py

example crontab for Ubuntu 8.04 LTS:

PYTHONPATH=/var/sites/twitter/
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games

# min (0-59)    hour (0-23)     day of month (1-31)     month (1-12)    day of week (0-6, 0=Sunday)
0       *       *       *       *       python /var/sites/twitter/twitter/imager/cron/weatherizer.py

"""

import os, sys

# if use django.conf for settings, then need to definte
# DJANGO_SETTINGS_MODULE in crontab
#from django.conf import settings
import settings
os.chdir(settings.PROJECT_PATH)

from lib import django_from_shell
django_from_shell.start_django()

from twitter.twitter_lib import multipart
import base64, urllib2

import urllib, re
from twitter.imager.models import Code, Weatherized
from twitter.models import TwitterUser

def weatherize(u):
    print "    BEFORE", u.profile_background_img_url
    u.get_user_data()
    print "    AFTER", u.profile_background_img_url
    username = u.twitter_username
    password = u.password
    zipcode  = u.zipcode
    background_url = u.profile_background_img_url
    background_tile = u.profile_background_tile
    
    print "WEATHERIZE ", username, password, zipcode
    print "background url ", background_url, "    tile  ", background_tile
    
    code, sunrise, sunset = weather(zipcode)
    print "   ", code, sunrise, sunset
    
    if code:
        import cStringIO # *much* faster than StringIO
        import Image
        
        ### Get background image
        try:
            fp = urllib.urlopen(background_url)
            str_img = cStringIO.StringIO(fp.read()) # constructs a StringIO holding the image
            background = Image.open(str_img)
            background.save('/Users/lucy/Desktop/a/background_yes.png')
        except:
            print "WTF!"
            fp = urllib.urlopen('https://static.twitter.com//images/themes/theme4/bg.gif')
            str_img = cStringIO.StringIO(fp.read()) # constructs a StringIO holding the image
            background = Image.open(str_img)
            background.save('/Users/lucy/Desktop/a/background_wtf.gif')
        print "   background: ", background
        #### Convert to png
        #if 'transparency' in background.info:
        #    transparency = background.info['transparency']
        #    background.save('/tmp/background.png', transparency=transparency)
        #else:
        #    background.save('/tmp/background.png')
        #background = Image.open('/tmp/background.png')
        #print "   converted background: ", background
        
        ### Get yahoo icon
        icon_url = "http://l.yimg.com/a/i/us/we/52/%s.gif" % code.code
        print icon_url
        fp = urllib.urlopen(icon_url)
        str_img = cStringIO.StringIO(fp.read()) # constructs a StringIO holding the image
        icon = Image.open(str_img)
        icon.save('/Users/lucy/Desktop/a/icon.gif')
        print "   icon: ", icon
        
        ### Convert gif icon to png
        #same error as transparency=transparency   : bad transparency mask
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
        #icon.save('/tmp/icon.png', mask=automask(icon))
        
        #transparency = icon.info['transparency']
        ##print "    T\n", transparency 
        #icon.save('/tmp/icon.png', transparency=transparency)
        #icon.save('/tmp/icon.png')
        #icon = Image.open('/tmp/icon.png')
        #print "   converted icon: ", icon
        
        ### Paste yahoo icon onto background
        #background.save('/tmp/before_background.png')
        background = Image.open('/Users/lucy/sandbox/ThoughtAndMemory/web/starter/media/twitter/imager/img/uploads/ask_me_if_im_a_truck/16_Snowy.png')
        background.save('/Users/lucy/Desktop/a/background_before.png')
        #background.paste(150, (0,0,32,32), 255)#automask(icon))
        icon = Image.open('/Users/lucy/Desktop/a/11.gif')
        background.paste(icon, (10,10), automask(icon))
        background.save('/Users/lucy/Desktop/a/background_after2.png')

        success = update_background('/Users/lucy/Desktop/a/background_after2.png'.encode('utf-8'), username, password)
        return (code, success)
        #return (code, True)
    else:
        return (None, False)
    
def update_background(filename, username, password):
    url='http://twitter.com/account/update_profile_background_image.json'
    
    authstr = 'Basic ' + base64.encodestring('%s:%s' % (username, password)).strip()
    
    print
    print "UPDATE BACKGROUND"
    print "authstr ", authstr
    print "filename ", filename
    
    request = urllib2.Request(url)
    request.add_header('Authorization', authstr)
    
    body = multipart.Multipart()
    filepart = multipart.FilePart({'name': 'image'}, filename, 'image/png')
    body.attach(filepart)
    (header, value) = body.header()
    
    request.add_data(str(body))
    request.add_header(header, value)
    
    try:
        response = urllib2.urlopen(request)
        print response
        print dir(response)
        print response.info()
        print response.msg
        print response.headers
        print response.code
        print response.url
        return True
    except urllib2.HTTPError, details:
        print "HTTPError ", details
        return False
    
# get zipcode hack 
# http://zipinfo.com/cgi-local/zipsrch.exe?zip=Cambridge%2C+MA&Go=Go

def weather(zipcode):
    """
    @param zipcode: eg, 02139
    @return: (code, sunrise, sunset)
    @rtype: (int, str, str) 
    """
    url = 'http://weather.yahooapis.com/forecastrss?p=%s&u=f' % zipcode
    html = urllib.urlopen(url).read()
    
    #<yweather:astronomy sunrise="6:57 am"   sunset="6:00 pm"/>
    yweather_astronomy_re = re.compile("<yweather:astronomy[^>]*/>")
    sunrise_re = re.compile('sunrise="([\s\w\d:]*)"')
    sunset_re = re.compile('sunset="([\s\w\d:]*)"')
    #<yweather:condition  text="Fair"  code="33"  temp="37"  date="Thu, 19 Feb 2009 9:51 pm EST" />
    yweather_condition_re = re.compile("<yweather:condition[^>]*/>")
    code_re = re.compile('code="(\d\d?)"')
    
    
    zipcode_err = re.compile("City not found")
    zerr = zipcode_err.search(html)
    if zerr and zerr.group():
        print "zipcode err"
        return (None, None, None)
    yahoo_err = re.compile("Yahoo! Weather - Error")
    yerr = yahoo_err.search(html)
    if yerr and yerr.group():
        print "yahoo err"
        return (None, None, None)
    
    sunrise = None
    sunset = None
    code = None
    
    #print
    #print html
    #print 
    astro = yweather_astronomy_re.search(html)
    if astro and astro.group():
        sunrise_g = sunrise_re.search(astro.group())
        sunset_g = sunset_re.search(astro.group())
        if sunrise_g and sunrise_g.groups():
            sunrise = sunrise_g.groups()[0]
        if sunset_g and sunset_g.groups():
            sunset = sunset_g.groups()[0]
    condi = yweather_condition_re.search(html)
    if condi and condi.group():
        code_g = code_re.search(condi.group())
        if code_g and code_g.groups():
            code = code_g.groups()[0]
    
    print "yahoo code: ", code
    return Code.get_or_none(code=code), sunrise, sunset

if __name__ == "__main__":
    weatherize(TwitterUser.get_or_none(twitter_username='diN0bot'))
    print "SUCCESS"
