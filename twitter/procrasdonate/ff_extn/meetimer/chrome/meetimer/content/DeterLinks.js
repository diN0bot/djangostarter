function DeterLinks(meeTimer){
	
	this.meeTimer = meeTimer;
	this.sp = meeTimer.sp;
	this.db = meeTimer.db;
	
	this.mtps = {};	// lookup on mtp id
	
	this.initialise();
	

}

DeterLinks.prototype.initialise = function(mtp){
	
	this.urls = this.sp.getDeterrentLinksUrls();
	
	this.hasUrls = false;
	for( url in this.urls ){
		this.hasUrls = true;
		break;
	}
	
	if( mtp ){
		// Reload the current page
		this.removeMtp(mtp);
		this.processPage(mtp);
	}
};

DeterLinks.prototype.test = function(urlPage, urlLink){
	// Return true if,
	// Return true if deter-misc (unless you're on a grouped site, or it points at a safe grouped site)
	// Return true if this page is in procrastination, or the link points to procrastination
	
	
	if( this.meeTimer.settings.currentMode!="deterrent" ) return false;
	if( this.meeTimer.settings.deterrent.linkIncMisc && !(this.meeTimer.groups.test(urlPage) || this.meeTimer.groups.test(urlLink))  ) return true;
	if(this.urls[urlPage] || this.urls[urlLink]) return true;
}


DeterLinks.prototype.processPage = function(mtp){
	// Parse the links on this page; adding the mouse move to them
	// Add each link/handler to the mtp

	if( this.meeTimer.settings.currentMode!="deterrent" ) return false;	// don't waste cpu
	if( !this.meeTimer.settings.deterrent.linkIncMisc && !this.hasUrls ) return false;	// can't be on
	if( !mtp.doc ) return;
	
	this.mtps[mtp.id] = mtp;
	
	
	var els = mtp.doc.evaluate("//a", mtp.doc, null, XPathResult.ANY_TYPE, null);
	
	mtp.deterLinks = {links:[]};
	
	var listener = MTCOMMON.bindAsEventListener(this, "onLinkMove");
	var listenerClick = MTCOMMON.bindAsEventListener(this, "onLinkClick");
	while( el = els.iterateNext() ){
		var url = this.meeTimer.urlMaps.lookup(el.href, null, {parseDomain:true});
		if( this.test(mtp.url, url) ){	// Include this url
			el.mtpid = mtp.id;	// lace it for lookup
			el.addEventListener("mousemove", listener, false);
			el.addEventListener("mousedown", listenerClick, false);
			mtp.deterLinks.links.push( {'el': el, 'listener':listener, 'listenerClick':listenerClick} );
		}
	}
	
};

DeterLinks.prototype.showAllDeterLinks = function(url){
	// Make sure each page is setup for deter links
	for( var i = 0; i < this.meeTimer.meeTimerPages.length; i++ ){
		var mtp = this.meeTimer.meeTimerPages[i];
		if( !mtp.deterLinks ){
			if( this.test(mtp.url) && (!url || mtp.url==url) ) this.processPage(mtp);
		}
	}
};

DeterLinks.prototype.removeMtp = function(mtp){
	// Release all event handlers held on this mtp (all links + window mouse move)
	// Remove it from lookup
	
	if( !mtp.deterLinks ) return;
	
	var groupid = (this.urls[mtp.url])? this.urls[mtp.url].groupId : 0;
	var links = mtp.deterLinks.links;
	for( var i = 0; i < links.length; i++ ){
		links[i].el.mtpid = null;
		links[i].el.removeEventListener( "mousemove", links[i].listener, false );
		links[i].el.removeEventListener( "mousedown", links[i].listenerClick, false );
		
		
		if( groupid && links[i].hovered && !links[i].clicked ){	// count as success
			this.sp.addDeterredSite( groupid, 1, 0, true );
		}
	}
	
	if( mtp.deterLinks.elPopup && mtp.deterLinks.elPopup.parentNode ) mtp.deterLinks.elPopup.parentNode.removeChild( mtp.deterLinks.elPopup );
	if( mtp.deterLinks.windowMouseMove ) window.removeEventListener("mousemove" , mtp.deterLinks.windowMouseMove, false);
	
	mtp.deterLinks = null;
	delete mtp.deterLinks;
	
	this.mtps[mtp.id] = null;
	
};

DeterLinks.prototype.onLinkClick = function(event){

	if( this.meeTimer.settings.currentMode!="deterrent" ) return false;
	
	var elLink = event.originalTarget;
	var mtp = this.mtps[elLink.mtpid];
	if( !mtp ) return;
	
	var links = mtp.deterLinks.links;
	for( var i = 0; i < links.length; i++ ){
		if( links[i].el==elLink ){
			links[i].clicked = true;
		}
	}
};

DeterLinks.prototype.onLinkMove = function(event){
	// Check that this link is not already being processed
	// Extract the link from the event
	// If the url of the link is marked; or the url of the associated mtp (i.e. on a bad page); then show the popup
	// Show popup
	// Store the linkel, popupel and time in an array entry on the mtp
	//		mtp.activeDeterLinks[linkurl]
	// Remove handler from this link
	// Add a mousemove handler to the window
	
	if( this.meeTimer.settings.currentMode!="deterrent" ) return false;
	
	var elLink = event.originalTarget;
	var url = this.meeTimer.urlMaps.lookup(elLink.href, null, {parseDomain:true});
	var mtp = this.mtps[elLink.mtpid];
	if( !mtp || mtp.deterLinks.elPopup ) return;	// something wrong
	if( !this.test(mtp.url, url) ) return;
		
	var linkIndex = -1;
	var links = mtp.deterLinks.links;
	for( var i = 0; i < links.length; i++ ){
		if( links[i].el==elLink ){
			links[i].el.removeEventListener( "mousemove", links[i].listener, false );	// stop it being used again
			links[i].startHover = (new Date()).valueOf();
			linkIndex = i;
		}
	}
	if( linkIndex < 0 ) return;	// not found link
			
	// Time calculations
	
	
	if( !(this.urls[url] && this.urls[url].groupId) ) url = mtp.url;
	
	var msWorkingWeek = this.meeTimer.settings.statInfo.workingWeek;
	msWorkingWeek *= 3600000;	//(multiply out to ms)
	
	if( this.urls[url] && this.urls[url].groupId ){
		var sharedUrl = mtp.sharedUrls[mtp.url];
		var msDay = sharedUrl.duration + sharedUrl.accumulatedDuration;
		var msWeek = this.meeTimer.sp.getUrlDurationWeek(mtp.url);
		var msGroupDay = this.sp.getGroupDurationToday( this.urls[url].groupId ) + msDay;
		var msGroupWeek = this.sp.getGroupDurationWeek( this.urls[url].groupId ) + msWeek;
		var dateGroupDay = new Date( msGroupDay );
		var dateGroupWeek = new Date( msGroupWeek );
		var groupPc = this.renderWorkingWeek( msGroupWeek, msWorkingWeek );
	}
	
	var msWeek = this.meeTimer.sp.getAllDurationWeek();
	var dateAllWeek = new Date( msWeek );
	var weekPc = this.renderWorkingWeek( msWeek, msWorkingWeek );
	
	// Show Popup
	var elPopup = null;
	if( mtp.deterLinks.cacheElPopup ){
		elPopup = mtp.deterLinks.cacheElPopup;
	}else{
		var elPopup = mtp.doc.createElement("DIV");
		elPopup.id = "meetimerpopup";
		elPopup.style.width = "300px";
		elPopup.style.height = "120px";
		elPopup.style.zIndex = "5000";
		elPopup.style.position = "absolute";
		elPopup.style.border = "1px solid black";
		elPopup.style.top = event.clientY + 10 + "px";
		elPopup.style.left = event.clientX + 10 + "px";
		elPopup.style.lineHeight = "30px";
		elPopup.style.textAlign = "center";
		elPopup.style.backgroundImage = "url(chrome://meetimer/content/overlay.png)"
		elPopup.style.color  = "rgb(254,99,24)";
		elPopup.style.fontSize = "18px";
		elPopup.style.paddingTop = "10px";
		mtp.deterLinks.cacheElPopup = elPopup;
	}
	
	// Render message 
	
	html = [];
	if( this.urls[url] && this.urls[url].groupId ){
		html.push(  this.renderTime(dateGroupWeek, {useBold:true}) + " on <strong>" + this.meeTimer.groups.getGroupNamesForUrlAsString(url) + "</strong> this week<br/><br/>" + groupPc + "% of your working-week" );
	}else{
		html.push(  this.renderTime(dateAllWeek, {useBold:true}) + " on the Web this week<br/><br/>" + weekPc + "% of your working-week" );
	}
	elPopup.innerHTML = html.join("\n");
	
	mtp.doc.body.appendChild( elPopup );
 	
	mtp.deterLinks.elPopup = elPopup;
	mtp.deterLinks.elLink = elLink;
	
	// Add mouse over to the window, if not already present
	if( !mtp.deterLinks.windowMouseMove ){
		mtp.deterLinks.windowMouseMove = MTCOMMON.bindAsEventListener(this, "onWindowMove" );
		window.addEventListener("mousemove", mtp.deterLinks.windowMouseMove, false);
	}
	
};
DeterLinks.prototype.renderWorkingWeek = function( msElapsed, msWorkingWeek ){
	var pc = (msElapsed / msWorkingWeek)*100;
	return parseInt( 10*pc )/10;
};
DeterLinks.prototype.renderTime = function(date, options){
	if( !date ) return "0 minutes";
	
	var timeMs = date.valueOf();
	
	var msPerH = (1000*60*60);
	var msPerM = (1000*60);	
	var h = parseInt(timeMs / msPerH);
	var m = parseInt((timeMs-(h*msPerH)) / msPerM);
	var s = parseInt((timeMs-(h*msPerH)-(m*msPerM)) / 1000 );
	
	var str = "";
	if( h > 0 ){
		str = h + " hours and " + m + " minutes";
	}else if( m > 0 ){
		str = m + " minutes";
	}else{
		str = s + " seconds";
	}
	if( options && options.useBold ) str = "<strong>" + str + "</strong>";
	return str;
};


DeterLinks.prototype.onWindowMove = function(event){
	// Check each popped-up link on this window (do a lookup on window.document.mtpid)
	// If the mouse event is outside the boundaries of any of these els; 
	//	Hide the el, restore the mouse move handler to the link
	//	Remove the entry
	// If no more activeDeterLinks; remove window move
		
	try{
		var el = event.originalTarget;
		var mtp = this.mtps[ el.ownerDocument.mtpid ];	
		if( !mtp ) return;
	}catch(e){return;}
	
	try{	
		var x = MTCOMMON.pointerX(event);
		var y = MTCOMMON.pointerY(event);
		if( MTCOMMON.within( mtp.deterLinks.elLink, x, y  ) ){	// move popup
			var elPopup = mtp.deterLinks.elPopup;
			x += 10;
			y += 10;
			
			
			// Check bounds:
			var deltaX = 0; var deltaY = 0;
			
			var viewport = MTCOMMON.browserViewport(mtp.window, mtp.doc, true);
			var dim = MTCOMMON.getDimensions(elPopup);

			if( (x + dim.width) > viewport[0] ){	// Move in
				deltaX = viewport[0] - (x + dim.width) -20;
			}
			/*
			if( (y + dim.height) > viewport[1] ){	// Move up
				deltaY = viewport[1] - (y + dim.height) - 20;
			}
			*/
			
			elPopup.style.top = y + deltaY + "px";
			elPopup.style.left = x + deltaX + "px";		

		}else{	// remove popup, remove window listener, restore link listener
			mtp.deterLinks.elPopup.parentNode.removeChild( mtp.deterLinks.elPopup );
			window.removeEventListener("mousemove", mtp.deterLinks.windowMouseMove, false );
			
			// Restore link handler
			var elLink = mtp.deterLinks.elLink;
			var links = mtp.deterLinks.links;
			for( var i = 0; i < links.length; i++ ){
				if( links[i].el==elLink ){
					elLink.addEventListener("mousemove", links[i].listener, false);
					
					if( !links[i].hovered ){
						if( links[i].startHover && ((new Date()).valueOf()-links[i].startHover)>1000 ){	// mouse over was more than a second
							links[i].hovered = true;
							links[i].startHover = null;
						}
					}
				}
			}
			
			// Free up for new stuff:
			mtp.deterLinks.elPopup = null;
			mtp.deterLinks.windowMouseMove = null;
			mtp.deterLinks.elLink = null;
		}
	}catch(e){
		window.removeEventListener("mousemove", mtp.deterLinks.windowMouseMove, false );
		if( mtp.deterLinks && mtp.deterLinks.elPopup && mtp.deterLinks.elPopup.parentNode ){
			mtp.deterLinks.elPopup.parentNode.removeChild( mtp.deterLinks.elPopup );
		}
		return;
	}
};