//main.js for Market Bucket by @mcdemarco.

//To force authorization: https://account.app.net/oauth/authorize etc.
var authUrl = "https://account.app.net/oauth/authenticate?client_id=" + api['client_id'] + "&response_type=token&redirect_uri=" + encodeURIComponent(site) + "&scope=messages:" + api.channel_type;
var channelArgs = {count: -5, since_id: 'last_read_inclusive'}; //Default post count for retrieval.
var channelArray = {"now": {"column": "#col1", "channel": 0},
					"later": {"column": "#col2", "channel": 0},
					"archive": {"column": "#col3", "channel": 0},
					"hashtags" : {"column": "#col4"}
				   };
var reverseChannelArray = {};

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
	initializeButtons();
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
			reverseChannelArray[thisChannel.id] = annotation.list_type;
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
		for (var i=0; i < response.data.length; i++) {
			formatItem(response.data[i]);
		}
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
	formatItem(respd);
	clearForm();
}

// ***** //

/* miscellaneous functions */

function clearForm() {
	$("textarea#item").val("");
}

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

function forceScroll(hash) {
	var target = $(hash);
	$('html,body').animate({scrollTop: target.offset().top - 50}, 1000);
	return false;
}

function formatItem(item) {
	var itemDate = new Date(item.created_at);
	var formattedItem = "<a href='#' class='list-group-item' id='item_" + item.id + "'>";
	formattedItem += "<p class='list-group-item-text' title='Added " + itemDate.toLocaleString() + " by " + item.user.username + "'>";
	formattedItem += item.html + "</p></a>";
	$(channelArray[reverseChannelArray[item.channel_id]].column + " div.list-group").append(formattedItem);
}

function initializeButtons() {
	$("button[data-type=addButton]").click(function (event) {
		event.preventDefault();
		onClickAdd($(this).data("list"));
	});
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

function onClickAdd(channelName) {
	$("input[name=bucketBucket]").prop("checked", false);
	$("input#" + channelName).prop("checked", true);
	pushHistory(site + "#sectionAdd");
	forceScroll("#sectionAdd");
}

function pushHistory(newLocation) {
	if (history.pushState) 
		history.pushState({}, document.title, newLocation);
}

/* tag functions */

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
