from django import template
template.add_to_builtins("django.contrib.markup.templatetags.markup")

from models import Link, LinkMixin
from django.db import models as django_models

ALL_MODELS = [Link]

from lib import model_utils
model_utils.mixin(model_utils.ModelMixin, ALL_MODELS)

from lib.admins import Adminizer
Adminizer.Adminize(ALL_MODELS)

LINKABLE_MODELS = []
def InitializeModels(klasses):
    """
    @summary: Mixes the textful fields (title, summary, description) and 
    LinkMixin methods into the specified model
    """
    if not isinstance(klasses, (list, tuple)):
        klasses = (klasses,)
    for model in klasses:
        model.add_to_class('title', django_models.CharField(max_length=255))
        model.add_to_class('slug', django_models.SlugField())
        model.add_to_class('summary', django_models.TextField(blank=True))
        model.add_to_class('description', django_models.TextField(blank=True))
        # TODO markdown, ReST, textile choice
        model.add_to_class('links', django_models.ManyToManyField(Link, blank=True, null=True))
        if not hasattr(model, 'admin_options'):
            model.add_to_class('admin_options', {})
        model.admin_options.update({
            'prepopulated_fields': {'slug': ('title','summary') }
            })

        model_utils.mixin(LinkMixin, model)
