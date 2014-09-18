//main.js for Market Bucket by @mcdemarco.

//To force authorization: https://account.app.net/oauth/authorize etc.
var authUrl = "https://account.app.net/oauth/authenticate?client_id=" + api['client_id'] + "&response_type=token&redirect_uri=" + encodeURIComponent(site) + "&scope=messages:" + api.channel_type;

var channelArray = {};
var tagArray = [];
//var messageTextArray = {};

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
		checkLocalStorageUser();
	}
	initializeButtons();
	colorizeTags();
}

function createChannel(listTypeObj) {
	//Create a new placeholder default channel for the user.
	//Later, allow the user to pick his list types and name, if any.
	var channel = {
		type: api.channel_type,
		auto_subscribe: true,
		annotations:  [{
						  type: api.annotation_type,
						  value: {'default_list': 1}
					  }]
	};
	var promise1 = $.appnet.channel.create(channel);
	promise1.then(completeCreateChannel, function (response) {failAlert('Failed to create new list.');});
}

function completeCreateChannel() {
	//console.log("channels created");
}

function getChannels() {
	//Determine channels.
	var args = {
		include_annotations: 1,
		include_inactive: 0,
		order: 'activity',
		type: api.channel_type
	};
	var promise = $.appnet.channel.search(args);
	promise.then(completeChannels, function (response) {failAlert('Failed to retrieve your list(s).');}).done(colorizeTags);
}

function completeChannels(response) {
	if (response.data.length > 0) {
		for (var c = 0; c < response.data.length; c++) {
			var thisChannel = response.data[c];
			//Not assuming we're the only annotation.
			var annotationValue = {};
			var annotationValue2 = {};
			for (var a = 0; a < thisChannel.annotations.length; a++) {
				if (thisChannel.annotations[a].type == api.annotation_type) {
					annotationValue = thisChannel.annotations[a].value;
				}
				if (thisChannel.annotations[a].type == api.message_annotation_type) {
					annotationValue2 = thisChannel.annotations[a].value;
				}
			}
			//Eject if no settings annotation.
			if (!annotationValue) continue;
			//Eject if user can't write to channel. (unlikely)
			// ...

			processChannel(response.data[c], annotationValue, annotationValue2);

			if (Object.keys(channelArray).length == 1) {
				//This channel is first in the activity ordering and will be our default if one wasn't saved.
				checkLocalStorageChannel(thisChannel.id);
			}

			//Fetch more data if this is the right channel.
 			if (api.currentChannel && api.currentChannel == thisChannel.id) {
				displayChannel(thisChannel);
			}
		}

		processChannelList();

	} else {
		//Ask before creating; the user may not want them.
		//Or make a publically writeable sandbox channel set...
		//createChannel();
	}

	function processChannel(thisChannel, annotationValue, messageAnnotationValue) {
		//Save data for every channel.
		channelArray[thisChannel.id] = {"id" : thisChannel.id,
										"name" : annotationValue["name"],
										"owner" : thisChannel.owner.id,
										"editors" : thisChannel.editors.user_ids,
										"annotationValue" : annotationValue};
		if (annotationValue.hasOwnProperty("list_types")) {
			channelArray[thisChannel.id].listTypes = annotationValue.list_types;
			channelArray[thisChannel.id].lists = messageAnnotationValue.lists;
		}
		if (messageAnnotationValue.hasOwnProperty("deletion_queue")) {
			channelArray[thisChannel.id].deletionQueue = messageAnnotationValue.deletion_queue;
		}
	}

	function displayChannel(thisChannel) {
		//Users in settings panel.
		var listTypes = (channelArray[thisChannel.id].listTypes ? channelArray[thisChannel.id].listTypes : {});
		processChannelUsers(thisChannel);

		//Make more list holders for sublists.
		if (Object.keys(listTypes).length > 0) {
			for (var i = 2; i <= listTypes.length; i++) {
				if (listTypes.hasOwnProperty(i.toString())) {
					listCloner(i, listTypes);
				}
			}
			if (listTypes.hasOwnProperty("0")) {
				listCloner(0, listTypes);
			}
		}
		//Retrieve the messages.
		var args = {
			include_deleted: 0
		};
		var promise = $.appnet.message.getChannel(thisChannel.id, args);
		promise.then(completeChannel, function (response) {failAlert('Failed to retrieve items.');}).done(colorizeTags);
	}

	function listCloner(index, listTypesObj) {
		$("div#list_1").clone().attr("id","list_" + index).data("type",index).appendTo("div#bucketListHolder");
		$("div#list_" + index + " span.mainTitle").html(listTypesObj[index.toString()].title);
		if (listTypesObj[index.toString()].hasOwnProperty("subtitle")) {
			$("div#list_" + index + " span.subTitle").html(listTypesObj[index.toString()].subtitle);
		}
	}

	function processChannelList() {
		//Put the channel list into the settings dropdown.
		for (var ch in channelArray) {
			if (channelArray.hasOwnProperty(ch)) {
				var optionString = "<option id='channel_" + ch + "' value='" + ch + "'" + ((ch == api.currentChannel) ? " selected" : "") + ">" + channelArray[ch].name + "</option>";
				$("select#listSet").append(optionString);
			}
		} 
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

function processChannelUsers(thisChannel,annotationValue) {
	//Owner not included in the editors list, so add separately.
	displayUserResult(thisChannel.owner, "owner");
	//User data.
	if (thisChannel.editors.user_ids.length > 0) {
		//Retrieve the user data.
		var promise = $.appnet.user.getList(thisChannel.editors.user_ids);
		promise.then(completeUsers, function (response) {failAlert('Failed to retrieve users.');});
	}
	//Ownership hath its privileges.
	if (thisChannel.owner.id != api.userId) {
		$("form#settingsForm a.btn.listOwner").hide();
	} else {
		//For list switching.
		$("form#settingsForm a.btn").show();
	}
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
	colorizeTags(respd.id);
	clearForm();
	forceScroll("#sectionLists");
}

function formatItem(respd) {
	//Mock deletion check.
	if (channelArray[respd.channel_id].hasOwnProperty("deletionQueue") && respd.id in channelArray[respd.channel_id].deletionQueue) {
		//Delete if creator and
		return;
	}
	//Default (sub)list.
	var listType = 1;
	//Check for alternate sublist IF the list has official sublists.
	if (channelArray[respd.channel_id].hasOwnProperty("listTypes")) {
		for (key in channelArray[respd.channel_id].listTypes) {
			if (channelArray[respd.channel_id].listTypes.hasOwnProperty(key) && 
				channelArray[respd.channel_id].lists.hasOwnProperty(key) &&
				channelArray[respd.channel_id].lists[key].indexOf(respd.id) > -1) {
				listType = key;
			}
		}
	}

	var itemDate = new Date(respd.created_at);
	var formattedItem = "<a href='#' class='list-group-item' id='item_" + respd.id + "' data-creator='" + respd.user.id + "'>";
	formattedItem += "<span class='list-group-item-text' title='Added " + itemDate.toLocaleString() + " by " + respd.user.username + "'>";
	formattedItem += respd.html + "</span>";
	formattedItem += "<button type='button' class='btn btn-default btn-xs pull-right' onclick='moveItem(" + respd.id + ")'>";
	formattedItem += ((listType == "0") ?  "<i class='fa fa-times'></i>" : "<i class='fa fa-check'></i>") + "</button></a>";
	$("#list_" + listType + " div.list-group").append(formattedItem);
	//Pre-format the hashtags.
	$("#item_" + respd.id + " span[itemprop='hashtag']").each(function(index) {
		if (!$(this).hasClass("tag")) {
			$(this).addClass("tag").css("padding","1px 3px").css("border-radius","3px");
		}
		$(this).click(function(event) {
			event.preventDefault();
			onClickItemTag($(this).data("hashtagName"));
		});
	});
	//Store the item.
	//messageTextArray[respd.id] = respd.text;
}

function moveItem(itemId) {
	//For now, only one movement path.
	thisChannelType = $("#item_" + itemId).closest("div.bucketListDiv").data("type");
	if (thisChannelType != "archive") {
		//move to archive
		//createItem(channelArray["archive"].channel, messageTextArray[itemId]);
	}
	//move from current list.
	//var promise = $.appnet.message.destroy(channelArray[thisChannelType].channel,itemId);
	//promise.then(completeDelete,  function (response) {failAlert('Failed to delete item.');});

}

function completeDelete(response) {
	$("a#item_" + response.data.id).remove();
}

function completeMove(response) {
	
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

function colorizeTags(itemId) {
	var selector = (itemId ? "#item_" + itemId + " .tag" : ".tag"); 
	$(selector).each(function(index) {
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

function getUser() {
	//We need this to check whether the user can edit his channels.
}

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

	addUserToChannel(userId,channelArray[api.currentChannel]);

	function addUserToChannel(userId, channelInfo) {
		var newUsers = channelInfo.editors.slice();
		newUsers.push(userId);
		var userArgs = {
			editors: {user_ids: newUsers} 
		};
		var promise = $.appnet.channel.update(api.currentChannel,userArgs);
		promise.then(completeAddUser, function (response) {failAlert('Addition of member failed.');});
	}
	var userRow = $("div#searchResults div#userRow_search_" + userId).detach();
	$("div#memberResults").append(userRow);
	$("div#memberResults div#userRow_search_" + userId + " a").remove();
}

function completeAddUser(response) {
	//Update the channel.
	channelArray[reverseChannelArray[response.data.id]].editors = response.data.editors.user_ids;
}

function removeUser(userId) {
	for (var key in channelArray) {
		if (channelArray.hasOwnProperty(key)) {
			removeUserFromChannel(userId,channelArray[key]);
		}
	}
	$("div#userRow_" + userId).remove();

	function removeUserFromChannel(userId, channelInfo) {
		var newUsers = channelInfo.editors.slice();
		//ADN's version of the array is of strings.
		var index = newUsers.indexOf(userId.toString());
		if (index > -1) {
			newUsers.splice(index, 1);
			var userArgs = {
				editors: {user_ids: newUsers} 
			};
			var promise = $.appnet.channel.update(channelInfo.channel,userArgs);
			promise.then(completeRemoveUser, function (response) {failAlert('Removal of member failed.');});
		}
	}
}

function completeRemoveUser(response) {
	//Only update the channel.
	channelArray[reverseChannelArray[response.data.id]].editors = response.data.editors.user_ids;
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

function checkLocalStorageChannel(defaultChannel) {
	if (localStorage && localStorage["currentChannel"]) {
			//Retrieve the current channel.
			try {api.currentChannel = localStorage["currentChannel"];} 
			catch (e) {}
	} else {
		api.currentChannel = defaultChannel;
		if (api.currentChannel && localStorage) {
			try {localStorage["currentChannel"] = api.currentChannel;}
			catch (e) {}
		}
	}
}

function setLocalStorageChannel(newChannel) {
	api.currentChannel = newChannel;
	if (api.currentChannel && localStorage) {
		//Set the new channel.
		try {localStorage["currentChannel"] = api.currentChannel;}
		catch (e) {}
	}
}

function checkLocalStorageUser() {
	if (localStorage && localStorage["userId"]) {
			try {api.userId = localStorage["userId"];} 
			catch (e) {}
	} else {
		var promise = $.appnet.user.get("me");
		promise.then(setLocalStorageUser, function (response) {failAlert('Failed to retrieve user ID.');});
	}

	function setLocalStorageUser(response) {
		api.userId = response.data.id;
		if (api.userId && localStorage) {
			try {localStorage["userId"] = api.userId;} 
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
	/* insure list groups */
//	var promise = $.appnet.channel.update(55870,{annotations:  [{ type: api.annotation_type, value: {'list_type': 'now', 'list_group': '55870'}}]});
//	promise.then(completeUpdateChannels,  function (response) {failAlert('Failed to create grocery channel.');});
//	$.appnet.channel.update(55871,{annotations:  [{ type: api.annotation_type, value: {'list_type': 'later', 'list_group': '55870'}}]});
//	$.appnet.channel.update(55872,{annotations:  [{ type: api.annotation_type, value: {'list_type': 'archive', 'list_group': '55870'}}]});

	function completeUpdateChannels(response) {
		//

	/* Type refactoring.
	$.appnet.channel.update(55870,{annotations:  [{ type: api.annotation_type, value: {'name': 'Kitchen Aids'}}]});
	$.appnet.channel.update(55871,{annotations:  [{ type: api.annotation_type, value: {'name': 'Shared Grocery List', 'list_types': {0: {'title': 'archive', 'subtitle':'The Deep Freeze'}, 1: {'title':'now', 'subtitle':'Urgent Items'}, 2: {'title':'later'}}}},{ type: api.message_annotation_type, value: {'lists': {0:['4804034']}}} ]});
	$.appnet.channel.update(55872,{annotations:  [{ type: api.annotation_type, value: {'name': 'Online Shopping List'}}]});
	 */

	}
}



/* eof */
