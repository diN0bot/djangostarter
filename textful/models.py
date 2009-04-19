"""

"""

from django.db import models

from lib import model_utils

import re

class Link(models.Model):
    """
    @summary: Model that keeps track of url links. Intended as M2M recipient.
    """
    url = models.URLField()
    # domain of url
    source = models.CharField(max_length=255)
    # regex for extracting domain
    #domain_re = re.compile('https?://([^ /]*)')
    __domain_re = re.compile('^([^ /]*//[^ /]*)')

    @classmethod
    def make(klass, url):
        """
        """ 
        link = Link.get_or_none(url=url)
        if link:
            raise model_utils.AlreadyExists("Link %i already exists for url %s" % (link.id, url))
        else:
            domain = domain_re.search(url).group()
            return Link(url=url, source=domain)

    def __unicode__(self):
        return "link:%s, url:%s, source:%s" % (self.id, self.url, self.source)

class LinkMixin(object):
    """
    @summary:
    B{LinkMixin} is a mix-in used to provide common methods, attributes,
    and hooks to all the models that can be given L{Link}s.
    """
        
    def add_link(self, url):
        """
        @summary: adds link to the specified item
        """
        self.add(Link.add(url))

