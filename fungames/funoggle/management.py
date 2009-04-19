from django.dispatch import dispatcher
from django.db.models import signals

import models

"""
@summary: Install initial data when models are first created.

Automatically called by django. 
Find out more be searching for "management.py" and "Extra special stuff" in 
    http://www.b-list.org/weblog/2006/sep/10/django-tips-laying-out-application/
document on wiki:
    http://bilumi.org/trac/wiki/PostSyncdbInstall
"""

def post_syncdb(signal, sender, app, created_models, **kwargs):
    # only run when models we care about are first created
    if signal == signals.post_syncdb and app == models:
        for model in models.ALL_MODELS:
            if hasattr(model, 'install'):
                if kwargs['verbosity'] > 0:
                    print "Installing ", model
                model.install()

signals.post_syncdb.connect(post_syncdb)