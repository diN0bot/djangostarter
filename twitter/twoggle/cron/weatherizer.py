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

def weatherize(weatherized=None, username=None, password=None, zipcode=None, theme=None):
    if weatherized:
        username = weatherized.user.twitter_username
        password = weatherized.user.password
        zipcode = weatherized.user.zipcode
        theme = weatherized.theme
    print "WEATHERIZE ", username, password, zipcode
    
    code, sunrise, sunset = weather(zipcode)
    print "   ", code, sunrise, sunset
    
    if code:
        image = theme.get_image(code)
        print "   image: ", image

        success = update_background(image.image.path.encode('utf-8'), username, password)
        return (code, success)
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
        #print response.info()
        print response.msg
        #print response.headers
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
    for weatherized in Weatherized.objects.all():
        weatherize(weatherized=weatherized)
    print "SUCCESS"
