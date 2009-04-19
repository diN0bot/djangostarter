import multipart
import base64
import urllib2

# Update profile background image
filename='../media/tcal/img/twitter_icon.jpg'
url='http://twitter.com/account/update_profile_background_image.json'
username=''
password=''

authstr = 'Basic ' + base64.encodestring('%s:%s' % (username, password)) .strip()

request = urllib2.Request(url)
request.add_header('Authorization', authstr)

body = multipart.Multipart()
filepart = multipart.FilePart({'name': 'image'}, filename, 'image/jpeg')
body.attach(filepart)
(header, value) = body.header()

request.add_data(str(body))
request.add_header(header, value)

response = urllib2.urlopen(request)
