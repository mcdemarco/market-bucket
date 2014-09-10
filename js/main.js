//main.js for Market Bucket by @mcdemarco.

//To force authorization: https://account.app.net/oauth/authorize etc.
var authUrl = "https://account.app.net/oauth/authenticate?client_id=" + api['client_id'] + "&response_type=token&redirect_uri=" + encodeURIComponent(site) + "&scope=messages:" + api.channel_type;
var channelArgs = {count: -5, since_id: 'last_read_inclusive'}; //Default post count for retrieval.
var columnArray = {};
var channelArray = {"now": {"column": "#col1", "channel": 0},
					"later": {"column": "#col2", "channel": 0},
					"archive": {"column": "#col3", "channel": 0},
					"hashtags" : {"column": "#col4"}
				   };

/* main execution path */

function initialize() {
	$("a.adn-button").attr('href',authUrl);
	$("a.h1-link").attr('href',site);
	checkLocalStorage();
	if (!api.accessToken) {
		logout();
		return;
	}
	$.appnet.authorize(api.accessToken,api.client_id);
	if (!$.appnet.token.get()) {
			api.accessToken = '';
			logout();
			return;
	} else {
		pushHistory(site);
		$(".loggedOut").hide();
		getChannels();
		$(".loggedIn").show('slow');
	}
	colorizeTags();
}

function addItem() {
	var message = $("textarea#item").val();
	if (message == "") return;
	$("input[name=bucketBucket]").each(function (index) {
		if ($(this).is(":checked"))
			createItem(channelArray[$(this).prop("id")].channel, message);
	});
}

function createChannels() {
	//Create new channels for user.
	var channel = {
		type: api.channel_type,
		auto_subscribe: true,
		annotations:  [{
						  type: api.channel_type,
						  value: {'list_type': 'now'}
					  }]
	};
	var promise1 = $.appnet.channel.create(channel);
	promise1.then(createChannel2, function (response) {failAlert('Failed to create grocery channel.');});
}

function createChannel2() {
	//Create new channels for user.
	var channel2 = {
		type: api.channel_type,
		auto_subscribe: true,
		annotations:  [{
						  type: api.channel_type,
						  value: {'list_type': 'later'}
					  }]
	};
	var promise2 = $.appnet.channel.create(channel2);
	promise2.then(createChannel3, function (response) {failAlert('Failed to create grocery channel.');});
}

function createChannel3() {
	//Create new channels for user.
	var channel3 = {
		type: api.channel_type,
		auto_subscribe: true,
		annotations:  [{
						  type: api.channel_type,
						  value: {'list_type': 'archive'}
					  }]
	};
	var promise3 = $.appnet.channel.create(channel3);
	promise3.then(completeCreateChannels, function (response) {failAlert('Failed to create grocery channel.');});
}

function completeCreateChannels() {
	console.log("channels created");
}

function getChannels() {
	//Determine channels.
	var args = {
		channel_types: api.channel_type,
		include_annotations: 1
	};
	var promise = $.appnet.channel.getCreated(args);
	promise.then(completeChannels, function (response) {failAlert('Failed to retrieve grocery channel.');});
}

function completeChannels(response) {
	if (response.data.length > 0) {
		for (var c = 0; c < response.data.length; c++) {
			var thisChannel = response.data[c];
			//Currently assuming we're the only annotation.
			var annotation = thisChannel.annotations[0].value;
			$(channelArray[annotation.list_type].column + " h2 span.mainTitle").html((annotation.title ? annotation.title : annotation.list_type));
			var args = {
				include_annotations: 1
			};
			channelArray[annotation.list_type].channel = thisChannel.id;
			var promise = $.appnet.message.getChannel(thisChannel.id, args);
			promise.then(completeChannel, function (response) {failAlert('Failed to retrieve items.');});
		}
	} else {
		createChannels();
	}

}

function completeChannel(response) {
	if (response.data.length > 0) {
		
		//Populate channel.
/*
	$(columnArray["my_stream"]).append("<h3>User Stream</h3");
	var promise1 = $.appnet.message.getChannel(channel,channelArgs);
	promise1.then(completeStream, function (response) {failAlert('Failed to retrieve user stream.');});

	$(columnArray["unified"]).append("<h3>Unified Stream</h3");
	var promise2 = $.appnet.post.getUnifiedStream(streamArgs);
	promise2.then(completeStream, function (response) {failAlert('Failed to retrieve unified stream.');});

	$(columnArray["global"]).append("<h3>Global Stream</h3");
	var promise3 = $.appnet.post.getGlobal(streamArgs);
	promise3.then(completeStream, function (response) {failAlert('Failed to retrieve global stream.');});
*/
	}
}

function updateChannels() {/*
	$.appnet.channel.update(55870,{annotations:  [{ type: api.channel_type, value: {'list_type': 'now'}}]})
	$.appnet.channel.update(55871,{annotations:  [{ type: api.channel_type, value: {'list_type': 'later'}}]})
	$.appnet.channel.update(55872,{annotations:  [{ type: api.channel_type, value: {'list_type': 'archive'}}]})
*/}

function createItem(channel,message) {
	if (channel == 0) {
		failAlert('Failed to create item.');
		return;
	}
	var newMessage = {
		text: message
	};
	var promise = $.appnet.message.create(channel, newMessage);
	promise.then(completeItem, function (response) {failAlert('Failed to create item.');});
}

function completeItem(response) {
	var respd = response.data;
	clearForm();
	//need a reverse map to get the column here.
	//$("#col1").prepend(formatItem(respd,true));
}

// ***** //

function clearForm() {
	$("textarea#item").val("");
}

function completeStream(response) {
	if (response.data.length > 0) {
		var thisCrick = response.data;
		var thisTicker = response.meta.marker;
		var thisColumn = columnArray[thisTicker.name];
	}

	if (thisCrick[thisCrick.length - 1].id == thisTicker.last_read_id) {
		if (response.meta.more == true) {
			//First call, but not starting at the head of the stream.
			formatEllipsis(thisColumn);
		}
		$(thisColumn).append("<hr />");
	}

	//Process the stream and marker.
	for (var i=0; i < thisCrick.length; i++) {
		if (thisCrick[i].id == thisTicker.id) {
			formatMarker(thisTicker,thisColumn);
		} else if (thisCrick[i].id == thisTicker.last_read_id) {
			formatLastSeen(thisTicker,thisColumn);
		}
		formatPost(thisCrick[i],thisColumn,thisTicker);
	}

	if (thisCrick[thisCrick.length - 1].id == thisTicker.last_read_id) {
		//We're ending at the marker and have more to retrieve.
		if (thisTicker.id == thisTicker.last_read_id) {
			//We got the real marker as the last read marker and can skip it in the request.
			var restreamArgs = restreamArgsExclusive;
		} else {
			//The marker and last read marker are different, so:
			//include the marker next time,
			var restreamArgs = restreamArgsInclusive;
			//and indicate the break.
			formatEllipsis(thisColumn);
			$(thisColumn).append("<hr />");
		}
		switch (thisTicker.name) {
			case "my_stream":
				var promise = $.appnet.post.getUserStream(restreamArgs);
				break;
			case "unified":
				var promise = $.appnet.post.getUnifiedStream(restreamArgs);
				break;
			case "global":
				var promise = $.appnet.post.getGlobal(restreamArgs);
				break;
		}

		promise.then(completeStream, function (response) {failAlert('Failed to retrieve rest of stream.');});
	} else {
		//Just assume there's more stream.
		formatEllipsis(thisColumn);
	}

}

/* miscellaneous functions */

function checkLocalStorage() {
	if (localStorage && localStorage["accessToken"]) {
			//Retrieve the access token.
			try {api.accessToken = localStorage["accessToken"];} 
			catch (e) {}
	} else {
		api.accessToken = window.location.hash.split("access_token=")[1];
		if (api.accessToken && localStorage) {
			try {localStorage["accessToken"] = api.accessToken;} 
			catch (e) {}
		}
	}
}

function failAlert(msg) {
	document.getElementById("errorDiv").scrollIntoView();
	$('#errorDiv').html(msg).show().fadeOut(8000);
}

function formatEllipsis(column) {
		$(column).append("<div class='spacer'><span class='fa fa-ellipsis-v'></span></div>");
}

function formatItem(post,column) {
	var postDate = new Date(post.created_at);
	$(column).append("<div><span class='author'><strong>@"+post.user.username+"</strong>" + (post.user.name ? " (" + post.user.name + ")" : "") + "</span><br/>" + (post.html ? post.html : "<span class='special'>[Post deleted]</span>") + "<br/>" + "<div style='text-align:right;'><a style='font-style:italic;text-decoration:none;font-size:smaller;' href='" + post.canonical_url + "'>" + postDate.toLocaleString() + "</a><span onclick='completeItem(" + post.id + ");' class='fa fa-check-o markButton' title='Set marker to post " + post.id + "'></span></div></div><hr/>");
}

function logout() {
	//Erase token and post list.
	api.accessToken = '';
	if (localStorage) {
		try {
			localStorage.removeItem("accessToken");
		} catch (e) {}
	}

	$(".loggedIn").hide();
	$(".loggedOut").show();
	$(channelArray["now"].column).html("");
	$(channelArray["later"].column).html("");
	$(channelArray["archive"].column).html("");
}

function pushHistory(newLocation) {
	if (history.pushState) 
		history.pushState({}, document.title, newLocation);
}

function colorizeTags() {
	$(".tag").each(function(index) {
		var thisColor = getColor($(this).html());
		$(this).css("background-color", thisColor).css("color", getContrastYIQ(thisColor.substring(1,7)));
	});
}

function getColor(str) {
	//Get a random color from the tag text.
    for (var i = 0, hash = 0; i < str.length; hash = str.charCodeAt(i++) + ((hash << 5) - hash));
    color = Math.floor(Math.abs((Math.sin(hash) * 10000) % 1 * 16777216)).toString(16);
    return '#' + Array(6 - color.length + 1).join('0') + color;
}

function getContrastYIQ(hexcolor){
	//Get the contrast color for user-defined tag colors using the YIQ formula.
	var r = parseInt(hexcolor.substr(0,2),16);
	var g = parseInt(hexcolor.substr(2,2),16);
	var b = parseInt(hexcolor.substr(4,2),16);
	var yiq = ((r*299)+(g*587)+(b*114))/1000;
	return (yiq >= 128) ? 'black' : 'white';
}

function tagButton(that) {
	$("#item").val($("#item").val() + " #" + $(that).val());
}

function toggleAbout() {
	$('.about').toggle();
	$('html, body').animate({scrollTop: '0px'}, 150);
	if ( $('#more').html() == "[more]" ) 
		 $('#more').html("[less]");
	else
		$('#more').html("[more]");
}

/* eof */
