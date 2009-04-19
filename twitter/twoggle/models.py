from django.db import models
from twitter.models import TwitterUser

from django.conf import settings
import re, os

__all__ = ['Game']


class GamePlay(models.Model):
    player = models.ForeignKey(TwitterUser)
    startdate = models.DateTimeField(autoadd=True)
    score = models.IntegerField(default=0)
    answers = models.ManyToManyField(Answer, null=True, blank=True)
    wrongs = models.ManyToManyField(Wrong, null=True, blank=True)

class Answer(models.Model):
    word = models.CharField(max_length=32)
    points = models.IntegerField(default=1)
    
class Wrong(models.Model):
    word = models.CharField(max_length=32)

class Game(models.Model):
    # letters from which to make words
    letters = models.CharField(max_length=64)
    # range 0-10
    difficulty = models.IntegerField(default=2)
    # duration of game, if there is one
    duration = models.TimeField
    # name of game, since we don't want to reveal letters in case others play later.
    name = models.CharField(max_length=64)

    class Meta:
        ordering = ('name',)
    
    @classmethod
    def make(klass, k):
        """
        Auto creates slug field:
           lower case
           spaces --> underscores
           removes [^\w_\-]
           appends '_1' if a theme with same slug already exists,
               '_2' if two themes with same slug already exists, etc
        """
        p = re.compile('[^\w_\-]')
        slug = p.sub('', name.lower().replace(' ', '_'))
        slug_siblings = Theme.objects.filter(slug__startswith=slug)
        if slug_siblings:
            # TODO. these numbers are not safe if themes get deleted...
            slug = "%s_%s" % (slug, slug_siblings.count())

        return Theme(name=name, author=author, slug=slug)

    @classmethod
    def create_default(klass, name, author=None):
        theme = Theme.add(name, author)
        
        s = "cp -rf %s%s/default %s%s/%s" % (settings.MEDIA_ROOT,
                                             WeatherImage.IMAGE_UPLOAD_PATH,
                                             settings.MEDIA_ROOT,
                                             WeatherImage.IMAGE_UPLOAD_PATH,
                                             theme.slug)
        # execute cp 
        os.system(s)

        for ir in ImageRedirect.roots():
            WeatherImage.add(code=ir.code, theme=theme, image='transparent.png')
        
        return theme
    
    def __unicode__(self):
        return "%s by %s (%s images)" % (self.name, self.author, len(self.core_images) + len(self.extra_images))

ALL_MODELS = [Game]
