from django.db import models
import datetime

class Player(models.Model):
    user = models.ForeignKey('TwitterUser')
    playable = models.ForeignKey('Playable')
    
    # Valid Player Modes
    MODES = {'LOOKING':'L', # looking for playable to join (may end up starting game if none found)
                            # playable should be None
             'WAITING_TO_START':'W', # has joined playable but, but still waiting for other players to join
             'PLAYING':'P', # when playable ends, mode changes to FINISHED
             'MIA':'M', # not responding. when playable ends, mode changes to LEFT
             'SAVED':'S', # has indicated desire to save (aka pause) playable. playable may continue without
                          # player if others want to continue. if playable does end, mode changes
                          # to LEFT
             # no need for INVITED_TO_PLAY mode: no player instance is created; user is just messaged
             # 'INVITED_TO_PLAY':'I', # invited by friend
             'LEFT':'E', # left on-going playable. when playable ends, mode remains LEFT
             'FINISHED':'F' # playable is over
             }
    # for database (data, friendly_name)
    ACTION_CHOICES = (
                     (ACTIONS['LOOKING'], 'Looking to join playable'),
                     (ACTIONS['WAITING_TO_START'], 'Waiting for playable to start',),
                     (ACTIONS['PLAYING'], 'Playing',),
                     (ACTIONS['MIA'], 'Missing in action',),
                     (ACTIONS['SAVED'], 'Paused play',),
                     (ACTIONS['LEFT'], 'Left playable',),
                     (ACTIONS['FINISHED'], 'Finished',),
                     )
    
    type = models.CharField(max_length=1, choices=ACTION_CHOICES, default=ACTIONS['CREATED'])

    @classmethod
    def make(klass, twitter_username):
        """
        """
        twitteruser = TwitterUser.get_or_none(twitter_username__iexact=twitter_username)
        if twitteruser:
            raise "TwitterUser with username %s already exists (id=%s)" % (twitter_username, twitteruser.id)
        else:
            return TwitterUser(twitter_username=twitter_username, last_tweet_poll=datetime.datetime(1900, 1, 1, 0, 0, 0), password=password)

    def __unicode__(self):
        return "%s is playing %s" % (self.user.twitter_username, self.game.name)
    
class TwitterUse(models.Model):
    twitter_username = models.CharField(max_length=100)
    friends = models.ManyToManyField('TwitterUser', blank=True, null=True)
    
    points = models.IntegerField(defaul=0)
    points_per_week = models.IntegerField(defaul=0)
    points_per_day = models.IntegerField(defaul=0)
    level = models.IntegerField(default=0)
    
    # ddddd
    voice_mail_from_bot = models.ManyToManyField('Message_From_Bot')
    
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

    def add_points(self, points):
        """
        1. add points to points, /week and /day totals
        2. adjust level
        """
        pass

    @classmethod
    def make(klass, twitter_username):
        """
        """
        twitteruser = TwitterUser.get_or_none(twitter_username__iexact=twitter_username)
        if twitteruser:
            raise "TwitterUser with username %s already exists (id=%s)" % (twitter_username, twitteruser.id)
        else:
            return TwitterUser(twitter_username=twitter_username, last_tweet_poll=datetime.datetime(1900, 1, 1, 0, 0, 0), password=password)

    def __unicode__(self):
        return "%s" % (self.twitter_username)

ALL_MODELS = [Player, TwitterUser]
