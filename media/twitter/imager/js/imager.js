	
$(document).ready( function() {
	
	///
	/// Hover on theme summary shows real transparency
	///
	$(".select_theme").hover(
			function() {
				$(this).children(".images")
					.css("background", "#E5E5E5")
					.children("img").css("background", "none");
			},
			function() {
				$(this).children(".images")
					.css("background", "inherit")
					.children("img").css("background", "url(/twitter/media/twitter/imager/img/uploads/default/looks_transparent.png) repeat");
			}
		);
	
	$(".weatherize_selection").hover(
			function() {
				$(this).next().children(".images")
					.css("background", "#E5E5E5")
					.children("img").css("background", "none");
			},
			function() {
				$(this).next().children(".images")
					.css("background", "inherit")
					.children("img").css("background", "url(/twitter/media/twitter/imager/img/uploads/default/looks_transparent.png) repeat");
			}
		);
	
	///
	/// Automatic hover on username input field if there is one.
	/// If there isn't one, then automatic hover on zipcode or theme name.
	///
	$("#comment_textarea").focus();
});
