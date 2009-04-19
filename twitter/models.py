from django.db import models

from lib.model_utils import TextProcessor
from twitter.twitter_lib.twitter import Api

from urllib2 import HTTPError

import datetime

class TwitterUser(models.Model):
    twitter_username = models.CharField(max_length=100)
    
    twitter_user_id = models.IntegerField(blank=True, null=True)
    profile_img_url = models.URLField(blank=True, null=True)
    profile_background_img_url = models.URLField(blank=True, null=True)
    profile_background_tile = models.BooleanField(default=True)
    description = models.CharField(max_length=255, blank=True, null=True)
    twitter_name = models.CharField(max_length=100, blank=True, null=True) 
    last_tweet = models.CharField(max_length=150, blank=True, null=True) 
    location = models.CharField(max_length=255, blank=True, null=True)
    zipcode = models.CharField(max_length=31, blank=True, null=True)
    
    last_tweet_poll = models.DateTimeField()
    
    password = models.CharField(max_length=218, blank=True, null=True)

    friends = models.ManyToManyField('TwitterUser', blank=True, null=True)
            
    class Meta:
        ordering = ('twitter_username', )

    def add_friend(self, twitter_friend):
        if not isinstance(twitter_friend, TwitterUser):
            tf = TwitterUser.get_or_none(twitter_username=twitter_friend)
            if not tf:
                tf = TwitterUser.add(twitter_friend)
            twitter_friend = tf

        self.friends.add(twitter_friend)
        return twitter_friend
        
    def remove_friend(self):
        if not isinstance(twitter_friend, TwitterUser):
            tf = TwitterUser.get_or_none(twitter_username=twitter_friend)
            if not tf:
                return
            twitter_friend = tf
        
        self.friends.remo(twitter_friend)

    @property
    def meetings(self):
        self.meeting_set

    @classmethod
    def make(klass, twitter_username, password=None):
        """
        """
        #import traceback
        #print traceback.extract_stack()
        
        twitteruser = TwitterUser.get_or_none(twitter_username__iexact=twitter_username)
        if twitteruser:
            raise "TwitterUser with username %s already exists (id=%s)" % (twitter_username, twitteruser.id)
        else:
            return TwitterUser(twitter_username=twitter_username, last_tweet_poll=datetime.datetime(1900, 1, 1, 0, 0, 0), password=password)

    def get_user_data(self):

        try:
            api = Api()
            user = api.GetUser(self.twitter_username)
            self.profile_img_url = user.GetProfileImageUrl()
            self.profile_background_img_url = user.profile_background_image_url
            print user.profile_background_image_url
            self.profile_background_tile = user.profile_background_tile
            self.description = user.GetDescription()
            if user.GetStatus():
                self.last_tweet = user.GetStatus().GetText()
            self.twitter_user_id = user.GetId()
            self.twitter_name = user.GetName()
            self.location = user.GetLocation()
            #self.last_tweet_poll = datetime.datetime.now()
            self.save()
            return True
        
        except HTTPError:
            return False

    def __unicode__(self):
        return "%s" % (self.twitter_username)


class Comment(models.Model):
    """
    """
    time = models.DateTimeField(auto_now_add=True)
    message = models.TextField()
    twitter_user = models.ForeignKey('TwitterUser', null=True, blank=True)
    parent = models.ForeignKey('self', null=True, blank=True, related_name='children')
    
    key = models.CharField(max_length=64)
    
    class Meta:
        ordering = ('-time', )
    
    @classmethod
    def Initialize(klass):
        models.signals.pre_save.connect(TextProcessor.remove_html, sender=Comment)

    @classmethod
    def textprocessor_fieldname(klass):
        return 'message'
    
    @classmethod
    def make(klass, message, twitter_user, key, parent=None):
        return Comment(message=message, twitter_user=twitter_user, key=key, parent=parent)
    
    @classmethod
    def root_comments(klass, key):
        return Comment.objects.filter(key=key, parent=None)
    
    @property
    def responses(self):
        return self.children.all()

    def __unicode__(self):
        if self.parent:
            parentid = self.parent.id
        else:
            parentid = "None"
        return "%s. %s says %s (%s)" % (self.id, self.twitter_user, self.message, parentid)

ALL_MODELS = [Comment, TwitterUser]
