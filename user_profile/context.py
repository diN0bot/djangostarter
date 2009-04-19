from models import UserMessage

def defaults(request):
    frame = {}
    frame.update(user_messages())
    return frame

def user_messages():
    return { 'user_messages': UserMessage.unread_messages() }