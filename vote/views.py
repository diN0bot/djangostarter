"""
"""

from models import *

class VoteOnUnknownModel(RuntimeError): pass
class VoteOnUnknownObject(RuntimeError): pass
class VoteOnUnknownVoteType(RuntimeError): pass

def vote(reqest, model_name, obj_id, votetype_name):
	"""
	Toggles vote for votetype for current user
	"""
	if not votetype_name:
		raise VoteOnUnknownVoteType()
	votetype = VoteType.get_or_none(name=votetype_name)
	
	m = _get_obj(model_name, obj_id)
	
	return _do_vote(m, votetype)
	

def thumb_up(request, model_name, obj_id):
	"""
	Toggles default good votetype
	"""
	votetype = VoteType.DEFAULT_GOOD()
	
	m = _get_obj(model_name, obj_id)

	return _do_vote(m, votetype)
	
def thumb_down(request, model_name, obj_id):
	"""
	Toggles default bad votetype
	"""
	votetype = VoteType.DEFAULT_BAD()
	
	m = _get_obj(model_name, obj_id)

	return _do_vote(m, votetype)

def _do_vote(obj, votetype):
	has_voted = m.vote(votetype)
	return json_response({'has_voted': has_voted})
	  
def _get_obj(mode_name, obj_id):
	if not model_name in model_dict:
		raise VoteOnUnknownModel()

	model = VOTABLE_MODELS[model_name]
	m = model.get_or_none(id=obj_id)
	
	if not m:
		raise VoteOnUnknownObject()
	
	return m

def vote_POST(request):
	"""
	Convenience method. Calls vote
	"""
	model_name = request.POST.get('model', None)
	obj_id = int(request.POST.get('obj_id', None))
	votetype_name = request.POST.get('votetype', None)
	return vote(request, model_name, obj_id, votetype_name)

def vote_GET(request):
	"""
	Convenience method. Calls vote
	"""
	model_name = request.GET.get('model', None)
	obj_id = int(request.GET.get('obj_id', None))
	votetype_name = request.GET.get('votetype', None)
	return vote(request, model_name, obj_id, votetype_name)

def thumb_up_POST(request):
	"""
	Convenience method. Calls thumbs_up
	"""
	model_name = request.POST.get('model', None)
	obj_id = int(request.POST.get('obj_id', None))
	return thumb_up(request, model_name, obj_id)

def thumb_up_GET(request):
	"""
	Convenience method. Calls thumbs_up
	"""
	model_name = request.GET.get('model', None)
	obj_id = int(request.GET.get('obj_id', None))
	return thumb_up(request, model_name, obj_id)

def thumb_down_POST(request):
	"""
	Convenience method. Calls thumb_down
	"""
	model_name = request.POST.get('model', None)
	obj_id = int(request.POST.get('obj_id', None))
	return thumb_down(request, model_name, obj_id)

def thumb_down_GET(request):
	"""
	Convenience method. Calls thumb_down
	"""
	model_name = request.GET.get('model', None)
	obj_id = int(request.GET.get('obj_id', None))
	return thumb_down(request, model_name, obj_id)
