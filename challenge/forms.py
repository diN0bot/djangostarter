from django.forms import * #Form, ModelForm, CharField, EmailField
from django.forms.models import modelformset_factory
from django.core.urlresolvers import reverse

from django.contrib.auth.tokens import default_token_generator
from django.template import Context, loader
from django.utils.http import int_to_base36

from challenge.models import *

"""
We want to create three kinds of forms:
1. Admin<Model>Form  admin forms.     these have all fields and are used for both creation and editing
2. New<Model>Form    user new forms.  these exclude hidden or contextually obvious fields (eg state, a review's node)
3. Edit<Model>Form   user edit forms. these exclude hidden fields
"""
def model_form_class(_model, excludes=None):
    class klass(ModelForm):
        class Meta:
            model = _model
            if excludes:
                exclude = excludes
    return klass

new_forms_excludes = {'Node':('url',),
                      'Behavior':('node','weight','url'),
                      'UPC':('node', 'upc_image'),
                      'NodeTypeCast':('node',),
                      'Article':('source',),
                      'Response':('behavior','parent','url'),
                      }
edit_forms_excludes = {'Behavior':('node','url','weight'),
                       'Node':('url',),
                       'Article':('source',),
                       'Response':('behavior','parent','url'),
                      }

# exec, exec, what a wond'ful word, exec 
for m in []:#settings.ALL_MODELS:
    mname = m.__name__
    if m in State.STATEFUL_MODELS:
        state_excludes = ('state',)
    else:
        state_excludes = ()
    # 1. admin form
    exec('Admin%sForm = model_form_class(m, state_excludes)' % mname )

    # 2. new form
    if mname in new_forms_excludes:
        excludes = state_excludes + new_forms_excludes[mname]
    else:
        excludes = state_excludes
    exec('New%sForm = model_form_class(m, excludes)' % mname )
    # 3. edit form
    if mname in edit_forms_excludes:
        excludes = state_excludes + edit_forms_excludes[mname]
    else:
        excludes = state_excludes
    exec('Edit%sForm = model_form_class(m, excludes)' % mname )
