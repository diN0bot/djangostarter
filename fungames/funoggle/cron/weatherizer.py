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
import Image

class ZipcodeLookupFailedException(Exception): pass
class WeatherLookupFailedException(Exception): pass
class UpdateBackgroundFailedException(Exception): pass
class TwitterAuthorizationFailedException(Exception): pass

def weatherize(weatherized):
    if not weatherized:
        print " WEATHERIZED = None "
        return False
    
    username = weatherized.user.twitter_username
    password = weatherized.user.password
    zipcode = weatherized.user.zipcode
    theme = weatherized.theme
    print "WEATHERIZE ", username, password, zipcode
    
    weather_data = weather(zipcode)
    code = weather_data['code']
    
    if code:
        th_image = theme.get_image(code)
        image = Image.open(th_image.image.path)
        end = th_image.image.path.split('.')[-1]

        if theme.background_not_avatar and not theme.replace_not_cover:
            print " --------> paste theme image onto original background"
            or_bg = Image.open(weatherized.original_background.path)
            print "     original background: ", or_bg.mode, or_bg.info, or_bg.format
            if or_bg.mode != "RGBA":
                or_bg = or_bg.convert('RGBA')
                print "        converted background: ", or_bg.mode, or_bg.info, or_bg.format
            image = background_smoosh(or_bg, image)
            print "        final background: ", image.mode, image.info, image.format

        fn = '/tmp/%s' % weatherized.good_for_twitter()
        fn = fn[:-3] + end
        
        if theme.background_not_avatar:
            image = forecastize(image, weather_data)
            #if fn[-3:] == 'gif':
            #    fn = fn[:-3] + 'png'
            save_for_twitter(image, fn, 800)
        else:
            or_av = Image.open(weatherized.original_background.path)
            #if image.mode != "RGBA":
            #    image = image.convert("RGBA")
            if or_av.mode != "RGBA":
                or_av = or_av.convert("RGBA")
            image = avatar_smoosh(or_av, image)
            save_for_twitter(image, fn, 700)
        
        success = update_background(fn.encode('utf-8'), username, password, tiled=weatherized.user.profile_background_tile, background_not_avatar=theme.background_not_avatar)
        weatherized.copy_weatherized_background(fn)
        os.system('rm %s' % fn)
        return (code, success)
    else:
        return (None, False)

def save_for_twitter(image, fn, size):
    """
    @param size: in Kb. eg, for 800kb, enter size=800 
    TODO save as jpg instead of png to make smaller?
    TODO resample?
    """
    image.save(fn)
    # get image under 800kb for twitter:
    fs = os.stat(fn).st_size
    tmax = size*1000L
    print " --------> get under %s kb if necessary" % size
    print "     filesize", fs
    print "    twttr max", tmax
    #if image.mode == "RGBA":
    #    image = image.convert("P", palette=Image.ADAPTIVE)
    #    print "  info: ", image.mode, image.info, image.format
    #print " new filesize", os.stat(fn).st_size
    
    while fs > tmax:
        pct = int( (float(tmax) / float(fs)) * 100 )
        pct = (100 + pct) / 2
        print "            pct", pct
        w = int( image.size[0] * pct/100.0 )
        h = int( image.size[1] * pct/100.0 )
        print "            old w, h", image.size
        print "            new w, y", w, h
        image = image.crop( (0, 0, w, h) )
        #image = image.resize( (w, h) )
        image.save(fn)
        fs = os.stat(fn).st_size
        print "            new filesize", fs 
    

def forecastize(bg, weather_data):
    print " --------> paste forecast onto background"
    
    #bg = Image.open('/var/sites/twitter/misty.jpg')
    if bg.mode != "RGBA":
        bg = bg.convert('RGBA')
        print "     coverted bg to RGBA: ", bg.mode, bg.info, bg.format
    
    # paste bg onto large background
    (w, h) = bg.size
    min_w = 800
    min_h = 80
    if w < min_w: w = min_w
    if h < min_h: h = min_h
    if w == min_w or h == min_h:
        big_transparent = Image.new('RGBA', (w, h))
        big_transparent.paste(bg, (0,0), automask(bg))
        bg = big_transparent

    # make weather text
    today = '%s, %s*' % (weather_data['text'], weather_data['temp'])
    tomorrow = '%s %s-%s*' % (weather_data['tomorrow_text'], weather_data['tomorrow_high'], weather_data['tomorrow_low'])
    next_day = '%s %s-%s*' % (weather_data['next_day_text'], weather_data['next_day_high'], weather_data['next_day_low'])
    text = 'Today: %s    Tomorrow: %s    Next Day: %s    @weatherizer' % (today, tomorrow, next_day)
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

        os.system('rm /tmp/text.png')
        return bg

        #bg.save('/tmp/final.%s' % end)
        #return '/tmp/final.%s' % end
    except:
        print "   ERROR logoizing"
        return bg

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
    
    ### Paste yahoo icon onto background
    #icon = Image.open('/Users/lucy/Desktop/a/11.gif')
    background.paste(icon, (10,10), automask(icon))
    #end = background_path.split('.')[-1]
    #background.save('/Users/lucy/Desktop/a/w_background.%s' % end) 
    #return '/Users/lucy/Desktop/a/w_background.%s' % end
    #background.save('/tmp/w_background.%s' % end) 
    #return '/tmp/w_background.%s' % end
    return background

def avatar_smoosh(old_avatar, new_avatar):
    """
    Put new_avatar as small picture on top right corner of old_avatar
    
    ###Put old avatar as small picture on top right corner of new_avatar
    """
    print "AVATAR SMOOSH"
    n_w, n_h = new_avatar.size
    o_w, o_h = old_avatar.size
    
    new_avatar = new_avatar.resize( (int(o_w/2.0), int(o_h/2.0)), Image.ANTIALIAS)
    old_avatar.paste(new_avatar, ( int(o_w/2.0), 0 ), automask(new_avatar))

    return old_avatar

#############
    print "AVATAR SMOOSH"
    #old_avatar.save('/Users/lucy/Desktop/c/old.gif')
    #new_avatar.save('/Users/lucy/Desktop/c/new.gif')
    #old_avatar.save('/Users/lucy/Desktop/c/old.png')
    #new_avatar.save('/Users/lucy/Desktop/c/new.png')
    n_w, n_h = new_avatar.size
    o_w, o_h = new_avatar.size
    print "new avatar size ", new_avatar.size
    print "old avatar size ", old_avatar.size
    print "RESIZE: ", int(n_w/2.0), int(n_h/2.0)
    old_avatar = old_avatar.resize( (int(n_w/2.0), int(n_h/2.0)), Image.ANTIALIAS)
    new_avatar.paste(old_avatar, ( int(n_w/2.0), int(n_h/2.0) ), old_avatar)
    #new_avatar.save('/Users/lucy/Desktop/c/new_after.gif')
    #new_avatar.save('/Users/lucy/Desktop/c/new_after.png')
    #old_avatar.save('/Users/lucy/Desktop/c/old_after.gif')
    #old_avatar.save('/Users/lucy/Desktop/c/old_after.png')
    return new_avatar
###############
    
def update_background(filename, username, password, tiled, background_not_avatar):
    # currently file is always a png !!
    if background_not_avatar:
        url='http://twitter.com/account/update_profile_background_image.json'
        # image.  Required.  Must be a valid GIF, JPG, or PNG image of less than 
        # 800 kilobytes in size.  Images with width larger than 2048 pixels will be scaled down.
        # tile. Optional. If set to true the background image will be displayed tiled. 
        # The image will not be tiled otherwise.
    else:
        url='http://twitter.com/account/update_profile_image.json'
        # image.  Required.  Must be a valid GIF, JPG, or PNG image 
        # of less than 700 kilobytes in size.  Images with width larger 
        # than 500 pixels will be scaled down. 
        tiled = None
    
    authstr = 'Basic ' + base64.encodestring('%s:%s' % (username, password)).strip()
    
    print " --------> update background"
    print "authstr ", authstr, filename
    
    if tiled:
        values = { 'tile': tiled, }
        data = urllib.urlencode(values)
    
        request = urllib2.Request(url, data)
        #request.add_data(data)
    else:
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
        #print response
        #print dir(response)
        #print response.info()
        print response.msg
        print response.headers
        print response.code
        #print response.url
        if response.code != 200:
            raise UpdateBackgroundFailedException()
        return True
    except urllib2.HTTPError, details:
        print "HTTPError ", details
        return False


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

yahoo_err = re.compile("Yahoo! Weather - Error")
zipcode_err = re.compile("City not found")
# get zipcode hack 
# http://zipinfo.com/cgi-local/zipsrch.exe?zip=Cambridge%2C+MA&Go=Go
zipcode_re = re.compile('^\d+$')
def weather(zipcode):
    """
    @param zipcode: eg, 02139
    @return: {'code': code, ...plus others if code not None }
    @rtype: (int, str, str) 
    """
    units = 'f'
    if not zipcode_re.match(zipcode):
        units = 'c'
    url = 'http://weather.yahooapis.com/forecastrss?p=%s&u=%s' % (zipcode, units)
    html = urllib.urlopen(url).read()
    
    #print
    #print html
    #print 
    
    zerr = zipcode_err.search(html)
    if zerr and zerr.group():
        print "zipcode err"
        raise ZipcodeLookupFailedException()
    yerr = yahoo_err.search(html)
    if yerr and yerr.group():
        print "yahoo err"
        raise WeatherLookupFailedException()
    
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
    if not code:
        raise ZipcodeLookupFailedException()
    
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
    
    print "  yahoo code: ", code
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
    if settings.DJANGO_SERVER:
        weatherize(weatherized=Weatherized.get_or_none(user__twitter_username='weatherizertalk'))
    else:
        print "hello"
        if True:
            for w in Weatherized.objects.all():
                code = None
                success = False
                msg = ''
                w.weatherized_background = None
                try:
                    code, success = weatherize(weatherized=w)
                except ZipcodeLookupFailedException:
                    msg = 'Could not find weather condition for this zipcode. (Expanded weather lookup coming soon)'
                except WeatherLookupFailedException:
                    msg = 'Weather condition lookup failed inexplicably. (Expanded weather lookup coming soon)'
                except UpdateBackgroundFailedException:
                    msg = 'Twitter background update inexplicably failed. It may work if you try again.'
                except:
                    msg = 'Random failure. It may work if you try again.'
                
                w.error_message = msg
                w.background_success = success
                w.current_code = code or Code.get(name="not available")
                w.save()

    print "SUCCESS"
