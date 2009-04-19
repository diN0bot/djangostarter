from lib.view_utils import * 
from challenge.models import *

from django.core.urlresolvers import reverse

from django import template
template.add_to_builtins("challenge.templatetags.macros")
template.add_to_builtins("django.contrib.markup.templatetags.markup")

def main(request):
    
    return HttpResponseRedirect(reverse('about'))

def challenge(request, challenge_slug):
    challenge = Challenge.get_or_none(slug=challenge_slug)
    return render_response(request, 'challenge/challenge.html', locals())
    
def challenge_list(request):
    challenges = Challenge.objects.all()
    c = reverse('challenge', args=(challenges[0].slug,))
    return render_response(request, 'challenge/challenge_list.html', locals())

def about(request):
    return render_response(request, 'challenge/about.html', locals())
