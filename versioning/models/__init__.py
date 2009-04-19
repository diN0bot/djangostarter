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

ACTING_MODELS = []
def Initialize(klass):
    """
    @summary: B{_apply} takes a list of models and to each model it:
        1. adds B{ActionTarget} as a base class (in I{__bases__}) to
            provide a common interface to the models;
        2. assigns an instance of ActionTargetManager to I{actions}
            which limits the scope to within a single model
        3. registers listeners to call methods in L{Log} regarding events
            on subclassed models; specifically:
                1. L{Log.log_save} is called before a row is saved
                2. L{Log.log_create} is called after a row is created
                3. L{Log.log_delete} is called before a row is deleted
                    (this should not happen.)
    
    @return: None
    @rtype:  NoneType
    """
    if not isinstance(klasses, (list, tuple)):
        klasses = (klasses,)
    for model in klasses:
        ACTING_MODELS.append(model)
        model_utils.mixin(ActionMixin, model)
    
    for model_class in Action.ACTING_MODELS:
        models.signals.post_save.connect(Action.on_create, sender=model_class)
        models.signals.pre_delete.connect(Action.on_delete, sender=model_class)
