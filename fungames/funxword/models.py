from django.db import models
from twitter.models import TwitterUser
from lib import model_utils

import datetime, re, calendar
from dateutil import parser, relativedelta

__all__ = ['Meeting']

class Meeting(models.Model):
    """
    """
    when = models.DateTimeField()
    message = models.CharField(max_length=256)
    twitter_user = models.ForeignKey(TwitterUser)
    
    tweet_link = models.URLField(blank=True, null=True)
    tweet_id = models.IntegerField(blank=True, null=True)
    tweet_time = models.DateTimeField()
    
    class Meta:
        ordering = ('-when', 'twitter_user')

    @classmethod
    def Initialize(klass):
        """
        @summary: Mixes the MeetingMixin class into TwitterUser
        """
        model_utils.mixin(MeetingMixin, TwitterUser)
        
    @classmethod
    def extract_time(klass, message, tweet_time=None):
        tweet_time = tweet_time or datetime.datetime.now()
        
        message = message.lower()
        
        yesterday = tweet_time + relativedelta.relativedelta(days=-1)
        tomorrow = tweet_time + relativedelta.relativedelta(days=+1)
        this_weekend = tweet_time + relativedelta.relativedelta(weekday=calendar.SATURDAY)
        next_week = tweet_time + relativedelta.relativedelta(days=+7)
        next_month = tweet_time + relativedelta.relativedelta(months=+1)
        next_monday = tweet_time + relativedelta.relativedelta(weekday=relativedelta.MO(+2))
        next_tuesday = tweet_time + relativedelta.relativedelta(weekday=relativedelta.TU(+2))
        next_wednesday = tweet_time + relativedelta.relativedelta(weekday=relativedelta.WE(+2))
        next_thursday = tweet_time + relativedelta.relativedelta(weekday=relativedelta.TH(+2))
        next_friday = tweet_time + relativedelta.relativedelta(weekday=relativedelta.FR(+2))
        next_saturday = tweet_time + relativedelta.relativedelta(weekday=relativedelta.SA(+2))
        next_sunday = tweet_time + relativedelta.relativedelta(weekday=relativedelta.SU(+2))
        morning = "9am"
        afternoon = "1pm"
        evening = "6pm"
        night = "9pm"
        message = message.replace("yesterday", "%s/%s" % (yesterday.month, yesterday.day))
        message = message.replace("tomorrow", "%s/%s" % (tomorrow.month, tomorrow.day))
        
        message = message.replace("this weekend", "%s" % this_weekend)
        message = message.replace("next week", "%s" % next_week)
        message = message.replace("next month", "%s" % next_month)
        message = message.replace("next monday", "%s" % next_monday)
        message = message.replace("next tuesday", "%s" % next_tuesday)
        message = message.replace("next friday", "%s" % next_friday)
        message = message.replace("next saturday", "%s" % next_saturday)
        message = message.replace("next sunday", "%s" % next_sunday)
        
        message = message.replace("morning", "%s" % morning)
        message = message.replace("afternoon", "%s" % afternoon)
        message = message.replace("evening", "%s" % evening)
        message = message.replace("night", "%s" % night)
        
        in_x_days = re.compile("(?P<in_x_days>in (?P<x_only>\d+) days)")
        search_result = in_x_days.search(message)
        if search_result:
            days = int(search_result.group('x_only'))
            x_days = tweet_time + relativedelta.relativedelta(days=+days)
            message = in_x_days.sub('%s/%s'%(x_days.month, x_days.day), message)

        try:
            return parser.parse(message, fuzzy=True, default=tweet_time)
        except:
            return tweet_time

    @classmethod
    def make(klass, message, twitter_user, tweet_link=None, tweet_id=None, tweet_time=None, when=None):
        """
        """ 
        if not tweet_time:
            tweet_time = datetime.datetime.today()
        if not when:
            when = tweet_time
        return Meeting(when=when,
                       twitter_user=twitter_user,
                       message=message,
                       tweet_id=tweet_id,
                       tweet_link=tweet_link,
                       tweet_time=tweet_time)

    def __unicode__(self):
        return "%s --> %s: %s" % (self.when, self.tweet_time, self.message)

class MeetingMixin(object):
    
    def add_meeting(self, message):
        when = Meeting.extract_time(message)
        return Meeting.add(message=message, twitter_user=self, when=when)

    def add_tweet(self, tweet, tweet_link=None, tweet_id=None, tweet_time=None):
        when = Meeting.extract_time(tweet, tweet_time=tweet_time)
        try:
            not_equal = (when != tweet_time)
        except:
            not_equal = True
        if when and tweet_time and not_equal:
            return Meeting.add(message=tweet,
                               twitter_user=self,
                               tweet_link=tweet_link,
                               tweet_id=tweet_id,
                               tweet_time=tweet_time,
                               when=when)
        else:
            return None

    def get_tweet(self, tweet_id):
        tweets = self.meeting_set.filter(tweet_id=tweet_id)
        if tweets:
            return tweets[0]
        else:
            return None

ALL_MODELS = [Meeting]
