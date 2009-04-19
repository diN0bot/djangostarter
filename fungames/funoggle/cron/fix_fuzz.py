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
from twitter.imager.models import Code, Weatherized, _Get_Image_Path

import cStringIO # *much* faster than StringIO
import Image, ImageChops

def weatherize(weatherized=None, username=None, password=None, zipcode=None, theme=None):
    if weatherized:
        username = weatherized.user.twitter_username
        password = weatherized.user.password
        zipcode = weatherized.user.zipcode
        theme = weatherized.theme
    print "WEATHERIZE ", username, password, zipcode
    
    weather_data = weather(zipcode)
    code = weather_data['code']
    print "   ", code
    
    if code:
        th_image = theme.get_image(code)
        image = Image.open(th_image.image.path)
        end = th_image.image.path.split('.')[-1]

        if not theme.replace_background:
            or_bg = weatherized.original_background.path
            print "    ORIGINAL BACKGROUND ", or_bg
            image = background_smoosh(Image.open(or_bg), image)
            end = or_bg.split('.')[-1]

        #if theme.slug != 'blue_sky':
        #    image = logoize(image, weather_data)

        fn = '/tmp/final.%s' % end
        image.save(fn)
        success = update_background(fn.encode('utf-8'), username, password)
        return (code, success)
    else:
        return (None, False)
    
def logoize(bg, weather_data):
    import os
    orig = bg.copy()
    
    #bg = Image.open('/var/sites/twitter/misty.jpg')
    
    # paste bg onto large background
    (w, h) = bg.size
    min_w = 1000
    min_h = 80
    if w < min_w: w = min_w
    if h < min_h: h = min_h
    if w == min_w or h == min_h:
        big_transparent = Image.new('RGBA', (w, h))
        big_transparent.paste(bg, (0,0), automask(bg))
        bg = big_transparent

    # make weather text
    today = '%s, %s F' % (weather_data['text'], weather_data['temp'])
    tomorrow = '%s %s-%s F' % (weather_data['tomorrow_text'], weather_data['tomorrow_high'], weather_data['tomorrow_low'])
    next_day = '%s %s-%s F' % (weather_data['next_day_text'], weather_data['next_day_high'], weather_data['next_day_low'])
    text = '%s    -> %s    ->> %s    @weatherizer' % (today, tomorrow, next_day)
    #s = "convert -size %sx%s xc:transparent -fill black -stroke black -strokewidth 8 -draw \"text 70,58 '%s'\" -channel RGBA -blur 0x6 -stroke none -fill white -draw \"text 70,58 '%s'\" /tmp/text.png" % (w, h, text, text)
    s = "convert -size %sx%s xc:transparent -fill white -stroke white -strokewidth 8 -draw \"text 70,58 '%s'\" -channel RGBA -stroke none -fill black -draw \"text 70,58 '%s'\" /tmp/text.png" % (w, h, text, text)
    print s
    os.system(s)
    
    # paste text onto background
    try:
        print "try"
        words = Image.open('/tmp/text.png')
        print "opened"
        bg.paste(words, (0,0), words)
        #print "about to save"
        #bg.save('/tmp/bg.png') # do know!
        #print "save"
        return bg

        #bg.save('/tmp/final.%s' % end)
        #return '/tmp/final.%s' % end
    except:
        print "   ERROR logoizing"
        return orig

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

def background_smoosh(background, icon):
    print "BACKGROUND SMOOSH"
    
    ### Get background
    #background = Image.open(background_path)
    #background = Image.open('/Users/lucy/Desktop/a/sky2.png')
            
    ### Get icon
    #icon = Image.open(icon_path)
    
    #icon = Image.open('/Users/lucy/sandbox/ThoughtAndMemory/web/starter/media/twitter/imager/img/WeatherizerLogo.png')
    #icon = icon.resize( (200,200) )
    print "     background mode: ", background.mode, background.info, background.format
    print "           icon mode: ", icon.mode, icon.info, background.format
    
    #alpha = background.split()[-1]

    ### Paste yahoo icon onto background
    #icon = Image.open('/Users/lucy/Desktop/a/11.gif')

    #transparency = icon.info['transparency']
    #background.paste(icon, (10,10), transparency=transparency)
    
    #background.paste(icon, (10,10), automask(icon))
    
    background = background.convert('RGBA')
    print "     background mode: ", background.mode, background.info, background.format   
    background.paste(icon, (10,10), automask(icon))
    
    #alpha = ImageChops.add(alpha, icon.split()[-1])
    #background.putalpha(alpha)

    
    #end = background_path.split('.')[-1]
    #background.save('/Users/lucy/Desktop/a/w_background.%s' % end) 
    #return '/Users/lucy/Desktop/a/w_background.%s' % end
    #background.save('/tmp/w_background.%s' % end) 
    #return '/tmp/w_background.%s' % end
    return background
    
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
    end = filename.split('.')[-1]
    filepart = multipart.FilePart({'name': 'image'}, filename, 'image/%s' % end)
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
    text_re = re.compile('text="([^"]+)"')
    temp_re = re.compile('temp="(\d+)"')
    #<yweather:forecast day="Tue" date="29 Nov 2005" low="45" high="62" text="Mostly Cloudy" code="27" />
    #<yweather:forecast day="Wed" date="30 Nov 2005" low="52" high="60" text="Mostly Cloudy" code="28" />
    yweather_forecast_re = re.compile("<yweather:forecast[^>]*/>")
    low_re = re.compile('low="(\d+)"')
    high_re = re.compile('high="(\d+)"')
    
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
    text = None
    temp = None
    tomorrow_text = None
    tomorrow_high = None
    tomorrow_low = None
    next_day_text = None
    next_day_high = None
    next_day_low = None
    
    #print
    #print html
    #print 
    
    def grep(doc, regex):
        """ refactor common regex search pattern """
        regex_g = regex.search(doc)
        if regex_g and regex_g.groups():
            return regex_g.groups()[0]
        elif regex_g and regex_g.group():
            return regex_g.group()
        else:
            return None
    
    astro = grep(html, yweather_astronomy_re)
    if astro:
        sunrise = grep(astro, sunrise_re)
        sunset = grep(astro, sunset_re)
    
    condi = grep(html, yweather_condition_re)
    if condi:
        code = grep(condi, code_re)
        temp = grep(condi, temp_re)
        text = grep(condi, text_re)
    
    forec = yweather_forecast_re.findall(html)
    if forec:
        if len(forec) > 0:
            tomorrow = forec[0]
            tomorrow_text = grep(tomorrow, text_re)
            tomorrow_high = grep(tomorrow, high_re)
            tomorrow_low = grep(tomorrow, low_re)
        if len(forec) > 1:
            next_day = forec[1]
            next_day_text = grep(next_day, text_re)
            next_day_high = grep(next_day, high_re)
            next_day_low = grep(next_day, low_re)
    
    print "yahoo code: ", code
    return {'code':Code.get_or_none(code=code),
            'sunrise':sunrise,
            'sunset':sunset,
            'temp':temp,
            'text':text,
            'tomorrow_text':tomorrow_text,
            'tomorrow_high':tomorrow_high,
            'tomorrow_low':tomorrow_low,
            'next_day_text':next_day_text,
            'next_day_high':next_day_high,
            'next_day_low':next_day_low,
            }

if __name__ == "__main__":
    #for weatherized in Weatherized.objects.all():
    #    weatherize(weatherized=weatherized)
    weatherize(weatherized=Weatherized.get_or_none(user__twitter_username='fundate'))
    print "SUCCESS"
