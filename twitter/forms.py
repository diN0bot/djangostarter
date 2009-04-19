from django.forms import ModelForm

"""
We want to create three kinds of forms:
1. Admin<Model>Form  admin forms.     these have all fields and are used for both creation and editing
2. New<Model>Form    user new forms.  these exclude hidden or contextually obvious fields (eg state, a review's node)
3. Edit<Model>Form   user edit forms. these exclude hidden fields
"""
# shows all fields
ADMIN_TYPE = 'admin'
# user facing form for creating new instance
NEW_TYPE = 'new'
# user facing form for editing existing instance
EDIT_TYPE = 'edit'

# users should not reference this directly.
# instead, use get_form
FORMS = { ADMIN_TYPE: {},
          NEW_TYPE: {},
          EDIT_TYPE: {},
          }

def get_form(model, type=ADMIN_TYPE, excludes=None, fields=None):
    """
    @param excludes: in addition to type-based excludes. for on-the-fly forms. 
    @param fields: for on-the-fly forms. 
    return form class for model and type
    """
    if model in FORMS[type] and not excludes and not fields:
        # don't cache on-the-fly forms
        form = FORMS[type][model]
    else:
        mname = model.__name__
        excludes = excludes or ()
        
        if type == ADMIN_TYPE:
            exec('Admin%sForm = model_form_class(model, excludes, fields)' % mname )
            form = locals()['%sForm' % mname]
                
        elif type == NEW_TYPE:
            if mname in new_forms_excludes:
                excludes += new_forms_excludes[mname]
            exec('New%sForm = model_form_class(model, excludes, fields)' % mname )
            form = locals()['New%sForm' % mname]

        elif type == EDIT_TYPE:
            if mname in edit_forms_excludes:
                excludes += edit_forms_excludes[mname]
            exec('Edit%sForm = model_form_class(model, excludes, fields)' % mname )
            form = locals()['Edit%sForm' % mname]
            
        else:
            raise "Type no good"
        
        if not excludes and not fields:
            # don't cache on-the-fly forms
            FORMS[type][model] = form
    
    return form


def model_form_class(_model, excludes=None, _fields=None):
    class klass(ModelForm):
        class Meta:
            model = _model
            if excludes:
                exclude = excludes
            if _fields:
                fields = _fields
    return klass

new_forms_excludes = {#'Node':('url',),
                      #'Behavior':('node','weight','url'),
                      }

edit_forms_excludes = {'WeatherImage':('theme','code','thumbnail_width','thumbnail_height'),
                      }
