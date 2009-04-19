

var MTCOMMON = {
	
	
	
	getChildById: function(el, id){
		// Scan children of el until find one with id
		var els = el.getElementsByTagName("*");
		for( var i = 0; i < els.length; i++ ){
			if( els[i].id==id ) return els[i];
		}
		return null;
	},
	
	getHead: function(useBody){
		var el = document.getElementsByTagName("HEAD");
		if( el ){
			el = el[0];
		}else if(useBody){
			el = document.body;
		}
		return el;
	},
	
	cloneObject: function(o){
		var n = {};
		for( p in o ){
			if( o.hasOwnProperty(p) ){
				n[p] = o[p];
			}
		}
		return n;
	},
	
	addUniqueJS: function(src){
		// Make sure no SCRIPT already exists with this src, and add it
		// If fTest and fOnLoad, periodically test fTest, once true, run fOnLoad
		
		var els = document.getElementsByTagName('script');
		for( var i = 0; i < els.length; i++ ){
			if( els[i].getAttribute("src")==src ){
				return;
			}
		}
		
		// Not found, add it:
		var elScript = document.createElement("SCRIPT");
		MTCOMMON.getHead(true).appendChild( elScript );
		elScript.type = "text/javascript";
		elScript.src = src;
		
		return elScript;		
	},
	
	xmlHttpRequest: function(url, method, statechange, send, contentType){
		if( window.XMLHttpRequest ){
			req = new XMLHttpRequest();
		}else if( window.ActiveXObject ){
			req = new ActiveXObject("Microsoft.XMLHTTP");
		}
		if( !req ) return;
		
		var fStateChange = function(){	// Ensure request is passed in
				statechange( req );
			};
		
		req.open("GET", url);
		req.setRequestHeader("Content-Type", contentType);
		req.onreadystatechange = statechange.bind(this);
		req.send(send);
	},
	
	bindAsEventListener: function(object, method) {
		return function (event) {
			method.call(object, event || window.event);
		};
	},
	bind: function(object, method) {		
		return function(){
			method.apply(object, arguments);
		};
	},

	element: function(event){
		return event.target || event.srcElement;
	},
	
	doMouseEvent: function(ElToClick, eventType, buttonNumber, clientX, clientY){
		// Not in prototype
		if( !buttonNumber ) buttonNumber = 0;
		if( !clientX ) clientX = 0;
		if( !clientY ) clientY = 0;
		
		var clickEvent = document.createEvent('MouseEvents');
		//clickEvent.initMouseEvent(eventType, true, true, document.defaultView, 1, 0, 0, clientX, clientY, false, false, false, false, buttonNumber, null); 
		clickEvent.initMouseEvent(eventType, true, true, document.defaultView, 1, 0, 0, clientX, clientY, false, false, false, false, buttonNumber, null); 
		ElToClick.dispatchEvent( clickEvent );
	},

	pointerX: function(event) {
		return event.pageX || (event.clientX + (document.documentElement.scrollLeft || document.body.scrollLeft));
	},

	pointerY: function(event) {
		return event.pageY || (event.clientY + (document.documentElement.scrollTop || document.body.scrollTop));
	},

	stop: function(event) {
		if (event.preventDefault) {
			event.preventDefault();
			event.stopPropagation();
		} else {
			event.returnValue = false;
			event.cancelBubble = true;
		}
	},
	
	realOffset: function(element) {
		// From viewport?
		var valueT = 0, valueL = 0;
		do {
			valueT += element.scrollTop  || 0;
			valueL += element.scrollLeft || 0;
			element = element.parentNode;
		} while (element);
		return [valueL, valueT];
	},

	cumulativeOffset: function(element) {
		// From top of page
		var valueT = 0, valueL = 0;
		do {
			valueT += element.offsetTop  || 0;
			valueL += element.offsetLeft || 0;
			element = element.offsetParent;
		} while (element);
		return [valueL, valueT];
	},

	pageScrollOffset: function(){
		var deltaX =  window.pageXOffset
					|| document.documentElement.scrollLeft
					|| document.body.scrollLeft
					|| 0;
		var deltaY =  window.pageYOffset
					|| document.documentElement.scrollTop
					|| document.body.scrollTop
					|| 0;
		return [deltaX, deltaY];
	},

	within: function(element, x, y) {
		var offset = MTCOMMON.cumulativeOffset(element);

		return (y >= offset[1] &&
				y <  offset[1] + element.offsetHeight &&
				x >= offset[0] &&
				x <  offset[0] + element.offsetWidth);
	},
	withinIncludingScrolloffsets: function(element, x, y) {
   	var deltaX =  window.pageXOffset
                || document.documentElement.scrollLeft
                || document.body.scrollLeft
                || 0;
    var deltaY =  window.pageYOffset
                || document.documentElement.scrollTop
                || document.body.scrollTop
                || 0;
                
	var offsetcache = MTCOMMON.realOffset(element);
    var xcomp = x + offsetcache[0] - deltaX;
    var ycomp = y + offsetcache[1] - deltaY;
    var offset = MTCOMMON.cumulativeOffset(element);
    
    //alert(offset + "\n" + "\n" + element.offsetWidth + "," + element.offsetHeight + "\n" + xcomp + " & " + ycomp);

    return (ycomp >= offset[1] &&
            ycomp <  offset[1] + element.offsetHeight &&
            xcomp >= offset[0] &&
            xcomp <  offset[0] + element.offsetWidth);
  },
	
	getStyle: function(element, style) {
		var value = element.style[style];
		if (!value) {
			if (document.defaultView && document.defaultView.getComputedStyle) {
				var css = document.defaultView.getComputedStyle(element, null);
				value = css ? css.getPropertyValue(style) : null;
			} else if (element.currentStyle) {
				value = element.currentStyle[style];
			}
		}
		if (window.opera && MTCOMMON.getStyle(element, 'position') == 'static' ){
			var dimensions = ['left', 'top', 'right', 'bottom'];
			for( var i = 0; i < dimensions.length; i++ ){
				if( style==dimensions[i] ){
					value = "auto";
					break;
				}
			}
		}

		return value == 'auto' ? null : value;
	},

	getDimensions: function(element){
		if(!element || this.getStyle(element, 'display') != 'none')
		return {width: element.offsetWidth, height: element.offsetHeight};

		// All *Width and *Height properties give 0 on elements with display none,
		// so enable the element temporarily
		var els = element.style;
		var originalVisibility = els.visibility;
		var originalPosition = els.position;
		els.visibility = 'hidden';
		els.position = 'absolute';
		els.display = '';
		var originalWidth = element.clientWidth;
		var originalHeight = element.clientHeight;
		els.display = 'none';
		els.position = originalPosition;
		els.visibility = originalVisibility;
		return {width: originalWidth, height: originalHeight};
	},
	
	viewport: function(){
		var browserWidth = 0;
		var browserHeight = 0;
		if( self.innerWidth ){
			browserWidth = self.innerWidth;
			browserHeight = self.innerHeight;
		}else if( document.documentElement && document.documentElement.clientWidth ){
			browserWidth = document.documentElement.clientWidth;
			browserHeight = document.documentElement.clientHeight;
		}else{
			browserWidth = document.body.clientWidth;
			browserHeight = document.body.clientHeight;
		}
		
		return [browserWidth, browserHeight];
	},
	

	browserViewport: function(win, doc, useScrollOffset){
		if( !win ) win = window;
		if( !doc ) doc = document;
		
		var browserWidth = 0;
		var browserHeight = 0;
		if( self.innerWidth ){
			browserWidth = self.innerWidth;
			browserHeight = self.innerHeight;
		}else if( document.documentElement && doc.documentElement.clientWidth ){
			browserWidth = doc.documentElement.clientWidth;
			browserHeight = doc.documentElement.clientHeight;
		}else{
			browserWidth = doc.body.clientWidth;
			browserHeight = doc.body.clientHeight;
		}
		
		if( useScrollOffset ){
			var deltaX =  win.pageXOffset
						|| doc.documentElement.scrollLeft
						|| doc.body.scrollLeft
						|| 0;
			var deltaY =  win.pageYOffset
						|| doc.documentElement.scrollTop
						|| doc.body.scrollTop
						|| 0;
			browserWidth -= deltaX;
			browserHeight -= deltaY;
		}
		
		return [browserWidth, browserHeight];
	},
	
	getBorderWidth: function(el){
		// Return the width, in pixels, of the border
				
		var borderWidth = MTCOMMON.getStyle( el, "borderWidth" );
		if( !borderWidth ) borderWidth = MTCOMMON.getStyle( el, "border" );
		var borderStyle = MTCOMMON.getStyle( el, "borderStyle" );
		if( borderStyle && borderStyle.indexOf("none")==-1 && borderWidth && (borderWidth = borderWidth.match(/(\d)px/)) ){
			borderWidth = parseInt(borderWidth[1]);
		}else{
			borderWidth = 0;
		}
		
		return borderWidth;
	}
	
	
}