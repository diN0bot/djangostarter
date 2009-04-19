// PageAddict is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2, or (at your option)
// any later version.

// PageAddict is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details

/******************************************************************************
								DOCUMENTATION

                          __VARIABLES IN GM STORE__
                          
href = something like 'bilumi_org' or 'www_google_com__search'

'first_visit' = 
'last_visit' -> int = absolute time of last visit in seconds (glocal)

href+'_last' -> int = absolute time of last visit in seconds (per ref)
href+'_count' -> int = number of visits

'page_addict_start' AND window.page_addict_start = True if timing

'visited' = list of href's visited for < 1 second. ';' separated

tag+'_times'
tag+'_spent'
tag+'_max_time' = max time in minutes before content is blocked

'total_times'
'total_spent'

'idle_timeout_mode' = boolean. based on preferences. 
					  if hasn't been set yet, is based on platform.

'twitter_username'
'twitter_password'
'recipient'
'cents_per_hour'
'hr_per_day_goal' = goal number of hours to donate each day
'hr_per_day_max' = max number of hours from which to donate each day

'settings_state' = enumeration of settings page state 
    'account', 'edit_account', 'site_classifications', 'balance'
    
'impact_state' = 'today', 'history'

                              __WINDOW STORE__

page_addict_start = why here and mirror GM STORE
  'page_addict_start'? synch issues?

tag_counts = 

idle_time = seconds idle as counted by monitor_activity(), which
  is called every second (see start_recording)

user_active = boolean. set to true in record_activity(), which is
  triggered by click, scroll and key event listeners. set to
  false in monitor_activity(), which is called every second from
  start_recording
******************************************************************************/

// Add jQuery
var GM_JQ = document.createElement('script');
GM_JQ.src = 'http://jquery.com/src/jquery-latest.js';
GM_JQ.type = 'text/javascript';
document.getElementsByTagName('head')[0].appendChild(GM_JQ);

function GM_wait() {
    if(typeof unsafeWindow.jQuery == 'undefined') { window.setTimeout (GM_wait,100); }
    else { $ = unsafeWindow.jQuery; }
}
GM_wait(); 

PD_DOMAIN = 'http://localhost:8000'
PROCRASDONATE_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/';
START_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/start_now/';
LEARN_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/learn_more/';
IMPACT_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/my_impact/';
SETTINGS_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/settings/';

COMMUNITY_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/our_community';
PRIVACY_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/privacy_guarantee/';
RECIPIENTS_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/recipients';
POST_DATA_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/data/';

window.addEventListener('unload', stop_recording, true);
window.addEventListener('focus', start_recording, true);
window.addEventListener('blur', stop_recording, true);
window.addEventListener('mousemove', validate_mouse, true);
window.addEventListener('keydown', validate_mouse, true);

window.addEventListener('load', house_keeping, true);
// window.addEventListener('load',check_page_inserts, true);
check_restriction();
function register_observers() {
	document.addEventListener('click', record_activity, true);

	document.addEventListener('scroll', record_activity, true);
	document.addEventListener('keydown', record_activity, true);
	window.addEventListener('keydown', record_activity, true);
	// speculation: mousemove does not trigger activity because movement on other windows
	// still triggers call? would be good to test sometime, since mousemove might 
	// help with game or reading detection
	// document.addEventListener('mousemove',record_activity , true);
}

function record_activity() {
	/*
	 * Boolean used to determine whether a user is idle or not.
	 * Record activity is triggered by the above event listeners
	 */
	window.user_active = true;
}

function monitor_activity() {
	/*
	 * Called every second - see start_recording()
	 * 
	 * Decide whether to stop recording because of in-activity
	 *   (30 counts of monitor_activity() = 30 seconds)
	 * or start recording because of activity
	 */
	if (window.page_addict_start) {
		if (window.user_active)
			window.idle_time = 0;
		else {
			window.idle_time += 1;
			// GM_log('idle time='+window.idle_time);
		}
		if (window.idle_time > 30) {
			// window.count_seconds+=1;
			if (window.page_addict_start) {
				stop_recording();
			}
		}

	} else {
		if (window.user_active)
			start_recording();
	}

	window.user_active = false;
	// if(window.continue_monitoring)
	// setTimeout(monitor_activity, 15000);
}

// function start_if_active() {
// if(window.user_active)
// start_recording();
// }

function house_keeping() {
	/*
	 * Called on every page load.
	 * 
	 * 0. Set setup account if necessary
	 * 1. If loading restricted page tag and time limit is exceeded, block page
	 * 2. If loading a pageaddict page, then insert data if necessary
	 * 3. Updated ProcrasDonate version available for download?
	 * 4. Update daily state
	 */
	// 0.
	set_account_defaults_if_necessary();
	initialize_state_if_necessary();
	
	// 1.
	var href = window.location.host;
	href = href.replace(/\./g, '_');
	if (!(href.match(/pageaddict_com$/))) {
		check_restriction();
	}

	// 2.
	check_page_inserts();
	
	// 3.
	check_latest_version();
	// GM_setValue('page_addict_start', false);

	// 4.
	var last_global = GM_getValue('last_visit', 0);
	var first = GM_getValue('first_visit', 0);
	// chover = change over, as in change over the day ...?
	var chover = new Date();
	chover.setHours(0, 0, 0);
	chover = Math.round(chover.getTime() / 1000);
	// GM_log('chover='+chover, ' las');
	if (first < chover) {
		// alert('resetting, first='+first);
		reset_visits();
	}
	// var currentTime = new Date();
	// var t_in_s = Math.round(currentTime.getTime()/1000);

	// GM_setValue('last_visit', t_in_s);
	set_default_idle_mode();
}

function check_latest_version() {
	/*
	 * Check if user should update to newer version of page addict
	 */
	var newest_version;

	if (document.getElementById("newest_version")) {
		newest_version = parseInt(
				document.getElementById("newest_version").innerHTML, 10);
		if (newest_version > 30) { // change to a constant somehow
			var cell_text;
			cell_text = "You are running an old version of PageAddict. ";
			cell_text += 'Update <a href="https://addons.mozilla.org/firefox/3685/">here</a>';
			document.getElementById("newest_version").innerHTML = cell_text;
			document.getElementById("newest_version").style.display = "inline";
			// document.getElementById("newest_version").style.color="#EDCB09";
		}
	}
}

function start_recording(no_retry) {
	if (window.page_addict_start) {
		// GM_log('cant start recording: local');
		// return;
	}
	if (GM_getValue('page_addict_start', false) == true) {
		// GM_log('cant start recording: global');
		if (!no_retry) {
			setTimeout("start_recording(true)", 200);
		}
		return;
	}

	// if(no_retry)
	// GM_log('delayed start!');

	var currentTime = new Date();
	var t_in_s = Math.round(currentTime.getTime() / 1000);
	window.page_addict_start = t_in_s;
	GM_setValue('page_addict_start', true);

	GM_log('start recording ' + window.location.host + ' @ ' + t_in_s);
	// dump('start recording '+window.location.host);
	// window.page_addict_recording=1;
	if (GM_getValue('idle_timeout_mode', false)) {
		// window.continue_monitoring=true;
		window.user_active = false;
		window.idle_time = 0;
		// window.count_seconds=0;
		if (!(window.interval_id)) {
			window.interval_id = setInterval(monitor_activity, 1000);
		}
		if (!(window.registered_observers)) {
			register_observers();
			window.registered_observers = true;
		}

	}

}

function validate_mouse() {
	start_recording();
	// window.page_addict_valid=1;
	window.removeEventListener('mousemove', validate_mouse, true);
	window.removeEventListener('keydown', validate_mouse, true);

}

function stop_recording() {
	/*
	 * Called everytime user becomes idle (if idle timeout is True)
	 * switches tabs or clicks a link (i think).
	 * 
	 * This is where we make calls to ProcrasDonate server if necessary.
	 */
	if (window.page_addict_start == null) {
		// GM_log('cant stop recording: local');
		// return;
	}
	if (GM_getValue('page_addict_start', false) == false) {
		// GM_log('cant stop recording: global');
		return;
	}

	// if(window.page_addict_valid==null) return;
	window.continue_monitoring = false;
	var currentTime = new Date();
	var t_in_s = Math.round(currentTime.getTime() / 1000);

	// var href = window.location.host;
	var href = get_this_url();
	// href = href.replace(/\./g, '_');
	// alert(href);
	if (href.length == 0)
		return;
	// if(unsafeWindow.page_addict_start==null) return;
	var last = GM_getValue(href + '_last', 0);
	var last_visit = GM_getValue('last_visit', 0);

	// window.continue_monitoring=false;

	if (window.page_addict_start < last_visit
			|| window.page_addict_start == null) {
		// this seems to occur with some frequency in normal browse sessions...
		GM_log('fatal flaw?');
		window.page_addict_start = null;
		GM_setValue('page_addict_start', false);
		window.user_active = false;

		return;
	}

	if (t_in_s > last_visit + 1 || GM_getValue('idle_timeout_mode', false)) {
		var counts = Math.round(t_in_s - window.page_addict_start);
		// if(GM_getValue('idle_timeout_mode', false)) {
		// if(window.count_seconds)
		// counts=window.count_seconds;
		// else
		// counts=0;
		//
		// }

		GM_log('stop recording ' + window.location.host + ' for ' + counts + ' :: ' + href);

		GM_setValue(href + '_count', GM_getValue(href + '_count', 0) + counts);
		// GM_log('stopped recording '+href+', '+counts);
		if (last < 1)
			add_to_list(href, 'visited');
		GM_setValue(href + '_last', t_in_s);
		GM_setValue('last_visit', t_in_s);
		if (t_in_s % 5 == 0)
			GM_savePrefs();
		
		// SEND ANONYMOUS DATA TO PROCRASDONATE SERVER
		// cents_per_hour * 1hr/60min * 1min/60sec * seconds
		var amt = parseInt(GM_getValue('cents_per_hour', 0))/60.0/60.0 * counts;
		var recipient = GM_getValue('recipient', '');
		GM_log("amt "+amt+" counts "+counts);
		if ( amt > 0.0 && counts > 0 ) {
			post_anonymous_info_to_procrasdonate(get_decoded_url(), counts, amt, recipient);
		}
	}
	window.page_addict_start = null;
	GM_setValue('page_addict_start', false);
	window.user_active = false;
	setTimeout("window.user_active=false", 100);
	// if(GM_getValue('idle_timeout_mode', false))
	// clearInterval(window.interval_id);

	// window.count_seconds=0;
	
	// check_status();
	// make_payment(GM_getValue('cents_per_hour', ''));
	// create_account();
}

function post_anonymous_info_to_procrasdonate(site, time_spent, amt, recipient, time) {
	/*
	 * Posts anonymous information to procrasdonate server for community
	 * page tracking.
	 * 
	 * Site is domain of site spent time on
	 * Time is amount of time spent (in seconds)
	 * Amt is amount user will donate (in cents, based on rate)
	 * Recipient is recipient of donation
	 */
	var params = "site=" + site + "&time_spent=" + time_spent + "&amt=" + amt + "&recipient=" + recipient;
	if ( time ) {
		params += "&time=" + time;
	}

	GM_log("PARAMSSSS   "+params);
	GM_log("URLLLLLLL   "+POST_DATA_URL);
	GM_xmlhttpRequest( {
		method : 'POST',
		url : POST_DATA_URL,
		data : params,
		headers : {
			"User-agent" : "Mozilla/4.0 (compatible) ProcrasDonate",
			"Content-type" : "application/x-www-form-urlencoded",
			"Content-length" : params.length
		},
		onload : function(r) {
			GM_log('POST TO PD worked ' + r.status + ' ' + r.responseText);
		},
		onerror : function(r) {
			GM_log('POST TO PD failed');
		}
	});
}

function make_payment(amt) {
	// var send_to_url = 'http://localhost:8000/Main/test/xmlhttprequest/';
	var send_to_url = 'http://tipjoy.com/api/tweetpayment/';

	var reason = "ProcrasDonating for a good cause";
	//var text = "p " + GM_getValue('cents_per_hour', '') + "¢ @" + GM_getValue('recipient') + " " + reason;
	//var text = "p $1 @" + GM_getValue('recipient') + " " + reason;
	var text = "p " + amt + "¢ @" + GM_getValue('recipient') + " " + escape(reason);
	
	//var dollars = (parseInt(GM_getValue('cents_per_hour', '')) / 100.0).toFixed(2);
	//var text = "p $" + dollars + " @" + GM_getValue('recipient') + " " + reason;
	
	var username = GM_getValue('twitter_username', '')
	var password = GM_getValue('twitter_password', '')
	if ( !username || !password ) {
		return false;
	}
	var params = "twitter_username=" + username + "&twitter_password=" + password + "&text=" + text;
	
	GM_log('      text  ' + text);
	GM_log('    encURI  ' + encodeURIComponent(text));
	GM_log('    escape  ' + escape(text));
	GM_xmlhttpRequest( {
		method :'POST',
		url :send_to_url,
		data :params,
		headers : {
			"User-agent" : "Mozilla/4.0 (compatible) ProcrasDonate",
			"Content-type" : "application/x-www-form-urlencoded",
			"Content-length" : params.length
		},
		onload : function(r) {
			GM_log('PAYMENT worked ' + r.status + ' ' + r.responseText);
		},
		onerror : function(r) {
			GM_log('PAYMENT failed');
		}
	});
}

function check_status() {
	var send_to_url = 'http://tipjoy.com/api/user/exists/';
	var params = 'twitter_username=weatherizer';
	GM_xmlhttpRequest( {
		method :'GET',
		url :send_to_url,
		data :params,
		headers : {
			"User-agent" :"Mozilla/4.0 (compatible) ProcrasDonate",
			"Content-length" :params.length
		},
		onload : function(r) {
			GM_log('STATUS worked ' + r.status + ' ' + r.responseText);
		},
		onerror : function(r) {
			GM_log('STATUS failed');
		}
	});
}

function create_account() {
	var send_to_url = 'http://tipjoy.com/api/createTwitterAccount/';
	var params = 'twitter_username=weatherizer&twitter_password=pea15nut';
	GM_xmlhttpRequest( {
		method :'POST',
		url :send_to_url,
		data :params,
		headers : {
			"User-agent" :"Mozilla/4.0 (compatible) ProcrasDonate",
			"Content-type" :"application/x-www-form-urlencoded",
			"Content-length" :params.length
		},
		onload : function(r) {
			GM_log('CREATE worked ' + r.status + ' ' + r.responseText);
		},
		onerror : function(r) {
			GM_log('CREATE failed');
		}
	});
}

function add_to_list(item, list) {
	GM_setValue(list, GM_getValue(list, '') + item + ';');
}

function delete_all_data() {
	if (!confirm('Do you really want to permenantly delete all the data from pageaddict?'))
		return;
	GM_setValue('first_visit', -1);
	reset_visits();

	var tag_list = get_tag_list();
	var i;

	for (i = 0; i < tag_list.length; i += 1) {
		tag = tag_list[i];
		GM_delValue(tag + '_times');
		GM_delValue(tag + '_spent');
	}
	GM_delValue('ignore_list');
	GM_delValue('tag_list');
	GM_savePrefs();
}

function reset_visits() {
	/*
	 * Called by delete_all_data *and* when new day occurs. 
	 * Just resets daily vars.
	 */
	var first = GM_getValue('first_visit', 0);
	if (first > 0)
		store_old_visits();
	var sites_array = GM_getValue('visited', '').split(";");
	GM_setValue('visited', '');
	var currentTime = new Date();
	var t_in_s = Math.round(currentTime.getTime() / 1000);
	GM_setValue('last_visit', t_in_s);
	GM_setValue('first_visit', t_in_s);
	var i;
	for (i = 0; i < sites_array.length; i += 1) {
		GM_delValue(sites_array[i] + '_count');
		GM_delValue(sites_array[i] + '_last');
	}
	// alert('reset addiction counts');
	GM_savePrefs();
}

function initialize_state_if_necessary() {
	/*
	 * Initialize settings and impact state enumerations. Other inits?
	 */
	if (!GM_getValue('settings_state', '')) { GM_setValue('settings_state', 'edit_account'); }
	if (!GM_getValue('impact_state', '')) { GM_setValue('impact_state', 'today'); }
}

function set_account_defaults_if_necessary() {
	/*
	 * Set any blank account data to defaults.
	 */
	if (!GM_getValue('twitter_username', '')) { GM_setValue('twitter_username', ''); }
	if (!GM_getValue('twitter_password', '')) { GM_setValue('twitter_password', ''); }
	if (!GM_getValue('recipient', '')) { GM_setValue('recipient', 'bilumi'); }
	if (!GM_getValue('cents_per_hour', '')) { GM_setValue('cents_per_hour', '95'); }
	if (!GM_getValue('hr_per_day_goal', '')) { GM_setValue('hr_per_day_goal', '2'); }
	if (!GM_getValue('hr_per_day_max', '')) { GM_setValue('hr_per_day_max', '3'); }
}

function reset_account_to_defaults() {
	/*
	 * Overwrite existing data (if any) with account defaults
	 */
	GM_setValue('twitter_username', '');
	GM_setValue('twitter_password', '');
	GM_setValue('recipient', 'bilumi');
	GM_setValue('cents_per_hour', '95');
	GM_setValue('hr_per_day_goal', '2');
	GM_setValue('hr_per_day_max', '3');
}

function store_old_visits() {
	/*
	 * Store old visits in tag_times and tag_spent
	 */
	calculate_time_use();
	var tag_counts = window.tag_counts;
	var tag_list = get_tag_list();
	var i, tag;
	for (i = 0; i < tag_list.length; i += 1) {
		tag = tag_list[i];
		GM_setValue(tag + '_times', GM_getValue(tag + '_times', '')
				+ GM_getValue('first_visit', 0) + ";");
		GM_setValue(tag + '_spent', GM_getValue(tag + '_spent', '')
				+ tag_counts[tag] + ";");

	}

	GM_setValue('total_times', GM_getValue('total_times', '')
			+ GM_getValue('first_visit', 0) + ";");
	GM_setValue('total_spent', GM_getValue('total_spent', '') + window.total
			+ ";");

}

function show_hidden_links() {
	/*
	 * Display hidden menu links that only apply to users running the extension.
	 */
	if (document.getElementById("history_link")) {
		document.getElementById("history_link").style.display = "block";
	}
	if (document.getElementById("settings_link")) {
		document.getElementById("settings_link").style.display = "block";
	}

	// document.getElementById("settings_link").style.display="block";
}

function check_page_inserts() {
	/*
	 * Insert data into matching webpage
	 *   * pageaddict.com
	 *   * localhost:8000 or procrasdonate.com
	 */
	var host = window.location.host;
	var href = window.location.href;

	if (host.match(/pageaddict\.com$/)) {
		// if(href.match(/pageaddict/)) {
		show_hidden_links();
		if (document.getElementById("insert_statistics_here")) {
			get_results_html();
		}
		if (document.getElementById("insert_history_here")) {
			plot_history(7);
		}
		if (document.getElementById("insert_settings_here")) {
			make_settings();
		}
	}
	
	if (host.match(/localhost:8000/) || host.match(/procrasdonate_com/)) {
		
		alter_page_for_users();
		
		if ( href.match(/\/settings\//) ) {
			if ( GM_getValue('settings_state','') == 'account' ) {
				insert_account_summary();
			} else if ( GM_getValue('settings_state','') == 'edit_account' ) {
				insert_account_form();
			} else if ( GM_getValue('settings_state','') == 'site_classifications' ) {
				insert_site_classifications();
			} else if ( GM_getValue('settings_state','') == 'balance' ) {
				insert_balance();
			}

		}
		else if ( href.match(/\/my_impact\//)) {
			insert_my_impact();
		}
		else if ( href.match(/\/feedback\//)) {
			reset_account_to_defaults();
		}
		
		if ( is_required_account_info_missing() && !href.match(/edit_my_account/) ) {
				//insert_account_warning();
		}
	}
}

function insert_site_classifications() {
	/*
	 * Inserts site classification html into page 
	 */
	var cell_text =
		settings_tab_snippet() +
		""
	
	document.getElementById("thin_column").innerHTML = cell_text;
	activate_settings_tab_events();
}

function insert_balance() {
	/*
	 * Inserts TipJoy balance html into page
	 */
	var cell_text =
		settings_tab_snippet() +
		""
	
	document.getElementById("thin_column").innerHTML = cell_text;
	activate_settings_tab_events();
}

function change_start_now_to_my_account() {
	$("#app_menu div a").each(function() {
		var href = $(this).attr("href");
		if ( href.match(/start_now/) ) {
			href = href.replace(/start_now/, "settings");
			$(this).attr("href", href);
			$(this).text("Settings");
		}
	});
}

function alter_page_for_users() {
	/*
	 * Alters ProcrastDonate.com DOM for extension users.
	 * eg, changes "Start Now" menu item to "My Account"
	 */
	change_start_now_to_my_account();
}

function is_required_account_info_missing() {
	/*
	 * Returns True if required account information is missing.
	 * Required:
	 *   twitter_username
	 *   twitter_password
	 */
	return !GM_getValue('twitter_username', false) || 
		!GM_getValue('twitter_password', false) ||
		!GM_getValue('recipient', false) ||
		!GM_getValue('cents_per_hour', false) || 
		!GM_getValue('hr_per_day_goal', false) || 
		!GM_getValue('hr_per_day_max', false)
}

function update_cents_per_day_goal() {
	$("#cents_per_day_goal").text(calculate_cents_per_day_goal());
}

function calculate_cents_per_day_goal() {
	/*
	 * Grabs donation amount and hourly goal from account form and returns
	 * goal in cents (eg, 234).
	 * Validates and cleans input.
	 */
	var cents_per_hour = parseInt($("input[name='cents_per_hour']").attr("value"));
	var hr_per_day_goal = parseFloat($("input[name='hr_per_day_goal']").attr("value"));
	
	if ( validate_cents_input(cents_per_hour) && validate_hours_input(hr_per_day_goal) ) {
		return (clean_cents_input(cents_per_hour) * clean_hours_input(hr_per_day_goal)).toFixed(2)
	} else {
		return '--'
	}
}

function update_cents_per_day_max() {
	$("#cents_per_day_max").text(calculate_cents_per_day_max());
}

function calculate_cents_per_day_max() {
	/*
	 * Grabs donation amount and hourly max from account form and returns
	 * max in cents (eg, 234).
	 * Validates and cleans input.
	 */
	var cents_per_hour = parseInt($("input[name='cents_per_hour']").attr("value"));
	var hr_per_day_max = parseFloat($("input[name='hr_per_day_max']").attr("value"));
	
	if ( validate_cents_input(cents_per_hour) && validate_hours_input(hr_per_day_max) ) {
		return (clean_cents_input(cents_per_hour) * clean_hours_input(hr_per_day_max)).toFixed(2)
	} else {
		return '--'
	}
}

function validate_cents_input(v) {
	var cents = parseInt(v);
	var hr_per_day_goal = parseFloat($("input[name='hr_per_day_goal']").attr("value"));
	var max = 2000;
	if ( cents > 0 && cents < max ) {
		return true
	}
	if ( cents >= max ) {
		var confirm_results = confirm("Do you really want to donate " + cents + "&cent; every hour you spend procrastinating up to your daily limit of " + hr_per_day_goal + "?");
		if ( confirm_results ) {
			return true
		} else {
			return false
		}
	}
	return false
}

function validate_hours_input(v) {
	var hours = parseFloat(v);
	if ( hours > 0 ) { return true }
	else { return false }
}

function clean_cents_input(v) {
	var cents = parseInt(v);
	return cents
}

function clean_hours_input(v) {
	var hours = parseFloat(v);
	if ( hours > 24 ) { hours = 24; }
	return hours.toFixed(2);
}

function validate_twitter_username_and_password(username, password) {
	return validate_string(username) && validate_string(password)
}

function validate_string(v) {
	return v && v != ''
}

function process_account_form() {
	/*
	 * Validate account form and save.
	 * @TODO twitter credentials and recipient twitter name should be verified.
	 * @TODO all fields should be validated as soon as user tabs to next field.
	 */
	$("#errors").html("");
	$("#success").html("");
	
	var twitter_username = $("input[name='twitter_username']").attr("value");
	var twitter_password = $("input[name='twitter_password']").attr("value");
	var recipient = $("input[name='recipient']").attr("value");
	var cents_per_hour = parseInt($("input[name='cents_per_hour']").attr("value"));
	var hr_per_day_goal = parseFloat($("input[name='hr_per_day_goal']").attr("value"));
	var hr_per_day_max = parseFloat($("input[name='hr_per_day_max']").attr("value"));
	
	if ( !validate_twitter_username_and_password(twitter_username, twitter_password) ) {
		$("#errors").append("<p>Please enter your twitter username and password</p>");
	} else if ( !validate_string(recipient) ) {
		$("#errors").append("<p>Please enter the donation recipient's twitter username</p>");
	} else if ( !validate_cents_input(cents_per_hour) ) {
		$("#errors").append("<p>Please enter a valid dollar amount. For example, to donate $2.34 an hour, please enter 2.34</p>");
	} else if ( !validate_hours_input(hr_per_day_goal) ) {
		$("#errors").append("<p>Please enter number of hours. For example, enter 1 hr and 15 minutes as 1.25</p>");
	} else if (!validate_hours_input(hr_per_day_max) ) {
		$("#errors").append("<p>Please enter number of hours. For example, enter 1 hr and 15 minutes as 1.25</p>");
	} else {
		GM_setValue('twitter_username', twitter_username);
		GM_setValue('twitter_password', twitter_password);
		GM_setValue('recipient', recipient);
		GM_setValue('cents_per_hour', clean_cents_input(cents_per_hour));
		GM_setValue('hr_per_day_goal', clean_hours_input(hr_per_day_goal));
		GM_setValue('hr_per_day_max', clean_hours_input(hr_per_day_max));
		$("#success").append("<p>Account information successfully updated.</p>");
		
		GM_setValue('settings_state', 'account');
		insert_account_summary();
	}
	return false;
}

function settings_tab_snippet() {
	var tab_text = 
		"<div id='tabs'>" +
			"<div id='account_tab' class='tab'>Account</div>" +
			"<div id='site_classifications_tab' class='tab'>Site Classifications</div>" +
			"<div id='balance_tab' class='tab'>Balance</div>" +
		"</div>"
	return tab_text
}

function activate_settings_tab_events() {
	$("#account_tab").click(function() {
		GM_setValue('settings_state', 'account')
		insert_account_summary();
	});
	$("#site_classifications_tab").click(function() {
		GM_setValue('settings_state', 'site_classifications')
		insert_site_classifications();
	});
	$("#balance_tab").click(function() {
		GM_setValue('settings_state', 'balance')
		insert_balance();
	});
}

function insert_account_form() {
	/*
	 * Inserts form so that user may enter account information.
	 * Required:
	 *   twitter_username
	 *   twitter_password
	 * Optional:
	 *   recipient (defaults to bilumi)
	 *   cents_per_hour (defaults to 1)
	 *   hr_per_day_goal (defaults to 1)
	 *   hr_per_day_max (defaults to 2)
	 */
	//$(".step").removeClass("selected");
	//$("#step2").addClass("selected");
	var cell_text =
		settings_tab_snippet() +
		"<div id='errors'></div>" +
		"<div id='success'></div>" +
		"<form name=\"account_form\" onSubmit=\"return false\">" +
			"<table>" +
			"<tbody>" +
				"<tr><td><label class='right'>Twitter username </label></td>" +
				"<td><input class='left' type='text' name='twitter_username' value='"+GM_getValue('twitter_username','')+"'></td></tr>" +
				
				"<tr class='above_helprow'><td><label class='right'>Twitter password</label></td>" +
				"<td><input class='left' type='password' name='twitter_password' value='"+GM_getValue('twitter_password','')+"'></td></tr>" +
				"<tr class='helprow'><td></td><td><div class='help'><a href='" + PRIVACY_URL + "'>Privacy Guarantee</a></div></td></tr>" +
			
				"<tr><td colspan='2'><div id='account_form_spacer'> </div></td></tr>" +
			
				"<tr class='above_helprow'><td><label class='right'>ProcrasDonation rate</label></td>" +
				"<td><input class='left' type='text' name='cents_per_hour' value='"+GM_getValue('cents_per_hour','')+"'></td></tr>" +
				"<tr class='helprow'><td></td><td><div class='help'>&cent; per hour</div></td></tr>" +
				
				"<tr class='above_helprow'><td><label class='right'>Recipient's Twitter name</label></td>" +
				"<td><input class='left' type='text' name='recipient' value='"+GM_getValue('recipient','')+"'></td></tr>" +
				"<tr class='helprow'><td></td><td><div class='help'><a href='" + RECIPIENTS_URL + "'>Browse charities list</a></div></td></tr>" +
				
				"<tr class='above_helprow'><td><label class='right'>ProcrasDonation goal</label></td>" +
				"<td><input class='left' id='hr_per_day_goal' type='text' name='hr_per_day_goal' value='"+GM_getValue('hr_per_day_goal','')+"'></td></tr>" +
				"<tr class='helprow'><td></td><td><div class='help'>hours per day</span><span id='cents_per_day_goal'></div></td></tr>" +
				
				"<tr class='above_helprow'><td><label class='right'>ProcrasDonation limit</label></td>" +
				"<td><input class='left' id='hr_per_day_max' type='text' name='hr_per_day_max' value='"+GM_getValue('hr_per_day_max','')+"'></td></tr>" +
				"<tr class='helprow'><td></td><td><div class='help'>hours per day</div></td></tr>" +
				//"<tr><td></td><td><span>Additional procrastination will not accumulate donations :-( </span><span id='cents_per_day_goal'></span></td></tr>" +
			"</tbody>" +
			"</table>" +
			"<p><input id='process_account_form' type='button' name='save' value='save'>" +
			"<span id='cancel_account_form' href='" + SETTINGS_URL + "'>cancel</a></p>" +
		"</form>";
			
	document.getElementById("thin_column").innerHTML = cell_text;
	document.getElementById("process_account_form").addEventListener('click', process_account_form, true);
	document.getElementById("hr_per_day_goal").addEventListener('keydown', update_cents_per_day_goal, true);
	document.getElementById("hr_per_day_max").addEventListener('keydown', update_cents_per_day_max, true);
	$("#cancel_account_form").click(function() {
		GM_setValue('settings_state', 'account');
	});
	activate_settings_tab_events();
}

function insert_account_summary() {
	/*
	 * Inserts account information, plus link to edit info
	 *   twitter_username
	 *   twitter_password
	 *   recipient (defaults to bilumi)
	 *   cents_per_hour (defaults to 1)
	 *   hr_per_day_goal (defaults to 1)
	 *   hr_per_day_max (defaults to 2)
	 */
	var cell_text =
		settings_tab_snippet() +
		
		"<table>" +
		"<tbody>" +
			"<tr><td><label class='right'>Twitter username </label></td>" +
			"<td><span class='left'>"+GM_getValue('twitter_username','')+"</span></td></tr>" +
			
			"<tr class='above_helprow'><td><label class='right'>Twitter password</label></td>" +
			"<td><span class='left'>shhhh!!</span>" +
			"<div class='help'><a href='" + PRIVACY_URL + "'>Privacy Guarantee</a></div></td></tr>" +
		
			"<tr><td colspan='2'><div id='account_form_spacer'> </div></td></tr>" +
		
			"<tr class='above_helprow'><td><label class='right'>ProcrasDonation rate</label></td>" +
			"<td><span class='left'>"+GM_getValue('cents_per_hour','')+"</span>" +
			"<div class='summaryhelp'>&cent; per hour</div></td></tr>" +
			
			"<tr class='above_helprow'><td><label class='right'>Recipient's Twitter name</label></td>" +
			"<td><span class='left'>"+GM_getValue('recipient','')+"</span></td></tr>" +

			
			"<tr class='above_helprow'><td><label class='right'>Desired ProcrasDonation amount</label></td>" +
			"<td><span class='left' id='hr_per_day_goal'>"+GM_getValue('hr_per_day_goal','')+"</span>" +
			"<div class='summaryhelp'>hours per day</span><span id='cents_per_day_goal'></div></td></tr>" +
			
			"<tr class='above_helprow'><td><label class='right'>ProcrasDonation limit</label></td>" +
			"<td><span class='left' id='hr_per_day_max'>"+GM_getValue('hr_per_day_max','')+"</span>" +
			"<div class='summaryhelp'>hours per day</div></td></tr>" +
			//"<tr><td></td><td><span>Additional procrastination will not accumulate donations :-( </span><span id='cents_per_day_goal'></span></td></tr>" +
		"</tbody>" +
		"</table>" +

		"<p id='edit_account_info'>Edit</p>" +
		"";
			
	document.getElementById("thin_column").innerHTML = cell_text;
	$("#edit_account_info").click(function() {
		GM_setValue('settings_state', 'edit_account');
		insert_account_form();
	});
	activate_settings_tab_events();
}

function insert_my_impact() {

}


function make_settings() {
	var cell_text = '<table><tr><td width="300">';
	var i;
	var ignore_list = GM_getValue('ignore_list', '').split(";");
	var tagmatch_list = GM_getValue('tagmatch_list', '').split(";");

	if (ignore_list.length > 1) {
		cell_text += '<h3>List of sites to ignore</h3><table id="ignore_list">';

		for (i = 0; i < ignore_list.length - 1; i += 1) {
			cell_text += '<tr><td>' + ignore_list[i].replace(/_/g, '.');
			cell_text += '</td><td><a href="#" id="delete_' + ignore_list[i] + '">stop ignoring</a></td></tr>';
		}

		cell_text += '</table>';
	}
	cell_text += '<h3>Tag by match</h3><table id="tagmatch_list"><thead><th>Pattern</th><th>Tag</th><th></th></thead>';
	for (i = 0; i < tagmatch_list.length - 1; i += 1) {
		cell_text += '<tr><td>' + tagmatch_list[i].split("=")[0] + '</td><td>'
				+ tagmatch_list[i].split("=")[1];
		cell_text += '</td><td><a href="#" id="delete_tagmatch_' + tagmatch_list[i]
				.split("=")[0] + '">delete</a></td></tr>';
	}
	cell_text += '<tr id="tagmatch_add_row"><td></td><td></td><td><a href="#" id="add_tagmatch">+Add</a></td></tr>';
	cell_text += '<tr><td>e.g.</td><td></td></tr>';
	cell_text += '<tr><td>facebook</td><td>social';
	cell_text += '</td><td></td></tr>';
	cell_text += '<tr><td colspan="3">=> *.facebook.com tagged with "social"</td></tr>';

	cell_text += '</table></td><td>';

	cell_text += '<h3>Delete all data from pageaddict</h3>';
	cell_text += '<a href="#" id="delete_everything">delete everything</a>';
	cell_text += '<h3>Idle timeout mode</h3>';
	if (GM_getValue('idle_timeout_mode', false))
		cell_text += '<input id="idle_mode_check" type="checkbox" checked>Enable idle timeout mode';
	else
		cell_text += '<input id="idle_mode_check" type="checkbox">Enable idle timeout mode';

	cell_text += '<br />Time spent in Flash games will not be counted in this mode.';
	cell_text += '</td></tr></table>';

	document.getElementById("insert_settings_here").innerHTML = cell_text;

	for (i = 0; i < ignore_list.length - 1; i += 1) {
		document.getElementById("delete_" + ignore_list[i]).addEventListener(
				'click', delete_ignore, true);
	}
	for (i = 0; i < tagmatch_list.length - 1; i += 1) {
		document.getElementById(
				"delete_tagmatch_" + tagmatch_list[i].split("=")[0])
				.addEventListener('click', delete_tagmatch, true);
	}
	document.getElementById("delete_everything").addEventListener('click',
			delete_all_data, true);
	document.getElementById("add_tagmatch").addEventListener('click',
			add_tagmatch_first, true);
	document.getElementById("idle_mode_check").addEventListener('change',
			update_idle_mode, true);
}

function add_tagmatch_first() {
	document.getElementById("tagmatch_add_row").innerHTML = '<td><input id="match" type="text"></td><td><input id="tag" type="text"></td>';
	document.getElementById("match").addEventListener('change',
			add_tagmatch_observe, true);
	document.getElementById("tag").addEventListener('change',
			add_tagmatch_observe, true);
}

function add_tagmatch_observe() {
	var the_tag = document.getElementById("tag").value;
	var the_match = document.getElementById("match").value;
	if (the_tag && the_tag.length > 0 && the_match && the_match.length > 0) {
		GM_setValue('tagmatch_list', GM_getValue('tagmatch_list', '') + the_match + "=" + the_tag + ";");
		make_settings();
	}
}

function set_default_idle_mode() {
	/*
	 * Called in house_keeping() (everytime a page loads)
	 * Sets 'idle_timeout_mode' if not true and not false to something.
	 * 
	 */
	// alert(navigator.platform);
	if (GM_getValue('idle_timeout_mode', true)
			&& !(GM_getValue('idle_timeout_mode', false))) {
		if (navigator.platform.indexOf("Mac") > -1)
			GM_setValue('idle_timeout_mode', true);
		else
			GM_setValue('idle_timeout_mode', false);
	}
}

function update_idle_mode() {
	if (document.getElementById("idle_mode_check").checked)
		GM_setValue('idle_timeout_mode', true);
	else
		GM_setValue('idle_timeout_mode', false);
}

function delete_ignore(event) {
	var site_name = event.target.id.match(/delete_(.*)/)[1];
	var ignore_list = GM_getValue('ignore_list', '').split(";");
	var new_ignore_list = '', i;
	for (i = 0; i < ignore_list.length - 1; i += 1) {
		if (site_name != ignore_list[i])
			new_ignore_list += ignore_list[i] + ';';
	}
	// alert(new_ignore_list);
	GM_setValue('ignore_list', new_ignore_list);
	make_settings();
}

function delete_tagmatch(event) {
	var site_name = event.target.id.match(/delete_tagmatch_(.*)/)[1];
	// GM_log(site_name);
	var tagmatch_list = GM_getValue('tagmatch_list', '').split(";");
	var new_tagmatch_list = '', i;
	for (i = 0; i < tagmatch_list.length - 1; i += 1) {
		if (site_name != tagmatch_list[i].split("=")[0])
			new_tagmatch_list += tagmatch_list[i] + ';';
	}
	// alert(new_ignore_list);
	GM_setValue('tagmatch_list', new_tagmatch_list);
	make_settings();
}

function change_history_cell(since_days) {
	var cell_text = '<p id="history_summary">Minutes you have spent in the past:</p>';
	cell_text += '<table><tr><td colspan="3"><div id="graph" height="300" width="500"></div>';
	cell_text += '<input id="trigger_plot" type="button" onclick="plot_data()" style="display: none">';
	cell_text += '</td><td><div id="insert_legend_here"></div></td></tr><tr><td>';
	cell_text += '<a href="#" id="plot_older">Older</a></td>';
	cell_text += '<td align="center">Days ago</td>';
	cell_text += '<td align="right"><a href="#" id="plot_newer">Newer</a></td>';
	cell_text += '</tr></table><br /><br />';
	cell_text += '<div id="insert_history_here"></div><br />';

	document.getElementById("main_table_cell").innerHTML = cell_text;
	document.getElementById("plot_older").addEventListener('click', function() {
		plot_history(since_days * 2);
	}, true);
	document.getElementById("plot_newer").addEventListener('click', function() {
		plot_history(Math.round(since_days / 2));
	}, true);
}

function new_plot_history(since_days) {
	if (since_days < 2)
		since_days = 2;
	change_history_cell(since_days);
	var t = current_time();
	var since = t - 60 * 60 * 24 * since_days;

	var data_array = [], j, tag, days_collection, times, spent, i, tday, ttime;
	var tag_list = get_tag_list();
	var tag_summary = [];
	var maxy = 0, binning = 1, xticks = [];

	var day_sum = [];

	for (i = 0; i < since_days; i += 1) {
		day_sum[i] = 0;
	}

	if (since_days > 10) {
		binning = Math.round(since_days / 10);
	}

	for (i = 0; i < tag_list.length; i += 1) {
		tag = tag_list[i];
		days_collection = [];

		times = GM_getValue(tag + '_times', '').split(";");
		spent = GM_getValue(tag + '_spent', '').split(";");
		for (j = 0; j < times.length - 1; j += 1) {
			if (parseInt(times[j], 10) < since)
				continue;
			tday = days_after(parseInt(times[j], 10), since);
			days_collection[tday] = parseInt(spent[j], 10);
			day_sum[tday] += parseInt(spent[j], 10);
			GM_log(tday);

		}
		tag_summary[i] = days_collection;
	}

	for (i = 0; i < tag_list.length; i += 1) {
		tag = tag_list[i];
		data_array[i] = [];
		for (j = 0; j < since_days - 1; j += 1) {
			if (maxy < day_sum[j])
				maxy = day_sum[j];
			if (tag_summary[i][j])
				ttime = tag_summary[i][j];
			else
				ttime = 0;
			data_array[i].push( [ j, 0 ]);
			data_array[i].push( [ j + 0.01, day_sum[j] / 60 ]);
			data_array[i].push( [ j + 0.98, day_sum[j] / 60 ]);
			data_array[i].push( [ j + 0.99, 0 ]);
			day_sum[j] -= ttime;

		}

	}

	for (j = 1; j < since_days; j += binning) {
		xticks.push( {
			label :'' + (since_days - j),
			v :j - 1 + 0.5
		});
	}

	GM_log(tag_summary);
	unsafeWindow.plot_data_array = data_array;
	unsafeWindow.pageaddict_tag_list = tag_list;
	unsafeWindow.plot_since = since;
	unsafeWindow.plot_xticks = xticks;
	unsafeWindow.plot_maxy = maxy / 60;

}

function days_after(time, since) {
	the_date = new Date();
	the_date.setTime(time * 1000);
	the_date.setHours(0, 0, 0);

	return Math.floor((the_date.getTime() / 1000 - since) / (60 * 60 * 24));

}

function plot_history(since_days) {
	new_plot_history(since_days);
	if (since_days < 2)
		since_days = 2;
	change_history_cell(since_days);
	var t = current_time();
	var since = t - 60 * 60 * 24 * since_days;
	var tag_list = get_tag_list();
	var i, tag, j, times, spent, all_times = new Object;
	var all_spent = [];
	var all_times_array = [];
	var all_spent_array = [];

	for (i = 0; i < tag_list.length; i += 1) {
		all_spent[i] = new Object;
		tag = tag_list[i];
		times = GM_getValue(tag + '_times', '').split(";");
		spent = GM_getValue(tag + '_spent', '').split(";");
		for (j = 0; j < times.length - 1; j += 1) {
			if (parseInt(times[j], 10) < since)
				continue;
			all_spent[i][times[j]] = parseInt(spent[j], 10);
			all_times[times[j]] = 1
		}
	}

	var total_times = GM_getValue('total_times', '').split(";");
	var total_spent = GM_getValue('total_spent', '').split(";");
	var total_object = new Object;
	for (i = 0; i < total_times.length - 1; i += 1) {
		total_object[total_times[i]] = parseInt(total_spent[i], 10);
	}
	var total_array = [];

	for ( var ttime in all_times)
		all_times_array.push(parseInt(ttime, 10));

	for (i = 0; i < all_times_array.length; i += 1) {
		all_spent_array[i] = [];
		for (j = 0; j < tag_list.length; j += 1) {
			if (all_spent[j]['' + all_times_array[i]])
				all_spent_array[i].push(all_spent[j]['' + all_times_array[i]]);
			else
				all_spent_array[i].push(0);

		}
		if (total_object['' + all_times_array[i]])
			total_array.push(total_object['' + all_times_array[i]]);
		else
			total_array.push(0);

	}

	var data_array = [];
	var this_array, this_sum = [];
	var binning = 1;
	var ntimes = all_times_array.length;
	var maxy = 0, xticks = [];
	var the_date;

	if (ntimes > 10) {
		binning = Math.round(ntimes / 10);
	}
	// alert(''+ntimes+' '+binning);

	for (i = 0; i < all_times_array.length; i += 1) {
		this_sum.push(0.0);
	}
	for (j = 0; j < tag_list.length; j += 1) {
		for (i = 0; i < all_times_array.length; i += 1) {
			this_sum[i] += (all_spent_array[i][j] / 60);
		}
	}
	for (i = 0; i < all_times_array.length; i += 1) {
		if (this_sum[i] > maxy) {
			maxy = this_sum[i];
		}
	}

	for (j = 0; j < tag_list.length; j += 1) {
		this_array = [];

		for (i = 0; i < all_times_array.length; i += 1) {
			the_date = new Date();
			the_date.setTime(all_times_array[i] * 1000);
			the_date.setHours(0, 0, 0);

			this_array.push( [
					Math.floor((the_date.getTime() / 1000 - since)
							/ (60 * 60 * 24)), this_sum[i] ]);
			this_sum[i] -= (all_spent_array[i][j] / 60);
		}
		data_array.push(this_array);
	}

	var last_days_ago, this_days_ago, days_to_insert, previously_inserted = 0;

	for (i = 0; i < all_times_array.length; i += binning) {
		the_date = new Date();
		the_date.setTime(all_times_array[i] * 1000);
		the_date.setHours(0, 0, 0);
		this_days_ago = Math.floor((t - the_date.getTime() / 1000)
				/ (60 * 60 * 24));
		xticks.push( {
			label :'' + this_days_ago,
			v :Math.floor((the_date.getTime() / 1000 - since) / (60 * 60 * 24))
		});

		if (i > 0) {
			days_to_insert = last_days_ago - this_days_ago - 1;
			if (days_to_insert > 0) {
				for (j = 0; j < days_to_insert; j += 1) {
					// insert zeroin data_array and xticks at position
					// i-1+previously_inserted
				}
				previously_inserted += days_to_insert;
			}
		}
		last_days_ago = this_days_ago;

	}

	// var line = new EasyPlot("line", {}, $('graph'), data_array);
	// unsafeWindow.plot_data_array=data_array;
	// unsafeWindow.pageaddict_tag_list=tag_list;
	// unsafeWindow.all_times_array=all_times_array;
	// unsafeWindow.plot_since=since;
	// unsafeWindow.plot_xticks=xticks;
	// unsafeWindow.plot_maxy=maxy;

	document.getElementById("trigger_plot").click();

	var page_text = '';
	page_text += '<table width="500px" id="history_table" cellspacing="0"><tr align="left"><th>Day</th>';
	for (i = 0; i < tag_list.length; i += 1) {
		page_text += '<th>' + tag_list[i] + '</th>';
	}
	page_text += '<th>all</th></tr><tbody>';
	var months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug',
			'Sep', 'Oct', 'Nov', 'Dec' ];

	for (i = all_times_array.length - 1; i > 0; i -= 1) {
		the_date = new Date();
		the_date.setTime(all_times_array[i] * 1000);
		// page_text+='<tr><td>'+Math.floor((t-all_times_array[i])/(60*60*24))+'</td>';
		page_text += '<tr><td>' + the_date.getDate() + '-'
				+ months[the_date.getMonth()] + '-' + the_date.getFullYear()
				+ '</td>';
		for (j = 0; j < tag_list.length; j += 1) {
			page_text += '<td>' + Math.round(all_spent_array[i][j] / 60) + '</td>';
		}
		page_text += '<td>' + Math.round(total_array[i] / 60) + '</td></tr>';
	}

	page_text += '</tbody></table>';

	document.getElementById("insert_history_here").innerHTML = page_text;
}

function calculate_time_use() {
	var sites_array = GM_getValue('visited', '').split(";");
	var i, count, alert_str = '', total = 0;
	var unsort_arr = [];
	var tag_counts = new Object;
	var span = GM_getValue('last_visit', 0) - GM_getValue('first_visit', 0);
	if (span < 1) {
		span = 1;
	}

	var tag_list = GM_getValue('tag_list', '').split(";");
	tag_list.pop();
	tag_list.push("undefined")
	var this_tags, j, found_tag;

	for (i = 0; i < tag_list.length; i += 1) {
		tag_counts[tag_list[i]] = 0;
	}

	for (i = 0; i < sites_array.length - 1; i += 1) {
		if (in_ignore_list(sites_array[i]) == 1) {
			continue;
		}
		// if(sites_array[i].length>1) {
		count = GM_getValue(sites_array[i] + '_count', 0);
		// alert_str+=sites_array[i]+': '+(Math.round(count*10/12)/10)+'
		// mins\n';
		unsort_arr.push( [ sites_array[i], count,
				Math.round(count * 1000 / span) / 10.0 ]);
		// }
		total += count;
		this_tags = get_tag_for_site(sites_array[i]);

		if (this_tags.length > 0)
			tag_counts[this_tags] += count;
		else
			tag_counts["undefined"] += count;

	}

	window.tag_counts = tag_counts;
	window.total = total;
	window.unsort_arr = unsort_arr;
}

function get_results_html() {
	/*
	 * Inserts user's browsing results into page!!
	 */
	var sites_array = GM_getValue('visited', '').split(";");
	var i, count, alert_str = '', total = 0;
	var unsort_arr = [];
	var tag_counts = new Object;
	var span = GM_getValue('last_visit', 0) - GM_getValue('first_visit', 0);
	if (span < 1) {
		span = 1;
	}

	var tag_list = GM_getValue('tag_list', '').split(";");
	tag_list.pop();
	tag_list.push("undefined");
	var this_tags, j, found_tag;

	calculate_time_use();

	unsort_arr = window.unsort_arr;
	total = window.total;
	tag_counts = window.tag_counts;

	var sort_arr = unsort_arr.sort(sortf);
	var page_text = '';
	var terror = GM_getValue('error', '');
	if (terror.length > 0) {
		page_text += '<div id="pa_error">' + terror + '</div>';
		GM_setValue('error', '');
	}

	page_text += '<br /><span id="total_summary">';
	page_text += 'Total time spent: ' + pretty_time(total) + '<br />'
			+ Math.round(total * 100 / span) + '% of ' + pretty_time(span)
			+ ' since browser started today</span><br /><br />';

	// page_text+='<p>defined tags: '+tag_list;

	page_text += '<table width="500px" id="tags_table" cellspacing="0"><tr align="left"><th>Tag</th><th>Time</th><th>% Total</th><th>Restrict?</th><th>Minutes/day</th><th></th></tr><tbody>';
	for (i = 0; i < tag_list.length; i += 1) {
		page_text += '<tr><td>' + tag_list[i] + '</td>';
		page_text += '<td>' + pretty_time(tag_counts[tag_list[i]]) + '</td>';
		page_text += '<td>' + Math.round(tag_counts[tag_list[i]] * 1000 / span) / 10.0 + '%</td>';
		if (GM_getValue(tag_list[i] + '_restricted', 0) > 0) {
			page_text += '<td align="center"><input id="check_restrict_' + tag_list[i] + '" type="checkbox" checked></td>';
			page_text += '<td><input id="number_restrict_' + tag_list[i]
					+ '" type="text" value="'
					+ GM_getValue(tag_list[i] + '_max_time', 0)
					+ '" size="5"></td>';
		} else {
			page_text += '<td align="center"><input id="check_restrict_' + tag_list[i] + '" type="checkbox"></td>';
			page_text += '<td><input id="number_restrict_' + tag_list[i] + '" type="text" disabled" size="5"></td>';
		}
		page_text += '<td><a href="#" id="delete_tag_' + tag_list[i] + '" style="color: black">delete</a></td></tr>';
	}

	page_text += '</tbody></table>';

	page_text += '<br /><span>';
	page_text += '<select id="tag_drop">';
	page_text += '<option value="_ignore">Tag...</option>';
	page_text += '<option value="_new_tag">&nbsp;&nbsp;&nbsp;New tag...</option>';
	page_text += '<option value="_remove_tags">&nbsp;&nbsp;&nbsp;Remove tags</option>';
	page_text += '<option value="_ignore_forever">&nbsp;&nbsp;&nbsp;Ignore site</option>';
	page_text += '<option value="_ignore" disabled>----</option>';
	page_text += '<option value="_ignore" disabled>Apply tag</option>';

	for (i = 0; i < tag_list.length - 1; i += 1) { // leave undefined tag out
		page_text += '<option value="' + tag_list[i] + '">&nbsp;&nbsp;&nbsp;'
				+ tag_list[i] + '</option>';
	}
	page_text += '</select>';
	page_text += '</span><span>';
	page_text += '<input type="text" id="new_tag_name" style="display: none;">';
	page_text += '</span>';

	page_text += '<br /><table width="500px" id="sites_table" cellspacing="0"><tr align="left"><th></th><th>Site</th><th>Time</th><th>% Total</th><th>Tags</th></tr><tbody>';

	for (i = 0; i < sort_arr.length; i += 1) {
		page_text += '<tr><td><input id="check_' + sort_arr[i][0] + '" type="checkbox"></td>';
		page_text += '<td>' + sort_arr[i][0].replace(/__/g, '/').replace(/_/g,
				'.');
		// page_text+=' "'+sort_arr[i][0]+'" ';
		page_text += '</td>';
		page_text += '<td>' + pretty_time(sort_arr[i][1]) + '</td>';
		page_text += '<td>' + sort_arr[i][2] + '%</td><td>'
				+ get_tag_for_site(sort_arr[i][0]) + '</td></tr>';
	}
	page_text += '</tbody></table>';

	document.getElementById("insert_statistics_here").innerHTML = page_text;
	var add_tag_field = document.getElementById("new_tag_name");
	add_tag_field.addEventListener('change', add_tag, true);
	var tname;
	for (i = 0; i < tag_list.length; i += 1) {
		tname = tag_list[i];
		document.getElementById("check_restrict_" + tag_list[i])
				.addEventListener('change', update_restriction_policy, true);
		document.getElementById("number_restrict_" + tag_list[i])
				.addEventListener('change', update_restriction_policy, true);
		document.getElementById("delete_tag_" + tag_list[i]).addEventListener(
				'click', delete_tag, true);
	}
	document.getElementById("tag_drop").addEventListener('change', drop_watch,
			true);
	// get_results();a
}

function delete_tag(event) {
	var tag_name = event.target.id.match(/delete_tag_(.*)/)[1];
	var tag_list = GM_getValue('tag_list', '').split(";");
	var new_tag_list = '', i;
	if (!confirm("Are you sure you want to delete the tag '" + tag_name + "'?"))
		return;
	for (i = 0; i < tag_list.length - 1; i += 1) {
		if (tag_name != tag_list[i])
			new_tag_list += tag_list[i] + ';';
	}
	// alert(new_tag_list);
	var tag_list = GM_setValue('tag_list', new_tag_list);
	get_results_html();
}

function get_tag_list() {
	var tag_list = GM_getValue('tag_list', '').split(";");
	tag_list.pop();
	tag_list.push("undefined");
	return tag_list;
}

function update_restriction_policy() {
	var tag_list = get_tag_list();
	var element, element2;
	for (i = 0; i < tag_list.length; i += 1) {
		element = document.getElementById("check_restrict_" + tag_list[i]);
		if (element && element.checked) {
			GM_setValue(tag_list[i] + '_restricted', 1);
			element2 = document
					.getElementById("number_restrict_" + tag_list[i]);
			if (element2 && parseInt(element2.value, 10) > 0)
				GM_setValue(tag_list[i] + '_max_time', parseInt(element2.value,
						10));
		} else {
			GM_setValue(tag_list[i] + '_restricted', 0);
		}
	}
	get_results_html();
}

function get_this_url() {
	/*
	 * Returns current domain with '.' replaced by '_'
	 *   eg, bilumi_org or www_google_com
	 * 
	 * For google and google only, appends first path component to domain if one exists.
	 *   eg, http://www.google.com/search?q=mosuo becomes
	 *       www_google_com__search
	 *       
	 * @TODO canonicalize existence and absence of 'www' 
	 */
	var site = window.location.host;

	site = site.replace(/\./g, '_');
	if (site.match(/www_google_com$/)) {
		var path_array = window.location.pathname.split('/');
		if (path_array.length > 1 && path_array[1].length > 0) {
			site = site + "__" + path_array[1];
		}
	}

	return site;
}

function get_decoded_url() {
	/*
	 * Returns exactly what get_this_url() would return, withough any character
	 * encoding.
	 * 
	 * eg, bilumi.org or www.google.com or www.google.com/search
	 *
	 * @TODO KEEP IN SYNCH WITH GET THIS URL!
	 */
	var site = window.location.host;

	if (site.match(/www_google_com$/)) {
		var path_array = window.location.pathname.split('/');
		if (path_array.length > 1 && path_array[1].length > 0) {
			site = site + "/" + path_array[1];
		}
	}

	return site;
}

function get_tag_for_site(site) {
	var tag = GM_getValue(site + '_tags', '');
	if (tag[tag.length - 1] == ';')
		tag = tag.slice(0, -1);

	if (tag.length == 0) {
		var tagmatch_list = GM_getValue('tagmatch_list', '').split(";");
		var site2 = site.replace(/__/g, '/').replace(/_/g, '.');

		for (i = 0; i < tagmatch_list.length - 1; i += 1) {
			if (site2.indexOf(tagmatch_list[i].split("=")[0]) > -1) {
				tag = tagmatch_list[i].split("=")[1];
			}
		}
	}
	return tag;

}

function check_restriction() {
	/*
	 * If on pageaddict site, do nothing.
	 * 
	 * If on restricted website and time use has exceeded tag+'_max_time'
	 * Then enforce_restriction()
	 */
	var site = get_this_url();

	if (site.match(/pageaddict_com$/))
		return;

	var this_tags = get_tag_for_site(site);
	var i;
	var tags_to_check = [];

	// alert(site);
	if (this_tags.length == 0) {
		this_tags = 'undefined';
	}

	if (GM_getValue(this_tags + '_restricted', 0) > 0) {
		tags_to_check.push(this_tags);
	}

	if (tags_to_check.length > 0) {
		calculate_time_use();
		var tag_counts = window.tag_counts;
		for (i = 0; i < tags_to_check.length; i += 1) {
			if (tag_counts[tags_to_check[i]] > (GM_getValue(
					tags_to_check[i] + '_max_time', 0)) * 60) {
				enforce_restriction();
			}
		}
	}
}

function enforce_restriction() {
	/*
	 * Rewrite page content to block access!
	 * This is called when visiting a site which is tagged by a tag
	 * that has a time limit set and the time limit has been exceeded.
	 */

	// document.body.bgColor='white';
	// document.body.background='none';
	// document.body.style.background='none';
	// document.body.style.color='black';

	var i;
	for (i = 0; i < document.styleSheets.length; i += 1) {
		document.styleSheets[i].disabled = true;

	}

	document.body.innerHTML = '<p />get back to work!<p />page access blocked by pageaddict';
}

function drop_watch() {
	var menu = document.getElementById("tag_drop").value;
	// alert(menu.value);
	if (menu == '_new_tag') {
		document.getElementById("new_tag_name").style.display = 'inline';
		document.getElementById("new_tag_name").focus();
		return;
	}
	document.getElementById("new_tag_name").style.display = 'inline';
	if (menu == '_remove_tags') {
		remove_tags(menu);
		return;
	}
	if (menu == '_ignore_forever') {
		ignore_forever(menu);
		return;
	}

	if (menu == '_ignore') {
		return;
	}
	apply_tag(menu);

}

function add_tag() {

	var field = document.getElementById("new_tag_name");
	var tag = field.value;

	if (!tag.match(/[a-zA-Z0-9]+/)) {
		GM_setValue('error', 'Invalid tag name');
		get_results_html();
		return;
	}

	var tag_list = GM_getValue('tag_list', '');
	GM_setValue('tag_list', tag_list + tag + ';');
	apply_tag(tag);
	get_results_html();
}

function apply_tag(tag) {
	// var tag_list=GM_getValue('tag_list', '');
	// GM_setValue('tag_list', tag_list+tag+';');
	var sites_array = GM_getValue('visited', '').split(";");
	var check;
	for (i = 0; i < sites_array.length - 1; i += 1) {
		check = document.getElementById("check_" + sites_array[i]);
		if (check && check.checked) {
			// if(in_list(tag, sites_array[i]+'_tags')==0)
			// ensure_in_list(tag, sites_array[i]+'_tags');
			GM_setValue(sites_array[i] + '_tags', tag + ';');
		}
	}
	get_results_html();

}

function ignore_forever() {
	// var tag_list=GM_getValue('tag_list', '');
	// GM_setValue('tag_list', tag_list+tag+';');
	var sites_array = GM_getValue('visited', '').split(";");
	var check;
	for (i = 0; i < sites_array.length - 1; i += 1) {
		check = document.getElementById("check_" + sites_array[i]);
		if (check && check.checked) {
			GM_setValue('ignore_list', GM_getValue('ignore_list', '')
					+ sites_array[i] + ';');
		}
	}
	get_results_html();

}

function ensure_in_list(item, list) {
	if (in_list(item, list) == 0)
		add_to_list(item, list);
}

function in_list(item, listn) {
	var list = GM_getValue(listn, '').split(";");
	for (i = 0; i < list.length - 1; i += 1) {
		if (item == list[i]) {
			return 1;
		}
	}
	return 0;
}

function in_ignore_list(site) {
	var list = GM_getValue('ignore_list', '').split(";");
	for (i = 0; i < list.length - 1; i += 1) {
		if (site == list[i]) {
			return 1;
		}
	}
	return 0;
}

function current_time() {
	var currentTime = new Date();
	return Math.round(currentTime.getTime() / 1000);

}

function insert_into_array(arr, item, position) {
	var left, right;
	left = arr.splice(0, position);
	right = arr.slice(position + 1);
	left.push(item);
	return left.concat( [ item ], right);

}

function remove_tags(tag) {
	// var tag_list=GM_getValue('tag_list', '');
	// GM_setValue('tag_list', tag_list+tag+';');
	var sites_array = GM_getValue('visited', '').split(";");
	var check;
	for (i = 0; i < sites_array.length - 1; i += 1) {
		check = document.getElementById("check_" + sites_array[i]);
		if (check && check.checked) {
			GM_setValue(sites_array[i] + '_tags', '');
		}
	}
	get_results_html();

}

function sortf(b, a) {
	return ((a[1] < b[1]) ? -1 : ((a[1] > b[1]) ? 1 : 0));
	// return a[1] - b[1];
}

function pretty_time(ts) {
	if (ts > 3600 * 2) {
		return '' + Math.floor(ts / 3600) + ' hrs '
				+ Math.round((ts - Math.floor(ts / 3600) * 3600) / 60)
				+ ' mins';
	} else if (ts > 60 * 2) {
		return '' + Math.round(ts / 60) + ' minutes';
	} else {
		return '' + Math.round(ts) + ' seconds';
	}
}
