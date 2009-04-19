from lib.view_utils import * 
from twitter.tcal.models import *
from twitter.models import *

from django.core.urlresolvers import reverse
from django.db.models.query import QuerySet

import datetime, calendar, time

# scraping
import lib.feedparser
import urllib
from BeautifulSoup import BeautifulSoup
import html5lib

def main(request):
    app_name = 'tcal'
    app_page = 'calendar'
    
    return HttpResponseRedirect(reverse('ajax_this_week'))

def week(request, username=None, year=None, month=None, day=None):
    app_name = 'tcal'
    app_page = 'calendar'
    
    if request.POST:
        if 'username' in request.POST:
            assert not username
            username = request.POST.get('username', None).strip()
            if username:
                return HttpResponseRedirect(reverse('this_week', args=(username, )))
        elif 'new_activity' in request.POST:
            assert username
            msg = request.POST.get('new_activity', None)
            twitter_user = TwitterUser.get_or_none(twitter_username=username)
            meeting = twitter_user.add_meeting(msg)
            return HttpResponseRedirect(reverse('week', args=(username, meeting.when.day, meeting.when.strftime("%B"), meeting.when.year)))
            
    if username:
        app_page = username
        twitter_user = TwitterUser.get_or_none(twitter_username=username)
        if not twitter_user:
            twitter_user = TwitterUser.add(username)

        if not 'noscrape' in request.GET:
            scrape_twitter_user_page(twitter_user, 'http://twitter.com/%s' % twitter_user.twitter_username, scrape_friends=True)
    else:
        twitter_user = None

    now = datetime.date.today() 
    year = year and int(year) or now.year
    month_name = month or now.strftime("%B")
    month = MONTHS[month_name]
    day = day and int(day) or now.day
    
    start = datetime.datetime(year, month, day)
    
    week = None
    for aweek in calendar.Calendar().monthdatescalendar(year, month):
        for adate in aweek:
            if adate == start.date():
                week = aweek

    if twitter_user:
        ids = list(twitter_user.friends.values_list('id', flat=True))
        ids.append(twitter_user.id)
        ids.sort()
        meetings = Meeting.objects.filter(when__gte=week[0],
                                          when__lte=week[-1],
                                          twitter_user__id__in=ids).order_by('-when')
    
        hours = {}
        for meeting in meetings:
            if not meeting.when.hour in hours:
                hours[meeting.when.hour] = []
            hours[meeting.when.hour].append(meeting)
                    

        ordered_hours = list(hours.keys())
        ordered_hours.sort()
        
        grouped_meetings_across_dates = []
        for hour in ordered_hours:
            hour_row = []
            for adate in week:
                hour_row.append(meetings.filter(when__day=adate.day,
                                                id__in=[m.id for m in hours[hour]]))
            grouped_meetings_across_dates.append(hour_row)

    else:
        meetings = Meeting.objects.none()
        ordered_hours = []
        grouped_meetings_across_dates = []
    
    return render_response(request, 'tcal/week.html', locals())

def scrape_twitter_user_feed(twitter_user, feed_url):
    """
    @param feed_url: eg 'http://twitter.com/statuses/user_timeline/username.rss'
    """
    print "SCRAPER FEED ", feed_url
    feed = lib.feedparser.parse(feed_url)
    print "   parsed"
    print len(feed['entries'])
    for entry in feed['entries']:
        message = entry['title']
        tweet_link = entry['link']
        print "       entry: ", tweet_link
        # >>> m2 = "http://twitter.com/BarackObama/statuses/992176676"
        # >>> m1 = "http://twitter.com/BarackObama/statuses/1122861857"
        # >>> m2[m2.rfind('/')+1:]
        # '992176676'
        # >>> m1[m1.rfind('/')+1:]
        # '1122861857'
        tweet_id = int(tweet_link[tweet_link.rfind('/')+1:])
        if twitter_user.get_tweet(tweet_id):
            # already scraped this tweet, and thus already scraped rest of tweets, too,
            # assuming reverse chronological order
            print "   tweet already recorded", tweet_id
            return

        t = entry['updated_parsed']
        adatetime = datetime.datetime(t.tm_year, t.tm_mon, t.tm_mday, t.tm_hour, t.tm_min, t.tm_sec, 0, None)
        timezn_diff = time.timezone / 3600
        when = adatetime - datetime.timedelta(hours=timezn_diff)

        twitter_user.add_tweet(message, tweet_link=tweet_link, tweet_id=tweet_id, tweet_time=when)
        print "  tweet added"
    
def scrape_twitter_user_page(twitter_user, page_url, scrape_friends=False):
    print "SCRAPE USER PAGE ", twitter_user, " ", page_url

    html = urllib.urlopen(page_url).read()
    print "   html opened and read"
    # BeautifulSoup(html) returns error because of <sc'+'ript> in html
    # Thus, use html5lib parser
    bsoup_parser = html5lib.HTMLParser(tree=html5lib.treebuilders.getTreeBuilder("beautifulsoup"))
    soup = bsoup_parser.parse(html)
    print "   parsed"
    
    # if protected don't scrape (nothing to see here)
    if soup.find("div", "protected-box"):
        print "   ProtectedBox"
        protected=True
    else:
        protected=False
    
    # get feed url
    #>>> soup.find(id="feed").a.attrs
    #[(u'href', u'/statuses/user_timeline/18369685.rss'), (u'type', u'application/rss+xml'), (u'class', u'xref rss'), (u'rel', u'alternate')]
    if not protected and soup.find(id="feed"):
        #feed_url = _get_href(soup.find(id="feed").a.attrs)
        feed_url = 'http://twitter.com/statuses/user_timeline/%s.rss' % twitter_user.twitter_username
        scrape_twitter_user_feed(twitter_user, feed_url)
    
    # get friends
    if scrape_friends:
        friend_urls = []
        for following in soup.find(id="following_list").childGenerator():
            try:
                friend_urls.append(_get_href(following.find('a').attrs))
            except:
                # actually we expect some to fail because children aren't all a.... TODO!!!
                pass 
        for friend_url in friend_urls:
            friend_username = friend_url[19:]
            friend_user = twitter_user.add_friend(friend_username)
            friend_user.add_friend(twitter_user)
            try:
                scrape_twitter_user_page(friend_user, friend_url, scrape_friends=False)
            except:
                pass
  
def _get_href(attrs, domain="http://twitter.com"):
    for attr in attrs:
        if attr[0] == 'href':
            if 'http://' in attr[1]:
                return attr[1]
            else:
                return '%s%s' % (domain, attr[1])
    
    #import twill
    #from twill import get_browser
    #from twill.commands import go
    #from BeautifulSoup import BeautifulSoup as BSoup
    
    #from StringIO import StringIO
    #twill.set_output(StringIO())
    
    #twill.commands.go(url)
    #soup = BSoup(twill.commands.get_browser().get_html())
    
    

MONTHS = {'January':1,
          'February':2,
          'March':3}


def about(request):
    app_name = 'tcal'
    app_page = 'About'
    
    if request.POST:
        username = request.POST.get('username', None).strip()
        if username:
            return HttpResponseRedirect(reverse('this_week', args=(username, )))
    return render_response(request, 'tcal/about.html', locals())


def blog(request, username=None):
    pass

def ajax_week(request, username=None, year=None, month=None, day=None):
    app_name = 'tcal'
    app_page = 'calendar'
    
    if request.POST:
        if 'username' in request.POST:
            assert not username
            username = request.POST.get('username', None).strip()
            if username:
                return HttpResponseRedirect(reverse('this_week', args=(username, )))
        elif 'new_activity' in request.POST:
            assert username
            msg = request.POST.get('new_activity', None)
            twitter_user = TwitterUser.get_or_none(twitter_username=username)
            meeting = twitter_user.add_meeting(msg)
            return HttpResponseRedirect(reverse('week', args=(username, meeting.when.day, meeting.when.strftime("%B"), meeting.when.year)))
            
    if username:
        twitter_user = TwitterUser.get_or_none(twitter_username=username)
        if not twitter_user:
            twitter_user = TwitterUser.add(username)
    else:
        twitter_user = None

    now = datetime.date.today() 
    year = year and int(year) or now.year
    month_name = month or now.strftime("%B")
    month = MONTHS[month_name]
    day = day and int(day) or now.day
    
    start = datetime.datetime(year, month, day)
    
    week = None
    for aweek in calendar.Calendar().monthdatescalendar(year, month):
        for adate in aweek:
            if adate == start.date():
                week = aweek
    start_date = week[0]
    end_date = week[-1]

    if twitter_user:
        ids = list(twitter_user.friends.values_list('id', flat=True))
        ids.append(twitter_user.id)
        ids.sort()
        meetings = Meeting.objects.filter(when__gte=start_date,
                                          when__lte=end_date,
                                          twitter_user__id__in=ids).order_by('-when')
    
        hours = {}
        for hour in range(0,25):   # 'midnight' is different than '0' in human minds, eg what does midnight tonight mean? 24 of today, not 0
            hours[hour] = []
        for meeting in meetings:
            hours[meeting.when.hour].append(meeting)
                    
        ordered_hours = list(hours.keys())
        ordered_hours.sort()
        
        grouped_meetings_across_dates = []
        for hour in ordered_hours:
            hour_row = []
            for adate in week:
                hour_row.append(meetings.filter(when__day=adate.day,
                                                id__in=[m.id for m in hours[hour]]))
            grouped_meetings_across_dates.append(hour_row)

    else:
        meetings = Meeting.objects.none()
        ordered_hours = []
        grouped_meetings_across_dates = []
    
    return render_response(request, 'tcal/ajax_week.html', locals())
