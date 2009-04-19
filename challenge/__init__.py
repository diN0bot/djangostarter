

from models import Challenge, Solution
ALL_MODELS = [Challenge, Solution]

from lib import model_utils
model_utils.mixin(model_utils.ModelMixin, ALL_MODELS)

from lib.admins import Adminizer
Adminizer.Adminize(ALL_MODELS)

import textful
textful.InitializeModels(ALL_MODELS)

import vote
vote.InitializeModels(ALL_MODELS)
