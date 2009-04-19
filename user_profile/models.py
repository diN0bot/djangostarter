from django.db import models
from django.contrib.auth.models import User

from lib.model_utils import *

class Profile(models.Model):
    user = models.ForeignKey(User, unique=True)
    phone_number = models.CharField(max_length=30, blank=True)

    # human readable
    location = models.CharField(max_length=255, blank=True)
    # for calculations. user enters by marking google map, or lookup from location
    lat = models.FloatField(blank=True, null=True)
    lng = models.FloatField(blank=True, null=True)
    
    # Valid Backgrounds
    BACKGROUNDS = {'TREE':'T',
                   'PUPPY':'P',
                   }
    # for database (data, friendly_name)
    BACKGROUND_CHOICES = (
                     (BACKGROUNDS['TREE'], 'tree.jpg',),
                     (BACKGROUNDS['PUPPY'], 'puppy.jpg',),
                     )
    background = models.CharField(max_length=1, choices=BACKGROUND_CHOICES, default=BACKGROUNDS['TREE'])

    @classmethod
    def make(klass, user, phone_number=""):
        profile = Profile.get_or_none(user=user)
        if profile:
            raise AlreadyExists("Profile %i already exists for user %s" % (profile.id, user))
        else:
            return Profile(user=user, phone_number=phonenumber)

    def __unicode__(self):
        return "profile for %s, phone: %s" % (self.user, self.phone_number)


class UserMessage(models.Model):
    """
    Messages to user.
    Can be used for:
       * messages from app; eg "Successfully skinned a cat. <a href='...'>undo</a>"
       * direct messages between users
    """
    user = models.ForeignKey(User) # recipient
    sender = models.ForeignKey(User, null=True, related_name="usermessage_sender")
    message = models.TextField()
    unread = models.BooleanField(default = True)
    
    def read(self):
        """
        change state to read (unread=False) and return message
        """
        self.unread = False
        self.save()
        return self.message
    
    @classmethod
    def unread_messages(klass, user=None):
        """
        returns unread messages for user or current_user() if unspecified
        if user is not authenticated (anonymous), then return empty list
        """
        user = user or current_user()
        if user.is_authenticated():
            return UserMessage.objects.filter(user=user, unread=True)
        else:
            return []
        
    @classmethod
    def add(klass, msg, user=None, sender=None):
        """
        Adds UserMessage for user or current_user if unspecified.
        Does nothing if user is anonymous.
        sender is None if from our own app as opposed to another user
        """
        user = user or current_user()
        if user.is_authenticated():
           UserMessage(user=user, message=msg, unread=True, sender=sender).save() 
