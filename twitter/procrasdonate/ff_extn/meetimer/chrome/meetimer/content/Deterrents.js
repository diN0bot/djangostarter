function Deterrents(meeTimer){
	this.meeTimer = meeTimer;
	this.db = meeTimer.db;
	this.sp = meeTimer.sp;
	
	this.permitted = {};
	this.initialise();
}

Deterrents.prototype.initialise = function(){
	this.urls = this.sp.getDeterrentUrls();
};

Deterrents.prototype.removePermitted = function(url){
	if( !url ){	// remove all
		this.permitted = {};
	}else{
		if( this.permitted[url] ){
			this.permitted[url] = false;
			delete this.permitted[url];
		}
	}
};

Deterrents.prototype.test = function(url){
	if( this.meeTimer.settings.currentMode!="deterrent" ) return false;
	if( this.meeTimer.settings.deterrent.incMisc && !this.meeTimer.groups.test(url) && !this.urls[url] && !this.permitted[url] ) return true;
	if(this.urls[url] && !this.permitted[url]) return true;
};

Deterrents.prototype.showLightbox = function(mtp){
	// Show lightbox in page, and show the stats for this url

	var el = mtp.doc.createElement("DIV");
		el.id = "meetimer-deterrent";
		el.style.position = "fixed";
		el.style.zIndex = "5000";
		el.style.top = "0px";
		el.style.left = "0px";
		el.style.width = "100%";
		el.style.height = "100%";
		el.style.display = "block";
		el.style.backgroundImage = "url(chrome://meetimer/content/overlay.png)";
	if( mtp.doc.body && !/mail\.google\.com/.test(mtp.url) ){
		if( /\<!-- ERROR ITEM CONTAINER/i.test( mtp.doc.body.innerHTML ) ) return;	// bad stuff -> test.com
		if( /feedHeader/.test(mtp.doc.body.innerHTML) && /feedSubscribeLine/.test(mtp.doc.body.innerHTML) ) return;	// rss feedSubscribeLine
		mtp.doc.body.appendChild( el );
	}else if(/mail\.google\.com/.test(mtp.url)){
		var fCallback = function(){
				if( mtp.window.frames[0].frames[0] && mtp.window.frames[0].frames[0].document.body && mtp.window.frames[0].frames[0].document.body.innerHTML.length > 10 ){
					mtp.window.frames[0].frames[0].document.body.appendChild( el );
				}else{
					var fCallback2 = function(){
							if( mtp.window.frames[0].frames[0] ){
								mtp.window.frames[0].frames[0].document.body.appendChild( el );
							}
						};
					setTimeout( fCallback2, 2000 );
				}
			}
		setTimeout( fCallback, 2000 );
		
	}else{
		for( var i = 0; i < mtp.window.frames.length; i++ ){
			var els = mtp.window.frames[i].document.getElementsByTagName("BODY");
			if( els.length > 0 ){
				els[0].appendChild( el );
			}
		}
	}
	
	// Container
	var elContainer = mtp.doc.createElement("DIV");
		elContainer.style.position = "relative";
		elContainer.style.zIndex = "1001";
		elContainer.style.border = "solid 1px black";
		elContainer.style.height = "400px";
		elContainer.style.width = "500px";
		elContainer.style.margin = "auto";
		elContainer.style.top = "200px;"
		elContainer.style.background = "#555";
		elContainer.style.fontFamily = "arial, sans-serif";
		elContainer.style.fontSize = "16px";
		elContainer.style.padding = "5px";
		elContainer.style.lineHeight = "16px !important";
		elContainer.style.display = "block";
	el.appendChild( elContainer );
	
	// Time calculations
	var msWorkingWeek = this.meeTimer.settings.statInfo.workingWeek;
	msWorkingWeek *= 3600000;	//(multiply out to ms)
	
	var sharedUrl = mtp.sharedUrls[mtp.url];
	var msDay = sharedUrl.duration + sharedUrl.accumulatedDuration;
	var msWeek = this.meeTimer.sp.getUrlDurationWeek(mtp.url);
	var pc = this.renderWorkingWeek( msWeek, msWorkingWeek );
	var dateDay = new Date( msDay );
	var dateWeek = new Date( msWeek );

	if( this.urls[mtp.url] && this.urls[mtp.url].groupId ){
		var msGroupDay = this.sp.getGroupDurationToday( this.urls[mtp.url].groupId ) + msDay;
		var msGroupWeek = this.sp.getGroupDurationWeek( this.urls[mtp.url].groupId ) + msWeek;
		var dateGroupDay = new Date( msGroupDay );
		var dateGroupWeek = new Date( msGroupWeek );
		var groupPc = this.renderWorkingWeek( msGroupWeek, msWorkingWeek );
	}
	
	var msWeek = this.meeTimer.sp.getAllDurationWeek();
	var dateAllWeek = new Date( msWeek );
	var weekPc = this.renderWorkingWeek( msWeek, msWorkingWeek );
	
	// Render message
	html = [];
	html.push( "<div style='text-align:center;width:100%;margin:auto;margin-top:20px;line-height:30px;'>" );
	html.push( "<div style='color:rgb(254,99,24);font-size:1.4em;'>" );
	if( this.urls[mtp.url] && this.urls[mtp.url].groupId ){
		html.push(  this.renderTime(dateGroupWeek, {useBold:true}) + " on <strong>" + this.meeTimer.groups.getGroupNamesForUrlAsString(mtp.url) + "</strong> this week.<br/>" + groupPc + "% of your working-week." );
	}else{
		html.push(  this.renderTime(dateAllWeek, {useBold:true}) + " on the Web this week<br/>" + weekPc + "% of your working-week." );
	}
	html.push( "</div>" );
	html.push( "</div>" );
	elContainer.innerHTML = html.join("\n");
	
	var elClose = mtp.doc.createElement("DIV");
		elClose.setAttribute("style", "display:block;font-weight:bold;margin:auto;text-align:center;border:2px solid #1d9101;color:#1d9101;background:#E3FFCD;width:160px;height:27px;font-size:1.2em;padding:0px;margin-top:40px;padding-top:9px;" );
	elContainer.appendChild( elClose );
	var elCloseA = mtp.doc.createElement("A");
		elCloseA.href = "#";
		elCloseA.setAttribute("onclick", "return false;");
		elCloseA.style.color = "#1d9101";
		elCloseA.style.borderBottom = "none";
		elCloseA.style.fontSize = "18px";
		elCloseA.style.borderBottomStyle = "none";
		elCloseA.style.textDecoration = "none";
		var fUpdate = function(){
				if( this.urls[mtp.url] && this.urls[mtp.url].groupId ) this.sp.addDeterredSite( this.urls[mtp.url].groupId, 1 );
			};
		fUpdate = MTCOMMON.bind(this, fUpdate);
		if( gBrowser.browsers.length==1 ){
			elCloseA.innerHTML = "Close Firefox";
			var fClose = function(){
					fUpdate();
					window.close();
				};
			elCloseA.addEventListener("mousedown", MTCOMMON.bind( this, fClose ), false );
		}else{
			elCloseA.innerHTML = "Close This Tab";
			var fClose = function(){
					fUpdate();
					gBrowser.removeCurrentTab();
				};
			elCloseA.addEventListener("mousedown", MTCOMMON.bind( this, fClose ), false );
		}
	elClose.appendChild( elCloseA );
	
	if( mtp.window.history.length > 1 ){	// offer to go back
		elContainer.style.height = parseInt(elContainer.style.height) + 40 + "px";
		var elBack = mtp.doc.createElement("DIV");
			elBack.setAttribute("style", "display:block;font-weight:normal;margin:auto;text-align:center;border:1px solid #1d9101;background:#E3FFCD;width:160px;height:16px;font-size:1.05em;padding:0px;margin-top:6px;padding-top:1px;padding-bottom:1px;line-height:16px;" );
		elContainer.appendChild( elBack );
		var elBackA = mtp.doc.createElement("A");
			elBackA.href = "#";
			elBackA.setAttribute("onclick", "return false;");
			elBackA.style.color = "#1d9101";
			elBackA.style.borderBottom = "none";
			elBackA.style.fontSize = "13px";
			elBackA.style.borderBottomStyle = "none";
			elBackA.style.textDecoration = "none";
			elBackA.style.lineHeight = "16px";
			var fUpdate = function(){
					if( this.urls[mtp.url] && this.urls[mtp.url].groupId ) this.sp.addDeterredSite( this.urls[mtp.url].groupId, 1 );
				};
			fUpdate = MTCOMMON.bind(this, fUpdate);
			elBackA.innerHTML = "Back a Page";
			var fBack = function(){
					fUpdate();
					mtp.window.history.back();
				};
			elBackA.addEventListener("mousedown", MTCOMMON.bind( this, fBack ), false );
		elBack.appendChild( elBackA );
	}
	
	var elProceed = mtp.doc.createElement("DIV");
		elProceed.style.width = "100px";
		elProceed.style.textAlign = "center";
		elProceed.style.margin = "auto";
		elProceed.style.marginTop = "10px";
		elProceed.style.fontSize = "0.7em";
		elProceed.style.display = "block";
	elContainer.appendChild( elProceed );
	var elProceedA = mtp.doc.createElement("A");
		elProceedA.href = "#";
		elProceedA.innerHTML = "Proceed to Page";
		elProceedA.style.color = "#222";
		elProceedA.title = "View the page, but be warned again on other " + mtp.url + " pages.";
		elProceedA.style.borderBottomStyle = "none";
		elProceedA.style.textDecoration = "none";
		elProceedA.style.borderBottom = "1px solid";		
		var fProceed = function(){
				if( this.urls[mtp.url] && this.urls[mtp.url].groupId ) this.sp.addDeterredSite( this.urls[mtp.url].groupId, 0, 1 );
				el.parentNode.removeChild(el);
			};
		elProceedA.addEventListener("mousedown", MTCOMMON.bind(this, fProceed), false );
	elProceed.appendChild( elProceedA );
	
	var elAllow = mtp.doc.createElement("DIV");
		elAllow.style.width = "400px";
		elAllow.style.textAlign = "center";
		elAllow.style.margin = "auto";
		elAllow.style.marginTop = "5px";
		elAllow.style.fontSize = "0.7em";
		elAllow.style.display = "block";
	elContainer.appendChild( elAllow );
	var elAllowA = mtp.doc.createElement("A");
		elAllowA.href = "#";
		elAllowA.innerHTML = "Permit " + mtp.url + " for this session";
		elAllowA.style.color = "#222";
		elAllowA.title = "View the site with no warnings (until all instances of the site are closed)";
		elAllowA.style.borderBottomStyle = "none";
		elAllowA.style.textDecoration = "none";
		elAllowA.style.borderBottom = "1px solid";
		var fAllow = function(){
				this.permitted[mtp.url] = true;
				if( this.urls[mtp.url] && this.urls[mtp.url].groupId ) this.sp.addDeterredSite( this.urls[mtp.url].groupId, 0, 1 );
				el.parentNode.removeChild(el);
				
				// See if any other tabs have this url and a deterrent, if so, close them
				this.removeAllDeterrents(mtp);
			};
		elAllowA.addEventListener("mousedown", MTCOMMON.bind(this, fAllow), false );
	elAllow.appendChild( elAllowA );
	
	var elDetails = mtp.doc.createElement("DIV");
	html.length = 0;
	html.push( "<DIV style='font-size:0.8em;margin-top:30px;line-height:16px;text-align:left;'>" );
	html.push( "<div style='font-weight:bold;'>" + mtp.url + "</div>" );
	html.push( "<div style=''>You have spent " + this.renderTime(dateDay, {useBold:false}) + " here today, and " + this.renderTime(dateWeek, {useBold:true}) + " here this week<br/>(" + pc + "% of your working-week.)</div>" );
	if( this.urls[mtp.url] && this.urls[mtp.url].groupId ){
		html.push("<div style='margin-top:10px;font-weight:bold;'>" + this.meeTimer.groups.getGroupNamesForUrlAsString(mtp.url) + "</div>" );
		html.push("<div style=''>You have spent " + this.renderTime(dateGroupDay, {useBold:false}) + " today and " + this.renderTime(dateGroupWeek, {useBold:true}) + " this week<br/>(" + groupPc + "% of your working-week)</div>" );
	}
	html.push( "</DIV>" );
	elDetails.innerHTML = html.join("\n");
	elContainer.appendChild( elDetails );
	
	var elFooter = mtp.doc.createElement("DIV");
		elFooter.setAttribute("style", "position:absolute;bottom:0px;width:100%;text-align:center;font-size:0.7em;color:#000;");
		elFooter.innerHTML = "MeeTimer Deterrent Mode [<a href='#' style='color:black;border-bottom:none;border-bottom-style:none;text-decoration:none'>configure</a>]<br/>(You can deactivate it by right clicking the MeeTimer logo in Firefox's tray and switching to 'Normal')";
	elContainer.appendChild( elFooter );
	var elConf = elFooter.getElementsByTagName("A")[0];
	if( elConf ){
		var fConf = function(){
				openOptions('meetimer_deterrents');
			}
		elConf.addEventListener("mousedown", MTCOMMON.bind(this, fConf), false);
	}
		
};

Deterrents.prototype.showAllDeterrents = function(url){
	// try to add in deterrents to any mtp that wants it
	for( var i = 0; i < this.meeTimer.meeTimerPages.length; i++ ){
		var mtp = this.meeTimer.meeTimerPages[i];
			var elD = mtp.doc.getElementById("meetimer-deterrent");
			if( !elD ){
				if( this.test(mtp.url) && (!url || mtp.url==url) ) this.showLightbox(mtp);
			}
	}
};

Deterrents.prototype.removeAllDeterrents = function(mtp, onlyUntested){
	for( var i = 0; i < this.meeTimer.meeTimerPages.length; i++ ){
		var omtp = this.meeTimer.meeTimerPages[i];
		if( !onlyUntested || !this.test( omtp.url ) ){	// only remove if it fails the test
			if( !mtp || (omtp.url==mtp.url && omtp!=mtp) ){
				var elD = omtp.doc.getElementById("meetimer-deterrent");
				if( elD ) elD.parentNode.removeChild( elD );
			}
		}
	}
};

Deterrents.prototype.renderWorkingWeek = function( msElapsed, msWorkingWeek ){
	var pc = (msElapsed / msWorkingWeek)*100;
	return parseInt( 10*pc )/10;
};

Deterrents.prototype.renderTime = function(date, options){	
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
