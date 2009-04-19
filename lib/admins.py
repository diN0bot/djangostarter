from django.contrib import admin
import settings

"""
"""

class Adminizer(object):
    """
    """
    
    @classmethod
    def _model_admin_class(cls, options):
        """
        @summary: returns an admin.ModelAdmin class with the specified 
        ModelAdmin options set. see:
            http://docs.djangoproject.com/en/dev/ref/contrib/admin/#modeladmin-options
        @param options: dictionary of ModelAdmin options. key should be string 
            that corresponds to option name (eg, 'date_hierarchy'). value should be
            intended value for field.
        @return: sub-class of admin.ModelAdmin
        """
        class klass(admin.ModelAdmin):
            pass
        for field_name, field_value in options.items():
            setattr(klass, field_name, field_value)
        return klass
    
    @classmethod
    def Adminize(cls, klasses):
        """
        """
        if not isinstance(klasses, (list, tuple)):
            klasses = (klasses,)
        for klass in klasses:
            if hasattr(klass, 'admin_options'):
                options = klass.admin_options
            else:
                options = {}
            admin_klass = cls._model_admin_class(options)
            admin.site.register(klass, admin_klass)
