
from models import Tag
from django.db import models as django_models

ALL_MODELS = [Tag]

from lib import model_utils
model_utils.mixin(model_utils.ModelMixin, ALL_MODELS)

from lib.admins import Adminizer
Adminizer.Adminize(ALL_MODELS)

TAGABLE_MODELS = []
def InitializeModels(klasses):
    """
    @summary: Mixes the textful fields (title, summary, description) and 
    LinkMixin methods into the specified model
    """
    if not isinstance(klasses, (list, tuple)):
        klasses = (klasses,)
    for model in klasses:
        model_utils.mixin(LinkMixin, model)
