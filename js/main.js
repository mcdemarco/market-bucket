//main.js for Market Bucket by @mcdemarco.

//To force authorization: https://account.app.net/oauth/authorize etc.
var authUrl = "https://account.app.net/oauth/authenticate?client_id=" + api['client_id'] + "&response_type=token&redirect_uri=" + encodeURIComponent(site) + "&scope=messages:net.mcdemarco.market-bucket.list";
var channelArgs = {count: -5, since_id: 'last_read_inclusive'}; //Default post count for retrieval.
var columnArray = {};
columnArray["now"] = "#col1";
columnArray["later"] = "#col2";
columnArray["archive"] = "#col3";
columnArray["hashtags"] = "#col4";

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
}

function createChannels() {
	//Create new channels for user.
	var channel = {
		type: 'net.mcdemarco.market-bucket.list',
		auto_subscribe: true,
		annotations:  [{
						  type: 'net.mcdemarco.market-bucket.list',
						  value: {'list_type': 'now'}
					  }]
	};
	var promise1 = $.appnet.channel.create(channel);
	promise1.then(createChannel2, function (response) {failAlert('Failed to create grocery channel.');});
}

function createChannel2() {
	//Create new channels for user.
	var channel2 = {
		type: 'net.mcdemarco.market-bucket.list',
		auto_subscribe: true,
		annotations:  [{
						  type: 'net.mcdemarco.market-bucket.list',
						  value: {'list_type': 'later'}
					  }]
	};
	var promise2 = $.appnet.channel.create(channel2);
	promise2.then(createChannel3, function (response) {failAlert('Failed to create grocery channel.');});
}

function createChannel3() {
	//Create new channels for user.
	var channel3 = {
		type: 'net.mcdemarco.market-bucket.list',
		auto_subscribe: true,
		annotations:  [{
						  type: 'net.mcdemarco.market-bucket.list',
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
		channel_types: 'net.mcdemarco.market-bucket.list',
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
			$(columnArray[annotation.list_type] + " h2").html((annotation.title ? annotation.title : annotation.list_type));
			var args = {
				include_annotations: 1
			};
			var promise = $.appnet.message.getChannel(thisChannel.id, args);
			promise.then(completeChannel, function (response) {failAlert('Failed to retrieve items.');});
			//api.channel_id = pasteChannel.id;
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
	$.appnet.channel.update(55870,{annotations:  [{ type: 'net.mcdemarco.market-bucket.list', value: {'list_type': 'now'}}]})
	$.appnet.channel.update(55871,{annotations:  [{ type: 'net.mcdemarco.market-bucket.list', value: {'list_type': 'later'}}]})
	$.appnet.channel.update(55872,{annotations:  [{ type: 'net.mcdemarco.market-bucket.list', value: {'list_type': 'archive'}}]})
*/}


// ***** //

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

function formatLastSeen(marker,column) {
	var markerDate = new Date(marker.updated_at);
	$(column).append("<div class='marker marked' title='Version: " + marker.version + ", Percentage: " + marker.percentage + "'>" + markerDate.toLocaleString() + " <span class='fa fa-eye'></span></div>");
}

function formatMarker(marker,column) {
	var markerDate = new Date(marker.updated_at);
	$(column).append("<div class='marker marked' title='Version: " + marker.version + ", Percentage: " + marker.percentage + "'>" + markerDate.toLocaleString() + ((marker.id == marker.last_read_id) ? " <span class='fa fa-eye'></span>" : "") + " <span onclick='markPost(" + marker.id + ",\"" + marker.name + "\"" + ", true);' class='fa fa-bookmark markButton' title='Set other markers and/or last read to post " + marker.id + "'></span></div>");
}

function formatPost(post,column,marker) {
	var postDate = new Date(post.created_at);
	$(column).append("<div class='" + (post.id > marker.last_read_id ? "after" : "before") + (post.id == marker.id ? " marked" : "") + "' " +">" + "<span class='author'><strong>@"+post.user.username+"</strong>" + (post.user.name ? " (" + post.user.name + ")" : "") + "</span><br/>" + (post.html ? post.html : "<span class='special'>[Post deleted]</span>") + "<br/>" + "<div style='text-align:right;'><a style='font-style:italic;text-decoration:none;font-size:smaller;' href='" + post.canonical_url + "'>" + postDate.toLocaleString() + "</a>" + ((post.id != marker.id) ? " <span onclick='markPost(" + post.id + ",\"" + marker.name + "\");' class='fa fa-bookmark-o markButton' title='Set marker to post " + post.id + "'></span>" : "") + "</div></div><hr/>");
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
	$(columnArray["my_stream"]).html("");
	$(columnArray["unified"]).html("");
	$(columnArray["global"]).html("");
}

function markPost(id,stream,marked) {
	//Pass the current post information into the form.
	$("#post_id").val(id);
	//Set the checkboxes to match stream.
	if (marked) {
		$("#reset_last_read").prop("checked",true);
		if (stream == "global")
			$("input[name=crickToTick]").prop("checked",false);
		else
			$("input[name=crickToTick]").prop("checked",true);
		$("input#" + stream).prop("checked",true);
	} else {
		$("#reset_last_read").prop("checked",false);
		$("input[name=crickToTick]").prop("checked",false);
		$("input#" + stream).prop("checked",true);
	}
	//Scroll to the form.
	$('html,body').animate({scrollTop: $("#tickerTicker").offset().top},'slow');
}

function pushHistory(newLocation) {
	if (history.pushState) 
		history.pushState({}, document.title, newLocation);
}

function tick() {
	//Validate.
	var post_id = $("#post_id").val();
	var intRegex = /^\d+$/;
	if (!intRegex.test(post_id)) {
		failAlert('The post id must be a non-negative integer.');
		return;
	}
	//Prepare the marker.
	var markerObj = [];
	var markerArgs = {};
	if ($("#reset_last_read").is(":checked"))
		markerArgs = {reset_read_id: 1};

	$.each(columnArray, function(key, value) {
		if ($("#" + key).is(":checked")) {
			var thisObj = {};
			thisObj['name'] = key;
			thisObj['id'] = post_id;
			markerObj.push(thisObj);
		}
	});
	//Set the stream marker(s).
	var promiseTick = $.appnet.marker.update(markerObj, markerArgs);
	promiseTick.then(completeTick, function (response)  {failAlert('Failed to update stream marker(s).');});
}

function completeTick(response) {
	//Clear form and refresh marker by reloading.
	location.reload();
	//failAlert(response.meta.code);
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
