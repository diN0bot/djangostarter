function MeeTimerPage(meeTimer, doc){

try{
	this.id = (new Date()).valueOf();
	this.meeTimer = meeTimer;
	this.sharedUrls = this.meeTimer.urls;
	this.sharedDomains = this.meeTimer.domains;
	this.refreshDoc(doc);
	this.urlMaps = meeTimer.urlMaps;
	
	if( this.doc.location.href=="about:blank" || !this.doc.location.hostname ) return;	// Could not find
	if( content.top.location.href!=content.location.href ) return;	// In a frame
	if( this.doc.defaultView.frameElement ) return;	// In iframe
	 
	
	//this.browser = gBrowser.getBrowserForDocument( this.doc );
	//this.browser.meeTimerPage = this;
	
	this.startTime = (new Date()).valueOf();
	this.fullUrl = this.doc.location.href;
	this.url = this.urlMaps.lookup(this.fullUrl, this.doc.location.hostname);	// note it uses the full URL
	
	
	
	this.domain = this.url;
	var pattDomain = /^(\S+\.)?\S+\.\S+\.\S+$/i;
	var pattInt = /^[^\.\s]+\.\S{2}\.\S{2}$/i;
	if( pattDomain.test( this.domain ) && !pattInt( this.domain ) ){
		this.domain = this.domain.replace( /^\S+?\./i, "");
	}
	
}catch(e){
	if( MEETIMERDEBUGMODE ) alert("MeeTimerPage construct\n" + e.toString());
}


};

MeeTimerPage.prototype.refreshDoc = function(doc){
	if( this.doc ) this.doc.mtpid = null;
	
	this.doc = doc;
	this.window = doc.defaultView;
	this.doc.mtpid = this.id;
}

MeeTimerPage.prototype.attachToBrowser = function(){
	this.browser = gBrowser.getBrowserForDocument( this.doc );
	this.browser.meeTimerPage = this;
};

MeeTimerPage.prototype.renderStatus = function(){
	// Update the elements
	
	var sharedUrl = this.sharedUrls[this.url];
	if( !sharedUrl ) return;

	var dateSession = new Date( sharedUrl.duration );
	var dateDay = new Date( sharedUrl.duration + sharedUrl.accumulatedDuration );
		
	document.getElementById("meetimer-label").value = this.renderTime(dateDay,true);

};

MeeTimerPage.prototype.renderToolTip = function(){
	// Render a tooltip; based on data here
	
try{

	var sharedUrl = this.meeTimer.urls[this.url];
	if( !sharedUrl ) return;
	
	var workingWeek = this.meeTimer.settings.statInfo.workingWeek;
	workingWeek *= 3600000;	//(multiply out to ms)
		
	//var dateSession = new Date( sharedUrl.duration );
	var msDay = sharedUrl.duration + sharedUrl.accumulatedDuration;
	var msWeek = this.meeTimer.sp.getUrlDurationWeek(this.url) + sharedUrl.duration;
	var dateDay = new Date( msDay );
	var dateWeek = new Date( msWeek );
	document.getElementById("meetimer-tooltip-today").value = this.renderTime(dateDay) + "";
	document.getElementById("meetimer-tooltip-week").value = "(" + this.renderTime(dateWeek) + " this week; " + this.renderWorkingWeek(msWeek, workingWeek) + ")";
	//var dateDomain = new Date( this.meeTimer.domains[this.domain].duration  );
	
	var groups = this.meeTimer.sp.getGroupsDurationToday();
	var groupsWeek = this.meeTimer.sp.getGroupsDurationWeek();
	var totalTime = this.meeTimer.sp.getUrlDurationToday();	// leave url null to get all
	var totalTimeInMemory = 0;
	for( url in this.meeTimer.urls ){
		if( this.meeTimer.urls.hasOwnProperty(url) ){
			for( groupname in this.meeTimer.groups.urls[url] ){
				var group_id = this.meeTimer.groups.urls[url][groupname].id;
				if( group_id ){
					if( !groups[group_id] ) groups[group_id] = 0;
					if( !groupsWeek[group_id] ) groupsWeek[group_id] = 0;
					groups[group_id] += this.meeTimer.urls[url].duration;
					groupsWeek[group_id] += this.meeTimer.urls[url].duration;
				}
			}
			totalTimeInMemory += this.meeTimer.urls[url].duration;
		}
	}
	totalTime += totalTimeInMemory;

	// Clear out old groups:
	var elTooltipContainer = document.getElementById("meetimer-panel-tooltip-vbox");
	for( var i = elTooltipContainer.childNodes.length - 1; i>=0; i-- ){
		var elChild = elTooltipContainer.childNodes[i];
		if( elChild.getAttribute("meetimer-tooltip-group") ) elChild.parentNode.removeChild( elChild );
	}
	
	// Create the group renderer
	var elSeperator = document.getElementById("meetimer-tooltip-after-groups");
	var fCreateGroupElement = MTCOMMON.bind(this, function(title, day, week){
		var elLabel = elSeperator.ownerDocument.createElement("label");
			elLabel.setAttribute("value", title);
			elLabel.setAttribute("style", "margin:2px;margin-left:2px;font-size:0.97em;color:black;");
			elLabel.setAttribute("meetimer-tooltip-group", "1");
		elSeperator.parentNode.insertBefore( elLabel, elSeperator );
		var elLabel = elSeperator.ownerDocument.createElement("label");
			elLabel.setAttribute("value", day);
			elLabel.setAttribute("style", "margin:2px;margin-left:10px;font-size:0.97em;");
			elLabel.setAttribute("meetimer-tooltip-group", "1");
		elSeperator.parentNode.insertBefore( elLabel, elSeperator );
		var elLabel = elSeperator.ownerDocument.createElement("label");
			elLabel.setAttribute("value", week);
			elLabel.setAttribute("style", "margin:2px;margin-left:10px;font-size:0.95em;color:#444;");
			elLabel.setAttribute("meetimer-tooltip-group", "1");
		elSeperator.parentNode.insertBefore( elLabel, elSeperator );
		
	});

	// Now render groups
	//var i = 0;
	for( group_id in this.meeTimer.groups.groups ){
		if( !groups[group_id] ) groups[group_id] = 0;
		if( !groupsWeek[group_id] ) groupsWeek[group_id] = 0;
		var el = null;
		var dateGroup = new Date( groups[group_id] );
		var dateGroupWeek = new Date( groupsWeek[group_id] );
		
		fCreateGroupElement( this.meeTimer.groups.groups[group_id].groupname, this.renderTime(dateGroup), "(" + this.renderTime(dateGroupWeek) + " this week; " + this.renderWorkingWeek(groupsWeek[group_id], workingWeek) + ")" );
		//i++;
	}
	// Render the ungrouped item
	var dateUngrouped = new Date( this.meeTimer.sp.getUngroupedDurationToday() );
	var msWeek = this.meeTimer.sp.getUngroupedDurationWeek();
	var dateUngroupedWeek = new Date( msWeek );
	fCreateGroupElement( "Misc - Ungrouped Sites", this.renderTime(dateUngrouped), "(" + this.renderTime(dateUngroupedWeek) + " this week; " + this.renderWorkingWeek(msWeek, workingWeek) + ")" );
	/*
	this.meeTimer.els.groups[i].elTitle.style.display = "";
	this.meeTimer.els.groups[i].elDay.style.display = "";
	this.meeTimer.els.groups[i].elWeek.style.display = "";
	this.meeTimer.els.groups[i].elTitle.value = "Misc - Ungrouped Sites";
	this.meeTimer.els.groups[i].elDay.value = this.renderTime(dateUngrouped);
	this.meeTimer.els.groups[i].elWeek.value = "(" + this.renderTime(dateUngroupedWeek) + " this week; " + this.renderWorkingWeek(msWeek, workingWeek) + ")";
	*/
	/*
	i++;
	
	for( var j = i; j < 15; j++ ){
		this.meeTimer.els.groups[j].elTitle.style.display = "none";
		this.meeTimer.els.groups[j].elDay.style.display = "none";
		this.meeTimer.els.groups[j].elWeek.style.display = "none";
	}
	*/
	

			
	document.getElementById("meetimer-tooltip-url").value = this.url;
	var groupname = this.meeTimer.groups.getGroupNamesForUrlAsString(this.url);
	if( groupname ) document.getElementById("meetimer-tooltip-url").value += " [" + groupname + "]";
	
	/*
	if( this.url==this.domain ){
		this.meeTimer.els["tooltip-domain"].style.display = "none";
		this.meeTimer.els["tooltip-domain-today"].style.display = "none";
	}else{
		this.meeTimer.els["tooltip-domain"].style.display = "";
		this.meeTimer.els["tooltip-domain-today"].style.display = "";
		this.meeTimer.els["tooltip-domain"].value = this.domain;
		this.meeTimer.els["tooltip-domain-today"].value = this.renderTime(dateDomain) + " (accumulated)";
	}
	*/
	
	//this.meeTimer.els["tooltip-session"].value = this.renderTime(dateSession, true) + " (this session)";

	var dateAllDay = new Date( totalTime );
	var msWeek = this.meeTimer.sp.getAllDurationWeek() + totalTimeInMemory;
	var dateAllWeek = new Date( msWeek );
	document.getElementById("meetimer-tooltip-webuse-today").value = this.renderTime(dateAllDay);
	document.getElementById("meetimer-tooltip-webuse-week").value = "(" + this.renderTime(dateAllWeek) + " this week; " + this.renderWorkingWeek(msWeek, workingWeek) + ")";

}catch(e){
	if( MEETIMERDEBUGMODE ) alert( "MeeTimerPage renderToolTip\n" + e.toString() );
}

};

MeeTimerPage.prototype.renderWorkingWeek = function( msElapsed, msWorkingWeek ){
	var pc = (msElapsed / msWorkingWeek)*100;
	pc = parseInt( 10*pc )/10;
	//if( pc==0 ) return "";
	return "" + pc + "% of working-week";
};

MeeTimerPage.prototype.renderTime = function(date, incSeconds){
		
	var timeMs = date.valueOf();
	
	var msPerH = (1000*60*60);
	var msPerM = (1000*60);	
	var h = parseInt(timeMs / msPerH);
	var m = parseInt((timeMs-(h*msPerH)) / msPerM);
	var s = parseInt((timeMs-(h*msPerH)-(m*msPerM)) / 1000 );
	

	var hStr = new String(h);
	var mStr = new String(m);
	var sStr = new String(s);
	
	if( incSeconds ){
		if( hStr.length==1) hStr = "0" + hStr;
		if( mStr.length==1) mStr = "0" + mStr;
		if( sStr.length==1) sStr = "0" + sStr;
		return hStr + ":" + mStr + ":" + sStr;
	}else{
		m++;
		if( m>=60 ){
			h++;
			m = 0;
		}
		return h + "h " + m + "m";
	}
	

};

MeeTimerPage.prototype.isGrouped = function(){
	return this.meeTimer.groups.test(this.url); 
};


MeeTimerPage.prototype.unload = function(){
	// Clear up variables
	this.browser.meeTimerPage = null;
	delete this.browser.meeTimerPage;
	this.tab = null;
	this.browser = null;
	if( this.doc ) this.doc.mtpid = null;
	this.doc = null;
};