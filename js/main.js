//main.js for Market Bucket by @mcdemarco.

//To force authorization: https://account.app.net/oauth/authorize etc.
var authUrl = "https://account.app.net/oauth/authenticate?client_id=" + api['client_id'] + "&response_type=token&redirect_uri=" + encodeURIComponent(site) + "&scope=messages:" + api.channel_type;

var channelArray = {"now": {"column": "#list1", "channel": 0},
					"later": {"column": "#list2", "channel": 0},
					"archive": {"column": "#list3", "channel": 0}
				   };
var reverseChannelArray = {};
var tagArray = [];

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

function createChannels() {
	//Create new channels for user.
	var channel = {
		type: api.channel_type,
		auto_subscribe: true,
		annotations:  [{
						  type: api.annotation_type,
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
						  type: api.annotation_type,
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
						  type: api.annotation_type,
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
	promise.then(completeChannels, function (response) {failAlert('Failed to retrieve grocery channel.');}).done(colorizeTags);
}

function completeChannels(response) {
	if (response.data.length > 0) {
		for (var c = 0; c < response.data.length; c++) {
			var thisChannel = response.data[c];
			var annotationValue = {};
			//No longer assuming we're the only annotation.
			for (var a = 0; a < thisChannel.annotations.length; a++) {
				if (thisChannel.annotations[a].type == api.annotation_type) {
					annotationValue = thisChannel.annotations[a].value;
				}
			}
			//Eject if no settings annotation.
			if (!annotationValue) continue;
			//Save data.
			channelArray[annotationValue.list_type].annotationValue = annotationValue;
			channelArray[annotationValue.list_type].writers = thisChannel.writers.user_ids;
			//Get user/group data if this is the right channel.  Change 'now' to 1.
			if (annotationValue.list_type == 'now')
				processChannelSet(thisChannel, annotationValue);
			//Rewrite to retrieve some values directly from the annotationValue?
			$(channelArray[annotationValue.list_type].column + " h2 span.mainTitle").html((annotationValue.title ? annotationValue.title : annotationValue.list_type));
			var args = {
				include_annotations: 1
			};
			channelArray[annotationValue.list_type].channel = thisChannel.id;
			reverseChannelArray[thisChannel.id] = annotationValue.list_type;
			var promise = $.appnet.message.getChannel(thisChannel.id, args);
			promise.then(completeChannel, function (response) {failAlert('Failed to retrieve items.');}).done(colorizeTags);
		}
	} else {
		//Ask before creating; the user may not want them.
		//Or make a publically writeable sandbox channel set...
		//createChannels();
	}
}

function completeChannel(response) {
	//Populate the UI for an individual retrieved list.
	if (response.data.length > 0) {
		for (var i=0; i < response.data.length; i++) {
			formatItem(response.data[i]);
			collectTags(response.data[i].entities.hashtags);
		}
	}
}

function processChannelSet(thisChannel,annotationValue) {
	//Owner not included in the editors list, so add separately.
	displayUserResult(thisChannel.owner, "owner");
	//User data.
	if (thisChannel.writers.user_ids.length > 0) {
		//Retrieve the user data.
		var promise = $.appnet.user.getList(thisChannel.writers.user_ids);
		promise.then(completeUsers, function (response) {failAlert('Failed to retrieve users.');});
	}

	//List group data.
	if ("list_group_name" in annotationValue)
		$("input#listSet").val(annotationValue.list_group_name);
}

function completeUsers(response) {
	for (u=0; u < response.data.length; u++) {
		displayUserResult(response.data[u]);
	}
}

/* item functions */

function addItem() {
	var message = $("textarea#item").val();
	if (message == "") return;
	if (!$("input[name=bucketBucket]").is(":checked")) {
		alert("No list selected for item.");
		return;
	}
	$("input[name=bucketBucket]").each(function (index) {
		if ($(this).is(":checked"))
			createItem(channelArray[$(this).prop("id")].channel, message);
	});
}

function clearForm() {
	$("textarea#item").val("");
}

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
	forceScroll("#sectionLists");
}

function formatItem(item) {
	var itemDate = new Date(item.created_at);
	var formattedItem = "<a href='#' class='list-group-item' id='item_" + item.id + "'>";
	formattedItem += "<p class='list-group-item-text' title='Added " + itemDate.toLocaleString() + " by " + item.user.username + "'>";
	formattedItem += item.html + "</p></a>";
	$(channelArray[reverseChannelArray[item.channel_id]].column + " div.list-group").append(formattedItem);
	//Pre-format the hashtags.
	$("#item_" + item.id + " span[itemprop='hashtag']").each(function(index) {
		if (!$(this).hasClass("tag")) {
			$(this).addClass("tag").css("padding","1px 3px").css("border-radius","3px");
		}
		$(this).click(function(event) {
			event.preventDefault();
			onClickItemTag($(this).data("hashtagName"));
		});
	});
}

function moveItem(itemId, newList) {

}

function onClickAdd(channelName) {
	$("input[name=bucketBucket]").prop("checked", false);
	$("input#" + channelName).prop("checked", true);
	//pushHistory(site + "#sectionAdd");
	forceScroll("#sectionAdd");
}

/* tag functions */

function collectTags(currentTags) {
	//Populate the tag list.
	var tag;
	for (var t=0; t < currentTags.length; t++) {
		tag = currentTags[t].name;
		if (tagArray.indexOf(tag) < 0) {
			tagArray.push(tag);
			displayTags(tag);
		}
	}
}

function colorizeTags() {
	$(".tag").each(function(index) {
		if (!$(this).hasClass("colorized")) {
			var thisColor = getColor($(this).html().toLowerCase());
			$(this).css("background-color", thisColor).css("border-color", thisColor).css("color", getContrastYIQ(thisColor.substring(1,7))).addClass("colorized");
		}
	});
}

function displayTags(unhashedTag) {
	//Display tags individually as part of the tag collection process.
	var tagString = "<button type='button' class='btn btn-default btn-sm tag' onclick='onClickTagButton(this);' value='" + unhashedTag + "'>#" + unhashedTag + "</button> ";
	$(".tagBucket").append(tagString);
}

function filterListsByTag(unhashedTag) {
	if (!unhashedTag) {
		//Reset filtration.
		$("#sectionLists").find("a.list-group-item").show();
	} else {
		//Filter further.
		$("#sectionLists").find("a.list-group-item").each(function(index) {
			if ($(this).find("span[data-hashtag-name='" + unhashedTag + "']").length == 0 && (!$(this).hasClass("active")))
				$(this).hide();
		});
	}
}

function getColor(str) {
	//Get a random color from the tag text.
	for (var i = 0, hash = 0; i < str.length; hash = str.charCodeAt(i++) + ((hash << 5) - hash));
	color = Math.floor(Math.abs((Math.sin(hash) * 10000) % 1 * 16777216)).toString(16);
	var paddedColor = '#' + Array(6 - color.length + 1).join('0') + color;
    // mix the color with white (255, 255, 255) or our green 229, 245, 222 a la
	// http://stackoverflow.com/questions/43044/algorithm-to-randomly-generate-an-aesthetically-pleasing-color-palette
	var pastelColor = "#" + Math.floor((parseInt(paddedColor.substring(1,3), 16) + 229)/2).toString(16) + Math.floor((parseInt(paddedColor.substring(3,5), 16) + 245)/2).toString(16) + Math.floor((parseInt(paddedColor.substring(5,7), 16) + 222)/2).toString(16);
	return pastelColor;
}

function getContrastYIQ(hexcolor){
	//Get the contrast color for user-defined tag colors using the YIQ formula.
	var r = parseInt(hexcolor.substr(0,2),16);
	var g = parseInt(hexcolor.substr(2,2),16);
	var b = parseInt(hexcolor.substr(4,2),16);
	var yiq = ((r*299)+(g*587)+(b*114))/1000;
	return (yiq >= 128) ? 'black' : 'white';
}

function onClickItemTag(unhashedTag) {
	//Clicking a tag in the lists restricts the lists to that tag.
	filterListsByTag(unhashedTag);
}

function onClickTagButton(that) {
	//Add the tag to the item for the Add Item form, or filter by the tag for the list display.
	if ($(that).closest("form").attr("id") == "bucketItemEntry")
		$("#item").val($("#item").val() + " #" + $(that).val());
	else
		filterListsByTag($(that).val());
}


/* settings functions */

function addSetting(that) {
	var theSetting = $(that).closest("div.form-group").prop("id");
	switch (theSetting) {
		case "memberControl":
		$("#addMember").show();
		break;
	}
}

/* user functions */

function addUser(userId) {
	for (var key in channelArray) {
		if (channelArray.hasOwnProperty(key)) {
			addUserToChannel(userId,channelArray[key]);
		}
	}

	function addUserToChannel(userId, channelInfo) {
		var newUsers = channelInfo.writers.slice();
		newUsers.push(userId);
		var addArgs = {
			writers: {user_ids: newUsers} 
		};
		var promise = $.appnet.channel.update(channelInfo.channel,addArgs);
		promise.then(completeAdd, function (response) {failAlert('Addition of member failed.');});
	}
}

function completeAdd(response) {
	var userId = response.data.writers.user_ids[response.data.writers.user_ids.length - 1];
	var userRow = $("div#searchResults div#userRow_search_" + userId).detach();
	$("div#memberResults").attach(userRow);
}

function searchUsers() {
	$("div#searchResults").html("");
	var searchArgs = {q: $("input#userSearch").val(), count: 10};
	var promise = $.appnet.user.search(searchArgs);
	promise.then(completeSearch, function (response) {failAlert('Search request failed.');});
}

function completeSearch(response) {
	if (response.data.length == 0) {
		$("div#searchResults").html("<p>No users found.</p>");
	} else {
		for (var u=0; u < response.data.length; u++) {
			displayUserResult(response.data[u], "search");
		}	
	}
}

function displayUserResult(result, type) {
	var resultLocation = "div#memberResults";
	var resultString = "<div class='form-group memberRow' id='userRow_" + (type ? type + "_" : "") + result.id + "'>";
	resultString += "<div class='col-xs-4 col-md-5 text-right'>" + (result.avatar_image.is_default ? "" : "<img src='" + result.avatar_image.url + "' class='avatarImg' />") + "</div>";
	resultString += "<div class='col-xs-4 col-md-2 text-center'>@" + result.username + (result.name ? "<br /><span class='realName'>" + result.name + "</span>" : "" ) + "</div>";
	resultString += "<div class='col-xs-4 col-md-5 text-left'>";
	if (type && type=="search") {
		//Should add a check for existing membership here.
		resultString += "<a class='btn btn-default btn-sm' href='#userSearch' title='Add member' onclick='addUser(" + result.id + ")'><i class='fa fa-plus'></i></a>";
		resultLocation = "div#searchResults";
	} else if (!type || type != "owner") {
		resultString += "<a class='btn btn-default btn-sm' href='#sectionSettings' title='Remove member' onclick='removeUser(" + result.id + ")'><i class='fa fa-times'></i></a>";
	}
	resultString += "</div></div>";
	$(resultLocation).append(resultString);
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
	//document.getElementById("errorDiv").scrollIntoView();
	//$('#errorDiv').html(msg).show().fadeOut(8000);
	alert(msg);
}

function forceScroll(hash) {
	var target = $(hash);
	$('html,body').animate({scrollTop: target.offset().top - 50}, 1000);
	return false;
}

function initializeButtons() {
	$("span[data-type=addButton]").click(function (event) {
		event.preventDefault();
		onClickAdd($(this).data("list"));
	});
	$("span[data-type=settingsButton]").click(function (event) {
		event.preventDefault();
		forceScroll("#sectionSettings");
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

function pushHistory(newLocation) {
	if (history.pushState) 
		history.pushState({}, document.title, newLocation);
}

function toggleAbout() {
	$('.about').toggle();
	$('html, body').animate({scrollTop: '0px'}, 150);
	if ( $('#more').html() == "[more]" ) 
		 $('#more').html("[less]");
	else
		$('#more').html("[more]");
}

function updateChannels() {//manual channel repair for dev.
	/* Delete old annotation type
	$.appnet.channel.update(55870,{annotations:  [{ type: api.channel_type }] });
	$.appnet.channel.update(55871,{annotations:  [{ type: api.channel_type }] });
	$.appnet.channel.update(55872,{annotations:  [{ type: api.channel_type }] });
	 */
	/* add new annotation type
	$.appnet.channel.update(55870,{annotations:  [{ type: api.annotation_type, value: {'list_type': 'now'}}]});
	$.appnet.channel.update(55871,{annotations:  [{ type: api.annotation_type, value: {'list_type': 'later'}}]});
	$.appnet.channel.update(55872,{annotations:  [{ type: api.annotation_type, value: {'list_type': 'archive'}}]});
	 */
}

/* eof */
