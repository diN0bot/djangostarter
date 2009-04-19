from django.db import models
from django.contrib.auth.models import User

from lib import model_utils

import re

class AlreadyExists(RuntimeError): pass

class Challenge(models.Model):
    """
    """
    
    def solutions(self):
        """
        """
        return Solution.find(challenge=self)

    @classmethod
    def make(klass, title, summary="", description=""):
        """
        """ 
        challenge = Challenge.get_or_none(title=title)
        if challenge:
            raise AlreadyExists("Challenge %i already exists for title %s" % (challenge.id, title))
        else:
            return Challenge(title=title, summary=summary, description=description)

    def __unicode__(self):
        return "%s: %s" % (self.id, self.slug)

class Solution(models.Model):
    """
    """
    challenge = models.ForeignKey(Challenge)
    
    @classmethod
    def make(klass, challenge, title, summary="", description=""):
        """
        """ 
        solution = Solution.get_or_none(challenge=challenge, title=title)
        if solution:
            raise AlreadyExists("Solution %i already exists for title %s and challenge %s" % (solution.id, title, challenge))
        else:
            return Solution(challenge=challenge, title=title, summary=summary, description=description)

    def __unicode__(self):
        return "%s: %s to %s" % (self.id, self.slug, self.challenge)
