from models import Vote, TotalVote, VoteType, VoteMixin, TotalVoteMixin

ALL_MODELS = [Vote, TotalVote, VoteType]

Vote.Initialize()
TotalVote.Initialize()

from lib import model_utils
model_utils.mixin(model_utils.ModelMixin, ALL_MODELS)

from lib.admins import Adminizer
Adminizer.Adminize(VoteType)

VOTABLE_MODELS = []
def InitializeModels(klasses):
    """
    @summary: Mixes the Vote and TotalVote mixins into the
    classes in klasses.
    @param klasses: may be a single class or list of classes 
    """
    if not isinstance(klasses, (list, tuple)):
        klasses = (klasses,)
    for model in klasses:
        VOTABLE_MODELS.append(model)
        model_utils.mixin(VoteMixin, model)
        model_utils.mixin(TotalVoteMixin, model)

