from models import TwitterUser, Comment
ALL_MODELS = [TwitterUser, Comment]

from lib import model_utils
model_utils.mixin(model_utils.ModelMixin, ALL_MODELS)

from lib.admins import Adminizer
Adminizer.Adminize(ALL_MODELS)

for model in ALL_MODELS:
    if hasattr(model, 'Initialize'):
        model.Initialize()

from django.template import add_to_builtins
add_to_builtins('twitter.templatetags.macros')
