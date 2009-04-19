
import graph

"""
@summary:
The B{search} module will contain the general functionality for
whatever full-text searching solution we end up implementing.  For
right now, it's just a shell, providing empty I{#search} methods
on searchable models.
"""

class Search(object):
    """
    @summary:
    The Search class is just a placeholder for any global search methods needed.
    Most search methods should be found in the SearchMixin class. 
    
    @cvar  SEARCHABLE_MODELS: 
    @type SEARCHABLE_MODELS: list<models.Model>
    """
    SEARCHABLE_MODELS = [
        graph.Node, graph.Edge, graph.Response,
        graph.Dimension, graph.Behavior, graph.UPC,
        graph.Article, ]
    
    @staticmethod
    def Initialize():
        """
        @summary: 
        Applies SearchMixin to searchable models specified in Search.SEARCHABLE_MODELS
        
        @return:  None
        @rtype:   NoneType
        """
        mixin(SearchMixin, Search.SEARCHABLE_MODELS)


class SearchMixin(object):
    """
    @summary:
    B{SearchMixin} is a mix-in used to provide common methods, attributes,
    and hooks to all the models that can be full-text-searched.  The list
    of these objects can be found at L{search.Search}.
    
    At initialization, SearchMixin is applied to all the models listed in L{search.Search}.
    """
    @classmethod
    def search(klass, terms):
        """
        @summary: Returns objects containing the specified terms within one
        of their searchable (string) fields.
        
        @return: 
        @rtype:  QuerySet
        """
        return klass.objects.none()
    
